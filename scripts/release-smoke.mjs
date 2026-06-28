import { execFile, spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const rootDir = path.resolve(import.meta.dirname, "..");
const packsDir = path.join(rootDir, ".packs");
const cliPackage = await readPackageJson("packages/cli/package.json");
const tarballs = {
  core: await resolveTarball("packages/core/package.json", "specweft-core"),
  web: await resolveTarball("packages/web/package.json", "specweft-web"),
  cli: await resolveTarball("packages/cli/package.json", "specweft"),
};

const workspaceDir = await mkdtemp(path.join(os.tmpdir(), "specweft-release-smoke-"));
const projectDir = path.join(workspaceDir, "demo-project");
const specweftHome = path.join(workspaceDir, "specweft-home");
const env = {
  ...process.env,
  SPECWEFT_HOME: specweftHome,
};
delete env.INIT_CWD;
delete env.SPECWEFT_REPO;

await execFileAsync("npm", ["init", "-y"], { cwd: workspaceDir, env });
await execFileAsync("npm", ["install", tarballs.core, tarballs.web, tarballs.cli], {
  cwd: workspaceDir,
  env,
  maxBuffer: 20 * 1024 * 1024,
});
await assertInstalledPackageReadmes(workspaceDir);
await assertInstalledPackageMetadata(workspaceDir);
await mkdir(projectDir, { recursive: true });
await writeFile(
  path.join(projectDir, "package.json"),
  JSON.stringify({
    name: "release-smoke-demo",
    scripts: {
      test: "vitest",
      build: "tsc",
    },
    devDependencies: {
      typescript: "latest",
    },
  }, null, 2),
  "utf-8",
);
await writeFile(path.join(projectDir, "index.ts"), "export const ok = true;\n", "utf-8");
await execFileAsync("git", ["init"], { cwd: projectDir, env });
await execFileAsync("git", ["config", "user.email", "specweft@example.com"], { cwd: projectDir, env });
await execFileAsync("git", ["config", "user.name", "SpecWeft"], { cwd: projectDir, env });
await execFileAsync("git", ["add", "."], { cwd: projectDir, env });
await execFileAsync("git", ["commit", "-m", "initial"], { cwd: projectDir, env });

const binPath = path.join(workspaceDir, "node_modules", ".bin", "specweft");

const help = await runSpecWeft(["--help"], workspaceDir);
assertIncludes(help, "SpecWeft", "help should print CLI usage");
assertIncludes(help, "用法:", "help should default to Chinese usage copy");
assertIncludes(help, "在 Codex/Claude 修改代码前生成上下文包", "help should describe task preparation in Chinese");
assertIncludes(help, "分析当前 git diff，并生成本次修改说明", "help should describe review in Chinese");
const englishHelp = await runSpecWeft(["--help"], workspaceDir, { ...env, SPECWEFT_LANG: "en" });
assertIncludes(englishHelp, "Usage:", "SPECWEFT_LANG=en should opt into English help");
assertIncludes(englishHelp, "Prepare a Context Pack", "English help should still describe task preparation");
const shortHelp = await runSpecWeft(["-h"], workspaceDir);
assertIncludes(shortHelp, "SpecWeft", "short help should print CLI usage");
const version = await runSpecWeft(["--version"], workspaceDir);
assertIncludes(version, cliPackage.version, "version should match packed CLI version");
const unknown = await runSpecWeftExpectFailure(["unknown-command"], workspaceDir);
assertIncludes(unknown, "specweft help", "unknown command should suggest help");

const initOutput = await runSpecWeft(["init"], projectDir);
assertIncludes(initOutput, "SpecWeft 初始化完成", "init should print a human-readable success message");
assertIncludes(initOutput, "specweft doctor", "init should suggest doctor as the next step");
const initJson = await runSpecWeft(["init", "--json"], projectDir);
assertIncludes(initJson, "\"bootstrapTool\"", "init --json should keep machine-readable output");
await assertFileIncludes(path.join(projectDir, "AGENTS.md"), "specweft.bootstrap_session");
await assertFileIncludes(path.join(projectDir, "CLAUDE.md"), "specweft.bootstrap_session");

const inspect = await runSpecWeft(["mcp-inspect"], projectDir);
assertIncludes(inspect, "SpecWeft MCP Inspect", "mcp-inspect should print a human-readable title");
assertIncludes(inspect, "Codex MCP 配置", "mcp-inspect should print Codex config by default");
assertIncludes(inspect, "Claude MCP 配置", "mcp-inspect should print Claude config by default");
assertIncludes(inspect, "specweft.bootstrap_session", "mcp-inspect should expose bootstrap_session");
assertIncludes(inspect, "specweft.get_memory_digest", "mcp-inspect should expose get_memory_digest");
assertIncludes(inspect, "specweft.get_requirement_dossier", "mcp-inspect should expose get_requirement_dossier");
assertIncludes(inspect, "specweft.start_work_segment", "mcp-inspect should expose start_work_segment");
assertIncludes(inspect, "specweft.get_work_segment_status", "mcp-inspect should expose get_work_segment_status");
assertIncludes(inspect, "specweft.get_capability_center", "mcp-inspect should expose get_capability_center");
assertIncludes(inspect, "specweft.create_memory_handoff", "mcp-inspect should expose create_memory_handoff");
const inspectJson = await runSpecWeft(["mcp-inspect", "--json"], projectDir);
assertIncludes(inspectJson, "\"clientConfig\"", "mcp-inspect --json should keep machine-readable client config");
assertIncludes(inspectJson, "\"specweft.prepare_task\"", "mcp-inspect --json should expose tool names");
const doctor = await runSpecWeft(["doctor"], projectDir);
assertIncludes(doctor, "SpecWeft Doctor", "doctor should print connection diagnostics");
assertIncludes(doctor, "核心 Agent 指令", "doctor should check the canonical local agent instruction file");
assertIncludes(doctor, "项目 Agent 指令副本", "doctor should report project-level instruction copies");
assertIncludes(doctor, "项目 Skill 选择", "doctor should report project Skill selections as readiness context");
assertIncludes(doctor, "项目 MCP 选择", "doctor should report project MCP selections as optional readiness context");
assertIncludes(doctor, "接入状态正常", "doctor should report a healthy initialized project");
assertIncludes(doctor, "specweft.prepare_task", "doctor should mention the expected MCP workflow");
assertIncludes(doctor, "guardrail.startWorkSegmentInput", "doctor should mention guardrail work segment boundaries");
assertIncludes(doctor, "guardrail.recordCurrentDiffInput", "doctor should mention guardrail diff recording");
assertIncludes(doctor, "需求记忆保护是可选项", "doctor memory protection copy should be localized");
await rm(path.join(projectDir, "AGENTS.md"), { force: true });
await rm(path.join(projectDir, "CLAUDE.md"), { force: true });
const doctorWithoutCopies = await runSpecWeft(["doctor"], projectDir);
assertIncludes(doctorWithoutCopies, "项目 Agent 指令副本", "doctor should still report missing project instruction copies");
assertIncludes(doctorWithoutCopies, "接入状态正常", "missing project instruction copies should not block MCP readiness");
await runSpecWeft(["init"], projectDir);
await execFileAsync("git", ["add", "."], { cwd: projectDir, env });
await execFileAsync("git", ["commit", "-m", "specweft init baseline"], { cwd: projectDir, env });
const setupCodex = await runSpecWeft(["setup-codex"], projectDir);
assertIncludes(setupCodex, "[mcp_servers.specweft]", "setup-codex should print a Codex MCP config snippet");
assertIncludes(setupCodex, "specweft.record_current_diff", "setup-codex should print the agent workflow");
const setupClaude = await runSpecWeft(["setup-claude"], projectDir);
assertIncludes(setupClaude, "\"mcpServers\"", "setup-claude should print a Claude MCP config JSON snippet");
assertIncludes(setupClaude, "specweft.record_current_diff", "setup-claude should print the agent workflow");
await assertFileIncludes(
  path.join(workspaceDir, "node_modules", "specweft", "dist", "mcp", "tools.js"),
  "diffTextOmitted",
);
await assertFileIncludes(
  path.join(workspaceDir, "node_modules", "specweft", "dist", "mcp", "server.js"),
  "readCliVersion",
);
await assertFileIncludes(
  path.join(workspaceDir, "node_modules", "@specweft", "core", "dist", "work-segments", "work-segment-manager.js"),
  "startWorkSegment",
);
await assertFileIncludes(
  path.join(workspaceDir, "node_modules", "@specweft", "core", "dist", "security", "memory-protection.js"),
  "protectMemoryFiles",
);
await assertFileIncludes(
  path.join(workspaceDir, "node_modules", "@specweft", "core", "dist", "activity", "agent-activity.js"),
  "recordAgentActivity",
);

const digest = await runSpecWeft(["digest"], projectDir);
assertIncludes(digest, "totalThreads", "digest should expose requirement-grouped memory metadata");

const protectionStatus = await runSpecWeft(["protect", "--status"], projectDir);
assertIncludes(protectionStatus, "SpecWeft 记忆保护", "protect --status should print memory protection status");
assertIncludes(protectionStatus, "未检测到", "protect --status should report missing key before migration");

const protectedEnv = {
  ...env,
  SPECWEFT_MEMORY_KEY: "release smoke memory key with enough entropy",
};
const protectedOutput = await runSpecWeft(["protect"], projectDir, protectedEnv);
assertIncludes(protectedOutput, "已加密", "protect should encrypt local memory state when a key is configured");
await assertFileIncludes(path.join(projectDir, ".specweft", "memory.json"), "specweftSecureJson");
await assertFileIncludes(path.join(projectDir, ".specweft", "agent-activity.json"), "specweftSecureJson");
env.SPECWEFT_MEMORY_KEY = protectedEnv.SPECWEFT_MEMORY_KEY;

const dossier = await runSpecWeft(["dossier"], projectDir);
assertIncludes(dossier, "SpecWeft Requirement Dossier", "dossier should print a human-readable requirement dossier");
assertIncludes(dossier, "release-smoke-demo", "dossier should print the project name");

const dossierJson = await runSpecWeft(["dossier", "--json"], projectDir);
assertIncludes(dossierJson, "totalRequirements", "dossier --json should expose requirement totals");
assertIncludes(dossierJson, "items", "dossier --json should expose requirement dossier items");

const prepare = await runSpecWeft(["prepare", "explain login change"], projectDir);
assertIncludes(prepare, "开始前判定", "prepare should print a human-readable Start Gate by default");
assertIncludes(prepare, "建议先读", "prepare should print source reading guidance by default");
assertIncludes(prepare, "推荐执行顺序", "prepare should print the execution plan in readable form");
assertIncludes(prepare, "specweft.start_work_segment", "prepare readable output should mark task boundaries");
assertIncludes(prepare, "specweft.record_current_diff", "prepare readable output should remind agents to record the final diff");
assertIncludes(prepare, "specweft prepare --task", "prepare readable output should point to --json for full context");
assertNotIncludes(prepare, "Ask:", "prepare readable output should not expose English debug action labels");
assertNotIncludes(prepare, "Matched by", "prepare readable output should not expose raw English file-match text");
assertNotIncludes(prepare, "Should the change", "prepare readable output should keep clarification questions localized");

const prepareJson = await runSpecWeft(["prepare", "--task", "explain login change", "--json"], projectDir);
assertIncludes(prepareJson, "skillSuggestions", "prepare --json should expose task Skill suggestions");
assertIncludes(prepareJson, "matchedSignals", "prepare --json should explain why Skills were suggested");
assertIncludes(prepareJson, "matchedRequirement", "prepare --json should expose matched requirement binding metadata");
assertIncludes(prepareJson, "executionPlan", "prepare --json should expose an agent execution plan");

const emptyReview = await runSpecWeftExpectFailure(["review", "--title", "empty review"], projectDir);
assertIncludes(emptyReview, "没有未提交的代码改动", "review should not persist empty diffs");

const segmentStart = await runSpecWeft(["segment", "start", "release smoke segment"], projectDir);
assertIncludes(segmentStart, "工作段已开始", "segment start should create a work segment boundary");

await writeFile(path.join(projectDir, "index.ts"), "export const ok = false;\n", "utf-8");
const review = await runSpecWeft(["review", "--title", "release smoke review"], projectDir);
assertIncludes(review, "需求上下文", "review should start with requirement context");
assertIncludes(review, "需求分块", "review should expose requirement-oriented digest sections");
assertIncludes(review, "为什么这样改", "review should explain why the change was made");
assertIncludes(review, "实现思路", "review should summarize the implementation approach");
assertIncludes(review, "阅读入口", "review should include digest-first reading entries");
assertIncludes(review, "高级详情", "review should keep detailed grouping in the saved report");
assertIncludes(review, "当前工作段", "review should mention the active work segment boundary");
const segmentStatus = await runSpecWeft(["segment", "status"], projectDir);
assertIncludes(segmentStatus, "release smoke review", "recorded review should close and title the active segment");
const cliActivity = await readPackedAgentActivity(projectDir, workspaceDir, env);
assertTruthy(
  cliActivity.events.some((event) => event.kind === "prepare_task" && event.source === "cli"),
  "CLI prepare should record agent activity",
);
assertTruthy(
  cliActivity.events.some((event) => event.kind === "start_work_segment" && event.source === "cli"),
  "CLI segment start should record agent activity",
);
assertTruthy(
  cliActivity.events.some((event) => event.kind === "record_current_diff" && event.source === "cli"),
  "CLI review should record agent activity",
);
assertTruthy(
  cliActivity.events.every((event) => !JSON.stringify(event).includes("export const ok = false")),
  "CLI activity should not store source code content",
);

const compactDossierAfterReview = await runSpecWeft(["dossier", "--json"], projectDir);
assertIncludes(compactDossierAfterReview, "\"sessions\": []", "compact dossier should not include full session history by default");
assertIncludes(compactDossierAfterReview, "\"sessionsOmitted\": 1", "compact dossier should count omitted sessions");
const fullDossierAfterReview = await runSpecWeft(["dossier", "--json", "--full"], projectDir);
assertIncludes(fullDossierAfterReview, "release smoke review", "dossier --full should include saved review session details");

const capabilities = await runSpecWeft(["capabilities"], projectDir);
assertIncludes(capabilities, "cli-ripgrep", "capabilities should include built-in CLI capabilities");
assertIncludes(capabilities, "filesystem", "capabilities should include MCP capabilities");

const handoff = await runSpecWeft(["handoff"], projectDir);
assertIncludes(handoff, "release-smoke-demo", "handoff should use current project");

const globalRepoStatus = await runSpecWeft(["--repo", projectDir, "status"], workspaceDir);
assertIncludes(globalRepoStatus, "release-smoke-demo", "global --repo before command should be accepted");

const invalidPort = await runSpecWeftExpectFailure(["start", "--port", "bad"], projectDir);
assertIncludes(invalidPort, "--port", "invalid port should explain the port option");

const positionalPortProcess = spawn(binPath, ["start", "4201"], {
  cwd: projectDir,
  env,
  stdio: ["ignore", "pipe", "pipe"],
});

try {
  await waitForBootstrap(projectDir, 4201);
  await assertApiError(
    `http://localhost:4201/api/recall?repo=${encodeURIComponent(projectDir)}&keyword=login&requirementId=missing`,
    "Requirement not found",
  );
} finally {
  positionalPortProcess.kill("SIGTERM");
}

const webProcess = spawn(binPath, ["start", "--port", "4199"], {
  cwd: projectDir,
  env,
  stdio: ["ignore", "pipe", "pipe"],
});

try {
  await waitForBootstrap(projectDir, 4199);
  const webHtml = await fetchText(`http://localhost:4199/?repo=${encodeURIComponent(projectDir)}`);
  assertIncludes(webHtml, "full-product-home", "packed Web UI should include the product workbench shell");
  assertIncludes(webHtml, "command-deck", "packed Web UI should include the main command deck");
  assertIncludes(webHtml, "SpecWeft 工作台", "packed Web UI should include localized workbench copy");
  assertIncludes(webHtml, "Skill Router", "packed Web UI should include Skill Router copy");
  assertIncludes(webHtml, "Review Lens", "packed Web UI should include Review Lens copy");
  assertIncludes(webHtml, "Memory Vault", "packed Web UI should include Memory Vault copy");
  assertIncludes(webHtml, "Agent Bridge", "packed Web UI should include Agent Bridge copy");
} finally {
  webProcess.kill("SIGTERM");
}

const firstUiProcess = spawn(binPath, ["start", "--port", "4202"], {
  cwd: projectDir,
  env,
  stdio: ["ignore", "pipe", "pipe"],
});

let secondUiProcess;
try {
  await waitForBootstrap(projectDir, 4202);
  secondUiProcess = spawn(binPath, ["start", "--port", "4202"], {
    cwd: projectDir,
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const restartOutput = await waitForProcessOutput(secondUiProcess, "Stopped existing SpecWeft Web UI on port 4202");
  assertIncludes(restartOutput, "current version", "start should restart an existing SpecWeft UI on the same port");
  await waitForBootstrap(projectDir, 4202);
} finally {
  firstUiProcess.kill("SIGTERM");
  secondUiProcess?.kill("SIGTERM");
}

const blockingServer = spawn(process.execPath, [
  "-e",
  "require('node:http').createServer((_,res)=>res.end('busy')).listen(4203, '127.0.0.1')",
], {
  cwd: projectDir,
  env,
  stdio: ["ignore", "pipe", "pipe"],
});
let shiftedUiProcess;

try {
  await waitForTextResponse("http://127.0.0.1:4203", "busy");
  shiftedUiProcess = spawn(binPath, ["start", "--port", "4203"], {
    cwd: projectDir,
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const shiftedOutput = await waitForProcessOutput(shiftedUiProcess, "Port 4203 is used by another app, trying 4204");
  assertIncludes(shiftedOutput, "trying 4204", "start should move to the next port when another app owns the requested port");
  await waitForBootstrap(projectDir, 4204);
} finally {
  blockingServer.kill("SIGTERM");
  shiftedUiProcess?.kill("SIGTERM");
}

process.stdout.write(`Release smoke passed in ${workspaceDir}\n`);

async function resolveTarball(packageJsonRelativePath, tarballBaseName) {
  const packageJson = await readPackageJson(packageJsonRelativePath);
  return path.join(packsDir, `${tarballBaseName}-${packageJson.version}.tgz`);
}

async function readPackageJson(packageJsonRelativePath) {
  return JSON.parse(
    await readFile(path.join(rootDir, packageJsonRelativePath), "utf-8"),
  );
}

async function runSpecWeft(args, cwd, commandEnv = env) {
  const result = await execFileAsync(binPath, args, {
    cwd,
    env: commandEnv,
    maxBuffer: 20 * 1024 * 1024,
  });
  return result.stdout;
}

async function runSpecWeftExpectFailure(args, cwd) {
  try {
    await execFileAsync(binPath, args, {
      cwd,
      env,
      maxBuffer: 20 * 1024 * 1024,
    });
  } catch (error) {
    return `${error.stdout ?? ""}${error.stderr ?? ""}`;
  }

  throw new Error(`Expected specweft ${args.join(" ")} to fail`);
}

async function assertFileIncludes(filePath, expected) {
  const content = await readFile(filePath, "utf-8");
  assertIncludes(content, expected, `${filePath} should include ${expected}`);
}

async function assertInstalledPackageReadmes(installedRoot) {
  const cliReadme = await readFile(path.join(installedRoot, "node_modules", "specweft", "README.md"), "utf-8");
  assertIncludes(cliReadme, "Review Lens", "packed CLI README should describe the current Review Lens workflow");
  assertIncludes(cliReadme, "Memory Vault", "packed CLI README should describe the current memory workflow");

  const webReadme = await readFile(path.join(installedRoot, "node_modules", "@specweft", "web", "README.md"), "utf-8");
  assertIncludes(webReadme, "SpecWeft Workbench", "packed Web README should describe the current workbench");
  assertIncludes(webReadme, "Agent Bridge", "packed Web README should describe the connection surface");

  const coreReadme = await readFile(path.join(installedRoot, "node_modules", "@specweft", "core", "README.md"), "utf-8");
  assertIncludes(coreReadme, "Agent Harness generation", "packed Core README should mention harness generation");
  assertIncludes(coreReadme, "memory protection", "packed Core README should mention memory protection");
}

async function assertInstalledPackageMetadata(installedRoot) {
  const cli = await readInstalledPackageJson(installedRoot, "specweft", "package.json");
  assertIncludes(cli.description, "Skill workflow", "packed CLI description should reflect the current product positioning");
  assertTruthy(cli.keywords.includes("skills"), "packed CLI keywords should include skills");
  assertTruthy(cli.keywords.includes("context"), "packed CLI keywords should include context");

  const web = await readInstalledPackageJson(installedRoot, "@specweft", "web", "package.json");
  assertIncludes(web.description, "task preparation", "packed Web description should reflect the current workbench");
  assertTruthy(web.keywords.includes("review"), "packed Web keywords should include review");
  assertTruthy(web.keywords.includes("memory"), "packed Web keywords should include memory");

  const core = await readInstalledPackageJson(installedRoot, "@specweft", "core", "package.json");
  assertIncludes(core.description, "Agent Harness", "packed Core description should reflect the current workflow");
  assertTruthy(core.keywords.includes("skills"), "packed Core keywords should include skills");
  assertTruthy(core.keywords.includes("memory"), "packed Core keywords should include memory");
}

async function readInstalledPackageJson(installedRoot, ...relativeParts) {
  return JSON.parse(
    await readFile(path.join(installedRoot, "node_modules", ...relativeParts), "utf-8"),
  );
}

async function readPackedAgentActivity(repoPath, installedRoot, commandEnv) {
  const script = [
    "import { readAgentActivity } from '@specweft/core';",
    "const activity = await readAgentActivity(process.argv[1], 80);",
    "console.log(JSON.stringify(activity));",
  ].join("\n");
  const result = await execFileAsync(process.execPath, ["--input-type=module", "-e", script, repoPath], {
    cwd: installedRoot,
    env: commandEnv,
    maxBuffer: 20 * 1024 * 1024,
  });

  return JSON.parse(result.stdout);
}

async function waitForBootstrap(repoPath, port) {
  const url = `http://localhost:${port}/api/bootstrap?repo=${encodeURIComponent(repoPath)}`;
  let lastError;

  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      const response = await fetch(url);
      const body = await response.text();
      if (response.ok && body.includes("specweft.bootstrap_session")) {
        return;
      }
      lastError = new Error(`Unexpected response: ${response.status} ${body.slice(0, 120)}`);
    } catch (error) {
      lastError = error;
    }

    await delay(200);
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

async function assertApiError(url, expected) {
  const response = await fetch(url);
  const body = await response.text();

  if (response.ok) {
    throw new Error(`Expected API error for ${url}`);
  }
  assertIncludes(body, expected, `API error should include ${expected}`);
}

async function waitForTextResponse(url, expected) {
  let lastError;

  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      const response = await fetch(url);
      const body = await response.text();
      if (response.ok && body.includes(expected)) {
        return;
      }
      lastError = new Error(`Unexpected response: ${response.status} ${body.slice(0, 120)}`);
    } catch (error) {
      lastError = error;
    }

    await delay(200);
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

async function fetchText(url) {
  const response = await fetch(url);
  const body = await response.text();

  if (!response.ok) {
    throw new Error(`Unexpected response for ${url}: ${response.status} ${body.slice(0, 120)}`);
  }

  return body;
}

async function waitForProcessOutput(child, expected) {
  let output = "";
  let lastError;

  child.stdout.on("data", (chunk) => {
    output += chunk.toString();
  });
  child.stderr.on("data", (chunk) => {
    output += chunk.toString();
  });

  for (let attempt = 0; attempt < 30; attempt += 1) {
    if (output.includes(expected)) {
      return output;
    }
    if (child.exitCode !== null) {
      lastError = new Error(`Process exited before expected output. Output: ${output}`);
      break;
    }
    await delay(200);
  }

  throw lastError ?? new Error(`Timed out waiting for ${expected}. Output: ${output}`);
}

function assertIncludes(value, expected, message) {
  if (!value.includes(expected)) {
    throw new Error(message);
  }
}

function assertNotIncludes(value, expected, message) {
  if (value.includes(expected)) {
    throw new Error(message);
  }
}

function assertTruthy(value, message) {
  if (!value) {
    throw new Error(message);
  }
}
