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
    harnessFiles: result.harness.files.map((item) => item.path),
    harnessSkills: result.harness.skillNames,
    codexPrompts: result.harness.files
      .filter((item) => item.client === "codex" && item.kind === "prompt")
      .map((item) => item.name),
    claudeCommands: result.harness.files
      .filter((item) => item.client === "claude" && item.kind === "command")
      .map((item) => item.name),
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
    "已写入 Agent Harness：",
    ...output.harnessFiles.map((filePath) => `- ${filePath}`),
    "",
    `自动 Skills：${output.harnessSkills.join(", ") || "-"}`,
    `Codex Prompts：${output.codexPrompts.join(", ") || "-"}`,
    `Claude Commands：${output.claudeCommands.join(", ") || "-"}`,
    "",
    "下一步：",
    "1. 运行 specweft doctor 检查接入状态。",
    "2. 运行 specweft setup-codex 或 specweft setup-claude，复制 MCP 客户端配置。",
    "3. 打开 Codex/Claude 后，Agent 会通过项目 Skill/Command 模板调用 SpecWeft MCP 工具。",
    "4. 运行 specweft start 打开本地 Web 控制台。",
    "",
    "脚本需要 JSON 时可使用：specweft init --json",
  ].join("\n"));
}
