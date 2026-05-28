import type { ProjectProfile, ToolRecommendation } from "../schemas/types.js";
import { listMcpPool, listSkillPool, readMcpManifest } from "../pool/pool-manager.js";
import {
  readProjectMcpSelection,
  readProjectSkillSelection,
} from "../selection/selection-manager.js";

// v1 仍然使用可解释规则，但推荐项来自全局 Pool，不再写死成孤立数据。
export async function recommendForProject(
  profile: ProjectProfile,
  repoPath = profile.rootPath,
): Promise<ToolRecommendation[]> {
  const [mcpPool, skillPool, mcpSelection, skillSelection] = await Promise.all([
    listMcpPool(),
    listSkillPool(),
    readProjectMcpSelection(repoPath),
    readProjectSkillSelection(repoPath),
  ]);
  const mcpStatus = new Map(mcpSelection.selected.map((item) => [item.id, item.status]));
  const skillStatus = new Map(skillSelection.selected.map((item) => [item.id, item.status]));
  const recommendations: ToolRecommendation[] = [];

  for (const skill of skillPool.items) {
    const reason = createSkillReason(skill.id);
    if (!reason) {
      continue;
    }

    recommendations.push({
      id: skill.id,
      type: "skill",
      name: skill.name,
      reason,
      risk: skill.risk,
      status: skillStatus.get(skill.id) ?? "recommended",
    });
  }

  for (const item of mcpPool.items) {
    const manifest = await readMcpManifest(item);
    if (!manifest) {
      continue;
    }

    const reason = createMcpReason(manifest.id, profile);
    if (!reason) {
      continue;
    }

    recommendations.push({
      id: manifest.id,
      type: "mcp",
      name: manifest.name,
      reason,
      risk: manifest.risk,
      status: mcpStatus.get(manifest.id) ?? "recommended",
    });
  }

  return recommendations;
}

function createSkillReason(id: string): string | undefined {
  if (id === "diff-explainer") {
    return "Explain AI-generated code changes after each coding session.";
  }
  if (id === "test-planner") {
    return "Suggest targeted tests from changed files and project commands.";
  }
  return undefined;
}

function createMcpReason(id: string, profile: ProjectProfile): string | undefined {
  if (id === "filesystem" && profile.languages.length > 0) {
    return "Read project files and support context recall within the current repository.";
  }
  if (id === "git") {
    return "Inspect diffs, changed files, branches, and recent development history.";
  }
  return undefined;
}
