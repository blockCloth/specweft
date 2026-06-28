import { createCapabilityCenter } from "../capabilities/capability-center.js";
import { createConnectionDoctorReport } from "../connect/connection-doctor.js";
import { createMemoryDigest } from "../memory/session-memory.js";
import { getRecordingStatus } from "../recording/recording-status.js";
import { scanProject } from "../scanner/project-scanner.js";
import { getMemoryProtectionStatus } from "../security/memory-protection.js";
import type {
  CapabilityManifest,
  ProjectReadiness,
  ProjectReadinessItem,
} from "../schemas/types.js";

export async function createProjectReadiness(repoPath: string): Promise<ProjectReadiness> {
  const profile = await scanProject(repoPath);
  const [
    connectionDoctor,
    capabilityCenter,
    recordingStatus,
    memoryDigest,
    memoryProtection,
  ] = await Promise.all([
    createConnectionDoctorReport(repoPath),
    createCapabilityCenter(profile, repoPath),
    getRecordingStatus(repoPath),
    createMemoryDigest(repoPath, profile),
    getMemoryProtectionStatus(repoPath),
  ]);

  const capabilities = capabilityCenter.capabilities || [];
  const enabledSkillCount = countCapabilities(capabilities, "skill", "enabled");
  const recommendedSkillCount = countCapabilities(capabilities, "skill", "recommended");
  const reviewReady = !recordingStatus.hasChanges || recordingStatus.isRecorded;
  const memoryReady = memoryDigest.totalMemories > 0 || memoryProtection.keyConfigured;

  const items: ProjectReadinessItem[] = [
    {
      id: "agent-connection",
      title: "Agent 接入",
      status: connectionDoctor.ready ? "ready" : "attention",
      summary: connectionDoctor.ready
        ? "Codex / Claude 可以通过 SpecWeft MCP 读取项目上下文。"
        : connectionDoctor.summary,
      action: connectionDoctor.ready ? "继续使用 Agent" : "打开接入配置并处理阻塞项",
      target: "connect",
      signals: [
        `${connectionDoctor.toolCount} 个 MCP 工具`,
        `${connectionDoctor.errors} 个阻塞项`,
        `${connectionDoctor.warnings} 个提醒项`,
      ],
      nextSteps: connectionDoctor.ready
        ? [
          "新线程开始时让 Agent 先读取启动上下文。",
          "收到需求后先准备任务，再进入代码修改。",
        ]
        : connectionDoctor.nextSteps.slice(0, 3),
      agentTools: [
        "specweft.bootstrap_session",
        "specweft.prepare_task",
      ],
      commands: [
        "specweft doctor",
        "specweft mcp-inspect",
      ],
      uiAction: {
        label: connectionDoctor.ready ? "查看接入流程" : "修复接入配置",
        target: "connect",
      },
    },
    {
      id: "skill-path",
      title: "Skill 主线",
      status: enabledSkillCount > 0 ? "ready" : "attention",
      summary: enabledSkillCount > 0
        ? "项目已启用 Skill，任务准备会优先参考。"
        : "建议先确认或启用推荐 Skill，让 Agent 有项目级工作规范。",
      action: enabledSkillCount > 0 ? "按需求继续推荐 Skill" : "打开能力中心确认 Skill",
      target: "tools",
      signals: [
        `${enabledSkillCount} 个已启用 Skill`,
        `${recommendedSkillCount} 个推荐 Skill`,
      ],
      nextSteps: enabledSkillCount > 0
        ? [
          "继续按任务语义推荐 Skill，不需要把所有 Skill 都塞进上下文。",
          "市场 Skill 只作为候选，启用前先看内容和冲突风险。",
        ]
        : [
          "打开能力中心查看推荐 Skill。",
          "先启用与当前项目语言和框架匹配的 Skill。",
          "本地 AGENTS/CLAUDE 规范优先级高于市场 Skill。",
        ],
      agentTools: [
        "specweft.recommend_skills_for_task",
        "specweft.apply_project_skill",
      ],
      commands: [
        "specweft recommend",
      ],
      uiAction: {
        label: enabledSkillCount > 0 ? "查看 Skill 装配" : "确认推荐 Skill",
        target: "tools",
      },
    },
    {
      id: "change-review",
      title: "修改讲解",
      status: reviewReady ? "ready" : "attention",
      summary: reviewReady
        ? "当前 diff 已记录或工作区没有未记录改动。"
        : "当前存在未记录改动，建议生成主链路讲解并写入需求记忆。",
      action: reviewReady ? "继续下一次需求" : "生成代码讲解",
      target: "review",
      signals: [
        recordingStatus.status,
        recordingStatus.reason,
      ],
      nextSteps: reviewReady
        ? [
          "下一次修改前先开启工作段边界。",
          "如果切换需求，先选择或创建对应需求线。",
        ]
        : [
          "先生成代码讲解，默认只看为什么改、怎么改和阅读入口。",
          "确认讲解属于当前需求后，再让 Agent 写入记忆。",
        ],
      agentTools: [
        "specweft.start_work_segment",
        "specweft.record_current_diff",
        "specweft.review_current_diff",
      ],
      commands: [
        "specweft review",
      ],
      uiAction: {
        label: reviewReady ? "查看最近讲解" : "生成代码讲解",
        target: "review",
        focusTarget: "reviewTitle",
      },
    },
    {
      id: "memory-entry",
      title: "记忆入口",
      status: memoryReady ? "ready" : "attention",
      summary: memoryReady
        ? "项目已有需求记忆或本地记忆保护策略。"
        : "还没有可恢复的需求记忆，完成一次记录后新线程才能召回。",
      action: memoryReady ? "按需求恢复记忆" : "完成一次 diff 记录",
      target: memoryReady ? "memory" : "review",
      signals: [
        `${memoryDigest.totalThreads} 条需求线`,
        `${memoryDigest.totalMemories} 条记忆`,
        memoryProtection.keyConfigured ? "记忆密钥已配置" : "记忆密钥未配置",
      ],
      nextSteps: memoryReady
        ? [
          "新线程先读取记忆摘要，不要加载全部历史。",
          "命中旧需求后只恢复对应需求线。",
        ]
        : [
          "完成一次需求修改并记录讲解。",
          "需要保护业务上下文时配置 SPECWEFT_MEMORY_KEY。",
        ],
      agentTools: [
        "specweft.get_memory_digest",
        "specweft.get_requirement_dossier",
        "specweft.restore_requirement",
      ],
      commands: memoryProtection.keyConfigured
        ? [
          "specweft recall",
        ]
        : [
          "specweft recall",
          "SPECWEFT_MEMORY_KEY=your-local-key specweft protect",
        ],
      uiAction: {
        label: memoryReady ? "恢复需求记忆" : "先记录一次修改",
        target: memoryReady ? "memory" : "review",
      },
    },
  ];
  const readyCount = items.filter((item) => item.status === "ready").length;
  const attentionCount = items.length - readyCount;

  return {
    repoPath,
    projectName: profile.name,
    generatedAt: new Date().toISOString(),
    score: Math.round((readyCount / items.length) * 100),
    readyCount,
    attentionCount,
    summary: attentionCount === 0
      ? "项目已准备好，可以让 Codex / Claude 按 SpecWeft 工作流继续开发。"
      : `还有 ${attentionCount} 个就绪项需要处理，建议先看标记为 attention 的项目。`,
    items,
  };
}

function countCapabilities(
  capabilities: CapabilityManifest[],
  kind: CapabilityManifest["kind"],
  status: CapabilityManifest["status"],
): number {
  return capabilities.filter((item) => item.kind === kind && item.status === status).length;
}
