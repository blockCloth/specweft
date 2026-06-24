import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type {
  AgentHarnessClient,
  AgentHarnessFile,
  AgentHarnessKind,
  AgentHarnessResult,
  ProjectProfile,
} from "../schemas/types.js";
import { SPECWEFT_MCP_TOOL_NAMES } from "../mcp/tool-names.js";

const HARNESS_VERSION = 1;

type HarnessTemplate = {
  client: AgentHarnessClient;
  kind: AgentHarnessKind;
  name: string;
  relativePath: string;
  content: string;
};

export async function writeAgentHarness(
  repoPath: string,
  profile: ProjectProfile,
): Promise<AgentHarnessResult> {
  const templates = createHarnessTemplates(profile);
  const files: AgentHarnessFile[] = [];

  for (const template of templates) {
    const filePath = path.join(repoPath, template.relativePath);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, `${template.content.trimEnd()}\n`, "utf-8");
    files.push({
      client: template.client,
      kind: template.kind,
      name: template.name,
      path: filePath,
    });
  }

  return {
    version: HARNESS_VERSION,
    files,
    skillNames: [...new Set(templates.filter((item) => item.kind === "skill").map((item) => item.name))],
    commandNames: [...new Set(templates.filter((item) => item.kind !== "skill").map((item) => item.name))],
  };
}

export function createHarnessTemplates(profile: ProjectProfile): HarnessTemplate[] {
  const sharedSkills = createSharedSkillTemplates(profile);
  const codexPrompts = createCodexPromptTemplates(profile);
  const claudeCommands = createClaudeCommandTemplates(profile);

  return [
    ...sharedSkills.flatMap((skill) => [
      {
        client: "generic" as const,
        kind: "skill" as const,
        name: skill.name,
        relativePath: `.agents/skills/${skill.name}/SKILL.md`,
        content: skill.content,
      },
      {
        client: "codex" as const,
        kind: "skill" as const,
        name: skill.name,
        relativePath: `.codex/skills/${skill.name}/SKILL.md`,
        content: skill.content,
      },
      {
        client: "claude" as const,
        kind: "skill" as const,
        name: skill.name,
        relativePath: `.claude/skills/${skill.name}/SKILL.md`,
        content: skill.content,
      },
    ]),
    ...codexPrompts.map((prompt) => ({
      client: "codex" as const,
      kind: "prompt" as const,
      name: prompt.name,
      relativePath: `.codex/prompts/${prompt.name}.md`,
      content: prompt.content,
    })),
    ...claudeCommands.map((command) => ({
      client: "claude" as const,
      kind: "command" as const,
      name: command.name,
      relativePath: `.claude/commands/specweft/${command.name}.md`,
      content: command.content,
    })),
  ];
}

function createSharedSkillTemplates(profile: ProjectProfile): Array<{ name: string; content: string }> {
  return [
    {
      name: "specweft-prepare-task",
      content: createSkillMarkdown({
        name: "specweft-prepare-task",
        description: "Use before planning or editing any coding request in this repository. It clarifies vague requirements, locates relevant files, recommends task Skills, and restores only relevant memory through SpecWeft MCP.",
        body: [
          `Project: ${profile.name}`,
          "",
          "Use this skill when a user gives a coding request, especially when the request is vague, continues older work, mentions a prior requirement, or may need project-specific rules.",
          "",
          "Workflow:",
          "1. Call `specweft.prepare_task` with the user's request before editing files.",
          "2. If the result has `missingQuestions`, ask the user unless the answer is obvious from the repository.",
          "3. If the result has `matchedRequirement` or `memorySuggestions`, call `specweft.restore_requirement` for the best matching requirement instead of loading all memory.",
          "4. Read `guardrail.startWorkSegmentInput` and `guardrail.recordCurrentDiffInput`; use these exact inputs later instead of inventing your own requirement id or title.",
          "5. Read the returned `codePointers`, `skillSuggestions`, and `executionPlan` before deciding where to edit.",
          "6. Prefer local `AGENTS.md` / `CLAUDE.md` rules over marketplace Skills when guidance conflicts.",
          "",
          "Do not install marketplace MCP servers automatically. Treat MCP recommendations as optional external integrations.",
        ],
      }),
    },
    {
      name: "specweft-before-edit",
      content: createSkillMarkdown({
        name: "specweft-before-edit",
        description: "Use immediately before modifying code in a SpecWeft-enabled repository. It creates a lightweight work boundary so mixed diffs can be explained and remembered by requirement.",
        body: [
          `Project: ${profile.name}`,
          "",
          "Use this skill after task preparation and before applying edits.",
          "",
          "Workflow:",
          "1. Call `specweft.get_recording_status` to understand whether the current diff is already recorded.",
          "2. Call `specweft.start_work_segment` with the exact `guardrail.startWorkSegmentInput` returned by `specweft.prepare_task`.",
          "3. If there are existing uncommitted changes, keep them separate in your explanation and avoid treating them as part of the new task unless the user says so.",
          "",
          "This skill does not replace normal code review. It only marks the local boundary that makes later review readable.",
        ],
      }),
    },
    {
      name: "specweft-after-edit-review",
      content: createSkillMarkdown({
        name: "specweft-after-edit-review",
        description: "Use after changing code in this repository. It records the current diff, generates a human-readable review explanation, closes the active work segment, and saves short-lived requirement memory.",
        body: [
          `Project: ${profile.name}`,
          "",
          "Use this skill whenever code was modified by the agent.",
          "",
          "Workflow:",
          "1. Call `specweft.get_recording_status` after edits.",
          "2. If the status is `unrecorded` or `changed-after-record`, call `specweft.record_current_diff` with the exact `guardrail.recordCurrentDiffInput` from task preparation when available.",
          "3. Summarize the generated `agentReview.suggestedAgentResponse` for the user; do not paste the full `advancedReview` unless asked.",
          "4. If the user only asks for a temporary explanation without saving memory, call `specweft.review_current_diff` instead.",
          "",
          "Never finish a coding turn with an unrecorded or changed-after-record diff unless the user explicitly asks you not to record it.",
        ],
      }),
    },
    {
      name: "specweft-memory-restore",
      content: createSkillMarkdown({
        name: "specweft-memory-restore",
        description: "Use when the user asks to continue, resume, recall, compare, or revisit older work. It reads the memory digest first, then restores only the relevant requirement memory.",
        body: [
          `Project: ${profile.name}`,
          "",
          "Use this skill when the user refers to previous work, an old feature, a missing thread, a rollback, or a requirement by keyword.",
          "",
          "Workflow:",
          "1. Call `specweft.get_memory_digest` to see the lightweight requirement-grouped memory entry point.",
          "2. Call `specweft.get_requirement_dossier` when the user needs a human-readable map of previous review sessions.",
          "3. Call `specweft.restore_requirement` with the best keyword or requirement id.",
          "4. Explain which recovered memory matters before editing new code.",
          "",
          "Do not paste the full memory history into context. Restore the smallest relevant requirement slice.",
        ],
      }),
    },
  ];
}

function createCodexPromptTemplates(profile: ProjectProfile): Array<{ name: string; content: string }> {
  return [
    {
      name: "specweft-review",
      content: createCommandMarkdown(profile, {
        title: "SpecWeft Review",
        invocation: "/specweft-review",
        body: [
          "Use this prompt after code has changed.",
          "",
          "Call `specweft.record_current_diff` with a concise title. Then explain the saved report in plain language:",
          "- what changed",
          "- where to start reading source code",
          "- risks",
          "- tests or checks to run",
        ],
      }),
    },
    {
      name: "specweft-continue",
      content: createCommandMarkdown(profile, {
        title: "SpecWeft Continue",
        invocation: "/specweft-continue <keyword>",
        body: [
          "Use this prompt when continuing old work or switching back to a previous requirement.",
          "",
          "Call `specweft.get_memory_digest`, then `specweft.get_requirement_dossier`, then `specweft.restore_requirement` with the user's keyword. Explain the recovered requirement before editing.",
        ],
      }),
    },
    {
      name: "specweft-restore",
      content: createCommandMarkdown(profile, {
        title: "SpecWeft Restore",
        invocation: "/specweft-restore <keyword-or-requirement-id>",
        body: [
          "Use this prompt to restore one requirement-scoped memory slice.",
          "",
          "Call `specweft.restore_requirement` using the provided keyword or requirement id. Keep the restored context narrow and do not load unrelated sessions.",
        ],
      }),
    },
    {
      name: "specweft-finish",
      content: createCommandMarkdown(profile, {
        title: "SpecWeft Finish",
        invocation: "/specweft-finish",
        body: [
          "Use this prompt before handing work back to the user.",
          "",
          "Call `specweft.get_recording_status`. If the diff is unrecorded or changed after the last record, call `specweft.record_current_diff`. Then provide a compact finish summary.",
        ],
      }),
    },
  ];
}

function createClaudeCommandTemplates(profile: ProjectProfile): Array<{ name: string; content: string }> {
  return createCodexPromptTemplates(profile).map((prompt) => ({
    name: prompt.name.replace("specweft-", ""),
    content: prompt.content,
  }));
}

function createSkillMarkdown(input: {
  name: string;
  description: string;
  body: string[];
}): string {
  return [
    "---",
    `name: ${input.name}`,
    `description: ${input.description}`,
    "---",
    "",
    `# ${input.name}`,
    "",
    ...input.body,
    "",
    "Required MCP tools:",
    ...SPECWEFT_MCP_TOOL_NAMES
      .filter((toolName) => isPrimaryHarnessTool(toolName))
      .map((toolName) => `- \`${toolName}\``),
  ].join("\n");
}

function createCommandMarkdown(
  profile: ProjectProfile,
  input: {
    title: string;
    invocation: string;
    body: string[];
  },
): string {
  return [
    `# ${input.title}`,
    "",
    `Project: ${profile.name}`,
    `Invocation: \`${input.invocation}\``,
    "",
    ...input.body,
    "",
    "Use SpecWeft MCP tools. Do not reimplement this workflow with shell commands unless MCP is unavailable.",
  ].join("\n");
}

function isPrimaryHarnessTool(toolName: string): boolean {
  return [
    "specweft.bootstrap_session",
    "specweft.prepare_task",
    "specweft.get_memory_digest",
    "specweft.get_requirement_dossier",
    "specweft.restore_requirement",
    "specweft.get_recording_status",
    "specweft.start_work_segment",
    "specweft.review_current_diff",
    "specweft.record_current_diff",
    "specweft.recommend_skills_for_task",
  ].includes(toolName);
}
