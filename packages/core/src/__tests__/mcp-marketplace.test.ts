import assert from "node:assert/strict";
import test from "node:test";
import {
  createMarketplaceMcpKeywords,
  recommendMarketplaceMcps,
} from "../marketplace/mcp-marketplace.js";
import type { MarketplaceMcp, ProjectProfile, ToolRecommendation } from "../schemas/types.js";

const profile: ProjectProfile = {
  id: "project",
  name: "specweft",
  rootPath: "/tmp/specweft",
  languages: ["typescript"],
  frameworks: ["vite"],
  packageManager: "pnpm",
  testCommands: [],
  buildCommands: [],
  ruleFiles: [],
  createdAt: "",
  updatedAt: "",
};

const recommendations: ToolRecommendation[] = [
  {
    id: "git",
    type: "mcp",
    name: "Git MCP",
    reason: "Inspect git status and diffs.",
    risk: "medium",
    status: "recommended",
  },
];

test("creates MCP marketplace keywords from project and natural language requirement", () => {
  assert.deepEqual(createMarketplaceMcpKeywords(profile, recommendations, "review GitHub PR and run browser tests"), [
    "vite",
    "typescript",
    "pnpm",
    "github",
    "playwright",
  ]);
});

test("ranks curated and searched MCP candidates with install manifests", async () => {
  const result = await recommendMarketplaceMcps(profile, recommendations, {
    keywords: ["github"],
    search: async () => [
      mcp({
        id: "github-search",
        name: "github-mcp-server",
        author: "github",
        description: "GitHub MCP server for pull requests and issues.",
        packageName: "@github/github-mcp-server",
        tags: ["github", "pull-request"],
      }),
    ],
  });

  assert.ok(result.candidates.some((item) => item.name.includes("GitHub")));
  assert.ok(result.candidates.every((item) => item.suggestedManifest));
});

test("marks database MCP candidates as high risk", async () => {
  const result = await recommendMarketplaceMcps(profile, [], {
    keywords: ["postgres"],
    search: async () => [
      mcp({
        id: "postgres",
        name: "postgres-mcp",
        description: "Postgres database MCP server.",
        permissions: ["database"],
        tags: ["postgres", "database"],
      }),
    ],
  });

  assert.equal(result.candidates[0]?.risk, "high");
});

function mcp(input: Partial<MarketplaceMcp>): MarketplaceMcp {
  return {
    id: "mcp",
    name: "mcp",
    author: "author",
    description: "MCP server.",
    githubUrl: "https://example.com/mcp",
    stars: 1,
    forks: 0,
    updatedAt: "0",
    packageName: "@example/mcp",
    runtime: "stdio",
    envVars: [],
    permissions: ["network"],
    tags: [],
    ...input,
  };
}
