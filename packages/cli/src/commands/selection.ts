import {
  applyProjectMcp,
  applyProjectSkill,
  disableProjectMcp,
  disableProjectSkill,
  ignoreProjectMcp,
  ignoreProjectSkill,
  readProjectMcpSelection,
  readProjectSkillSelection,
  resolveRepoPath,
} from "@specweft/core";
import { printJson } from "../output.js";
import { recordCliActivity } from "./activity.js";

export async function runApply(
  repoArg: string,
  subcommand?: string,
  target?: string,
): Promise<void> {
  if (!subcommand || !target) {
    throw new Error("apply 用法：specweft apply mcp <id> | specweft apply skill <id>");
  }

  const repoPath = resolveRepoPath(repoArg);

  if (subcommand === "mcp") {
    const result = await applyProjectMcp(repoPath, target);
    await recordCliActivity(repoPath, {
      kind: "apply_mcp",
      title: "启用项目 MCP",
      summary: "CLI 已将全局 MCP 池中的服务启用到当前项目。",
      toolName: "specweft apply mcp",
      target,
      metadata: {
        status: result.status,
        appliedAt: result.appliedAt,
      },
    });
    printJson(result);
    return;
  }

  if (subcommand === "skill") {
    const result = await applyProjectSkill(repoPath, target);
    await recordCliActivity(repoPath, {
      kind: "apply_skill",
      title: "启用项目 Skill",
      summary: "CLI 已将全局 Skill 池中的能力启用到当前项目。",
      toolName: "specweft apply skill",
      target,
      metadata: {
        status: result.status,
        appliedAt: result.appliedAt,
      },
    });
    printJson(result);
    return;
  }

  throw new Error(`未知 apply 类型：${subcommand}。可用类型是 mcp 或 skill。`);
}

export async function runSelection(
  repoArg: string,
  subcommand?: string,
  target?: string,
): Promise<void> {
  const repoPath = resolveRepoPath(repoArg);

  if (subcommand === "list") {
    const [mcp, skills] = await Promise.all([
      readProjectMcpSelection(repoPath),
      readProjectSkillSelection(repoPath),
    ]);
    await recordCliActivity(repoPath, {
      kind: "recommend_tools",
      title: "查看项目能力选择",
      summary: "CLI 已读取当前项目启用、禁用或忽略的 MCP/Skill 选择。",
      toolName: "specweft selection list",
      metadata: {
        mcps: mcp.selected.length,
        skills: skills.selected.length,
      },
    });
    printJson({ mcp, skills });
    return;
  }

  const [action, type, id] = parseSelectionAction(subcommand, target);

  if (action === "disable" && type === "mcp") {
    const result = await disableProjectMcp(repoPath, id);
    await recordCliActivity(repoPath, {
      kind: "apply_mcp",
      status: "attention",
      title: "禁用项目 MCP",
      summary: "CLI 已将当前项目中的 MCP 标记为禁用。",
      toolName: "specweft selection disable:mcp",
      target: id,
    });
    printJson(result);
    return;
  }

  if (action === "disable" && type === "skill") {
    const result = await disableProjectSkill(repoPath, id);
    await recordCliActivity(repoPath, {
      kind: "apply_skill",
      status: "attention",
      title: "禁用项目 Skill",
      summary: "CLI 已将当前项目中的 Skill 标记为禁用。",
      toolName: "specweft selection disable:skill",
      target: id,
    });
    printJson(result);
    return;
  }

  if (action === "ignore" && type === "mcp") {
    const result = await ignoreProjectMcp(repoPath, id);
    await recordCliActivity(repoPath, {
      kind: "apply_mcp",
      status: "attention",
      title: "忽略项目 MCP",
      summary: "CLI 已将当前项目中的 MCP 标记为忽略，推荐时会降低优先级。",
      toolName: "specweft selection ignore:mcp",
      target: id,
    });
    printJson(result);
    return;
  }

  if (action === "ignore" && type === "skill") {
    const result = await ignoreProjectSkill(repoPath, id);
    await recordCliActivity(repoPath, {
      kind: "apply_skill",
      status: "attention",
      title: "忽略项目 Skill",
      summary: "CLI 已将当前项目中的 Skill 标记为忽略，推荐时会降低优先级。",
      toolName: "specweft selection ignore:skill",
      target: id,
    });
    printJson(result);
    return;
  }

  throw new Error("selection 用法：specweft selection list | specweft selection disable:mcp <id> | specweft selection ignore:skill <id>");
}

function parseSelectionAction(
  subcommand?: string,
  target?: string,
): ["disable" | "ignore", "mcp" | "skill", string] {
  if (!subcommand || !target) {
    throw new Error("selection 用法：specweft selection list | specweft selection disable:mcp <id> | specweft selection ignore:skill <id>");
  }

  const [action, type] = subcommand.split(":");
  if ((action !== "disable" && action !== "ignore") || (type !== "mcp" && type !== "skill")) {
    throw new Error("selection 动作必须是 disable:mcp、disable:skill、ignore:mcp 或 ignore:skill");
  }

  return [action, type, target];
}
