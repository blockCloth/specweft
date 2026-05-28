import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  analyzeCurrentDiff,
  applyProjectMcp,
  applyProjectSkill,
  createReviewDraft,
  createRuntimeAssembly,
  recommendForProject,
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

export function registerSpecWeftTools(server: McpServer, defaultRepoPath: string): void {
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
