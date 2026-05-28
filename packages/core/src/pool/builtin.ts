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
    description: "Read and write files inside the current project directory.",
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
    description: "Inspect git status, diffs, branches, and recent history.",
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
      name: "Diff Explainer",
      description: "Explain AI-generated code changes and produce review checklists.",
      skillPath: skillEntryPath("diff-explainer"),
      source: "builtin",
      tags: ["diff", "review", "coding-agent"],
      risk: "low",
    },
    content: `# Diff Explainer

Use this skill after an AI coding agent modifies code.

## Workflow

1. Inspect the current git diff.
2. Summarize the main behavior changes.
3. Explain why the change appears to be implemented this way.
4. Call out review risks, missing tests, and possible over-engineering.
5. Produce a concise checklist for the developer.

## Output

- Summary
- Main changes
- Why this change
- Review checklist
- Risks
- Suggested tests
`,
  },
  {
    item: {
      id: "test-planner",
      name: "Test Planner",
      description: "Suggest targeted tests based on changed files and project profile.",
      skillPath: skillEntryPath("test-planner"),
      source: "builtin",
      tags: ["tests", "quality", "coding-agent"],
      risk: "low",
    },
    content: `# Test Planner

Use this skill after code changes or before final verification.

## Workflow

1. Inspect changed files and project test commands.
2. Identify the smallest useful test set.
3. Suggest missing regression tests for changed behavior.
4. Prefer targeted tests before broad test suites.

## Output

- Existing tests to run
- Missing tests to add
- Risk areas not covered by tests
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
