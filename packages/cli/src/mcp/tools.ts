import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  analyzeCurrentDiff,
  applyProjectMcp,
  applyProjectSkill,
  checkMarketplaceSkillUpdates,
  createAgentReviewPacket,
  createBootstrapSession,
  createCapabilityCenter,
  createMemoryDigest,
  createMemoryTimeline,
  createProjectReadiness,
  createRequirementDossier,
  createReviewDraft,
  createReviewReport,
  createMemoryHandoff,
  createRuntimeAssembly,
  createSkillContextIndex,
  getActiveRequirement,
  getRecordingStatus,
  installMarketplaceMcp,
  installMarketplaceSkill,
  createMemoryIndex,
  createWorkSegmentStatus,
  getActiveWorkSegment,
  listRequirements,
  prepareTask,
  readAgentActivity,
  readProjectSettings,
  recommendForProject,
  recommendSkillsForTask,
  recommendMarketplaceMcps,
  recommendMarketplaceSkills,
  recallSessions,
  recordAgentActivity,
  resolveRepoPath,
  readSkillDetailForContext,
  saveSessionMemory,
  scanProject,
  startWorkSegment,
  completeWorkSegment,
  restoreRequirementMemory,
  updateProjectSettings,
} from "@specweft/core";
import type { DiffSummary, ProjectSettingsPatch, RequirementRecord } from "@specweft/core";
import { z } from "zod";

const RepoInput = {
  repoPath: z.string().optional().describe("Repository path. Defaults to the repo passed to specweft mcp."),
};

const AgentActivityInput = {
  repoPath: z.string().optional().describe("Repository path. Defaults to the repo passed to specweft mcp."),
  limit: z.number().int().min(1).max(100).optional().describe("Maximum recent activity events to return."),
};

const ProjectSettingsInput = {
  repoPath: z.string().optional().describe("Repository path. Defaults to the repo passed to specweft mcp."),
  changeRecording: z.object({
    autoRecordDiff: z.boolean().optional(),
    autoLinkRequirement: z.boolean().optional(),
    retentionDays: z.number().int().min(1).max(365).optional(),
  }).optional(),
  contextMemory: z.object({
    maxRetainedTurns: z.number().int().min(1).max(200).optional(),
    compressionStrategy: z.enum(["summary", "sliding-window", "none"]).optional(),
    ignorePaths: z.array(z.string()).optional(),
  }).optional(),
  capabilities: z.object({
    skillRegistryUrl: z.string().url().optional(),
    autoCheckSkillUpdates: z.boolean().optional(),
    mcpStdioTimeoutMs: z.number().int().min(1000).max(120000).optional(),
  }).optional(),
};

const PrepareTaskInput = {
  repoPath: z.string().optional().describe("Repository path. Defaults to the repo passed to specweft mcp."),
  task: z.string().describe("The user's natural language coding request."),
};

const SkillDetailInput = {
  repoPath: z.string().optional().describe("Repository path. Defaults to the repo passed to specweft mcp."),
  skillId: z.string().describe("Skill id returned by specweft.prepare_task or specweft.get_skill_context_index."),
  selectionRevision: z.string().optional().describe("Selection revision returned by the latest prepare_task skillContext."),
};

const RestoreRequirementInput = {
  repoPath: z.string().optional().describe("Repository path. Defaults to the repo passed to specweft mcp."),
  keyword: z.string().optional().describe("Optional keyword used to restore a requirement memory."),
  requirementId: z.string().optional().describe("Optional requirement id to restore."),
  limit: z.number().int().min(1).max(10).optional().describe("Maximum sessions included in the restored handoff."),
};

const RecallInput = {
  repoPath: z.string().optional().describe("Repository path. Defaults to the repo passed to specweft mcp."),
  keyword: z.string().describe("Keyword used to search recent SpecWeft session memories."),
  requirementId: z.string().optional().describe("Optional requirement id used to narrow memory recall."),
};

const DossierInput = {
  repoPath: z.string().optional().describe("Repository path. Defaults to the repo passed to specweft mcp."),
  includeSessions: z.boolean().optional().describe("Include full session details. Defaults to false to keep context compact."),
  sessionPreviewLimit: z.number().int().min(0).max(10).optional().describe("Number of recent sessions to include per requirement when includeSessions is false."),
};

const HandoffInput = {
  repoPath: z.string().optional().describe("Repository path. Defaults to the repo passed to specweft mcp."),
  keyword: z.string().optional().describe("Optional keyword used to recover a specific recent requirement thread."),
  requirementId: z.string().optional().describe("Optional requirement id used to narrow the handoff."),
  limit: z.number().int().min(1).max(10).optional().describe("Maximum memory sessions included in the handoff prompt."),
};

const SaveMemoryInput = {
  repoPath: z.string().optional().describe("Repository path. Defaults to the repo passed to specweft mcp."),
  title: z.string().describe("Short title for this coding session or requirement."),
  requirementId: z.string().optional().describe("Optional requirement id this memory belongs to."),
  summary: z.string().describe("Human-readable summary of what changed and why."),
  keywords: z.array(z.string()).optional().describe("Search keywords for future recall."),
  changedFiles: z.array(z.string()).optional().describe("Files touched by this session."),
};

const RecordCurrentDiffInput = {
  repoPath: z.string().optional().describe("Repository path. Defaults to the repo passed to specweft mcp."),
  title: z.string().optional().describe("Short title for the generated review and memory."),
  requirementId: z.string().optional().describe("Optional requirement id this review belongs to."),
};

const StartWorkSegmentInput = {
  repoPath: z.string().optional().describe("Repository path. Defaults to the repo passed to specweft mcp."),
  task: z.string().describe("The current user request or coding task that is about to be edited."),
  title: z.string().optional().describe("Optional short title for this work segment."),
  requirementId: z.string().optional().describe("Optional requirement id this work segment belongs to."),
};

const CompleteWorkSegmentInput = {
  repoPath: z.string().optional().describe("Repository path. Defaults to the repo passed to specweft mcp."),
  segmentId: z.string().optional().describe("Optional work segment id. Defaults to the active segment."),
  status: z.enum(["recorded", "interrupted", "abandoned"]).optional().describe("Completion status. Defaults to recorded."),
  title: z.string().optional().describe("Optional final title."),
  summary: z.string().optional().describe("Optional final summary."),
};

const ApplyInput = {
  repoPath: z.string().optional().describe("Repository path. Defaults to the repo passed to specweft mcp."),
  id: z.string().describe("MCP or Skill id from the global SpecWeft pool."),
};

const MarketplaceSearchInput = {
  repoPath: z.string().optional().describe("Repository path. Defaults to the repo passed to specweft mcp."),
  keyword: z.string().optional().describe("Optional keyword used to search marketplace Skills."),
};

const MarketplaceMcpSearchInput = {
  repoPath: z.string().optional().describe("Repository path. Defaults to the repo passed to specweft mcp."),
  keyword: z.string().optional().describe("Optional keyword used to search marketplace MCP servers."),
  requirement: z.string().optional().describe("Optional natural language requirement used for semantic MCP recommendation."),
};

const MarketplaceMcpInput = {
  repoPath: z.string().optional().describe("Repository path. Defaults to the repo passed to specweft mcp."),
  mcp: z.object({
    id: z.string(),
    name: z.string(),
    author: z.string(),
    description: z.string(),
    githubUrl: z.string().optional(),
    homepageUrl: z.string().optional(),
    stars: z.number(),
    forks: z.number(),
    updatedAt: z.string(),
    packageName: z.string().optional(),
    runtime: z.enum(["stdio", "remote"]),
    url: z.string().optional(),
    envVars: z.array(z.string()),
    permissions: z.array(z.string()),
    tags: z.array(z.string()),
    keyword: z.string(),
    relevance: z.number(),
    installable: z.boolean(),
    risk: z.enum(["low", "medium", "high"]),
    riskReasons: z.array(z.string()),
    suggestedManifest: z.object({
      id: z.string(),
      name: z.string(),
      description: z.string(),
      runtime: z.enum(["stdio", "remote"]),
      launch: z.object({
        command: z.string(),
        args: z.array(z.string()),
      }).optional(),
      url: z.string().optional(),
      env: z.array(z.string()).optional(),
      headers: z.record(z.string(), z.string()).optional(),
      permissions: z.array(z.string()),
      risk: z.enum(["low", "medium", "high"]),
      tags: z.array(z.string()),
    }).optional(),
  }).describe("Marketplace MCP candidate returned by specweft.recommend_marketplace_mcps."),
};

const MarketplaceSkillInput = {
  repoPath: z.string().optional().describe("Repository path. Defaults to the repo passed to specweft mcp."),
  skill: z.object({
    id: z.string(),
    name: z.string(),
    author: z.string(),
    authorAvatar: z.string().optional(),
    description: z.string(),
    githubUrl: z.string(),
    stars: z.number(),
    forks: z.number(),
    updatedAt: z.string(),
    path: z.string(),
    branch: z.string(),
  }).describe("Marketplace Skill object returned by specweft.recommend_marketplace_skills."),
};

export function registerSpecWeftTools(server: McpServer, defaultRepoPath: string): void {
  server.registerTool(
    "specweft.prepare_task",
    {
      title: "Prepare task context",
      description: "Use before planning or editing code. Clarifies the request, points to likely files, recommends Skills, and returns matching memory without filling the whole context.",
      inputSchema: PrepareTaskInput,
    },
    async ({ repoPath, task }) => {
      const resolvedRepoPath = resolveToolRepoPath(defaultRepoPath, repoPath);
      const prepared = await prepareTask(resolvedRepoPath, task);
      await recordMcpActivity(resolvedRepoPath, {
        kind: "prepare_task",
        title: "准备任务上下文",
        summary: prepared.requirement.clarifiedGoal,
        toolName: "specweft.prepare_task",
        requirementId: prepared.matchedRequirement?.requirementId,
        requirementTitle: prepared.matchedRequirement?.title,
        metadata: {
          codePointers: prepared.codePointers.length,
          skillSuggestions: prepared.skillSuggestions.length,
          memorySuggestions: prepared.memorySuggestions.length,
          confidence: prepared.taskAnalysis.confidence,
        },
      });
      return jsonToolResult(prepared);
    },
  );

  server.registerTool(
    "specweft.get_memory_index",
    {
      title: "Get memory index",
      description: "Return the lightweight SpecWeft memory index. Use this as a table of contents before restoring full requirement memory.",
      inputSchema: RepoInput,
    },
    async ({ repoPath }) => {
      const resolvedRepoPath = resolveToolRepoPath(defaultRepoPath, repoPath);
      const profile = await scanProject(resolvedRepoPath);
      return jsonToolResult(await createMemoryIndex(resolvedRepoPath, profile));
    },
  );

  server.registerTool(
    "specweft.get_memory_digest",
    {
      title: "Get memory digest",
      description: "Return requirement-grouped memory summaries. Use this as the first long-term memory entry point, then restore only the relevant requirement.",
      inputSchema: RepoInput,
    },
    async ({ repoPath }) => {
      const resolvedRepoPath = resolveToolRepoPath(defaultRepoPath, repoPath);
      const profile = await scanProject(resolvedRepoPath);
      return jsonToolResult(await createMemoryDigest(resolvedRepoPath, profile));
    },
  );

  server.registerTool(
    "specweft.restore_requirement",
    {
      title: "Restore requirement memory",
      description: "Restore the full memory handoff for a requirement or keyword after specweft.prepare_task or specweft.get_memory_index indicates it is relevant.",
      inputSchema: RestoreRequirementInput,
    },
    async ({ repoPath, keyword, requirementId, limit }) => {
      const resolvedRepoPath = resolveToolRepoPath(defaultRepoPath, repoPath);
      const profile = await scanProject(resolvedRepoPath);
      const requirement = requirementId?.trim()
        ? await resolveToolRequirement(resolvedRepoPath, requirementId)
        : undefined;
      const restored = await restoreRequirementMemory(resolvedRepoPath, profile, {
        keyword,
        requirement,
        limit,
      });
      await recordMcpActivity(resolvedRepoPath, {
        kind: "restore_requirement",
        title: "恢复需求记忆",
        summary: restored.summary,
        toolName: "specweft.restore_requirement",
        requirementId: restored.requirement?.id,
        requirementTitle: restored.requirement?.title,
        target: keyword,
        metadata: {
          sessions: restored.sessions.length,
          compression: Boolean(restored.compression),
        },
      });
      return jsonToolResult(restored);
    },
  );

  server.registerTool(
    "specweft.recommend_skills_for_task",
    {
      title: "Recommend Skills for task",
      description: "Recommend enabled or available Skills for the current natural language task. Prefer this over generic project-level tool recommendations while planning edits.",
      inputSchema: PrepareTaskInput,
    },
    async ({ repoPath, task }) => {
      const resolvedRepoPath = resolveToolRepoPath(defaultRepoPath, repoPath);
      const profile = await scanProject(resolvedRepoPath);
      const skillSuggestions = await recommendSkillsForTask(profile, resolvedRepoPath, task);
      await recordMcpActivity(resolvedRepoPath, {
        kind: "recommend_skills",
        title: "按需求推荐 Skill",
        summary: "SpecWeft 已根据当前任务语义和本地 Skill 池生成候选。",
        toolName: "specweft.recommend_skills_for_task",
        metadata: {
          suggestions: skillSuggestions.length,
        },
      });
      return jsonToolResult({ profile, skillSuggestions });
    },
  );

  server.registerTool(
    "specweft.get_skill_context_index",
    {
      title: "Get Skill context index",
      description: "Return the current lightweight Skill context index. It contains metadata, selection revision, and lazy-load rules, but never full SKILL.md content.",
      inputSchema: RepoInput,
    },
    async ({ repoPath }) => {
      const resolvedRepoPath = resolveToolRepoPath(defaultRepoPath, repoPath);
      return jsonToolResult(await createSkillContextIndex(resolvedRepoPath, {
        scope: "enabled",
      }));
    },
  );

  server.registerTool(
    "specweft.read_skill_detail",
    {
      title: "Read Skill detail lazily",
      description: "Read a full SKILL.md only when the latest prepare_task skillContext allows it. If the selection revision changed, the old Skill context is stale and no content is returned.",
      inputSchema: SkillDetailInput,
    },
    async ({ repoPath, skillId, selectionRevision }) => {
      const resolvedRepoPath = resolveToolRepoPath(defaultRepoPath, repoPath);
      return jsonToolResult(await readSkillDetailForContext(
        resolvedRepoPath,
        skillId,
        selectionRevision,
      ));
    },
  );

  server.registerTool(
    "specweft.bootstrap_session",
    {
      title: "Bootstrap SpecWeft session",
      description: "Return the project profile, selected runtime assembly, recommendations, recent memory handoff, and workflow instructions for a new coding-agent session.",
      inputSchema: HandoffInput,
    },
    async ({ repoPath, keyword, limit }) => {
      const resolvedRepoPath = resolveToolRepoPath(defaultRepoPath, repoPath);
      const bootstrap = await createBootstrapSession(resolvedRepoPath, keyword, limit);
      await recordMcpActivity(resolvedRepoPath, {
        kind: "bootstrap_session",
        title: "读取 Agent 启动上下文",
        summary: "已向 Agent 返回项目画像、能力装配、记忆摘要和调用顺序。",
        toolName: "specweft.bootstrap_session",
        target: keyword,
        metadata: {
          capabilityCount: bootstrap.capabilityCenter.summary.total,
          memoryCount: bootstrap.memoryDigest.totalMemories,
        },
      });
      return jsonToolResult({ bootstrap });
    },
  );

  server.registerTool(
    "specweft.get_project_profile",
    {
      title: "Get project profile",
      description: "Scan the project and return its SpecWeft project profile.",
      inputSchema: RepoInput,
    },
    async ({ repoPath }) => {
      const profile = await scanProject(resolveToolRepoPath(defaultRepoPath, repoPath));
      return jsonToolResult(profile);
    },
  );

  server.registerTool(
    "specweft.get_project_readiness",
    {
      title: "Get project readiness",
      description: "Return a compact readiness checklist for Agent connection, Skill path, change review, and memory entry. Use this before deciding the next SpecWeft action in a project.",
      inputSchema: RepoInput,
    },
    async ({ repoPath }) => {
      const resolvedRepoPath = resolveToolRepoPath(defaultRepoPath, repoPath);
      return jsonToolResult(await createProjectReadiness(resolvedRepoPath));
    },
  );

  server.registerTool(
    "specweft.get_project_settings",
    {
      title: "Get project settings",
      description: "Return the project-level SpecWeft settings that control recording, memory compression, ignored paths, Skill registry, and MCP timeouts.",
      inputSchema: RepoInput,
    },
    async ({ repoPath }) => {
      const resolvedRepoPath = resolveToolRepoPath(defaultRepoPath, repoPath);
      return jsonToolResult(await readProjectSettings(resolvedRepoPath));
    },
  );

  server.registerTool(
    "specweft.update_project_settings",
    {
      title: "Update project settings",
      description: "Update SpecWeft project settings. Use sparingly; local repository rules remain higher priority than marketplace Skills.",
      inputSchema: ProjectSettingsInput,
    },
    async ({ repoPath, changeRecording, contextMemory, capabilities }) => {
      const resolvedRepoPath = resolveToolRepoPath(defaultRepoPath, repoPath);
      const patch: ProjectSettingsPatch = {
        changeRecording,
        contextMemory,
        capabilities,
      };
      const settings = await updateProjectSettings(resolvedRepoPath, patch);
      await recordMcpActivity(resolvedRepoPath, {
        kind: "settings_updated",
        title: "更新项目配置",
        summary: "Agent 已更新 SpecWeft 项目级策略。",
        toolName: "specweft.update_project_settings",
        target: ".specweft/settings.json",
      });
      return jsonToolResult(settings);
    },
  );

  server.registerTool(
    "specweft.get_agent_activity",
    {
      title: "Get agent activity",
      description: "Return recent SpecWeft activity events so an agent can explain what context, memory, Skills, and reviews were touched in this project.",
      inputSchema: AgentActivityInput,
    },
    async ({ repoPath, limit }) => {
      const resolvedRepoPath = resolveToolRepoPath(defaultRepoPath, repoPath);
      return jsonToolResult(await readAgentActivity(resolvedRepoPath, limit));
    },
  );

  server.registerTool(
    "specweft.recommend_project_tools",
    {
      title: "Recommend project tools",
      description: "Recommend MCP servers and Skills for the current project profile.",
      inputSchema: RepoInput,
    },
    async ({ repoPath }) => {
      const resolvedRepoPath = resolveToolRepoPath(defaultRepoPath, repoPath);
      const profile = await scanProject(resolvedRepoPath);
      const recommendations = await recommendForProject(profile, resolvedRepoPath);
      await recordMcpActivity(resolvedRepoPath, {
        kind: "recommend_tools",
        title: "刷新项目能力推荐",
        summary: "SpecWeft 已根据项目画像刷新 MCP、Skill 和 CLI 能力候选。",
        toolName: "specweft.recommend_project_tools",
        metadata: {
          recommendations: recommendations.length,
        },
      });
      return jsonToolResult({ profile, recommendations });
    },
  );

  server.registerTool(
    "specweft.get_capability_center",
    {
      title: "Get capability center",
      description: "Return SpecWeft's unified MCP, Skill, and CLI capability recommendations with risk, permissions, and status for the current project.",
      inputSchema: RepoInput,
    },
    async ({ repoPath }) => {
      const resolvedRepoPath = resolveToolRepoPath(defaultRepoPath, repoPath);
      const profile = await scanProject(resolvedRepoPath);
      const capabilityCenter = await createCapabilityCenter(profile, resolvedRepoPath);
      return jsonToolResult({ capabilityCenter });
    },
  );

  server.registerTool(
    "specweft.get_runtime_assembly",
    {
      title: "Get runtime assembly",
      description: "Return the MCP servers and Skills selected for the current project.",
      inputSchema: RepoInput,
    },
    async ({ repoPath }) => {
      const assembly = await createRuntimeAssembly(
        resolveToolRepoPath(defaultRepoPath, repoPath),
      );
      return jsonToolResult(assembly);
    },
  );

  server.registerTool(
    "specweft.get_recording_status",
    {
      title: "Get recording status",
      description: "Return whether the current git diff has already been recorded as a SpecWeft review/memory.",
      inputSchema: RepoInput,
    },
    async ({ repoPath }) => {
      const resolvedRepoPath = resolveToolRepoPath(defaultRepoPath, repoPath);
      return jsonToolResult(await getRecordingStatus(resolvedRepoPath));
    },
  );

  server.registerTool(
    "specweft.start_work_segment",
    {
      title: "Start work segment",
      description: "Call before editing a user request. It records a lightweight git boundary so later review can separate this task from older uncommitted changes.",
      inputSchema: StartWorkSegmentInput,
    },
    async ({ repoPath, task, title, requirementId }) => {
      const resolvedRepoPath = resolveToolRepoPath(defaultRepoPath, repoPath);
      const profile = await scanProject(resolvedRepoPath);
      const requirement = requirementId?.trim()
        ? await resolveToolRequirement(resolvedRepoPath, requirementId)
        : await getActiveRequirement(resolvedRepoPath);
      const segmentResult = await startWorkSegment(resolvedRepoPath, {
        projectId: profile.id,
        task,
        title,
        requirement,
      });
      const { segment } = segmentResult;
      await recordMcpActivity(resolvedRepoPath, {
        kind: "start_work_segment",
        title: "开启工作段",
        summary: segment.task,
        toolName: "specweft.start_work_segment",
        requirementId: segment.requirementId,
        requirementTitle: segment.requirementTitle,
        target: segment.id,
        metadata: {
          baselineFiles: segment.baselineChangedFiles.length,
          currentFiles: segment.currentChangedFiles.length,
        },
      });
      return jsonToolResult(segmentResult);
    },
  );

  server.registerTool(
    "specweft.get_work_segment_status",
    {
      title: "Get work segment status",
      description: "Return active and recent SpecWeft work segments. Use this when several requirements may be mixed in one uncommitted diff.",
      inputSchema: RepoInput,
    },
    async ({ repoPath }) => {
      const resolvedRepoPath = resolveToolRepoPath(defaultRepoPath, repoPath);
      const profile = await scanProject(resolvedRepoPath);
      return jsonToolResult(await createWorkSegmentStatus(resolvedRepoPath, profile));
    },
  );

  server.registerTool(
    "specweft.complete_work_segment",
    {
      title: "Complete work segment",
      description: "Finish the active lightweight work segment without creating a review. Usually specweft.record_current_diff does this automatically.",
      inputSchema: CompleteWorkSegmentInput,
    },
    async ({ repoPath, segmentId, status, title, summary }) => {
      const resolvedRepoPath = resolveToolRepoPath(defaultRepoPath, repoPath);
      const segment = await completeWorkSegment(resolvedRepoPath, {
        segmentId,
        status,
        title,
        summary,
      });
      if (!segment) {
        return jsonToolResult({
          error: "No active work segment was found.",
        });
      }
      await recordMcpActivity(resolvedRepoPath, {
        kind: "complete_work_segment",
        title: "完成工作段",
        summary: segment.summary || segment.task,
        toolName: "specweft.complete_work_segment",
        status: segment.status === "recorded" ? "success" : "attention",
        requirementId: segment.requirementId,
        requirementTitle: segment.requirementTitle,
        target: segment.id,
      });
      return jsonToolResult({
        segment,
      });
    },
  );

  server.registerTool(
    "specweft.get_memory_timeline",
    {
      title: "Get memory timeline",
      description: "Return requirement-scoped SpecWeft memories grouped into a timeline with current/stale/reverted status counts.",
      inputSchema: RepoInput,
    },
    async ({ repoPath }) => {
      const resolvedRepoPath = resolveToolRepoPath(defaultRepoPath, repoPath);
      const profile = await scanProject(resolvedRepoPath);
      return jsonToolResult(await createMemoryTimeline(resolvedRepoPath, profile));
    },
  );

  server.registerTool(
    "specweft.get_requirement_dossier",
    {
      title: "Get requirement dossier",
      description: "Return compact requirement dossiers that group repeated reviews, key files, code status, and restore hints. Use includeSessions only when full history is needed.",
      inputSchema: DossierInput,
    },
    async ({ repoPath, includeSessions, sessionPreviewLimit }) => {
      const resolvedRepoPath = resolveToolRepoPath(defaultRepoPath, repoPath);
      const profile = await scanProject(resolvedRepoPath);
      return jsonToolResult(await createRequirementDossier(resolvedRepoPath, profile, {
        includeSessions,
        sessionPreviewLimit: includeSessions ? undefined : sessionPreviewLimit,
      }));
    },
  );

  server.registerTool(
    "specweft.review_current_diff",
    {
      title: "Review current diff",
      description: "Analyze the current git diff and return a review draft.",
      inputSchema: RepoInput,
    },
    async ({ repoPath }) => {
      const resolvedRepoPath = resolveToolRepoPath(defaultRepoPath, repoPath);
      const diff = await analyzeCurrentDiff(resolvedRepoPath);
      const profile = await scanProject(resolvedRepoPath);
      const [requirements, memoryDigest, activeWorkSegment] = await Promise.all([
        listRequirements(resolvedRepoPath),
        createMemoryDigest(resolvedRepoPath, profile),
        getActiveWorkSegment(resolvedRepoPath),
      ]);
      const review = createReviewDraft(diff, {
        title: "当前 diff 临时讲解",
        requirements: requirements.requirements,
        activeRequirementId: requirements.activeRequirementId,
        memoryDigest,
        activeWorkSegment,
      });
      const agentReview = createAgentReviewPacket({
        title: "当前 diff 临时讲解",
        review,
        diff,
        requirement: requirements.requirements.find((item) => item.id === requirements.activeRequirementId),
      });
      return jsonToolResult({
        diff: createCompactDiffSummary(diff),
        activeWorkSegment,
        agentReview,
        advancedReview: review,
        note: "Use agentReview first. Full patch text is intentionally omitted from MCP output; inspect sourceReading paths only when exact hunks are needed.",
      });
    },
  );

  server.registerTool(
    "specweft.record_current_diff",
    {
      title: "Record current diff",
      description: "Create a persistent SpecWeft review report and memory for the current git diff. Use this after Codex or Claude changes code.",
      inputSchema: RecordCurrentDiffInput,
    },
    async ({ repoPath, title, requirementId }) => {
      const resolvedRepoPath = resolveToolRepoPath(defaultRepoPath, repoPath);
      const profile = await scanProject(resolvedRepoPath);
      const report = await createReviewReport(resolvedRepoPath, profile, title, undefined, requirementId);
      const diff = await analyzeCurrentDiff(resolvedRepoPath);
      const agentReview = createAgentReviewPacket({
        title: report.title,
        review: report.review,
        diff,
        requirement: report.requirement,
        reportPath: report.reportPath,
      });
      await recordMcpActivity(resolvedRepoPath, {
        kind: "record_current_diff",
        title: "记录当前 diff",
        summary: report.memory.summary,
        toolName: "specweft.record_current_diff",
        requirementId: report.requirement?.id,
        requirementTitle: report.requirement?.title,
        target: report.reportPath,
        metadata: {
          changedFiles: diff.changedFiles.length,
          additions: diff.stats.additions,
          deletions: diff.stats.deletions,
        },
      });
      return jsonToolResult({
        title: report.title,
        reportPath: report.reportPath,
        memory: report.memory,
        requirement: report.requirement,
        agentReview,
        advancedReview: report.review,
      });
    },
  );

  server.registerTool(
    "specweft.save_session_memory",
    {
      title: "Save session memory",
      description: "Save a concise coding session memory for cross-thread recall.",
      inputSchema: SaveMemoryInput,
    },
    async ({ repoPath, title, requirementId, summary, keywords, changedFiles }) => {
      const resolvedRepoPath = resolveToolRepoPath(defaultRepoPath, repoPath);
      const profile = await scanProject(resolvedRepoPath);
      const requirement = await resolveToolRequirement(resolvedRepoPath, requirementId);
      const memory = await saveSessionMemory(resolvedRepoPath, {
        projectId: profile.id,
        requirementId: requirement?.id,
        requirementTitle: requirement?.title,
        title,
        summary,
        keywords: keywords ?? [],
        changedFiles: changedFiles ?? [],
      });

      return jsonToolResult({ memory });
    },
  );

  server.registerTool(
    "specweft.recall_sessions",
    {
      title: "Recall sessions",
      description: "Search recent SpecWeft session memories by keyword.",
      inputSchema: RecallInput,
    },
    async ({ repoPath, keyword, requirementId }) => {
      const resolvedRepoPath = resolveToolRepoPath(defaultRepoPath, repoPath);
      const requirement = await resolveToolRequirement(resolvedRepoPath, requirementId);
      const sessions = await recallSessions(
        resolvedRepoPath,
        keyword,
        requirement?.id,
      );
      return jsonToolResult({ sessions });
    },
  );

  server.registerTool(
    "specweft.create_memory_handoff",
    {
      title: "Create memory handoff",
      description: "Create a cross-thread handoff prompt from recent SpecWeft memories so a new Codex or Claude thread can continue with context.",
      inputSchema: HandoffInput,
    },
    async ({ repoPath, keyword, requirementId, limit }) => {
      const resolvedRepoPath = resolveToolRepoPath(defaultRepoPath, repoPath);
      const profile = await scanProject(resolvedRepoPath);
      const requirement = requirementId?.trim()
        ? await resolveToolRequirement(resolvedRepoPath, requirementId)
        : keyword?.trim()
          ? undefined
          : await getActiveRequirement(resolvedRepoPath);
      const handoff = await createMemoryHandoff(resolvedRepoPath, profile, keyword, limit, requirement);
      return jsonToolResult({ handoff });
    },
  );

  server.registerTool(
    "specweft.recommend_marketplace_mcps",
    {
      title: "Recommend marketplace MCPs",
      description: "Search and rank external MCP server candidates for the current project and requirement without applying them automatically.",
      inputSchema: MarketplaceMcpSearchInput,
    },
    async ({ repoPath, keyword, requirement }) => {
      const resolvedRepoPath = resolveToolRepoPath(defaultRepoPath, repoPath);
      const profile = await scanProject(resolvedRepoPath);
      const recommendations = await recommendForProject(profile, resolvedRepoPath);
      const marketplaceMcps = await recommendMarketplaceMcps(profile, recommendations, {
        keywords: keyword?.trim() ? [keyword] : undefined,
        requirement,
      });

      return jsonToolResult({ profile, marketplaceMcps });
    },
  );

  server.registerTool(
    "specweft.install_marketplace_mcp",
    {
      title: "Install marketplace MCP",
      description: "Install a marketplace MCP manifest into the global SpecWeft MCP pool and enable it for this project.",
      inputSchema: MarketplaceMcpInput,
    },
    async ({ repoPath, mcp }) => {
      const resolvedRepoPath = resolveToolRepoPath(defaultRepoPath, repoPath);
      // MCP 安装只写 SpecWeft manifest 池，不直接改用户全局 agent 配置。
      const installed = await installMarketplaceMcp(mcp);
      const selection = await applyProjectMcp(resolvedRepoPath, installed.item.id);
      await recordMcpActivity(resolvedRepoPath, {
        kind: "install_mcp",
        title: "加入并启用市场 MCP",
        summary: `已将 ${installed.item.name} 写入全局 MCP manifest 池，并启用到当前项目。`,
        toolName: "specweft.install_marketplace_mcp",
        target: installed.item.id,
        metadata: {
          runtime: installed.manifest.runtime,
          risk: installed.manifest.risk,
        },
      });

      return jsonToolResult({ installed, selection });
    },
  );

  server.registerTool(
    "specweft.recommend_marketplace_skills",
    {
      title: "Recommend marketplace Skills",
      description: "Search external marketplace Skill candidates for the current project without applying them automatically.",
      inputSchema: MarketplaceSearchInput,
    },
    async ({ repoPath, keyword }) => {
      const resolvedRepoPath = resolveToolRepoPath(defaultRepoPath, repoPath);
      const profile = await scanProject(resolvedRepoPath);
      const recommendations = await recommendForProject(profile, resolvedRepoPath);
      const settings = await readProjectSettings(resolvedRepoPath);
      const marketplaceSkills = await recommendMarketplaceSkills(profile, recommendations, {
        keywords: keyword?.trim() ? [keyword] : undefined,
        registryUrl: settings.capabilities.skillRegistryUrl,
        timeoutMs: settings.capabilities.mcpStdioTimeoutMs,
      });

      return jsonToolResult({ profile, marketplaceSkills });
    },
  );

  server.registerTool(
    "specweft.check_marketplace_skill_updates",
    {
      title: "Check marketplace Skill updates",
      description: "Check enabled marketplace Skills against the configured Skill registry without reinstalling or changing local files.",
      inputSchema: RepoInput,
    },
    async ({ repoPath }) => {
      const resolvedRepoPath = resolveToolRepoPath(defaultRepoPath, repoPath);
      return jsonToolResult(await checkMarketplaceSkillUpdates(resolvedRepoPath));
    },
  );

  server.registerTool(
    "specweft.install_marketplace_skill",
    {
      title: "Install marketplace Skill",
      description: "Install a marketplace Skill into the global SpecWeft Skill pool and enable it for this project.",
      inputSchema: MarketplaceSkillInput,
    },
    async ({ repoPath, skill }) => {
      const resolvedRepoPath = resolveToolRepoPath(defaultRepoPath, repoPath);
      // 安装到全局池后再写项目选择，避免同一个 Skill 在多个项目里重复下载。
      const installed = await installMarketplaceSkill(skill);
      const selection = await applyProjectSkill(resolvedRepoPath, installed.item.id);
      await recordMcpActivity(resolvedRepoPath, {
        kind: "install_skill",
        title: "加入并启用市场 Skill",
        summary: `已将 ${installed.item.name} 加入全局 Skill 池，并启用到当前项目。`,
        toolName: "specweft.install_marketplace_skill",
        target: installed.item.id,
      });

      return jsonToolResult({ installed, selection });
    },
  );

  server.registerTool(
    "specweft.apply_project_mcp",
    {
      title: "Apply project MCP",
      description: "Enable one MCP server from the global SpecWeft pool for this project.",
      inputSchema: ApplyInput,
    },
    async ({ repoPath, id }) => {
      const resolvedRepoPath = resolveToolRepoPath(defaultRepoPath, repoPath);
      const selection = await applyProjectMcp(
        resolvedRepoPath,
        id,
      );
      await recordMcpActivity(resolvedRepoPath, {
        kind: "apply_mcp",
        title: "启用项目 MCP",
        summary: "已将全局 MCP 池中的能力启用到当前项目。",
        toolName: "specweft.apply_project_mcp",
        target: id,
      });
      return jsonToolResult({ selection });
    },
  );

  server.registerTool(
    "specweft.apply_project_skill",
    {
      title: "Apply project Skill",
      description: "Enable one Skill from the global SpecWeft pool for this project.",
      inputSchema: ApplyInput,
    },
    async ({ repoPath, id }) => {
      const resolvedRepoPath = resolveToolRepoPath(defaultRepoPath, repoPath);
      const selection = await applyProjectSkill(
        resolvedRepoPath,
        id,
      );
      await recordMcpActivity(resolvedRepoPath, {
        kind: "apply_skill",
        title: "启用项目 Skill",
        summary: "已将全局 Skill 池中的能力启用到当前项目。",
        toolName: "specweft.apply_project_skill",
        target: id,
      });
      return jsonToolResult({ selection });
    },
  );
}

function resolveToolRepoPath(defaultRepoPath: string, repoPath?: string): string {
  return repoPath ? resolveRepoPath(repoPath) : defaultRepoPath;
}

async function resolveToolRequirement(
  repoPath: string,
  requirementId?: string,
): Promise<RequirementRecord | undefined> {
  if (!requirementId?.trim()) {
    return getActiveRequirement(repoPath);
  }

  const file = await listRequirements(repoPath);
  const requirement = file.requirements.find((item) => item.id === requirementId.trim());
  if (!requirement) {
    throw new Error(`Requirement not found: ${requirementId}`);
  }

  return requirement;
}

function jsonToolResult(value: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(value, null, 2),
      },
    ],
  };
}

function createCompactDiffSummary(diff: DiffSummary): Omit<DiffSummary, "diffText"> & {
  diffTextOmitted: true;
} {
  const { diffText: _diffText, ...compactDiff } = diff;

  return {
    ...compactDiff,
    diffTextOmitted: true,
  };
}

async function recordMcpActivity(
  repoPath: string,
  input: Omit<Parameters<typeof recordAgentActivity>[1], "source">,
): Promise<void> {
  try {
    await recordAgentActivity(repoPath, {
      source: "mcp",
      ...input,
    });
  } catch {
    // Activity logging is observational and must never break MCP tool calls.
  }
}
