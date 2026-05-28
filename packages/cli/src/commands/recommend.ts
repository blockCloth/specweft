import { recommendForProject, resolveRepoPath, scanProject } from "@specweft/core";
import { printJson } from "../output.js";

// 读取项目画像，再根据本地规则推荐适合的 MCP 和 Skills。
export async function runRecommend(repoArg: string): Promise<void> {
  const repoPath = resolveRepoPath(repoArg);
  const profile = await scanProject(repoPath);
  const recommendations = await recommendForProject(profile, repoPath);
  printJson({
    project: profile,
    recommendations,
  });
}
