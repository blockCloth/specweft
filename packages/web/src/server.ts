import path from "node:path";
import { execFile } from "node:child_process";
import { readFile, realpath, stat } from "node:fs/promises";
import type { Server } from "node:http";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { serve } from "@hono/node-server";
import {
  analyzeCurrentDiff,
  applyProjectMcp,
  applyProjectSkill,
  checkMarketplaceSkillUpdates,
  createAgentReviewPacket,
  createBootstrapSession,
  createCapabilityCenter,
  createAgentConnectionPackage,
  createConnectionDoctorReport,
  createMemoryDigest,
  createMemoryIndex,
  createMemoryHandoff,
  createMemoryTimeline,
  createProjectReadiness,
  createRequirementDossier,
  createRequirement,
  createReviewReport,
  createRuntimeAssembly,
  createWorkSegmentStatus,
  getMemoryProtectionStatus,
  getRecordingStatus,
  disableProjectMcp,
  disableProjectSkill,
  getActiveRequirement,
  ignoreProjectMcp,
  ignoreProjectSkill,
  initializeGlobalPools,
  initializeSpecWeftProject,
  installMarketplaceMcp,
  installMarketplaceSkill,
  listRegisteredProjects,
  listRequirements,
  previewMarketplaceSkill,
  prepareTask,
  readAgentActivity,
  recallSessions,
  recordAgentActivity,
  readProjectSettings,
  recommendForProject,
  recommendSkillsForTask,
  recommendMarketplaceMcps,
  recommendMarketplaceSkills,
  registerProject,
  readSkillDetail,
  scanProject,
  setActiveProject,
  setActiveRequirement,
  SPECWEFT_MCP_TOOL_NAMES,
  startWorkSegment,
  completeWorkSegment,
  restoreRequirementMemory,
  updateProjectSettings,
} from "@specweft/core";
import type { AgentActivityKind, AgentActivitySource, AgentActivityStatus, ProjectSettingsPatch } from "@specweft/core";
import { Hono } from "hono";
import type { Context } from "hono";
import { renderApp } from "./ui.js";

type WebOptions = {
  repoPath: string;
  port: number;
};

type SelectionBody = {
  repoPath?: string;
  type?: "mcp" | "skill";
  id?: string;
};

type ReviewBody = {
  repoPath?: string;
  requirementId?: string;
  title?: string;
};

type SourcePreviewQuery = {
  filePath?: string;
  maxLines?: number;
};

type PrepareBody = {
  repoPath?: string;
  task?: string;
  keyword?: string;
  requirementId?: string;
};

type MarketplaceSkillBody = {
  repoPath?: string;
  skill?: Parameters<typeof installMarketplaceSkill>[0];
};

type MarketplaceMcpBody = {
  repoPath?: string;
  mcp?: Parameters<typeof installMarketplaceMcp>[0];
};

type ProjectBody = {
  repoPath?: string;
};

type SettingsBody = {
  repoPath?: string;
  settings?: ProjectSettingsPatch;
};

type RequirementBody = {
  repoPath?: string;
  id?: string;
  title?: string;
  keywords?: string[];
  summary?: string;
};

type WorkSegmentBody = {
  repoPath?: string;
  task?: string;
  title?: string;
  requirementId?: string;
  segmentId?: string;
  status?: "recorded" | "interrupted" | "abandoned";
  summary?: string;
};

const app = new Hono();
const LOCAL_WEB_HOST = "127.0.0.1";
let options: WebOptions = {
  repoPath: resolveWebRepoPath("."),
  port: 4177,
};
const execFileAsync = promisify(execFile);

app.get("/", async (context) => {
  const requestedRepo = context.req.query("repo");
  const registry = await listRegisteredProjects();
  const repoPath = requestedRepo
    ? await resolveRequestRepo(requestedRepo)
    : registry.activeProjectPath ?? options.repoPath;
  return context.html(renderApp(repoPath));
});

app.get("/api/projects", async (context) => {
  return context.json(await listRegisteredProjects());
});

app.post("/api/projects/register", async (context) => {
  const body = await readJsonBody<ProjectBody>(context);
  const repoPath = await resolveRequestRepo(body.repoPath, { allowUnregistered: true });
  await ensureWebProjectReady(repoPath);
  const result = await registerProject(repoPath);
  await recordWebActivity(repoPath, {
    kind: "project_registered",
    title: "登记项目",
    summary: "SpecWeft Web 已登记一个本地项目，可在同一个 UI 中切换管理。",
    target: repoPath,
  });
  return context.json(result);
});

app.post("/api/projects/active", async (context) => {
  const body = await readJsonBody<ProjectBody>(context);
  const repoPath = await resolveRequestRepo(body.repoPath);
  const result = await setActiveProject(repoPath);
  await recordWebActivity(repoPath, {
    kind: "project_selected",
    title: "切换当前项目",
    summary: "SpecWeft Web 已切换当前项目，后续操作会读取这个项目的上下文。",
    target: repoPath,
  });
  return context.json(result);
});

app.get("/api/dashboard", async (context) => {
  const repoPath = await resolveRequestRepo(context.req.query("repo"));
  const init = await ensureWebProjectReady(repoPath);

  const [profile, assembly, mcpInspect] = await Promise.all([
    scanProject(repoPath),
    createRuntimeAssembly(repoPath),
    createMcpInspect(repoPath),
  ]);
  const settings = await readProjectSettings(repoPath);
  const capabilityCenter = await createCapabilityCenter(profile, repoPath);
  const recommendations = await recommendForProject(profile, repoPath);
  const requirements = await listRequirements(repoPath);
  const [timeline, recordingStatus] = await Promise.all([
    createMemoryTimeline(repoPath, profile),
    getRecordingStatus(repoPath),
  ]);
  const [workSegments, memoryDigest, requirementDossier, memoryProtection, skillUpdateCheck, connectionDoctor, projectReadiness, bootstrapSession, agentActivity] = await Promise.all([
    createWorkSegmentStatus(repoPath, profile),
    createMemoryDigest(repoPath, profile),
    createRequirementDossier(repoPath, profile, {
      sessionPreviewLimit: 3,
    }),
    getMemoryProtectionStatus(repoPath),
    checkMarketplaceSkillUpdates(repoPath),
    createConnectionDoctorReport(repoPath),
    createProjectReadiness(repoPath),
    createBootstrapSession(repoPath),
    readAgentActivity(repoPath),
  ]);
  const llmConfig = createLlmConfigStatus();

  return context.json({
    profile,
    recommendations,
    capabilityCenter,
    requirements,
    timeline,
    memoryDigest,
    requirementDossier,
    memoryProtection,
    skillUpdateCheck,
    recordingStatus,
    workSegments,
    projectReadiness,
    bootstrapSession,
    agentActivity,
    llmConfig,
    settings,
    assembly,
    mcpInspect,
    agentConnectionPackage: createAgentConnectionPackage({
      repoPath,
      profile,
      harness: init.harness,
      command: mcpInspect.clientConfig.mcpServers.specweft.command,
      args: mcpInspect.clientConfig.mcpServers.specweft.args,
      codexToml: mcpInspect.codexToml,
      claudeJson: mcpInspect.claudeJson,
    }),
    connectionDoctor,
    agentHarness: init.harness,
    instructionPaths: init.instructionPaths,
    nextCommands: init.nextCommands,
  });
});

app.get("/api/dashboard/summary", async (context) => {
  const repoPath = await resolveRequestRepo(context.req.query("repo"));

  const bootstrapSession = await createBootstrapSession(repoPath);
  const [
    requirements,
    recordingStatus,
    memoryProtection,
    connectionDoctor,
    agentActivity,
    mcpInspect,
  ] = await Promise.all([
    listRequirements(repoPath),
    getRecordingStatus(repoPath),
    getMemoryProtectionStatus(repoPath),
    createConnectionDoctorReport(repoPath),
    readAgentActivity(repoPath),
    createMcpInspect(repoPath),
  ]);
  const llmConfig = createLlmConfigStatus();

  return context.json({
    partial: true,
    profile: bootstrapSession.profile,
    recommendations: bootstrapSession.recommendations,
    capabilityCenter: bootstrapSession.capabilityCenter,
    requirements,
    memoryDigest: bootstrapSession.memoryDigest,
    requirementDossier: bootstrapSession.requirementDossier,
    memoryProtection,
    recordingStatus,
    bootstrapSession,
    agentActivity,
    llmConfig,
    settings: bootstrapSession.settings,
    assembly: bootstrapSession.assembly,
    mcpInspect,
    connectionDoctor,
    agentHarness: undefined,
    instructionPaths: [],
    nextCommands: [],
  });
});

app.get("/api/bootstrap", async (context) => {
  const repoPath = await resolveRequestRepo(context.req.query("repo"));
  const keyword = context.req.query("keyword")?.trim();
  const bootstrap = await createBootstrapSession(repoPath, keyword);
  await recordWebActivity(repoPath, {
    kind: "bootstrap_session",
    title: "刷新 Agent 启动上下文",
    summary: "已生成项目画像、能力装配、记忆摘要和 Agent 调用顺序。",
    toolName: "specweft.bootstrap_session",
    target: keyword,
    metadata: {
      capabilityCount: bootstrap.capabilityCenter.summary.total,
      memoryCount: bootstrap.memoryDigest.totalMemories,
    },
  });
  return context.json(bootstrap);
});

app.get("/api/settings", async (context) => {
  const repoPath = await resolveRequestRepo(context.req.query("repo"));
  await ensureWebProjectReady(repoPath);
  return context.json(await readProjectSettings(repoPath));
});

app.get("/api/project-readiness", async (context) => {
  const repoPath = await resolveRequestRepo(context.req.query("repo"));
  await ensureWebProjectReady(repoPath);
  return context.json(await createProjectReadiness(repoPath));
});

app.post("/api/settings", async (context) => {
  const body = await readJsonBody<SettingsBody>(context);
  const repoPath = await resolveRequestRepo(body.repoPath);
  await ensureWebProjectReady(repoPath);
  const settings = await updateProjectSettings(repoPath, body.settings ?? {});
  await recordWebActivity(repoPath, {
    kind: "settings_updated",
    title: "更新项目配置",
    summary: "已更新修改记录、上下文记忆或 Skills/MCP 的项目级策略。",
    target: ".specweft/settings.json",
  });
  return context.json(settings);
});

app.post("/api/prepare", async (context) => {
  const body = await readJsonBody<PrepareBody>(context);
  const repoPath = await resolveRequestRepo(body.repoPath);

  if (!body.task?.trim()) {
    return context.json({ error: "Task is required." }, 400);
  }

  const prepared = await prepareTask(repoPath, body.task);
  await recordWebActivity(repoPath, {
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
      ambiguity: prepared.taskAnalysis.ambiguity,
      confidence: prepared.taskAnalysis.confidence,
    },
  });
  return context.json(prepared);
});

app.get("/api/memory-index", async (context) => {
  const repoPath = await resolveRequestRepo(context.req.query("repo"));
  const profile = await scanProject(repoPath);
  return context.json(await createMemoryIndex(repoPath, profile));
});

app.get("/api/memory-digest", async (context) => {
  const repoPath = await resolveRequestRepo(context.req.query("repo"));
  const profile = await scanProject(repoPath);
  return context.json(await createMemoryDigest(repoPath, profile));
});

app.get("/api/requirement-dossier", async (context) => {
  const repoPath = await resolveRequestRepo(context.req.query("repo"));
  const full = parseBooleanQuery(context.req.query("full"));
  const profile = await scanProject(repoPath);
  return context.json(await createRequirementDossier(repoPath, profile, {
    includeSessions: full,
    sessionPreviewLimit: full ? undefined : 3,
  }));
});

app.post("/api/restore-requirement", async (context) => {
  const body = await readJsonBody<PrepareBody>(context);
  const repoPath = await resolveRequestRepo(body.repoPath);
  const profile = await scanProject(repoPath);
  const requirement = await resolveApiRequirement(repoPath, body.requirementId);

  const restored = await restoreRequirementMemory(repoPath, profile, {
    keyword: body.keyword,
    requirement,
  });
  await recordWebActivity(repoPath, {
    kind: "restore_requirement",
    title: "恢复需求记忆",
    summary: restored.summary,
    toolName: "specweft.restore_requirement",
    requirementId: restored.requirement?.id,
    requirementTitle: restored.requirement?.title,
    target: body.keyword,
    metadata: {
      sessions: restored.sessions.length,
      compression: Boolean(restored.compression),
    },
  });
  return context.json(restored);
});

app.post("/api/task-skills", async (context) => {
  const body = await readJsonBody<PrepareBody>(context);
  const repoPath = await resolveRequestRepo(body.repoPath);

  if (!body.task?.trim()) {
    return context.json({ error: "Task is required." }, 400);
  }

  const profile = await scanProject(repoPath);
  const skillSuggestions = await recommendSkillsForTask(profile, repoPath, body.task);
  await recordWebActivity(repoPath, {
    kind: "recommend_skills",
    title: "按需求推荐 Skill",
    summary: "SpecWeft 已根据当前任务语义和本地 Skill 池生成候选。",
    toolName: "specweft.recommend_skills_for_task",
    metadata: {
      suggestions: skillSuggestions.length,
    },
  });
  return context.json({
    profile,
    skillSuggestions,
  });
});

app.get("/api/marketplace/skills", async (context) => {
  const repoPath = await resolveRequestRepo(context.req.query("repo"));
  const keyword = context.req.query("keyword")?.trim();
  const profile = await scanProject(repoPath);
  const recommendations = await recommendForProject(profile, repoPath);
  const settings = await readProjectSettings(repoPath);
  return context.json(await recommendMarketplaceSkills(profile, recommendations, {
    keywords: keyword ? [keyword] : undefined,
    registryUrl: settings.capabilities.skillRegistryUrl,
    timeoutMs: settings.capabilities.mcpStdioTimeoutMs,
  }));
});

app.get("/api/marketplace/skills/updates", async (context) => {
  const repoPath = await resolveRequestRepo(context.req.query("repo"));
  return context.json(await checkMarketplaceSkillUpdates(repoPath));
});

app.post("/api/marketplace/skills/apply", async (context) => {
  const body = await readJsonBody<MarketplaceSkillBody>(context);
  const repoPath = await resolveRequestRepo(body.repoPath);

  if (!body.skill) {
    return context.json({ error: "Marketplace Skill is required." }, 400);
  }

  // 市场 Skill 先进入全局池，再写入项目选择。这样同一个 Skill 可以被多个项目复用。
  const installed = await installMarketplaceSkill(body.skill);
  const selection = await applyProjectSkill(repoPath, installed.item.id);
  await recordWebActivity(repoPath, {
    kind: "install_skill",
    title: "加入并启用市场 Skill",
    summary: `已将 ${installed.item.name} 加入全局 Skill 池，并启用到当前项目。`,
    toolName: "specweft.install_marketplace_skill",
    target: installed.item.id,
  });

  return context.json({
    installed,
    selection,
  });
});

app.post("/api/marketplace/skills/preview", async (context) => {
  const body = await readJsonBody<MarketplaceSkillBody>(context);

  if (!body.skill) {
    return context.json({ error: "Marketplace Skill is required." }, 400);
  }

  return context.json(await previewMarketplaceSkill(body.skill));
});

app.get("/api/marketplace/mcps", async (context) => {
  const repoPath = await resolveRequestRepo(context.req.query("repo"));
  const keyword = context.req.query("keyword")?.trim();
  const requirement = context.req.query("requirement")?.trim();
  const profile = await scanProject(repoPath);
  const recommendations = await recommendForProject(profile, repoPath);
  return context.json(await recommendMarketplaceMcps(profile, recommendations, {
    keywords: keyword ? [keyword] : undefined,
    requirement,
  }));
});

app.post("/api/marketplace/mcps/apply", async (context) => {
  const body = await readJsonBody<MarketplaceMcpBody>(context);
  const repoPath = await resolveRequestRepo(body.repoPath);

  if (!body.mcp) {
    return context.json({ error: "Marketplace MCP is required." }, 400);
  }

  // MCP 候选先写入全局 manifest 池，再启用到项目选择，最后由 runtime assembly 输出给 Codex/Claude。
  const installed = await installMarketplaceMcp(body.mcp);
  const selection = await applyProjectMcp(repoPath, installed.item.id);
  await recordWebActivity(repoPath, {
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

  return context.json({
    installed,
    selection,
  });
});

app.post("/api/pool/init", async (context) => {
  const result = await initializeGlobalPools();
  return context.json(result);
});

app.get("/api/requirements", async (context) => {
  const repoPath = await resolveRequestRepo(context.req.query("repo"));
  return context.json(await listRequirements(repoPath));
});

app.get("/api/timeline", async (context) => {
  const repoPath = await resolveRequestRepo(context.req.query("repo"));
  const profile = await scanProject(repoPath);
  return context.json(await createMemoryTimeline(repoPath, profile));
});

app.get("/api/recording-status", async (context) => {
  const repoPath = await resolveRequestRepo(context.req.query("repo"));
  return context.json(await getRecordingStatus(repoPath));
});

app.get("/api/work-segments", async (context) => {
  const repoPath = await resolveRequestRepo(context.req.query("repo"));
  const profile = await scanProject(repoPath);
  return context.json(await createWorkSegmentStatus(repoPath, profile));
});

app.post("/api/work-segments/start", async (context) => {
  const body = await readJsonBody<WorkSegmentBody>(context);
  const repoPath = await resolveRequestRepo(body.repoPath);
  const profile = await scanProject(repoPath);
  const requirement = body.requirementId?.trim()
    ? await resolveApiRequirement(repoPath, body.requirementId)
    : await getActiveRequirement(repoPath);

  if (!body.task?.trim() && !body.title?.trim() && !requirement) {
    return context.json({ error: "Work segment task or title is required." }, 400);
  }

  const segmentResult = await startWorkSegment(repoPath, {
    projectId: profile.id,
    requirement,
    task: body.task ?? body.title ?? requirement?.title ?? "未命名工作段",
    title: body.title,
  });
  const { segment } = segmentResult;
  await recordWebActivity(repoPath, {
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
  return context.json(segmentResult);
});

app.post("/api/work-segments/complete", async (context) => {
  const body = await readJsonBody<WorkSegmentBody>(context);
  const repoPath = await resolveRequestRepo(body.repoPath);
  const segment = await completeWorkSegment(repoPath, {
    segmentId: body.segmentId,
    status: body.status,
    title: body.title,
    summary: body.summary,
  });
  if (!segment) {
    return context.json({ error: "No active work segment was found." }, 400);
  }
  await recordWebActivity(repoPath, {
    kind: "complete_work_segment",
    title: "完成工作段",
    summary: segment.summary || segment.task,
    toolName: "specweft.complete_work_segment",
    status: segment.status === "recorded" ? "success" : "attention",
    requirementId: segment.requirementId,
    requirementTitle: segment.requirementTitle,
    target: segment.id,
  });
  return context.json({
    segment,
  });
});

app.post("/api/requirements", async (context) => {
  const body = await readJsonBody<RequirementBody>(context);
  const repoPath = await resolveRequestRepo(body.repoPath);
  const profile = await scanProject(repoPath);

  if (!body.title?.trim()) {
    return context.json({ error: "Requirement title is required." }, 400);
  }

  const requirement = await createRequirement(repoPath, {
    projectId: profile.id,
    title: body.title,
    keywords: body.keywords,
    summary: body.summary,
  });
  await recordWebActivity(repoPath, {
    kind: "requirement_created",
    title: "创建需求线",
    summary: requirement.summary || `已创建需求线：${requirement.title}`,
    requirementId: requirement.id,
    requirementTitle: requirement.title,
    metadata: {
      keywords: requirement.keywords,
    },
  });
  return context.json(requirement);
});

app.post("/api/requirements/active", async (context) => {
  const body = await readJsonBody<RequirementBody>(context);
  const repoPath = await resolveRequestRepo(body.repoPath);
  const id = assertId(body.id);
  const result = await setActiveRequirement(repoPath, id);
  await recordWebActivity(repoPath, {
    kind: "requirement_selected",
    title: "切换当前需求线",
    summary: `当前需求线已切换为：${result.title}`,
    requirementId: result.id,
    requirementTitle: result.title,
  });
  return context.json(result);
});

app.get("/api/assembly", async (context) => {
  const repoPath = await resolveRequestRepo(context.req.query("repo"));
  return context.json(await createRuntimeAssembly(repoPath));
});

app.get("/api/mcp-inspect", async (context) => {
  const repoPath = await resolveRequestRepo(context.req.query("repo"));
  return context.json(await createMcpInspect(repoPath));
});

app.get("/api/connection-doctor", async (context) => {
  const repoPath = await resolveRequestRepo(context.req.query("repo"));
  return context.json(await createConnectionDoctorReport(repoPath));
});

app.get("/api/llm-config", async (context) => {
  return context.json(createLlmConfigStatus());
});

app.get("/api/agent-activity", async (context) => {
  const repoPath = await resolveRequestRepo(context.req.query("repo"));
  const limit = parseOptionalNumber(context.req.query("limit"), 1, 100, 30);
  return context.json(await readAgentActivity(repoPath, limit));
});

app.get("/api/skills/:id", async (context) => {
  const id = assertId(context.req.param("id"));
  const detail = await readSkillDetail(id);

  if (!detail) {
    return context.json({ error: `Skill not found: ${id}` }, 404);
  }

  return context.json(detail);
});

app.get("/api/source-preview", async (context) => {
  const repoPath = await resolveRequestRepo(context.req.query("repo"));
  const filePath = context.req.query("path")?.trim();
  const maxLines = parseOptionalNumber(context.req.query("maxLines"), 1, 120, 60);

  return context.json(await createSourcePreview(repoPath, {
    filePath,
    maxLines,
  }));
});

app.post("/api/selection/:action", async (context) => {
  const action = context.req.param("action");
  const body = await readJsonBody<SelectionBody>(context);
  const repoPath = await resolveRequestRepo(body.repoPath);
  const type = assertSelectionType(body.type);
  const id = assertId(body.id);

  if (action === "apply" && type === "mcp") {
    const selection = await applyProjectMcp(repoPath, id);
    await recordWebActivity(repoPath, {
      kind: "apply_mcp",
      title: "启用项目 MCP",
      summary: "已将全局 MCP 池中的能力启用到当前项目。",
      toolName: "specweft.apply_project_mcp",
      target: id,
    });
    return context.json(selection);
  }
  if (action === "apply" && type === "skill") {
    const selection = await applyProjectSkill(repoPath, id);
    await recordWebActivity(repoPath, {
      kind: "apply_skill",
      title: "启用项目 Skill",
      summary: "已将全局 Skill 池中的能力启用到当前项目。",
      toolName: "specweft.apply_project_skill",
      target: id,
    });
    return context.json(selection);
  }
  if (action === "disable" && type === "mcp") {
    const selection = await disableProjectMcp(repoPath, id);
    await recordWebActivity(repoPath, {
      kind: "apply_mcp",
      title: "停用项目 MCP",
      summary: "已停用当前项目中的 MCP 能力。",
      status: "attention",
      target: id,
    });
    return context.json(selection);
  }
  if (action === "disable" && type === "skill") {
    const selection = await disableProjectSkill(repoPath, id);
    await recordWebActivity(repoPath, {
      kind: "apply_skill",
      title: "停用项目 Skill",
      summary: "已停用当前项目中的 Skill 能力。",
      status: "attention",
      target: id,
    });
    return context.json(selection);
  }
  if (action === "ignore" && type === "mcp") {
    const selection = await ignoreProjectMcp(repoPath, id);
    await recordWebActivity(repoPath, {
      kind: "apply_mcp",
      title: "忽略项目 MCP",
      summary: "已将 MCP 标记为忽略，后续推荐会降低优先级。",
      status: "attention",
      target: id,
    });
    return context.json(selection);
  }
  if (action === "ignore" && type === "skill") {
    const selection = await ignoreProjectSkill(repoPath, id);
    await recordWebActivity(repoPath, {
      kind: "apply_skill",
      title: "忽略项目 Skill",
      summary: "已将 Skill 标记为忽略，后续推荐会降低优先级。",
      status: "attention",
      target: id,
    });
    return context.json(selection);
  }

  return context.json({ error: `Unknown selection action: ${action}` }, 400);
});

app.post("/api/review", async (context) => {
  const body = await readJsonBody<ReviewBody>(context);
  const repoPath = await resolveRequestRepo(body.repoPath);
  const profile = await scanProject(repoPath);
  const report = await createReviewReport(repoPath, profile, body.title, undefined, body.requirementId);
  const diff = await analyzeCurrentDiff(repoPath);
  const agentReview = createAgentReviewPacket({
    title: report.title,
    review: report.review,
    diff,
    requirement: report.requirement,
    reportPath: report.reportPath,
  });
  const recordingStatus = await getRecordingStatus(repoPath);
  const workSegments = await createWorkSegmentStatus(repoPath, profile);
  const timeline = await createMemoryTimeline(repoPath, profile);
  const requirementDossier = await createRequirementDossier(repoPath, profile, { sessionPreviewLimit: 3 });
  await recordWebActivity(repoPath, {
    kind: "record_current_diff",
    title: "生成代码讲解",
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

  return context.json({
    title: report.title,
    reportPath: report.reportPath,
    memory: report.memory,
    requirement: report.requirement,
    agentReview,
    review: report.review,
    html: report.html,
    markdown: report.markdown,
    recordingStatus,
    workSegments,
    timeline,
    requirementDossier,
  });
});

app.post("/api/record-current-diff", async (context) => {
  const body = await readJsonBody<ReviewBody>(context);
  const repoPath = await resolveRequestRepo(body.repoPath);
  const profile = await scanProject(repoPath);
  const report = await createReviewReport(repoPath, profile, body.title, undefined, body.requirementId);
  const diff = await analyzeCurrentDiff(repoPath);
  const agentReview = createAgentReviewPacket({
    title: report.title,
    review: report.review,
    diff,
    requirement: report.requirement,
    reportPath: report.reportPath,
  });
  const recordingStatus = await getRecordingStatus(repoPath);
  const workSegments = await createWorkSegmentStatus(repoPath, profile);
  const timeline = await createMemoryTimeline(repoPath, profile);
  const requirementDossier = await createRequirementDossier(repoPath, profile, { sessionPreviewLimit: 3 });
  await recordWebActivity(repoPath, {
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

  return context.json({
    title: report.title,
    reportPath: report.reportPath,
    memory: report.memory,
    requirement: report.requirement,
    agentReview,
    review: report.review,
    html: report.html,
    markdown: report.markdown,
    recordingStatus,
    workSegments,
    timeline,
    requirementDossier,
  });
});

app.get("/api/recall", async (context) => {
  const repoPath = await resolveRequestRepo(context.req.query("repo"));
  const keyword = context.req.query("keyword")?.trim();
  const requirementId = context.req.query("requirementId")?.trim();
  if (!keyword) {
    return context.json({ sessions: [] });
  }
  await resolveApiRequirement(repoPath, requirementId);
  const sessions = await recallSessions(repoPath, keyword, requirementId);
  await recordWebActivity(repoPath, {
    kind: "memory_recalled",
    title: "按关键词召回记忆",
    summary: sessions.length > 0
      ? `已找到 ${sessions.length} 条相关记忆。`
      : "没有找到匹配的记忆。",
    toolName: "specweft.recall_sessions",
    target: keyword,
    requirementId,
    metadata: {
      sessions: sessions.length,
    },
  });

  return context.json({
    sessions,
  });
});

app.get("/api/handoff", async (context) => {
  const repoPath = await resolveRequestRepo(context.req.query("repo"));
  const keyword = context.req.query("keyword")?.trim();
  const profile = await scanProject(repoPath);
  const requirement = keyword ? undefined : await getActiveRequirement(repoPath);

  const handoff = await createMemoryHandoff(repoPath, profile, keyword, 5, requirement);
  await recordWebActivity(repoPath, {
    kind: "memory_handoff",
    title: "生成线程交接上下文",
    summary: handoff.summary,
    toolName: "specweft.create_memory_handoff",
    requirementId: handoff.requirementId,
    requirementTitle: handoff.requirementTitle,
    target: keyword,
    metadata: {
      sessions: handoff.sessions.length,
      changedFiles: handoff.changedFiles.length,
    },
  });

  return context.json({
    handoff,
  });
});

app.onError((error, context) => {
  const message = error instanceof Error ? error.message : String(error);
  const status = error instanceof BadRequestError ? 400 : 500;
  return context.json({
    ok: false,
    error: message,
    status,
  }, status);
});

export async function startWebServer(webOptions: WebOptions): Promise<void> {
  options = {
    repoPath: await normalizeRepoPath(resolveWebRepoPath(webOptions.repoPath)),
    port: webOptions.port,
  };
  await ensureWebProjectReady(options.repoPath);
  await startServer(options.port);
}

if (isMainModule()) {
  await startWebServer(parseArgs(process.argv.slice(2)));
}

function parseArgs(argv: string[]): WebOptions {
  let repoPath = ".";
  let port = 4177;

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    const next = argv[index + 1];

    if (current === "--repo" && next) {
      repoPath = next;
      index += 1;
      continue;
    }

    if (current === "--port" && next) {
      port = parsePort(next);
      index += 1;
    }
  }

  return {
    repoPath: resolveWebRepoPath(repoPath),
    port,
  };
}

function parsePort(value: string): number {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`--port must be an integer between 1 and 65535. Received: ${value}`);
  }

  return port;
}

function parseBooleanQuery(value: string | undefined): boolean {
  if (!value) {
    return false;
  }

  return ["1", "true", "yes", "full"].includes(value.toLowerCase());
}

function parseOptionalNumber(value: string | undefined, min: number, max: number, fallback: number): number {
  if (!value?.trim()) {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, parsed));
}

async function readJsonBody<T>(context: Context): Promise<T> {
  try {
    return await context.req.json<T>();
  } catch {
    throw new BadRequestError("Request body must be valid JSON.");
  }
}

async function resolveRequestRepo(repoPath?: string, opts: { allowUnregistered?: boolean } = {}): Promise<string> {
  if (!repoPath?.trim()) {
    return options.repoPath;
  }

  const resolved = await normalizeRepoPath(resolveWebRepoPath(repoPath));
  if (opts.allowUnregistered) {
    return resolved;
  }

  return assertKnownRepoPath(resolved);
}

class BadRequestError extends Error {}

function resolveWebRepoPath(repoPath: string): string {
  if (path.isAbsolute(repoPath)) {
    return repoPath;
  }

  // pnpm --filter runs the package script from packages/web. INIT_CWD keeps the
  // directory where the user typed the command, which is the expected repo base.
  return path.resolve(process.env.INIT_CWD ?? process.cwd(), repoPath);
}

async function normalizeRepoPath(repoPath: string): Promise<string> {
  try {
    return await realpath(repoPath);
  } catch {
    return repoPath;
  }
}

async function ensureWebProjectReady(repoPath: string) {
  const init = await initializeSpecWeftProject(repoPath);
  await registerProject(repoPath);

  return init;
}

async function recordWebActivity(repoPath: string, input: {
  kind: AgentActivityKind;
  title: string;
  summary: string;
  status?: AgentActivityStatus;
  toolName?: string;
  requirementId?: string;
  requirementTitle?: string;
  target?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    await recordAgentActivity(repoPath, {
      source: "web" satisfies AgentActivitySource,
      ...input,
    });
  } catch {
    // Activity logging must never block the main product flow.
  }
}

async function assertKnownRepoPath(repoPath: string): Promise<string> {
  const resolved = await normalizeRepoPath(resolveWebRepoPath(repoPath));
  const optionRepo = await normalizeRepoPath(options.repoPath);
  if (resolved === optionRepo) {
    return resolved;
  }

  const registry = await listRegisteredProjects();
  const activeProjectPath = registry.activeProjectPath
    ? await normalizeRepoPath(registry.activeProjectPath)
    : undefined;
  const projectPaths = await Promise.all(registry.projects.map((project) => normalizeRepoPath(project.rootPath)));
  if (activeProjectPath === resolved || projectPaths.includes(resolved)) {
    return resolved;
  }

  throw new BadRequestError("Project is not registered in this SpecWeft Web session. Register it from the Projects view first.");
}

function assertSelectionType(value: SelectionBody["type"]): "mcp" | "skill" {
  if (value !== "mcp" && value !== "skill") {
    throw new Error("Selection type must be mcp or skill.");
  }

  return value;
}

function assertId(value?: string): string {
  if (!value?.trim()) {
    throw new Error("Selection id is required.");
  }

  return value;
}

async function createSourcePreview(repoPath: string, query: SourcePreviewQuery) {
  const relativePath = assertProjectRelativePath(query.filePath);
  const repoRoot = await normalizeRepoPath(repoPath);
  const resolved = path.resolve(repoRoot, relativePath);
  const realRepoRoot = await realpath(repoRoot);
  let realFilePath: string;

  try {
    realFilePath = await realpath(resolved);
  } catch {
    throw new BadRequestError(`Source file does not exist: ${relativePath}`);
  }

  assertPathInsideProject(realRepoRoot, realFilePath);

  const fileStat = await stat(realFilePath);
  if (!fileStat.isFile()) {
    throw new BadRequestError(`Source path is not a file: ${relativePath}`);
  }
  if (fileStat.size > 512 * 1024) {
    return {
      path: relativePath,
      content: "",
      lineStart: 1,
      lineEnd: 0,
      totalLines: 0,
      truncated: true,
      reason: "File is larger than 512KB, so SpecWeft skipped inline preview.",
    };
  }

  const content = await readFile(realFilePath, "utf-8");
  const lines = content.split(/\r?\n/);
  const maxLines = query.maxLines ?? 60;
  const previewLines = lines.slice(0, maxLines);
  const preview = previewLines.join("\n").slice(0, 12000);

  return {
    path: relativePath,
    content: preview,
    lineStart: 1,
    lineEnd: previewLines.length,
    totalLines: lines.length,
    truncated: lines.length > previewLines.length || preview.length < previewLines.join("\n").length,
    reason: "Preview is intentionally limited to the first main-chain source segment.",
  };
}

function assertProjectRelativePath(filePath?: string): string {
  if (!filePath?.trim()) {
    throw new BadRequestError("Source preview path is required.");
  }
  if (path.isAbsolute(filePath)) {
    throw new BadRequestError("Source preview path must be project-relative.");
  }

  const normalized = path.normalize(filePath).replaceAll("\\", "/");
  if (normalized.startsWith("../") || normalized === ".." || normalized.includes("/../")) {
    throw new BadRequestError("Source preview path must stay inside the project.");
  }

  return normalized;
}

function assertPathInsideProject(repoRoot: string, filePath: string): void {
  const relative = path.relative(repoRoot, filePath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new BadRequestError("Source preview path must stay inside the project.");
  }
}

function createLlmConfigStatus() {
  return {
    enabled: Boolean((process.env.SPECWEFT_LLM_API_KEY || process.env.OPENAI_API_KEY)?.trim()),
    model: process.env.SPECWEFT_LLM_MODEL || process.env.OPENAI_MODEL || "gpt-4.1-mini",
    baseUrl: process.env.SPECWEFT_LLM_BASE_URL || "https://api.openai.com/v1",
    maxDiffChars: Number(process.env.SPECWEFT_LLM_MAX_DIFF_CHARS || 16000),
    env: {
      apiKey: process.env.SPECWEFT_LLM_API_KEY ? "SPECWEFT_LLM_API_KEY" : process.env.OPENAI_API_KEY ? "OPENAI_API_KEY" : "",
      model: process.env.SPECWEFT_LLM_MODEL ? "SPECWEFT_LLM_MODEL" : process.env.OPENAI_MODEL ? "OPENAI_MODEL" : "",
      baseUrl: process.env.SPECWEFT_LLM_BASE_URL ? "SPECWEFT_LLM_BASE_URL" : "",
      maxDiffChars: process.env.SPECWEFT_LLM_MAX_DIFF_CHARS ? "SPECWEFT_LLM_MAX_DIFF_CHARS" : "",
    },
  };
}

async function createMcpInspect(repoPath: string) {
  const settings = await readProjectSettings(repoPath);
  const clientConfig = createMcpClientConfig(repoPath);

  return {
    server: "specweft",
    transport: "stdio",
    settings: {
      skillRegistryUrl: settings.capabilities.skillRegistryUrl,
      autoCheckSkillUpdates: settings.capabilities.autoCheckSkillUpdates,
      mcpStdioTimeoutMs: settings.capabilities.mcpStdioTimeoutMs,
    },
    tools: SPECWEFT_MCP_TOOL_NAMES,
    clientConfig,
    codexToml: createCodexTomlSnippet(clientConfig),
    claudeJson: JSON.stringify(clientConfig, null, 2),
    workflow: [
      "新线程开始时调用 specweft.bootstrap_session。",
      "用户提出代码需求后，先调用 specweft.prepare_task。",
      "如命中历史需求，只调用 specweft.restore_requirement 恢复相关记忆。",
      "修改前用 prepare_task.guardrail.startWorkSegmentInput 调用 specweft.start_work_segment。",
      "修改后用 prepare_task.guardrail.recordCurrentDiffInput 调用 specweft.record_current_diff，并用 agentReview.suggestedAgentResponse 回复用户。",
      "MCP/Skill 推荐只作为候选，遇到凭证、数据库、网络权限时必须让用户确认。",
    ],
  };
}

function createMcpClientConfig(repoPath: string) {
  return {
    mcpServers: {
      specweft: {
        command: resolveCliCommand(),
        args: createCliArgs(repoPath),
      },
    },
  };
}

function createCodexTomlSnippet(clientConfig: ReturnType<typeof createMcpClientConfig>): string {
  const spec = clientConfig.mcpServers.specweft;

  return [
    "[mcp_servers.specweft]",
    `command = ${JSON.stringify(spec.command)}`,
    `args = [${spec.args.map((arg) => JSON.stringify(arg)).join(", ")}]`,
  ].join("\n");
}

function resolveCliCommand(): string {
  if (isInstalledPackageEntry()) {
    return "specweft";
  }

  return "node";
}

function createCliArgs(repoPath: string): string[] {
  if (isInstalledPackageEntry()) {
    return ["mcp", "--repo", repoPath];
  }

  const currentFile = fileURLToPath(import.meta.url);
  return [
    path.resolve(path.dirname(currentFile), "..", "..", "cli", "dist", "index.js"),
    "mcp",
    "--repo",
    repoPath,
  ];
}

function isInstalledPackageEntry(): boolean {
  return fileURLToPath(import.meta.url).includes(`${path.sep}node_modules${path.sep}@specweft${path.sep}web${path.sep}`);
}

function isMainModule(): boolean {
  return fileURLToPath(import.meta.url) === process.argv[1];
}

async function startServer(port: number, attempt = 0): Promise<void> {
  const restarted = await stopSpecWeftServerOnPort(port);
  if (restarted) {
    process.stdout.write(`Stopped existing SpecWeft Web UI on port ${port}; starting the current version...\n`);
  }

  const server = serve(
    {
      fetch: app.fetch,
      hostname: LOCAL_WEB_HOST,
      port,
    },
    (info) => {
      process.stdout.write(`SpecWeft Web UI: http://${LOCAL_WEB_HOST}:${info.port}\n`);
    },
  ) as Server;

  server.on("error", (error: NodeJS.ErrnoException) => {
    if (error.code === "EADDRINUSE" && attempt < 20) {
      const nextPort = port + 1;
      process.stdout.write(`Port ${port} is used by another app, trying ${nextPort}...\n`);
      void closeServer(server).then(() => startServer(nextPort, attempt + 1));
      return;
    }

    process.stderr.write(`Failed to start SpecWeft Web UI: ${error.message}\n`);
    process.exitCode = 1;
  });
}

async function closeServer(server: Server): Promise<void> {
  await new Promise<void>((resolve) => {
    server.close(() => resolve());
  });
}

async function stopSpecWeftServerOnPort(port: number): Promise<boolean> {
  const pids = await findPidsOnPort(port);
  if (pids.length === 0) {
    return false;
  }

  let stopped = false;
  for (const pid of pids) {
    const command = await readProcessCommand(pid);
    if (!isSpecWeftWebProcess(command)) {
      continue;
    }

    await stopProcessTree(pid);
    stopped = true;
  }

  if (stopped) {
    await waitForPortRelease(port);
  }

  return stopped;
}

async function findPidsOnPort(port: number): Promise<string[]> {
  try {
    const result = await execFileAsync("lsof", ["-ti", `tcp:${port}`]);
    return result.stdout
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

async function readProcessCommand(pid: string): Promise<string> {
  try {
    const result = await execFileAsync("ps", ["-p", pid, "-o", "command="]);
    return result.stdout.trim();
  } catch {
    return "";
  }
}

function isSpecWeftWebProcess(command: string): boolean {
  return command.includes("@specweft/web")
    || command.includes("packages/web")
    || command.includes("src/server.ts")
    || (command.includes("specweft") && command.includes(" start"))
    || (command.includes("packages/cli") && command.includes(" start"));
}

async function stopProcessTree(rootPid: string): Promise<void> {
  const descendants = await findDescendantPids(rootPid);
  const pids = [...descendants.reverse(), rootPid];

  for (const pid of pids) {
    try {
      process.kill(Number(pid), "SIGTERM");
    } catch {
      // The process may have exited while we were walking the tree.
    }
  }
}

async function waitForPortRelease(port: number): Promise<void> {
  let remainingSpecWeftPids: string[] = [];
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const pids = await findPidsOnPort(port);
    const specWeftPids = [];
    for (const pid of pids) {
      if (isSpecWeftWebProcess(await readProcessCommand(pid))) {
        specWeftPids.push(pid);
      }
    }

    if (specWeftPids.length === 0) {
      return;
    }
    remainingSpecWeftPids = specWeftPids;

    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  for (const pid of remainingSpecWeftPids) {
    const descendants = await findDescendantPids(pid);
    try {
      for (const childPid of descendants.reverse()) {
        process.kill(Number(childPid), "SIGKILL");
      }
      process.kill(Number(pid), "SIGKILL");
    } catch {
      // The process may have exited between the last lsof check and SIGKILL.
    }
  }
}

async function findDescendantPids(rootPid: string): Promise<string[]> {
  const processes = await listProcesses();
  const childrenByParent = new Map<string, string[]>();

  for (const processInfo of processes) {
    const children = childrenByParent.get(processInfo.ppid) ?? [];
    children.push(processInfo.pid);
    childrenByParent.set(processInfo.ppid, children);
  }

  const descendants: string[] = [];
  const stack = [...(childrenByParent.get(rootPid) ?? [])];
  while (stack.length > 0) {
    const pid = stack.pop();
    if (!pid) {
      continue;
    }
    descendants.push(pid);
    stack.push(...(childrenByParent.get(pid) ?? []));
  }

  return descendants;
}

async function listProcesses(): Promise<Array<{ pid: string; ppid: string }>> {
  try {
    const result = await execFileAsync("ps", ["-axo", "pid=,ppid="]);
    return result.stdout
      .split("\n")
      .map((line) => line.trim().split(/\s+/))
      .filter((parts) => parts.length >= 2 && parts[0] && parts[1])
      .map(([pid, ppid]) => ({ pid, ppid }));
  } catch {
    return [];
  }
}

async function resolveApiRequirement(repoPath: string, requirementId?: string) {
  if (!requirementId?.trim()) {
    return undefined;
  }

  const file = await listRequirements(repoPath);
  const requirement = file.requirements.find((item) => item.id === requirementId.trim());
  if (!requirement) {
    throw new Error(`Requirement not found: ${requirementId}`);
  }

  return requirement;
}
