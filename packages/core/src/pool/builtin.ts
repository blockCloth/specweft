import type {
  McpManifest,
  McpRegistryItem,
  RegistryFile,
  SkillRegistryItem,
} from "../schemas/types.js";
import { mcpManifestDir, skillEntryPath } from "./pool-paths.js";
import path from "node:path";

export const BUILTIN_MCP_MANIFESTS: McpManifest[] = [
  {
    id: "filesystem",
    name: "Filesystem MCP",
    description: "在当前项目目录内读取和写入文件，用于受限的本地上下文访问。",
    runtime: "stdio",
    launch: {
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-filesystem", "{{projectRoot}}"],
    },
    permissions: ["filesystem"],
    risk: "medium",
    tags: ["files", "local", "context"],
  },
  {
    id: "git",
    name: "Git MCP",
    description: "读取 git 状态、diff、分支和近期提交历史，用于代码讲解与变更边界判断。",
    runtime: "stdio",
    launch: {
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-git", "{{projectRoot}}"],
    },
    permissions: ["git", "filesystem"],
    risk: "medium",
    tags: ["git", "diff", "review"],
  },
];

export const BUILTIN_SKILLS: Array<{
  item: SkillRegistryItem;
  content: string;
}> = [
  {
    item: {
      id: "diff-explainer",
      name: "Diff 讲解器",
      description: "把 AI 生成的代码改动整理成主链路讲解、Review 重点和验证清单。",
      skillPath: skillEntryPath("diff-explainer"),
      source: "builtin",
      tags: ["diff", "review", "coding-agent"],
      risk: "low",
    },
    content: `# Diff 讲解器

当 Codex、Claude 或其他 AI 编码 Agent 修改代码后，使用这个 Skill 生成用户能快速看懂的修改说明。

## 工作流

1. 先查看当前 git diff，确认本次改动是否属于当前需求。
2. 用产品目标或维护目标解释“为什么这样改”，避免逐行复述 diff。
3. 总结主链路实现：入口文件、核心模块、数据流或调用流。
4. 标出需要 Review 的风险：遗漏测试、边界条件、过度封装、旧需求混入。
5. 给出最小验证建议和下一步阅读入口。

## 输出

- 一句话总结
- 为什么改
- 主要实现路径
- 先读哪些文件
- Review 风险
- 验证建议
`,
  },
  {
    item: {
      id: "test-planner",
      name: "测试规划器",
      description: "根据改动文件和项目画像，推荐最小可行测试与缺失的回归用例。",
      skillPath: skillEntryPath("test-planner"),
      source: "builtin",
      tags: ["tests", "quality", "coding-agent"],
      risk: "low",
    },
    content: `# 测试规划器

代码修改完成后，或最终回复用户前，使用这个 Skill 规划验证路径。

## 工作流

1. 读取改动文件、项目语言、框架和已有测试命令。
2. 先推荐最小可行测试，不默认要求跑全量测试。
3. 如果改动涉及边界条件，补充缺失的回归测试建议。
4. 明确哪些风险暂时没有测试覆盖。

## 输出

- 建议优先运行的测试
- 建议补充的测试
- 未覆盖风险
- 最终回复里的验证说明
`,
  },
];

export function builtinMcpRegistry(): RegistryFile<McpRegistryItem> {
  return {
    version: 1,
    items: BUILTIN_MCP_MANIFESTS.map((manifest) => ({
      id: manifest.id,
      name: manifest.name,
      manifestPath: path.join(mcpManifestDir(), `${manifest.id}.json`),
      source: "builtin",
    })),
  };
}

export function builtinSkillRegistry(): RegistryFile<SkillRegistryItem> {
  return {
    version: 1,
    items: BUILTIN_SKILLS.map((skill) => skill.item),
  };
}
