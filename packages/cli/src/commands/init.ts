import { initializeProject, resolveRepoPath } from "@specweft/core";
import { printJson } from "../output.js";

// 初始化项目：扫描当前仓库并写入 .specweft/profile.json。
export async function runInit(repoArg: string): Promise<void> {
  const repoPath = resolveRepoPath(repoArg);
  const profile = await initializeProject(repoPath);
  printJson(profile);
}
