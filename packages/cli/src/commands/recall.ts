import { recallSessions, resolveRepoPath } from "@specweft/core";
import { printJson } from "../output.js";

// 从本地 session memory 中按关键词恢复历史需求上下文。
export async function runRecall(repoArg: string, keyword?: string): Promise<void> {
  if (!keyword) {
    throw new Error("recall requires --keyword");
  }

  const repoPath = resolveRepoPath(repoArg);
  const sessions = await recallSessions(repoPath, keyword);
  printJson({ sessions });
}
