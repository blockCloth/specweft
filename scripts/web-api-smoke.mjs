import { execFile, spawn } from "node:child_process";
import { mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const rootDir = path.resolve(import.meta.dirname, "..");
const workspaceDir = await mkdtemp(path.join(os.tmpdir(), "specweft-web-api-smoke-"));
const projectDir = path.join(workspaceDir, "demo-project");
const specweftHome = path.join(workspaceDir, "specweft-home");
const port = 4317;
const env = {
  ...process.env,
  SPECWEFT_HOME: specweftHome,
  INIT_CWD: rootDir,
};

await mkdir(projectDir, { recursive: true });
await writeFile(
  path.join(projectDir, "package.json"),
  JSON.stringify({
    name: "web-api-smoke-demo",
    scripts: {
      test: "node --test",
      build: "tsc",
    },
    devDependencies: {
      typescript: "latest",
    },
  }, null, 2),
  "utf-8",
);
await writeFile(path.join(projectDir, "login.ts"), "export const login = 'old';\n", "utf-8");
const otherProjectDir = path.join(workspaceDir, "unregistered-project");
await mkdir(otherProjectDir, { recursive: true });
await writeFile(path.join(otherProjectDir, "package.json"), JSON.stringify({ name: "unregistered-project" }, null, 2), "utf-8");
const realOtherProjectDir = await realpath(otherProjectDir);
await execFileAsync("git", ["init"], { cwd: projectDir, env });
await execFileAsync("git", ["config", "user.email", "specweft@example.com"], { cwd: projectDir, env });
await execFileAsync("git", ["config", "user.name", "SpecWeft"], { cwd: projectDir, env });
await execFileAsync("git", ["add", "."], { cwd: projectDir, env });
await execFileAsync("git", ["commit", "-m", "initial"], { cwd: projectDir, env });

const server = spawn(
  "node",
  [path.join(rootDir, "packages", "web", "dist", "server.js"), "--repo", projectDir, "--port", String(port)],
  {
    cwd: rootDir,
    env,
    stdio: ["ignore", "pipe", "pipe"],
  },
);

try {
  await waitForJson(`/api/bootstrap?repo=${encodeURIComponent(projectDir)}`);

  await assertHttpError(
    `/api/dashboard?repo=${encodeURIComponent(otherProjectDir)}`,
    { method: "GET" },
    400,
    "Project is not registered",
  );

  const registered = await postJson("/api/projects/register", {
    repoPath: otherProjectDir,
  });
  assertTruthy(
    registered.projects.some((project) => project.rootPath === realOtherProjectDir),
    "projects/register should explicitly allow adding a new project",
  );

  const dashboardSummary = await getJson(`/api/dashboard/summary?repo=${encodeURIComponent(projectDir)}`);
  assertEqual(dashboardSummary.partial, true, "dashboard summary should mark itself as a fast partial payload");
  assertEqual(dashboardSummary.profile.name, "web-api-smoke-demo", "dashboard summary should include project profile");
  assertTruthy(dashboardSummary.memoryDigest, "dashboard summary should include memory digest for the first screen");
  assertTruthy(dashboardSummary.recordingStatus, "dashboard summary should include recording status for the first screen");
  assertTruthy(dashboardSummary.connectionDoctor.ready, "dashboard summary should include connection health");
  assertTruthy(dashboardSummary.mcpInspect.tools.includes("specweft.prepare_task"), "dashboard summary should include MCP inspect metadata");

  const dashboard = await getJson(`/api/dashboard?repo=${encodeURIComponent(projectDir)}`);
  assertEqual(dashboard.profile.name, "web-api-smoke-demo", "dashboard should load the requested project profile");
  assertTruthy(dashboard.mcpInspect.tools.includes("specweft.prepare_task"), "dashboard should include MCP inspect metadata");
  assertTruthy(dashboard.connectionDoctor.ready, "dashboard should include connection doctor status");
  assertTruthy(dashboard.connectionDoctor.checks.some((check) => check.id === "agent-harness"), "connection doctor should check agent harness files");
  assertEqual(dashboard.agentConnectionPackage.server.name, "specweft", "dashboard should include the reusable agent connection package");
  assertTruthy(dashboard.agentConnectionPackage.clients.some((client) => client.client === "codex" && client.configFormat === "toml"), "connection package should expose Codex setup");
  assertTruthy(dashboard.agentConnectionPackage.clients.some((client) => client.client === "claude" && client.configFormat === "json"), "connection package should expose Claude setup");
  assertTruthy(dashboard.agentConnectionPackage.autoUseFlow.some((step) => step.mcpTools.includes("specweft.prepare_task")), "connection package should describe prepare_task flow");
  assertTruthy(dashboard.agentConnectionPackage.autoUseFlow.some((step) => step.mcpTools.includes("specweft.record_current_diff")), "connection package should describe record_current_diff flow");
  assertTruthy(dashboard.projectReadiness.items.some((item) => item.id === "agent-connection"), "dashboard should include project readiness");
  assertTruthy(dashboard.projectReadiness.items.some((item) => item.id === "change-review"), "project readiness should include review status");
  assertTruthy(dashboard.projectReadiness.items.every((item) => item.nextSteps.length > 0), "project readiness should include actionable next steps");
  assertTruthy(dashboard.projectReadiness.items.every((item) => item.agentTools.length > 0), "project readiness should expose agent tool hints");
  assertTruthy(dashboard.projectReadiness.items.every((item) => item.uiAction?.target), "project readiness should expose UI actions");
  assertTruthy(dashboard.agentActivity, "dashboard should include recent agent activity");
  assertTruthy(dashboard.agentActivity.events.some((event) => event.kind === "bootstrap_session"), "bootstrap endpoint should record agent activity");
  assertEqual(dashboard.bootstrapSession.projectName, "web-api-smoke-demo", "dashboard should include the agent bootstrap session");
  assertTruthy(dashboard.bootstrapSession.workflow.some((item) => item.when.includes("coding session")), "bootstrap session should expose the agent workflow");
  assertTruthy(dashboard.bootstrapSession.memoryDigest, "bootstrap session should include the memory digest entry point");
  assertTruthy(dashboard.agentHarness.files.some((file) => file.client === "codex" && file.kind === "skill"), "dashboard should expose Codex harness Skills");
  assertTruthy(dashboard.agentHarness.files.some((file) => file.client === "claude" && file.kind === "command"), "dashboard should expose Claude harness commands");
  assertTruthy(dashboard.instructionPaths.some((filePath) => filePath.endsWith(".specweft/agent-instructions.md")), "dashboard should expose generated instruction files");
  assertTruthy(dashboard.settings.contextMemory.maxRetainedTurns > 0, "dashboard should include project settings");
  assertTruthy(dashboard.skillUpdateCheck, "dashboard should include Skill update check status");
  assertEqual(dashboard.mcpInspect.settings.mcpStdioTimeoutMs, dashboard.settings.capabilities.mcpStdioTimeoutMs, "mcp inspect should expose project MCP timeout settings");
  assertTruthy(dashboard.workSegments.summary.total === 0, "fresh project should not have work segments");

  const savedSettings = await postJson("/api/settings", {
    repoPath: projectDir,
    settings: {
      changeRecording: {
        retentionDays: 14,
      },
      contextMemory: {
        maxRetainedTurns: 2,
        compressionStrategy: "summary",
        ignorePaths: ["dist/"],
      },
    },
  });
  assertEqual(savedSettings.changeRecording.retentionDays, 14, "settings API should persist retention days");
  assertEqual(savedSettings.contextMemory.maxRetainedTurns, 2, "settings API should persist max retained turns");
  const reloadedSettings = await getJson(`/api/settings?repo=${encodeURIComponent(projectDir)}`);
  assertEqual(reloadedSettings.contextMemory.ignorePaths[0], "dist", "settings API should normalize ignored paths");

  const skillUpdates = await getJson(`/api/marketplace/skills/updates?repo=${encodeURIComponent(projectDir)}`);
  assertEqual(skillUpdates.enabled, true, "Skill update check should respect enabled project settings");
  assertTruthy(Array.isArray(skillUpdates.items), "Skill update check should return item status list");

  const readiness = await getJson(`/api/project-readiness?repo=${encodeURIComponent(projectDir)}`);
  assertTruthy(readiness.items.some((item) => item.id === "skill-path"), "project readiness API should expose Skill path status");
  assertTruthy(readiness.items.every((item) => item.target), "project readiness items should include UI/agent targets");
  assertTruthy(readiness.items.some((item) => item.commands.includes("specweft review")), "project readiness should expose verification commands");

  const requirement = await postJson("/api/requirements", {
    repoPath: projectDir,
    title: "登录提示优化",
    keywords: ["login", "登录"],
  });
  assertEqual(requirement.title, "登录提示优化", "requirement API should create a requirement");

  const prepared = await postJson("/api/prepare", {
    repoPath: projectDir,
    task: "帮我优化登录提示",
  });
  assertTruthy(prepared.executionPlan.some((item) => item.tool === "specweft.start_work_segment"), "prepare should include start_work_segment");
  assertTruthy(prepared.guardrail.boundaryRequired, "prepare should include an agent boundary guardrail");
  assertEqual(prepared.guardrail.startWorkSegmentInput.task, "帮我优化登录提示", "guardrail should preserve the original task for start_work_segment");
  assertTruthy(prepared.skillSuggestions.length > 0, "prepare should recommend task Skills");
  const prepareActivity = await getJson(`/api/agent-activity?repo=${encodeURIComponent(projectDir)}`);
  assertTruthy(prepareActivity.events.some((event) => event.kind === "prepare_task"), "prepare should record agent activity");

  const segment = await postJson("/api/work-segments/start", {
    repoPath: projectDir,
    ...prepared.guardrail.startWorkSegmentInput,
  });
  assertEqual(segment.segment.title, "登录提示优化", "work segment should use the provided title");
  assertEqual(segment.segment.requirementId, requirement.id, "work segment should be driven by prepared guardrail requirement id");
  const segmentActivity = await getJson(`/api/agent-activity?repo=${encodeURIComponent(projectDir)}`);
  assertTruthy(segmentActivity.events.some((event) => event.kind === "start_work_segment"), "work segment start should record agent activity");

  await writeFile(path.join(projectDir, "login.ts"), "export const login = 'new';\n", "utf-8");

  const review = await postJson("/api/review", {
    repoPath: projectDir,
    requirementId: requirement.id,
  });
  assertEqual(review.title, "登录提示优化", "review should use the active work segment title when title is omitted");
  assertEqual(review.review.reviewDigest.title, "登录提示优化", "review digest should use the requirement title");
  assertTruthy(review.review.reviewDigest.oneLineSummary.includes("本次修改围绕"), "review digest should include a context-first summary");
  assertTruthy(review.review.reviewDigest.sections.length > 0, "review digest should expose requirement sections");
  assertTruthy(
    review.review.reviewDigest.sections.some((section) => section.readingEntry?.path === "login.ts"),
    "review digest sections should include reading entries",
  );
  assertTruthy(review.review.reviewDigest.readingPath.some((item) => item.path === "login.ts"), "review digest should include read-first source entries");
  assertTruthy(review.review.reviewOverview.batches.length > 0, "review should expose overview batches");
  assertTruthy(
    review.review.reviewOverview.batches.some((batch) => batch.title.includes("登录提示优化")),
    "review overview batches should include the active requirement title",
  );
  assertTruthy(review.review.requirementBlocks.length > 0, "review should expose requirement blocks");
  assertTruthy(
    review.review.requirementBlocks.some((block) => block.kind === "current-work"),
    "review should mark current-work requirement blocks",
  );
  assertTruthy(review.html.includes("本次修改概览"), "review HTML should include overview section");
  assertTruthy(review.html.includes("需求拆解"), "review HTML should include requirement block section");
  assertTruthy(review.workSegments.summary.recorded >= 1, "review should close the active work segment");
  assertEqual(review.recordingStatus.status, "recorded", "review should record the current diff");
  assertTruthy(review.requirementDossier.totalSessions >= 1, "review response should refresh requirement dossier");
  const reviewActivity = await getJson(`/api/agent-activity?repo=${encodeURIComponent(projectDir)}`);
  assertTruthy(reviewActivity.events.some((event) => event.kind === "record_current_diff"), "review should record diff activity");
  assertTruthy(reviewActivity.summary.total >= 3, "activity log should include prepare, segment, and review events");

  const sourcePreview = await getJson(`/api/source-preview?repo=${encodeURIComponent(projectDir)}&path=${encodeURIComponent("login.ts")}`);
  assertEqual(sourcePreview.path, "login.ts", "source preview should use a project-relative path");
  assertTruthy(sourcePreview.content.includes("new"), "source preview should include the current source snippet");
  assertTruthy(sourcePreview.totalLines >= 1, "source preview should include line metadata");

  await assertHttpError(
    `/api/source-preview?repo=${encodeURIComponent(projectDir)}&path=${encodeURIComponent("../package.json")}`,
    { method: "GET" },
    400,
    "must stay inside the project",
  );

  const dossier = await getJson(`/api/requirement-dossier?repo=${encodeURIComponent(projectDir)}&full=true`);
  assertTruthy(dossier.items.some((item) => item.title === "登录提示优化"), "dossier should include the recorded requirement");
  assertTruthy(dossier.items.some((item) => item.sessions.some((session) => session.title === "登录提示优化")), "full dossier should include review sessions");

  const restored = await postJson("/api/restore-requirement", {
    repoPath: projectDir,
    requirementId: requirement.id,
  });
  assertEqual(restored.requirement.title, "登录提示优化", "restore should return the selected requirement");
  assertTruthy(restored.sessions.length > 0, "restore should return requirement-scoped sessions");
  assertTruthy(restored.handoff.prompt.includes("SpecWeft"), "restore should include a new-thread handoff prompt");

  const handoff = await getJson(`/api/handoff?repo=${encodeURIComponent(projectDir)}&keyword=${encodeURIComponent("登录")}`);
  assertTruthy(handoff.handoff.prompt.includes("SpecWeft"), "handoff should return a new-thread prompt");

  const inspect = await getJson(`/api/mcp-inspect?repo=${encodeURIComponent(projectDir)}`);
  assertTruthy(inspect.tools.includes("specweft.record_current_diff"), "mcp inspect should expose record_current_diff");
  assertTruthy(inspect.tools.includes("specweft.get_project_readiness"), "mcp inspect should expose get_project_readiness");
  assertTruthy(inspect.tools.includes("specweft.get_agent_activity"), "mcp inspect should expose get_agent_activity");
  assertEqual(inspect.settings.mcpStdioTimeoutMs, 15000, "mcp inspect should expose MCP timeout");
  assertTruthy(inspect.workflow.some((item) => item.includes("start_work_segment")), "mcp inspect workflow should mention work segments");

  const doctor = await getJson(`/api/connection-doctor?repo=${encodeURIComponent(projectDir)}`);
  assertTruthy(doctor.ready, "connection doctor API should report the initialized project as ready");
  assertTruthy(doctor.nextSteps.some((item) => item.includes("setup-codex")), "connection doctor should return next steps");

  await assertHttpError("/api/prepare", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: "{bad-json",
  }, 400, "Request body must be valid JSON.");

  process.stdout.write("Web API smoke passed\n");
} finally {
  server.kill("SIGTERM");
  await rm(workspaceDir, { recursive: true, force: true });
}

async function waitForJson(route) {
  let lastError;

  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      return await getJson(route);
    } catch (error) {
      lastError = error;
      await delay(200);
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

async function getJson(route) {
  return requestJson(route, {
    method: "GET",
  });
}

async function postJson(route, body) {
  return requestJson(route, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

async function requestJson(route, init) {
  const response = await fetch(`http://localhost:${port}${route}`, init);
  const text = await response.text();

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${route}: ${text}`);
  }

  return JSON.parse(text);
}

async function assertHttpError(route, init, expectedStatus, expectedText) {
  const response = await fetch(`http://localhost:${port}${route}`, init);
  const text = await response.text();

  if (response.status !== expectedStatus) {
    throw new Error(`Expected HTTP ${expectedStatus} for ${route}, received ${response.status}: ${text}`);
  }
  if (!text.includes(expectedText)) {
    throw new Error(`Expected error body to include ${expectedText}, received: ${text}`);
  }
}

function assertTruthy(value, message) {
  if (!value) {
    throw new Error(message);
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}. Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
  }
}
