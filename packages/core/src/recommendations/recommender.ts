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
    const reason = createSkillReason(skill.id, profile);
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

    const reason = createMcpReason(manifest, profile);
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

function createSkillReason(id: string, profile: ProjectProfile): string | undefined {
  const projectText = createProjectText(profile);
  const hasTests = profile.testCommands.length > 0;
  const hasRules = profile.ruleFiles.length > 0;

  if (id === "diff-explainer") {
    return [
      `Fits ${projectText} because SpecWeft's main workflow is explaining AI-generated diffs after each coding session.`,
      hasRules
        ? `It should reference local rule file(s) first: ${profile.ruleFiles.join(", ")}.`
        : "No local rule file was detected, so the explanation should stay descriptive instead of inventing project conventions.",
    ].join(" ");
  }
  if (id === "test-planner") {
    return [
      hasTests
        ? `Use existing test command(s) as the verification base: ${profile.testCommands.join("; ")}.`
        : "No test command was detected yet, so it should suggest the smallest practical verification path from changed files.",
      `This helps review AI changes in ${projectText} without running unrelated broad checks first.`,
    ].join(" ");
  }
  return undefined;
}

function createMcpReason(
  manifest: NonNullable<Awaited<ReturnType<typeof readMcpManifest>>>,
  profile: ProjectProfile,
): string | undefined {
  const id = manifest.id;
  const projectText = createProjectText(profile);

  if (id === "filesystem") {
    return [
      `Useful for ${projectText}: lets the agent read project files that explain local structure before recommending Skills or writing review notes.`,
      "Keep it scoped to the current repository path when assembling runtime config.",
    ].join(" ");
  }
  if (id === "git") {
    return [
      "Core to SpecWeft's review loop: it can inspect diffs, changed files, branches, and recent history before producing the code-change explanation.",
      profile.buildCommands.length
        ? `Pair it with build command awareness: ${profile.buildCommands.join("; ")}.`
        : "No build command was detected, so diff review becomes the first lightweight safety signal.",
    ].join(" ");
  }
  if (id.startsWith("marketplace-")) {
    const riskText = [
      manifest.permissions.length ? `permissions: ${manifest.permissions.join(", ")}` : "no explicit permissions",
      manifest.env?.length ? `env: ${manifest.env.join(", ")}` : "no required env vars",
    ].join("; ");

    return [
      `Marketplace MCP already exists in the SpecWeft pool and may support ${projectText}.`,
      `Review before enabling because it declares ${riskText}.`,
    ].join(" ");
  }
  return undefined;
}

function createProjectText(profile: ProjectProfile): string {
  const languages = profile.languages.length ? profile.languages.join("/") : "unknown-language";
  const frameworks = profile.frameworks.length ? ` with ${profile.frameworks.join("/")}` : "";
  return `${profile.name} (${languages}${frameworks})`;
}
