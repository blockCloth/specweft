import { prepareTask, resolveRepoPath } from "@specweft/core";
import { printJson } from "../output.js";

// 修改前入口：把用户的一句话需求整理成 Codex/Claude 可用的上下文包。
export async function runPrepare(repoArg: string, task?: string): Promise<void> {
  if (!task?.trim()) {
    throw new Error('prepare 需要 --task，例如：specweft prepare --task "优化登录校验"');
  }

  const repoPath = resolveRepoPath(repoArg);
  printJson(await prepareTask(repoPath, task));
}
