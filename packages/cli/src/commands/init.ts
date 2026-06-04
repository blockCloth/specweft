import { initializeSpecWeftProject, resolveRepoPath } from "@specweft/core";
import { printJson } from "../output.js";

// 初始化项目接入：项目画像、全局池、默认工具和 agent 指令一次落地。
export async function runInit(repoArg: string): Promise<void> {
  const repoPath = resolveRepoPath(repoArg);
  const result = await initializeSpecWeftProject(repoPath);

  printJson({
    repoPath: result.repoPath,
    project: result.profile.name,
    profilePath: `${result.repoPath}/.specweft/profile.json`,
    enabledMcps: result.enabled.mcps.map((item) => item.id),
    enabledSkills: result.enabled.skills.map((item) => item.id),
    instructionPaths: result.instructionPaths,
    bootstrapTool: "specweft.bootstrap_session",
    nextCommands: result.nextCommands,
  });
}
