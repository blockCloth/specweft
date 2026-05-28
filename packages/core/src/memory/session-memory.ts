import path from "node:path";
import crypto from "node:crypto";
import type { SessionMemory } from "../schemas/types.js";
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
  const normalized = keyword.toLowerCase();

  return file.sessions
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
    })
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
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

function pruneExpired(memoryFile: MemoryFile): MemoryFile {
  const now = Date.now();
  // 每次读写时顺手清理过期 session，避免先引入后台定时任务。
  return {
    sessions: memoryFile.sessions.filter(
      (session) => new Date(session.expiresAt).getTime() > now,
    ),
  };
}

function createId(value: string): string {
  // hash ID 便于稳定、短小，也避免把原始标题直接塞进 ID。
  return crypto.createHash("sha256").update(value).digest("hex").slice(0, 16);
}
