import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import type {
  DiffFileChange,
  DiffSummary,
  MemoryDigest,
  ProjectProfile,
  RequirementRecord,
  ReviewChangeGroup,
  ReviewDraft,
  ReviewOverviewBatch,
  ReviewRequirementBlock,
  ReviewReport,
  WorkSegment,
} from "../schemas/types.js";
import { createMemoryDigest, saveSessionMemory } from "../memory/session-memory.js";
import {
  attachReviewToRequirement,
  listRequirements,
  resolveRequirementForReview,
} from "../requirements/requirement-manager.js";
import { projectConfigDir } from "../utils/path.js";
import { createGitChangeSnapshot } from "../git/change-snapshot.js";
import { enhanceReviewWithLlm } from "../review/llm-review.js";
import { completeWorkSegment, getActiveWorkSegment } from "../work-segments/work-segment-manager.js";

const execFileAsync = promisify(execFile);

type ReviewDraftContext = {
  requirements?: RequirementRecord[];
  memoryDigest?: MemoryDigest;
  activeRequirementId?: string;
  activeWorkSegment?: WorkSegment;
};

type ReviewGroupMatch = {
  key: string;
  score: number;
  reason: string;
  confidence: ReviewChangeGroup["confidence"];
};

type RequirementHintScore = {
  score: number;
  reasons: string[];
  fileMatches: number;
  strongFileMatches: number;
  keywordMatches: number;
};

type FunctionalGroupMetadata = {
  title: string;
  area: string;
  purpose: string;
  reviewNotes: string[];
  testSuggestions: string[];
};

const FUNCTIONAL_GROUPS: Record<string, FunctionalGroupMetadata> = {
  "functional:web-ui": {
    title: "Web UI 展示与交互",
    area: "web-ui",
    purpose: "这组文件负责 SpecWeft 的可视化界面、HTML 展示或交互状态，review 时优先确认用户能不能看懂、点得动、找得到。",
    reviewNotes: [
      "先从用户看到的页面结构读起，再回到接口数据结构。",
      "确认页面展示的是整理后的 HTML 信息，而不是把原始 JSON 直接丢给用户。",
    ],
    testSuggestions: ["运行 Web UI 烟测；如果改了页面结构，至少确认核心视图仍能渲染。"],
  },
  "functional:memory": {
    title: "记忆索引与需求档案",
    area: "memory",
    purpose: "这组文件负责会话记忆、需求档案、上下文恢复入口，review 时重点确认不会把无关记忆塞满上下文。",
    reviewNotes: [
      "确认记忆是按需求线组织，而不是按时间无差别堆叠。",
      "检查过期、回滚、stale/current 状态是否会影响召回结果。",
    ],
    testSuggestions: ["运行 memory 相关测试，确认 digest、dossier、recall 的排序和过滤仍然稳定。"],
  },
  "functional:requirement": {
    title: "需求线管理",
    area: "requirements",
    purpose: "这组文件负责创建、激活和绑定需求线，review 时重点确认一次修改会挂到正确的需求上下文。",
    reviewNotes: [
      "确认新 review 绑定的是当前需求或显式指定的需求。",
      "检查需求标题、关键词和 summary 是否能支撑后续恢复上下文。",
    ],
    testSuggestions: ["运行 requirement manager 相关测试，覆盖创建、激活和 review 绑定流程。"],
  },
  "functional:task-prepare": {
    title: "任务准备与文件定位",
    area: "task-prepare",
    purpose: "这组文件负责把用户模糊需求整理成可执行上下文包，review 时重点确认它能补问题、找文件、推荐 Skill、控制记忆范围。",
    reviewNotes: [
      "用真实中文需求检查 suggestedSearches、fileRole 和 codePointers 是否符合直觉。",
      "确认模糊需求会先补边界，而不是鼓励 Agent 直接大范围修改。",
    ],
    testSuggestions: ["运行 task-preparer 测试，并补一个贴近真实中文需求的路由用例。"],
  },
  "functional:review": {
    title: "代码讲解与 Review 报告",
    area: "review",
    purpose: "这组文件负责把 git diff 讲成人能读懂的修改说明，review 时重点确认分组、源码查看方式、风险和测试建议足够清楚。",
    reviewNotes: [
      "确认多个需求混在同一个暂存区时，会尽量拆成不同讲解块。",
      "检查 HTML 报告和 Markdown 报告是否表达一致。",
    ],
    testSuggestions: ["运行 diff-analyzer 测试，确认分组标题、key-value 和源码查看方式没有回退。"],
  },
  "functional:capability": {
    title: "能力池、Skill 与 MCP 适配",
    area: "capability",
    purpose: "这组文件负责 Skill/MCP/CLI 能力的发现、推荐、启用和装配，review 时重点确认推荐不会覆盖本地规范。",
    reviewNotes: [
      "确认 Skill 是辅助上下文，不会强制用户安装不必要的 MCP。",
      "检查高风险或可能冲突的外部能力是否被标记清楚。",
    ],
    testSuggestions: ["运行 pool、marketplace、capability center 相关测试。"],
  },
  "functional:recording": {
    title: "代码快照与记录状态",
    area: "recording",
    purpose: "这组文件负责判断当前 diff 是否已经记录、是否回滚或过期，review 时重点确认记忆不会指向已经不存在的代码。",
    reviewNotes: [
      "确认 diff hash、changed files 和当前工作区状态的判断一致。",
      "检查回滚后 recall/review 展示是否会明确提示 stale 或 reverted。",
    ],
    testSuggestions: ["运行记录状态和 memory codeStatus 相关测试。"],
  },
  "functional:bootstrap": {
    title: "Agent 接入与启动引导",
    area: "bootstrap",
    purpose: "这组文件负责让 Codex/Claude 无感接入 SpecWeft，review 时重点确认 init、AGENTS/CLAUDE 指令和 MCP 工具名一致。",
    reviewNotes: [
      "确认新用户只需要 init，就能让 Agent 知道何时调用 SpecWeft。",
      "检查引导文案没有把 MCP 安装描述成主流程。",
    ],
    testSuggestions: ["运行 bootstrap 测试和 release smoke，确认打包后的 CLI 仍可用。"],
  },
  "functional:cli-runtime": {
    title: "CLI 命令入口与本地运行",
    area: "cli-runtime",
    purpose: "这组文件负责命令解析、启动 Web UI、状态输出和本地运行体验，review 时重点确认命令短、中文帮助清楚、默认 repo 正确。",
    reviewNotes: [
      "确认用户在项目目录执行 specweft start/review/prepare 不需要反复传 --repo。",
      "检查错误信息是否能指导用户下一步怎么做。",
    ],
    testSuggestions: ["运行 release smoke，覆盖打包安装后的 CLI help、start、review、prepare。"],
  },
  "functional:mcp-server": {
    title: "SpecWeft MCP 工具服务",
    area: "mcp-server",
    purpose: "这组文件负责暴露给 Codex/Claude 的 MCP 工具，review 时重点确认工具命名、入参和输出都适合 Agent 自动调用。",
    reviewNotes: [
      "确认工具输出是上下文包和摘要，不是把所有历史记忆直接塞出去。",
      "检查新增工具是否已在 mcp-inspect 和 smoke 流程中可见。",
    ],
    testSuggestions: ["运行 mcp-inspect 和 release smoke，确认工具列表完整。"],
  },
  "functional:verification": {
    title: "验证与发布烟测",
    area: "verification",
    purpose: "这组文件负责验证、打包和发布前烟测，review 时重点确认它们覆盖真实用户安装后的使用方式。",
    reviewNotes: [
      "确认 smoke 测的是打包产物，而不是只测源码工作区。",
      "检查失败信息是否能快速定位是构建、包内容还是运行时问题。",
    ],
    testSuggestions: ["运行 pnpm verify 和 pnpm publish:dry。"],
  },
};

const BLOCK_KIND_LABELS: Record<ReviewRequirementBlock["kind"], string> = {
  "current-work": "当前需求",
  "historical-requirement": "历史需求",
  "functional-area": "功能域",
  "carried-work": "旧改动",
};

// 读取当前工作区未提交改动。后续可扩展 include staged / unstaged 两种模式。
export async function analyzeCurrentDiff(repoPath: string): Promise<DiffSummary> {
  const diffText = await runGit(repoPath, ["diff", "HEAD", "--stat", "--patch", "--", ".", ":(exclude).specweft"]);
  const changedFiles = await collectChangedFiles(repoPath, diffText);
  const snapshot = await createGitChangeSnapshot(repoPath, diffText, changedFiles);

  return {
    repoPath,
    changedFiles,
    diffText,
    snapshot,
    stats: {
      files: changedFiles.length,
      additions: changedFiles.reduce((sum, file) => sum + file.additions, 0),
      deletions: changedFiles.reduce((sum, file) => sum + file.deletions, 0),
    },
  };
}

async function collectChangedFiles(repoPath: string, diffText: string): Promise<DiffFileChange[]> {
  const files = new Map<string, DiffFileChange>();

  for (const file of parseChangedFiles(diffText).filter((file) => shouldIncludeDiffFile(file.path))) {
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
export function createReviewDraft(diff: DiffSummary, context: ReviewDraftContext = {}): ReviewDraft {
  if (diff.changedFiles.length === 0) {
    return {
      summary: "当前没有检测到未提交的 git diff。",
      intent: "当前还没有可以讲解的本地修改。",
      reviewOverview: {
        title: "没有可讲解的本地修改",
        summary: "当前工作区没有检测到可用于 review 的代码改动。",
        keyValues: [],
        batches: [],
        readingOrder: ["先保存或产生一次本地修改，然后重新运行 review。"],
      },
      requirementBlocks: [],
      changeGroups: [],
      implementationSummary: [],
      mainChanges: [],
      sourceReadingGuide: [],
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
  const changeGroups = createReviewChangeGroups(diff, context);
  const requirementBlocks = createReviewRequirementBlocks(changeGroups, context.activeWorkSegment);
  const summary = createDraftSummary(diff);
  const reviewOverview = createReviewOverview(diff, requirementBlocks, changeGroups, context.activeWorkSegment);
  const workSegmentNotes = createWorkSegmentReviewNotes(context.activeWorkSegment, diff);
  const workSegmentRisk = createWorkSegmentRisk(context.activeWorkSegment);

  return {
    summary,
    intent: createReviewIntent(diff.changedFiles, impactAreas, context.activeWorkSegment),
    reviewOverview,
    requirementBlocks,
    changeGroups,
    implementationSummary: createImplementationSummary(diff, {
      hasTests,
      hasRuntimeCode,
      hasConfig,
      hasDocs,
    }),
    mainChanges: diff.changedFiles.map((file) => describeFileChange(file)),
    sourceReadingGuide: createSourceReadingGuide(diff),
    reviewWalkthrough: [
      ...workSegmentNotes,
      ...createReviewWalkthrough(diff.changedFiles),
    ],
    impactAreas,
    overEngineeringSignals: createOverEngineeringSignals(diff),
    reviewChecklist: [
      ...createWorkSegmentChecklist(context.activeWorkSegment),
      "检查每个修改文件是否都直接服务于当前需求。",
      "确认新增抽象是否匹配需求规模，避免为了小改动引入过多层级。",
      "确认错误处理和边界情况仍然清晰可读。",
      hasRuntimeCode
        ? "沿着受影响的运行入口追踪一遍代码执行路径。"
        : "确认这些修改不需要额外的运行时验证。",
    ],
    risks: [
      ...workSegmentRisk,
      ...createReviewRisks({ hasTests, hasRuntimeCode, hasConfig, hasDocs }),
    ],
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
  requirementId?: string,
): Promise<ReviewReport> {
  const diff = await analyzeCurrentDiff(repoPath);
  if (diff.changedFiles.length === 0) {
    throw new Error("当前没有未提交的代码改动。SpecWeft 不会为空 diff 创建 review 或记忆；如只想查看状态，请使用 review_current_diff。");
  }

  const activeSegment = await getActiveWorkSegment(repoPath);
  const reportTitle = title?.trim() || createDefaultReviewTitle(diff, activeSegment);
  const [requirementFile, memoryDigest] = await Promise.all([
    listRequirements(repoPath),
    createMemoryDigest(repoPath, profile),
  ]);
  const requirement = await resolveRequirementForReview(
    repoPath,
    {
      projectId: profile.id,
      title: reportTitle,
      keywords: createReviewKeywords(profile, diff, reportTitle),
      summary: createDraftSummary(diff),
    },
    requirementId,
  );
  const review = await enhanceReviewWithLlm(createReviewDraft(diff, {
    requirements: requirementFile.requirements,
    activeRequirementId: requirement.id,
    memoryDigest,
    activeWorkSegment: activeSegment,
  }), diff, profile);
  const markdown = formatReviewMarkdown(reportTitle, diff, review);
  const html = formatReviewHtml(reportTitle, diff, review);
  const reportPath = await writeReviewMarkdown(repoPath, reportTitle, markdown, requirement);

  const memory = await saveSessionMemory(
    repoPath,
    {
      projectId: profile.id,
      requirementId: requirement.id,
      requirementTitle: requirement.title,
      workSegmentId: activeSegment?.id,
      title: reportTitle,
      keywords: createReviewKeywords(profile, diff, reportTitle),
      summary: review.summary,
      changedFiles: diff.changedFiles.map((file) => file.path),
      codeSnapshot: diff.snapshot,
      codeStatus: "current",
      codeStatusReason: "这条 review 刚刚根据当前 diff 生成。",
      reviewPath: reportPath,
      nextThreadPrompt: review.nextThreadPrompt,
    },
    ttlDays,
  );
  const updatedRequirement = await attachReviewToRequirement(repoPath, requirement.id, {
    reviewPath: reportPath,
    memoryId: memory.id,
    summary: review.summary,
    keywords: memory.keywords,
  });
  await completeWorkSegment(repoPath, {
    segmentId: activeSegment?.id,
    status: "recorded",
    title: reportTitle,
    summary: review.summary,
    reviewPath: reportPath,
    memoryId: memory.id,
    requirement: updatedRequirement,
  });

  return {
    title: reportTitle,
    reportPath,
    markdown,
    html,
    review,
    memory,
    requirement: updatedRequirement,
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

function createDraftSummary(diff: DiffSummary): string {
  return `当前 diff 修改了 ${diff.stats.files} 个文件，新增 ${diff.stats.additions} 行，删除 ${diff.stats.deletions} 行。`;
}

async function parseUntrackedFiles(repoPath: string): Promise<DiffFileChange[]> {
  const statusText = await runGit(repoPath, ["status", "--porcelain=v1", "--untracked-files=all"]);
  const filePaths = statusText
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => line.startsWith("?? "))
    .map((line) => line.slice(3).trim())
    .filter((filePath) => Boolean(filePath) && shouldIncludeDiffFile(filePath));

  return Promise.all(
    filePaths.map(async (filePath) => ({
      path: filePath,
      additions: await countFileLines(path.join(repoPath, filePath)),
      deletions: 0,
      changeType: "added" as const,
    })),
  );
}

function shouldIncludeDiffFile(filePath: string): boolean {
  return !filePath.startsWith(".specweft/");
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

function createReviewChangeGroups(diff: DiffSummary, context: ReviewDraftContext): ReviewChangeGroup[] {
  const groups = new Map<string, {
    files: DiffFileChange[];
    matches: ReviewGroupMatch[];
  }>();
  const requirementHints = createRequirementGroupHints(context);

  for (const file of diff.changedFiles) {
    const match = createRequirementGroupMatch(file, requirementHints)
      ?? createFallbackGroupMatch(file);
    const group = groups.get(match.key) ?? { files: [], matches: [] };
    group.files.push(file);
    group.matches.push(match);
    groups.set(match.key, group);
  }

  return [...groups.entries()]
    .map(([key, group]) => createReviewChangeGroup(key, group.files, group.matches, requirementHints.get(key)))
    .sort((left, right) => {
      const delta = groupDelta(right.files) - groupDelta(left.files);
      if (delta !== 0) {
        return delta;
      }
      return left.title.localeCompare(right.title);
    });
}

function createReviewChangeGroup(
  key: string,
  files: DiffFileChange[],
  matches: ReviewGroupMatch[],
  hint?: RequirementGroupHint,
): ReviewChangeGroup {
  const sortedFiles = [...files].sort((left, right) => groupDelta([right]) - groupDelta([left]));
  const additions = files.reduce((sum, file) => sum + file.additions, 0);
  const deletions = files.reduce((sum, file) => sum + file.deletions, 0);
  const area = hint ? `requirement:${hint.title}` : createGroupArea(key, files);
  const title = hint ? `需求：${hint.title}` : createGroupTitle(key, files);
  const purpose = hint ? createRequirementGroupPurpose(hint, files) : createGroupPurpose(key, files);
  const matchReason = summarizeGroupMatch(matches, hint);
  const confidence = summarizeGroupConfidence(matches);

  return {
    id: slugify(`${key}-${title}`),
    title,
    purpose,
    area,
    matchReason,
    confidence,
    files: sortedFiles,
    keyValues: [
      { key: "范围", value: area },
      { key: "分组依据", value: matchReason },
      { key: "置信度", value: formatConfidence(confidence) },
      { key: "文件数", value: `${files.length}` },
      { key: "变更量", value: `+${additions}/-${deletions}` },
      { key: "主要文件", value: sortedFiles.slice(0, 5).map((file) => file.path).join(", ") },
      { key: "改动类型", value: createGroupChangeTypes(files).join(", ") },
      { key: "解读", value: purpose },
    ],
    reviewNotes: hint ? createRequirementGroupReviewNotes(hint, sortedFiles) : createGroupReviewNotes(key, sortedFiles),
    testSuggestions: hint ? createRequirementGroupTestSuggestions(hint, sortedFiles) : createGroupTestSuggestions(key, sortedFiles),
  };
}

function createReviewRequirementBlocks(
  groups: ReviewChangeGroup[],
  activeWorkSegment?: WorkSegment,
): ReviewRequirementBlock[] {
  const baselineFiles = new Set(activeWorkSegment?.baselineChangedFiles ?? []);
  const blocks: ReviewRequirementBlock[] = [];

  for (const group of groups) {
    if (activeWorkSegment && baselineFiles.size > 0) {
      const newFiles = group.files.filter((file) => !baselineFiles.has(file.path));
      const carriedFiles = group.files.filter((file) => baselineFiles.has(file.path));

      if (newFiles.length > 0) {
        blocks.push(createReviewRequirementBlock(group, newFiles, "current-work", activeWorkSegment));
      }
      if (carriedFiles.length > 0) {
        blocks.push(createReviewRequirementBlock(group, carriedFiles, "carried-work", activeWorkSegment));
      }
      continue;
    }

    blocks.push(createReviewRequirementBlock(
      group,
      group.files,
      createRequirementBlockKind(group, activeWorkSegment),
      activeWorkSegment,
    ));
  }

  return blocks.sort((left, right) => {
    const priorityDelta = requirementBlockPriority(left.kind) - requirementBlockPriority(right.kind);
    if (priorityDelta !== 0) {
      return priorityDelta;
    }
    return groupDelta(right.files) - groupDelta(left.files);
  });
}

function createReviewRequirementBlock(
  group: ReviewChangeGroup,
  files: DiffFileChange[],
  kind: ReviewRequirementBlock["kind"],
  activeWorkSegment?: WorkSegment,
): ReviewRequirementBlock {
  const sortedFiles = [...files].sort((left, right) => groupDelta([right]) - groupDelta([left]));
  const additions = sortedFiles.reduce((sum, file) => sum + file.additions, 0);
  const deletions = sortedFiles.reduce((sum, file) => sum + file.deletions, 0);
  const title = createRequirementBlockTitle(group, kind, activeWorkSegment);
  const summary = createRequirementBlockSummary(group, sortedFiles, kind, activeWorkSegment);
  const suggestedAction = createRequirementBlockSuggestedAction(kind);

  return {
    id: slugify(`${kind}-${group.id}-${sortedFiles.map((file) => file.path).join("-")}`),
    title,
    kind,
    confidence: group.confidence,
    summary,
    evidence: createRequirementBlockEvidence(group, sortedFiles, kind, activeWorkSegment),
    files: sortedFiles,
    keyValues: [
      { key: "类型", value: BLOCK_KIND_LABELS[kind] },
      { key: "自动标题", value: title },
      { key: "置信度", value: formatConfidence(group.confidence) },
      { key: "文件数", value: `${sortedFiles.length}` },
      { key: "变更量", value: `+${additions}/-${deletions}` },
      { key: "主要文件", value: sortedFiles.slice(0, 5).map((file) => file.path).join(", ") },
      { key: "建议动作", value: suggestedAction },
    ],
    reviewFocus: createRequirementBlockReviewFocus(group, kind),
    testSuggestions: group.testSuggestions,
    suggestedAction,
  };
}

function createReviewOverview(
  diff: DiffSummary,
  blocks: ReviewRequirementBlock[],
  groups: ReviewChangeGroup[],
  activeWorkSegment?: WorkSegment,
): ReviewDraft["reviewOverview"] {
  const batches = blocks.map((block, index) => createReviewOverviewBatch(block, groups, index));
  const currentCount = batches.filter((batch) => batch.kind === "current-work").length;
  const historicalCount = batches.filter((batch) => batch.kind === "historical-requirement").length;
  const carriedCount = batches.filter((batch) => batch.kind === "carried-work").length;
  const functionalCount = batches.filter((batch) => batch.kind === "functional-area").length;
  const mainBatch = batches[0];

  return {
    title: createReviewOverviewTitle(batches, activeWorkSegment),
    summary: createReviewOverviewSummary(diff, batches, activeWorkSegment),
    keyValues: [
      { key: "识别批次数", value: `${batches.length}` },
      { key: "当前需求块", value: `${currentCount}` },
      { key: "历史需求块", value: `${historicalCount}` },
      { key: "功能域候选", value: `${functionalCount}` },
      { key: "旧改动块", value: `${carriedCount}` },
      { key: "总变更量", value: `+${diff.stats.additions}/-${diff.stats.deletions}` },
      { key: "优先讲解", value: mainBatch?.title ?? "暂无" },
      {
        key: "工作段边界",
        value: activeWorkSegment
          ? `已启用：${activeWorkSegment.title}`
          : "未启用，混合需求只能按历史记忆和路径推断",
      },
    ],
    batches,
    readingOrder: createOverviewReadingOrder(batches, groups),
  };
}

function createReviewOverviewBatch(
  block: ReviewRequirementBlock,
  groups: ReviewChangeGroup[],
  index: number,
): ReviewOverviewBatch {
  const matchingGroups = findGroupsForBlock(block, groups);
  const additions = block.files.reduce((sum, file) => sum + file.additions, 0);
  const deletions = block.files.reduce((sum, file) => sum + file.deletions, 0);
  const groupTitles = matchingGroups.map((group) => group.title);

  return {
    id: block.id,
    title: createOverviewBatchTitle(block, index),
    kind: block.kind,
    summary: block.summary,
    suggestedAction: block.suggestedAction,
    confidence: block.confidence,
    files: block.files,
    keyValues: [
      { key: "批次", value: `${index + 1}` },
      { key: "类型", value: BLOCK_KIND_LABELS[block.kind] },
      { key: "自动标题", value: block.title },
      { key: "关联分组", value: groupTitles.length > 0 ? groupTitles.join(" / ") : "未匹配到改动分组" },
      { key: "文件数", value: `${block.files.length}` },
      { key: "变更量", value: `+${additions}/-${deletions}` },
      { key: "主要文件", value: block.files.slice(0, 5).map((file) => file.path).join(", ") || "-" },
      { key: "建议动作", value: block.suggestedAction },
    ],
    sourceBlockIds: [block.id],
    sourceGroupIds: matchingGroups.map((group) => group.id),
    sourceGroupTitles: groupTitles,
  };
}

function findGroupsForBlock(
  block: ReviewRequirementBlock,
  groups: ReviewChangeGroup[],
): ReviewChangeGroup[] {
  const blockFiles = new Set(block.files.map((file) => file.path));
  return groups.filter((group) => group.files.some((file) => blockFiles.has(file.path)));
}

function createOverviewBatchTitle(block: ReviewRequirementBlock, index: number): string {
  const cleanTitle = block.title
    .replace(/^当前需求：/, "")
    .replace(/^旧改动待确认：/, "")
    .replace(/^候选需求块：/, "")
    .trim();

  return `批次 ${index + 1} · ${BLOCK_KIND_LABELS[block.kind]} · ${cleanTitle || block.title}`;
}

function createReviewOverviewTitle(
  batches: ReviewOverviewBatch[],
  activeWorkSegment?: WorkSegment,
): string {
  if (activeWorkSegment) {
    return `围绕「${activeWorkSegment.title}」识别出 ${batches.length} 个修改批次`;
  }

  return `识别出 ${batches.length} 个修改批次`;
}

function createReviewOverviewSummary(
  diff: DiffSummary,
  batches: ReviewOverviewBatch[],
  activeWorkSegment?: WorkSegment,
): string {
  if (batches.length === 0) {
    return "当前没有可讲解的修改批次。";
  }

  const kindSummary = summarizeOverviewKinds(batches);
  const boundary = activeWorkSegment
    ? `工作段「${activeWorkSegment.title}」提供了本次需求边界。`
    : "当前没有工作段边界，SpecWeft 会结合历史需求、文件路径和功能域推断批次。";

  return [
    `本次 diff 涉及 ${diff.stats.files} 个文件，SpecWeft 拆成 ${batches.length} 个可 review 批次。`,
    kindSummary,
    boundary,
  ].join(" ");
}

function summarizeOverviewKinds(batches: ReviewOverviewBatch[]): string {
  const allEntries: Array<[string, number]> = [
    ["当前需求", batches.filter((batch) => batch.kind === "current-work").length],
    ["历史需求", batches.filter((batch) => batch.kind === "historical-requirement").length],
    ["功能域候选", batches.filter((batch) => batch.kind === "functional-area").length],
    ["旧改动", batches.filter((batch) => batch.kind === "carried-work").length],
  ];
  const entries = allEntries.filter(([, count]) => count > 0);

  if (entries.length === 0) {
    return "没有识别出明确类型。";
  }

  return `类型分布：${entries.map(([label, count]) => `${label} ${count} 个`).join("，")}。`;
}

function createOverviewReadingOrder(
  batches: ReviewOverviewBatch[],
  groups: ReviewChangeGroup[],
): string[] {
  if (batches.length === 0) {
    return ["先生成一次本地修改，再重新运行 review。"];
  }

  const steps = batches.slice(0, 6).map((batch, index) => {
    const firstFile = batch.files[0]?.path ?? "未识别文件";
    return `${index + 1}. 先看「${batch.title}」：从 ${firstFile} 开始，确认它是否属于 ${BLOCK_KIND_LABELS[batch.kind]}。`;
  });
  const riskyGroups = groups
    .filter((group) => group.confidence !== "high")
    .map((group) => group.title)
    .slice(0, 3);

  if (riskyGroups.length > 0) {
    steps.push(`重点复核低/中置信度分组：${riskyGroups.join("，")}。`);
  }

  return steps;
}

function createRequirementBlockKind(
  group: ReviewChangeGroup,
  activeWorkSegment?: WorkSegment,
): ReviewRequirementBlock["kind"] {
  if (activeWorkSegment) {
    return "current-work";
  }
  if (group.area.startsWith("requirement:")) {
    return "historical-requirement";
  }
  return "functional-area";
}

function requirementBlockPriority(kind: ReviewRequirementBlock["kind"]): number {
  if (kind === "current-work") {
    return 0;
  }
  if (kind === "historical-requirement") {
    return 1;
  }
  if (kind === "functional-area") {
    return 2;
  }
  return 3;
}

function createRequirementBlockTitle(
  group: ReviewChangeGroup,
  kind: ReviewRequirementBlock["kind"],
  activeWorkSegment?: WorkSegment,
): string {
  if (kind === "current-work" && activeWorkSegment) {
    return `当前需求：${activeWorkSegment.title} · ${group.title}`;
  }
  if (kind === "carried-work") {
    return `旧改动待确认：${group.title}`;
  }
  if (kind === "historical-requirement") {
    return group.title;
  }
  return `候选需求块：${group.title}`;
}

function createRequirementBlockSummary(
  group: ReviewChangeGroup,
  files: DiffFileChange[],
  kind: ReviewRequirementBlock["kind"],
  activeWorkSegment?: WorkSegment,
): string {
  const filePreview = formatPathPreview(files);

  if (kind === "current-work" && activeWorkSegment) {
    return `这些文件属于工作段「${activeWorkSegment.title}」开始后的当前修改范围，适合作为本次需求的主讲解块：${filePreview}。`;
  }
  if (kind === "carried-work" && activeWorkSegment) {
    return `这些文件在工作段「${activeWorkSegment.title}」开始前就已经有未提交改动，建议先确认它们是否属于旧需求：${filePreview}。`;
  }
  if (kind === "historical-requirement") {
    return `这组改动命中了历史需求线，适合按同一条需求继续 review 和恢复记忆：${filePreview}。`;
  }

  return `没有可靠历史需求命中，SpecWeft 按功能域把这组文件拆成一个候选需求块：${group.purpose}`;
}

function createRequirementBlockEvidence(
  group: ReviewChangeGroup,
  files: DiffFileChange[],
  kind: ReviewRequirementBlock["kind"],
  activeWorkSegment?: WorkSegment,
): string[] {
  const evidence = [
    group.matchReason,
    `文件范围：${formatPathPreview(files)}。`,
    `分组置信度：${formatConfidence(group.confidence)}。`,
  ];

  if (kind === "current-work" && activeWorkSegment) {
    evidence.push(`工作段「${activeWorkSegment.title}」提供了本次需求边界。`);
  }
  if (kind === "carried-work" && activeWorkSegment) {
    evidence.push(`这些文件存在于工作段开始快照中：${files.map((file) => file.path).join(", ")}。`);
  }

  return evidence;
}

function createRequirementBlockReviewFocus(
  group: ReviewChangeGroup,
  kind: ReviewRequirementBlock["kind"],
): string[] {
  const focus = [...group.reviewNotes];

  if (kind === "current-work") {
    focus.unshift("先确认这一块是否就是用户当前需求的主体实现。");
  }
  if (kind === "carried-work") {
    focus.unshift("先不要把这一块算作当前需求成果，确认它是不是旧需求残留。");
  }
  if (kind === "functional-area") {
    focus.unshift("让用户确认这个功能域是否应该作为独立需求记录。");
  }
  if (kind === "historical-requirement") {
    focus.unshift("如果要继续修改，先恢复这条历史需求的记忆上下文。");
  }

  return [...new Set(focus)].slice(0, 6);
}

function createRequirementBlockSuggestedAction(kind: ReviewRequirementBlock["kind"]): string {
  if (kind === "current-work") {
    return "优先讲解并记录为当前需求记忆。";
  }
  if (kind === "carried-work") {
    return "先确认归属，必要时拆到旧需求单独记录。";
  }
  if (kind === "historical-requirement") {
    return "恢复对应需求记忆后继续 review。";
  }
  return "让用户确认是否创建或切换到独立需求线。";
}

type RequirementGroupHint = {
  key: string;
  requirementId?: string;
  title: string;
  keywords: string[];
  files: string[];
  latestSummary?: string;
  active: boolean;
};

function createRequirementGroupHints(context: ReviewDraftContext): Map<string, RequirementGroupHint> {
  const hints = new Map<string, RequirementGroupHint>();

  for (const requirement of context.requirements ?? []) {
    const digestItem = context.memoryDigest?.items.find((item) => item.requirementId === requirement.id);
    const key = `requirement:${requirement.id}`;
    hints.set(key, {
      key,
      requirementId: requirement.id,
      title: requirement.title,
      keywords: [...new Set([...requirement.keywords, ...(digestItem?.keywords ?? [])])],
      files: digestItem?.keyFiles ?? [],
      latestSummary: digestItem?.latestSummary ?? requirement.summary,
      active: context.activeRequirementId === requirement.id,
    });
  }

  for (const item of context.memoryDigest?.items ?? []) {
    if (item.requirementId) {
      continue;
    }

    const key = `memory:${item.id}`;
    hints.set(key, {
      key,
      title: item.title,
      keywords: item.keywords,
      files: item.keyFiles,
      latestSummary: item.latestSummary,
      active: false,
    });
  }

  return hints;
}

function createRequirementGroupMatch(
  file: DiffFileChange,
  hints: Map<string, RequirementGroupHint>,
): ReviewGroupMatch | undefined {
  const fallbackKey = createChangeGroupKey(file.path);
  const hasFunctionalFallback = Boolean(FUNCTIONAL_GROUPS[fallbackKey]);
  let best: { hint: RequirementGroupHint; score: RequirementHintScore } | undefined;

  for (const hint of hints.values()) {
    const scored = scoreRequirementHint(file.path, hint);
    if (!shouldUseRequirementHint(scored, hasFunctionalFallback)) {
      continue;
    }
    if (!best || scored.score > best.score.score) {
      best = { hint, score: scored };
    }
  }

  if (!best) {
    return undefined;
  }

  return {
    key: best.hint.key,
    score: best.score.score,
    reason: createRequirementMatchReason(best.hint, best.score.reasons),
    confidence: scoreToConfidence(best.score.score),
  };
}

function scoreRequirementHint(filePath: string, hint: RequirementGroupHint): RequirementHintScore {
  let score = hint.active ? 3 : 0;
  const reasons = hint.active ? ["当前需求已选中"] : [];
  let hasSpecificMatch = false;
  let fileMatches = 0;
  let strongFileMatches = 0;
  let keywordMatches = 0;
  const normalizedPath = filePath.toLowerCase();

  for (const knownFile of hint.files) {
    const normalizedKnownFile = knownFile.toLowerCase();
    if (normalizedPath === normalizedKnownFile) {
      const lowSignal = isLowSignalHistoryFile(knownFile);
      const matchScore = lowSignal ? 2 : 5;
      score += matchScore;
      hasSpecificMatch = true;
      fileMatches += 1;
      strongFileMatches += lowSignal ? 0 : 1;
      reasons.push(`文件命中历史记录 ${knownFile}`);
      continue;
    }
    if (normalizedPath.includes(normalizedKnownFile) || normalizedKnownFile.includes(normalizedPath)) {
      const lowSignal = isLowSignalHistoryFile(knownFile);
      const matchScore = lowSignal ? 1 : 3;
      score += matchScore;
      hasSpecificMatch = true;
      fileMatches += 1;
      strongFileMatches += lowSignal ? 0 : 1;
      reasons.push(`路径与历史文件 ${knownFile} 重叠`);
    }
  }

  for (const keyword of hint.keywords) {
    const normalizedKeyword = keyword.toLowerCase();
    if (isUsefulRequirementKeyword(normalizedKeyword) && normalizedPath.includes(normalizedKeyword)) {
      score += 2;
      hasSpecificMatch = true;
      keywordMatches += 1;
      reasons.push(`路径命中关键词 ${keyword}`);
    }
  }

  return {
    score: hasSpecificMatch ? score : 0,
    reasons: hasSpecificMatch ? reasons : [],
    fileMatches: hasSpecificMatch ? fileMatches : 0,
    strongFileMatches: hasSpecificMatch ? strongFileMatches : 0,
    keywordMatches: hasSpecificMatch ? keywordMatches : 0,
  };
}

function shouldUseRequirementHint(score: RequirementHintScore, hasFunctionalFallback: boolean): boolean {
  if (score.score === 0) {
    return false;
  }
  if (score.strongFileMatches > 0 && score.score >= 5) {
    return true;
  }
  if (score.keywordMatches > 0 && score.score >= 5 && !hasFunctionalFallback) {
    return true;
  }
  if (score.keywordMatches >= 2 && score.score >= 4) {
    return true;
  }

  return false;
}

function isLowSignalHistoryFile(filePath: string): boolean {
  const normalized = filePath.toLowerCase();
  const basename = path.basename(normalized);

  return [
    "package.json",
    "pnpm-lock.yaml",
    "package-lock.json",
    "yarn.lock",
    "bun.lockb",
    "index.ts",
    "index.js",
    "types.ts",
    "schemas.ts",
  ].includes(basename)
    || normalized.endsWith("/schemas/types.ts")
    || normalized.endsWith("/src/index.ts")
    || normalized.endsWith("/src/index.js");
}

function isUsefulRequirementKeyword(keyword: string): boolean {
  if (keyword.length < 3) {
    return false;
  }
  if (/^[\w.-]+\.(ts|tsx|js|jsx|json|md|yaml|yml|toml)$/.test(keyword)) {
    return false;
  }
  if ([
    "typescript",
    "javascript",
    "specweft-monorepo",
    "package.json",
    "index.ts",
    "readme.md",
    "agents.md",
    "claude.md",
  ].includes(keyword)) {
    return false;
  }

  return true;
}

function createFallbackGroupMatch(file: DiffFileChange): ReviewGroupMatch {
  const key = createChangeGroupKey(file.path);
  return {
    key,
    score: 1,
    reason: createFallbackMatchReason(key),
    confidence: "medium",
  };
}

function createRequirementMatchReason(hint: RequirementGroupHint, reasons: string[]): string {
  const uniqueReasons = [...new Set(reasons)];
  const suffix = uniqueReasons.length > 0 ? uniqueReasons.join("；") : "命中历史需求上下文";
  return `按需求线「${hint.title}」分组：${suffix}`;
}

function createFallbackMatchReason(key: string): string {
  const functionalGroup = FUNCTIONAL_GROUPS[key];
  if (functionalGroup) {
    return `没有命中历史需求，按功能域「${functionalGroup.title}」归组。`;
  }
  if (key === "docs") {
    return "没有命中历史需求，按文档文件类型归组。";
  }
  if (key === "config") {
    return "没有命中历史需求，按配置/发布入口归组。";
  }
  if (key === "tests") {
    return "没有命中历史需求，按测试文件归组。";
  }
  if (key.startsWith("package:")) {
    return `没有命中历史需求，按包模块 ${key.slice("package:".length)} 归组。`;
  }
  if (key.startsWith("src:")) {
    return `没有命中历史需求，按源码目录 ${key.slice("src:".length)} 归组。`;
  }
  if (key.startsWith("folder:")) {
    return `没有命中历史需求，按目录 ${key.slice("folder:".length)} 归组。`;
  }

  return "没有命中历史需求，按项目根目录文件归组。";
}

function summarizeGroupMatch(matches: ReviewGroupMatch[], hint?: RequirementGroupHint): string {
  const reasons = [...new Set(matches.map((match) => match.reason))];
  if (hint && reasons.length > 2) {
    return `${reasons.slice(0, 2).join("；")}；另有 ${reasons.length - 2} 个相同需求线命中。`;
  }

  return reasons.slice(0, 3).join("；") || "按文件路径和修改范围自动归组。";
}

function summarizeGroupConfidence(matches: ReviewGroupMatch[]): ReviewChangeGroup["confidence"] {
  if (matches.some((match) => match.confidence === "high")) {
    return "high";
  }
  if (matches.some((match) => match.confidence === "medium")) {
    return "medium";
  }
  return "low";
}

function scoreToConfidence(score: number): ReviewChangeGroup["confidence"] {
  if (score >= 6) {
    return "high";
  }
  if (score >= 3) {
    return "medium";
  }
  return "low";
}

function formatConfidence(confidence: ReviewChangeGroup["confidence"]): string {
  if (confidence === "high") {
    return "高";
  }
  if (confidence === "medium") {
    return "中";
  }
  return "低";
}

function createRequirementGroupPurpose(hint: RequirementGroupHint, files: DiffFileChange[]): string {
  const summary = hint.latestSummary ? ` 最近记忆：${hint.latestSummary}` : "";
  return `这组文件与历史需求「${hint.title}」匹配，建议作为同一条需求线来 review：${formatPathPreview(files)}。${summary}`;
}

function createRequirementGroupReviewNotes(hint: RequirementGroupHint, files: DiffFileChange[]): string[] {
  return [
    `先确认这次修改是否确实属于需求「${hint.title}」。`,
    `优先阅读变更量最大的文件：${files[0]?.path ?? "-"}`,
    hint.active
      ? "这是当前活跃需求，记录 review 时会继续挂到这条需求线。"
      : "这不是当前活跃需求，如果确认相关，建议切换或显式指定 requirementId。",
  ];
}

function createRequirementGroupTestSuggestions(hint: RequirementGroupHint, files: DiffFileChange[]): string[] {
  if (files.some((file) => isTestFile(file.path))) {
    return [`运行需求「${hint.title}」相关测试，确认本次修改覆盖了预期行为。`];
  }

  return [
    `针对需求「${hint.title}」跑最小验证路径。`,
    "如果这组是运行时代码修改，建议补一个围绕该需求的回归测试。",
  ];
}

function createChangeGroupKey(filePath: string): string {
  if (isTestFile(filePath)) {
    return "tests";
  }
  if (/\.(md|mdx|txt|rst)$/.test(filePath)) {
    return "docs";
  }
  if (/package\.json|tsconfig\.json|pom\.xml|pyproject\.toml|lock$|lock\.yaml$/.test(filePath)) {
    return "config";
  }

  const functionalKey = detectFunctionalGroupKey(filePath);
  if (functionalKey) {
    return functionalKey;
  }

  const segments = filePath.split("/");
  if (segments[0] === "packages" && segments[1]) {
    return `package:${segments[1]}`;
  }
  if (segments[0] === "src" && segments[1]) {
    return `src:${segments[1]}`;
  }
  if (segments.length > 1) {
    return `folder:${segments[0]}`;
  }
  return "root";
}

function createGroupTitle(key: string, files: DiffFileChange[]): string {
  const functionalGroup = FUNCTIONAL_GROUPS[key];
  if (functionalGroup) {
    return functionalGroup.title;
  }
  if (key === "docs") {
    return "文档与使用说明同步";
  }
  if (key === "config") {
    return "配置与发布入口调整";
  }
  if (key === "tests") {
    return "测试用例与行为保障";
  }
  if (key === "root") {
    return "项目根目录文件调整";
  }
  if (key.startsWith("package:")) {
    const packageName = key.slice("package:".length);
    return `${formatModuleName(packageName)} 模块改动`;
  }
  if (key.startsWith("src:")) {
    return `${formatModuleName(key.slice("src:".length))} 功能改动`;
  }
  if (key.startsWith("folder:")) {
    return `${formatModuleName(key.slice("folder:".length))} 目录改动`;
  }

  const area = detectFileArea(files[0]?.path ?? "");
  return `${formatModuleName(area)} 改动`;
}

function createGroupArea(key: string, files: DiffFileChange[]): string {
  const functionalGroup = FUNCTIONAL_GROUPS[key];
  if (functionalGroup) {
    return functionalGroup.area;
  }
  if (key.startsWith("package:")) {
    return `packages/${key.slice("package:".length)}`;
  }
  if (key.startsWith("src:")) {
    return `src/${key.slice("src:".length)}`;
  }
  if (key.startsWith("folder:")) {
    return `${key.slice("folder:".length)}/`;
  }

  return [...new Set(files.map((file) => detectFileArea(file.path)))].join(", ");
}

function createGroupPurpose(key: string, files: DiffFileChange[]): string {
  const functionalGroup = FUNCTIONAL_GROUPS[key];
  if (functionalGroup) {
    return `${functionalGroup.purpose} 涉及文件：${formatPathPreview(files)}。`;
  }

  const areas = [...new Set(files.map((file) => detectFileArea(file.path)))];
  const filePreview = formatPathPreview(files);

  if (key === "docs") {
    return `同步文档和 Agent 使用说明，重点确认文档描述是否匹配当前实现：${filePreview}。`;
  }
  if (key === "config") {
    return `调整配置、依赖或发布入口，重点确认构建、打包和命令入口是否仍然可用：${filePreview}。`;
  }
  if (key === "tests") {
    return `补充或调整测试，用来锁定本次行为变化：${filePreview}。`;
  }
  if (areas.includes("runtime code")) {
    return `实现或调整运行时代码路径，建议按主要文件顺序理解调用链：${filePreview}。`;
  }
  return `这一组文件共同支撑同一块范围的修改：${filePreview}。`;
}

function createGroupReviewNotes(key: string, files: DiffFileChange[]): string[] {
  const functionalGroup = FUNCTIONAL_GROUPS[key];
  if (functionalGroup) {
    return [
      ...functionalGroup.reviewNotes,
      `优先阅读变更量最大的文件：${files[0]?.path ?? "-"}`,
    ];
  }

  const notes = [
    "确认这一组文件是否服务于同一个需求点。",
    `优先阅读变更量最大的文件：${files[0]?.path ?? "-"}`,
  ];

  if (key !== "tests" && files.some((file) => detectFileArea(file.path) === "runtime code")) {
    notes.push("确认这组运行时代码是否有对应测试或最小验证方式。");
  }
  if (key === "config") {
    notes.push("确认 package/export/files/scripts 等配置没有漏掉新增模块。");
  }
  if (key === "docs") {
    notes.push("确认文档没有继续强调已经降级为可选的 MCP 主线。");
  }

  return notes;
}

function createGroupTestSuggestions(key: string, files: DiffFileChange[]): string[] {
  const functionalGroup = FUNCTIONAL_GROUPS[key];
  if (functionalGroup) {
    return functionalGroup.testSuggestions;
  }
  if (key === "docs") {
    return ["文档组通常不需要单独运行测试，但要确认示例命令仍然存在。"];
  }
  if (key === "config") {
    return ["运行构建、类型检查和包 dry-run，确认配置没有破坏发布入口。"];
  }
  if (key === "tests") {
    return ["运行被修改的测试文件，确认新断言会失败于旧行为、通过于新行为。"];
  }
  if (files.some((file) => detectFileArea(file.path) === "runtime code")) {
    return ["运行覆盖这组运行时代码的最小测试；如果没有测试，至少跑 build/check。"];
  }
  return ["运行项目的最小验证命令。"];
}

function createGroupChangeTypes(files: DiffFileChange[]): string[] {
  return [...new Set(files.map((file) => file.changeType === "unknown" ? "modified" : file.changeType))];
}

function detectFunctionalGroupKey(filePath: string): string | undefined {
  const normalized = filePath.toLowerCase();

  if (normalized.startsWith("packages/web/") || normalized.includes("/ui.")) {
    return "functional:web-ui";
  }
  if (normalized.includes("/memory/") || normalized.includes("memory") || normalized.includes("dossier")) {
    return "functional:memory";
  }
  if (normalized.includes("/requirements/") || normalized.includes("requirement-manager")) {
    return "functional:requirement";
  }
  if (normalized.includes("/task/") || normalized.includes("task-preparer") || normalized.includes("prepare.")) {
    return "functional:task-prepare";
  }
  if (normalized.includes("/diff/") || normalized.includes("/review/") || normalized.includes("diff-analyzer")) {
    return "functional:review";
  }
  if (
    normalized.includes("/pool/")
    || normalized.includes("/marketplace/")
    || normalized.includes("/capabilities/")
    || normalized.includes("/recommendations/")
    || normalized.includes("/selection/")
  ) {
    return "functional:capability";
  }
  if (normalized.includes("/git/") || normalized.includes("/recording/") || normalized.includes("change-snapshot")) {
    return "functional:recording";
  }
  if (normalized.includes("/bootstrap/") || normalized.endsWith("agents.md") || normalized.endsWith("claude.md")) {
    return "functional:bootstrap";
  }
  if (normalized.includes("mcp/") || normalized.includes("mcp-inspect")) {
    return "functional:mcp-server";
  }
  if (
    normalized.startsWith("packages/cli/")
    || normalized.includes("/commands/")
    || normalized.startsWith("packages/cli/src/args.ts")
    || normalized.startsWith("packages/cli/src/index.ts")
  ) {
    return "functional:cli-runtime";
  }
  if (normalized.startsWith("scripts/") || normalized.includes("smoke") || normalized.includes("release")) {
    return "functional:verification";
  }

  return undefined;
}

function groupDelta(files: DiffFileChange[]): number {
  return files.reduce((sum, file) => sum + file.additions + file.deletions, 0);
}

function formatModuleName(value: string): string {
  return value
    .split(/[-_/\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
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

function createWorkSegmentReviewNotes(segment: WorkSegment | undefined, diff: DiffSummary): string[] {
  if (!segment) {
    return [
      "没有检测到活跃工作段；这次 review 只能根据当前完整 diff 解释，无法判断哪些文件是本需求开始后新增的。",
    ];
  }

  const currentFiles = new Set(diff.changedFiles.map((file) => file.path));
  const newFiles = diff.changedFiles
    .map((file) => file.path)
    .filter((file) => !segment.baselineChangedFiles.includes(file));
  const carriedFiles = segment.baselineChangedFiles.filter((file) => currentFiles.has(file));
  const notes = [
    `当前工作段：「${segment.title}」。`,
    newFiles.length
      ? `本工作段新增改动文件：${newFiles.slice(0, 8).join(", ")}。`
      : "本工作段没有发现相对开始快照新增的改动文件。",
  ];

  if (carriedFiles.length > 0) {
    notes.push(`开始工作段前已经存在的改动仍在 diff 中：${carriedFiles.slice(0, 8).join(", ")}。这些文件可能属于旧需求，review 时不要默认混为同一次实现。`);
  }

  return notes;
}

function createWorkSegmentChecklist(segment: WorkSegment | undefined): string[] {
  if (!segment) {
    return [
      "下次修改前先调用 specweft.start_work_segment，避免多个需求混在一个 diff 时难以拆分。",
    ];
  }

  if (segment.baselineChangedFiles.length === 0) {
    return [
      `确认工作段「${segment.title}」覆盖了本次需求的全部修改。`,
    ];
  }

  return [
    `确认工作段「${segment.title}」里的新增文件和开始前已有文件是否属于同一个需求。`,
    "对 carriedChangedFiles 里的旧改动保持警惕，必要时拆成单独需求记录。",
  ];
}

function createWorkSegmentRisk(segment: WorkSegment | undefined): string[] {
  if (!segment) {
    return [
      "未检测到工作段边界；如果本地 diff 混有多个需求，分组只能依赖路径、历史记忆和功能域推断。",
    ];
  }

  if (segment.baselineChangedFiles.length > 0) {
    return [
      "工作段开始时已有未提交改动；本次讲解需要区分新改动和旧改动，避免把旧需求误认为当前需求成果。",
    ];
  }

  return [];
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

function createDefaultReviewTitle(diff: DiffSummary, activeSegment?: WorkSegment): string {
  if (activeSegment?.title.trim()) {
    return activeSegment.title.trim();
  }

  if (diff.changedFiles.length === 0) {
    return "本地修改讲解";
  }

  const groups = createReviewChangeGroups(diff, { activeWorkSegment: activeSegment });
  const firstGroup = groups[0];
  if (firstGroup) {
    const suffix = groups.length > 1 ? ` 等 ${groups.length} 组改动` : "";
    return `${firstGroup.title}${suffix}`;
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
    "## Generation",
    "",
    formatMarkdownList([
      `Source: ${review.generationSource ?? "rules"}`,
      review.llmModel ? `Model: ${review.llmModel}` : "Model: none",
      review.llmError ? `LLM error: ${review.llmError}` : "LLM error: none",
    ]),
    "",
    "## Intent",
    "",
    review.intent,
    "",
    "## Review Overview",
    "",
    formatMarkdownReviewOverview(review.reviewOverview),
    "",
    "## Requirement Blocks",
    "",
    formatMarkdownRequirementBlocks(review.requirementBlocks),
    "",
    "## Change Groups",
    "",
    formatMarkdownChangeGroups(review.changeGroups),
    "",
    "## Code Snapshot",
    "",
    formatMarkdownList([
      `HEAD: ${diff.snapshot.head}`,
      `Diff hash: ${diff.snapshot.diffHash}`,
      `Captured at: ${diff.snapshot.capturedAt}`,
      `Has changes: ${diff.snapshot.hasChanges ? "yes" : "no"}`,
    ]),
    "",
    "## Main Changes",
    "",
    formatMarkdownList(review.mainChanges),
    "",
    "## Implemented Functionality",
    "",
    formatMarkdownList(review.implementationSummary),
    "",
    "## Source Reading Guide",
    "",
    formatMarkdownSourceReadingGuide(review.sourceReadingGuide),
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
    reviewOverviewSection(review.reviewOverview),
    requirementBlocksSection(review.requirementBlocks),
    changeGroupsSection(review.changeGroups),
    reviewSection("代码快照", [
      `HEAD: ${diff.snapshot.head}`,
      `Diff hash: ${diff.snapshot.diffHash}`,
      `Captured at: ${diff.snapshot.capturedAt}`,
      `Has changes: ${diff.snapshot.hasChanges ? "yes" : "no"}`,
    ]),
    reviewSection("生成方式", [
      `Source: ${review.generationSource ?? "rules"}`,
      review.llmModel ? `Model: ${review.llmModel}` : "Model: none",
      review.llmError ? `LLM error: ${review.llmError}` : "LLM error: none",
    ]),
    review.llmSummary ? `<section><h2>LLM 总结</h2><p>${escapeHtml(review.llmSummary)}</p></section>` : "",
    reviewSection("LLM Review 要点", review.llmReviewNotes ?? []),
    reviewSection("实现内容总结", review.implementationSummary),
    reviewSection("主要改动", review.mainChanges),
    sourceReadingSection(review.sourceReadingGuide),
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

function formatMarkdownSourceReadingGuide(items: ReviewDraft["sourceReadingGuide"]): string {
  if (items.length === 0) {
    return "- None";
  }

  return items
    .map((item) => [
      `- ${item.path}`,
      `  - 关注点：${item.reason}`,
      `  - 查看方式：\`${item.command}\``,
      `  - 绝对路径：${item.absolutePath}`,
    ].join("\n"))
    .join("\n");
}

function formatMarkdownReviewOverview(overview: ReviewDraft["reviewOverview"]): string {
  if (!overview.batches.length) {
    return [
      `### ${overview.title}`,
      "",
      overview.summary,
      "",
      "No review batches were detected.",
    ].join("\n");
  }

  return [
    `### ${overview.title}`,
    "",
    overview.summary,
    "",
    "- Key-Value:",
    ...overview.keyValues.map((item) => `  - ${item.key}: ${item.value}`),
    "- 建议阅读顺序:",
    ...overview.readingOrder.map((item) => `  - ${item}`),
    "",
    ...overview.batches.map((batch) => [
      `#### ${batch.title}`,
      "",
      `- 类型：${BLOCK_KIND_LABELS[batch.kind]}`,
      `- 摘要：${batch.summary}`,
      `- 置信度：${formatConfidence(batch.confidence)}`,
      `- 建议动作：${batch.suggestedAction}`,
      "- Key-Value:",
      ...batch.keyValues.map((item) => `  - ${item.key}: ${item.value}`),
      "- 文件:",
      ...batch.files.map((file) => `  - ${file.path} (+${file.additions} / -${file.deletions})`),
    ].join("\n")),
  ].join("\n");
}

function formatMarkdownRequirementBlocks(blocks: ReviewDraft["requirementBlocks"]): string {
  if (blocks.length === 0) {
    return "- None";
  }

  return blocks.map((block, index) => [
    `### ${index + 1}. ${block.title}`,
    "",
    `- 类型：${BLOCK_KIND_LABELS[block.kind]}`,
    `- 摘要：${block.summary}`,
    `- 置信度：${formatConfidence(block.confidence)}`,
    `- 建议动作：${block.suggestedAction}`,
    "- 证据:",
    ...block.evidence.map((item) => `  - ${item}`),
    "- Key-Value:",
    ...block.keyValues.map((item) => `  - ${item.key}: ${item.value}`),
    "- 文件:",
    ...block.files.map((file) => `  - ${file.path} (+${file.additions} / -${file.deletions})`),
    "- Review 重点:",
    ...block.reviewFocus.map((item) => `  - ${item}`),
    "- 验证建议:",
    ...block.testSuggestions.map((item) => `  - ${item}`),
  ].join("\n")).join("\n\n");
}

function formatMarkdownChangeGroups(groups: ReviewDraft["changeGroups"]): string {
  if (groups.length === 0) {
    return "- None";
  }

  return groups.map((group, index) => [
    `### ${index + 1}. ${group.title}`,
    "",
    `- 目的：${group.purpose}`,
    `- 范围：${group.area}`,
    `- 分组依据：${group.matchReason}`,
    `- 置信度：${formatConfidence(group.confidence)}`,
    "- Key-Value:",
    ...group.keyValues.map((item) => `  - ${item.key}: ${item.value}`),
    "- 文件:",
    ...group.files.map((file) => `  - ${file.path} (+${file.additions} / -${file.deletions})`),
    "- Review 关注:",
    ...group.reviewNotes.map((item) => `  - ${item}`),
    "- 验证建议:",
    ...group.testSuggestions.map((item) => `  - ${item}`),
  ].join("\n")).join("\n\n");
}

function reviewSection(title: string, items: string[]): string {
  return `<section><h2>${escapeHtml(title)}</h2>${formatHtmlList(items)}</section>`;
}

function reviewOverviewSection(overview: ReviewDraft["reviewOverview"]): string {
  return [
    "<section>",
    "<h2>本次修改概览</h2>",
    `<h3>${escapeHtml(overview.title)}</h3>`,
    `<p>${escapeHtml(overview.summary)}</p>`,
    "<dl>",
    overview.keyValues.map((item) => [
      `<dt>${escapeHtml(item.key)}</dt>`,
      `<dd>${escapeHtml(item.value)}</dd>`,
    ].join("")).join(""),
    "</dl>",
    "<h4>建议阅读顺序</h4>",
    formatHtmlList(overview.readingOrder),
    overview.batches.length > 0
      ? [
          "<div class=\"review-batch-list\">",
          overview.batches.map((batch) => [
            "<article class=\"review-batch-card\">",
            `<h4>${escapeHtml(batch.title)}</h4>`,
            `<p>${escapeHtml(batch.summary)}</p>`,
            "<dl>",
            batch.keyValues.map((item) => [
              `<dt>${escapeHtml(item.key)}</dt>`,
              `<dd>${escapeHtml(item.value)}</dd>`,
            ].join("")).join(""),
            "</dl>",
            "</article>",
          ].join("")).join(""),
          "</div>",
        ].join("")
      : "<p>None</p>",
    "</section>",
  ].join("");
}

function requirementBlocksSection(blocks: ReviewDraft["requirementBlocks"]): string {
  if (blocks.length === 0) {
    return "<section><h2>需求拆解</h2><p>None</p></section>";
  }

  return [
    "<section>",
    "<h2>需求拆解</h2>",
    "<div class=\"requirement-block-list\">",
    blocks.map((block) => [
      "<article class=\"requirement-block\">",
      `<h3>${escapeHtml(block.title)}</h3>`,
      `<p>${escapeHtml(block.summary)}</p>`,
      "<dl>",
      block.keyValues.map((item) => [
        `<dt>${escapeHtml(item.key)}</dt>`,
        `<dd>${escapeHtml(item.value)}</dd>`,
      ].join("")).join(""),
      "</dl>",
      "<h4>判断证据</h4>",
      formatHtmlList(block.evidence),
      "<h4>文件</h4>",
      formatHtmlList(block.files.map((file) => `${file.path} (+${file.additions} / -${file.deletions})`)),
      "<h4>Review 重点</h4>",
      formatHtmlList(block.reviewFocus),
      "<h4>验证建议</h4>",
      formatHtmlList(block.testSuggestions),
      "</article>",
    ].join("")).join(""),
    "</div>",
    "</section>",
  ].join("");
}

function changeGroupsSection(groups: ReviewDraft["changeGroups"]): string {
  if (groups.length === 0) {
    return "<section><h2>改动分组</h2><p>None</p></section>";
  }

  return [
    "<section>",
    "<h2>改动分组</h2>",
    "<div class=\"change-group-list\">",
    groups.map((group) => [
      "<article class=\"change-group\">",
      `<h3>${escapeHtml(group.title)}</h3>`,
      `<p>${escapeHtml(group.purpose)}</p>`,
      `<p><strong>分组依据：</strong>${escapeHtml(group.matchReason)}</p>`,
      `<p><strong>置信度：</strong>${escapeHtml(formatConfidence(group.confidence))}</p>`,
      "<dl>",
      group.keyValues.map((item) => [
        `<dt>${escapeHtml(item.key)}</dt>`,
        `<dd>${escapeHtml(item.value)}</dd>`,
      ].join("")).join(""),
      "</dl>",
      "<h4>文件</h4>",
      formatHtmlList(group.files.map((file) => `${file.path} (+${file.additions} / -${file.deletions})`)),
      "<h4>Review 关注</h4>",
      formatHtmlList(group.reviewNotes),
      "<h4>验证建议</h4>",
      formatHtmlList(group.testSuggestions),
      "</article>",
    ].join("")).join(""),
    "</div>",
    "</section>",
  ].join("");
}

function sourceReadingSection(items: ReviewDraft["sourceReadingGuide"]): string {
  if (items.length === 0) {
    return "<section><h2>源码查看方式</h2><p>None</p></section>";
  }

  return [
    "<section>",
    "<h2>源码查看方式</h2>",
    "<div class=\"source-reading-list\">",
    items.map((item) => [
      "<article class=\"source-reading-item\">",
      `<strong>${escapeHtml(item.path)}</strong>`,
      `<p>${escapeHtml(item.reason)}</p>`,
      `<code>${escapeHtml(item.command)}</code>`,
      `<small>${escapeHtml(item.absolutePath)}</small>`,
      "</article>",
    ].join("")).join(""),
    "</div>",
    "</section>",
  ].join("");
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
  requirement?: RequirementRecord,
): Promise<string> {
  const reportsDir = requirement
    ? path.join(projectConfigDir(repoPath), "reports", requirement.id)
    : path.join(projectConfigDir(repoPath), "reports");
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

function createReviewIntent(files: DiffFileChange[], areas: string[], segment?: WorkSegment): string {
  const primaryArea = areas[0] ?? "project";
  const verbs = new Set(files.map((file) => file.changeType === "unknown" ? "modified" : file.changeType));
  const segmentText = segment
    ? ` 当前工作段是「${segment.title}」，开始时已有 ${segment.baselineChangedFiles.length} 个未提交改动文件。`
    : " 当前没有工作段边界。";
  return `这次修改主要是在 ${primaryArea} 范围内执行 ${[...verbs].join(", ")} 操作。${segmentText}建议先看变更量最大的文件，再确认其他小文件是否都在支撑同一个需求。`;
}

function createImplementationSummary(
  diff: DiffSummary,
  flags: {
    hasTests: boolean;
    hasRuntimeCode: boolean;
    hasConfig: boolean;
    hasDocs: boolean;
  },
): string[] {
  const summary: string[] = [];
  const addedFiles = diff.changedFiles.filter((file) => file.changeType === "added");
  const modifiedFiles = diff.changedFiles.filter((file) => file.changeType === "modified" || file.changeType === "unknown");
  const deletedFiles = diff.changedFiles.filter((file) => file.changeType === "deleted");
  const runtimeFiles = diff.changedFiles.filter((file) => detectFileArea(file.path) === "runtime code");
  const topRuntimeFiles = runtimeFiles
    .sort((left, right) => (right.additions + right.deletions) - (left.additions + left.deletions))
    .slice(0, 3)
    .map((file) => file.path);

  if (addedFiles.length > 0) {
    summary.push(`新增了 ${addedFiles.length} 个文件，主要用于补充新的项目能力或配套资源：${formatPathPreview(addedFiles)}。`);
  }
  if (modifiedFiles.length > 0) {
    summary.push(`调整了 ${modifiedFiles.length} 个已有文件，重点需要确认这些修改是否都服务于同一个需求：${formatPathPreview(modifiedFiles)}。`);
  }
  if (deletedFiles.length > 0) {
    summary.push(`删除了 ${deletedFiles.length} 个文件，需要确认没有遗留引用：${formatPathPreview(deletedFiles)}。`);
  }
  if (flags.hasRuntimeCode) {
    summary.push(`运行时代码发生变化，核心阅读入口建议从 ${topRuntimeFiles.join(", ") || "变更量最大的源码文件"} 开始。`);
  }
  if (flags.hasTests) {
    summary.push("本次包含测试改动，可以通过测试文件反推这次行为变化希望保证什么。");
  }
  if (flags.hasConfig) {
    summary.push("本次包含配置或依赖相关改动，需要重点确认构建、启动、包入口和发布行为是否仍然正确。");
  }
  if (flags.hasDocs) {
    summary.push("本次同步了文档内容，适合用文档来校验代码行为和用户使用方式是否一致。");
  }

  return summary.length > 0 ? summary : ["本次修改较小，建议直接从变更文件列表逐个确认。"];
}

function createSourceReadingGuide(diff: DiffSummary): ReviewDraft["sourceReadingGuide"] {
  return [...diff.changedFiles]
    .sort((left, right) => {
      const areaScore = scoreReadingArea(right.path) - scoreReadingArea(left.path);
      if (areaScore !== 0) {
        return areaScore;
      }

      return (right.additions + right.deletions) - (left.additions + left.deletions);
    })
    .slice(0, 8)
    .map((file) => {
      const absolutePath = path.join(diff.repoPath, file.path);
      return {
        path: file.path,
        absolutePath,
        reason: createSourceReadingReason(file),
        command: `sed -n '1,220p' ${quoteShellPath(absolutePath)}`,
      };
    });
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

function createSourceReadingReason(file: DiffFileChange): string {
  const area = detectFileArea(file.path);
  const changeType = file.changeType === "unknown" ? "modified" : file.changeType;
  const delta = `+${file.additions}/-${file.deletions}`;

  if (area === "runtime code") {
    return `运行时代码入口，先看这里能最快理解本次实现逻辑和调用路径（${changeType}, ${delta}）。`;
  }
  if (area === "test") {
    return `测试文件能说明预期行为，适合用来反推这次修改要保证什么（${changeType}, ${delta}）。`;
  }
  if (area === "config") {
    return `配置或依赖入口，重点确认命令、构建、包入口和发布行为是否变化（${changeType}, ${delta}）。`;
  }
  if (area === "docs") {
    return `文档入口，适合确认用户视角的功能说明是否和代码一致（${changeType}, ${delta}）。`;
  }

  return `项目文件发生变化，确认它和主要需求之间的关系（${changeType}, ${delta}）。`;
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

function scoreReadingArea(filePath: string): number {
  const area = detectFileArea(filePath);
  if (area === "runtime code") {
    return 4;
  }
  if (area === "test") {
    return 3;
  }
  if (area === "config") {
    return 2;
  }
  if (area === "docs") {
    return 1;
  }
  return 0;
}

function formatPathPreview(files: DiffFileChange[]): string {
  const paths = files.slice(0, 4).map((file) => file.path);
  const suffix = files.length > paths.length ? ` 等 ${files.length} 个文件` : "";
  return `${paths.join(", ")}${suffix}`;
}

function quoteShellPath(filePath: string): string {
  return `'${filePath.replaceAll("'", "'\\''")}'`;
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
