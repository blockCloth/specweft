import type {
  CapabilityCenter,
  CapabilityManifest,
  ProjectProfile,
  ProjectSelectionStatus,
} from "../schemas/types.js";
import { listMcpPool, listSkillPool, readMcpManifest } from "../pool/pool-manager.js";
import {
  readProjectMcpSelection,
  readProjectSkillSelection,
} from "../selection/selection-manager.js";

type CliCapabilityTemplate = {
  id: string;
  name: string;
  description: string;
  installCommand: string;
  runCommand: string;
  permissions: string[];
  authRequired: boolean;
  risk: CapabilityManifest["risk"];
  tags: string[];
  match: (profile: ProjectProfile) => string | undefined;
};

const BUILTIN_CLI_CAPABILITIES: CliCapabilityTemplate[] = [
  {
    id: "cli-ripgrep",
    name: "ripgrep",
    description: "本地代码搜索工具，适合在大仓库里快速定位入口文件。",
    installCommand: "brew install ripgrep",
    runCommand: "rg <pattern>",
    permissions: ["filesystem:read"],
    authRequired: false,
    risk: "low",
    tags: ["search", "codebase", "local"],
    match: (profile) => {
      if (profile.languages.length === 0) {
        return "适合作为默认安全搜索工具：编辑前先定位文件，避免让 Agent 盲读整个仓库。";
      }
      return `适合 ${profile.name}：可以搜索 ${profile.languages.join("/")} 代码，减少大范围读取文件。`;
    },
  },
  {
    id: "cli-playwright",
    name: "Playwright CLI",
    description: "浏览器自动化与前端页面验证工具。",
    installCommand: "pnpm add -D @playwright/test",
    runCommand: "pnpm exec playwright test",
    permissions: ["browser", "filesystem:read", "filesystem:write"],
    authRequired: false,
    risk: "medium",
    tags: ["browser", "frontend", "test"],
    match: (profile) => {
      if (hasAny(profile.frameworks, ["react", "vite", "next"])) {
        return `适合 ${profile.name}：检测到 ${profile.frameworks.join("/")}，UI 改动需要浏览器级验证。`;
      }
      return undefined;
    },
  },
  {
    id: "cli-vitest",
    name: "Vitest",
    description: "JavaScript / TypeScript 项目的轻量单元测试工具。",
    installCommand: "pnpm add -D vitest",
    runCommand: "pnpm exec vitest run",
    permissions: ["filesystem:read"],
    authRequired: false,
    risk: "low",
    tags: ["test", "typescript", "javascript"],
    match: (profile) => {
      if (hasAny(profile.languages, ["typescript", "javascript"])) {
        return profile.testCommands.length
          ? `匹配当前测试工作流：${profile.testCommands.join("; ")}。`
          : "当前 JavaScript / TypeScript 项目暂未检测到测试命令，可用它补一个最小验证入口。";
      }
      return undefined;
    },
  },
  {
    id: "cli-eslint",
    name: "ESLint",
    description: "JavaScript / TypeScript 项目的静态检查工具。",
    installCommand: "pnpm add -D eslint",
    runCommand: "pnpm exec eslint .",
    permissions: ["filesystem:read"],
    authRequired: false,
    risk: "low",
    tags: ["lint", "typescript", "javascript"],
    match: (profile) => {
      if (hasAny(profile.languages, ["typescript", "javascript"])) {
        return "适合在 AI 继续改动或生成讲解前，先捕获基础代码质量问题。";
      }
      return undefined;
    },
  },
  {
    id: "cli-gh",
    name: "GitHub CLI",
    description: "从终端读取 GitHub PR、Issue 和工作流信息。",
    installCommand: "brew install gh",
    runCommand: "gh status",
    permissions: ["network", "github"],
    authRequired: true,
    risk: "medium",
    tags: ["github", "review", "workflow"],
    match: (profile) => {
      if (profile.ruleFiles.length > 0) {
        return "适合把本地 Agent 规则和 PR / Issue 上下文交叉检查。";
      }
      return undefined;
    },
  },
  {
    id: "cli-docker",
    name: "Docker CLI",
    description: "用于本地服务和集成检查的容器运行环境。",
    installCommand: "Install Docker Desktop",
    runCommand: "docker compose ps",
    permissions: ["containers", "filesystem:read", "network"],
    authRequired: false,
    risk: "high",
    tags: ["docker", "infra", "integration"],
    match: (profile) => {
      if (profile.rootPath && profile.frameworks.includes("python-project")) {
        return "适合依赖本地数据库或基础设施服务的 Python 项目。";
      }
      return undefined;
    },
  },
];

export async function createCapabilityCenter(
  profile: ProjectProfile,
  repoPath = profile.rootPath,
): Promise<CapabilityCenter> {
  const [mcpPool, skillPool, mcpSelection, skillSelection] = await Promise.all([
    listMcpPool(),
    listSkillPool(),
    readProjectMcpSelection(repoPath),
    readProjectSkillSelection(repoPath),
  ]);
  const mcpStatus = new Map(mcpSelection.selected.map((item) => [item.id, item.status]));
  const skillStatus = new Map(skillSelection.selected.map((item) => [item.id, item.status]));
  const capabilities: CapabilityManifest[] = [];

  for (const item of mcpPool.items) {
    const manifest = await readMcpManifest(item);
    if (!manifest) {
      continue;
    }

    capabilities.push({
      id: manifest.id,
      name: manifest.name,
      kind: "mcp",
      description: manifest.description,
      source: item.source,
      installCommand: manifest.launch
        ? [manifest.launch.command, ...manifest.launch.args].join(" ")
        : undefined,
      runCommand: manifest.runtime === "remote" ? manifest.url : manifest.launch?.command,
      permissions: manifest.permissions,
      authRequired: Boolean(manifest.env?.length || manifest.headers),
      risk: manifest.risk,
      tags: manifest.tags,
      compatibleClients: ["codex", "claude", "cursor", "gemini", "generic"],
      status: mapSelectionStatus(mcpStatus.get(manifest.id), createMcpReason(manifest.id, profile)),
      reason: createMcpReason(manifest.id, profile),
    });
  }

  for (const item of skillPool.items) {
    const reason = createSkillReason(item.id, profile);
    capabilities.push({
      id: item.id,
      name: item.name,
      kind: "skill",
      description: item.description,
      source: item.source,
      runCommand: item.skillPath,
      permissions: ["agent-instructions"],
      authRequired: false,
      risk: item.risk,
      tags: item.tags,
      compatibleClients: ["codex", "claude", "generic"],
      status: mapSelectionStatus(skillStatus.get(item.id), reason),
      reason,
    });
  }

  for (const template of BUILTIN_CLI_CAPABILITIES) {
    const reason = template.match(profile);
    capabilities.push({
      id: template.id,
      name: template.name,
      kind: "cli",
      description: template.description,
      source: "builtin",
      installCommand: template.installCommand,
      runCommand: template.runCommand,
      permissions: template.permissions,
      authRequired: template.authRequired,
      risk: template.risk,
      tags: template.tags,
      compatibleClients: ["codex", "claude", "cursor", "gemini", "generic"],
      status: reason ? "recommended" : "available",
      reason,
    });
  }

  const sorted = sortCapabilities(capabilities);

  return {
    project: profile,
    generatedAt: new Date().toISOString(),
    capabilities: sorted,
    summary: {
      total: sorted.length,
      recommended: sorted.filter((item) => item.status === "recommended").length,
      enabled: sorted.filter((item) => item.status === "enabled").length,
      highRisk: sorted.filter((item) => item.risk === "high").length,
    },
  };
}

function mapSelectionStatus(
  status: ProjectSelectionStatus | undefined,
  reason: string | undefined,
): CapabilityManifest["status"] {
  if (status) {
    return status;
  }

  return reason ? "recommended" : "available";
}

function createMcpReason(id: string, profile: ProjectProfile): string | undefined {
  if (id === "filesystem") {
    return `适合 ${profile.name}：让 Agent 在规划修改前读取受限的项目文件上下文。`;
  }
  if (id === "git") {
    return "适合代码讲解：diff 和历史上下文是解释 AI 改动的核心依据。";
  }
  if (id.startsWith("marketplace-")) {
    return "来自 MCP 市场池。启用前需要先确认权限和环境变量，不建议默认安装。";
  }
  return undefined;
}

function createSkillReason(id: string, profile: ProjectProfile): string | undefined {
  if (id === "diff-explainer") {
    return "适合 SpecWeft 的 Review 闭环：每次 AI 改完代码后，需要生成清晰的修改讲解。";
  }
  if (id === "test-planner") {
    return profile.testCommands.length
      ? `适合当前项目的测试入口：${profile.testCommands.join("; ")}。`
      : "暂未检测到测试命令，可用于选择一个小范围验证路径。";
  }
  if (id.startsWith("marketplace-")) {
    return "来自 Skill 市场池。启用前应先和本地规则对照，避免覆盖项目规范。";
  }
  return undefined;
}

function sortCapabilities(capabilities: CapabilityManifest[]): CapabilityManifest[] {
  const statusRank: Record<CapabilityManifest["status"], number> = {
    enabled: 0,
    recommended: 1,
    available: 2,
    disabled: 3,
    ignored: 4,
  };
  const riskRank: Record<CapabilityManifest["risk"], number> = {
    low: 0,
    medium: 1,
    high: 2,
  };

  return [...capabilities].sort((left, right) => {
    return statusRank[left.status] - statusRank[right.status]
      || riskRank[left.risk] - riskRank[right.risk]
      || left.kind.localeCompare(right.kind)
      || left.name.localeCompare(right.name);
  });
}

function hasAny(values: string[], expected: string[]): boolean {
  return expected.some((item) => values.includes(item));
}
