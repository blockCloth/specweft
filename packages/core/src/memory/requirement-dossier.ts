import type {
  CodeSnapshotStatus,
  MemoryDigest,
  ProjectProfile,
  RequirementDossier,
  RequirementDossierItem,
  RequirementDossierSession,
  RequirementRecord,
  SessionMemory,
} from "../schemas/types.js";
import { listRequirements } from "../requirements/requirement-manager.js";
import { createMemoryDigest, listSessionMemories } from "./session-memory.js";

const CODE_STATUSES: CodeSnapshotStatus[] = ["current", "stale", "reverted", "unknown"];

export type RequirementDossierOptions = {
  includeSessions?: boolean;
  sessionPreviewLimit?: number;
};

// 需求档案把多次 review/memory 聚合成一份可读上下文。
// UI 和 Agent 都应该优先看 dossier，再决定要 restore 哪一条需求线。
export async function createRequirementDossier(
  repoPath: string,
  profile: ProjectProfile,
  options: RequirementDossierOptions = {},
): Promise<RequirementDossier> {
  const [requirementFile, sessions, digest] = await Promise.all([
    listRequirements(repoPath),
    listSessionMemories(repoPath),
    createMemoryDigest(repoPath, profile),
  ]);
  const sessionsByRequirement = groupSessionsByRequirement(sessions);
  const items = requirementFile.requirements.map((requirement) =>
    createRequirementDossierItem(
      requirement,
      sessionsByRequirement.get(requirement.id) ?? [],
      digest,
      requirementFile.activeRequirementId === requirement.id,
      options,
    ),
  );
  const unscopedSessions = sessionsByRequirement.get("") ?? [];
  if (unscopedSessions.length > 0) {
    items.push(createUnscopedDossierItem(unscopedSessions, options));
  }

  const sortedItems = items.sort((left, right) => {
    if (left.active && !right.active) {
      return -1;
    }
    if (right.active && !left.active) {
      return 1;
    }

    return (right.latestUpdatedAt ?? "").localeCompare(left.latestUpdatedAt ?? "");
  });

  return {
    projectId: profile.id,
    projectName: profile.name,
    generatedAt: new Date().toISOString(),
    activeRequirementId: requirementFile.activeRequirementId,
    totalRequirements: requirementFile.requirements.length,
    totalSessions: sessions.length,
    items: sortedItems,
    summary: createDossierSummary(profile, requirementFile.requirements, sessions, sortedItems),
  };
}

function groupSessionsByRequirement(sessions: SessionMemory[]): Map<string, SessionMemory[]> {
  const grouped = new Map<string, SessionMemory[]>();

  for (const session of sessions) {
    const key = session.requirementId ?? "";
    grouped.set(key, [...(grouped.get(key) ?? []), session]);
  }

  return grouped;
}

function createRequirementDossierItem(
  requirement: RequirementRecord,
  sessions: SessionMemory[],
  digest: MemoryDigest,
  active: boolean,
  options: RequirementDossierOptions,
): RequirementDossierItem {
  const sortedSessions = sortRecent(sessions);
  const digestItem = digest.items.find((item) => item.requirementId === requirement.id);
  const title = requirement.title;
  const summary = createRequirementSummary(requirement, sortedSessions, digestItem?.latestSummary);
  const latestUpdatedAt = sortedSessions[0]?.updatedAt ?? requirement.updatedAt;
  const previewSessions = selectDossierSessions(sortedSessions, options);

  return {
    id: `requirement:${requirement.id}`,
    requirementId: requirement.id,
    title,
    status: requirement.status,
    active,
    summary,
    latestSummary: sortedSessions[0]?.summary ?? requirement.summary,
    reviewCount: requirement.reviewCount,
    sessionCount: sortedSessions.length,
    sessionsOmitted: Math.max(0, sortedSessions.length - previewSessions.length),
    keywords: mergeKeywords(requirement.keywords, sortedSessions),
    keyFiles: rankFilesByFrequency(sortedSessions).slice(0, 10),
    statusCounts: countSessions(sortedSessions),
    latestUpdatedAt,
    restoreHint: `specweft.restore_requirement({ requirementId: "${requirement.id}" })`,
    nextAction: createNextAction(requirement, sortedSessions),
    sessions: previewSessions.map(createDossierSession),
  };
}

function createUnscopedDossierItem(
  sessions: SessionMemory[],
  options: RequirementDossierOptions,
): RequirementDossierItem {
  const sortedSessions = sortRecent(sessions);
  const latest = sortedSessions[0];
  const title = "未归档修改";
  const previewSessions = selectDossierSessions(sortedSessions, options);

  return {
    id: "unscoped",
    title,
    status: "unscoped",
    active: false,
    summary: "这些记忆还没有绑定到明确需求。建议 review 时补充 requirementId，后续就能按需求线恢复。",
    latestSummary: latest?.summary,
    reviewCount: sortedSessions.length,
    sessionCount: sortedSessions.length,
    sessionsOmitted: Math.max(0, sortedSessions.length - previewSessions.length),
    keywords: mergeKeywords([], sortedSessions),
    keyFiles: rankFilesByFrequency(sortedSessions).slice(0, 10),
    statusCounts: countSessions(sortedSessions),
    latestUpdatedAt: latest?.updatedAt,
    restoreHint: `specweft.restore_requirement({ keyword: "${sortedSessions[0]?.keywords[0] ?? title}" })`,
    nextAction: "如果这些修改属于某个需求，下一次 review 时指定 requirementId，把记忆归到同一条需求线。",
    sessions: previewSessions.map(createDossierSession),
  };
}

function selectDossierSessions(
  sessions: SessionMemory[],
  options: RequirementDossierOptions,
): SessionMemory[] {
  if (options.includeSessions) {
    return sessions;
  }

  return sessions.slice(0, Math.max(0, options.sessionPreviewLimit ?? 0));
}

function createRequirementSummary(
  requirement: RequirementRecord,
  sessions: SessionMemory[],
  latestSummary?: string,
): string {
  if (sessions.length === 0) {
    return requirement.summary
      ? `${requirement.summary} 当前还没有保存过 review 记忆。`
      : "这个需求已经创建，但还没有保存过 review 记忆。";
  }

  const latest = latestSummary ?? sessions[0]?.summary ?? "";
  const files = rankFilesByFrequency(sessions).slice(0, 4);
  const fileText = files.length ? ` 主要文件：${files.join(", ")}。` : "";
  return `这条需求已经记录 ${sessions.length} 次修改。最近一次：${latest}${fileText}`;
}

function createNextAction(requirement: RequirementRecord, sessions: SessionMemory[]): string {
  if (sessions.length === 0) {
    return "开始修改前先运行 prepare，修改后用 review/record 把第一条记忆挂到这个需求。";
  }
  if (sessions.some((session) => session.codeStatus === "stale")) {
    return "存在已过期代码状态，继续前先恢复需求记忆并检查当前 diff。";
  }
  if (sessions.some((session) => session.codeStatus === "reverted")) {
    return "存在已回滚修改，继续前确认是否要基于旧思路重做，还是只参考历史说明。";
  }
  if (requirement.status === "done") {
    return "需求已标记完成；如需二次修改，先恢复这条需求记忆再开启新的 review。";
  }

  return "继续该需求时先 restore 这条档案，再只带入相关文件和最近 review。";
}

function createDossierSession(session: SessionMemory): RequirementDossierSession {
  return {
    id: session.id,
    title: session.title,
    summary: session.summary,
    keywords: session.keywords,
    changedFiles: session.changedFiles,
    reviewPath: session.reviewPath,
    codeStatus: session.codeStatus,
    codeStatusReason: session.codeStatusReason,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    expiresAt: session.expiresAt,
  };
}

function mergeKeywords(requirementKeywords: string[], sessions: SessionMemory[]): string[] {
  return [
    ...new Set([
      ...requirementKeywords,
      ...sessions.flatMap((session) => session.keywords),
    ].map((keyword) => keyword.trim()).filter(Boolean)),
  ].slice(0, 12);
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

function countSessions(sessions: SessionMemory[]): Record<CodeSnapshotStatus, number> {
  const counts = {
    current: 0,
    stale: 0,
    reverted: 0,
    unknown: 0,
  };

  for (const session of sessions) {
    const status = session.codeStatus ?? "unknown";
    if (CODE_STATUSES.includes(status)) {
      counts[status] += 1;
    }
  }

  return counts;
}

function sortRecent(sessions: SessionMemory[]): SessionMemory[] {
  return [...sessions].sort((left, right) => {
    const updatedDelta = right.updatedAt.localeCompare(left.updatedAt);
    if (updatedDelta !== 0) {
      return updatedDelta;
    }

    return right.createdAt.localeCompare(left.createdAt) || right.id.localeCompare(left.id);
  });
}

function createDossierSummary(
  profile: ProjectProfile,
  requirements: RequirementRecord[],
  sessions: SessionMemory[],
  items: RequirementDossierItem[],
): string {
  if (items.length === 0) {
    return `${profile.name} 还没有需求档案。先创建需求或生成一次 review，SpecWeft 会自动沉淀记忆。`;
  }

  const active = items.find((item) => item.active);
  const recentTitles = items.slice(0, 3).map((item) => item.title).join("；");
  const activeText = active ? `当前需求是「${active.title}」。` : "当前没有选中的需求。";
  return `${profile.name} 有 ${requirements.length} 条需求、${sessions.length} 条有效记忆。${activeText} 最近档案：${recentTitles}。`;
}
