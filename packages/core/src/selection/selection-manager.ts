import type { ProjectSelectionFile, ProjectSelectionItem } from "../schemas/types.js";
import { listMcpPool, listSkillPool } from "../pool/pool-manager.js";
import { readJsonFile, writeJsonFile } from "../utils/json.js";
import {
  mcpProjectSelectionPath,
  skillProjectSelectionPath,
} from "./selection-path.js";

// 把全局 MCP Pool 里的某个 MCP 选入当前项目。
export async function applyProjectMcp(
  repoPath: string,
  id: string,
): Promise<ProjectSelectionItem> {
  await assertMcpExists(id);
  return setSelectionStatus(mcpProjectSelectionPath(repoPath), id, "enabled");
}

// 把全局 Skill Pool 里的某个 Skill 选入当前项目。
export async function applyProjectSkill(
  repoPath: string,
  id: string,
): Promise<ProjectSelectionItem> {
  await assertSkillExists(id);
  return setSelectionStatus(skillProjectSelectionPath(repoPath), id, "enabled");
}

export async function disableProjectMcp(
  repoPath: string,
  id: string,
): Promise<ProjectSelectionItem> {
  await assertMcpExists(id);
  return setSelectionStatus(mcpProjectSelectionPath(repoPath), id, "disabled");
}

export async function disableProjectSkill(
  repoPath: string,
  id: string,
): Promise<ProjectSelectionItem> {
  await assertSkillExists(id);
  return setSelectionStatus(skillProjectSelectionPath(repoPath), id, "disabled");
}

export async function ignoreProjectMcp(
  repoPath: string,
  id: string,
): Promise<ProjectSelectionItem> {
  await assertMcpExists(id);
  return setSelectionStatus(mcpProjectSelectionPath(repoPath), id, "ignored");
}

export async function ignoreProjectSkill(
  repoPath: string,
  id: string,
): Promise<ProjectSelectionItem> {
  await assertSkillExists(id);
  return setSelectionStatus(skillProjectSelectionPath(repoPath), id, "ignored");
}

export async function readProjectMcpSelection(repoPath: string): Promise<ProjectSelectionFile> {
  return readSelectionFile(mcpProjectSelectionPath(repoPath));
}

export async function readProjectSkillSelection(repoPath: string): Promise<ProjectSelectionFile> {
  return readSelectionFile(skillProjectSelectionPath(repoPath));
}

async function setSelectionStatus(
  selectionPath: string,
  id: string,
  status: ProjectSelectionItem["status"],
): Promise<ProjectSelectionItem> {
  // 项目选择文件不存在时，用空 selected 列表初始化。
  const selectionFile = await readSelectionFile(selectionPath);
  const existing = selectionFile.selected.find((item) => item.id === id);
  const appliedAt = new Date().toISOString();

  if (existing) {
    existing.status = status;
    existing.reason = createReason(status);
    existing.appliedAt = appliedAt;
    await writeJsonFile(selectionPath, selectionFile);
    return existing;
  }

  const newItem: ProjectSelectionItem = {
    id,
    status,
    reason: createReason(status),
    appliedAt,
  };

  selectionFile.selected.push(newItem);
  await writeJsonFile(selectionPath, selectionFile);
  return newItem;
}

async function readSelectionFile(selectionPath: string): Promise<ProjectSelectionFile> {
  return normalizeSelectionFile(
    await readJsonFile<ProjectSelectionFile | LegacySelectionFile>(selectionPath),
  );
}

async function assertMcpExists(id: string): Promise<void> {
  const pool = await listMcpPool();
  if (!pool.items.some((item) => item.id === id)) {
    throw new Error(`MCP "${id}" was not found in the global pool. Run "specweft pool init" first.`);
  }
}

async function assertSkillExists(id: string): Promise<void> {
  const pool = await listSkillPool();
  if (!pool.items.some((item) => item.id === id)) {
    throw new Error(`Skill "${id}" was not found in the global pool. Run "specweft pool init" first.`);
  }
}

function createReason(status: ProjectSelectionItem["status"]): string {
  if (status === "enabled") {
    return "Applied by user";
  }
  if (status === "disabled") {
    return "Disabled by user";
  }
  return "Ignored by user";
}

type LegacySelectionFile = {
  version: number;
  file: Array<{
    id: string;
    status: "enable" | "disable" | "ignore";
    reason: string;
    appliedAt: string;
  }>;
};

function normalizeSelectionFile(
  value: ProjectSelectionFile | LegacySelectionFile | undefined,
): ProjectSelectionFile {
  if (!value) {
    return {
      version: 1,
      selected: [],
    };
  }

  if ("selected" in value) {
    return value;
  }

  return {
    version: value.version,
    selected: value.file.map((item) => ({
      id: item.id,
      status: item.status === "enable"
        ? "enabled"
        : item.status === "disable"
          ? "disabled"
          : "ignored",
      reason: item.reason,
      appliedAt: item.appliedAt,
    })),
  };
}
