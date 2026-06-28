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
      `适合 ${projectText}：SpecWeft 的主流程是在每次 AI 改完代码后生成可读讲解和 review 清单。`,
      hasRules
        ? `使用时先参考本地规则文件：${profile.ruleFiles.join(", ")}。`
        : "未检测到本地规则文件，讲解应保持描述性，不要编造项目规范。",
    ].join(" ");
  }
  if (id === "test-planner") {
    return [
      hasTests
        ? `以现有测试命令作为验证基础：${profile.testCommands.join("; ")}。`
        : "暂未检测到测试命令，应根据改动文件给出最小可行验证路径。",
      `这样可以先验证 ${projectText} 的相关改动，避免一上来跑过宽的检查。`,
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
      `适合 ${projectText}：允许 Agent 在推荐 Skill 或生成讲解前读取项目文件，理解本地结构。`,
      "装配运行时配置时应限制在当前仓库路径内。",
    ].join(" ");
  }
  if (id === "git") {
    return [
      "这是 SpecWeft review 闭环的核心能力：生成代码讲解前可以检查 diff、改动文件、分支和近期历史。",
      profile.buildCommands.length
        ? `建议结合构建命令理解验证边界：${profile.buildCommands.join("; ")}。`
        : "未检测到构建命令，因此 diff review 会成为第一层轻量安全信号。",
    ].join(" ");
  }
  if (id.startsWith("marketplace-")) {
    const riskText = [
      manifest.permissions.length ? `permissions: ${manifest.permissions.join(", ")}` : "no explicit permissions",
      manifest.env?.length ? `env: ${manifest.env.join(", ")}` : "no required env vars",
    ].join("; ");

    return [
      `这个市场 MCP 已在 SpecWeft 池中，可能支持 ${projectText}。`,
      `启用前需要人工确认，因为它声明了 ${riskText}。`,
    ].join(" ");
  }
  return undefined;
}

function createProjectText(profile: ProjectProfile): string {
  const languages = profile.languages.length ? profile.languages.join("/") : "unknown-language";
  const frameworks = profile.frameworks.length ? `，框架：${profile.frameworks.join("/")}` : "";
  return `${profile.name} (${languages}${frameworks})`;
}
