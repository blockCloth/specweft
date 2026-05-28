# SpecWeft

English | [中文](#中文)

SpecWeft is a local companion for coding agents such as Codex, Claude Code, Cursor, and other MCP-compatible tools.

It focuses on the parts around the coding session:

- project profiling
- MCP and Skill selection
- runtime config assembly
- change review notes
- short-lived session memory
- local context recall

The goal is not to replace a coding agent. SpecWeft keeps the project context, tool choices, and review notes organized so the user can understand what changed and recover useful context later.

## Status

This project is still early. The current version includes a working CLI, a local Web UI, core project storage, and an MCP server adapter.

## Features

- Scan a project and write `.specweft/profile.json`
- Initialize a global MCP and Skill pool under `~/.specweft`
- Recommend MCP servers and Skills for a project
- Enable, disable, or ignore project-level MCP and Skill selections
- Build runtime MCP and Skill assembly config
- Generate review notes from the current git diff
- Save review sessions into local memory
- Recall recent sessions by keyword
- Start a local Web UI
- Expose SpecWeft capabilities through an MCP server

## Quick Start

```bash
pnpm install
pnpm build
pnpm specweft -- --help
pnpm specweft start
```

The Web UI starts at:

```text
http://localhost:4177
```

If the port is already used by an old SpecWeft UI process, SpecWeft will stop it and reuse the same port. If another app is using the port, it will try the next available port.

## Common Commands

```bash
pnpm specweft -- pool init
pnpm specweft -- init --repo .
pnpm specweft -- recommend --repo .
pnpm specweft -- apply mcp filesystem --repo .
pnpm specweft -- apply skill diff-explainer --repo .
pnpm specweft -- selection list --repo .
pnpm specweft -- assembly --repo .
pnpm specweft -- review --repo . --title "Implement MCP tools"
pnpm specweft -- recall --repo . --keyword "MCP"
pnpm specweft -- mcp-inspect --repo .
```

## Web UI

The local UI includes:

- Overview: project profile and enabled tool count
- Tools: MCP and Skill recommendations with type filtering
- Runtime: assembled MCP and Skill runtime config
- Review: readable review notes for the current diff
- Memory: recent session recall by keyword
- Connect: MCP client config for Codex or Claude Code

## MCP Server

SpecWeft can run as an MCP server:

```bash
pnpm specweft -- mcp --repo .
```

Example client config:

```json
{
  "mcpServers": {
    "specweft": {
      "command": "node",
      "args": [
        "/path/to/specweft/packages/cli/dist/index.js",
        "mcp",
        "--repo",
        "/path/to/your/project"
      ]
    }
  }
}
```

Available MCP tools:

- `specweft.get_project_profile`
- `specweft.recommend_project_tools`
- `specweft.get_runtime_assembly`
- `specweft.review_current_diff`
- `specweft.save_session_memory`
- `specweft.recall_sessions`
- `specweft.apply_project_mcp`
- `specweft.apply_project_skill`

## Project Structure

```text
packages/core   Core project scanning, pool, selection, assembly, review, and memory logic
packages/cli    CLI commands and MCP adapter
packages/web    Local Web UI
docs            Product and architecture notes
```

## Storage

Project-local files:

```text
.specweft/profile.json
.specweft/mcp.json
.specweft/skills.json
.specweft/memory.json
.specweft/reports/
```

Global files:

```text
~/.specweft/mcp/
~/.specweft/skills/
```

The project `.specweft` directory is local state and is not meant to be committed.

## Development

```bash
pnpm install
pnpm build
pnpm check
pnpm specweft start
```

## Roadmap

- Improve recommendation rules
- Add tests for core workflows
- Add richer review explanations
- Add import/export for MCP and Skill pools
- Improve the Web UI for larger projects

## 中文

SpecWeft 是一个面向 Codex、Claude Code、Cursor 以及其他 MCP 兼容工具的本地辅助层。

它不负责替代 coding agent 写代码，而是整理写代码前后的上下文：

- 项目画像
- MCP 和 Skill 选择
- 运行时配置组装
- 代码修改讲解
- 短期会话记忆
- 本地上下文召回

简单说，SpecWeft 想解决的是：AI 改完代码之后，用户能看懂改了什么，也能在后面的线程里找回当时的上下文。

## 当前状态

项目还在早期阶段。目前已经有可用的 CLI、本地 Web UI、核心本地存储，以及 MCP Server 适配层。

## 功能

- 扫描项目并生成 `.specweft/profile.json`
- 初始化全局 MCP 和 Skill 池，存储在 `~/.specweft`
- 根据项目推荐 MCP 和 Skill
- 对项目启用、禁用或忽略 MCP / Skill
- 生成运行时 MCP 和 Skill 配置
- 根据当前 git diff 生成代码讲解
- 将讲解保存成本地会话记忆
- 通过关键词召回近期会话
- 启动本地 Web UI
- 通过 MCP Server 暴露 SpecWeft 能力

## 快速开始

```bash
pnpm install
pnpm build
pnpm specweft -- --help
pnpm specweft start
```

Web UI 默认地址：

```text
http://localhost:4177
```

如果端口被旧的 SpecWeft UI 占用，会自动停止旧进程并继续使用该端口。如果端口被其他应用占用，会继续尝试后面的端口。

## 常用命令

```bash
pnpm specweft -- pool init
pnpm specweft -- init --repo .
pnpm specweft -- recommend --repo .
pnpm specweft -- apply mcp filesystem --repo .
pnpm specweft -- apply skill diff-explainer --repo .
pnpm specweft -- selection list --repo .
pnpm specweft -- assembly --repo .
pnpm specweft -- review --repo . --title "Implement MCP tools"
pnpm specweft -- recall --repo . --keyword "MCP"
pnpm specweft -- mcp-inspect --repo .
```

## Web UI

本地界面包含：

- 总览：项目画像和已启用工具数量
- 工具：MCP / Skill 推荐和类型筛选
- 运行配置：当前项目的 MCP / Skill 组装结果
- 代码讲解：基于当前 diff 生成可读说明
- 记忆：按关键词召回近期会话
- 接入配置：给 Codex 或 Claude Code 使用的 MCP 配置

## MCP Server

启动 MCP Server：

```bash
pnpm specweft -- mcp --repo .
```

客户端配置示例：

```json
{
  "mcpServers": {
    "specweft": {
      "command": "node",
      "args": [
        "/path/to/specweft/packages/cli/dist/index.js",
        "mcp",
        "--repo",
        "/path/to/your/project"
      ]
    }
  }
}
```

当前暴露的 MCP tools：

- `specweft.get_project_profile`
- `specweft.recommend_project_tools`
- `specweft.get_runtime_assembly`
- `specweft.review_current_diff`
- `specweft.save_session_memory`
- `specweft.recall_sessions`
- `specweft.apply_project_mcp`
- `specweft.apply_project_skill`

## 项目结构

```text
packages/core   核心扫描、工具池、项目选择、配置组装、代码讲解和记忆逻辑
packages/cli    CLI 命令和 MCP 适配层
packages/web    本地 Web UI
docs            产品和架构文档
```

## 存储位置

项目本地文件：

```text
.specweft/profile.json
.specweft/mcp.json
.specweft/skills.json
.specweft/memory.json
.specweft/reports/
```

全局文件：

```text
~/.specweft/mcp/
~/.specweft/skills/
```

项目里的 `.specweft` 是本地状态，不建议提交到仓库。

## 开发

```bash
pnpm install
pnpm build
pnpm check
pnpm specweft start
```

## 后续计划

- 完善推荐规则
- 为核心流程补测试
- 增强代码讲解质量
- 增加 MCP / Skill 池的导入导出
- 优化大项目下的 Web UI 使用体验
