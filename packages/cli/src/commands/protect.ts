import {
  getMemoryProtectionStatus,
  protectMemoryFiles,
  resolveRepoPath,
  type MemoryProtectionResult,
  type MemoryProtectionStatus,
} from "@specweft/core";
import { printText } from "../output.js";

export async function runProtect(repoArg: string, statusOnly = false): Promise<void> {
  const repoPath = resolveRepoPath(repoArg);
  const result = statusOnly
    ? await getMemoryProtectionStatus(repoPath)
    : await protectMemoryFiles(repoPath);

  printText(formatProtectionOutput(repoPath, result));
}

function formatProtectionOutput(
  repoPath: string,
  status: MemoryProtectionStatus | MemoryProtectionResult,
): string {
  const result = status as Partial<MemoryProtectionResult>;

  return [
    "SpecWeft 记忆保护",
    "",
    `项目路径：${repoPath}`,
    `密钥变量：${status.keyEnv}`,
    `密钥状态：${status.keyConfigured ? "已检测到" : "未检测到"}`,
    `保护状态：${status.summary}`,
    "",
    "文件：",
    ...status.files.map((file) =>
      `- ${file.label}: ${file.exists ? file.path : "未创建"}，${file.encrypted ? "已加密" : file.exists ? "明文" : "缺失"}`
    ),
    result.migratedFiles?.length ? "" : undefined,
    result.migratedFiles?.length ? `已迁移：${result.migratedFiles.length} 个文件` : undefined,
    result.createdFiles?.length ? `已创建：${result.createdFiles.length} 个文件` : undefined,
    result.skippedFiles?.length ? `已跳过：${result.skippedFiles.length} 个已加密文件` : undefined,
    status.warnings.length ? "" : undefined,
    ...status.warnings.map((warning) => `提醒：${warning}`),
    "",
    "使用方式：",
    "1. export SPECWEFT_MEMORY_KEY=\"一段足够长的本地密钥\"",
    "2. specweft protect",
    "3. 之后 Codex/Claude 通过 SpecWeft 读取记忆时，也需要同一个环境变量。",
  ].filter((line): line is string => line !== undefined).join("\n");
}
