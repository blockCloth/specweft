import path from "node:path";
import { execFile } from "node:child_process";
import { realpath } from "node:fs/promises";
import type { Server } from "node:http";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { serve } from "@hono/node-server";
import {
  applyProjectMcp,
  applyProjectSkill,
  createBootstrapSession,
  createCapabilityCenter,
  createMemoryDigest,
  createMemoryIndex,
  createMemoryHandoff,
  createMemoryTimeline,
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
  initializeProject,
  installMarketplaceMcp,
  installMarketplaceSkill,
  listRegisteredProjects,
  listRequirements,
  previewMarketplaceSkill,
  prepareTask,
  recallSessions,
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
} from "@specweft/core";
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
  return context.json(await registerProject(repoPath));
});

app.post("/api/projects/active", async (context) => {
  const body = await readJsonBody<ProjectBody>(context);
  const repoPath = await resolveRequestRepo(body.repoPath);
  return context.json(await setActiveProject(repoPath));
});

app.get("/api/dashboard", async (context) => {
  const repoPath = await resolveRequestRepo(context.req.query("repo"));
  await ensureWebProjectReady(repoPath);

  const [profile, assembly, mcpInspect] = await Promise.all([
    scanProject(repoPath),
    createRuntimeAssembly(repoPath),
    createMcpInspect(repoPath),
  ]);
  const capabilityCenter = await createCapabilityCenter(profile, repoPath);
  const recommendations = await recommendForProject(profile, repoPath);
  const requirements = await listRequirements(repoPath);
  const [timeline, recordingStatus] = await Promise.all([
    createMemoryTimeline(repoPath, profile),
    getRecordingStatus(repoPath),
  ]);
  const [workSegments, memoryDigest, requirementDossier, memoryProtection] = await Promise.all([
    createWorkSegmentStatus(repoPath, profile),
    createMemoryDigest(repoPath, profile),
    createRequirementDossier(repoPath, profile, {
      sessionPreviewLimit: 3,
    }),
    getMemoryProtectionStatus(repoPath),
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
    recordingStatus,
    workSegments,
    llmConfig,
    assembly,
    mcpInspect,
  });
});

app.get("/api/bootstrap", async (context) => {
  const repoPath = await resolveRequestRepo(context.req.query("repo"));
  const keyword = context.req.query("keyword")?.trim();
  return context.json(await createBootstrapSession(repoPath, keyword));
});

app.post("/api/prepare", async (context) => {
  const body = await readJsonBody<PrepareBody>(context);
  const repoPath = await resolveRequestRepo(body.repoPath);

  if (!body.task?.trim()) {
    return context.json({ error: "Task is required." }, 400);
  }

  return context.json(await prepareTask(repoPath, body.task));
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

  return context.json(await restoreRequirementMemory(repoPath, profile, {
    keyword: body.keyword,
    requirement,
  }));
});

app.post("/api/task-skills", async (context) => {
  const body = await readJsonBody<PrepareBody>(context);
  const repoPath = await resolveRequestRepo(body.repoPath);

  if (!body.task?.trim()) {
    return context.json({ error: "Task is required." }, 400);
  }

  const profile = await scanProject(repoPath);
  return context.json({
    profile,
    skillSuggestions: await recommendSkillsForTask(profile, repoPath, body.task),
  });
});

app.get("/api/marketplace/skills", async (context) => {
  const repoPath = await resolveRequestRepo(context.req.query("repo"));
  const keyword = context.req.query("keyword")?.trim();
  const profile = await scanProject(repoPath);
  const recommendations = await recommendForProject(profile, repoPath);
  return context.json(await recommendMarketplaceSkills(profile, recommendations, {
    keywords: keyword ? [keyword] : undefined,
  }));
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

  return context.json(await startWorkSegment(repoPath, {
    projectId: profile.id,
    requirement,
    task: body.task ?? body.title ?? requirement?.title ?? "未命名工作段",
    title: body.title,
  }));
});

app.post("/api/work-segments/complete", async (context) => {
  const body = await readJsonBody<WorkSegmentBody>(context);
  const repoPath = await resolveRequestRepo(body.repoPath);
  return context.json({
    segment: await completeWorkSegment(repoPath, {
      segmentId: body.segmentId,
      status: body.status,
      title: body.title,
      summary: body.summary,
    }),
  });
});

app.post("/api/requirements", async (context) => {
  const body = await readJsonBody<RequirementBody>(context);
  const repoPath = await resolveRequestRepo(body.repoPath);
  const profile = await scanProject(repoPath);

  if (!body.title?.trim()) {
    return context.json({ error: "Requirement title is required." }, 400);
  }

  return context.json(await createRequirement(repoPath, {
    projectId: profile.id,
    title: body.title,
    keywords: body.keywords,
    summary: body.summary,
  }));
});

app.post("/api/requirements/active", async (context) => {
  const body = await readJsonBody<RequirementBody>(context);
  const repoPath = await resolveRequestRepo(body.repoPath);
  const id = assertId(body.id);
  return context.json(await setActiveRequirement(repoPath, id));
});

app.get("/api/assembly", async (context) => {
  const repoPath = await resolveRequestRepo(context.req.query("repo"));
  return context.json(await createRuntimeAssembly(repoPath));
});

app.get("/api/mcp-inspect", async (context) => {
  const repoPath = await resolveRequestRepo(context.req.query("repo"));
  return context.json(await createMcpInspect(repoPath));
});

app.get("/api/llm-config", async (context) => {
  return context.json(createLlmConfigStatus());
});

app.get("/api/skills/:id", async (context) => {
  const id = assertId(context.req.param("id"));
  const detail = await readSkillDetail(id);

  if (!detail) {
    return context.json({ error: `Skill not found: ${id}` }, 404);
  }

  return context.json(detail);
});

app.post("/api/selection/:action", async (context) => {
  const action = context.req.param("action");
  const body = await readJsonBody<SelectionBody>(context);
  const repoPath = await resolveRequestRepo(body.repoPath);
  const type = assertSelectionType(body.type);
  const id = assertId(body.id);

  if (action === "apply" && type === "mcp") {
    return context.json(await applyProjectMcp(repoPath, id));
  }
  if (action === "apply" && type === "skill") {
    return context.json(await applyProjectSkill(repoPath, id));
  }
  if (action === "disable" && type === "mcp") {
    return context.json(await disableProjectMcp(repoPath, id));
  }
  if (action === "disable" && type === "skill") {
    return context.json(await disableProjectSkill(repoPath, id));
  }
  if (action === "ignore" && type === "mcp") {
    return context.json(await ignoreProjectMcp(repoPath, id));
  }
  if (action === "ignore" && type === "skill") {
    return context.json(await ignoreProjectSkill(repoPath, id));
  }

  return context.json({ error: `Unknown selection action: ${action}` }, 400);
});

app.post("/api/review", async (context) => {
  const body = await readJsonBody<ReviewBody>(context);
  const repoPath = await resolveRequestRepo(body.repoPath);
  const profile = await scanProject(repoPath);
  const report = await createReviewReport(repoPath, profile, body.title, 7, body.requirementId);

  return context.json({
    title: report.title,
    reportPath: report.reportPath,
    memory: report.memory,
    review: report.review,
    html: report.html,
    markdown: report.markdown,
    recordingStatus: await getRecordingStatus(repoPath),
    workSegments: await createWorkSegmentStatus(repoPath, profile),
    timeline: await createMemoryTimeline(repoPath, profile),
    requirementDossier: await createRequirementDossier(repoPath, profile, { sessionPreviewLimit: 3 }),
  });
});

app.post("/api/record-current-diff", async (context) => {
  const body = await readJsonBody<ReviewBody>(context);
  const repoPath = await resolveRequestRepo(body.repoPath);
  const profile = await scanProject(repoPath);
  const report = await createReviewReport(repoPath, profile, body.title, 7, body.requirementId);

  return context.json({
    title: report.title,
    reportPath: report.reportPath,
    memory: report.memory,
    requirement: report.requirement,
    review: report.review,
    html: report.html,
    markdown: report.markdown,
    recordingStatus: await getRecordingStatus(repoPath),
    workSegments: await createWorkSegmentStatus(repoPath, profile),
    timeline: await createMemoryTimeline(repoPath, profile),
    requirementDossier: await createRequirementDossier(repoPath, profile, { sessionPreviewLimit: 3 }),
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

  return context.json({
    sessions: await recallSessions(repoPath, keyword, requirementId),
  });
});

app.get("/api/handoff", async (context) => {
  const repoPath = await resolveRequestRepo(context.req.query("repo"));
  const keyword = context.req.query("keyword")?.trim();
  const profile = await scanProject(repoPath);
  const requirement = keyword ? undefined : await getActiveRequirement(repoPath);

  return context.json({
    handoff: await createMemoryHandoff(repoPath, profile, keyword, 5, requirement),
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

async function ensureWebProjectReady(repoPath: string): Promise<void> {
  await initializeGlobalPools();
  await initializeProject(repoPath);
  await registerProject(repoPath);
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

function createMcpInspect(repoPath: string) {
  const clientConfig = createMcpClientConfig(repoPath);

  return {
    server: "specweft",
    transport: "stdio",
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
