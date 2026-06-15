import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import type {
  DiffFileChange,
  DiffSummary,
  ProjectProfile,
  ReviewDraft,
  ReviewReport,
} from "../schemas/types.js";
import { saveSessionMemory } from "../memory/session-memory.js";
import { projectConfigDir } from "../utils/path.js";

const execFileAsync = promisify(execFile);

// 读取当前工作区未提交改动。后续可扩展 include staged / unstaged 两种模式。
export async function analyzeCurrentDiff(repoPath: string): Promise<DiffSummary> {
  const diffText = await runGit(repoPath, ["diff", "HEAD", "--stat", "--patch"]);
  const changedFiles = await collectChangedFiles(repoPath, diffText);

  return {
    repoPath,
    changedFiles,
    diffText,
    stats: {
      files: changedFiles.length,
      additions: changedFiles.reduce((sum, file) => sum + file.additions, 0),
      deletions: changedFiles.reduce((sum, file) => sum + file.deletions, 0),
    },
  };
}

async function collectChangedFiles(repoPath: string, diffText: string): Promise<DiffFileChange[]> {
  const files = new Map<string, DiffFileChange>();

  for (const file of parseChangedFiles(diffText)) {
    files.set(file.path, file);
  }

  for (const file of await parseUntrackedFiles(repoPath)) {
    if (!files.has(file.path)) {
      files.set(file.path, file);
    }
  }

  return [...files.values()];
}

// v0 的 review 是规则型草稿；LLM 版本会在这个结构基础上生成更详细说明。
export function createReviewDraft(diff: DiffSummary): ReviewDraft {
  if (diff.changedFiles.length === 0) {
    return {
      summary: "当前没有检测到未提交的 git diff。",
      intent: "当前还没有可以讲解的本地修改。",
      mainChanges: [],
      reviewWalkthrough: ["先保存或产生一次本地修改，然后重新运行 review。"],
      impactAreas: [],
      overEngineeringSignals: [],
      reviewChecklist: ["确认当前确实存在已保存的文件修改或 staged changes。"],
      risks: [],
      testSuggestions: [],
      nextThreadPrompt: "当前还没有可继承的本地修改上下文。",
    };
  }

  const changedPaths = diff.changedFiles.map((file) => file.path);
  // 用路径规则粗略判断本次改动是否包含测试文件。
  const hasTests = changedPaths.some((file) =>
    /(^|\/)(test|tests|__tests__|spec)\//.test(file) || /\.(test|spec)\./.test(file),
  );
  const hasRuntimeCode = changedPaths.some((file) =>
    /\.(ts|tsx|js|jsx|py|java|go|rs)$/.test(file) && !isTestFile(file),
  );
  const hasConfig = changedPaths.some((file) =>
    /(^|\/)(package\.json|tsconfig\.json|vite\.config\.|next\.config\.|pom\.xml|pyproject\.toml)$/.test(file)
    || /(^|\/)\.?(env|config)/.test(file),
  );
  const hasDocs = changedPaths.some((file) => /\.(md|mdx|txt|rst)$/.test(file));
  const impactAreas = createImpactAreas(changedPaths);
  const summary = `当前 diff 修改了 ${diff.stats.files} 个文件，新增 ${diff.stats.additions} 行，删除 ${diff.stats.deletions} 行。`;

  return {
    summary,
    intent: createReviewIntent(diff.changedFiles, impactAreas),
    mainChanges: diff.changedFiles.map((file) => describeFileChange(file)),
    reviewWalkthrough: createReviewWalkthrough(diff.changedFiles),
    impactAreas,
    overEngineeringSignals: createOverEngineeringSignals(diff),
    reviewChecklist: [
      "检查每个修改文件是否都直接服务于当前需求。",
      "确认新增抽象是否匹配需求规模，避免为了小改动引入过多层级。",
      "确认错误处理和边界情况仍然清晰可读。",
      hasRuntimeCode
        ? "沿着受影响的运行入口追踪一遍代码执行路径。"
        : "确认这些修改不需要额外的运行时验证。",
    ],
    risks: createReviewRisks({ hasTests, hasRuntimeCode, hasConfig, hasDocs }),
    testSuggestions: createTestSuggestions({ hasTests, hasRuntimeCode, hasConfig, hasDocs }),
    nextThreadPrompt: createNextThreadPrompt(summary, diff.changedFiles, impactAreas),
  };
}

// 把一次 review 固化成“报告 + 记忆”。这是 SpecWeft 后续跨线程恢复上下文的核心闭环。
export async function createReviewReport(
  repoPath: string,
  profile: ProjectProfile,
  title: string | undefined,
  ttlDays = 7,
): Promise<ReviewReport> {
  const diff = await analyzeCurrentDiff(repoPath);
  const review = createReviewDraft(diff);
  const reportTitle = title?.trim() || createDefaultReviewTitle(diff);
  const markdown = formatReviewMarkdown(reportTitle, diff, review);
  const html = formatReviewHtml(reportTitle, diff, review);
  const reportPath = await writeReviewMarkdown(repoPath, reportTitle, markdown);

  const memory = await saveSessionMemory(
    repoPath,
    {
      projectId: profile.id,
      title: reportTitle,
      keywords: createReviewKeywords(profile, diff, reportTitle),
      summary: review.summary,
      changedFiles: diff.changedFiles.map((file) => file.path),
      reviewPath: reportPath,
      nextThreadPrompt: review.nextThreadPrompt,
    },
    ttlDays,
  );

  return {
    title: reportTitle,
    reportPath,
    markdown,
    html,
    review,
    memory,
  };
}

async function runGit(repoPath: string, args: string[]): Promise<string> {
  try {
    const result = await execFileAsync("git", args, {
      cwd: repoPath,
      maxBuffer: 20 * 1024 * 1024,
    });
    return result.stdout;
  } catch {
    // 仓库不是 git repo 或 git 命令失败时，先返回空 diff，避免 CLI 直接崩。
    return "";
  }
}

function parseChangedFiles(diffText: string): DiffFileChange[] {
  const files = new Map<string, DiffFileChange>();

  // 第一遍：通过 diff --git 行收集被修改的文件。
  for (const line of diffText.split("\n")) {
    const match = /^diff --git a\/(.+) b\/(.+)$/.exec(line);
    if (!match) {
      continue;
    }

    const filePath = match[2] ?? match[1];
    files.set(filePath, {
      path: filePath,
      additions: 0,
      deletions: 0,
      changeType: "unknown",
    });
  }

  let currentFile: DiffFileChange | undefined;
  // 第二遍：在当前文件上下文中统计 + / - 行数。
  for (const line of diffText.split("\n")) {
    const match = /^diff --git a\/(.+) b\/(.+)$/.exec(line);
    if (match) {
      currentFile = files.get(match[2] ?? match[1]);
      continue;
    }

    if (currentFile && line.startsWith("new file mode")) {
      currentFile.changeType = "added";
      continue;
    }

    if (currentFile && line.startsWith("deleted file mode")) {
      currentFile.changeType = "deleted";
      continue;
    }

    if (currentFile && line.startsWith("similarity index")) {
      currentFile.changeType = "renamed";
      continue;
    }

    if (!currentFile || line.startsWith("+++") || line.startsWith("---")) {
      // +++ / --- 是 diff 文件头，不代表真实代码增删。
      continue;
    }

    if (line.startsWith("+")) {
      currentFile.additions += 1;
    }
    if (line.startsWith("-")) {
      currentFile.deletions += 1;
    }
  }

  return [...files.values()];
}

async function parseUntrackedFiles(repoPath: string): Promise<DiffFileChange[]> {
  const statusText = await runGit(repoPath, ["status", "--porcelain=v1", "--untracked-files=all"]);
  const filePaths = statusText
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => line.startsWith("?? "))
    .map((line) => line.slice(3).trim())
    .filter(Boolean);

  return Promise.all(
    filePaths.map(async (filePath) => ({
      path: filePath,
      additions: await countFileLines(path.join(repoPath, filePath)),
      deletions: 0,
      changeType: "added" as const,
    })),
  );
}

async function countFileLines(filePath: string): Promise<number> {
  try {
    const content = await readFile(filePath, "utf-8");
    if (content.length === 0) {
      return 0;
    }

    return content.split("\n").length - (content.endsWith("\n") ? 1 : 0);
  } catch {
    return 0;
  }
}

function describeFileChange(file: DiffFileChange): string {
  const area = detectFileArea(file.path);
  const changeType = file.changeType === "unknown" ? "modified" : file.changeType;
  return `${changeType} ${file.path} (${area}, +${file.additions}/-${file.deletions})`;
}

function detectFileArea(filePath: string): string {
  if (isTestFile(filePath)) {
    return "test";
  }
  if (/\.(md|mdx|txt|rst)$/.test(filePath)) {
    return "docs";
  }
  if (/package\.json|tsconfig\.json|pom\.xml|pyproject\.toml|lock$|lock\.yaml$/.test(filePath)) {
    return "config";
  }
  if (/\.(ts|tsx|js|jsx|py|java|go|rs)$/.test(filePath)) {
    return "runtime code";
  }
  return "project file";
}

function isTestFile(filePath: string): boolean {
  return /(^|\/)(test|tests|__tests__|spec)\//.test(filePath) || /\.(test|spec)\./.test(filePath);
}

function createReviewRisks(input: {
  hasTests: boolean;
  hasRuntimeCode: boolean;
  hasConfig: boolean;
  hasDocs: boolean;
}): string[] {
  const risks: string[] = [];

  if (input.hasRuntimeCode && !input.hasTests) {
    risks.push("运行时代码发生修改，但没有看到对应测试文件改动。");
  }
  if (input.hasConfig) {
    risks.push("配置改动可能影响构建、包解析或本地启动行为。");
  }
  if (input.hasDocs && !input.hasRuntimeCode) {
    risks.push("本次修改看起来主要是文档改动，需要确认文档仍然匹配真实行为。");
  }
  if (risks.length === 0) {
    risks.push("规则版 review 没有发现明显结构风险。");
  }

  return risks;
}

function createTestSuggestions(input: {
  hasTests: boolean;
  hasRuntimeCode: boolean;
  hasConfig: boolean;
  hasDocs: boolean;
}): string[] {
  const suggestions: string[] = [];

  if (input.hasTests) {
    suggestions.push("运行被修改的测试集，并执行项目构建命令。");
  }
  if (input.hasRuntimeCode && !input.hasTests) {
    suggestions.push("运行能覆盖本次运行路径的最小验证命令。");
    suggestions.push("如果行为变化会影响用户，补一个聚焦的回归测试。");
  }
  if (input.hasConfig) {
    suggestions.push("运行 install/build/typecheck 等能验证配置变更的命令。");
  }
  if (input.hasDocs && !input.hasRuntimeCode) {
    suggestions.push("如果文档没有描述新的运行行为，通常不需要额外运行时测试。");
  }
  if (suggestions.length === 0) {
    suggestions.push("运行项目构建或类型检查，作为最终冒烟验证。");
  }

  return suggestions;
}

function createDefaultReviewTitle(diff: DiffSummary): string {
  if (diff.changedFiles.length === 0) {
    return "本地修改讲解";
  }

  const firstFile = diff.changedFiles[0]?.path ?? "local changes";
  return `讲解 ${firstFile}`;
}

function formatReviewMarkdown(
  title: string,
  diff: DiffSummary,
  review: ReviewDraft,
): string {
  return [
    `# ${title}`,
    "",
    "## Summary",
    "",
    review.summary,
    "",
    "## Intent",
    "",
    review.intent,
    "",
    "## Main Changes",
    "",
    formatMarkdownList(review.mainChanges),
    "",
    "## How To Review",
    "",
    formatMarkdownList(review.reviewWalkthrough),
    "",
    "## Impact Areas",
    "",
    formatMarkdownList(review.impactAreas),
    "",
    "## Over-Engineering Signals",
    "",
    formatMarkdownList(review.overEngineeringSignals),
    "",
    "## Review Checklist",
    "",
    formatMarkdownList(review.reviewChecklist),
    "",
    "## Risks",
    "",
    formatMarkdownList(review.risks),
    "",
    "## Test Suggestions",
    "",
    formatMarkdownList(review.testSuggestions),
    "",
    "## Changed Files",
    "",
    formatMarkdownList(
      diff.changedFiles.map(
        (file) => `${file.path} (+${file.additions} / -${file.deletions})`,
      ),
    ),
    "",
    "## Next Thread Prompt",
    "",
    review.nextThreadPrompt,
    "",
  ].join("\n");
}

// Web UI 直接渲染这份 HTML，避免让前端维护一套不完整的 Markdown parser。
export function formatReviewHtml(
  title: string,
  diff: DiffSummary,
  review: ReviewDraft,
): string {
  return [
    "<div class=\"specweft-review-report\">",
    `<section class="specweft-review-hero"><h1>${escapeHtml(title)}</h1><p>${escapeHtml(review.summary)}</p></section>`,
    `<section><h2>修改意图</h2><p>${escapeHtml(review.intent)}</p></section>`,
    reviewSection("主要改动", review.mainChanges),
    reviewSection("建议阅读顺序", review.reviewWalkthrough),
    reviewSection("影响范围", review.impactAreas),
    reviewSection("过度设计信号", review.overEngineeringSignals),
    reviewSection("Review 清单", review.reviewChecklist),
    reviewSection("风险提示", review.risks),
    reviewSection("测试建议", review.testSuggestions),
    reviewSection(
      "修改文件",
      diff.changedFiles.map((file) => `${file.path} (+${file.additions} / -${file.deletions})`),
    ),
    `<section><h2>新线程提示</h2><p>${escapeHtml(review.nextThreadPrompt)}</p></section>`,
    "</div>",
  ].join("");
}

function formatMarkdownList(items: string[]): string {
  if (items.length === 0) {
    return "- None";
  }

  return items.map((item) => `- ${item}`).join("\n");
}

function reviewSection(title: string, items: string[]): string {
  return `<section><h2>${escapeHtml(title)}</h2>${formatHtmlList(items)}</section>`;
}

function formatHtmlList(items: string[]): string {
  if (items.length === 0) {
    return "<p>None</p>";
  }

  return `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

async function writeReviewMarkdown(
  repoPath: string,
  title: string,
  markdown: string,
): Promise<string> {
  const reportsDir = path.join(projectConfigDir(repoPath), "reports");
  const fileName = `${new Date().toISOString().replaceAll(":", "-")}-${slugify(title)}.md`;
  const reportPath = path.join(reportsDir, fileName);

  await mkdir(reportsDir, { recursive: true });
  await writeFile(reportPath, markdown, "utf-8");

  return reportPath;
}

function createReviewKeywords(
  profile: ProjectProfile,
  diff: DiffSummary,
  title: string,
): string[] {
  const rawKeywords = [
    title,
    profile.name,
    ...profile.languages,
    ...profile.frameworks,
    ...diff.changedFiles.map((file) => path.basename(file.path)),
  ];

  return [...new Set(rawKeywords.map((item) => item.trim()).filter(Boolean))].slice(0, 20);
}

function createReviewIntent(files: DiffFileChange[], areas: string[]): string {
  const primaryArea = areas[0] ?? "project";
  const verbs = new Set(files.map((file) => file.changeType === "unknown" ? "modified" : file.changeType));
  return `这次修改主要是在 ${primaryArea} 范围内执行 ${[...verbs].join(", ")} 操作。建议先看变更量最大的文件，再确认其他小文件是否都在支撑同一个需求。`;
}

function createReviewWalkthrough(files: DiffFileChange[]): string[] {
  return [...files]
    .sort((left, right) => (right.additions + right.deletions) - (left.additions + left.deletions))
    .slice(0, 6)
    .map((file, index) => {
      const area = detectFileArea(file.path);
      const prefix = index === 0 ? "先看" : "再看";
      return `${prefix} ${file.path}: ${area}，+${file.additions}/-${file.deletions}。判断它是承载主要行为变化，还是只是配套支持。`;
    });
}

function createImpactAreas(paths: string[]): string[] {
  const areas = new Set<string>();

  for (const filePath of paths) {
    areas.add(detectFileArea(filePath));
    const firstSegment = filePath.split("/")[0];
    if (firstSegment && firstSegment !== filePath) {
      areas.add(`${firstSegment}/`);
    }
  }

  return [...areas].slice(0, 10);
}

function createOverEngineeringSignals(diff: DiffSummary): string[] {
  const signals: string[] = [];
  const runtimeFiles = diff.changedFiles.filter((file) => detectFileArea(file.path) === "runtime code");
  const totalDelta = diff.stats.additions + diff.stats.deletions;

  if (runtimeFiles.length >= 5 && totalDelta < 160) {
    signals.push("较小的 diff 修改了较多运行时代码文件，需要确认抽象扩散是否真的必要。");
  }
  if (diff.changedFiles.some((file) => /factory|manager|registry|adapter|provider/i.test(file.path))) {
    signals.push("修改涉及 factory/manager/registry/adapter/provider 等抽象型文件名，需要确认新层级确实降低了复杂度。");
  }
  if (diff.changedFiles.some((file) => /types?|schema|interface/i.test(file.path)) && runtimeFiles.length > 0) {
    signals.push("共享类型和运行时代码一起变化，需要检查下游兼容性。");
  }
  if (signals.length === 0) {
    signals.push("规则版 review 没有发现明显过度设计信号。");
  }

  return signals;
}

function createNextThreadPrompt(
  summary: string,
  files: DiffFileChange[],
  areas: string[],
): string {
  const changedFiles = files.map((file) => file.path).slice(0, 8).join(", ") || "none";
  const impactAreas = areas.slice(0, 6).join(", ") || "unknown";
  return [
    "从这条 SpecWeft 记忆继续。",
    summary,
    `影响范围：${impactAreas}。`,
    `修改文件：${changedFiles}。`,
    "请先解释上一次修改，再检查当前 git diff 后继续推进。",
  ].join(" ");
}

function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "review";
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#039;");
}
