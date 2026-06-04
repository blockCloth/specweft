import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  analyzeCurrentDiff,
  applyProjectMcp,
  applyProjectSkill,
  createBootstrapSession,
  createReviewDraft,
  createMemoryHandoff,
  createRuntimeAssembly,
  installMarketplaceMcp,
  installMarketplaceSkill,
  recommendForProject,
  recommendMarketplaceMcps,
  recommendMarketplaceSkills,
  recallSessions,
  resolveRepoPath,
  saveSessionMemory,
  scanProject,
} from "@specweft/core";
import { z } from "zod";

const RepoInput = {
  repoPath: z.string().optional().describe("Repository path. Defaults to the repo passed to specweft mcp."),
};

const RecallInput = {
  repoPath: z.string().optional().describe("Repository path. Defaults to the repo passed to specweft mcp."),
  keyword: z.string().describe("Keyword used to search recent SpecWeft session memories."),
};

const HandoffInput = {
  repoPath: z.string().optional().describe("Repository path. Defaults to the repo passed to specweft mcp."),
  keyword: z.string().optional().describe("Optional keyword used to recover a specific recent requirement thread."),
  limit: z.number().int().min(1).max(10).optional().describe("Maximum memory sessions included in the handoff prompt."),
};

const SaveMemoryInput = {
  repoPath: z.string().optional().describe("Repository path. Defaults to the repo passed to specweft mcp."),
  title: z.string().describe("Short title for this coding session or requirement."),
  summary: z.string().describe("Human-readable summary of what changed and why."),
  keywords: z.array(z.string()).optional().describe("Search keywords for future recall."),
  changedFiles: z.array(z.string()).optional().describe("Files touched by this session."),
};

const ApplyInput = {
  repoPath: z.string().optional().describe("Repository path. Defaults to the repo passed to specweft mcp."),
  id: z.string().describe("MCP or Skill id from the global SpecWeft pool."),
};

const MarketplaceSearchInput = {
  repoPath: z.string().optional().describe("Repository path. Defaults to the repo passed to specweft mcp."),
  keyword: z.string().optional().describe("Optional keyword used to search marketplace Skills."),
};

const MarketplaceMcpSearchInput = {
  repoPath: z.string().optional().describe("Repository path. Defaults to the repo passed to specweft mcp."),
  keyword: z.string().optional().describe("Optional keyword used to search marketplace MCP servers."),
  requirement: z.string().optional().describe("Optional natural language requirement used for semantic MCP recommendation."),
};

const MarketplaceMcpInput = {
  repoPath: z.string().optional().describe("Repository path. Defaults to the repo passed to specweft mcp."),
  mcp: z.object({
    id: z.string(),
    name: z.string(),
    author: z.string(),
    description: z.string(),
    githubUrl: z.string().optional(),
    homepageUrl: z.string().optional(),
    stars: z.number(),
    forks: z.number(),
    updatedAt: z.string(),
    packageName: z.string().optional(),
    runtime: z.enum(["stdio", "remote"]),
    url: z.string().optional(),
    envVars: z.array(z.string()),
    permissions: z.array(z.string()),
    tags: z.array(z.string()),
    keyword: z.string(),
    relevance: z.number(),
    installable: z.boolean(),
    risk: z.enum(["low", "medium", "high"]),
    riskReasons: z.array(z.string()),
    suggestedManifest: z.object({
      id: z.string(),
      name: z.string(),
      description: z.string(),
      runtime: z.enum(["stdio", "remote"]),
      launch: z.object({
        command: z.string(),
        args: z.array(z.string()),
      }).optional(),
      url: z.string().optional(),
      env: z.array(z.string()).optional(),
      headers: z.record(z.string(), z.string()).optional(),
      permissions: z.array(z.string()),
      risk: z.enum(["low", "medium", "high"]),
      tags: z.array(z.string()),
    }).optional(),
  }).describe("Marketplace MCP candidate returned by specweft.recommend_marketplace_mcps."),
};

const MarketplaceSkillInput = {
  repoPath: z.string().optional().describe("Repository path. Defaults to the repo passed to specweft mcp."),
  skill: z.object({
    id: z.string(),
    name: z.string(),
    author: z.string(),
    authorAvatar: z.string().optional(),
    description: z.string(),
    githubUrl: z.string(),
    stars: z.number(),
    forks: z.number(),
    updatedAt: z.string(),
    path: z.string(),
    branch: z.string(),
  }).describe("Marketplace Skill object returned by specweft.recommend_marketplace_skills."),
};

export function registerSpecWeftTools(server: McpServer, defaultRepoPath: string): void {
  server.registerTool(
    "specweft.bootstrap_session",
    {
      title: "Bootstrap SpecWeft session",
      description: "Return the project profile, selected runtime assembly, recommendations, recent memory handoff, and workflow instructions for a new coding-agent session.",
      inputSchema: HandoffInput,
    },
    async ({ repoPath, keyword, limit }) => {
      const resolvedRepoPath = resolveToolRepoPath(defaultRepoPath, repoPath);
      const bootstrap = await createBootstrapSession(resolvedRepoPath, keyword, limit);
      return jsonToolResult({ bootstrap });
    },
  );

  server.registerTool(
    "specweft.get_project_profile",
    {
      title: "Get project profile",
      description: "Scan the project and return its SpecWeft project profile.",
      inputSchema: RepoInput,
    },
    async ({ repoPath }) => {
      const profile = await scanProject(resolveToolRepoPath(defaultRepoPath, repoPath));
      return jsonToolResult(profile);
    },
  );

  server.registerTool(
    "specweft.recommend_project_tools",
    {
      title: "Recommend project tools",
      description: "Recommend MCP servers and Skills for the current project profile.",
      inputSchema: RepoInput,
    },
    async ({ repoPath }) => {
      const resolvedRepoPath = resolveToolRepoPath(defaultRepoPath, repoPath);
      const profile = await scanProject(resolvedRepoPath);
      const recommendations = await recommendForProject(profile, resolvedRepoPath);
      return jsonToolResult({ profile, recommendations });
    },
  );

  server.registerTool(
    "specweft.get_runtime_assembly",
    {
      title: "Get runtime assembly",
      description: "Return the MCP servers and Skills selected for the current project.",
      inputSchema: RepoInput,
    },
    async ({ repoPath }) => {
      const assembly = await createRuntimeAssembly(
        resolveToolRepoPath(defaultRepoPath, repoPath),
      );
      return jsonToolResult(assembly);
    },
  );

  server.registerTool(
    "specweft.review_current_diff",
    {
      title: "Review current diff",
      description: "Analyze the current git diff and return a review draft.",
      inputSchema: RepoInput,
    },
    async ({ repoPath }) => {
      const resolvedRepoPath = resolveToolRepoPath(defaultRepoPath, repoPath);
      const diff = await analyzeCurrentDiff(resolvedRepoPath);
      const review = createReviewDraft(diff);
      return jsonToolResult({ diff, review });
    },
  );

  server.registerTool(
    "specweft.save_session_memory",
    {
      title: "Save session memory",
      description: "Save a concise coding session memory for cross-thread recall.",
      inputSchema: SaveMemoryInput,
    },
    async ({ repoPath, title, summary, keywords, changedFiles }) => {
      const resolvedRepoPath = resolveToolRepoPath(defaultRepoPath, repoPath);
      const profile = await scanProject(resolvedRepoPath);
      const memory = await saveSessionMemory(resolvedRepoPath, {
        projectId: profile.id,
        title,
        summary,
        keywords: keywords ?? [],
        changedFiles: changedFiles ?? [],
      });

      return jsonToolResult({ memory });
    },
  );

  server.registerTool(
    "specweft.recall_sessions",
    {
      title: "Recall sessions",
      description: "Search recent SpecWeft session memories by keyword.",
      inputSchema: RecallInput,
    },
    async ({ repoPath, keyword }) => {
      const sessions = await recallSessions(
        resolveToolRepoPath(defaultRepoPath, repoPath),
        keyword,
      );
      return jsonToolResult({ sessions });
    },
  );

  server.registerTool(
    "specweft.create_memory_handoff",
    {
      title: "Create memory handoff",
      description: "Create a cross-thread handoff prompt from recent SpecWeft memories so a new Codex or Claude thread can continue with context.",
      inputSchema: HandoffInput,
    },
    async ({ repoPath, keyword, limit }) => {
      const resolvedRepoPath = resolveToolRepoPath(defaultRepoPath, repoPath);
      const profile = await scanProject(resolvedRepoPath);
      const handoff = await createMemoryHandoff(resolvedRepoPath, profile, keyword, limit);
      return jsonToolResult({ handoff });
    },
  );

  server.registerTool(
    "specweft.recommend_marketplace_mcps",
    {
      title: "Recommend marketplace MCPs",
      description: "Search and rank external MCP server candidates for the current project and requirement without applying them automatically.",
      inputSchema: MarketplaceMcpSearchInput,
    },
    async ({ repoPath, keyword, requirement }) => {
      const resolvedRepoPath = resolveToolRepoPath(defaultRepoPath, repoPath);
      const profile = await scanProject(resolvedRepoPath);
      const recommendations = await recommendForProject(profile, resolvedRepoPath);
      const marketplaceMcps = await recommendMarketplaceMcps(profile, recommendations, {
        keywords: keyword?.trim() ? [keyword] : undefined,
        requirement,
      });

      return jsonToolResult({ profile, marketplaceMcps });
    },
  );

  server.registerTool(
    "specweft.install_marketplace_mcp",
    {
      title: "Install marketplace MCP",
      description: "Install a marketplace MCP manifest into the global SpecWeft MCP pool and enable it for this project.",
      inputSchema: MarketplaceMcpInput,
    },
    async ({ repoPath, mcp }) => {
      const resolvedRepoPath = resolveToolRepoPath(defaultRepoPath, repoPath);
      // MCP 安装只写 SpecWeft manifest 池，不直接改用户全局 agent 配置。
      const installed = await installMarketplaceMcp(mcp);
      const selection = await applyProjectMcp(resolvedRepoPath, installed.item.id);

      return jsonToolResult({ installed, selection });
    },
  );

  server.registerTool(
    "specweft.recommend_marketplace_skills",
    {
      title: "Recommend marketplace Skills",
      description: "Search external marketplace Skill candidates for the current project without applying them automatically.",
      inputSchema: MarketplaceSearchInput,
    },
    async ({ repoPath, keyword }) => {
      const resolvedRepoPath = resolveToolRepoPath(defaultRepoPath, repoPath);
      const profile = await scanProject(resolvedRepoPath);
      const recommendations = await recommendForProject(profile, resolvedRepoPath);
      const marketplaceSkills = await recommendMarketplaceSkills(profile, recommendations, {
        keywords: keyword?.trim() ? [keyword] : undefined,
      });

      return jsonToolResult({ profile, marketplaceSkills });
    },
  );

  server.registerTool(
    "specweft.install_marketplace_skill",
    {
      title: "Install marketplace Skill",
      description: "Install a marketplace Skill into the global SpecWeft Skill pool and enable it for this project.",
      inputSchema: MarketplaceSkillInput,
    },
    async ({ repoPath, skill }) => {
      const resolvedRepoPath = resolveToolRepoPath(defaultRepoPath, repoPath);
      // 安装到全局池后再写项目选择，避免同一个 Skill 在多个项目里重复下载。
      const installed = await installMarketplaceSkill(skill);
      const selection = await applyProjectSkill(resolvedRepoPath, installed.item.id);

      return jsonToolResult({ installed, selection });
    },
  );

  server.registerTool(
    "specweft.apply_project_mcp",
    {
      title: "Apply project MCP",
      description: "Enable one MCP server from the global SpecWeft pool for this project.",
      inputSchema: ApplyInput,
    },
    async ({ repoPath, id }) => {
      const selection = await applyProjectMcp(
        resolveToolRepoPath(defaultRepoPath, repoPath),
        id,
      );
      return jsonToolResult({ selection });
    },
  );

  server.registerTool(
    "specweft.apply_project_skill",
    {
      title: "Apply project Skill",
      description: "Enable one Skill from the global SpecWeft pool for this project.",
      inputSchema: ApplyInput,
    },
    async ({ repoPath, id }) => {
      const selection = await applyProjectSkill(
        resolveToolRepoPath(defaultRepoPath, repoPath),
        id,
      );
      return jsonToolResult({ selection });
    },
  );
}

function resolveToolRepoPath(defaultRepoPath: string, repoPath?: string): string {
  return repoPath ? resolveRepoPath(repoPath) : defaultRepoPath;
}

function jsonToolResult(value: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(value, null, 2),
      },
    ],
  };
}
