import path from "node:path";
import type { ProjectSettings, ProjectSettingsPatch } from "../schemas/types.js";
import { readJsonFile, writeJsonFile } from "../utils/json.js";
import { projectConfigDir, toPosixPath } from "../utils/path.js";

const DEFAULT_SKILL_REGISTRY_URL = "https://skillsmp.com/api/skills";

export const DEFAULT_PROJECT_SETTINGS: ProjectSettings = {
  version: 1,
  changeRecording: {
    autoRecordDiff: true,
    autoLinkRequirement: true,
    retentionDays: 90,
  },
  contextMemory: {
    maxRetainedTurns: 20,
    compressionStrategy: "summary",
    ignorePaths: ["node_modules/", "dist/", ".next/"],
  },
  capabilities: {
    skillRegistryUrl: DEFAULT_SKILL_REGISTRY_URL,
    autoCheckSkillUpdates: true,
    mcpStdioTimeoutMs: 15000,
  },
  updatedAt: "1970-01-01T00:00:00.000Z",
};

export async function readProjectSettings(repoPath: string): Promise<ProjectSettings> {
  const raw = await readJsonFile<Partial<ProjectSettings>>(projectSettingsPath(repoPath));
  return normalizeProjectSettings(raw);
}

export async function writeProjectSettings(
  repoPath: string,
  settings: ProjectSettings,
): Promise<ProjectSettings> {
  const normalized = normalizeProjectSettings(settings);
  await writeJsonFile(projectSettingsPath(repoPath), normalized);
  return normalized;
}

export async function updateProjectSettings(
  repoPath: string,
  patch: ProjectSettingsPatch,
): Promise<ProjectSettings> {
  const current = await readProjectSettings(repoPath);
  return writeProjectSettings(repoPath, {
    ...current,
    changeRecording: {
      ...current.changeRecording,
      ...patch.changeRecording,
    },
    contextMemory: {
      ...current.contextMemory,
      ...patch.contextMemory,
    },
    capabilities: {
      ...current.capabilities,
      ...patch.capabilities,
    },
    updatedAt: new Date().toISOString(),
  });
}

export async function ensureProjectSettings(repoPath: string): Promise<ProjectSettings> {
  const existing = await readJsonFile<Partial<ProjectSettings>>(projectSettingsPath(repoPath));
  const settings = normalizeProjectSettings(existing);
  if (!existing) {
    await writeProjectSettings(repoPath, {
      ...settings,
      updatedAt: new Date().toISOString(),
    });
  }
  return settings;
}

export function projectSettingsPath(repoPath: string): string {
  return path.join(projectConfigDir(repoPath), "settings.json");
}

export function normalizeProjectSettings(input?: Partial<ProjectSettings>): ProjectSettings {
  const changeRecording: Partial<ProjectSettings["changeRecording"]> = input?.changeRecording ?? {};
  const contextMemory: Partial<ProjectSettings["contextMemory"]> = input?.contextMemory ?? {};
  const capabilities: Partial<ProjectSettings["capabilities"]> = input?.capabilities ?? {};

  return {
    version: 1,
    changeRecording: {
      autoRecordDiff: booleanValue(changeRecording.autoRecordDiff, DEFAULT_PROJECT_SETTINGS.changeRecording.autoRecordDiff),
      autoLinkRequirement: booleanValue(changeRecording.autoLinkRequirement, DEFAULT_PROJECT_SETTINGS.changeRecording.autoLinkRequirement),
      retentionDays: boundedNumber(changeRecording.retentionDays, 1, 365, DEFAULT_PROJECT_SETTINGS.changeRecording.retentionDays),
    },
    contextMemory: {
      maxRetainedTurns: boundedNumber(contextMemory.maxRetainedTurns, 1, 200, DEFAULT_PROJECT_SETTINGS.contextMemory.maxRetainedTurns),
      compressionStrategy: contextMemory.compressionStrategy === "sliding-window" || contextMemory.compressionStrategy === "none"
        ? contextMemory.compressionStrategy
        : DEFAULT_PROJECT_SETTINGS.contextMemory.compressionStrategy,
      ignorePaths: normalizeIgnorePaths(contextMemory.ignorePaths),
    },
    capabilities: {
      skillRegistryUrl: normalizeUrl(capabilities.skillRegistryUrl, DEFAULT_PROJECT_SETTINGS.capabilities.skillRegistryUrl),
      autoCheckSkillUpdates: booleanValue(capabilities.autoCheckSkillUpdates, DEFAULT_PROJECT_SETTINGS.capabilities.autoCheckSkillUpdates),
      mcpStdioTimeoutMs: boundedNumber(capabilities.mcpStdioTimeoutMs, 1000, 120000, DEFAULT_PROJECT_SETTINGS.capabilities.mcpStdioTimeoutMs),
    },
    updatedAt: input?.updatedAt || new Date().toISOString(),
  };
}

export function isIgnoredByProjectSettings(filePath: string, settings: ProjectSettings): boolean {
  const normalized = normalizeComparablePath(filePath);
  return settings.contextMemory.ignorePaths.some((pattern) => {
    const normalizedPattern = normalizeComparablePath(pattern);
    if (!normalizedPattern) {
      return false;
    }
    return normalized === normalizedPattern
      || normalized.startsWith(`${normalizedPattern}/`);
  });
}

export function filterIgnoredPaths(paths: string[], settings: ProjectSettings): string[] {
  return paths.filter((filePath) => !isIgnoredByProjectSettings(filePath, settings));
}

function normalizeIgnorePaths(value: unknown): string[] {
  const rawItems = Array.isArray(value)
    ? value
    : DEFAULT_PROJECT_SETTINGS.contextMemory.ignorePaths;

  return [
    ...new Set(
      rawItems
        .map((item) => normalizeComparablePath(String(item)))
        .filter(Boolean),
    ),
  ].slice(0, 80);
}

function normalizeComparablePath(filePath: string): string {
  return toPosixPath(filePath)
    .trim()
    .replace(/^\.\/+/, "")
    .replace(/^\/+/, "")
    .replace(/\/+$/, "");
}

function normalizeUrl(value: unknown, fallback: string): string {
  const candidate = String(value || "").trim();
  if (!candidate) {
    return fallback;
  }

  try {
    const url = new URL(candidate);
    return url.toString().replace(/\/$/, "");
  } catch {
    return fallback;
  }
}

function booleanValue(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function boundedNumber(value: unknown, min: number, max: number, fallback: number): number {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, Math.round(number)));
}
