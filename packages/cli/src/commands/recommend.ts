import { recommendForProject, resolveRepoPath, scanProject } from "@specweft/core";
import { printJson } from "../output.js";
import { recordCliActivity } from "./activity.js";

// 读取项目画像，再根据本地规则推荐适合的 MCP 和 Skills。
export async function runRecommend(repoArg: string): Promise<void> {
  const repoPath = resolveRepoPath(repoArg);
  const profile = await scanProject(repoPath);
  const recommendations = await recommendForProject(profile, repoPath);
  await recordCliActivity(repoPath, {
    kind: "recommend_tools",
    title: "推荐项目能力",
    summary: `CLI 已根据 ${profile.name} 的项目画像生成 MCP/Skill 推荐。`,
    toolName: "specweft recommend",
    metadata: {
      recommendations: recommendations.length,
      skills: recommendations.filter((item) => item.type === "skill").map((item) => item.id),
      mcps: recommendations.filter((item) => item.type === "mcp").map((item) => item.id),
    },
  });
  printJson({
    project: profile,
    recommendations,
  });
}
