import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  createMarketplaceMcpId,
  createMarketplaceSkillId,
  initializeGlobalPools,
  installMarketplaceMcp,
  installMarketplaceSkill,
  listMcpPool,
  listSkillPool,
  readSkillDetail,
} from "../pool/pool-manager.js";
import type { MarketplaceMcpCandidate, MarketplaceSkill } from "../schemas/types.js";

test("installs marketplace Skill into the global pool", async () => {
  const home = await createTempHome();

  try {
    process.env.SPECWEFT_HOME = home;
    await initializeGlobalPools();
    const installed = await installMarketplaceSkill(marketplaceSkill(), "# Java Review\n");
    const pool = await listSkillPool();

    assert.equal(installed.item.id, createMarketplaceSkillId(marketplaceSkill()));
    assert.ok(installed.skillPath.startsWith(path.join(home, "skills")));
    assert.ok(pool.items.some((item) => item.id === installed.item.id));
  } finally {
    delete process.env.SPECWEFT_HOME;
    await rm(home, { recursive: true, force: true });
  }
});

test("keeps marketplace Skills when global pools are initialized again", async () => {
  const home = await createTempHome();

  try {
    process.env.SPECWEFT_HOME = home;
    await initializeGlobalPools();
    const installed = await installMarketplaceSkill(marketplaceSkill(), "# Java Review\n");
    await initializeGlobalPools();
    const pool = await listSkillPool();

    assert.ok(pool.items.some((item) => item.id === installed.item.id));
    assert.ok(pool.items.some((item) => item.id === "diff-explainer"));
  } finally {
    delete process.env.SPECWEFT_HOME;
    await rm(home, { recursive: true, force: true });
  }
});

test("reads installed Skill detail content from the global pool", async () => {
  const home = await createTempHome();

  try {
    process.env.SPECWEFT_HOME = home;
    await initializeGlobalPools();
    const installed = await installMarketplaceSkill(marketplaceSkill(), "# Java Review\n\nUse project rules first.\n");
    const detail = await readSkillDetail(installed.item.id);

    assert.equal(detail?.item.id, installed.item.id);
    assert.match(detail?.content ?? "", /Use project rules first/);
  } finally {
    delete process.env.SPECWEFT_HOME;
    await rm(home, { recursive: true, force: true });
  }
});

test("installs marketplace MCP manifest into the global pool", async () => {
  const home = await createTempHome();

  try {
    process.env.SPECWEFT_HOME = home;
    await initializeGlobalPools();
    const candidate = marketplaceMcp();
    const installed = await installMarketplaceMcp(candidate);
    const pool = await listMcpPool();

    assert.equal(installed.item.id, createMarketplaceMcpId(candidate));
    assert.ok(installed.manifestPath.startsWith(path.join(home, "mcp", "manifests")));
    assert.ok(pool.items.some((item) => item.id === installed.item.id));
    assert.equal(installed.manifest.runtime, "stdio");
  } finally {
    delete process.env.SPECWEFT_HOME;
    await rm(home, { recursive: true, force: true });
  }
});

async function createTempHome(): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), "specweft-pool-test-"));
}

function marketplaceSkill(): MarketplaceSkill {
  return {
    id: "author-java-review-skill-md",
    name: "java-review",
    author: "author",
    authorAvatar: undefined,
    description: "Review Java and Spring code changes.",
    githubUrl: "https://github.com/author/repo/tree/main/skills/java-review",
    stars: 42,
    forks: 3,
    updatedAt: "0",
    path: "SKILL.md",
    branch: "main",
  };
}

function marketplaceMcp(): MarketplaceMcpCandidate {
  return {
    id: "github-mcp",
    name: "github-mcp-server",
    author: "github",
    description: "GitHub MCP server.",
    githubUrl: "https://github.com/github/github-mcp-server",
    stars: 10,
    forks: 1,
    updatedAt: "0",
    packageName: "@github/github-mcp-server",
    runtime: "stdio",
    envVars: ["GITHUB_PERSONAL_ACCESS_TOKEN"],
    permissions: ["network", "github"],
    tags: ["github"],
    keyword: "github",
    relevance: 100,
    installable: true,
    risk: "medium",
    riskReasons: ["Requires environment variable(s): GITHUB_PERSONAL_ACCESS_TOKEN."],
    suggestedManifest: {
      id: "marketplace-github-github-mcp-server",
      name: "github-mcp-server",
      description: "GitHub MCP server.",
      runtime: "stdio",
      launch: {
        command: "npx",
        args: ["-y", "@github/github-mcp-server"],
      },
      env: ["GITHUB_PERSONAL_ACCESS_TOKEN"],
      permissions: ["network", "github"],
      risk: "medium",
      tags: ["marketplace", "github"],
    },
  };
}
