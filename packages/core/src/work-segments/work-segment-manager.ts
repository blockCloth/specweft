import crypto from "node:crypto";
import path from "node:path";
import type {
  GitChangeSnapshot,
  ProjectProfile,
  WorkSegment,
  WorkSegmentCompletionInput,
  WorkSegmentFile,
  WorkSegmentInput,
  WorkSegmentStatus,
  WorkSegmentStatusReport,
} from "../schemas/types.js";
import { createGitChangeSnapshot } from "../git/change-snapshot.js";
import { readJsonFile, writeJsonFile } from "../utils/json.js";
import { projectConfigDir } from "../utils/path.js";

const MAX_STORED_SEGMENTS = 100;

// 工作段是“某一次需求修改”的轻量边界。它不保存 patch 正文，只保存开始/结束快照、
// 需求归属和文件集合，用来帮助 Agent 在多个需求交错时恢复上下文。
export async function startWorkSegment(
  repoPath: string,
  input: WorkSegmentInput,
): Promise<{
  segment: WorkSegment;
  interruptedSegment?: WorkSegment;
}> {
  const file = await readWorkSegmentFile(repoPath);
  const now = new Date().toISOString();
  const startSnapshot = await createGitChangeSnapshot(repoPath);
  const interruptedSegment = await interruptActiveSegmentIfNeeded(repoPath, file, now);
  const title = createSegmentTitle(input);
  const segment: WorkSegment = {
    id: createSegmentId(input.projectId, title, now),
    projectId: input.projectId,
    requirementId: input.requirement?.id,
    requirementTitle: input.requirement?.title,
    title,
    task: input.task.trim(),
    status: "active",
    startSnapshot,
    baselineChangedFiles: startSnapshot.changedFiles,
    currentChangedFiles: startSnapshot.changedFiles,
    newChangedFiles: [],
    carriedChangedFiles: startSnapshot.changedFiles,
    createdAt: now,
    updatedAt: now,
  };

  file.segments.unshift(segment);
  file.activeSegmentId = segment.id;
  await writeWorkSegmentFile(repoPath, file);

  return {
    segment,
    interruptedSegment,
  };
}

export async function completeWorkSegment(
  repoPath: string,
  input: WorkSegmentCompletionInput = {},
): Promise<WorkSegment | undefined> {
  const file = await readWorkSegmentFile(repoPath);
  const segment = resolveSegmentForCompletion(file, input.segmentId);

  if (!segment) {
    return undefined;
  }

  const completed = await completeSegment(repoPath, segment, input.status ?? "recorded", input);
  if (file.activeSegmentId === completed.id) {
    file.activeSegmentId = undefined;
  }
  await writeWorkSegmentFile(repoPath, file);

  return completed;
}

export async function getActiveWorkSegment(repoPath: string): Promise<WorkSegment | undefined> {
  const file = await readWorkSegmentFile(repoPath);
  return file.segments.find((segment) => segment.id === file.activeSegmentId && segment.status === "active");
}

export async function listWorkSegments(repoPath: string, limit = 20): Promise<WorkSegment[]> {
  const file = await readWorkSegmentFile(repoPath);
  return sortSegments(file.segments).slice(0, Math.max(1, limit));
}

export async function createWorkSegmentStatus(
  repoPath: string,
  profile: ProjectProfile,
  limit = 8,
): Promise<WorkSegmentStatusReport> {
  const file = await readWorkSegmentFile(repoPath);
  const segments = sortSegments(file.segments);
  const activeSegment = segments.find((segment) =>
    segment.id === file.activeSegmentId && segment.status === "active"
  );
  const summary = countSegments(segments);

  return {
    projectId: profile.id,
    projectName: profile.name,
    generatedAt: new Date().toISOString(),
    activeSegment,
    recentSegments: segments.slice(0, Math.max(1, limit)),
    summary,
    guidance: createWorkSegmentGuidance(activeSegment, summary),
  };
}

async function interruptActiveSegmentIfNeeded(
  repoPath: string,
  file: WorkSegmentFile,
  now: string,
): Promise<WorkSegment | undefined> {
  const active = file.segments.find((segment) => segment.id === file.activeSegmentId && segment.status === "active");
  if (!active) {
    return undefined;
  }

  const interrupted = await completeSegment(repoPath, active, "interrupted", {
    summary: "新的工作段已经开始，这条未记录的工作段被自动标记为中断。",
  }, now);
  file.activeSegmentId = undefined;
  return interrupted;
}

async function completeSegment(
  repoPath: string,
  segment: WorkSegment,
  status: Exclude<WorkSegmentStatus, "active">,
  input: WorkSegmentCompletionInput,
  now = new Date().toISOString(),
): Promise<WorkSegment> {
  const endSnapshot = await createGitChangeSnapshot(repoPath);
  const fileDelta = createFileDelta(segment.startSnapshot, endSnapshot);

  segment.status = status;
  segment.title = input.title?.trim() || segment.title;
  segment.summary = input.summary?.trim() || segment.summary;
  segment.reviewPath = input.reviewPath ?? segment.reviewPath;
  segment.memoryId = input.memoryId ?? segment.memoryId;
  segment.requirementId = input.requirement?.id ?? segment.requirementId;
  segment.requirementTitle = input.requirement?.title ?? segment.requirementTitle;
  segment.endSnapshot = endSnapshot;
  segment.currentChangedFiles = endSnapshot.changedFiles;
  segment.newChangedFiles = fileDelta.newChangedFiles;
  segment.carriedChangedFiles = fileDelta.carriedChangedFiles;
  segment.updatedAt = now;
  segment.endedAt = now;

  return segment;
}

function resolveSegmentForCompletion(
  file: WorkSegmentFile,
  segmentId?: string,
): WorkSegment | undefined {
  if (segmentId?.trim()) {
    return file.segments.find((segment) => segment.id === segmentId.trim());
  }

  return file.segments.find((segment) => segment.id === file.activeSegmentId && segment.status === "active");
}

function createFileDelta(
  startSnapshot: GitChangeSnapshot,
  endSnapshot: GitChangeSnapshot,
): {
  newChangedFiles: string[];
  carriedChangedFiles: string[];
} {
  const baseline = new Set(startSnapshot.changedFiles);
  const newChangedFiles = endSnapshot.changedFiles.filter((file) => !baseline.has(file));
  const carriedChangedFiles = endSnapshot.changedFiles.filter((file) => baseline.has(file));

  return {
    newChangedFiles,
    carriedChangedFiles,
  };
}

async function readWorkSegmentFile(repoPath: string): Promise<WorkSegmentFile> {
  const file = await readJsonFile<WorkSegmentFile>(workSegmentPath(repoPath));

  return {
    version: file?.version ?? 1,
    activeSegmentId: file?.activeSegmentId,
    segments: sortSegments(file?.segments ?? []),
  };
}

async function writeWorkSegmentFile(repoPath: string, file: WorkSegmentFile): Promise<void> {
  const segments = sortSegments(file.segments).slice(0, MAX_STORED_SEGMENTS);
  await writeJsonFile(workSegmentPath(repoPath), {
    version: 1,
    activeSegmentId: segments.some((segment) => segment.id === file.activeSegmentId && segment.status === "active")
      ? file.activeSegmentId
      : undefined,
    segments,
  });
}

function workSegmentPath(repoPath: string): string {
  return path.join(projectConfigDir(repoPath), "work-segments.json");
}

function sortSegments(segments: WorkSegment[]): WorkSegment[] {
  return [...segments].sort((left, right) =>
    right.updatedAt.localeCompare(left.updatedAt) || right.createdAt.localeCompare(left.createdAt),
  );
}

function createSegmentTitle(input: WorkSegmentInput): string {
  if (input.title?.trim()) {
    return input.title.trim();
  }

  if (input.requirement?.title) {
    return input.requirement.title;
  }

  return input.task.trim().slice(0, 80) || "未命名工作段";
}

function countSegments(segments: WorkSegment[]): WorkSegmentStatusReport["summary"] {
  return {
    total: segments.length,
    active: segments.filter((segment) => segment.status === "active").length,
    recorded: segments.filter((segment) => segment.status === "recorded").length,
    interrupted: segments.filter((segment) => segment.status === "interrupted").length,
    abandoned: segments.filter((segment) => segment.status === "abandoned").length,
  };
}

function createWorkSegmentGuidance(
  activeSegment: WorkSegment | undefined,
  summary: WorkSegmentStatusReport["summary"],
): string[] {
  if (activeSegment) {
    return [
      `当前工作段是「${activeSegment.title}」。修改完成后调用 specweft.record_current_diff，让 review 和记忆绑定到这条工作段。`,
      activeSegment.baselineChangedFiles.length > 0
        ? "这条工作段开始时工作区已有未提交改动；review 时优先关注 newChangedFiles，并检查 carriedChangedFiles 是否属于旧需求。"
        : "这条工作段从干净或已知边界开始，适合直接作为本次需求的修改范围。",
    ];
  }

  if (summary.interrupted > 0) {
    return [
      "当前没有活跃工作段，但存在被中断的工作段。继续旧需求前先读取 work segment 状态或需求档案。",
      "开始新需求前调用 specweft.start_work_segment，可以避免多个需求混在一个 diff 里时完全依赖猜测。",
    ];
  }

  return [
    "当前没有活跃工作段。开始修改前调用 specweft.start_work_segment，为本次需求留下边界。",
  ];
}

function createSegmentId(projectId: string, title: string, createdAt: string): string {
  return crypto
    .createHash("sha256")
    .update(`${projectId}:${title}:${createdAt}`)
    .digest("hex")
    .slice(0, 16);
}
