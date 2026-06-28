# SpecWeft

English | [中文](#中文)

SpecWeft is a local context layer for coding agents such as Codex, Claude Code, Cursor, and other MCP-compatible tools.

It focuses on the parts around the coding session:

- project-local Agent Harness files
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

SpecWeft v0.1 is a usable local-first workflow for beginner-friendly agent coding. The current release includes the CLI, local Web UI, project storage, Agent Harness generation, MCP server adapter, task preparation, Skill routing, diff review, work segments, requirement memory, and optional marketplace candidates.

The product line is intentionally narrow: SpecWeft does not replace Codex or Claude. It gives them a project-local context and review layer so each coding request can be prepared, explained, remembered, and restored.

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
- Write project-local Agent Harness files for Codex and Claude Skills/Commands

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

After `specweft init`, run `specweft setup-codex` or `specweft setup-claude` to print the MCP client config snippet. SpecWeft writes project agent instructions and Agent Harness templates, but it does not silently edit global Codex or Claude settings.

```text
.agents/skills/specweft-*/SKILL.md
.codex/skills/specweft-*/SKILL.md
.codex/prompts/specweft-*.md
.claude/skills/specweft-*/SKILL.md
.claude/commands/specweft/*.md
```

These Harness files do not reimplement SpecWeft. They tell Codex and Claude when to call the SpecWeft MCP tools, while the tested behavior stays in `@specweft/core`.
The intended flow is:

1. call `specweft.bootstrap_session` once at the beginning of a thread
2. call `specweft.prepare_task` before planning or editing a user request
3. call `specweft.start_work_segment` with `prepare_task.guardrail.startWorkSegmentInput` before editing so mixed diffs have a request boundary
4. call `specweft.get_memory_digest` first when continuing old work
5. call `specweft.restore_requirement` only when the memory digest or memory index shows relevant history
6. call `specweft.record_current_diff` with `prepare_task.guardrail.recordCurrentDiffInput` after code changes; it closes the active work segment

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

The local UI is organized around the beginner agent workflow:

- SpecWeft Workbench: one-screen task console for vague requirements, Codex / Claude auto-use status, project metrics, context budget, compression count, and next actions
- Skill Router: Skill-first recommendation surface with local-rule priority, marketplace Skill preview, type filtering, and optional MCP candidates folded into advanced areas
- Review Lens: readable change explanation focused on why the change exists, how it works, which files to read first, validation, and requirement-aware groups for mixed diffs
- Memory Vault: requirement digest, scoped restore, new-thread handoff, timeline, memory protection, and work-segment state
- Agent Bridge: Codex / Claude connection package, generated Harness entries, expected tool order, MCP client config summary, and advanced raw config snippets
- Project Settings: recording policy, retention, context compression, ignored paths, Skill registry, and MCP timeout
- Runtime Assembly: final Skill and optional MCP configuration that agents read through SpecWeft

Raw JSON and long config snippets stay behind advanced sections. The default view is meant to be readable by someone who is still learning how Codex / Claude changed the project.

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

`pnpm verify` also runs a lightweight Web UI smoke test against the built HTML, checking navigation/view contracts, API error-handling guards, and common runtime-regression signals.

`pnpm publish:dry` builds, checks, tests, creates npm tarballs, and runs a release smoke test for:

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

- tighten task-to-Skill matching with more project signals
- improve optional LLM-enhanced review explanations while keeping the rule-based path usable without keys
- add import/export for MCP and Skill pools
- add larger-project ergonomics: filtering, saved views, and better requirement search
- add team-friendly review and memory sharing only after the local-first workflow stays simple

## Optional LLM Review

SpecWeft review works without an API key. When these variables are present, it adds an LLM explanation layer on top of the rule-based review:

```bash
export SPECWEFT_LLM_API_KEY="..."
export SPECWEFT_LLM_MODEL="gpt-4.1-mini"
export SPECWEFT_LLM_BASE_URL="https://api.openai.com/v1"
export SPECWEFT_LLM_TIMEOUT_MS="15000"
```

## Optional Memory Protection

SpecWeft stores requirement memory locally under `.specweft/`. By default these files are plain JSON so beginners can inspect and debug them. If the memory contains sensitive product or business details, set a local key and migrate the memory state:

```bash
export SPECWEFT_MEMORY_KEY="use-a-long-local-key"
specweft protect
specweft protect --status
```

This encrypts `.specweft/memory.json`, `.specweft/requirements.json`, `.specweft/work-segments.json`, and `.specweft/agent-activity.json` with local AES-256-GCM storage. Codex or Claude sessions that read SpecWeft memory need the same environment variable. Markdown review reports remain plaintext in v1 so they are easy to open for human review.

## 中文

SpecWeft 是一个面向 Codex、Claude Code、Cursor 以及其他 MCP 兼容工具的本地上下文层。

它不负责替代 coding agent 写代码，而是整理写代码前后的上下文：

- 项目级 Agent Harness 文件
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

SpecWeft v0.1 已经形成可用的本地优先闭环：CLI、本地 Web UI、项目本地存储、Agent Harness 生成、MCP Server 适配、任务准备、Skill 路由、diff 讲解、工作段、需求记忆和可选市场候选都已经接入。

产品边界仍然很明确：SpecWeft 不替代 Codex 或 Claude 写代码，而是给它们补上项目上下文、需求边界、修改讲解和可恢复记忆。

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
- 为 Codex 和 Claude 写入项目级 Skills/Commands Harness 文件

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

执行过 `specweft init` 后，再运行 `specweft setup-codex` 或 `specweft setup-claude` 输出 MCP 客户端配置片段。SpecWeft 会写入项目级 Agent 指令和 Agent Harness 模板，但不会静默修改全局 Codex 或 Claude 配置。

```text
.agents/skills/specweft-*/SKILL.md
.codex/skills/specweft-*/SKILL.md
.codex/prompts/specweft-*.md
.claude/skills/specweft-*/SKILL.md
.claude/commands/specweft/*.md
```

这些 Harness 文件不会重新实现 SpecWeft，只负责告诉 Codex/Claude 什么时候调用 SpecWeft MCP 工具；可测试的业务逻辑仍然保留在 `@specweft/core`。
推荐流程是：

1. 线程开始时调用一次 `specweft.bootstrap_session`
2. 计划或修改用户需求前调用 `specweft.prepare_task`
3. 修改前用 `prepare_task.guardrail.startWorkSegmentInput` 调用 `specweft.start_work_segment`，给本次需求留下工作段边界
4. 延续旧需求时先调用 `specweft.get_memory_digest`
5. 只有记忆摘要或记忆索引命中相关历史时，才调用 `specweft.restore_requirement`
6. 修改完成后用 `prepare_task.guardrail.recordCurrentDiffInput` 调用 `specweft.record_current_diff`，它会自动关闭当前工作段

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

本地界面按新手使用 Agent 的主流程组织：

- SpecWeft 工作台：一屏完成需求输入、Codex / Claude 无感调用状态、项目指标、上下文预算、压缩次数和下一步动作
- Skill Router：以 Skill 为主线推荐能力，本地规范优先；市场 Skill 可预览后启用，MCP 候选默认放在高级区域
- Review Lens：默认讲清楚为什么改、怎么实现、先读哪些文件、怎么验证；混合 diff 会按需求或功能域拆开
- Memory Vault：需求摘要、按需恢复、新线程交接、时间线、记忆保护和工作段状态
- Agent Bridge：Codex / Claude 接入包、生成的 Harness 入口、工具调用顺序、MCP 配置摘要，以及高级原始配置片段
- 项目配置：修改记录策略、保留时间、上下文压缩、忽略路径、Skill 注册表和 MCP 超时
- 运行配置：Agent 最终读取的 Skill 与可选 MCP 装配结果

默认界面不直接展示原始 JSON；长配置和源码细节都收在高级区域，避免新手一打开就被调试信息淹没。

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

`specweft.review_current_diff` 默认返回紧凑 diff 摘要和 `agentReview`。`agentReview` 是给 Codex / Claude 直接消费的讲解入口：先看需求上下文、需求/功能分块、为什么改、实现思路、阅读入口和验证建议。完整 patch 文本不会进入 MCP 输出；更细的改动分组和高级源码详情保留在 `advancedReview` 或报告文件里，只有需要深挖时再读。

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

- 用更多项目特征提升任务到 Skill 的匹配质量
- 在不破坏规则版可用性的前提下增强可选 LLM 讲解
- 增加 MCP / Skill 池的导入导出
- 优化大项目下的筛选、视图保存和需求搜索
- 本地闭环稳定后，再考虑团队级 review 和记忆共享

## 可选记忆保护

SpecWeft 的需求记忆默认保存在项目内 `.specweft/`，普通模式是明文 JSON，方便新手查看和排查。如果记忆里包含业务细节，可以设置本地密钥并迁移：

```bash
export SPECWEFT_MEMORY_KEY="一段足够长的本地密钥"
specweft protect
specweft protect --status
```

这会加密 `.specweft/memory.json`、`.specweft/requirements.json`、`.specweft/work-segments.json` 和 `.specweft/agent-activity.json`。之后 Codex / Claude 通过 SpecWeft 读取记忆时也需要同一个环境变量。v1 的 Markdown review 报告仍保持明文，方便人工打开 review。
