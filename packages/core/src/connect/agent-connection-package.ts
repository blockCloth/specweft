import type {
  AgentConnectionClient,
  AgentConnectionPackage,
  AgentConnectionStep,
  AgentHarnessFile,
  AgentHarnessResult,
  ProjectProfile,
} from "../schemas/types.js";
import { SPECWEFT_MCP_TOOL_NAMES } from "../mcp/tool-names.js";

type CreateAgentConnectionPackageInput = {
  repoPath: string;
  profile: ProjectProfile;
  harness: AgentHarnessResult;
  command: string;
  args: string[];
  codexToml?: string;
  claudeJson?: string;
  generatedAt?: string;
};

const PRIMARY_AGENT_TOOLS = [
  "specweft.bootstrap_session",
  "specweft.prepare_task",
  "specweft.recommend_skills_for_task",
  "specweft.get_skill_context_index",
  "specweft.read_skill_detail",
  "specweft.get_memory_digest",
  "specweft.get_requirement_dossier",
  "specweft.restore_requirement",
  "specweft.get_recording_status",
  "specweft.start_work_segment",
  "specweft.record_current_diff",
] as const;

// 这份接入包是 Web/CLI/MCP 共用的“说明书数据”，避免每个界面各写一套 Codex/Claude 引导文案。
export function createAgentConnectionPackage(input: CreateAgentConnectionPackageInput): AgentConnectionPackage {
  return {
    repoPath: input.repoPath,
    projectName: input.profile.name,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    server: {
      name: "specweft",
      transport: "stdio",
      command: input.command,
      args: input.args,
      toolCount: SPECWEFT_MCP_TOOL_NAMES.length,
    },
    clients: createConnectionClients(input),
    autoUseFlow: createAutoUseFlow(),
    requiredTools: [...PRIMARY_AGENT_TOOLS],
    verificationCommands: [
      "specweft doctor",
      "specweft mcp-inspect",
      "specweft start",
    ],
    notes: [
      "Skill 是默认主线：先推荐、再按需启用，不用把所有工具塞进上下文。",
      "Skill 正文默认懒加载：只有最新 skillContext.allowedSkillIds 允许且 selectionRevision 匹配时才读取。",
      "MCP 是高级增强：只有任务需要外部系统、浏览器、数据库或远程服务时再启用。",
      "本地 AGENTS.md / CLAUDE.md / 项目规范优先级高于市场 Skill。",
      "记忆默认走摘要入口；继续旧需求时只恢复对应需求线，避免上下文爆炸。",
      "修改后优先记录当前 diff，给用户返回“为什么改、改了什么、先看哪里”。",
    ],
  };
}

function createConnectionClients(input: CreateAgentConnectionPackageInput): AgentConnectionClient[] {
  const byClient = (client: AgentConnectionClient["client"]): AgentHarnessFile[] => (
    input.harness.files.filter((file) => file.client === client)
  );

  return [
    {
      client: "codex",
      label: "Codex",
      files: byClient("codex"),
      setupCommand: "specweft setup-codex",
      verificationCommands: ["specweft doctor", "specweft mcp-inspect"],
      configFormat: "toml",
      configSnippet: input.codexToml,
    },
    {
      client: "claude",
      label: "Claude",
      files: byClient("claude"),
      setupCommand: "specweft setup-claude",
      verificationCommands: ["specweft doctor", "specweft mcp-inspect"],
      configFormat: "json",
      configSnippet: input.claudeJson,
    },
    {
      client: "generic",
      label: "通用 Agent",
      files: byClient("generic"),
      setupCommand: "specweft init",
      verificationCommands: ["specweft doctor"],
      configFormat: "local-files",
    },
  ];
}

function createAutoUseFlow(): AgentConnectionStep[] {
  return [
    {
      phase: "打开项目",
      trigger: "新线程、新会话或切换到已初始化项目时",
      mcpTools: ["specweft.bootstrap_session"],
      userBenefit: "Agent 先拿到项目画像、配置、记忆摘要和工作流，不需要用户手动解释项目背景。",
    },
    {
      phase: "收到需求",
      trigger: "用户描述一个新功能、Bug、重构或代码讲解请求时",
      mcpTools: ["specweft.prepare_task", "specweft.recommend_skills_for_task", "specweft.read_skill_detail"],
      userBenefit: "把模糊需求补成目标、验收标准、相关文件和 Skill 推荐，只按需加载当前任务允许的 Skill。",
    },
    {
      phase: "继续旧需求",
      trigger: "用户提到之前的功能、旧线程、回滚、二次修改或关键词时",
      mcpTools: [
        "specweft.get_memory_digest",
        "specweft.get_requirement_dossier",
        "specweft.restore_requirement",
      ],
      userBenefit: "只恢复相关需求线，不把所有历史记忆塞进上下文。",
    },
    {
      phase: "修改前",
      trigger: "Agent 准备写文件、改代码或执行批量重构前",
      mcpTools: ["specweft.get_recording_status", "specweft.start_work_segment"],
      userBenefit: "给这次需求留下边界，多个需求混在暂存区时也能拆开解释。",
    },
    {
      phase: "修改后",
      trigger: "Agent 完成文件修改、准备回复用户前",
      mcpTools: ["specweft.record_current_diff"],
      userBenefit: "生成可读讲解和需求记忆，用户能快速知道为什么改、改了什么、先看哪里。",
    },
  ];
}
