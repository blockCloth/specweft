#!/usr/bin/env node

import { parseArgs } from "./args.js";
import { runHandoff } from "./commands/handoff.js";
import { runInit } from "./commands/init.js";
import { runRecall } from "./commands/recall.js";
import { runRecommend } from "./commands/recommend.js";
import { runReview } from "./commands/review.js";
import { runStatus } from "./commands/status.js";
import { runPool } from "./commands/pool.js";
import { printText } from "./output.js";
import { runApply, runSelection } from "./commands/selection.js";
import { runAssembly } from "./commands/assembly.js";
import { runCapabilities } from "./commands/capabilities.js";
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

  if (args.command === "start" || args.command === "open") {
    await runStart(args.repo, args.port);
    return;
  }

  if (args.command === "recommend") {
    await runRecommend(args.repo);
    return;
  }

  if (args.command === "capabilities") {
    await runCapabilities(args.repo);
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

  if (args.command === "handoff") {
    await runHandoff(args.repo, args.keyword);
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
  if (shouldUseEnglishHelp()) {
    printText(`SpecWeft

Usage:
  specweft init
  specweft start
  specweft mcp
  specweft mcp-inspect
  specweft capabilities
  specweft review --title "Implement MCP tools"
  specweft recall --keyword "login"
  specweft handoff --keyword "login"
  specweft pool init
  specweft pool list mcp
  specweft pool list skills
  specweft apply mcp filesystem
  specweft apply skill diff-explainer
  specweft selection list
  specweft selection disable:mcp filesystem
  specweft assembly

Commands:
  init        Initialize project profile, global pool, default tools, and agent instructions.
  start       Start the local SpecWeft Web UI.
  open        Alias for start.
  recommend   Recommend MCP servers and skills for the project.
  capabilities Show the unified MCP, Skill, and CLI capability center.
  review      Inspect current git diff and create a review draft.
  recall      Search recent local session memories by keyword.
  handoff     Create a new-thread memory handoff prompt.
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
    return;
  }

  printText(`SpecWeft

用法:
  specweft init
  specweft start
  specweft mcp
  specweft mcp-inspect
  specweft capabilities
  specweft review --title "实现 MCP 工具"
  specweft recall --keyword "登录"
  specweft handoff --keyword "登录"
  specweft pool init
  specweft pool list mcp
  specweft pool list skills
  specweft apply mcp filesystem
  specweft apply skill diff-explainer
  specweft selection list
  specweft selection disable:mcp filesystem
  specweft assembly

命令:
  init        初始化项目画像、全局工具池、默认工具和 Agent 指令文件。
  start       启动本地 SpecWeft Web 管理界面。
  open        start 的别名。
  recommend   根据当前项目推荐 MCP 服务和 Skills。
  capabilities 查看统一的 MCP、Skill 和 CLI 能力中心。
  review      分析当前 git diff，并生成本次修改说明。
  recall      按关键词搜索最近的本地会话记忆。
  handoff     生成新线程可用的记忆交接提示。
  status      查看项目配置、记忆、MCP 和 Skill 状态。
  pool        管理全局 MCP 和 Skill 池。
  apply       为当前项目启用一个 MCP 或 Skill。
  selection   查看、禁用或忽略当前项目的 MCP/Skill 选择。
  assembly    生成当前项目的运行时 MCP 和 Skill 装配配置。
  mcp-inspect 输出 MCP 客户端配置和 SpecWeft 暴露的工具名。
  mcp         通过 stdio 启动 SpecWeft MCP Server，供 Claude/Codex 调用。

选项:
  --repo      项目路径，默认是当前目录。
  --keyword   用于 recall/handoff 的关键词。
  --title     保存 review 报告和记忆时使用的标题。
  --port      Web UI 端口，默认是 4177。
`);
}

function shouldUseEnglishHelp(): boolean {
  const locale = process.env.LC_ALL
    ?? process.env.LC_MESSAGES
    ?? process.env.LANG
    ?? "";

  return locale.toLowerCase().startsWith("en");
}

// 顶层统一捕获错误，避免 async 函数抛错时 Node 打出冗长堆栈。
main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Error: ${message}\n`);
  process.exitCode = 1;
});
