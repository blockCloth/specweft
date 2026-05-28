#!/usr/bin/env node

import { parseArgs } from "./args.js";
import { runInit } from "./commands/init.js";
import { runRecall } from "./commands/recall.js";
import { runRecommend } from "./commands/recommend.js";
import { runReview } from "./commands/review.js";
import { runStatus } from "./commands/status.js";
import { runPool } from "./commands/pool.js";
import { printText } from "./output.js";
import { runApply, runSelection } from "./commands/selection.js";
import { runAssembly } from "./commands/assembly.js";
import { runMcp } from "./commands/mcp.js";
import { runMcpInspect } from "./commands/mcp-inspect.js";
import { runStart } from "./commands/start.js";

// CLI 的总入口：只负责解析命令并分发到具体 command。
// 真正的业务逻辑放在 @specweft/core，后续 Web/MCP 也能复用同一套 core。
async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (!args.command || args.command === "help" || args.command === "--help") {
    printHelp();
    return;
  }

  if (args.command === "init") {
    await runInit(args.repo);
    return;
  }

  if (args.command === "start") {
    await runStart(args.repo, args.port);
    return;
  }

  if (args.command === "recommend") {
    await runRecommend(args.repo);
    return;
  }

  if (args.command === "review") {
    await runReview(args.repo, args.title);
    return;
  }

  if (args.command === "recall") {
    await runRecall(args.repo, args.keyword);
    return;
  }

  if (args.command === "status") {
    await runStatus(args.repo);
    return;
  }

  if (args.command === "pool") {
    await runPool(args.subcommand, args.target);
    return;
  }

  if (args.command === "apply") {
    await runApply(args.repo, args.subcommand, args.target);
    return;
  }

  if (args.command === "selection") {
    await runSelection(args.repo, args.subcommand, args.target);
    return;
  }

  if (args.command === "assembly") {
    await runAssembly(args.repo);
    return;
  }

  if (args.command === "mcp") {
    await runMcp(args.repo);
    return;
  }

  if (args.command === "mcp-inspect") {
    await runMcpInspect(args.repo);
    return;
  }

  throw new Error(`Unknown command: ${args.command}`);
}

function printHelp(): void {
  printText(`SpecWeft

Usage:
  specweft init --repo .
  specweft start
  specweft recommend --repo .
  specweft review --repo . --title "Implement MCP tools"
  specweft recall --repo . --keyword "login"
  specweft pool init
  specweft pool list mcp
  specweft pool list skills
  specweft apply mcp filesystem --repo .
  specweft apply skill diff-explainer --repo .
  specweft selection list --repo .
  specweft selection disable:mcp filesystem --repo .
  specweft assembly --repo .
  specweft mcp-inspect --repo .
  specweft mcp --repo .

Commands:
  start       Start the local SpecWeft Web UI.
  init        Scan a project and write .specweft/profile.json.
  recommend   Recommend MCP servers and skills for the project.
  review      Inspect current git diff and create a review draft.
  recall      Search recent local session memories by keyword.
  status      Show project config, memory, MCP, and skill status.
  pool        Manage the global MCP and Skill pools.
  apply       Enable a MCP or Skill for the current project.
  selection   List, disable, or ignore project MCP/Skill selections.
  assembly    Build runtime MCP and Skill config for the current project.
  mcp-inspect Print MCP client config and exposed SpecWeft tool names.
  mcp         Start the SpecWeft MCP server over stdio for Claude/Codex clients.

Options:
  --repo      Repository path. Defaults to current directory.
  --keyword   Keyword for recall.
  --title     Review title used when saving report and memory.
  --port      Web UI port. Defaults to 4177.
`);
}

// 顶层统一捕获错误，避免 async 函数抛错时 Node 打出冗长堆栈。
main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Error: ${message}\n`);
  process.exitCode = 1;
});
