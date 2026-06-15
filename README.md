# SpecWeft

English | [中文](#中文)

SpecWeft is a local companion for coding agents such as Codex, Claude Code, Cursor, and other MCP-compatible tools.

It focuses on the parts around the coding session:

- project profiling
- MCP and Skill selection
- unified MCP, Skill, and CLI capability recommendations
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
- Show a unified Capability Center across MCPs, Skills, and local CLI tools
- Enable, disable, or ignore project-level MCP and Skill selections
- Build runtime MCP and Skill assembly config
- Generate structured review explanations from the current git diff
- Save review sessions into local memory
- Recall recent sessions by keyword
- Start a local Web UI
- Search marketplace MCP candidates from curated hot servers and GitHub search
- Install a marketplace MCP manifest into the global MCP pool and enable it for a project after user action
- Search marketplace Skill candidates from skillsmp
- Install a marketplace Skill into the global Skill pool and enable it for a project after user action
- Expose SpecWeft capabilities through an MCP server

## Quick Start

Install the CLI:

```bash
npm install -g specweft
```

Then run this once inside a project:

```bash
specweft init
specweft start
```

The Web UI starts at:

```text
http://localhost:4177
```

If a SpecWeft UI is already running on the port, SpecWeft reuses the existing UI and registers the current project into the global project list. If another app is using the port, it will try the next available port.

## Common Commands

```bash
specweft init
specweft start
specweft mcp-inspect
specweft capabilities
specweft review --title "Implement MCP tools"
specweft recall --keyword "MCP"
specweft handoff --keyword "MCP"
specweft status
```

After `specweft init`, Codex or Claude can use the MCP tool
`specweft.bootstrap_session` at the beginning of a thread. That single tool
returns the project profile, Capability Center, selected MCP/Skill assembly, recommendations,
recent memory handoff, and the expected review workflow.

For local development inside this repository:

```bash
pnpm install
pnpm build
npm link --workspace packages/cli
npm run init
npm start
npm run inspect
npm run review
npm run handoff
```

## Web UI

The local UI includes:

- Overview: project profile and enabled tool count
- Capability Center: MCP, Skill, and CLI recommendations with type filtering, permissions, and risk notes
- Marketplace MCPs: external MCP candidates, semantic search, risk notes, and user-confirmed install
- Marketplace Skills: external Skill candidates, keyword search, conflict notes, and user-confirmed install
- Runtime: assembled MCP and Skill runtime config
- Review: readable HTML review reports for the current diff
- Memory: recent session recall by keyword
- Connect: MCP client config for Codex or Claude Code

## MCP Server

SpecWeft can run as an MCP server:

```bash
specweft mcp
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

- `specweft.bootstrap_session`
- `specweft.get_project_profile`
- `specweft.recommend_project_tools`
- `specweft.get_capability_center`
- `specweft.get_runtime_assembly`
- `specweft.review_current_diff`
- `specweft.save_session_memory`
- `specweft.recall_sessions`
- `specweft.create_memory_handoff`
- `specweft.recommend_marketplace_mcps`
- `specweft.install_marketplace_mcp`
- `specweft.recommend_marketplace_skills`
- `specweft.install_marketplace_skill`
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
~/.specweft/projects.json
~/.specweft/mcp/
~/.specweft/skills/
```

The project `.specweft` directory is local state and is not meant to be committed.

Marketplace Skills are stored under `~/.specweft/skills/<skill-id>/SKILL.md`. Project files only record whether the current project enabled that Skill.

Marketplace MCPs are stored as manifests under `~/.specweft/mcp/manifests/<mcp-id>.json`. Project files only record whether the current project enabled that MCP. SpecWeft does not directly rewrite global Codex or Claude config.

## Popular MCP Signals

SpecWeft currently seeds MCP recommendations with commonly used MCP categories:

- GitHub: repository, issue, and pull request workflows
- Playwright/browser: UI testing, screenshots, and browser automation
- Postgres/Supabase/SQLite: database context
- Filesystem/Git: local project context
- Slack/Notion/Jira: team and knowledge workspace context
- AWS/Cloudflare/Kubernetes: cloud and infrastructure context
- Brave/Tavily/Exa style search: research and web lookup

The MCP ecosystem is moving quickly, so SpecWeft treats online results as candidates and keeps the final install/enable action under user control.

## Development

```bash
pnpm install
pnpm build
pnpm check
pnpm test
pnpm verify
pnpm publish:dry
specweft start
```

`pnpm publish:dry` builds, checks, tests, and creates npm tarballs for:

- `@specweft/core`
- `@specweft/web`
- `specweft`

It also runs a release smoke test from the generated tarballs:

- install the packed packages into a temporary npm project
- run `specweft init`
- verify `mcp-inspect` exposes `specweft.bootstrap_session`
- verify `mcp-inspect` exposes `specweft.get_capability_center`
- verify `handoff` uses the current project
- start the packed Web UI and call `/api/bootstrap`

When the dry run is green, publish in dependency order:

```bash
pnpm --filter @specweft/core publish --access public
pnpm --filter @specweft/web publish --access public
pnpm --filter specweft publish
```

## Roadmap

- Improve recommendation rules
- Add richer review explanations
- Add import/export for MCP and Skill pools
- Improve the Web UI for larger projects

## 中文

SpecWeft 是一个面向 Codex、Claude Code、Cursor 以及其他 MCP 兼容工具的本地辅助层。

它不负责替代 coding agent 写代码，而是整理写代码前后的上下文：

- 项目画像
- MCP 和 Skill 选择
- MCP、Skill 和 CLI 的统一能力推荐
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
- 查看统一的能力中心，覆盖 MCP、Skill 和本地 CLI 工具
- 对项目启用、禁用或忽略 MCP / Skill
- 生成运行时 MCP 和 Skill 配置
- 根据当前 git diff 生成代码讲解
- 在 CLI 输出中文可读讲解，并在 Web UI 展示 HTML 报告
- 将讲解保存成本地会话记忆
- 通过关键词召回近期会话
- 启动本地 Web UI
- 搜索市场 MCP 候选，来源包括内置热门种子和 GitHub 搜索
- 经用户确认后，把市场 MCP manifest 加入全局 MCP 池并启用到当前项目
- 从 skillsmp 搜索市场 Skill 候选
- 经用户确认后，把市场 Skill 加入全局 Skill 池并启用到当前项目
- 通过 MCP Server 暴露 SpecWeft 能力

## 快速开始

安装 CLI：

```bash
npm install -g specweft
```

然后在项目目录里执行一次：

```bash
specweft init
specweft start
```

Web UI 默认地址：

```text
http://localhost:4177
```

如果该端口已经有 SpecWeft UI，会复用现有 UI，并把当前项目登记到全局项目列表。如果端口被其他应用占用，会继续尝试后面的端口。

## 常用命令

```bash
specweft init
specweft start
specweft mcp-inspect
specweft capabilities
specweft review --title "Implement MCP tools"
specweft recall --keyword "MCP"
specweft handoff --keyword "MCP"
specweft status
```

执行过 `specweft init` 后，Codex 或 Claude 可以在线程开始时调用
`specweft.bootstrap_session`。这个工具会一次性返回项目画像、能力中心、已选择的
MCP/Skill 装配结果、工具推荐、近期记忆交接和代码讲解工作流。

如果是在本仓库内本地开发：

```bash
pnpm install
pnpm build
npm link --workspace packages/cli
npm run init
npm start
npm run inspect
npm run review
npm run handoff
```

## Web UI

本地界面包含：

- 总览：项目画像和已启用工具数量
- 能力中心：MCP / Skill / CLI 推荐、类型筛选、权限和风险提示
- 市场 MCP：外部 MCP 候选、需求语义搜索、风险提示，以及用户确认后的加入启用
- 市场 Skill：外部 Skill 候选、关键词搜索、冲突提示，以及用户确认后的加入启用
- 运行配置：当前项目的 MCP / Skill 组装结果
- 代码讲解：基于当前 diff 生成结构化中文说明和 HTML 报告
- 记忆：按关键词召回近期会话
- 接入配置：给 Codex 或 Claude Code 使用的 MCP 配置

## MCP Server

启动 MCP Server：

```bash
specweft mcp
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

- `specweft.bootstrap_session`
- `specweft.get_project_profile`
- `specweft.recommend_project_tools`
- `specweft.get_capability_center`
- `specweft.get_runtime_assembly`
- `specweft.review_current_diff`
- `specweft.save_session_memory`
- `specweft.recall_sessions`
- `specweft.create_memory_handoff`
- `specweft.recommend_marketplace_mcps`
- `specweft.install_marketplace_mcp`
- `specweft.recommend_marketplace_skills`
- `specweft.install_marketplace_skill`
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
~/.specweft/projects.json
~/.specweft/mcp/
~/.specweft/skills/
```

项目里的 `.specweft` 是本地状态，不建议提交到仓库。

市场 Skill 本体会保存在 `~/.specweft/skills/<skill-id>/SKILL.md`。项目内只记录当前项目是否启用了这个 Skill。

市场 MCP 会以 manifest 形式保存在 `~/.specweft/mcp/manifests/<mcp-id>.json`。项目内只记录当前项目是否启用了这个 MCP。SpecWeft 不会直接改写用户的 Codex 或 Claude 全局配置。

## 热门 MCP 信号

当前 SpecWeft 会优先覆盖这些常见高频 MCP 方向：

- GitHub：仓库、Issue、PR 工作流
- Playwright / Browser：UI 测试、截图、浏览器自动化
- Postgres / Supabase / SQLite：数据库上下文
- Filesystem / Git：本地项目上下文
- Slack / Notion / Jira：团队协作和知识库
- AWS / Cloudflare / Kubernetes：云服务和基础设施
- Brave / Tavily / Exa 类搜索：联网检索和资料查询

MCP 生态变化很快，所以 SpecWeft 只把在线结果作为候选，最终安装和启用动作仍然交给用户确认。

## 开发

```bash
pnpm install
pnpm build
pnpm check
pnpm test
pnpm verify
pnpm publish:dry
specweft start
```

`pnpm publish:dry` 会构建、类型检查、测试，并生成这三个 npm tarball：

- `@specweft/core`
- `@specweft/web`
- `specweft`

它还会用生成的 tarball 跑一次发布冒烟测试：

- 安装到临时 npm 项目
- 执行 `specweft init`
- 确认 `mcp-inspect` 暴露 `specweft.bootstrap_session`
- 确认 `mcp-inspect` 暴露 `specweft.get_capability_center`
- 确认 `handoff` 使用当前项目
- 启动打包后的 Web UI 并请求 `/api/bootstrap`

dry run 全绿后，按依赖顺序发布：

```bash
pnpm --filter @specweft/core publish --access public
pnpm --filter @specweft/web publish --access public
pnpm --filter specweft publish
```

## 后续计划

- 完善推荐规则
- 增强代码讲解质量
- 增加 MCP / Skill 池的导入导出
- 优化大项目下的 Web UI 使用体验
