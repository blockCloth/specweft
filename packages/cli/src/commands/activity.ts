import {
  recordAgentActivity,
  type AgentActivityKind,
  type AgentActivityStatus,
} from "@specweft/core";

type CliActivityInput = {
  kind: AgentActivityKind;
  status?: AgentActivityStatus;
  title: string;
  summary: string;
  toolName?: string;
  requirementId?: string;
  requirementTitle?: string;
  target?: string;
  metadata?: Record<string, unknown>;
};

// CLI 活动记录只用于 Web 工作台和 Agent 解释轨迹，不能反过来影响命令本身。
export async function recordCliActivity(
  repoPath: string,
  input: CliActivityInput,
): Promise<void> {
  try {
    await recordAgentActivity(repoPath, {
      source: "cli",
      ...input,
    });
  } catch {
    // Activity logging is observational and must never break CLI commands.
  }
}
