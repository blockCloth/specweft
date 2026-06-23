import {
  createReviewReport,
  resolveRepoPath,
  scanProject,
  type ReviewReport,
} from "@specweft/core";
import { printText } from "../output.js";

// review 会产出两份东西：
// 1. Markdown 报告，方便人阅读本次改动思路。
// 2. Session memory，方便新线程通过关键词找回上下文。
export async function runReview(repoArg: string, title?: string, requirementId?: string): Promise<void> {
  const repoPath = resolveRepoPath(repoArg);
  const profile = await scanProject(repoPath);
  const report = await createReviewReport(repoPath, profile, title, 7, requirementId);

  printText(formatReviewOutput(report));
}

function formatReviewOutput(report: ReviewReport): string {
  return [
    `代码讲解已生成：${report.title}`,
    "",
    `报告路径：${report.reportPath}`,
    `需求：${report.requirement?.title ?? "-"} (${report.requirement?.id ?? "-"})`,
    `记忆 ID：${report.memory.id}`,
    `代码状态：${report.memory.codeStatus ?? "-"} - ${report.memory.codeStatusReason ?? "-"}`,
    `过期时间：${report.memory.expiresAt}`,
    "",
    "本次修改摘要：",
    `- ${report.review.summary}`,
    "",
    "本次修改概览：",
    formatReviewOverview(report.review.reviewOverview),
    "",
    "需求拆解：",
    formatRequirementBlocks(report.review.requirementBlocks),
    "",
    "改动分组：",
    formatChangeGroups(report.review.changeGroups),
    "",
    "实现内容总结：",
    formatList(report.review.implementationSummary),
    "",
    "主要改动：",
    formatList(report.review.mainChanges),
    "",
    "源码查看方式：",
    formatSourceReadingGuide(report.review.sourceReadingGuide),
    "",
    "建议 Review 顺序：",
    formatList(report.review.reviewWalkthrough),
    "",
    "风险提示：",
    formatList(report.review.risks),
    "",
    "测试建议：",
    formatList(report.review.testSuggestions),
    "",
    "新线程继承提示：",
    report.review.nextThreadPrompt,
  ].join("\n");
}

function formatReviewOverview(overview: ReviewReport["review"]["reviewOverview"]): string {
  const lines = [
    overview.title,
    `摘要：${overview.summary}`,
    ...overview.keyValues.map((item) => `${item.key}：${item.value}`),
  ];

  if (overview.readingOrder.length > 0) {
    lines.push("建议阅读顺序：");
    lines.push(...overview.readingOrder.map((item) => `- ${item}`));
  }

  if (overview.batches.length > 0) {
    lines.push("修改批次：");
    for (const batch of overview.batches) {
      lines.push(`- ${batch.title}`);
      lines.push(`  摘要：${batch.summary}`);
      lines.push(`  建议动作：${batch.suggestedAction}`);
      lines.push(`  文件：${batch.files.map((file) => file.path).join(", ") || "-"}`);
    }
  }

  return lines.join("\n");
}

function formatList(items: string[]): string {
  if (items.length === 0) {
    return "- 无";
  }

  return items.map((item) => `- ${item}`).join("\n");
}

function formatRequirementBlocks(blocks: ReviewReport["review"]["requirementBlocks"]): string {
  if (blocks.length === 0) {
    return "- 无";
  }

  return blocks.map((block, index) => [
    `${index + 1}. ${block.title}`,
    `   类型：${formatRequirementBlockKind(block.kind)}`,
    `   摘要：${block.summary}`,
    `   置信度：${formatConfidence(block.confidence)}`,
    `   建议动作：${block.suggestedAction}`,
    `   证据：${block.evidence.join("；") || "-"}`,
    `   文件：${block.files.map((file) => file.path).join(", ") || "-"}`,
  ].join("\n")).join("\n");
}

function formatChangeGroups(groups: ReviewReport["review"]["changeGroups"]): string {
  if (groups.length === 0) {
    return "- 无";
  }

  return groups.map((group, index) => [
    `${index + 1}. ${group.title}`,
    `   目的：${group.purpose}`,
    ...group.keyValues.map((item) => `   ${item.key}：${item.value}`),
    `   文件：${group.files.map((file) => file.path).join(", ")}`,
  ].join("\n")).join("\n");
}

function formatRequirementBlockKind(kind: ReviewReport["review"]["requirementBlocks"][number]["kind"]): string {
  if (kind === "current-work") {
    return "当前需求";
  }
  if (kind === "historical-requirement") {
    return "历史需求";
  }
  if (kind === "functional-area") {
    return "功能域候选";
  }
  return "旧改动";
}

function formatConfidence(confidence: "high" | "medium" | "low"): string {
  if (confidence === "high") {
    return "高";
  }
  if (confidence === "medium") {
    return "中";
  }
  return "低";
}

function formatSourceReadingGuide(items: ReviewReport["review"]["sourceReadingGuide"]): string {
  if (items.length === 0) {
    return "- 无";
  }

  return items
    .map((item) => [
      `- ${item.path}`,
      `  关注点：${item.reason}`,
      `  查看：${item.command}`,
      `  路径：${item.absolutePath}`,
    ].join("\n"))
    .join("\n");
}
