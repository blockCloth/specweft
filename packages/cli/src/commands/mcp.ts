import { startMcpServer } from "../mcp/server.js";

export async function runMcp(repoArg: string): Promise<void> {
  await startMcpServer(repoArg);
}
