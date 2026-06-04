import path from "node:path";
import crypto from "node:crypto";
import type { MemoryHandoff, ProjectProfile, SessionMemory } from "../schemas/types.js";
import { projectConfigDir } from "../utils/path.js";
import { readJsonFile, writeJsonFile } from "../utils/json.js";

type MemoryFile = {
  sessions: SessionMemory[];
};

// 保存一个需求线程记忆。v0 写入项目内 JSON，后续会迁到 SQLite。
export async function saveSessionMemory(
  repoPath: string,
  input: Omit<SessionMemory, "id" | "createdAt" | "updatedAt" | "expiresAt">,
  ttlDays = 7,
): Promise<SessionMemory> {
  const now = new Date();
  // 默认 7 天过期，符合“短期需求上下文恢复”的产品定位。
  const expiresAt = new Date(now.getTime() + ttlDays * 24 * 60 * 60 * 1000);
  const file = await readMemoryFile(repoPath);
  const session: SessionMemory = {
    ...input,
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
): Promise<SessionMemory[]> {
  const file = pruneExpired(await readMemoryFile(repoPath));
  const normalized = keyword.trim().toLowerCase();

  if (!normalized) {
    return sortRecent(file.sessions);
  }

  return sortRecent(file.sessions
    .filter((session) => {
      // 把标题、摘要、关键词、改动文件拼成一个可搜索文本。
      const haystack = [
        session.title,
        session.summary,
        ...session.keywords,
        ...session.changedFiles,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(normalized);
    }));
}

// 生成“跨线程交接包”。Codex/Claude 新线程只要读取这个 prompt，就能快速接上最近需求上下文。
export async function createMemoryHandoff(
  repoPath: string,
  profile: ProjectProfile,
  keyword?: string,
  limit = 5,
): Promise<MemoryHandoff> {
  const sessions = keyword?.trim()
    ? await recallSessions(repoPath, keyword)
    : await readRecentSessions(repoPath);
  const selectedSessions = sessions.slice(0, Math.max(1, limit));
  const keywords = uniqueFlat(selectedSessions.map((session) => session.keywords));
  const changedFiles = uniqueFlat(selectedSessions.map((session) => session.changedFiles));
  const summary = createHandoffSummary(profile, selectedSessions, keyword);

  return {
    projectId: profile.id,
    projectName: profile.name,
    generatedAt: new Date().toISOString(),
    sessions: selectedSessions,
    keywords,
    changedFiles,
    summary,
    prompt: createHandoffPrompt(profile, selectedSessions, summary, keyword),
  };
}

async function readMemoryFile(repoPath: string): Promise<MemoryFile> {
  return (
    (await readJsonFile<MemoryFile>(memoryPath(repoPath))) ?? {
      sessions: [],
    }
  );
}

async function writeMemoryFile(repoPath: string, memoryFile: MemoryFile): Promise<void> {
  await writeJsonFile(memoryPath(repoPath), memoryFile);
}

function memoryPath(repoPath: string): string {
  return path.join(projectConfigDir(repoPath), "memory.json");
}

async function readRecentSessions(repoPath: string): Promise<SessionMemory[]> {
  return sortRecent(pruneExpired(await readMemoryFile(repoPath)).sessions);
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

function createHandoffSummary(
  profile: ProjectProfile,
  sessions: SessionMemory[],
  keyword?: string,
): string {
  if (sessions.length === 0) {
    return keyword?.trim()
      ? `No recent SpecWeft memory matched "${keyword}" in ${profile.name}.`
      : `No recent SpecWeft memory was found in ${profile.name}.`;
  }

  const titles = sessions.map((session) => session.title).slice(0, 3).join("; ");
  const files = uniqueFlat(sessions.map((session) => session.changedFiles)).slice(0, 6);
  const fileText = files.length ? ` Key files: ${files.join(", ")}.` : "";

  return `Recovered ${sessions.length} recent SpecWeft memory item(s) for ${profile.name}. Recent focus: ${titles}.${fileText}`;
}

function createHandoffPrompt(
  profile: ProjectProfile,
  sessions: SessionMemory[],
  summary: string,
  keyword?: string,
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
    const reviewPath = session.reviewPath ? `\nReview report: ${session.reviewPath}` : "";
    const nextThreadPrompt = session.nextThreadPrompt
      ? `\nPrevious continuation hint: ${session.nextThreadPrompt}`
      : "";

    return [
      `${index + 1}. ${session.title}`,
      `Summary: ${session.summary}`,
      `Keywords: ${keywords}`,
      `Changed files: ${files}`,
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
    "",
    "Recovered memories:",
    sessionBlocks.join("\n\n"),
    "",
    "Before editing: inspect the current git diff, explain how the recovered context affects the new task, then keep new changes scoped to the current requirement.",
  ].join("\n");
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
