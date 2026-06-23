import { execFile } from "node:child_process";
import crypto from "node:crypto";
import { promisify } from "node:util";
import type {
  CodeSnapshotState,
  DiffFileChange,
  GitChangeSnapshot,
} from "../schemas/types.js";

const execFileAsync = promisify(execFile);

// 记录 review 生成时的代码指纹。这里忽略 .specweft，避免报告文件本身改变 diffHash。
export async function createGitChangeSnapshot(
  repoPath: string,
  diffText?: string,
  changedFiles?: DiffFileChange[],
): Promise<GitChangeSnapshot> {
  const [head, normalizedDiffText, normalizedChangedFiles] = await Promise.all([
    readGitHead(repoPath),
    diffText === undefined ? readTrackedDiff(repoPath) : Promise.resolve(diffText),
    changedFiles === undefined ? readChangedFilePaths(repoPath) : Promise.resolve(changedFiles.map((file) => file.path)),
  ]);

  const cleanChangedFiles = normalizeChangedFiles(normalizedChangedFiles);

  const fingerprint = [
    normalizeDiffText(normalizedDiffText),
    cleanChangedFiles.join("\n"),
  ].join("\n--- specweft changed files ---\n");

  return {
    head,
    diffHash: hashDiff(fingerprint),
    changedFiles: cleanChangedFiles,
    hasChanges: cleanChangedFiles.length > 0,
    capturedAt: new Date().toISOString(),
  };
}

export async function evaluateCodeSnapshot(
  repoPath: string,
  snapshot?: GitChangeSnapshot,
): Promise<CodeSnapshotState> {
  const checkedAt = new Date().toISOString();

  if (!snapshot) {
    return {
      status: "unknown",
      reason: "这条记录没有保存代码快照，无法判断当前代码是否仍然匹配。",
      checkedAt,
    };
  }

  const currentSnapshot = await createGitChangeSnapshot(repoPath);

  if (snapshot.diffHash === currentSnapshot.diffHash && snapshot.head === currentSnapshot.head) {
    return {
      status: "current",
      reason: "当前代码状态和生成 review 时一致。",
      checkedAt,
      currentSnapshot,
    };
  }

  if (!currentSnapshot.hasChanges) {
    return {
      status: "reverted",
      reason: "当前工作区没有未提交改动，这条 review 对应的 diff 很可能已经被回滚或提交后清空。",
      checkedAt,
      currentSnapshot,
    };
  }

  if (!hasAnyOverlap(snapshot.changedFiles, currentSnapshot.changedFiles)) {
    return {
      status: "reverted",
      reason: "当前 diff 已经不包含这条 review 记录里的修改文件，可能已切换到其他需求或回滚。",
      checkedAt,
      currentSnapshot,
    };
  }

  return {
    status: "stale",
    reason: "当前 diff 和生成 review 时不完全一致，建议重新生成 review 后再继续使用这条记忆。",
    checkedAt,
    currentSnapshot,
  };
}

async function readGitHead(repoPath: string): Promise<string> {
  const head = await runGit(repoPath, ["rev-parse", "HEAD"]);
  return head.trim() || "unknown";
}

async function readTrackedDiff(repoPath: string): Promise<string> {
  return runGit(repoPath, [
    "diff",
    "HEAD",
    "--patch",
    "--",
    ".",
    ":(exclude).specweft",
  ]);
}

async function readChangedFilePaths(repoPath: string): Promise<string[]> {
  const statusText = await runGit(repoPath, ["status", "--porcelain=v1", "-z", "--untracked-files=all"]);
  return parsePorcelainStatusPaths(statusText)
    .filter((filePath) => Boolean(filePath) && !filePath.startsWith(".specweft/"));
}

function parsePorcelainStatusPaths(statusText: string): string[] {
  return statusText
    .split("\0")
    .map((entry) => entry.trimEnd())
    .filter(Boolean)
    .map((entry) => entry.slice(3).trim())
    .filter(Boolean);
}

async function runGit(repoPath: string, args: string[]): Promise<string> {
  try {
    const result = await execFileAsync("git", args, {
      cwd: repoPath,
      maxBuffer: 20 * 1024 * 1024,
    });
    return result.stdout;
  } catch {
    return "";
  }
}

function normalizeDiffText(diffText: string): string {
  const patchStart = diffText.indexOf("diff --git ");
  const patchText = patchStart >= 0 ? diffText.slice(patchStart) : diffText;

  return patchText
    .split("\n")
    .filter((line) => !line.includes(".specweft/"))
    .join("\n")
    .trim();
}

function normalizeChangedFiles(files: string[]): string[] {
  return [
    ...new Set(
      files
        .map((file) => file.trim())
        .filter(Boolean)
        .filter((file) => !file.startsWith(".specweft/"))
        .sort(),
    ),
  ];
}

function hashDiff(diffText: string): string {
  return crypto.createHash("sha256").update(diffText).digest("hex");
}

function hasAnyOverlap(left: string[], right: string[]): boolean {
  const rightSet = new Set(right);
  return left.some((item) => rightSet.has(item));
}
