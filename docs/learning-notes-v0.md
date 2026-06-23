# SpecWeft v0 学习说明

## 这版实现了什么

v0.1 已经形成第一条可用闭环：

```text
项目扫描 -> 能力中心 -> MCP/Skill 装配 -> 结构化代码讲解 -> 本地记忆检索
```

现在已经包含全局 MCP Pool 和 Skill Pool：

```text
~/.specweft/mcp/registry.json
~/.specweft/mcp/manifests/*.json
~/.specweft/skills/registry.json
~/.specweft/skills/<skill-id>/SKILL.md
```

Web UI、MCP Server、多项目注册、多需求归档、市场 MCP/Skill 候选、Capability Center 和结构化 review 都已经接入。当前 review 仍然是规则版，不依赖 LLM；它先保证“稳定、可解释、可测试”，后面再接模型增强讲解质量。

## 你应该先读哪些文件

按顺序读：

1. `packages/cli/src/index.ts`
   - CLI 程序入口
   - 根据命令分发到不同 command

2. `packages/cli/src/args.ts`
   - 最简单的命令行参数解析
   - 先不用 commander，便于理解原理

3. `packages/core/src/scanner/project-scanner.ts`
   - 扫描项目
   - 识别语言、框架、包管理器、规则文件

4. `packages/core/src/recommendations/recommender.ts`
   - 根据项目 profile 推荐 MCP 和 Skills
   - 当前是规则引擎，不依赖模型

5. `packages/core/src/diff/diff-analyzer.ts`
   - 调用 `git diff`
   - 结合 `git status` 识别未跟踪新增文件
   - 解析改动文件
   - 生成结构化 review、Markdown 报告和 Web HTML

6. `packages/core/src/memory/session-memory.ts`
   - 保存和检索本地 session memory
   - 支持按 requirementId 收窄召回范围
   - 当前用 JSON 文件，后面会换 SQLite

7. `packages/core/src/pool/pool-manager.ts`
   - 初始化全局 MCP Pool 和 Skill Pool
   - 读取池里的 MCP 和 Skills

8. `packages/core/src/pool/builtin.ts`
   - 内置 MCP manifest
   - 内置 Skill 的 `SKILL.md` 内容

9. `packages/cli/src/commands/pool.ts`
   - `pool init`
   - `pool list mcp`
   - `pool list skills`

10. `packages/core/src/assembly/runtime-assembly.ts`
   - 读取项目选择的 MCP / Skills
   - 从全局池中过滤启用项
   - 替换 `{{projectRoot}}`
   - 输出给 Codex / Claude 可用的运行时配置

11. `packages/cli/src/mcp/tools.ts`
   - 把 core 能力包装成 MCP tools
   - 让 Claude / Codex 后续可以通过 MCP 调用 SpecWeft

12. `packages/cli/src/mcp/server.ts`
   - 创建 MCP server
   - 注册 tools
   - 通过 stdio transport 启动

13. `packages/core/src/marketplace/skills-marketplace.ts`
   - 根据项目语言、框架和推荐项生成搜索关键词
   - 搜索 skillsmp 候选
   - 过滤 Java 项目里的 JavaScript 噪音
   - 检测外部规范 Skill 与本地规则文件的冲突

14. `packages/core/src/pool/pool-manager.ts`
   - `installMarketplaceSkill`
   - 把市场 Skill 下载到全局 Skill 池
   - 保证 `pool init` 不会清掉用户安装的市场 Skill

15. `packages/web/src/server.ts` 和 `packages/web/src/ui.ts`
   - 本地 Web UI
   - 市场 Skill 搜索、加入并启用
   - 把 JSON 结果渲染成用户能读的 HTML 卡片

16. `packages/core/src/capabilities/capability-center.ts`
   - 把 MCP、Skill、本地 CLI 工具统一成能力列表
   - 记录权限、风险、推荐原因、安装命令和运行命令

17. `packages/core/src/projects/project-registry.ts`
   - 在 `~/.specweft/projects.json` 记录多个项目
   - 让一个 Web UI 可以切换管理不同项目

18. `packages/core/src/requirements/requirement-manager.ts`
   - 在 `.specweft/requirements.json` 记录同一项目下的多个需求
   - 管理当前 active requirement
   - 把 review 报告和 memory 关联到具体需求

## 这版涉及的 TypeScript 知识

### type

位置：

```text
packages/core/src/schemas/types.ts
```

作用：

```text
定义项目里的数据形状。
```

例子：

```ts
export type ProjectProfile = {
  id: string;
  name: string;
  languages: string[];
};
```

### export / import

位置：

```text
packages/core/src/index.ts
packages/cli/src/commands/*.ts
```

作用：

```text
把 core 的能力暴露给 CLI 使用。
```

### async / await

位置：

```text
project-scanner.ts
diff-analyzer.ts
session-memory.ts
```

作用：

```text
处理文件读取、写入、执行 git 命令这些异步操作。
```

### Node 内置模块

这版用到：

```text
node:path
node:fs/promises
node:child_process
node:crypto
node:util
```

你先重点看：

```text
fs/promises
path
child_process
```

## 为什么要拆 packages/core 和 packages/cli

`core` 是产品逻辑：

```text
scan / recommend / diff / memory
```

`cli` 是交互入口：

```text
解析命令 -> 调 core -> 打印结果
```

以后加 Web UI 和 MCP Server 时，它们也只需要调用 `core`，不用复制业务逻辑。

## 当前命令

```bash
pnpm build
pnpm specweft --help
pnpm specweft init
pnpm specweft recommend
pnpm specweft capabilities
pnpm specweft review
pnpm specweft recall --keyword "login"
pnpm specweft pool init
pnpm specweft pool list mcp
pnpm specweft pool list skills
pnpm specweft apply mcp filesystem
pnpm specweft apply skill diff-explainer
pnpm specweft assembly
pnpm specweft mcp
pnpm specweft start
```

## 下一版建议做什么

下一步建议做：

1. 给 Capability Center 增加更多 CLI 模板和风险规则
2. 给 Web UI 增加能力详情页，而不是只在表格里展示
3. 引入 `commander` 替换手写参数解析
4. 把 memory 从 JSON 换成 SQLite
5. 增加导入/导出能力池配置
