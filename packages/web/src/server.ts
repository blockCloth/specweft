import path from "node:path";
import { execFile } from "node:child_process";
import type { Server } from "node:http";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { serve } from "@hono/node-server";
import {
  applyProjectMcp,
  applyProjectSkill,
  createBootstrapSession,
  createMemoryHandoff,
  createReviewReport,
  createRuntimeAssembly,
  disableProjectMcp,
  disableProjectSkill,
  ignoreProjectMcp,
  ignoreProjectSkill,
  initializeGlobalPools,
  initializeProject,
  installMarketplaceMcp,
  installMarketplaceSkill,
  recallSessions,
  recommendForProject,
  recommendMarketplaceMcps,
  recommendMarketplaceSkills,
  scanProject,
} from "@specweft/core";
import { Hono } from "hono";
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
  title?: string;
};

type MarketplaceSkillBody = {
  repoPath?: string;
  skill?: Parameters<typeof installMarketplaceSkill>[0];
};

type MarketplaceMcpBody = {
  repoPath?: string;
  mcp?: Parameters<typeof installMarketplaceMcp>[0];
};

const app = new Hono();
const cliOptions = parseArgs(process.argv.slice(2));
let options = cliOptions;
const execFileAsync = promisify(execFile);

app.get("/", (context) => {
  return context.html(renderApp(options.repoPath));
});

app.get("/api/dashboard", async (context) => {
  const repoPath = resolveRequestRepo(context.req.query("repo"));
  await initializeProject(repoPath);

  const [profile, assembly, mcpInspect] = await Promise.all([
    scanProject(repoPath),
    createRuntimeAssembly(repoPath),
    createMcpInspect(repoPath),
  ]);
  const recommendations = await recommendForProject(profile, repoPath);
  const marketplaceSkills = await recommendMarketplaceSkills(profile, recommendations);
  const marketplaceMcps = await recommendMarketplaceMcps(profile, recommendations);

  return context.json({
    profile,
    recommendations,
    marketplaceSkills,
    marketplaceMcps,
    assembly,
    mcpInspect,
  });
});

app.get("/api/bootstrap", async (context) => {
  const repoPath = resolveRequestRepo(context.req.query("repo"));
  const keyword = context.req.query("keyword")?.trim();
  return context.json(await createBootstrapSession(repoPath, keyword));
});

app.get("/api/marketplace/skills", async (context) => {
  const repoPath = resolveRequestRepo(context.req.query("repo"));
  const keyword = context.req.query("keyword")?.trim();
  const profile = await scanProject(repoPath);
  const recommendations = await recommendForProject(profile, repoPath);
  return context.json(await recommendMarketplaceSkills(profile, recommendations, {
    keywords: keyword ? [keyword] : undefined,
  }));
});

app.post("/api/marketplace/skills/apply", async (context) => {
  const body = await context.req.json<MarketplaceSkillBody>();
  const repoPath = resolveRequestRepo(body.repoPath);

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

app.get("/api/marketplace/mcps", async (context) => {
  const repoPath = resolveRequestRepo(context.req.query("repo"));
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
  const body = await context.req.json<MarketplaceMcpBody>();
  const repoPath = resolveRequestRepo(body.repoPath);

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

app.get("/api/assembly", async (context) => {
  const repoPath = resolveRequestRepo(context.req.query("repo"));
  return context.json(await createRuntimeAssembly(repoPath));
});

app.get("/api/mcp-inspect", async (context) => {
  const repoPath = resolveRequestRepo(context.req.query("repo"));
  return context.json(await createMcpInspect(repoPath));
});

app.post("/api/selection/:action", async (context) => {
  const action = context.req.param("action");
  const body = await context.req.json<SelectionBody>();
  const repoPath = resolveRequestRepo(body.repoPath);
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
  const body = await context.req.json<ReviewBody>();
  const repoPath = resolveRequestRepo(body.repoPath);
  const profile = await scanProject(repoPath);
  const report = await createReviewReport(repoPath, profile, body.title);

  return context.json({
    title: report.title,
    reportPath: report.reportPath,
    memory: report.memory,
    markdown: report.markdown,
  });
});

app.get("/api/recall", async (context) => {
  const repoPath = resolveRequestRepo(context.req.query("repo"));
  const keyword = context.req.query("keyword")?.trim();
  if (!keyword) {
    return context.json({ sessions: [] });
  }

  return context.json({
    sessions: await recallSessions(repoPath, keyword),
  });
});

app.get("/api/handoff", async (context) => {
  const repoPath = resolveRequestRepo(context.req.query("repo"));
  const keyword = context.req.query("keyword")?.trim();
  const profile = await scanProject(repoPath);

  return context.json({
    handoff: await createMemoryHandoff(repoPath, profile, keyword),
  });
});

app.onError((error, context) => {
  const message = error instanceof Error ? error.message : String(error);
  return context.json({ error: message }, 500);
});

export async function startWebServer(webOptions: WebOptions): Promise<void> {
  options = {
    repoPath: resolveWebRepoPath(webOptions.repoPath),
    port: webOptions.port,
  };
  await startServer(options.port);
}

if (isMainModule()) {
  await startWebServer(cliOptions);
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
      port = Number(next);
      index += 1;
    }
  }

  return {
    repoPath: resolveWebRepoPath(repoPath),
    port: Number.isFinite(port) ? port : 4177,
  };
}

function resolveRequestRepo(repoPath?: string): string {
  if (!repoPath?.trim()) {
    return options.repoPath;
  }

  return resolveWebRepoPath(repoPath);
}

function resolveWebRepoPath(repoPath: string): string {
  if (path.isAbsolute(repoPath)) {
    return repoPath;
  }

  // pnpm --filter runs the package script from packages/web. INIT_CWD keeps the
  // directory where the user typed the command, which is the expected repo base.
  return path.resolve(process.env.INIT_CWD ?? process.cwd(), repoPath);
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

function createMcpInspect(repoPath: string) {
  return {
    server: "specweft",
    transport: "stdio",
    tools: [
      "specweft.bootstrap_session",
      "specweft.get_project_profile",
      "specweft.recommend_project_tools",
      "specweft.get_runtime_assembly",
      "specweft.review_current_diff",
      "specweft.save_session_memory",
      "specweft.recall_sessions",
      "specweft.create_memory_handoff",
      "specweft.recommend_marketplace_mcps",
      "specweft.install_marketplace_mcp",
      "specweft.recommend_marketplace_skills",
      "specweft.install_marketplace_skill",
      "specweft.apply_project_mcp",
      "specweft.apply_project_skill",
    ],
    clientConfig: {
      mcpServers: {
        specweft: {
          command: "node",
          args: [resolveCliEntryPath(), "mcp", "--repo", repoPath],
        },
      },
    },
  };
}

function resolveCliEntryPath(): string {
  const currentFile = fileURLToPath(import.meta.url);
  return path.resolve(path.dirname(currentFile), "..", "..", "cli", "dist", "index.js");
}

function isMainModule(): boolean {
  return fileURLToPath(import.meta.url) === process.argv[1];
}

async function startServer(port: number, attempt = 0): Promise<void> {
  const occupiedBySpecWeft = await killSpecWeftProcessOnPort(port);
  if (occupiedBySpecWeft) {
    process.stdout.write(`Stopped existing SpecWeft Web UI on port ${port}.\n`);
  }

  const server = serve(
    {
      fetch: app.fetch,
      port,
    },
    (info) => {
      process.stdout.write(`SpecWeft Web UI: http://localhost:${info.port}\n`);
    },
  ) as Server;

  server.on("error", (error: NodeJS.ErrnoException) => {
    if (error.code === "EADDRINUSE" && attempt < 20) {
      const nextPort = port + 1;
      process.stdout.write(`Port ${port} is used by another app, trying ${nextPort}...\n`);
      void startServer(nextPort, attempt + 1);
      return;
    }

    process.stderr.write(`Failed to start SpecWeft Web UI: ${error.message}\n`);
    process.exitCode = 1;
  });
}

async function killSpecWeftProcessOnPort(port: number): Promise<boolean> {
  const pids = await findPidsOnPort(port);
  let killed = false;

  for (const pid of pids) {
    const command = await readProcessCommand(pid);
    if (!isSpecWeftWebProcess(command)) {
      continue;
    }

    process.kill(Number(pid), "SIGTERM");
    killed = true;
  }

  if (killed) {
    await wait(350);
  }

  return killed;
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
    || command.includes("src/server.ts");
}

async function wait(ms: number): Promise<void> {
  await new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
