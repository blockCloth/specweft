import {
  createMemoryHandoff,
  getActiveRequirement,
  resolveRepoPath,
  scanProject,
} from "@specweft/core";
import { printJson } from "../output.js";
import { recordCliActivity } from "./activity.js";

// 给新线程使用的上下文交接包。默认取最近记忆，也可以用关键词收窄到某个需求。
export async function runHandoff(repoArg: string, keyword?: string): Promise<void> {
  const repoPath = resolveRepoPath(repoArg);
  const profile = await scanProject(repoPath);
  const requirement = keyword?.trim() ? undefined : await getActiveRequirement(repoPath);
  const handoff = await createMemoryHandoff(repoPath, profile, keyword, 5, requirement);
  await recordCliActivity(repoPath, {
    kind: "memory_handoff",
    title: "生成线程交接上下文",
    summary: handoff.summary,
    toolName: "specweft handoff",
    requirementId: handoff.requirementId,
    requirementTitle: handoff.requirementTitle,
    target: keyword || handoff.requirementTitle,
    metadata: {
      sessions: handoff.sessions.length,
      keywords: handoff.keywords,
      changedFiles: handoff.changedFiles,
    },
  });

  printJson(handoff);
}
