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

  const dashboard = await getJson(`/api/dashboard?repo=${encodeURIComponent(projectDir)}`);
  assertEqual(dashboard.profile.name, "web-api-smoke-demo", "dashboard should load the requested project profile");
  assertTruthy(dashboard.mcpInspect.tools.includes("specweft.prepare_task"), "dashboard should include MCP inspect metadata");
  assertTruthy(dashboard.workSegments.summary.total === 0, "fresh project should not have work segments");

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

  const segment = await postJson("/api/work-segments/start", {
    repoPath: projectDir,
    task: "帮我优化登录提示",
    title: "登录提示优化",
    requirementId: requirement.id,
  });
  assertEqual(segment.segment.title, "登录提示优化", "work segment should use the provided title");

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

  const dossier = await getJson(`/api/requirement-dossier?repo=${encodeURIComponent(projectDir)}&full=true`);
  assertTruthy(dossier.items.some((item) => item.title === "登录提示优化"), "dossier should include the recorded requirement");
  assertTruthy(dossier.items.some((item) => item.sessions.some((session) => session.title === "登录提示优化")), "full dossier should include review sessions");

  const handoff = await getJson(`/api/handoff?repo=${encodeURIComponent(projectDir)}&keyword=${encodeURIComponent("登录")}`);
  assertTruthy(handoff.handoff.prompt.includes("SpecWeft"), "handoff should return a new-thread prompt");

  const inspect = await getJson(`/api/mcp-inspect?repo=${encodeURIComponent(projectDir)}`);
  assertTruthy(inspect.tools.includes("specweft.record_current_diff"), "mcp inspect should expose record_current_diff");
  assertTruthy(inspect.workflow.some((item) => item.includes("start_work_segment")), "mcp inspect workflow should mention work segments");

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
