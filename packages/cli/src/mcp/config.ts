import path from "node:path";
import { fileURLToPath } from "node:url";
export { SPECWEFT_MCP_TOOL_NAMES } from "@specweft/core";

export type SpecWeftMcpClientConfig = {
  mcpServers: {
    specweft: {
      command: string;
      args: string[];
    };
  };
};

export function createSpecWeftMcpClientConfig(repoPath: string): SpecWeftMcpClientConfig {
  return {
    mcpServers: {
      specweft: {
        command: "node",
        args: [resolveCliEntryPath(), "mcp", "--repo", repoPath],
      },
    },
  };
}

export function createCodexTomlSnippet(repoPath: string): string {
  const config = createSpecWeftMcpClientConfig(repoPath).mcpServers.specweft;

  return [
    "[mcp_servers.specweft]",
    `command = ${tomlString(config.command)}`,
    `args = [${config.args.map(tomlString).join(", ")}]`,
  ].join("\n");
}

export function createAgentWorkflowText(): string {
  return [
    "推荐工作流:",
    "1. 新线程开始时调用 specweft.bootstrap_session。",
    "2. 用户提出代码需求后，先调用 specweft.prepare_task。",
    "3. 如命中历史需求，只调用 specweft.restore_requirement 恢复相关记忆。",
    "4. 修改前用 prepare_task.guardrail.startWorkSegmentInput 调用 specweft.start_work_segment，给本次需求留下边界。",
    "5. 修改后用 prepare_task.guardrail.recordCurrentDiffInput 调用 specweft.record_current_diff，再用 agentReview.suggestedAgentResponse 回复用户。",
    "6. MCP/Skill 推荐只作为候选，遇到凭证、数据库、网络权限时必须让用户确认。",
  ].join("\n");
}

export function resolveCliEntryPath(): string {
  // dist/mcp/config.js -> dist/index.js
  const currentFile = fileURLToPath(import.meta.url);
  return path.resolve(path.dirname(currentFile), "..", "index.js");
}

function tomlString(value: string): string {
  return JSON.stringify(value);
}
