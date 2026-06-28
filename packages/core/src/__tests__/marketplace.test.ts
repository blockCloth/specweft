import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  checkMarketplaceSkillUpdates,
  createMarketplaceKeywords,
  recommendMarketplaceSkills,
} from "../marketplace/skills-marketplace.js";
import {
  initializeGlobalPools,
  installMarketplaceSkill,
} from "../pool/pool-manager.js";
import { applyProjectSkill } from "../selection/selection-manager.js";
import { updateProjectSettings } from "../settings/project-settings.js";
import type { MarketplaceSkill, ProjectProfile, ToolRecommendation } from "../schemas/types.js";

const javaProfile: ProjectProfile = {
  id: "project",
  name: "java-service",
  rootPath: "/tmp/java-service",
  languages: ["java"],
  frameworks: ["spring"],
  packageManager: undefined,
  testCommands: [],
  buildCommands: [],
  ruleFiles: ["AGENTS.md"],
  createdAt: "",
  updatedAt: "",
};

const recommendations: ToolRecommendation[] = [
  {
    id: "test-planner",
    type: "skill",
    name: "Test Planner",
    reason: "",
    risk: "low",
    status: "recommended",
  },
];

test("creates marketplace keywords from project profile and recommendations", () => {
  assert.deepEqual(createMarketplaceKeywords(javaProfile, recommendations), [
    "java",
    "spring",
    "testing",
  ]);
});

test("filters Java search results without admitting JavaScript-only skills", async () => {
  const result = await recommendMarketplaceSkills(javaProfile, recommendations, {
    search: async () => [
      skill({
        id: "java-pro",
        name: "java-pro",
        description: "Java 21 and Spring Boot service patterns.",
      }),
      skill({
        id: "javascript-pro",
        name: "javascript-pro",
        description: "Modern JavaScript and Node.js APIs.",
      }),
    ],
  });

  assert.deepEqual(result.candidates.map((item) => item.id), ["java-pro"]);
});

test("marks external standards skills as high conflict when local rules exist", async () => {
  const result = await recommendMarketplaceSkills(javaProfile, [], {
    search: async () => [
      skill({
        id: "java-coding-standards",
        name: "java-coding-standards",
        description: "Java coding standards for Spring Boot services.",
      }),
    ],
  });

  assert.equal(result.candidates[0]?.conflictLevel, "high");
  assert.match(result.candidates[0]?.conflictReasons[0] ?? "", /AGENTS\.md/);
});

test("deduplicates same author and skill name, keeping the stronger candidate", async () => {
  const result = await recommendMarketplaceSkills(javaProfile, [], {
    search: async () => [
      skill({
        id: "java-standards-zh",
        name: "java-coding-standards",
        stars: 10,
        description: "Java coding standards for Spring Boot services.",
      }),
      skill({
        id: "java-standards-en",
        name: "java-coding-standards",
        stars: 30,
        description: "Java coding standards for Spring Boot services.",
      }),
    ],
  });

  assert.deepEqual(result.candidates.map((item) => item.id), ["java-standards-en"]);
});

test("checks enabled marketplace Skill updates through project settings", async () => {
  const home = await mkdtemp(path.join(os.tmpdir(), "specweft-skill-updates-home-"));
  const repoPath = await mkdtemp(path.join(os.tmpdir(), "specweft-skill-updates-repo-"));

  try {
    process.env.SPECWEFT_HOME = home;
    await initializeGlobalPools();
    const installed = await installMarketplaceSkill(skill({
      name: "java-review",
      author: "author",
      updatedAt: "100",
      description: "Java and Spring review skill.",
      githubUrl: "https://github.com/author/repo/tree/main/skills/java-review",
    }), "# Java Review\n");
    await applyProjectSkill(repoPath, installed.item.id);
    await updateProjectSettings(repoPath, {
      capabilities: {
        skillRegistryUrl: "https://example.com/skills",
        mcpStdioTimeoutMs: 1234,
      },
    });

    const result = await checkMarketplaceSkillUpdates(repoPath, {
      search: async (keyword, options) => {
        assert.equal(keyword, "java-review");
        assert.equal(options.registryUrl, "https://example.com/skills");
        assert.equal(options.timeoutMs, 1234);
        return [
          skill({
            name: "java-review",
            author: "author",
            updatedAt: "200",
            description: "Java and Spring review skill.",
            githubUrl: "https://github.com/author/repo/tree/main/skills/java-review",
          }),
        ];
      },
    });

    assert.equal(result.enabled, true);
    assert.equal(result.updateCount, 1);
    assert.equal(result.items[0]?.status, "update-available");

    await updateProjectSettings(repoPath, {
      capabilities: {
        autoCheckSkillUpdates: false,
      },
    });
    const disabled = await checkMarketplaceSkillUpdates(repoPath, {
      search: async () => {
        throw new Error("disabled checks should not hit the registry");
      },
    });

    assert.equal(disabled.enabled, false);
    assert.equal(disabled.items[0]?.status, "skipped");
  } finally {
    delete process.env.SPECWEFT_HOME;
    await rm(home, { recursive: true, force: true });
    await rm(repoPath, { recursive: true, force: true });
  }
});

function skill(input: Partial<MarketplaceSkill>): MarketplaceSkill {
  return {
    id: "skill",
    name: "skill",
    author: "author",
    authorAvatar: undefined,
    description: "Skill description.",
    githubUrl: "https://example.com/skill",
    stars: 1,
    forks: 0,
    updatedAt: "0",
    path: "SKILL.md",
    branch: "main",
    ...input,
  };
}
