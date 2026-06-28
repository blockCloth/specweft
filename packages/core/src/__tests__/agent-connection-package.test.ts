import assert from "node:assert/strict";
import test from "node:test";
import { createAgentConnectionPackage } from "../connect/agent-connection-package.js";
import type { AgentHarnessResult, ProjectProfile } from "../schemas/types.js";

test("creates a reusable agent connection package for Codex, Claude, and generic agents", () => {
  const profile: ProjectProfile = {
    id: "demo",
    name: "demo-project",
    rootPath: "/tmp/demo-project",
    languages: ["typescript"],
    frameworks: ["vite"],
    packageManager: "pnpm",
    testCommands: ["npm run test"],
    buildCommands: ["npm run build"],
    ruleFiles: ["AGENTS.md"],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
  const harness: AgentHarnessResult = {
    version: 1,
    skillNames: ["specweft-prepare-task"],
    commandNames: ["specweft-review"],
    files: [
      { client: "codex", kind: "skill", name: "specweft-prepare-task", path: "/tmp/demo-project/.codex/skills/specweft-prepare-task/SKILL.md" },
      { client: "claude", kind: "command", name: "review", path: "/tmp/demo-project/.claude/commands/specweft/review.md" },
      { client: "generic", kind: "skill", name: "specweft-prepare-task", path: "/tmp/demo-project/.agents/skills/specweft-prepare-task/SKILL.md" },
    ],
  };

  const connection = createAgentConnectionPackage({
    repoPath: profile.rootPath,
    profile,
    harness,
    command: "node",
    args: ["packages/cli/dist/index.js", "mcp", "--repo", profile.rootPath],
    codexToml: "[mcp_servers.specweft]",
    claudeJson: "{\"mcpServers\":{}}",
    generatedAt: "2026-01-01T00:00:00.000Z",
  });

  assert.equal(connection.projectName, "demo-project");
  assert.equal(connection.server.name, "specweft");
  assert.equal(connection.server.transport, "stdio");
  assert.equal(connection.clients.length, 3);
  assert.equal(connection.clients.find((client) => client.client === "codex")?.configFormat, "toml");
  assert.equal(connection.clients.find((client) => client.client === "claude")?.configFormat, "json");
  assert.equal(connection.clients.find((client) => client.client === "generic")?.configFormat, "local-files");
  assert.ok(connection.requiredTools.every((toolName) => toolName.startsWith("specweft.")));
  assert.ok(connection.autoUseFlow.some((step) => step.mcpTools.includes("specweft.prepare_task")));
  assert.ok(connection.autoUseFlow.some((step) => step.mcpTools.includes("specweft.restore_requirement")));
  assert.ok(connection.autoUseFlow.some((step) => step.mcpTools.includes("specweft.record_current_diff")));
  assert.ok(connection.notes.some((note) => note.includes("Skill")));
});
