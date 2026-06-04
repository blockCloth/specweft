import { execFile, spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const rootDir = path.resolve(import.meta.dirname, "..");
const packsDir = path.join(rootDir, ".packs");
const tarballs = {
  core: path.join(packsDir, "specweft-core-0.1.0.tgz"),
  web: path.join(packsDir, "specweft-web-0.1.0.tgz"),
  cli: path.join(packsDir, "specweft-0.1.0.tgz"),
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

const binPath = path.join(workspaceDir, "node_modules", ".bin", "specweft");

await runSpecWeft(["init"], projectDir);
await assertFileIncludes(path.join(projectDir, "AGENTS.md"), "specweft.bootstrap_session");
await assertFileIncludes(path.join(projectDir, "CLAUDE.md"), "specweft.bootstrap_session");

const inspect = await runSpecWeft(["mcp-inspect"], projectDir);
assertIncludes(inspect, "specweft.bootstrap_session", "mcp-inspect should expose bootstrap_session");
assertIncludes(inspect, "specweft.create_memory_handoff", "mcp-inspect should expose create_memory_handoff");

const handoff = await runSpecWeft(["handoff"], projectDir);
assertIncludes(handoff, "release-smoke-demo", "handoff should use current project");

const webProcess = spawn(binPath, ["start", "--port", "4199"], {
  cwd: projectDir,
  env,
  stdio: ["ignore", "pipe", "pipe"],
});

try {
  await waitForBootstrap(projectDir);
} finally {
  webProcess.kill("SIGTERM");
}

process.stdout.write(`Release smoke passed in ${workspaceDir}\n`);

async function runSpecWeft(args, cwd) {
  const result = await execFileAsync(binPath, args, {
    cwd,
    env,
    maxBuffer: 20 * 1024 * 1024,
  });
  return result.stdout;
}

async function assertFileIncludes(filePath, expected) {
  const content = await readFile(filePath, "utf-8");
  assertIncludes(content, expected, `${filePath} should include ${expected}`);
}

async function waitForBootstrap(repoPath) {
  const url = `http://localhost:4199/api/bootstrap?repo=${encodeURIComponent(repoPath)}`;
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

function assertIncludes(value, expected, message) {
  if (!value.includes(expected)) {
    throw new Error(message);
  }
}
