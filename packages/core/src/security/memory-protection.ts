import path from "node:path";
import type {
  MemoryProtectionFileStatus,
  MemoryProtectionResult,
  MemoryProtectionStatus,
} from "../schemas/types.js";
import { projectConfigDir } from "../utils/path.js";
import {
  getSecureJsonState,
  hasMemoryEncryptionKey,
  readSecureJsonFile,
  writeSecureJsonFile,
} from "./secure-json.js";

type ProtectedFileDefinition = {
  id: MemoryProtectionFileStatus["id"];
  label: string;
  fileName: string;
  defaultValue: unknown;
};

const PROTECTED_FILES: ProtectedFileDefinition[] = [
  {
    id: "memory",
    label: "Session memory",
    fileName: "memory.json",
    defaultValue: { sessions: [] },
  },
  {
    id: "requirements",
    label: "Requirement state",
    fileName: "requirements.json",
    defaultValue: { version: 1, requirements: [] },
  },
  {
    id: "workSegments",
    label: "Work segments",
    fileName: "work-segments.json",
    defaultValue: { version: 1, segments: [] },
  },
  {
    id: "agentActivity",
    label: "Agent activity",
    fileName: "agent-activity.json",
    defaultValue: { version: 1, events: [] },
  },
];

export async function getMemoryProtectionStatus(repoPath: string): Promise<MemoryProtectionStatus> {
  const files = await readProtectedFileStatuses(repoPath);
  return createProtectionStatus(files);
}

export async function protectMemoryFiles(repoPath: string): Promise<MemoryProtectionResult> {
  if (!hasMemoryEncryptionKey()) {
    throw new Error("Set SPECWEFT_MEMORY_KEY before running specweft protect.");
  }

  const before = await readProtectedFileStatuses(repoPath);
  const migratedFiles: string[] = [];
  const createdFiles: string[] = [];
  const skippedFiles: string[] = [];

  for (const definition of PROTECTED_FILES) {
    const filePath = protectedFilePath(repoPath, definition);
    const current = before.find((file) => file.id === definition.id);
    const value = (await readSecureJsonFile<unknown>(filePath)) ?? definition.defaultValue;
    await writeSecureJsonFile(filePath, value);

    if (!current?.exists) {
      createdFiles.push(filePath);
      continue;
    }
    if (current.encrypted) {
      skippedFiles.push(filePath);
      continue;
    }
    migratedFiles.push(filePath);
  }

  return {
    ...(await getMemoryProtectionStatus(repoPath)),
    migratedFiles,
    createdFiles,
    skippedFiles,
  };
}

async function readProtectedFileStatuses(repoPath: string): Promise<MemoryProtectionFileStatus[]> {
  return Promise.all(
    PROTECTED_FILES.map(async (definition) => {
      const state = await getSecureJsonState(protectedFilePath(repoPath, definition));
      return {
        id: definition.id,
        label: definition.label,
        path: state.path,
        exists: state.exists,
        encrypted: state.encrypted,
        algorithm: state.algorithm,
        version: state.version,
      };
    }),
  );
}

function createProtectionStatus(files: MemoryProtectionFileStatus[]): MemoryProtectionStatus {
  const keyConfigured = hasMemoryEncryptionKey();
  const protectedFiles = files.filter((file) => file.encrypted).length;
  const plaintextFiles = files.filter((file) => file.exists && !file.encrypted).length;
  const missingFiles = files.filter((file) => !file.exists).length;
  const warnings = createProtectionWarnings(keyConfigured, plaintextFiles, missingFiles);

  return {
    keyEnv: "SPECWEFT_MEMORY_KEY",
    keyConfigured,
    protectedFiles,
    plaintextFiles,
    missingFiles,
    files,
    warnings,
    summary: createProtectionSummary(keyConfigured, protectedFiles, plaintextFiles, missingFiles),
  };
}

function createProtectionWarnings(
  keyConfigured: boolean,
  plaintextFiles: number,
  missingFiles: number,
): string[] {
  const warnings: string[] = [];

  if (!keyConfigured) {
    warnings.push("未设置 SPECWEFT_MEMORY_KEY，需求记忆会以本地明文 JSON 保存。");
  }
  if (keyConfigured && plaintextFiles > 0) {
    warnings.push("仍有历史记忆文件是明文。运行 specweft protect 可迁移为加密存储。");
  }
  if (missingFiles > 0) {
    warnings.push("部分记忆状态文件尚未创建；SpecWeft 会在需要时自动创建。");
  }

  return warnings;
}

function createProtectionSummary(
  keyConfigured: boolean,
  protectedFiles: number,
  plaintextFiles: number,
  missingFiles: number,
): string {
  if (keyConfigured && plaintextFiles === 0 && protectedFiles > 0) {
    return `需求记忆保护已启用，${protectedFiles} 个文件已加密。`;
  }

  if (keyConfigured) {
    return `已配置记忆密钥：${protectedFiles} 个已加密，${plaintextFiles} 个仍为明文，${missingFiles} 个尚未创建。`;
  }

  return `需求记忆保护是可选项，当前未启用：${plaintextFiles} 个明文文件，${missingFiles} 个尚未创建。`;
}

function protectedFilePath(repoPath: string, definition: ProtectedFileDefinition): string {
  return path.join(projectConfigDir(repoPath), definition.fileName);
}
