import type {
  CodeSnapshotStatus,
  MemoryTimeline,
  ProjectProfile,
  RequirementRecord,
  RequirementTimelineItem,
  SessionMemory,
} from "../schemas/types.js";
import { listRequirements } from "../requirements/requirement-manager.js";
import { listSessionMemories } from "./session-memory.js";

const CODE_STATUSES: CodeSnapshotStatus[] = ["current", "stale", "reverted", "unknown"];

export async function createMemoryTimeline(
  repoPath: string,
  profile: ProjectProfile,
): Promise<MemoryTimeline> {
  const [requirementFile, sessions] = await Promise.all([
    listRequirements(repoPath),
    listSessionMemories(repoPath),
  ]);
  const sessionsByRequirement = groupByRequirement(sessions);
  const items = requirementFile.requirements.map((requirement) =>
    createTimelineItem(requirement, sessionsByRequirement.get(requirement.id) ?? []),
  );
  const unscopedSessions = sessionsByRequirement.get("") ?? [];
  const allSessions = [
    ...items.flatMap((item) => item.sessions),
    ...unscopedSessions,
  ];
  const summary = countSessions(allSessions);

  return {
    projectId: profile.id,
    generatedAt: new Date().toISOString(),
    activeRequirementId: requirementFile.activeRequirementId,
    items,
    unscopedSessions,
    summary: {
      requirements: items.length,
      sessions: allSessions.length,
      ...summary,
    },
  };
}

function groupByRequirement(sessions: SessionMemory[]): Map<string, SessionMemory[]> {
  const grouped = new Map<string, SessionMemory[]>();

  for (const session of sessions) {
    const key = session.requirementId ?? "";
    grouped.set(key, [...(grouped.get(key) ?? []), session]);
  }

  return grouped;
}

function createTimelineItem(
  requirement: RequirementRecord,
  sessions: SessionMemory[],
): RequirementTimelineItem {
  return {
    requirement,
    sessions,
    statusCounts: countSessions(sessions),
    latestSession: sessions[0],
  };
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
