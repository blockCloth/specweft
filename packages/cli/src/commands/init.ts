import { initializeSpecWeftProject, resolveRepoPath } from "@specweft/core";
import { printJson, printText } from "../output.js";

// 初始化项目接入：项目画像、全局池、默认工具和 agent 指令一次落地。
export async function runInit(repoArg: string, asJson = false): Promise<void> {
  const repoPath = resolveRepoPath(repoArg);
  const result = await initializeSpecWeftProject(repoPath);
  const output = {
    repoPath: result.repoPath,
    project: result.profile.name,
    profilePath: `${result.repoPath}/.specweft/profile.json`,
    enabledMcps: result.enabled.mcps.map((item) => item.id),
    enabledSkills: result.enabled.skills.map((item) => item.id),
    instructionPaths: result.instructionPaths,
    bootstrapTool: "specweft.bootstrap_session",
    nextCommands: result.nextCommands,
  };

  if (asJson) {
    printJson(output);
    return;
  }

  printText([
    "SpecWeft 初始化完成",
    "",
    `项目：${output.project}`,
    `路径：${output.repoPath}`,
    `项目画像：${output.profilePath}`,
    `默认 MCP：${output.enabledMcps.join(", ") || "-"}`,
    `默认 Skills：${output.enabledSkills.join(", ") || "-"}`,
    "",
    "已写入 Agent 指令：",
    ...output.instructionPaths.map((filePath) => `- ${filePath}`),
    "",
    "下一步：",
    "1. 运行 specweft doctor 检查接入状态。",
    "2. 运行 specweft setup-codex 或 specweft setup-claude，复制 MCP 客户端配置。",
    "3. 运行 specweft start 打开本地 Web 控制台。",
    "4. 新线程里让 Agent 先调用 specweft.bootstrap_session。",
    "",
    "脚本需要 JSON 时可使用：specweft init --json",
  ].join("\n"));
}
