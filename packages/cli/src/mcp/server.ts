import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { resolveRepoPath } from "@specweft/core";
import { readCliVersion } from "../package-info.js";
import { registerSpecWeftTools } from "./tools.js";

export async function startMcpServer(repoArg: string): Promise<void> {
  const repoPath = resolveRepoPath(repoArg);
  const server = new McpServer({
    name: "specweft",
    version: readCliVersion(),
  });

  registerSpecWeftTools(server, repoPath);

  // MCP stdio 模式要求 stdout 只用于协议消息，所以日志必须写 stderr。
  console.error(`SpecWeft MCP server started for ${repoPath}`);
  await server.connect(new StdioServerTransport());
}
