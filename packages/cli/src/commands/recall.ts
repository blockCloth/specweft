import { recallSessions, resolveRepoPath } from "@specweft/core";
import { printJson } from "../output.js";

// 从本地 session memory 中按关键词恢复历史需求上下文。
export async function runRecall(repoArg: string, keyword?: string, requirementId?: string): Promise<void> {
  if (!keyword) {
    throw new Error('recall 需要 --keyword，例如：specweft recall --keyword "登录"');
  }

  const repoPath = resolveRepoPath(repoArg);
  const sessions = await recallSessions(repoPath, keyword, requirementId);
  printJson({ sessions });
}
