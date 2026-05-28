import { execFile } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
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
  const changedFiles = parseChangedFiles(diffText);

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

// v0 的 review 是规则型草稿；LLM 版本会在这个结构基础上生成更详细说明。
export function createReviewDraft(diff: DiffSummary): ReviewDraft {
  if (diff.changedFiles.length === 0) {
    return {
      summary: "No uncommitted git diff was found.",
      mainChanges: [],
      reviewChecklist: ["Confirm there are saved file changes or staged changes to review."],
      risks: [],
      testSuggestions: [],
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

  return {
    summary: `Current diff changes ${diff.stats.files} file(s), with ${diff.stats.additions} additions and ${diff.stats.deletions} deletions.`,
    mainChanges: diff.changedFiles.map((file) => describeFileChange(file)),
    reviewChecklist: [
      "Check whether each changed file is directly related to the current requirement.",
      "Review whether the new abstraction level is necessary for the requirement size.",
      "Confirm error handling and edge cases are still explicit and readable.",
      hasRuntimeCode
        ? "Trace the runtime entry points affected by the changed source files."
        : "Confirm these changes do not need runtime verification.",
    ],
    risks: createReviewRisks({ hasTests, hasRuntimeCode, hasConfig, hasDocs }),
    testSuggestions: createTestSuggestions({ hasTests, hasRuntimeCode, hasConfig, hasDocs }),
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
  const reportPath = await writeReviewMarkdown(repoPath, reportTitle, markdown);

  const memory = await saveSessionMemory(
    repoPath,
    {
      projectId: profile.id,
      title: reportTitle,
      keywords: createReviewKeywords(profile, diff, reportTitle),
      summary: review.summary,
      changedFiles: diff.changedFiles.map((file) => file.path),
    },
    ttlDays,
  );

  return {
    title: reportTitle,
    reportPath,
    markdown,
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
    risks.push("Runtime code changed without matching test file changes.");
  }
  if (input.hasConfig) {
    risks.push("Configuration changes may affect build, package resolution, or local startup behavior.");
  }
  if (input.hasDocs && !input.hasRuntimeCode) {
    risks.push("This appears mostly documentation-oriented; verify docs still match actual behavior.");
  }
  if (risks.length === 0) {
    risks.push("No obvious structural risk was detected by the rule-based review.");
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
    suggestions.push("Run the changed test suite and the project build command.");
  }
  if (input.hasRuntimeCode && !input.hasTests) {
    suggestions.push("Run the smallest command that exercises the changed runtime path.");
    suggestions.push("Add a focused regression test if the behavior change is user-visible.");
  }
  if (input.hasConfig) {
    suggestions.push("Run install/build/typecheck commands that validate the changed configuration.");
  }
  if (input.hasDocs && !input.hasRuntimeCode) {
    suggestions.push("No runtime test is required unless the documentation describes changed behavior.");
  }
  if (suggestions.length === 0) {
    suggestions.push("Run the project build or typecheck command as a final sanity check.");
  }

  return suggestions;
}

function createDefaultReviewTitle(diff: DiffSummary): string {
  if (diff.changedFiles.length === 0) {
    return "No local diff review";
  }

  const firstFile = diff.changedFiles[0]?.path ?? "local changes";
  return `Review ${firstFile}`;
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
    "## Main Changes",
    "",
    formatMarkdownList(review.mainChanges),
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
  ].join("\n");
}

function formatMarkdownList(items: string[]): string {
  if (items.length === 0) {
    return "- None";
  }

  return items.map((item) => `- ${item}`).join("\n");
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

function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "review";
}
