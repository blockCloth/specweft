import { appendFile, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type {
  BootstrapSession,
  ProjectProfile,
  ProjectSelectionItem,
  SpecWeftInitResult,
} from "../schemas/types.js";
import { createRuntimeAssembly } from "../assembly/runtime-assembly.js";
import { createMemoryHandoff } from "../memory/session-memory.js";
import { initializeGlobalPools } from "../pool/pool-manager.js";
import { recommendForProject } from "../recommendations/recommender.js";
import { initializeProject, scanProject } from "../scanner/project-scanner.js";
import { applyProjectMcp, applyProjectSkill } from "../selection/selection-manager.js";
import { projectConfigDir } from "../utils/path.js";

const DEFAULT_MCP_IDS = ["filesystem", "git"];
const DEFAULT_SKILL_IDS = ["diff-explainer", "test-planner"];

export async function createBootstrapSession(
  repoPath: string,
  keyword?: string,
  memoryLimit = 5,
): Promise<BootstrapSession> {
  const profile = await scanProject(repoPath);
  const [recommendations, assembly, handoff] = await Promise.all([
    recommendForProject(profile, repoPath),
    createRuntimeAssembly(repoPath),
    createMemoryHandoff(repoPath, profile, keyword, memoryLimit),
  ]);

  return {
    projectId: profile.id,
    projectName: profile.name,
    generatedAt: new Date().toISOString(),
    profile,
    recommendations,
    assembly,
    handoff,
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

  return {
    repoPath,
    profile,
    pool,
    enabled,
    instructionPaths,
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
        "Use the returned profile, runtime assembly, recommendations, and handoff summary as local project context.",
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
        "Call specweft.review_current_diff to explain the change for the user.",
        "Call specweft.save_session_memory with a short title, summary, keywords, and changed files.",
      ],
    },
    {
      when: "When the user asks to continue old work",
      actions: [
        "Call specweft.create_memory_handoff with the user's keyword if they mention one.",
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
  if (await shouldAppendInstruction(agentFilePath)) {
    await appendFile(agentFilePath, `\n\n${instruction}`, "utf-8");
    writtenPaths.push(agentFilePath);
  }

  const claudeFilePath = path.join(repoPath, "CLAUDE.md");
  if (await shouldAppendInstruction(claudeFilePath)) {
    await appendFile(claudeFilePath, `\n\n${instruction}`, "utf-8");
    writtenPaths.push(claudeFilePath);
  }

  return writtenPaths;
}

function createAgentInstructionBlock(profile: ProjectProfile): string {
  return [
    "<!-- SPECWEFT:START -->",
    "# SpecWeft Agent Instructions",
    "",
    `Project: ${profile.name}`,
    "",
    "When this project is opened in Codex, Claude, or another MCP-compatible coding agent:",
    "",
    "1. At the beginning of a coding session, call `specweft.bootstrap_session` once.",
    "2. Use the returned project profile, enabled MCP/Skill assembly, recommendations, and memory handoff before planning edits.",
    "3. If the user asks to continue earlier work, call `specweft.create_memory_handoff` with the user's keyword.",
    "4. After changing code, call `specweft.review_current_diff` and then `specweft.save_session_memory`.",
    "5. Do not install marketplace MCPs or Skills automatically when they require credentials, network access, database access, or conflict with local rules.",
    "",
    "<!-- SPECWEFT:END -->",
  ].join("\n");
}

async function shouldAppendInstruction(filePath: string): Promise<boolean> {
  try {
    const content = await readFile(filePath, "utf-8");
    return !content.includes("<!-- SPECWEFT:START -->");
  } catch {
    return true;
  }
}
