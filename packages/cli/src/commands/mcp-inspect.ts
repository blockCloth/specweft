import { resolveRepoPath, scanProject } from "@specweft/core";
import {
  createAgentWorkflowText,
  createCodexTomlSnippet,
  createSpecWeftMcpClientConfig,
  SPECWEFT_MCP_TOOL_NAMES,
} from "../mcp/config.js";
import { printJson, printText } from "../output.js";

export async function runMcpInspect(repoArg: string, json = false): Promise<void> {
  const repoPath = resolveRepoPath(repoArg);
  const clientConfig = createSpecWeftMcpClientConfig(repoPath);
  const codexToml = createCodexTomlSnippet(repoPath);
  const claudeJson = JSON.stringify(clientConfig, null, 2);
  const inspect = {
    server: "specweft",
    transport: "stdio",
    tools: SPECWEFT_MCP_TOOL_NAMES,
    clientConfig,
    codexToml,
    claudeJson,
    workflow: createAgentWorkflowText(),
  };

  if (json) {
    printJson(inspect);
    return;
  }

  const profile = await scanProject(repoPath);

  printText([
    "SpecWeft MCP Inspect",
    "",
    `项目: ${profile.name}`,
    `路径: ${repoPath}`,
    `服务: ${inspect.server}`,
    `传输: ${inspect.transport}`,
    `工具数: ${inspect.tools.length}`,
    "",
    "Codex MCP 配置:",
    codexToml,
    "",
    "Claude MCP 配置:",
    claudeJson,
    "",
    "暴露的 MCP 工具:",
    ...inspect.tools.map((tool) => `- ${tool}`),
    "",
    createAgentWorkflowText(),
    "",
    "需要机器可读输出时运行: specweft mcp-inspect --json",
  ].join("\n"));
}
