import {
  createReviewReport,
  resolveRepoPath,
  scanProject,
  type ReviewReport,
} from "@specweft/core";
import { printText } from "../output.js";
import { recordCliActivity } from "./activity.js";

// review 会产出两份东西：
// 1. Markdown 报告，方便人阅读本次改动思路。
// 2. Session memory，方便新线程通过关键词找回上下文。
export async function runReview(repoArg: string, title?: string, requirementId?: string): Promise<void> {
  const repoPath = resolveRepoPath(repoArg);
  const profile = await scanProject(repoPath);
  const report = await createReviewReport(repoPath, profile, title, 7, requirementId);
  await recordCliActivity(repoPath, {
    kind: "record_current_diff",
    title: "生成代码讲解",
    summary: report.review.reviewDigest.oneLineSummary || report.memory.summary,
    toolName: "specweft review",
    requirementId: report.requirement?.id,
    requirementTitle: report.requirement?.title,
    target: report.reportPath,
    metadata: {
      memoryId: report.memory.id,
      changedFiles: report.memory.changedFiles,
      codeStatus: report.memory.codeStatus,
      sections: report.review.reviewDigest.sections.map((item) => item.title),
    },
  });

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
    "需求上下文：",
    report.review.reviewDigest.requirementContext,
    "",
    "一句话总结：",
    report.review.reviewDigest.oneLineSummary,
    "",
    "需求分块：",
    formatDigestSections(report.review.reviewDigest.sections),
    "",
    "为什么这样改：",
    formatList(report.review.reviewDigest.whyChanged),
    "",
    "实现思路：",
    formatList(report.review.reviewDigest.implementationPath),
    "",
    "阅读入口：",
    formatDigestReadingPath(report.review.reviewDigest.readingPath),
    "",
    "注意点：",
    formatList(report.review.reviewDigest.reviewNotes),
    "",
    "验证建议：",
    formatList(report.review.reviewDigest.validation),
    "",
    "判断置信度：",
    `${formatConfidence(report.review.reviewDigest.confidence)} - ${report.review.reviewDigest.confidenceReasons.join("；") || "-"}`,
    "",
    "新线程继承提示：",
    report.review.nextThreadPrompt,
    "",
    "高级详情：",
    `- 报告中保留了需求拆解、改动分组、高级源码详情、风险和测试建议：${report.reportPath}`,
  ].join("\n");
}

function formatList(items: string[]): string {
  if (items.length === 0) {
    return "- 无";
  }

  return items.map((item) => `- ${item}`).join("\n");
}

function formatDigestSections(items: ReviewReport["review"]["reviewDigest"]["sections"]): string {
  if (items.length === 0) {
    return "- 无";
  }

  return items.map((item, index) => [
    `${index + 1}. ${item.title}`,
    `   摘要：${item.summary}`,
    `   为什么：${item.whyChanged}`,
    `   实现：${item.implementation}`,
    item.readingEntry ? `   入口：${item.readingEntry.path}` : undefined,
    item.validation ? `   验证：${item.validation}` : undefined,
    `   置信度：${formatConfidence(item.confidence)}`,
  ].filter((line): line is string => line !== undefined).join("\n")).join("\n");
}

function formatDigestReadingPath(items: ReviewReport["review"]["reviewDigest"]["readingPath"]): string {
  if (items.length === 0) {
    return "- 无";
  }

  return items.map((item, index) => {
    const title = item.title && item.title !== item.path ? `${item.title}：` : "";
    return `${index + 1}. ${title}${item.path}，${item.reason}`;
  }).join("\n");
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
