import { recallSessions, resolveRepoPath } from "@specweft/core";
import { printJson } from "../output.js";
import { recordCliActivity } from "./activity.js";

// 从本地 session memory 中按关键词恢复历史需求上下文。
export async function runRecall(repoArg: string, keyword?: string, requirementId?: string): Promise<void> {
  if (!keyword) {
    throw new Error('recall 需要 --keyword，例如：specweft recall --keyword "登录"');
  }

  const repoPath = resolveRepoPath(repoArg);
  const sessions = await recallSessions(repoPath, keyword, requirementId);
  await recordCliActivity(repoPath, {
    kind: "memory_recalled",
    title: "按关键词召回记忆",
    summary: sessions.length
      ? `CLI 已召回 ${sessions.length} 条和「${keyword}」相关的记忆。`
      : `CLI 没有找到和「${keyword}」相关的记忆。`,
    toolName: "specweft recall",
    requirementId,
    target: keyword,
    metadata: {
      sessions: sessions.length,
      memoryIds: sessions.map((item) => item.id),
      changedFiles: sessions.flatMap((item) => item.changedFiles).slice(0, 8),
    },
  });
  printJson({ sessions });
}
