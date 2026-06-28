import { prepareTask, resolveRepoPath, type PreparedTask } from "@specweft/core";
import { printJson, printText } from "../output.js";
import { recordCliActivity } from "./activity.js";

// 修改前入口：把用户的一句话需求整理成 Codex/Claude 可用的上下文包。
export async function runPrepare(repoArg: string, task?: string, json = false): Promise<void> {
  if (!task?.trim()) {
    throw new Error('prepare 需要 --task，例如：specweft prepare --task "优化登录校验"');
  }

  const repoPath = resolveRepoPath(repoArg);
  const prepared = await prepareTask(repoPath, task);
  await recordCliActivity(repoPath, {
    kind: "prepare_task",
    title: "准备任务上下文",
    summary: prepared.requirement.clarifiedGoal || prepared.taskAnalysis.summary || "CLI 已生成任务上下文包。",
    toolName: "specweft prepare",
    requirementId: prepared.guardrail.requirementId,
    requirementTitle: prepared.guardrail.requirementTitle,
    target: task,
    metadata: {
      intent: prepared.taskAnalysis.intent,
      ambiguity: prepared.taskAnalysis.ambiguity,
      codePointers: prepared.codePointers.map((item) => item.path),
      skills: prepared.skillSuggestions.map((item) => item.id),
      memorySuggestions: prepared.memorySuggestions.length,
    },
  });
  if (json) {
    printJson(prepared);
    return;
  }

  printText(formatPrepareOutput(prepared));
}

function formatPrepareOutput(prepared: PreparedTask): string {
  const gate = createPrepareStartGate(prepared);
  const primaryFile = prepared.codePointers[0];
  const primarySkill = prepared.skillSuggestions[0];
  const primaryMemory = prepared.memorySuggestions[0];

  return [
    `任务上下文已生成：${prepared.requirement.originalInput}`,
    "",
    `开始前判定：${gate.title}`,
    `原因：${gate.reason}`,
    `下一步：${gate.nextAction}`,
    "",
    "本次范围：",
    `- 项目：${prepared.projectName}`,
    `- 意图：${formatIntent(prepared.taskAnalysis.intent)} / 清晰度：${formatLevel(prepared.taskAnalysis.ambiguity)} / 置信度：${formatLevel(prepared.taskAnalysis.confidence)}`,
    `- 命中需求：${prepared.matchedRequirement?.title ?? "新需求候选"}`,
    `- 主入口文件：${primaryFile?.path ?? "暂未定位到强相关文件"}`,
    `- 推荐 Skill：${primarySkill ? `${primarySkill.name} (${primarySkill.id})` : "暂无强相关 Skill"}`,
    `- 命中记忆：${primaryMemory?.title ?? "暂无相关记忆"}`,
    "",
    "建议先读：",
    formatCodePointers(prepared),
    "",
    "推荐执行顺序：",
    formatExecutionPlan(prepared),
    "",
    "Agent 护栏：",
    `- start_work_segment：${formatGuardrailInput(prepared.guardrail.startWorkSegmentInput)}`,
    `- record_current_diff：${formatGuardrailInput(prepared.guardrail.recordCurrentDiffInput)}`,
    "",
    "机器可读完整上下文：",
    `- 需要 JSON 时运行：specweft prepare --task "${escapeShellText(prepared.requirement.originalInput)}" --json`,
  ].join("\n");
}

function createPrepareStartGate(prepared: PreparedTask): { title: string; reason: string; nextAction: string } {
  const canRestore = Boolean(
    prepared.matchedRequirement?.requirementId
    || prepared.memorySuggestions[0]?.requirementId
    || prepared.memorySuggestions[0]?.keywords[0],
  );

  if (prepared.taskAnalysis.shouldAskBeforeEdit || prepared.taskAnalysis.ambiguity === "high") {
    return {
      title: "先补齐需求",
      reason: "任务仍有明显歧义，直接编辑容易让 Agent 过度发挥或改错范围。",
      nextAction: `先回答：${prepared.requirement.missingQuestions[0] ?? "这次希望改变的用户可见行为是什么？"}`,
    };
  }

  if (prepared.codePointers.length === 0) {
    return {
      title: "先定位源码",
      reason: "暂时没有强相关文件，建议先补充关键词或搜索主入口。",
      nextAction: `按这些词搜索：${prepared.taskAnalysis.suggestedSearches.slice(0, 6).join(", ") || prepared.requirement.originalInput}`,
    };
  }

  if (canRestore) {
    return {
      title: "先恢复旧需求",
      reason: "命中了历史需求线，继续修改前应该只恢复这条需求的记忆。",
      nextAction: "先调用 specweft.restore_requirement，再开启工作段。",
    };
  }

  return {
    title: "可以开始工作段",
    reason: "目标、入口和执行边界已经足够明确，可以让 Agent 开始实现。",
    nextAction: "先调用 specweft.start_work_segment，再小步修改代码。",
  };
}

function formatCodePointers(prepared: PreparedTask): string {
  if (prepared.codePointers.length === 0) {
    return "- 暂无强相关文件，先按建议搜索词定位入口。";
  }

  return prepared.codePointers.slice(0, 5).map((item, index) => (
    `${index + 1}. ${item.path} - ${item.reason}`
  )).join("\n");
}

function formatExecutionPlan(prepared: PreparedTask): string {
  if (prepared.executionPlan.length === 0) {
    return "- 暂无执行路线。";
  }

  return prepared.executionPlan.map((item) => {
    const tool = item.tool ? ` (${item.tool})` : "";
    return `${item.order}. ${item.title}${tool}\n   ${item.action}`;
  }).join("\n");
}

function formatGuardrailInput(value: Record<string, string | undefined>): string {
  return Object.entries(value)
    .filter(([, entryValue]) => entryValue)
    .map(([key, entryValue]) => `${key}=${entryValue}`)
    .join(", ") || "-";
}

function formatIntent(value: string): string {
  const labels: Record<string, string> = {
    bugfix: "修复",
    feature: "功能",
    refactor: "优化/重构",
    review: "讲解/审查",
    test: "测试",
    docs: "文档",
    config: "配置",
    unknown: "未知",
  };
  return labels[value] ?? value;
}

function formatLevel(value: string): string {
  const labels: Record<string, string> = {
    low: "低",
    medium: "中",
    high: "高",
  };
  return labels[value] ?? value;
}

function escapeShellText(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll("\"", "\\\"");
}
