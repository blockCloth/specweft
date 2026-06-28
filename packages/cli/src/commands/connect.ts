import {
  createConnectionDoctorReport,
  resolveRepoPath,
  scanProject,
} from "@specweft/core";
import type { ConnectionDoctorCheck } from "@specweft/core";
import {
  createAgentWorkflowText,
  createCodexTomlSnippet,
  createSpecWeftMcpClientConfig,
  resolveCliEntryPath,
} from "../mcp/config.js";
import { printText } from "../output.js";

export async function runDoctor(repoArg: string): Promise<void> {
  const repoPath = resolveRepoPath(repoArg);
  const report = await createConnectionDoctorReport(repoPath, resolveCliEntryPath());

  printText([
    `SpecWeft Doctor`,
    ``,
    `项目: ${report.projectName}`,
    `路径: ${repoPath}`,
    `MCP 工具数: ${report.toolCount}`,
    ``,
    ...report.checks.map(formatCheck),
    ``,
    `结果: ${report.summary}`,
    report.warnings ? `提醒: ${report.warnings} 项不会阻塞接入，但建议处理。` : undefined,
    ``,
    "下一步建议:",
    ...report.nextSteps.map((step, index) => `${index + 1}. ${step}`),
  ].filter((line): line is string => line !== undefined).join("\n"));
}

export async function runSetupCodex(repoArg: string): Promise<void> {
  const repoPath = resolveRepoPath(repoArg);
  const profile = await scanProject(repoPath);

  printText([
    "SpecWeft Codex 接入",
    "",
    `项目: ${profile.name}`,
    `路径: ${repoPath}`,
    "",
    "把下面片段加入 Codex 的 MCP 配置中:",
    "",
    createCodexTomlSnippet(repoPath),
    "",
    createAgentWorkflowText(),
    "",
    "验证命令:",
    "specweft doctor",
    "specweft mcp-inspect",
  ].join("\n"));
}

export async function runSetupClaude(repoArg: string): Promise<void> {
  const repoPath = resolveRepoPath(repoArg);
  const profile = await scanProject(repoPath);

  printText([
    "SpecWeft Claude 接入",
    "",
    `项目: ${profile.name}`,
    `路径: ${repoPath}`,
    "",
    "把下面 JSON 合并到 Claude 的 MCP 配置中:",
    "",
    JSON.stringify(createSpecWeftMcpClientConfig(repoPath), null, 2),
    "",
    createAgentWorkflowText(),
    "",
    "验证命令:",
    "specweft doctor",
    "specweft mcp-inspect",
  ].join("\n"));
}

function formatCheck(check: ConnectionDoctorCheck): string {
  const status = check.ok ? "[OK]" : check.severity === "warn" ? "[提醒]" : "[需要处理]";
  const fix = check.ok || !check.fix ? "" : `\n    修复: ${check.fix}`;
  return `${status} ${check.label}: ${check.detail}${fix}`;
}
