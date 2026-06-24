import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type {
  BootstrapSession,
  ProjectProfile,
  ProjectSelectionItem,
  SpecWeftInitResult,
} from "../schemas/types.js";
import { createRuntimeAssembly } from "../assembly/runtime-assembly.js";
import { createMemoryDigest, createMemoryHandoff } from "../memory/session-memory.js";
import { createRequirementDossier } from "../memory/requirement-dossier.js";
import { initializeGlobalPools } from "../pool/pool-manager.js";
import { recommendForProject } from "../recommendations/recommender.js";
import { initializeProject, scanProject } from "../scanner/project-scanner.js";
import { applyProjectMcp, applyProjectSkill } from "../selection/selection-manager.js";
import { projectConfigDir } from "../utils/path.js";
import { createCapabilityCenter } from "../capabilities/capability-center.js";
import { getActiveRequirement } from "../requirements/requirement-manager.js";
import { writeAgentHarness } from "../harness/agent-harness.js";

const DEFAULT_MCP_IDS = ["filesystem", "git"];
const DEFAULT_SKILL_IDS = ["diff-explainer", "test-planner"];
const INSTRUCTION_START_MARKER = "<!-- SPECWEFT:START -->";
const INSTRUCTION_END_MARKER = "<!-- SPECWEFT:END -->";

export async function createBootstrapSession(
  repoPath: string,
  keyword?: string,
  memoryLimit = 5,
): Promise<BootstrapSession> {
  const profile = await scanProject(repoPath);
  const requirement = await getActiveRequirement(repoPath);
  const [recommendations, capabilityCenter, assembly, handoff, memoryDigest, requirementDossier] = await Promise.all([
    recommendForProject(profile, repoPath),
    createCapabilityCenter(profile, repoPath),
    createRuntimeAssembly(repoPath),
    createMemoryHandoff(repoPath, profile, keyword, memoryLimit, requirement),
    createMemoryDigest(repoPath, profile),
    createRequirementDossier(repoPath, profile, { sessionPreviewLimit: 2 }),
  ]);

  return {
    projectId: profile.id,
    projectName: profile.name,
    generatedAt: new Date().toISOString(),
    profile,
    recommendations,
    capabilityCenter,
    assembly,
    handoff,
    memoryDigest,
    requirementDossier,
    workflow: createAgentWorkflow(),
  };
}

// 一键初始化当前项目：项目画像、全局池、默认安全工具、agent 引导文件一起落地。
export async function initializeSpecWeftProject(repoPath: string): Promise<SpecWeftInitResult> {
  const profile = await initializeProject(repoPath);
  const pool = await initializeGlobalPools();
  const enabled = await enableDefaultTools(repoPath);
  const bootstrap = await createBootstrapSession(repoPath);
  const instructionPaths = await writeAgentInstructions(repoPath, profile);
  const harness = await writeAgentHarness(repoPath, profile);

  return {
    repoPath,
    profile,
    pool,
    enabled,
    instructionPaths,
    harness,
    bootstrap,
    nextCommands: [
      "specweft start",
      "specweft mcp-inspect",
      "specweft review",
      "specweft handoff",
    ],
  };
}

function createAgentWorkflow(): BootstrapSession["workflow"] {
  return [
    {
      when: "At the beginning of a coding session",
      actions: [
        "Call specweft.bootstrap_session once before planning code changes.",
        "Call specweft.get_memory_digest to see requirement-grouped long-term memory without filling the full context.",
        "Call specweft.get_requirement_dossier when you need a human-readable map of repeated reviews by requirement.",
        "Call specweft.get_memory_index only when you need recent raw memory entries.",
        "Use the returned profile, runtime assembly, recommendations, digest, and dossier as local project context.",
      ],
    },
    {
      when: "Before planning a user coding request",
      actions: [
        "Call specweft.prepare_task with the user's request before editing code.",
        "If prepare_task returns missingQuestions, ask the user unless the answer is obvious from the repository.",
        "If prepare_task returns relevant memorySuggestions, call specweft.restore_requirement for the best match before editing.",
        "Call specweft.start_work_segment with prepare_task.guardrail.startWorkSegmentInput before editing.",
        "Keep prepare_task.guardrail.recordCurrentDiffInput for the final record_current_diff call.",
        "Use specweft.recommend_skills_for_task to pick task-specific Skills instead of enabling unrelated tools.",
      ],
    },
    {
      when: "Before applying MCP or Skill recommendations",
      actions: [
        "Prefer local project rules over marketplace Skills when they conflict.",
        "Do not install or enable marketplace MCPs automatically when they require credentials or broad permissions.",
      ],
    },
    {
      when: "After changing code",
      actions: [
        "Call specweft.record_current_diff with prepare_task.guardrail.recordCurrentDiffInput to persist the review report and memory.",
        "record_current_diff automatically closes the active work segment; call specweft.get_work_segment_status if the diff mixes several requests.",
        "Call specweft.get_recording_status again; if it is unrecorded or changed-after-record, call specweft.record_current_diff before handing back.",
        "Use record_current_diff.agentReview.suggestedAgentResponse for the user-facing explanation; read advancedReview only if the user asks for deeper evidence.",
        "If you only need a temporary explanation without saving, call specweft.review_current_diff and use agentReview.",
      ],
    },
    {
      when: "When the user asks to continue old work",
      actions: [
        "Call specweft.get_memory_digest and specweft.get_requirement_dossier first, then specweft.restore_requirement with the user's keyword or the matched requirement id.",
        "Explain which recovered memory matters before editing new code.",
      ],
    },
  ];
}

async function enableDefaultTools(repoPath: string): Promise<{
  mcps: ProjectSelectionItem[];
  skills: ProjectSelectionItem[];
}> {
  const mcps: ProjectSelectionItem[] = [];
  const skills: ProjectSelectionItem[] = [];

  for (const id of DEFAULT_MCP_IDS) {
    mcps.push(await applyProjectMcp(repoPath, id));
  }
  for (const id of DEFAULT_SKILL_IDS) {
    skills.push(await applyProjectSkill(repoPath, id));
  }

  return { mcps, skills };
}

async function writeAgentInstructions(
  repoPath: string,
  profile: ProjectProfile,
): Promise<string[]> {
  const configInstructionPath = path.join(projectConfigDir(repoPath), "agent-instructions.md");
  const instruction = createAgentInstructionBlock(profile);
  const writtenPaths = [configInstructionPath];

  await writeFile(configInstructionPath, instruction, "utf-8");

  const agentFilePath = path.join(repoPath, "AGENTS.md");
  await upsertInstructionBlock(agentFilePath, instruction);
  writtenPaths.push(agentFilePath);

  const claudeFilePath = path.join(repoPath, "CLAUDE.md");
  await upsertInstructionBlock(claudeFilePath, instruction);
  writtenPaths.push(claudeFilePath);

  return writtenPaths;
}

function createAgentInstructionBlock(profile: ProjectProfile): string {
  return [
    INSTRUCTION_START_MARKER,
    "# SpecWeft Agent Instructions",
    "",
    `Project: ${profile.name}`,
    "",
    "When this project is opened in Codex, Claude, or another MCP-compatible coding agent:",
    "",
    "1. At the beginning of a coding session, call `specweft.bootstrap_session` once.",
    "2. Read `specweft.get_memory_digest` and `specweft.get_requirement_dossier` as the long-term memory entry points. Restore only the relevant requirement, never the entire history.",
    "3. Before planning or editing a user request, call `specweft.prepare_task` with the user's natural language task.",
    "4. If `prepare_task` returns `missingQuestions`, ask the user unless the answer is obvious from the repository.",
    "5. If `prepare_task` returns relevant memories, call `specweft.restore_requirement` for the best match instead of loading every memory.",
    "6. Before editing, call `specweft.start_work_segment` with `prepare_task.guardrail.startWorkSegmentInput`, so mixed uncommitted diffs can be separated by request boundary.",
    "7. Use `specweft.recommend_skills_for_task` for task-specific Skill routing. Treat MCP recommendations as optional, not required.",
    "8. Call `specweft.get_recording_status` before and after edits; never finish with an unrecorded or changed-after-record diff.",
    "9. After changing code, call `specweft.record_current_diff` with `prepare_task.guardrail.recordCurrentDiffInput`, then use `agentReview.suggestedAgentResponse` for the user-facing explanation.",
    "10. Do not install marketplace MCPs or Skills automatically when they require credentials, network access, database access, or conflict with local rules.",
    "",
    INSTRUCTION_END_MARKER,
  ].join("\n");
}

async function upsertInstructionBlock(filePath: string, instruction: string): Promise<void> {
  try {
    const content = await readFile(filePath, "utf-8");
    const nextContent = replaceManagedInstructionBlock(content, instruction);
    await writeFile(filePath, nextContent, "utf-8");
  } catch {
    await writeFile(filePath, `${instruction}\n`, "utf-8");
  }
}

function replaceManagedInstructionBlock(content: string, instruction: string): string {
  const start = content.indexOf(INSTRUCTION_START_MARKER);
  const end = content.indexOf(INSTRUCTION_END_MARKER);

  if (start >= 0 && end >= start) {
    const before = content.slice(0, start).trimEnd();
    const after = content.slice(end + INSTRUCTION_END_MARKER.length).trimStart();

    return [
      before,
      instruction,
      after,
    ].filter(Boolean).join("\n\n").concat("\n");
  }

  return `${content.trimEnd()}\n\n${instruction}\n`;
}
