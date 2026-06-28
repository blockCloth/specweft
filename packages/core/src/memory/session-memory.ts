import path from "node:path";
import crypto from "node:crypto";
import type {
  CompressionStrategy,
  MemoryHandoff,
  MemoryCompressionFile,
  MemoryCompressionRecord,
  MemoryDigest,
  MemoryDigestItem,
  MemoryIndex,
  MemoryIndexItem,
  ProjectSettings,
  ProjectProfile,
  RequirementRecord,
  RequirementRestore,
  SessionMemory,
} from "../schemas/types.js";
import { projectConfigDir } from "../utils/path.js";
import { evaluateCodeSnapshot } from "../git/change-snapshot.js";
import { readSecureJsonFile, writeSecureJsonFile } from "../security/secure-json.js";
import { filterIgnoredPaths, readProjectSettings } from "../settings/project-settings.js";
import { readJsonFile, writeJsonFile } from "../utils/json.js";

type MemoryFile = {
  sessions: SessionMemory[];
};

// 保存一个需求线程记忆。v0 写入项目内 JSON，后续会迁到 SQLite。
export async function saveSessionMemory(
  repoPath: string,
  input: Omit<SessionMemory, "id" | "createdAt" | "updatedAt" | "expiresAt">,
  ttlDays?: number,
): Promise<SessionMemory> {
  const settings = await readProjectSettings(repoPath);
  const file = await readMemoryFile(repoPath);
  const now = createNextMemoryTimestamp(file.sessions);
  const retentionDays = ttlDays ?? settings.changeRecording.retentionDays;
  const expiresAt = new Date(now.getTime() + retentionDays * 24 * 60 * 60 * 1000);
  const session: SessionMemory = {
    ...input,
    changedFiles: filterIgnoredPaths(input.changedFiles, settings),
    id: createId(`${input.projectId}:${input.title}:${now.toISOString()}`),
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };

  file.sessions.push(session);
  await writeMemoryFile(repoPath, pruneExpired(file));

  return session;
}

// 简单关键词检索：先覆盖“我记得叫登录需求”这种使用场景。
export async function recallSessions(
  repoPath: string,
  keyword: string,
  requirementId?: string,
): Promise<SessionMemory[]> {
  const settings = await readProjectSettings(repoPath);
  const file = await readActiveMemoryFile(repoPath);
  const normalized = keyword.trim().toLowerCase();
  const sessions = requirementId
    ? file.sessions.filter((session) => session.requirementId === requirementId)
    : file.sessions;
  const searchableSessions = sanitizeSessionsForSettings(sessions, settings);

  if (!normalized) {
    return hydrateCodeStatuses(repoPath, sortRecent(searchableSessions));
  }

  return hydrateCodeStatuses(repoPath, sortRecent(searchableSessions
    .filter((session) => {
      // 把标题、摘要、关键词、改动文件拼成一个可搜索文本。
      const haystack = [
        session.requirementTitle ?? "",
        session.title,
        session.summary,
        ...session.keywords,
        ...session.changedFiles,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(normalized);
    })));
}

export async function listSessionMemories(repoPath: string): Promise<SessionMemory[]> {
  const settings = await readProjectSettings(repoPath);
  const file = await readActiveMemoryFile(repoPath);
  return hydrateCodeStatuses(repoPath, sortRecent(sanitizeSessionsForSettings(file.sessions, settings)));
}

// 记忆索引是给 Agent 的“总入口”：只暴露摘要、关键词、相关文件和恢复提示，
// 避免把完整 review 或历史会话一次性塞进上下文。
export async function createMemoryIndex(
  repoPath: string,
  profile: ProjectProfile,
  limit = 20,
): Promise<MemoryIndex> {
  const settings = await readProjectSettings(repoPath);
  const allSessions = await listSessionMemories(repoPath);
  const sessions = allSessions.slice(0, Math.max(1, Math.min(limit, settings.contextMemory.maxRetainedTurns)));
  const items = sessions.map((session) => createMemoryIndexItem(session));

  return {
    projectId: profile.id,
    projectName: profile.name,
    generatedAt: new Date().toISOString(),
    totalMemories: allSessions.length,
    items,
    summary: createMemoryIndexSummary(profile, items),
  };
}

// 记忆摘要是更长期的“总入口”：按需求/主题聚合，只给摘要、关键词、关键文件和恢复方式。
// Agent 默认应先看 digest，再按 restoreHint 恢复某一个需求，避免把全部历史塞进上下文。
export async function createMemoryDigest(
  repoPath: string,
  profile: ProjectProfile,
  limit = 20,
): Promise<MemoryDigest> {
  const settings = await readProjectSettings(repoPath);
  const sessions = await listSessionMemories(repoPath);
  const grouped = groupSessionsForDigest(sessions);
  const compressionRecords: MemoryCompressionRecord[] = [];
  // 压缩记录会写同一个文件。顺序写入可以避免多个需求线同时首次压缩时互相覆盖。
  for (const [id, groupSessions] of grouped.entries()) {
    const record = await ensureCompressionRecord(repoPath, id, groupSessions, settings);
    if (record) {
      compressionRecords.push(record);
    }
  }
  const latestCompressionFile = await readCompressionFile(repoPath);
  const compressionByGroup = new Map(
    compressionRecords
      .filter((record): record is MemoryCompressionRecord => Boolean(record))
      .map((record) => [compressionRecordGroupId(record), record]),
  );
  const compressionCountByGroup = countCompressionRecordsByGroup(latestCompressionFile.records);
  const items = [...grouped.entries()]
    .map(([id, groupSessions]) => createMemoryDigestItem(
      id,
      groupSessions,
      settings,
      compressionByGroup.get(id),
      compressionCountByGroup.get(id) ?? 0,
    ))
    .sort((left, right) => right.latestUpdatedAt.localeCompare(left.latestUpdatedAt))
    .slice(0, Math.max(1, limit));

  return {
    projectId: profile.id,
    projectName: profile.name,
    generatedAt: new Date().toISOString(),
    settings: {
      maxRetainedTurns: settings.contextMemory.maxRetainedTurns,
      compressionStrategy: settings.contextMemory.compressionStrategy,
      ignorePaths: settings.contextMemory.ignorePaths,
    },
    totalMemories: sessions.length,
    totalThreads: grouped.size,
    totalCompressionCount: latestCompressionFile.records.length,
    items,
    summary: createMemoryDigestSummary(profile, sessions.length, grouped.size, items),
  };
}

export async function restoreRequirementMemory(
  repoPath: string,
  profile: ProjectProfile,
  input: {
    keyword?: string;
    requirement?: RequirementRecord;
    limit?: number;
  },
): Promise<RequirementRestore> {
  const settings = await readProjectSettings(repoPath);
  const limit = Math.max(1, Math.min(input.limit ?? 5, settings.contextMemory.maxRetainedTurns));
  const sessions = input.keyword?.trim()
    ? await recallSessions(repoPath, input.keyword, input.requirement?.id)
    : await readRecentSessions(repoPath, input.requirement?.id);
  const compression = await ensureCompressionRecord(
    repoPath,
    createRequirementGroupId(input.requirement, sessions),
    sessions,
    settings,
  );
  const selectedSessions = sessions.slice(0, limit);
  const handoff = await createMemoryHandoff(
    repoPath,
    profile,
    input.keyword,
    limit,
    input.requirement,
  );

  return {
    requirement: input.requirement,
    sessions: selectedSessions,
    handoff,
    compression,
    summary: createRestoreSummary(profile, selectedSessions, input.keyword, input.requirement),
  };
}

// 生成“跨线程交接包”。Codex/Claude 新线程只要读取这个 prompt，就能快速接上最近需求上下文。
export async function createMemoryHandoff(
  repoPath: string,
  profile: ProjectProfile,
  keyword?: string,
  limit = 5,
  requirement?: RequirementRecord,
): Promise<MemoryHandoff> {
  const settings = await readProjectSettings(repoPath);
  const cappedLimit = Math.max(1, Math.min(limit, settings.contextMemory.maxRetainedTurns));
  const sessions = keyword?.trim()
    ? await recallSessions(repoPath, keyword, requirement?.id)
    : await readRecentSessions(repoPath, requirement?.id);
  const compression = await ensureCompressionRecord(
    repoPath,
    createRequirementGroupId(requirement, sessions),
    sessions,
    settings,
  );
  const selectedSessions = sessions.slice(0, cappedLimit);
  const keywords = uniqueFlat(selectedSessions.map((session) => session.keywords));
  const changedFiles = uniqueFlat(selectedSessions.map((session) => session.changedFiles));
  const codeStatusSummary = createCodeStatusSummary(selectedSessions);
  const summary = createHandoffSummary(profile, selectedSessions, keyword, compression);

  return {
    projectId: profile.id,
    projectName: profile.name,
    requirementId: requirement?.id,
    requirementTitle: requirement?.title,
    generatedAt: new Date().toISOString(),
    sessions: selectedSessions,
    keywords,
    changedFiles,
    codeStatusSummary,
    summary,
    prompt: createHandoffPrompt(profile, selectedSessions, summary, keyword, compression),
  };
}

async function readMemoryFile(repoPath: string): Promise<MemoryFile> {
  return (
    (await readSecureJsonFile<MemoryFile>(memoryPath(repoPath))) ?? {
      sessions: [],
    }
  );
}

async function writeMemoryFile(repoPath: string, memoryFile: MemoryFile): Promise<void> {
  await writeSecureJsonFile(memoryPath(repoPath), memoryFile);
}

function memoryPath(repoPath: string): string {
  return path.join(projectConfigDir(repoPath), "memory.json");
}

function compressionPath(repoPath: string): string {
  return path.join(projectConfigDir(repoPath), "memory-compressions.json");
}

async function readCompressionFile(repoPath: string): Promise<MemoryCompressionFile> {
  return (
    (await readJsonFile<MemoryCompressionFile>(compressionPath(repoPath))) ?? {
      version: 1,
      records: [],
    }
  );
}

async function writeCompressionFile(repoPath: string, file: MemoryCompressionFile): Promise<void> {
  await writeJsonFile(compressionPath(repoPath), {
    version: 1,
    records: sortRecentCompressionRecords(file.records).slice(0, 500),
  });
}

function createNextMemoryTimestamp(sessions: SessionMemory[]): Date {
  const latest = sessions.reduce((max, session) => {
    const updatedAt = new Date(session.updatedAt).getTime();
    return Number.isFinite(updatedAt) ? Math.max(max, updatedAt) : max;
  }, 0);

  return new Date(Math.max(Date.now(), latest + 1));
}

async function readRecentSessions(repoPath: string, requirementId?: string): Promise<SessionMemory[]> {
  const settings = await readProjectSettings(repoPath);
  const sessions = (await readActiveMemoryFile(repoPath)).sessions;
  return hydrateCodeStatuses(repoPath, sortRecent(sanitizeSessionsForSettings(requirementId
    ? sessions.filter((session) => session.requirementId === requirementId)
    : sessions, settings)));
}

async function readActiveMemoryFile(repoPath: string): Promise<MemoryFile> {
  const file = await readMemoryFile(repoPath);
  const pruned = pruneExpired(file);
  if (pruned.sessions.length !== file.sessions.length) {
    await writeMemoryFile(repoPath, pruned);
  }

  return pruned;
}

function pruneExpired(memoryFile: MemoryFile): MemoryFile {
  const now = Date.now();
  // 每次读写时顺手清理过期 session，避免先引入后台定时任务。
  return {
    sessions: memoryFile.sessions.filter(
      (session) => new Date(session.expiresAt).getTime() > now,
    ),
  };
}

function sortRecent(sessions: SessionMemory[]): SessionMemory[] {
  return [...sessions].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

function sortRecentCompressionRecords(records: MemoryCompressionRecord[]): MemoryCompressionRecord[] {
  return [...records].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

function createHandoffSummary(
  profile: ProjectProfile,
  sessions: SessionMemory[],
  keyword?: string,
  compression?: MemoryCompressionRecord,
): string {
  if (sessions.length === 0) {
    return keyword?.trim()
      ? `No recent SpecWeft memory matched "${keyword}" in ${profile.name}.`
      : `No recent SpecWeft memory was found in ${profile.name}.`;
  }

  const titles = sessions.map((session) => session.title).slice(0, 3).join("; ");
  const files = uniqueFlat(sessions.map((session) => session.changedFiles)).slice(0, 6);
  const fileText = files.length ? ` Key files: ${files.join(", ")}.` : "";
  const compressionText = compression
    ? ` Older context was compressed with ${compression.strategy}: ${compression.summary}`
    : "";

  return `Recovered ${sessions.length} recent SpecWeft memory item(s) for ${profile.name}. Recent focus: ${titles}.${fileText}${compressionText}`;
}

function createMemoryIndexItem(session: SessionMemory): MemoryIndexItem {
  const restoreArgs = session.requirementId
    ? `requirementId=${session.requirementId}`
    : `keyword=${session.keywords[0] ?? session.title}`;

  return {
    id: session.id,
    requirementId: session.requirementId,
    requirementTitle: session.requirementTitle,
    title: session.title,
    keywords: session.keywords.slice(0, 8),
    summary: session.summary,
    changedFiles: session.changedFiles.slice(0, 8),
    codeStatus: session.codeStatus,
    codeStatusReason: session.codeStatusReason,
    reviewPath: session.reviewPath,
    updatedAt: session.updatedAt,
    expiresAt: session.expiresAt,
    restoreHint: `Call specweft.restore_requirement with ${restoreArgs} before continuing this work.`,
  };
}

function groupSessionsForDigest(sessions: SessionMemory[]): Map<string, SessionMemory[]> {
  const grouped = new Map<string, SessionMemory[]>();

  for (const session of sessions) {
    const key = session.requirementId
      ? `requirement:${session.requirementId}`
      : `keyword:${session.keywords[0] ?? session.title}`;
    grouped.set(key, [...(grouped.get(key) ?? []), session]);
  }

  return grouped;
}

function createMemoryDigestItem(
  id: string,
  sessions: SessionMemory[],
  settings: ProjectSettings,
  compression?: MemoryCompressionRecord,
  compressionCount = 0,
): MemoryDigestItem {
  const sortedSessions = sortRecent(sessions);
  const latest = sortedSessions[0] as SessionMemory;
  const retainedSessions = sortedSessions.slice(0, settings.contextMemory.maxRetainedTurns);
  const omittedSessionCount = Math.max(0, sortedSessions.length - retainedSessions.length);
  const keywords = uniqueFlat(sortedSessions.map((session) => session.keywords)).slice(0, 10);
  const keyFiles = rankFilesByFrequency(sortedSessions).slice(0, 10);
  const statusCounts = countCodeStatuses(sortedSessions);
  const title = latest.requirementTitle ?? latest.title;
  const restoreHint = latest.requirementId
    ? `Call specweft.restore_requirement with requirementId=${latest.requirementId}.`
    : `Call specweft.restore_requirement with keyword=${keywords[0] ?? title}.`;

  return {
    id,
    requirementId: latest.requirementId,
    requirementTitle: latest.requirementTitle,
    title,
    latestSummary: latest.summary,
    compressedSummary: compression?.summary,
    compressionCount,
    retainedSessionCount: retainedSessions.length,
    omittedSessionCount,
    keywords,
    keyFiles,
    sessionCount: sortedSessions.length,
    statusCounts,
    latestUpdatedAt: latest.updatedAt,
    restoreHint,
  };
}

async function ensureCompressionRecord(
  repoPath: string,
  groupId: string,
  sessions: SessionMemory[],
  settings: ProjectSettings,
): Promise<MemoryCompressionRecord | undefined> {
  if (settings.contextMemory.compressionStrategy === "none") {
    return undefined;
  }

  const sortedSessions = sortRecent(sessions);
  const retainedSessionCount = Math.min(sortedSessions.length, settings.contextMemory.maxRetainedTurns);
  const omitted = sortedSessions.slice(retainedSessionCount);
  if (omitted.length === 0) {
    return undefined;
  }

  const latest = sortedSessions[0];
  const recordId = createCompressionId(groupId, settings.contextMemory.compressionStrategy, retainedSessionCount, omitted);
  const file = await readCompressionFile(repoPath);
  const existing = file.records.find((record) => record.id === recordId);
  if (existing) {
    return existing;
  }

  const record: MemoryCompressionRecord = {
    id: recordId,
    requirementId: latest?.requirementId,
    requirementTitle: latest?.requirementTitle,
    strategy: settings.contextMemory.compressionStrategy,
    sourceSessionCount: sortedSessions.length,
    retainedSessionCount,
    omittedSessionCount: omitted.length,
    summary: createCompressionSummary(settings.contextMemory.compressionStrategy, omitted),
    keywords: uniqueFlat(omitted.map((session) => session.keywords)).slice(0, 12),
    keyFiles: rankFilesByFrequency(omitted).slice(0, 12),
    createdAt: new Date().toISOString(),
  };

  file.records.push(record);
  await writeCompressionFile(repoPath, file);
  return record;
}

function createCompressionSummary(strategy: CompressionStrategy, omittedSessions: SessionMemory[]): string {
  const titles = omittedSessions.slice(0, 4).map((session) => session.title).join("; ");
  const files = rankFilesByFrequency(omittedSessions).slice(0, 6);
  const fileText = files.length ? ` Key historical files: ${files.join(", ")}.` : "";

  if (strategy === "sliding-window") {
    return `Sliding-window removed ${omittedSessions.length} older memory item(s) from direct restore. Older focus: ${titles || "none"}.${fileText}`;
  }

  return `Summarized ${omittedSessions.length} older memory item(s). Historical focus: ${titles || "none"}.${fileText}`;
}

function countCompressionRecordsByGroup(records: MemoryCompressionRecord[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const record of records) {
    const groupId = compressionRecordGroupId(record);
    counts.set(groupId, (counts.get(groupId) ?? 0) + 1);
  }
  return counts;
}

function compressionRecordGroupId(record: MemoryCompressionRecord): string {
  if (record.requirementId) {
    return `requirement:${record.requirementId}`;
  }

  return record.id.split(":").slice(0, -1).join(":");
}

function createCompressionId(
  groupId: string,
  strategy: CompressionStrategy,
  retainedSessionCount: number,
  omittedSessions: SessionMemory[],
): string {
  const source = omittedSessions.map((session) => `${session.id}:${session.updatedAt}`).join("|");
  return `${groupId}:${crypto.createHash("sha256").update(`${strategy}:${retainedSessionCount}:${source}`).digest("hex").slice(0, 12)}`;
}

function createRequirementGroupId(
  requirement: RequirementRecord | undefined,
  sessions: SessionMemory[],
): string {
  const latest = sessions[0];
  if (requirement?.id || latest?.requirementId) {
    return `requirement:${requirement?.id ?? latest?.requirementId}`;
  }
  return `keyword:${latest?.keywords[0] ?? latest?.title ?? "unscoped"}`;
}

function sanitizeSessionsForSettings(sessions: SessionMemory[], settings: ProjectSettings): SessionMemory[] {
  return sessions.map((session) => ({
    ...session,
    changedFiles: filterIgnoredPaths(session.changedFiles, settings),
  }));
}

function rankFilesByFrequency(sessions: SessionMemory[]): string[] {
  const counts = new Map<string, number>();

  for (const file of sessions.flatMap((session) => session.changedFiles)) {
    counts.set(file, (counts.get(file) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((left, right) => {
      const countDelta = right[1] - left[1];
      return countDelta || left[0].localeCompare(right[0]);
    })
    .map(([file]) => file);
}

function countCodeStatuses(sessions: SessionMemory[]): MemoryDigestItem["statusCounts"] {
  const counts = {
    current: 0,
    stale: 0,
    reverted: 0,
    unknown: 0,
  };

  for (const session of sessions) {
    counts[session.codeStatus ?? "unknown"] += 1;
  }

  return counts;
}

function createMemoryDigestSummary(
  profile: ProjectProfile,
  totalMemories: number,
  totalThreads: number,
  items: MemoryDigestItem[],
): string {
  if (items.length === 0) {
    return `No SpecWeft memory digest entries were found for ${profile.name}.`;
  }

  const recentTitles = items.slice(0, 3).map((item) => item.title).join("; ");
  return [
    `${profile.name} has ${totalMemories} active memory item(s) grouped into ${totalThreads} thread(s).`,
    `Use this digest as the entry point, then restore only the relevant requirement.`,
    `Most recent threads: ${recentTitles}.`,
  ].join(" ");
}

function createMemoryIndexSummary(profile: ProjectProfile, items: MemoryIndexItem[]): string {
  if (items.length === 0) {
    return `No active SpecWeft memory index entries were found for ${profile.name}.`;
  }

  const requirementCount = new Set(
    items.map((item) => item.requirementId).filter(Boolean),
  ).size;
  const recentTitles = items.slice(0, 3).map((item) => item.title).join("; ");

  return [
    `${profile.name} has ${items.length} active memory index item(s).`,
    requirementCount ? `${requirementCount} requirement thread(s) are represented.` : "No requirement-scoped memory was found.",
    `Most recent: ${recentTitles}.`,
  ].join(" ");
}

function createRestoreSummary(
  profile: ProjectProfile,
  sessions: SessionMemory[],
  keyword?: string,
  requirement?: RequirementRecord,
): string {
  if (sessions.length === 0) {
    const target = requirement?.title ?? keyword ?? "the requested task";
    return `No matching SpecWeft memory was restored for ${target} in ${profile.name}.`;
  }

  const files = uniqueFlat(sessions.map((session) => session.changedFiles)).slice(0, 8);
  const target = requirement?.title ?? keyword ?? sessions[0]?.requirementTitle ?? "the requested task";
  const fileText = files.length ? ` Related files: ${files.join(", ")}.` : "";

  return `Restored ${sessions.length} memory item(s) for ${target} in ${profile.name}.${fileText}`;
}

async function hydrateCodeStatuses(
  repoPath: string,
  sessions: SessionMemory[],
): Promise<SessionMemory[]> {
  return Promise.all(
    sessions.map(async (session) => {
      const state = await evaluateCodeSnapshot(repoPath, session.codeSnapshot);
      return {
        ...session,
        codeStatus: state.status,
        codeStatusReason: state.reason,
      };
    }),
  );
}

function createCodeStatusSummary(sessions: SessionMemory[]): string[] {
  if (sessions.length === 0) {
    return [];
  }

  const counts = new Map<string, number>();
  for (const session of sessions) {
    const status = session.codeStatus ?? "unknown";
    counts.set(status, (counts.get(status) ?? 0) + 1);
  }

  return [...counts.entries()].map(([status, count]) => `${status}: ${count}`);
}

function createHandoffPrompt(
  profile: ProjectProfile,
  sessions: SessionMemory[],
  summary: string,
  keyword?: string,
  compression?: MemoryCompressionRecord,
): string {
  if (sessions.length === 0) {
    return [
      `Continue in project "${profile.name}".`,
      summary,
      "First scan the current repository profile and git diff before making changes.",
    ].join("\n");
  }

  const sessionBlocks = sessions.map((session, index) => {
    const files = session.changedFiles.length ? session.changedFiles.join(", ") : "none";
    const keywords = session.keywords.length ? session.keywords.join(", ") : "none";
    const requirement = session.requirementTitle ? `Requirement: ${session.requirementTitle}\n` : "";
    const codeStatus = session.codeStatus
      ? `\nCode status: ${session.codeStatus} - ${session.codeStatusReason ?? ""}`
      : "";
    const reviewPath = session.reviewPath ? `\nReview report: ${session.reviewPath}` : "";
    const nextThreadPrompt = session.nextThreadPrompt
      ? `\nPrevious continuation hint: ${session.nextThreadPrompt}`
      : "";

    return [
      `${index + 1}. ${session.title}`,
      requirement,
      `Summary: ${session.summary}`,
      `Keywords: ${keywords}`,
      `Changed files: ${files}`,
      codeStatus,
      `Created at: ${session.createdAt}`,
      `Expires at: ${session.expiresAt}`,
      reviewPath,
      nextThreadPrompt,
    ].filter(Boolean).join("\n");
  });

  return [
    `Continue from this SpecWeft handoff for project "${profile.name}".`,
    keyword?.trim() ? `Search keyword: ${keyword.trim()}.` : "Use the most recent valid memories.",
    summary,
    compression ? `Compressed older context: ${compression.summary}` : undefined,
    compression?.keywords.length ? `Compressed keywords: ${compression.keywords.join(", ")}` : undefined,
    compression?.keyFiles.length ? `Compressed key files: ${compression.keyFiles.join(", ")}` : undefined,
    "",
    "Recovered memories:",
    sessionBlocks.join("\n\n"),
    "",
    "Before editing: inspect the current git diff, explain how the recovered context affects the new task, then keep new changes scoped to the current requirement.",
  ].filter((line) => line !== undefined).join("\n");
}

function uniqueFlat(values: string[][]): string[] {
  return [
    ...new Set(
      values
        .flat()
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ].slice(0, 30);
}

function createId(value: string): string {
  // hash ID 便于稳定、短小，也避免把原始标题直接塞进 ID。
  return crypto.createHash("sha256").update(value).digest("hex").slice(0, 16);
}
