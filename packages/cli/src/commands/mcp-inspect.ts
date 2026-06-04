import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveRepoPath } from "@specweft/core";
import { printJson } from "../output.js";

const MCP_TOOL_NAMES = [
  "specweft.bootstrap_session",
  "specweft.get_project_profile",
  "specweft.recommend_project_tools",
  "specweft.get_runtime_assembly",
  "specweft.review_current_diff",
  "specweft.save_session_memory",
  "specweft.recall_sessions",
  "specweft.create_memory_handoff",
  "specweft.recommend_marketplace_mcps",
  "specweft.install_marketplace_mcp",
  "specweft.recommend_marketplace_skills",
  "specweft.install_marketplace_skill",
  "specweft.apply_project_mcp",
  "specweft.apply_project_skill",
];

export async function runMcpInspect(repoArg: string): Promise<void> {
  const repoPath = resolveRepoPath(repoArg);
  const cliEntryPath = resolveCliEntryPath();

  printJson({
    server: "specweft",
    transport: "stdio",
    tools: MCP_TOOL_NAMES,
    clientConfig: {
      mcpServers: {
        specweft: {
          command: "node",
          args: [cliEntryPath, "mcp", "--repo", repoPath],
        },
      },
    },
  });
}

function resolveCliEntryPath(): string {
  // dist/commands/mcp-inspect.js -> dist/index.js
  const currentFile = fileURLToPath(import.meta.url);
  return path.resolve(path.dirname(currentFile), "..", "index.js");
}
