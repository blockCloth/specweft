import { access, readFile } from "node:fs/promises";
import path from "node:path";
import {
  createMemoryDigest,
  createRuntimeAssembly,
  getMemoryProtectionStatus,
  getRecordingStatus,
  listRequirements,
  resolveRepoPath,
  scanProject,
} from "@specweft/core";
import {
  createAgentWorkflowText,
  createCodexTomlSnippet,
  createSpecWeftMcpClientConfig,
  resolveCliEntryPath,
  SPECWEFT_MCP_TOOL_NAMES,
} from "../mcp/config.js";
import { printText } from "../output.js";

type DoctorCheck = {
  label: string;
  ok: boolean;
  severity: "error" | "warn";
  detail: string;
  fix?: string;
};

const REQUIRED_AGENT_WORKFLOW_TOKENS = [
  "specweft.bootstrap_session",
  "specweft.prepare_task",
  "specweft.start_work_segment",
  "specweft.record_current_diff",
];

const REQUIRED_HARNESS_FILES = [
  ".agents/skills/specweft-prepare-task/SKILL.md",
  ".agents/skills/specweft-before-edit/SKILL.md",
  ".agents/skills/specweft-after-edit-review/SKILL.md",
  ".agents/skills/specweft-memory-restore/SKILL.md",
  ".codex/skills/specweft-prepare-task/SKILL.md",
  ".codex/skills/specweft-before-edit/SKILL.md",
  ".codex/skills/specweft-after-edit-review/SKILL.md",
  ".codex/skills/specweft-memory-restore/SKILL.md",
  ".codex/prompts/specweft-review.md",
  ".codex/prompts/specweft-continue.md",
  ".codex/prompts/specweft-restore.md",
  ".codex/prompts/specweft-finish.md",
  ".claude/skills/specweft-prepare-task/SKILL.md",
  ".claude/skills/specweft-before-edit/SKILL.md",
  ".claude/skills/specweft-after-edit-review/SKILL.md",
  ".claude/skills/specweft-memory-restore/SKILL.md",
  ".claude/commands/specweft/review.md",
  ".claude/commands/specweft/continue.md",
  ".claude/commands/specweft/restore.md",
  ".claude/commands/specweft/finish.md",
];

const REQUIRED_HARNESS_TOKENS = [
  "specweft.prepare_task",
  "specweft.restore_requirement",
  "specweft.start_work_segment",
  "specweft.record_current_diff",
];

export async function runDoctor(repoArg: string): Promise<void> {
  const repoPath = resolveRepoPath(repoArg);
  const profile = await scanProject(repoPath);
  const [assembly, requirements, recordingStatus, memoryDigest, memoryProtection] = await Promise.all([
    createRuntimeAssembly(repoPath),
    listRequirements(repoPath),
    getRecordingStatus(repoPath),
    createMemoryDigest(repoPath, profile),
    getMemoryProtectionStatus(repoPath),
  ]);
  const cliEntryPath = resolveCliEntryPath();
  const checks: DoctorCheck[] = [
    await checkFile("项目画像", path.join(repoPath, ".specweft", "profile.json"), "运行 specweft init"),
    await checkFile("记忆文件", path.join(repoPath, ".specweft", "memory.json"), "运行 specweft init"),
    await checkInstructionFile(
      "核心 Agent 指令",
      path.join(repoPath, ".specweft", "agent-instructions.md"),
      "error",
    ),
    await checkProjectInstructionFiles(repoPath),
    await checkAgentHarnessFiles(repoPath),
    await checkFile("CLI MCP 入口", cliEntryPath, "重新构建或重新安装 specweft"),
    {
      label: "项目 Skill 选择",
      ok: assembly.skills.length > 0,
      severity: "warn",
      detail: assembly.skills.length
        ? assembly.skills.map((item) => item.id).join(", ")
        : "当前项目未启用 Skill；不影响接入，但会减少任务建议质量",
      fix: "运行 specweft apply skill diff-explainer 或在 Web UI 能力中心启用",
    },
    {
      label: "项目 MCP 选择",
      ok: Object.keys(assembly.mcpServers).length > 0,
      severity: "warn",
      detail: Object.keys(assembly.mcpServers).length
        ? Object.keys(assembly.mcpServers).join(", ")
        : "当前项目未启用额外 MCP；SpecWeft MCP 仍然可用",
      fix: "只有任务需要外部系统时，再通过 Web UI 或 specweft apply mcp 启用",
    },
    {
      label: "需求记忆入口",
      ok: true,
      severity: "warn",
      detail: `${requirements.requirements.length} 条需求线，${memoryDigest.totalThreads} 条记忆入口`,
    },
    {
      label: "需求记忆保护",
      ok: memoryProtection.plaintextFiles === 0 && memoryProtection.protectedFiles > 0,
      severity: "warn",
      detail: memoryProtection.summary,
      fix: "export SPECWEFT_MEMORY_KEY=\"一段足够长的本地密钥\" && specweft protect",
    },
    {
      label: "当前 diff 记录",
      ok: recordingStatus.isRecorded,
      severity: "warn",
      detail: recordingStatus.reason,
      fix: "运行 specweft review --title \"本次修改说明\"",
    },
  ];
  const errors = checks.filter((check) => !check.ok && check.severity === "error");
  const warnings = checks.filter((check) => !check.ok && check.severity === "warn");

  printText([
    `SpecWeft Doctor`,
    ``,
    `项目: ${profile.name}`,
    `路径: ${repoPath}`,
    `MCP 工具数: ${SPECWEFT_MCP_TOOL_NAMES.length}`,
    ``,
    ...checks.map(formatCheck),
    ``,
    errors.length
      ? `结果: ${errors.length} 项阻塞接入。优先执行上面对应的修复命令。`
      : "结果: 接入状态正常，可以让 Codex/Claude 通过 MCP 使用 SpecWeft。",
    warnings.length ? `提醒: ${warnings.length} 项不会阻塞接入，但建议处理。` : undefined,
    ``,
    "下一步建议:",
    "1. 运行 specweft setup-codex 或 specweft setup-claude，复制对应 MCP 配置。",
    "2. 在客户端加入 specweft MCP 配置后，项目 Harness 会通过 Skills/Commands 引导 Agent 自动调用 SpecWeft。",
    "3. 每次改代码前由 Harness 调用 specweft.prepare_task，并用 guardrail.startWorkSegmentInput / guardrail.recordCurrentDiffInput 完成边界和记录。",
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

async function checkFile(label: string, filePath: string, fix: string): Promise<DoctorCheck> {
  const exists = await fileExists(filePath);

  return {
    label,
    ok: exists,
    severity: "error",
    detail: exists ? filePath : `缺失: ${filePath}`,
    fix,
  };
}

async function checkInstructionFile(
  label: string,
  filePath: string,
  severity: DoctorCheck["severity"] = "error",
): Promise<DoctorCheck> {
  try {
    const content = await readFile(filePath, "utf-8");
    const missingTokens = getMissingInstructionTokens(content);
    const ok = content.includes("<!-- SPECWEFT:START -->") && missingTokens.length === 0;

    return {
      label,
      ok,
      severity,
      detail: ok
        ? "已写入最新 SpecWeft Agent 指令"
        : createInstructionFailureDetail(content, missingTokens),
      fix: "运行 specweft init 重新写入指令",
    };
  } catch {
    return {
      label,
      ok: false,
      severity,
      detail: `缺失: ${filePath}`,
      fix: "运行 specweft init",
    };
  }
}

async function checkProjectInstructionFiles(repoPath: string): Promise<DoctorCheck> {
  const files = [
    path.join(repoPath, "AGENTS.md"),
    path.join(repoPath, "CLAUDE.md"),
  ];
  const results = await Promise.all(files.map((filePath) => readInstructionState(filePath)));
  const validFiles = results.filter((result) => result.valid).map((result) => path.basename(result.filePath));
  const existingFiles = results.filter((result) => result.exists).map((result) => path.basename(result.filePath));
  const outdatedFiles = results
    .filter((result) => result.exists && !result.valid && result.hasSpecWeftBlock)
    .map((result) => path.basename(result.filePath));

  if (validFiles.length > 0) {
    return {
      label: "项目 Agent 指令副本",
      ok: true,
      severity: "warn",
      detail: validFiles.join(", "),
    };
  }

  return {
    label: "项目 Agent 指令副本",
    ok: false,
    severity: "warn",
    detail: outdatedFiles.length
      ? `${outdatedFiles.join(", ")} 存在，但 SpecWeft 指令块不是最新工作流`
      : existingFiles.length
      ? `${existingFiles.join(", ")} 存在，但没有 SpecWeft 指令块`
      : "AGENTS.md / CLAUDE.md 都没有 SpecWeft 指令副本",
    fix: "运行 specweft init 重新写入指令副本",
  };
}

async function readInstructionState(filePath: string): Promise<{
  filePath: string;
  exists: boolean;
  hasSpecWeftBlock: boolean;
  valid: boolean;
}> {
  try {
    const content = await readFile(filePath, "utf-8");
    return {
      filePath,
      exists: true,
      hasSpecWeftBlock: content.includes("<!-- SPECWEFT:START -->"),
      valid: content.includes("<!-- SPECWEFT:START -->") && getMissingInstructionTokens(content).length === 0,
    };
  } catch {
    return {
      filePath,
      exists: false,
      hasSpecWeftBlock: false,
      valid: false,
    };
  }
}

async function checkAgentHarnessFiles(repoPath: string): Promise<DoctorCheck> {
  const states = await Promise.all(REQUIRED_HARNESS_FILES.map(async (relativePath) => {
    const filePath = path.join(repoPath, relativePath);

    try {
      const content = await readFile(filePath, "utf-8");
      return {
        relativePath,
        exists: true,
        valid: REQUIRED_HARNESS_TOKENS.some((token) => content.includes(token)),
      };
    } catch {
      return {
        relativePath,
        exists: false,
        valid: false,
      };
    }
  }));
  const missing = states.filter((state) => !state.exists).map((state) => state.relativePath);
  const outdated = states
    .filter((state) => state.exists && !state.valid)
    .map((state) => state.relativePath);

  if (missing.length === 0 && outdated.length === 0) {
    return {
      label: "Agent Harness",
      ok: true,
      severity: "warn",
      detail: `${states.length} 个 Skill/Command 模板已写入`,
    };
  }

  return {
    label: "Agent Harness",
    ok: false,
    severity: "warn",
    detail: [
      missing.length ? `缺失 ${missing.length} 个: ${missing.slice(0, 4).join(", ")}` : "",
      outdated.length ? `过旧 ${outdated.length} 个: ${outdated.slice(0, 4).join(", ")}` : "",
    ].filter(Boolean).join("；"),
    fix: "运行 specweft init 重新生成 Agent Harness",
  };
}

function getMissingInstructionTokens(content: string): string[] {
  return REQUIRED_AGENT_WORKFLOW_TOKENS.filter((token) => !content.includes(token));
}

function createInstructionFailureDetail(content: string, missingTokens: string[]): string {
  if (!content.includes("<!-- SPECWEFT:START -->")) {
    return "文件存在，但没有 SpecWeft Agent 指令块";
  }

  return `SpecWeft Agent 指令块不是最新工作流，缺少: ${missingTokens.join(", ")}`;
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function formatCheck(check: DoctorCheck): string {
  const status = check.ok ? "[OK]" : check.severity === "warn" ? "[提醒]" : "[需要处理]";
  const fix = check.ok || !check.fix ? "" : `\n    修复: ${check.fix}`;
  return `${status} ${check.label}: ${check.detail}${fix}`;
}
