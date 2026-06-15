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
    description: "Fast local code search for large repositories.",
    installCommand: "brew install ripgrep",
    runCommand: "rg <pattern>",
    permissions: ["filesystem:read"],
    authRequired: false,
    risk: "low",
    tags: ["search", "codebase", "local"],
    match: (profile) => {
      if (profile.languages.length === 0) {
        return "Useful as a safe default for exploring unknown repositories before editing.";
      }
      return `Useful for ${profile.name}: lets agents search ${profile.languages.join("/")} code without broad file reads.`;
    },
  },
  {
    id: "cli-playwright",
    name: "Playwright CLI",
    description: "Browser automation and UI verification for frontend projects.",
    installCommand: "pnpm add -D @playwright/test",
    runCommand: "pnpm exec playwright test",
    permissions: ["browser", "filesystem:read", "filesystem:write"],
    authRequired: false,
    risk: "medium",
    tags: ["browser", "frontend", "test"],
    match: (profile) => {
      if (hasAny(profile.frameworks, ["react", "vite", "next"])) {
        return `Recommended because ${profile.name} uses ${profile.frameworks.join("/")}, so UI changes need browser-level verification.`;
      }
      return undefined;
    },
  },
  {
    id: "cli-vitest",
    name: "Vitest",
    description: "Fast JavaScript/TypeScript unit test runner.",
    installCommand: "pnpm add -D vitest",
    runCommand: "pnpm exec vitest run",
    permissions: ["filesystem:read"],
    authRequired: false,
    risk: "low",
    tags: ["test", "typescript", "javascript"],
    match: (profile) => {
      if (hasAny(profile.languages, ["typescript", "javascript"])) {
        return profile.testCommands.length
          ? `Matches existing test workflow: ${profile.testCommands.join("; ")}.`
          : "Recommended because this JavaScript/TypeScript project has no detected test command yet.";
      }
      return undefined;
    },
  },
  {
    id: "cli-eslint",
    name: "ESLint",
    description: "Static analysis for JavaScript and TypeScript projects.",
    installCommand: "pnpm add -D eslint",
    runCommand: "pnpm exec eslint .",
    permissions: ["filesystem:read"],
    authRequired: false,
    risk: "low",
    tags: ["lint", "typescript", "javascript"],
    match: (profile) => {
      if (hasAny(profile.languages, ["typescript", "javascript"])) {
        return "Recommended for catching basic code quality issues before asking an AI agent to explain or extend changes.";
      }
      return undefined;
    },
  },
  {
    id: "cli-gh",
    name: "GitHub CLI",
    description: "GitHub pull request, issue, and workflow access from the terminal.",
    installCommand: "brew install gh",
    runCommand: "gh status",
    permissions: ["network", "github"],
    authRequired: true,
    risk: "medium",
    tags: ["github", "review", "workflow"],
    match: (profile) => {
      if (profile.ruleFiles.length > 0) {
        return "Useful when local agent rules need to be cross-checked with pull requests or issue context.";
      }
      return undefined;
    },
  },
  {
    id: "cli-docker",
    name: "Docker CLI",
    description: "Container runtime used for local services and integration checks.",
    installCommand: "Install Docker Desktop",
    runCommand: "docker compose ps",
    permissions: ["containers", "filesystem:read", "network"],
    authRequired: false,
    risk: "high",
    tags: ["docker", "infra", "integration"],
    match: (profile) => {
      if (profile.rootPath && profile.frameworks.includes("python-project")) {
        return "Useful for Python service projects that often depend on local databases or infrastructure services.";
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
    return `Recommended for ${profile.name}: gives agents scoped project file context before planning changes.`;
  }
  if (id === "git") {
    return "Recommended for code review: diff and history context are core to explaining AI-generated changes.";
  }
  if (id.startsWith("marketplace-")) {
    return "Available from the MCP marketplace pool. Review permissions before enabling it for this project.";
  }
  return undefined;
}

function createSkillReason(id: string, profile: ProjectProfile): string | undefined {
  if (id === "diff-explainer") {
    return "Recommended because SpecWeft's review loop needs clear explanations of code changes.";
  }
  if (id === "test-planner") {
    return profile.testCommands.length
      ? `Recommended because the project exposes test command(s): ${profile.testCommands.join("; ")}.`
      : "Recommended to help choose a small verification path when no test command is detected.";
  }
  if (id.startsWith("marketplace-")) {
    return "Available from the Skill marketplace pool. Compare it with local rules before enabling.";
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
