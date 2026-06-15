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
export async function runReview(repoArg: string, title?: string): Promise<void> {
  const repoPath = resolveRepoPath(repoArg);
  const profile = await scanProject(repoPath);
  const report = await createReviewReport(repoPath, profile, title);

  printText(formatReviewOutput(report));
}

function formatReviewOutput(report: ReviewReport): string {
  return [
    `代码讲解已生成：${report.title}`,
    "",
    `报告路径：${report.reportPath}`,
    `记忆 ID：${report.memory.id}`,
    `过期时间：${report.memory.expiresAt}`,
    "",
    "本次修改摘要：",
    `- ${report.review.summary}`,
    "",
    "主要改动：",
    formatList(report.review.mainChanges),
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

function formatList(items: string[]): string {
  if (items.length === 0) {
    return "- 无";
  }

  return items.map((item) => `- ${item}`).join("\n");
}
