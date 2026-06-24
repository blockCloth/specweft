import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import type {
  MemoryIndexItem,
  PreparedTask,
  PreparedTaskRequirementMatch,
  ProjectProfile,
  RequirementRecord,
  TaskAnalysis,
  TaskCodePointer,
  TaskExecutionStep,
  TaskGuardrail,
  TaskMemorySuggestion,
  TaskSkillSuggestion,
  ToolRecommendation,
} from "../schemas/types.js";
import { createMemoryHandoff, createMemoryIndex, recallSessions } from "../memory/session-memory.js";
import { listRequirements } from "../requirements/requirement-manager.js";
import { recommendForProject } from "../recommendations/recommender.js";
import { listSkillPool } from "../pool/pool-manager.js";
import { readProjectSkillSelection } from "../selection/selection-manager.js";
import { scanProject } from "../scanner/project-scanner.js";
import { toPosixPath } from "../utils/path.js";

const MAX_SCANNED_FILES = 600;
const MAX_CODE_POINTERS = 8;
const MAX_SKILL_SUGGESTIONS = 6;
const MAX_MEMORY_SUGGESTIONS = 5;
const MAX_CONTENT_PREVIEW_CHARS = 180;

const GENERIC_TOKENS = new Set([
  "this",
  "that",
  "with",
  "from",
  "into",
  "current",
  "project",
  "code",
  "file",
  "logic",
  "function",
  "feature",
  "需求",
  "功能",
  "项目",
  "代码",
  "当前",
  "这个",
  "那个",
  "优化",
  "修改",
  "新增",
  "处理",
  "帮我",
  "一下",
  "相关",
]);

const TOKEN_SYNONYMS: Record<string, string[]> = {
  登录: ["login", "signin", "auth"],
  认证: ["auth", "token", "session"],
  权限: ["permission", "auth", "role"],
  用户: ["user", "account", "profile"],
  接口: ["api", "controller", "route", "service"],
  页面: ["page", "view", "component"],
  界面: ["ui", "view", "component"],
  组件: ["component"],
  需求档案: ["requirement", "dossier"],
  需求线: ["requirement", "thread"],
  档案: ["dossier"],
  记忆: ["memory", "recall", "handoff"],
  上下文: ["context", "memory"],
  新线程: ["handoff", "context"],
  需求: ["requirement", "task"],
  技能: ["skill"],
  测试: ["test", "spec"],
  错误: ["error", "bug", "exception"],
  异常: ["error", "exception"],
  配置: ["config", "settings"],
  推荐: ["recommend", "suggestion"],
  展示: ["display", "render", "ui"],
  讲解: ["review", "explain", "summary"],
  回滚: ["revert", "rollback"],
  价格: ["price", "pricing", "cost"],
  酒店: ["hotel", "room", "booking"],
  预测: ["predict", "forecast", "model"],
  预订: ["booking", "reservation"],
  支付: ["payment", "checkout", "billing"],
  订单: ["order", "booking"],
};

const CHINESE_DOMAIN_TERMS = [
  "需求档案",
  "代码讲解",
  "需求线",
  "新线程",
  "上下文",
  "登录",
  "校验",
  "认证",
  "权限",
  "用户",
  "接口",
  "页面",
  "界面",
  "组件",
  "档案",
  "记忆",
  "技能",
  "测试",
  "错误",
  "异常",
  "配置",
  "推荐",
  "展示",
  "讲解",
  "回滚",
  "价格",
  "酒店",
  "预测",
  "预订",
  "支付",
  "订单",
];

// 修改前的主入口：把用户的一句话需求转换成 Agent 可执行的上下文包。
export async function prepareTask(repoPath: string, userInput: string): Promise<PreparedTask> {
  const profile = await scanProject(repoPath);
  const taskAnalysis = analyzeTask(userInput);
  const [recommendations, memoryIndex, requirementFile, codePointers] = await Promise.all([
    recommendForProject(profile, repoPath),
    createMemoryIndex(repoPath, profile, 8),
    listRequirements(repoPath),
    locateRelatedFiles(repoPath, userInput, taskAnalysis),
  ]);
  const memorySuggestions = await createMemorySuggestions(repoPath, userInput, memoryIndex.items);
  const restoredRequirement = selectRequirement(requirementFile.requirements, userInput);
  const handoffKeyword = createHandoffKeyword(userInput, restoredRequirement, memorySuggestions);
  const handoff = restoredRequirement || memorySuggestions.length
    ? await createMemoryHandoff(
      repoPath,
      profile,
      handoffKeyword,
      MAX_MEMORY_SUGGESTIONS,
      restoredRequirement,
    )
    : undefined;
  const skillSuggestions = await recommendSkillsForTask(profile, repoPath, userInput, recommendations);
  const missingQuestions = createMissingQuestions(userInput, codePointers, memorySuggestions, taskAnalysis);
  const matchedRequirement = restoredRequirement
    ? createPreparedRequirementMatch(restoredRequirement, userInput, "Matched by requirement title, summary, or keywords.")
    : createRequirementMatchFromMemory(memorySuggestions);
  const executionPlan = createExecutionPlan({
    taskAnalysis,
    missingQuestions,
    codePointers,
    skillSuggestions,
    memorySuggestions,
    matchedRequirement,
  });
  const guardrail = createTaskGuardrail(userInput, matchedRequirement);

  return {
    projectId: profile.id,
    projectName: profile.name,
    generatedAt: new Date().toISOString(),
    taskAnalysis,
    requirement: {
      originalInput: userInput,
      clarifiedGoal: createClarifiedGoal(userInput, profile, restoredRequirement),
      missingQuestions,
      acceptanceCriteria: createAcceptanceCriteria(userInput, profile),
    },
    codePointers,
    matchedRequirement,
    skillSuggestions,
    memorySuggestions,
    memoryIndex,
    executionPlan,
    guardrail,
    agentInstructions: createAgentInstructions({
      profile,
      userInput,
      taskAnalysis,
      codePointers,
      skillSuggestions,
      memorySuggestions,
      matchedRequirement,
      handoffSummary: handoff?.summary,
      executionPlan,
      guardrail,
    }),
  };
}

export async function recommendSkillsForTask(
  profile: ProjectProfile,
  repoPath: string,
  userInput: string,
  projectRecommendations?: ToolRecommendation[],
): Promise<TaskSkillSuggestion[]> {
  const [skillPool, skillSelection] = await Promise.all([
    listSkillPool(),
    readProjectSkillSelection(repoPath),
  ]);
  const selectionStatus = new Map(skillSelection.selected.map((item) => [item.id, item.status]));
  const projectSkillReasons = new Map(
    (projectRecommendations ?? await recommendForProject(profile, repoPath))
      .filter((item) => item.type === "skill")
      .map((item) => [item.id, item.reason]),
  );
  const tokens = tokenize(`${userInput} ${profile.languages.join(" ")} ${profile.frameworks.join(" ")}`);

  const taskTokens = tokenize(userInput);
  const projectSignals = [...profile.languages, ...profile.frameworks, profile.packageManager ?? ""]
    .filter(Boolean);

  return skillPool.items
    .map((skill): TaskSkillSuggestion & { score: number } => {
      const skillText = `${skill.id} ${skill.name} ${skill.description} ${skill.tags.join(" ")}`;
      const score = scoreText(skillText, tokens) + scoreSkillByTaskIntent(skillText, userInput);
      const projectReason = projectSkillReasons.get(skill.id);
      const matchedSignals = createSkillMatchedSignals(skillText, taskTokens, projectSignals, projectReason);
      const reason = createSkillTaskReason(skill.name, userInput, projectReason, score, matchedSignals);

      return {
        id: skill.id,
        name: skill.name,
        reason,
        matchedSignals,
        usageHint: createSkillUsageHint(skill.name, userInput, selectionStatus.get(skill.id)),
        localRuleNote: createLocalRuleNote(skill.risk, selectionStatus.get(skill.id)),
        conflictRisk: skill.risk,
        status: selectionStatus.get(skill.id) ?? "recommended",
        score,
      };
    })
    .filter((item) => item.score > 0 || projectSkillReasons.has(item.id) || item.status === "enabled")
    .sort((left, right) => {
      if (left.status === "enabled" && right.status !== "enabled") {
        return -1;
      }
      if (right.status === "enabled" && left.status !== "enabled") {
        return 1;
      }
      return right.score - left.score;
    })
    .slice(0, MAX_SKILL_SUGGESTIONS)
    .map(({ score: _score, ...item }) => item);
}

async function createMemorySuggestions(
  repoPath: string,
  userInput: string,
  indexItems: MemoryIndexItem[],
): Promise<TaskMemorySuggestion[]> {
  const tokens = tokenize(userInput);
  const indexedMatches = indexItems
    .map((item) => ({
      item,
      score: scoreText([
        item.title,
        item.summary,
        item.requirementTitle ?? "",
        ...item.keywords,
        ...item.changedFiles,
      ].join(" "), tokens),
    }))
    .filter(({ score }) => score > 0);

  const recalled = userInput.trim()
    ? await recallSessions(repoPath, userInput)
    : [];
  const recalledMatches = recalled.map((session) => ({
    item: {
      id: session.id,
      requirementId: session.requirementId,
      requirementTitle: session.requirementTitle,
      title: session.title,
      keywords: session.keywords,
      summary: session.summary,
      changedFiles: session.changedFiles,
      codeStatus: session.codeStatus,
      codeStatusReason: session.codeStatusReason,
      reviewPath: session.reviewPath,
      updatedAt: session.updatedAt,
      expiresAt: session.expiresAt,
      restoreHint: session.requirementId
        ? `Call specweft.restore_requirement with requirementId=${session.requirementId}.`
        : `Call specweft.restore_requirement with keyword=${session.keywords[0] ?? session.title}.`,
    },
    score: 2,
  }));

  const uniqueMatches = new Map<string, { item: MemoryIndexItem; score: number }>();
  for (const match of [...indexedMatches, ...recalledMatches]) {
    const existing = uniqueMatches.get(match.item.id);
    if (!existing || match.score > existing.score) {
      uniqueMatches.set(match.item.id, match);
    }
  }

  const uniqueByRequirement = new Map<string, { item: MemoryIndexItem; score: number }>();
  for (const match of uniqueMatches.values()) {
    const key = match.item.requirementId ?? match.item.id;
    const existing = uniqueByRequirement.get(key);
    if (!existing || match.score > existing.score || match.item.updatedAt > existing.item.updatedAt) {
      uniqueByRequirement.set(key, match);
    }
  }

  return [...uniqueByRequirement.values()]
    .sort((left, right) => right.score - left.score)
    .slice(0, MAX_MEMORY_SUGGESTIONS)
    .map(({ item }) => ({
      memoryId: item.id,
      requirementId: item.requirementId,
      title: item.title,
      keywords: item.keywords,
      reason: createMemoryReason(item),
      restoreTool: item.requirementId
        ? `specweft.restore_requirement({ requirementId: "${item.requirementId}" })`
        : `specweft.restore_requirement({ keyword: "${item.keywords[0] ?? item.title}" })`,
    }));
}

async function locateRelatedFiles(
  repoPath: string,
  userInput: string,
  taskAnalysis: TaskAnalysis,
): Promise<TaskCodePointer[]> {
  const files = await listCandidateFiles(repoPath);
  const tokens = tokenize(userInput);
  const suggestedTokens = taskAnalysis.suggestedSearches.filter((token) => !tokens.includes(token));
  const scored = await Promise.all(
    files.map(async (file) => scoreCandidateFile(repoPath, file, tokens, suggestedTokens)),
  );

  return scored
    .filter((item) => item.score > 0)
    .map((item) => ({
      ...item,
      score: item.score + scoreFileRoleForTask(item.fileRole, taskAnalysis),
    }))
    .sort((left, right) => right.score - left.score || left.path.localeCompare(right.path))
    .slice(0, MAX_CODE_POINTERS)
    .map((item) => ({
      path: item.path,
      reason: createCodePointerReason(item),
      confidence: item.score >= 6 ? "high" : item.score >= 3 ? "medium" : "low",
      matchSource: item.matchSource,
      fileRole: item.fileRole,
      matchedSignals: item.matchedSignals,
    }));
}

async function listCandidateFiles(repoPath: string): Promise<string[]> {
  const result: string[] = [];
  const ignoredDirs = new Set([
    ".git",
    ".specweft",
    "node_modules",
    "dist",
    "build",
    "target",
    ".venv",
    "__pycache__",
  ]);
  const usefulExtensions = new Set([
    ".ts",
    ".tsx",
    ".js",
    ".jsx",
    ".java",
    ".py",
    ".vue",
    ".md",
    ".json",
    ".toml",
    ".yaml",
    ".yml",
  ]);

  async function walk(currentDir: string): Promise<void> {
    if (result.length >= MAX_SCANNED_FILES) {
      return;
    }

    const entries = await readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      if (result.length >= MAX_SCANNED_FILES) {
        return;
      }
      if (entry.isDirectory() && ignoredDirs.has(entry.name)) {
        continue;
      }

      const absolutePath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        await walk(absolutePath);
        continue;
      }
      if (!entry.isFile() || !usefulExtensions.has(path.extname(entry.name))) {
        continue;
      }

      const fileStat = await stat(absolutePath);
      if (fileStat.size > 500_000) {
        continue;
      }
      result.push(toPosixPath(path.relative(repoPath, absolutePath)));
    }
  }

  await walk(repoPath);
  return result;
}

function selectRequirement(
  requirements: RequirementRecord[],
  userInput: string,
): RequirementRecord | undefined {
  const tokens = tokenize(userInput);
  const ranked = requirements
    .map((requirement) => ({
      requirement,
      score: scoreText([
        requirement.title,
        requirement.summary ?? "",
        ...requirement.keywords,
      ].join(" "), tokens),
    }))
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score);

  return ranked[0]?.requirement;
}

function analyzeTask(userInput: string): TaskAnalysis {
  const normalized = userInput.trim();
  const tokens = tokenize(normalized);
  const signals = createTaskSignals(normalized);
  const intent = detectTaskIntent(normalized);
  const ambiguity = detectTaskAmbiguity(normalized, tokens, signals);
  const confidence = ambiguity === "low" ? "high" : ambiguity === "medium" ? "medium" : "low";
  const suggestedSearches = createSuggestedSearches(tokens, intent, signals);

  return {
    intent,
    ambiguity,
    confidence,
    summary: createTaskAnalysisSummary(intent, ambiguity, normalized),
    signals,
    routingReason: createRoutingReason(intent, ambiguity, signals),
    shouldAskBeforeEdit: ambiguity === "high",
    suggestedSearches,
  };
}

function createTaskSignals(userInput: string): string[] {
  const signals: string[] = [];

  if (/(修复|bug|错误|失败|异常|crash|fix|error|failed|exception)/i.test(userInput)) {
    signals.push("failure-path");
  }
  if (/(新增|实现|支持|增加|feature|add|implement|support)/i.test(userInput)) {
    signals.push("new-behavior");
  }
  if (/(优化|重构|简化|可读|性能|refactor|improve|optimize|cleanup|performance)/i.test(userInput)) {
    signals.push("improvement");
  }
  if (/(展示|界面|页面|组件|渲染|样式|交互|ui|view|render|display|component)/i.test(userInput)) {
    signals.push("ui-surface");
  }
  if (/(讲解|解释|review|diff|看懂|审查|总结)/i.test(userInput)) {
    signals.push("review");
  }
  if (/(测试|验证|回归|test|spec|coverage)/i.test(userInput)) {
    signals.push("test");
  }
  if (/(文档|readme|docs|说明)/i.test(userInput)) {
    signals.push("docs");
  }
  if (/(配置|脚本|发布|package|tsconfig|vite|config|build|deploy)/i.test(userInput)) {
    signals.push("config");
  }

  return [...new Set(signals)];
}

function detectTaskIntent(userInput: string): TaskAnalysis["intent"] {
  if (/(讲解|解释|review|diff|看懂|审查|总结)/i.test(userInput)) {
    return "review";
  }
  if (/(修复|bug|错误|失败|异常|crash|fix|error|failed|exception)/i.test(userInput)) {
    return "bugfix";
  }
  if (/(测试|验证|回归|test|spec|coverage)/i.test(userInput)) {
    return "test";
  }
  if (/(文档|readme|docs|说明)/i.test(userInput)) {
    return "docs";
  }
  if (/(配置|脚本|发布|package|tsconfig|vite|config|build|deploy)/i.test(userInput)) {
    return "config";
  }
  if (/(优化|重构|简化|可读|性能|refactor|improve|optimize|cleanup|performance)/i.test(userInput)) {
    return "refactor";
  }
  if (/(新增|实现|支持|增加|feature|add|implement|support)/i.test(userInput)) {
    return "feature";
  }
  return "unknown";
}

function detectTaskAmbiguity(userInput: string, tokens: string[], signals: string[]): TaskAnalysis["ambiguity"] {
  if (!userInput.trim() || userInput.trim().length < 6) {
    return "high";
  }
  if (tokens.length <= 1 && signals.length === 0) {
    return "high";
  }
  if (/(优化一下|改一下|处理一下|看看|搞一下|随便|随便改|优化下)$/i.test(userInput.trim())) {
    return "high";
  }
  if (tokens.length <= 2 || signals.length === 0) {
    return "medium";
  }
  return "low";
}

function createSuggestedSearches(
  tokens: string[],
  intent: TaskAnalysis["intent"],
  signals: string[],
): string[] {
  const searches = new Set(tokens);

  if (intent === "bugfix" || signals.includes("failure-path")) {
    ["error", "exception", "throw", "catch", "fail"].forEach((item) => searches.add(item));
  }
  if (intent === "test") {
    ["test", "spec", "__tests__", "vitest", "jest"].forEach((item) => searches.add(item));
  }
  if (intent === "review") {
    ["diff", "review", "summary", "memory"].forEach((item) => searches.add(item));
  }
  if (intent === "config") {
    ["package", "config", "build", "tsconfig"].forEach((item) => searches.add(item));
  }

  return [...searches].slice(0, 20);
}

function createTaskAnalysisSummary(
  intent: TaskAnalysis["intent"],
  ambiguity: TaskAnalysis["ambiguity"],
  userInput: string,
): string {
  const task = userInput.trim() || "未提供明确需求";
  return `识别为 ${intent} 类任务，需求清晰度为 ${ambiguity}。原始需求：${task}`;
}

function createRoutingReason(
  intent: TaskAnalysis["intent"],
  ambiguity: TaskAnalysis["ambiguity"],
  signals: string[],
): string {
  const signalText = signals.length ? signals.join(", ") : "no strong intent signal";
  return `Intent=${intent}; ambiguity=${ambiguity}; signals=${signalText}.`;
}

function createClarifiedGoal(
  userInput: string,
  profile: ProjectProfile,
  requirement?: RequirementRecord,
): string {
  const input = userInput.trim();
  const projectText = `${profile.name}${profile.languages.length ? ` (${profile.languages.join("/")})` : ""}`;
  const requirementText = requirement ? ` Continue within requirement "${requirement.title}".` : "";

  if (!input) {
    return `Clarify the next change needed in ${projectText} before editing code.${requirementText}`;
  }

  return `In ${projectText}, handle this task: ${input}.${requirementText} Keep changes scoped, inspect related files first, and record the final diff.`;
}

function createMissingQuestions(
  userInput: string,
  codePointers: TaskCodePointer[],
  memorySuggestions: TaskMemorySuggestion[],
  taskAnalysis: TaskAnalysis,
): string[] {
  const questions: string[] = [];
  const normalized = userInput.trim();

  if (taskAnalysis.ambiguity === "high") {
    questions.push("这次希望改变的用户可见行为是什么？请给一个具体页面、接口、命令或错误现象。");
  } else if (normalized.length < 8) {
    questions.push("What user-visible behavior should change?");
  }
  if (codePointers.length === 0 && memorySuggestions.length === 0) {
    questions.push("Which module, page, API, or file should SpecWeft inspect first?");
  }
  if (/(优化|improve|better|重构|refactor)/i.test(normalized)) {
    questions.push("Should the change prioritize readability, performance, bug fixing, or user experience?");
  }
  if (taskAnalysis.intent === "bugfix" && !/(复现|报错|错误|error|stack|log|现象)/i.test(normalized)) {
    questions.push("有没有报错信息、复现步骤或期望结果？这会决定优先检查哪条执行路径。");
  }
  if (taskAnalysis.intent === "feature" && !/(验收|效果|页面|接口|字段|返回|展示)/i.test(normalized)) {
    questions.push("这个新功能完成后，用户或调用方应该看到什么结果？");
  }

  return questions.slice(0, 3);
}

function createAcceptanceCriteria(userInput: string, profile: ProjectProfile): string[] {
  const criteria = [
    "Related files are inspected before editing.",
    "The implementation stays scoped to the stated requirement.",
    "SpecWeft records the final diff and memory after changes.",
  ];

  if (profile.testCommands.length > 0) {
    criteria.push(`Run or recommend the smallest relevant test command: ${profile.testCommands[0]}.`);
  } else {
    criteria.push("Explain the smallest practical verification path if no test command is detected.");
  }

  if (/修复|bug|error|错误|失败|fix|crash/i.test(userInput)) {
    criteria.push("The suspected failure path is described and covered by a regression check.");
  }

  return criteria;
}

function createExecutionPlan(input: {
  taskAnalysis: TaskAnalysis;
  missingQuestions: string[];
  codePointers: TaskCodePointer[];
  skillSuggestions: TaskSkillSuggestion[];
  memorySuggestions: TaskMemorySuggestion[];
  matchedRequirement: PreparedTaskRequirementMatch | null;
}): TaskExecutionStep[] {
  const steps: Omit<TaskExecutionStep, "order">[] = [];

  if (input.missingQuestions.length > 0) {
    steps.push({
      title: "补齐需求边界",
      action: `Ask: ${input.missingQuestions[0]}`,
      reason: `${input.taskAnalysis.routingReason} 当前需求仍有关键边界不清楚，先问一个问题能避免大范围误改。`,
      when: "if_missing_context",
    });
  }

  if (input.memorySuggestions.length > 0) {
    const memory = input.memorySuggestions[0];
    steps.push({
      title: "按需恢复历史记忆",
      action: memory.restoreTool,
      reason: `命中历史记忆「${memory.title}」，只恢复这一条需求线，避免把全部记忆塞进上下文。`,
      when: "if_relevant_memory",
      tool: "specweft.restore_requirement",
    });
  }

  steps.push({
    title: "标记本次需求边界",
    action: input.matchedRequirement
      ? `Call specweft.start_work_segment({ requirementId: "${input.matchedRequirement.requirementId}" }) with the current task before editing.`
      : "Call specweft.start_work_segment with the current task before editing.",
    reason: "给本次需求留下开始快照，后面 review 才能区分新改动和切需求前已经存在的 diff。",
    when: "always",
    tool: "specweft.start_work_segment",
  });

  if (input.codePointers.length > 0) {
    const strongest = input.codePointers[0];
    steps.push({
      title: "先读相关源码",
      action: `Inspect ${input.codePointers.slice(0, 4).map((item) => item.path).join("; ")}`,
      reason: strongest
        ? `最高命中文件来自 ${strongest.matchSource ?? "path"}：${strongest.reason}`
        : "这些文件和需求关键词最接近，先读它们再决定修改范围。",
      when: "always",
    });
  } else {
    steps.push({
      title: "先定位模块",
      action: `Search the repository by: ${input.taskAnalysis.suggestedSearches.slice(0, 8).join(", ") || "task keywords"}.`,
      reason: "当前没有强文件命中，直接改代码容易偏离真实入口。",
      when: "always",
    });
  }

  if (input.skillSuggestions.length > 0) {
    const skill = input.skillSuggestions[0];
    steps.push({
      title: "考虑匹配 Skill",
      action: `Consider Skill ${skill.name} (${skill.id}).`,
      reason: `${skill.reason} ${skill.localRuleNote}`,
      when: "if_relevant_skill",
    });
  }

  steps.push({
    title: "小步实现并记录结果",
    action: input.matchedRequirement
      ? `After editing, call specweft.record_current_diff({ requirementId: "${input.matchedRequirement.requirementId}" }).`
      : "After editing, call specweft.record_current_diff.",
    reason: "把本次修改讲解、记忆和工作段结束快照保存下来，后续新线程才能按需求恢复上下文。",
    when: "after_edit",
    tool: "specweft.record_current_diff",
  });

  return steps.map((step, index) => ({
    order: index + 1,
    ...step,
  }));
}

function createTaskGuardrail(
  userInput: string,
  matchedRequirement: PreparedTaskRequirementMatch | null,
): TaskGuardrail {
  const title = createTaskTitle(userInput, matchedRequirement);
  const requirementId = matchedRequirement?.requirementId;

  return {
    boundaryRequired: true,
    requirementId,
    requirementTitle: matchedRequirement?.title,
    startWorkSegmentInput: {
      task: userInput.trim() || title,
      title,
      requirementId,
    },
    recordCurrentDiffInput: {
      title,
      requirementId,
    },
    finalResponseChecklist: [
      "说明本次需求上下文和为什么这样改。",
      "引用 record_current_diff 返回的 agentReview.suggestedAgentResponse，而不是完整 advancedReview。",
      "列出建议先看的源码入口和最小验证方式。",
      "如果没有调用 start_work_segment，先说明需求边界可能不准，并尽快补调用。",
    ],
  };
}

function createTaskTitle(
  userInput: string,
  matchedRequirement: PreparedTaskRequirementMatch | null,
): string {
  if (matchedRequirement?.title.trim()) {
    return matchedRequirement.title.trim();
  }

  const normalized = userInput.trim().replace(/\s+/g, " ");
  if (!normalized) {
    return "SpecWeft coding task";
  }

  return normalized.length <= 42 ? normalized : `${normalized.slice(0, 40)}...`;
}

function createAgentInstructions(input: {
  profile: ProjectProfile;
  userInput: string;
  taskAnalysis: TaskAnalysis;
  codePointers: TaskCodePointer[];
  skillSuggestions: TaskSkillSuggestion[];
  memorySuggestions: TaskMemorySuggestion[];
  matchedRequirement: PreparedTaskRequirementMatch | null;
  handoffSummary?: string;
  executionPlan: TaskExecutionStep[];
  guardrail: TaskGuardrail;
}): string {
  const fileText = input.codePointers.length
    ? input.codePointers.map((item) => item.path).join(", ")
    : "No strong file match yet; ask one clarifying question before broad edits.";
  const skillText = input.skillSuggestions.length
    ? input.skillSuggestions.map((item) => item.name).join(", ")
    : "No task-specific Skill was selected.";
  const memoryText = input.memorySuggestions.length
    ? input.memorySuggestions.map((item) => item.title).join("; ")
    : "No matching memory should be restored by default.";
  const requirementText = input.matchedRequirement
    ? `${input.matchedRequirement.title} (${input.matchedRequirement.requirementId})`
    : "No matched requirement id.";
  const planText = input.executionPlan
    .map((step) => `${step.order}. ${step.title}: ${step.action}`)
    .join("\n");

  return [
    `Task: ${input.userInput.trim() || "clarify the next coding task"}`,
    `Project: ${input.profile.name}`,
    `Task analysis: ${input.taskAnalysis.summary}. ${input.taskAnalysis.routingReason}`,
    `Inspect first: ${fileText}`,
    `Use or consider Skills: ${skillText}`,
    `Relevant memory: ${memoryText}`,
    `Matched requirement: ${requirementText}`,
    `Guardrail startWorkSegmentInput: ${JSON.stringify(input.guardrail.startWorkSegmentInput)}`,
    `Guardrail recordCurrentDiffInput: ${JSON.stringify(input.guardrail.recordCurrentDiffInput)}`,
    `Execution plan:\n${planText}`,
    input.handoffSummary ? `Restored context summary: ${input.handoffSummary}` : undefined,
    "If missingQuestions is not empty, ask the user before editing unless the answer is obvious from the repository.",
    "Before edits, call specweft.start_work_segment with guardrail.startWorkSegmentInput.",
    "After edits, call specweft.record_current_diff with guardrail.recordCurrentDiffInput and use agentReview.suggestedAgentResponse in the final response.",
  ].filter(Boolean).join("\n");
}

function createPreparedRequirementMatch(
  requirement: RequirementRecord,
  userInput: string,
  reason: string,
): PreparedTaskRequirementMatch {
  return {
    requirementId: requirement.id,
    title: requirement.title,
    status: requirement.status,
    reason,
    keywords: requirement.keywords.slice(0, 10),
    reviewCount: requirement.reviewCount,
    startWorkSegmentTool: `specweft.start_work_segment({ task: "${escapeToolString(userInput)}", requirementId: "${requirement.id}" })`,
    recordDiffTool: `specweft.record_current_diff({ requirementId: "${requirement.id}" })`,
  };
}

function createRequirementMatchFromMemory(
  memorySuggestions: TaskMemorySuggestion[],
): PreparedTaskRequirementMatch | null {
  const memory = memorySuggestions.find((item) => item.requirementId);
  if (!memory?.requirementId) {
    return null;
  }

  return {
    requirementId: memory.requirementId,
    title: memory.title,
    status: "active",
    reason: `Matched by related memory "${memory.title}".`,
    keywords: memory.keywords.slice(0, 10),
    reviewCount: 0,
    startWorkSegmentTool: `specweft.start_work_segment({ task: "${escapeToolString(memory.title)}", requirementId: "${memory.requirementId}" })`,
    recordDiffTool: `specweft.record_current_diff({ requirementId: "${memory.requirementId}" })`,
  };
}

function escapeToolString(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll("\"", "\\\"");
}

function createSkillTaskReason(
  name: string,
  userInput: string,
  projectReason: string | undefined,
  score: number,
  matchedSignals: string[],
): string {
  const taskReason = score > 0
    ? `Matched the current task wording for "${userInput.trim()}".`
    : "Selected because it is already useful for this project.";
  const signalText = matchedSignals.length
    ? ` Signals: ${matchedSignals.slice(0, 4).join(", ")}.`
    : "";

  return projectReason
    ? `${taskReason}${signalText} ${projectReason}`
    : `${taskReason}${signalText} Use ${name} only if it does not conflict with local project rules.`;
}

function createSkillMatchedSignals(
  skillText: string,
  taskTokens: string[],
  projectSignals: string[],
  projectReason?: string,
): string[] {
  const normalized = skillText.toLowerCase();
  const signals: string[] = [];
  const matchedTaskTokens = matchedTokens(skillText, taskTokens);

  if (matchedTaskTokens.length) {
    signals.push(`task:${matchedTaskTokens.join("/")}`);
  }

  const matchedProjectSignals = projectSignals
    .map((signal) => signal.toLowerCase())
    .filter((signal) => signal && normalized.includes(signal))
    .slice(0, 4);
  if (matchedProjectSignals.length) {
    signals.push(`project:${matchedProjectSignals.join("/")}`);
  }

  if (projectReason) {
    signals.push("project-recommendation");
  }

  return signals;
}

function createSkillUsageHint(
  name: string,
  userInput: string,
  status?: TaskSkillSuggestion["status"],
): string {
  if (status === "enabled") {
    return `This Skill is already enabled. Let the agent read ${name} before editing files related to "${userInput.trim()}".`;
  }
  if (status === "ignored") {
    return `This Skill was ignored for the project. Re-enable it only if the current task clearly needs ${name}.`;
  }
  if (status === "disabled") {
    return `This Skill is available but disabled. Enable it only for tasks where ${name} directly narrows the implementation path.`;
  }
  return `Consider ${name} before editing, then keep local AGENTS/CLAUDE rules higher priority than marketplace guidance.`;
}

function createLocalRuleNote(
  risk: TaskSkillSuggestion["conflictRisk"],
  status?: TaskSkillSuggestion["status"],
): string {
  if (status === "enabled") {
    return "Project selection already allows this Skill; still follow local repository rules first.";
  }
  if (risk === "high") {
    return "High conflict risk: preview the Skill content before enabling and reject anything that overrides local conventions.";
  }
  if (risk === "medium") {
    return "Medium conflict risk: use it as a reference, not as an instruction that can replace project rules.";
  }
  return "Low conflict risk: safe to consider, but local project rules remain authoritative.";
}

function createMemoryReason(item: MemoryIndexItem): string {
  const requirement = item.requirementTitle ? ` under requirement "${item.requirementTitle}"` : "";
  const files = item.changedFiles.length ? ` Related files: ${item.changedFiles.slice(0, 4).join(", ")}.` : "";
  return `Matched previous memory "${item.title}"${requirement}.${files}`;
}

function createHandoffKeyword(
  userInput: string,
  requirement: RequirementRecord | undefined,
  memorySuggestions: TaskMemorySuggestion[],
): string {
  if (requirement) {
    return requirement.keywords[0] ?? requirement.title;
  }

  const bestMemory = memorySuggestions[0];
  return bestMemory?.keywords[0] ?? userInput;
}

function scoreSkillByTaskIntent(skillText: string, userInput: string): number {
  const normalized = userInput.toLowerCase();
  let score = 0;

  if (/(review|diff|讲解|解释|看懂|修改说明|代码审查)/i.test(normalized) && /diff|review|explain/.test(skillText)) {
    score += 4;
  }
  if (/(test|测试|验证|回归|质量)/i.test(normalized) && /test|quality/.test(skillText)) {
    score += 4;
  }
  if (/(java|spring|mybatis)/i.test(normalized) && /java|spring|mybatis/.test(skillText)) {
    score += 3;
  }
  if (/(typescript|javascript|node|react|vite|前端|界面)/i.test(normalized) && /typescript|javascript|node|react|vite|frontend/.test(skillText)) {
    score += 3;
  }

  return score;
}

type ScoredCandidateFile = {
  path: string;
  score: number;
  matchSource: NonNullable<TaskCodePointer["matchSource"]>;
  fileRole: NonNullable<TaskCodePointer["fileRole"]>;
  matchedSignals: string[];
  preview?: string;
  startLine?: number;
};

async function scoreCandidateFile(
  repoPath: string,
  filePath: string,
  primaryTokens: string[],
  secondaryTokens: string[],
): Promise<ScoredCandidateFile> {
  const pathScore = scoreFile(filePath, primaryTokens, 2) + scoreFile(filePath, secondaryTokens, 1);
  const pathSignals = [
    ...matchedTokens(filePath, primaryTokens).map((token) => `path:${token}`),
    ...matchedTokens(filePath, secondaryTokens).map((token) => `path:${token}`),
  ];
  const contentMatch = await scoreFileContent(path.join(repoPath, filePath), primaryTokens, secondaryTokens);
  const score = pathScore + contentMatch.score;
  const matchSource = createMatchSource(pathScore, contentMatch.score);
  const fileRole = detectFileRole(filePath);

  return {
    path: filePath,
    score,
    matchSource,
    fileRole,
    matchedSignals: [...new Set([...pathSignals, ...contentMatch.signals])].slice(0, 8),
    preview: contentMatch.preview,
    startLine: contentMatch.startLine,
  };
}

async function scoreFileContent(
  absolutePath: string,
  primaryTokens: string[],
  secondaryTokens: string[],
): Promise<{
  score: number;
  signals: string[];
  preview?: string;
  startLine?: number;
}> {
  try {
    const content = await readFile(absolutePath, "utf-8");
    const lines = content.split("\n");
    let best: { score: number; line: string; lineNumber: number; tokens: string[] } | undefined;

    lines.slice(0, 1200).forEach((line, index) => {
      const normalized = line.toLowerCase();
      const primaryMatched = primaryTokens.filter((token) => normalized.includes(token)).slice(0, 6);
      const secondaryMatched = secondaryTokens.filter((token) => normalized.includes(token)).slice(0, 6);
      if (primaryMatched.length === 0 && secondaryMatched.length === 0) {
        return;
      }

      const lineScore = primaryMatched.reduce((sum, token) => sum + (token.length > 4 ? 4 : 3), 0)
        + secondaryMatched.reduce((sum, token) => sum + (token.length > 4 ? 1.5 : 1), 0);
      if (!best || lineScore > best.score) {
        best = {
          score: lineScore,
          line: line.trim(),
          lineNumber: index + 1,
          tokens: [...primaryMatched, ...secondaryMatched],
        };
      }
    });

    if (!best) {
      return { score: 0, signals: [] };
    }

    return {
      score: Math.min(best.score, 6),
      signals: best.tokens.map((token) => `content:${token}`),
      preview: best.line.slice(0, MAX_CONTENT_PREVIEW_CHARS),
      startLine: best.lineNumber,
    };
  } catch {
    return { score: 0, signals: [] };
  }
}

function createMatchSource(pathScore: number, contentScore: number): NonNullable<TaskCodePointer["matchSource"]> {
  if (pathScore > 0 && contentScore > 0) {
    return "path+content";
  }
  if (contentScore > 0) {
    return "content";
  }
  return "path";
}

function createCodePointerReason(item: ScoredCandidateFile): string {
  const signals = item.matchedSignals.length ? item.matchedSignals.join(", ") : "no explicit signal";
  return `Matched by ${item.matchSource}; file role=${item.fileRole}. Signals: ${signals}.`;
}

function detectFileRole(filePath: string): NonNullable<TaskCodePointer["fileRole"]> {
  const normalized = filePath.toLowerCase();
  if (/(^|\/)(__tests__|tests?|spec)\//.test(normalized) || /\.(test|spec)\./.test(normalized)) {
    return "test";
  }
  if (/\.(md|mdx|txt|rst)$/.test(normalized) || normalized.startsWith("docs/")) {
    return "docs";
  }
  if (/package\.json|tsconfig\.json|vite\.config|next\.config|rollup\.config|webpack\.config|pnpm-lock|package-lock|yarn\.lock/.test(normalized)) {
    return "config";
  }
  if (/\/memory\/|memory-|session-memory|dossier|timeline/.test(normalized)) {
    return "memory";
  }
  if (/\/requirements?\//.test(normalized) || /requirement-/.test(normalized)) {
    return "requirement";
  }
  if (/\/commands\/|\/mcp\/|\/cli\//.test(normalized)) {
    return "cli";
  }
  if (/ui\.tsx?$|ui\.jsx?$|\/ui\/|\/components?\//.test(normalized) || /\.(tsx|jsx|vue)$/.test(normalized)) {
    return "ui";
  }
  if (/\.(ts|tsx|js|jsx|py|java|go|rs)$/.test(normalized)) {
    return "runtime";
  }
  return "unknown";
}

function scoreFileRoleForTask(
  role: NonNullable<TaskCodePointer["fileRole"]>,
  taskAnalysis: TaskAnalysis,
): number {
  if (taskAnalysis.intent === "test") {
    return role === "test" ? 4 : 0;
  }
  if (taskAnalysis.intent === "docs") {
    return role === "docs" ? 4 : role === "test" ? -2 : 0;
  }
  if (taskAnalysis.intent === "config") {
    return role === "config" ? 4 : role === "test" ? -2 : 0;
  }
  if (taskAnalysis.signals.includes("ui-surface")) {
    if (role === "ui") {
      return 8;
    }
    if (role === "test" || role === "docs") {
      return -4;
    }
    if (role === "memory" || role === "requirement" || role === "cli" || role === "runtime") {
      return 1;
    }
  }
  if (taskAnalysis.signals.includes("improvement") || taskAnalysis.intent === "refactor" || taskAnalysis.intent === "feature") {
    if (role === "ui") {
      return 4;
    }
    if (role === "runtime" || role === "memory" || role === "requirement" || role === "cli") {
      return 2;
    }
    if (role === "test" || role === "docs") {
      return -3;
    }
  }
  if (taskAnalysis.intent === "bugfix" && role === "test") {
    return -1;
  }
  return 0;
}

function scoreFile(filePath: string, tokens: string[], weight = 1): number {
  const normalized = filePath.toLowerCase();
  let score = 0;

  for (const token of tokens) {
    if (normalized.includes(token)) {
      score += (token.length > 4 ? 2 : 1) * weight;
    }
  }

  if (/test|spec/.test(normalized) && tokens.some((token) => ["test", "测试", "验证"].includes(token))) {
    score += 2;
  }

  return score;
}

function scoreText(text: string, tokens: string[]): number {
  const normalized = text.toLowerCase();
  return tokens.reduce((score, token) => score + (normalized.includes(token) ? 1 : 0), 0);
}

function matchedTokens(text: string, tokens: string[]): string[] {
  const normalized = text.toLowerCase();
  return tokens.filter((token) => normalized.includes(token)).slice(0, 5);
}

function tokenize(text: string): string[] {
  const normalized = text.toLowerCase();
  const asciiTokens = normalized
    .split(/[^a-z0-9+#.]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3 && !GENERIC_TOKENS.has(token));
  const chineseDomainTokens = CHINESE_DOMAIN_TERMS.filter((term) => normalized.includes(term) && !GENERIC_TOKENS.has(term));
  const chineseTokens = [...normalized.matchAll(/[\u4e00-\u9fff]{2,}/g)]
    .map((match) => match[0])
    .flatMap((token) => createChineseTokenWindows(token));

  return expandTokenSynonyms([...new Set([...asciiTokens, ...chineseDomainTokens, ...chineseTokens])]).slice(0, 30);
}

function createChineseTokenWindows(token: string): string[] {
  if (token.length <= 4) {
    return GENERIC_TOKENS.has(token) ? [] : [token];
  }

  const windows: string[] = [];
  for (let index = 0; index <= token.length - 2 && windows.length < 8; index += 1) {
    const part = token.slice(index, index + 2);
    if (!GENERIC_TOKENS.has(part) && CHINESE_DOMAIN_TERMS.includes(part)) {
      windows.push(part);
    }
  }
  return windows;
}

function expandTokenSynonyms(tokens: string[]): string[] {
  const expanded = new Set(tokens);

  for (const token of tokens) {
    for (const [source, synonyms] of Object.entries(TOKEN_SYNONYMS)) {
      if (token.includes(source)) {
        for (const synonym of synonyms) {
          expanded.add(synonym);
        }
      }
    }
  }

  return [...expanded];
}
