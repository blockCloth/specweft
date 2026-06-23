# SpecWeft

English | [中文](#中文)

SpecWeft is a local context layer for coding agents such as Codex, Claude Code, Cursor, and other MCP-compatible tools.

It focuses on the parts around the coding session:

- project profiling
- task preparation before code edits
- Skill routing for the current request
- lightweight work segments for mixed uncommitted diffs
- lightweight memory indexing and on-demand requirement restore
- runtime config assembly
- change review notes
- short-lived session memory
- local context recall
- optional MCP and marketplace tool management

The goal is not to replace a coding agent. SpecWeft helps beginners describe a task clearly, find likely code areas, choose useful Skills, recover only the relevant memory, and understand what the agent changed afterward.

## Status

This project is still early. The current version includes a working CLI, a local Web UI, core project storage, and an MCP server adapter.

## Features

- Scan a project and write `.specweft/profile.json`
- Initialize a global MCP and Skill pool under `~/.specweft`
- Prepare a Context Pack from a natural language task before code edits
- Produce a step-by-step execution plan for the coding agent
- Recommend Skills for the current task
- Mark a lightweight work segment before edits so mixed diffs can be reviewed by request boundary
- Build a lightweight memory index instead of loading every memory into context
- Build a requirement-grouped memory digest as the long-term memory entry point
- Restore requirement memory on demand
- Recommend MCP servers and Skills for a project
- Show a unified Capability Center across MCPs, Skills, and local CLI tools
- Enable, disable, or ignore project-level MCP and Skill selections
- Build runtime MCP and Skill assembly config
- Generate structured review explanations from the current git diff
- Explain which files were already dirty before the current work segment and which files changed during it
- Split mixed diffs into requirement-aware and functional review groups, with grouping reasons and confidence
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
specweft doctor
specweft start
```

The Web UI starts at:

```text
http://localhost:4177
```

If an older SpecWeft UI is already running on the port, SpecWeft stops that local UI and starts the current version so the page matches the code you just installed or built. If another app is using the port, it will try the next available port.

## Common Commands

```bash
specweft init
specweft start
specweft mcp-inspect
specweft doctor
specweft setup-codex
specweft setup-claude
specweft --version
specweft prepare --task "Improve login validation"
specweft memory
specweft digest
specweft segment status
specweft restore --keyword "login"
specweft capabilities
specweft review --title "Implement MCP tools"
specweft recall --keyword "MCP"
specweft handoff --keyword "MCP"
specweft status
```

Options can be placed before or after the command, for example `specweft --repo . status` and `specweft status --repo .` are equivalent. `specweft start 4300` is also accepted as a short form of `specweft start --port 4300`.

After `specweft init`, run `specweft setup-codex` or `specweft setup-claude` to print the MCP client config snippet. SpecWeft writes project agent instructions, but it does not silently edit global Codex or Claude settings.
The intended flow is:

1. call `specweft.bootstrap_session` once at the beginning of a thread
2. call `specweft.prepare_task` before planning or editing a user request
3. call `specweft.start_work_segment` before editing so mixed diffs have a request boundary
4. call `specweft.get_memory_digest` first when continuing old work
5. call `specweft.restore_requirement` only when the memory digest or memory index shows relevant history
6. call `specweft.record_current_diff` after code changes; it closes the active work segment

For local development inside this repository:

```bash
pnpm install
pnpm build
npm link --workspace packages/cli
pnpm run init
pnpm run start
pnpm run inspect
pnpm run review
pnpm run handoff
```

## Web UI

The local UI includes:

- Overview: project profile and enabled tool count
- Work segments: active and recent request boundaries for uncommitted changes
- Task preparation: clarified goal, execution plan, related files, recommended Skills, and relevant memory
- Capability Center: MCP, Skill, and CLI recommendations with type filtering, permissions, and risk notes
- Marketplace Skills: external Skill candidates, keyword search, conflict notes, and user-confirmed install
- Advanced MCP marketplace: optional external MCP candidates, semantic search, risk notes, and user-confirmed install
- Runtime: assembled MCP and Skill runtime config
- Requirements: current requirement selection, creation, and scoped review history
- Review: readable HTML review reports for the current diff, with requirement blocks, requirement-aware change groups, grouping reasons, source reading hints, risks, and test suggestions
- Memory: requirement digest, timeline, recent session recall, and thread handoff
- Connect: MCP client config, expected agent workflow, and LLM review config status

## MCP Server

SpecWeft can run as an MCP server:

```bash
specweft mcp
```

Use `specweft setup-codex`, `specweft setup-claude`, or `specweft mcp-inspect` to print client config for the current repository.

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

- `specweft.prepare_task`
- `specweft.get_memory_index`
- `specweft.get_memory_digest`
- `specweft.restore_requirement`
- `specweft.recommend_skills_for_task`
- `specweft.bootstrap_session`
- `specweft.get_project_profile`
- `specweft.recommend_project_tools`
- `specweft.get_capability_center`
- `specweft.get_runtime_assembly`
- `specweft.get_recording_status`
- `specweft.start_work_segment`
- `specweft.get_work_segment_status`
- `specweft.complete_work_segment`
- `specweft.get_memory_timeline`
- `specweft.get_requirement_dossier`
- `specweft.review_current_diff`
- `specweft.record_current_diff`
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
.specweft/requirements.json
.specweft/work-segments.json
.specweft/memory.json
.specweft/reports/
.specweft/reports/<requirement-id>/
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
pnpm web:smoke
pnpm verify
pnpm publish:dry
specweft start
```

`pnpm publish:dry` builds, checks, tests, and creates npm tarballs for:

`pnpm verify` also runs a lightweight Web UI smoke test against the built HTML, checking navigation/view contracts, API error-handling guards, and common runtime-regression signals.

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
- Improve optional LLM-enhanced review explanations
- Add import/export for MCP and Skill pools
- Improve the Web UI for larger projects

## Optional LLM Review

SpecWeft review works without an API key. When these variables are present, it adds an LLM explanation layer on top of the rule-based review:

```bash
export SPECWEFT_LLM_API_KEY="..."
export SPECWEFT_LLM_MODEL="gpt-4.1-mini"
export SPECWEFT_LLM_BASE_URL="https://api.openai.com/v1"
```

## 中文

SpecWeft 是一个面向 Codex、Claude Code、Cursor 以及其他 MCP 兼容工具的本地上下文层。

它不负责替代 coding agent 写代码，而是整理写代码前后的上下文：

- 项目画像
- 写代码前的任务准备
- 根据当前需求推荐 Skills
- 轻量记忆索引和按需恢复需求记忆
- 运行时配置组装
- 代码修改讲解
- 短期会话记忆
- 本地上下文召回
- 可选的 MCP 和市场工具管理

简单说，SpecWeft 想解决的是：新手用 Codex / Claude 时能把需求说清楚、找到相关代码、选到合适 Skill、只恢复必要记忆，并在 AI 改完代码后看懂改了什么。

## 当前状态

项目还在早期阶段。目前已经有可用的 CLI、本地 Web UI、核心本地存储，以及 MCP Server 适配层。

## 功能

- 扫描项目并生成 `.specweft/profile.json`
- 初始化全局 MCP 和 Skill 池，存储在 `~/.specweft`
- 根据一句自然语言需求生成 Context Pack
- 为 coding agent 生成结构化执行路线
- 根据当前需求推荐 Skills
- 生成轻量记忆索引，避免把所有记忆塞进上下文
- 生成按需求聚合的记忆摘要，作为长期记忆总入口
- 按关键词或需求 ID 恢复相关需求记忆
- 根据项目推荐 MCP 和 Skill
- 查看统一的能力中心，覆盖 MCP、Skill 和本地 CLI 工具
- 对项目启用、禁用或忽略 MCP / Skill
- 生成运行时 MCP 和 Skill 配置
- 根据当前 git diff 生成代码讲解
- 将混在同一个 diff 里的改动按历史需求、功能域、文件重叠、关键词和模块路径拆分成讲解组
- 对 `package.json`、`index.ts`、`types.ts` 等低信号公共文件降权，避免旧记忆误吞多个需求
- 修改前记录轻量工作段，让多个需求混在一个未提交 diff 时仍有边界可追踪
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
specweft doctor
specweft start
```

Web UI 默认地址：

```text
http://localhost:4177
```

如果该端口已经有旧的 SpecWeft UI，SpecWeft 会先停止这个本地 UI，再用当前版本重新启动，避免你刷新页面还看到旧界面。如果端口被其他应用占用，会继续尝试后面的端口。

## 常用命令

```bash
specweft init
specweft start
specweft mcp-inspect
specweft doctor
specweft setup-codex
specweft setup-claude
specweft --version
specweft prepare --task "优化登录校验"
specweft memory
specweft digest
specweft segment status
specweft restore --keyword "登录"
specweft capabilities
specweft review --title "Implement MCP tools"
specweft recall --keyword "MCP"
specweft handoff --keyword "MCP"
specweft status
```

选项可以放在命令前或命令后，例如 `specweft --repo . status` 和 `specweft status --repo .` 等价。`specweft start 4300` 也可以作为 `specweft start --port 4300` 的简写。

执行过 `specweft init` 后，再运行 `specweft setup-codex` 或 `specweft setup-claude` 输出 MCP 客户端配置片段。SpecWeft 会写入项目级 Agent 指令，但不会静默修改全局 Codex 或 Claude 配置。
推荐流程是：

1. 线程开始时调用一次 `specweft.bootstrap_session`
2. 计划或修改用户需求前调用 `specweft.prepare_task`
3. 修改前调用 `specweft.start_work_segment`，给本次需求留下工作段边界
4. 延续旧需求时先调用 `specweft.get_memory_digest`
5. 只有记忆摘要或记忆索引命中相关历史时，才调用 `specweft.restore_requirement`
6. 修改完成后调用 `specweft.record_current_diff`，它会自动关闭当前工作段

如果是在本仓库内本地开发：

```bash
pnpm install
pnpm build
npm link --workspace packages/cli
pnpm run init
pnpm run start
pnpm run inspect
pnpm run review
pnpm run handoff
```

## Web UI

本地界面包含：

- 总览：项目画像和已启用工具数量
- 任务准备：补全目标、执行路线、相关文件、推荐 Skills 和相关记忆
- 能力中心：MCP / Skill / CLI 推荐、类型筛选、权限和风险提示
- 市场 Skill：外部 Skill 候选、关键词搜索、冲突提示，以及用户确认后的加入启用
- 高级 MCP 市场：可选外部 MCP 候选、需求语义搜索、风险提示，以及用户确认后的加入启用
- 运行配置：当前项目的 MCP / Skill 组装结果
- 需求：当前需求选择、新建需求，以及按需求归档代码讲解
- 代码讲解：基于当前 diff 生成结构化中文说明和 HTML 报告，先展示需求拆解，再展示按历史需求或功能域拆出的改动分组、分组依据、源码查看方式、风险和测试建议
- 记忆：需求摘要、需求时间线、关键词召回和线程交接
- 接入配置：给 Codex 或 Claude Code 使用的 MCP 配置、Agent 调用顺序和 LLM 讲解配置状态

## MCP Server

启动 MCP Server：

```bash
specweft mcp
```

可以用 `specweft setup-codex`、`specweft setup-claude` 或 `specweft mcp-inspect` 输出当前项目的客户端配置。

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

- `specweft.prepare_task`
- `specweft.get_memory_index`
- `specweft.get_memory_digest`
- `specweft.restore_requirement`
- `specweft.recommend_skills_for_task`
- `specweft.bootstrap_session`
- `specweft.get_project_profile`
- `specweft.recommend_project_tools`
- `specweft.get_capability_center`
- `specweft.get_runtime_assembly`
- `specweft.get_recording_status`
- `specweft.start_work_segment`
- `specweft.get_work_segment_status`
- `specweft.complete_work_segment`
- `specweft.get_memory_timeline`
- `specweft.get_requirement_dossier`
- `specweft.review_current_diff`
- `specweft.record_current_diff`
- `specweft.save_session_memory`
- `specweft.recall_sessions`
- `specweft.create_memory_handoff`
- `specweft.recommend_marketplace_mcps`
- `specweft.install_marketplace_mcp`
- `specweft.recommend_marketplace_skills`
- `specweft.install_marketplace_skill`
- `specweft.apply_project_mcp`
- `specweft.apply_project_skill`

`specweft.review_current_diff` 默认返回紧凑 diff 摘要和结构化讲解，不直接输出完整 patch 文本。这样 Codex 或 Claude 可以先看需求拆解、分组、源码查看方式和风险提示，再按需读取具体文件，避免一次 review 就撑满上下文。

如果当前存在活跃工作段，代码讲解会额外说明哪些文件是本工作段开始后新增的改动，哪些文件在开始前就已经处于未提交状态。这样连续处理多个需求时，review 不会把旧需求误当成当前需求成果。

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
.specweft/requirements.json
.specweft/work-segments.json
.specweft/memory.json
.specweft/reports/
.specweft/reports/<requirement-id>/
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
pnpm web:smoke
pnpm verify
pnpm publish:dry
specweft start
```

`pnpm publish:dry` 会构建、类型检查、测试，并生成这三个 npm tarball：

`pnpm verify` 还会对构建后的 Web UI HTML 跑轻量冒烟测试，检查导航、视图状态、API 错误处理保护和常见运行时回归信号。

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
