import type { RecordingStatus, SessionMemory } from "../schemas/types.js";
import { createGitChangeSnapshot } from "../git/change-snapshot.js";
import { listSessionMemories } from "../memory/session-memory.js";

export async function getRecordingStatus(repoPath: string): Promise<RecordingStatus> {
  const [currentSnapshot, sessions] = await Promise.all([
    createGitChangeSnapshot(repoPath),
    listSessionMemories(repoPath),
  ]);

  if (!currentSnapshot.hasChanges) {
    return {
      hasChanges: false,
      isRecorded: true,
      status: "clean",
      reason: "当前工作区没有未提交代码改动。",
      currentSnapshot,
      latestMemory: sessions[0],
    };
  }

  const latestMatchingMemory = sessions.find(
    (session) => session.codeSnapshot?.diffHash === currentSnapshot.diffHash
      && session.codeSnapshot?.head === currentSnapshot.head,
  );

  if (latestMatchingMemory) {
    return {
      hasChanges: true,
      isRecorded: true,
      status: "recorded",
      reason: "当前 diff 已经有匹配的 SpecWeft review/memory 记录。",
      currentSnapshot,
      latestMatchingMemory,
      latestMemory: sessions[0],
    };
  }

  const latestOverlappingMemory = findLatestOverlappingMemory(sessions, currentSnapshot.changedFiles);

  return {
    hasChanges: true,
    isRecorded: false,
    status: latestOverlappingMemory ? "changed-after-record" : "unrecorded",
    reason: latestOverlappingMemory
      ? "当前 diff 和最近记录有重叠，但代码已经继续变化，需要重新记录。"
      : "当前 diff 还没有匹配的 SpecWeft review/memory 记录。",
    currentSnapshot,
    latestMemory: latestOverlappingMemory ?? sessions[0],
  };
}

function findLatestOverlappingMemory(
  sessions: SessionMemory[],
  changedFiles: string[],
): SessionMemory | undefined {
  const changedFileSet = new Set(changedFiles);
  return sessions.find((session) =>
    session.changedFiles.some((filePath) => changedFileSet.has(filePath)),
  );
}
