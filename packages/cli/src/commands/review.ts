import {
  createReviewReport,
  resolveRepoPath,
  scanProject,
} from "@specweft/core";
import { printJson } from "../output.js";

// review 会产出两份东西：
// 1. Markdown 报告，方便人阅读本次改动思路。
// 2. Session memory，方便新线程通过关键词找回上下文。
export async function runReview(repoArg: string, title?: string): Promise<void> {
  const repoPath = resolveRepoPath(repoArg);
  const profile = await scanProject(repoPath);
  const report = await createReviewReport(repoPath, profile, title);

  printJson({
    title: report.title,
    reportPath: report.reportPath,
    memory: report.memory,
  });
}
