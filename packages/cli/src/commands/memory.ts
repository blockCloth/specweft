import {
  createMemoryDigest,
  createMemoryIndex,
  createRequirementDossier,
  getActiveRequirement,
  listRequirements,
  resolveRepoPath,
  restoreRequirementMemory,
  scanProject,
  type RequirementDossier,
  type RequirementDossierItem,
  type RequirementDossierSession,
} from "@specweft/core";
import { printJson, printText } from "../output.js";

// 输出轻量记忆目录，供人和 Agent 判断“要恢复哪段历史”。
export async function runMemory(repoArg: string): Promise<void> {
  const repoPath = resolveRepoPath(repoArg);
  const profile = await scanProject(repoPath);
  printJson(await createMemoryIndex(repoPath, profile));
}

// 输出按需求聚合后的长期摘要入口，比 memory index 更适合新线程先读。
export async function runDigest(repoArg: string): Promise<void> {
  const repoPath = resolveRepoPath(repoArg);
  const profile = await scanProject(repoPath);
  printJson(await createMemoryDigest(repoPath, profile));
}

// 输出需求档案：比 digest 更适合人类 review，展示每条需求的多次修改记录。
export async function runDossier(repoArg: string, asJson = false, full = false): Promise<void> {
  const repoPath = resolveRepoPath(repoArg);
  const profile = await scanProject(repoPath);
  const dossier = await createRequirementDossier(repoPath, profile, {
    includeSessions: full,
    // JSON 通常会被 Codex/Claude 或脚本读取，默认只给需求入口和省略数量；
    // 人类文本输出保留少量预览，方便直接在终端 review。
    sessionPreviewLimit: full ? undefined : asJson ? 0 : 3,
  });

  if (asJson) {
    printJson(dossier);
    return;
  }

  printText(formatDossier(dossier));
}

// 按关键词或当前需求恢复完整上下文；不会默认恢复所有历史。
export async function runRestore(
  repoArg: string,
  keyword?: string,
  requirementId?: string,
): Promise<void> {
  const repoPath = resolveRepoPath(repoArg);
  const profile = await scanProject(repoPath);
  const requirement = requirementId?.trim()
    ? (await listRequirements(repoPath)).requirements.find((item) => item.id === requirementId.trim())
    : keyword?.trim()
      ? undefined
      : await getActiveRequirement(repoPath);

  if (requirementId?.trim() && !requirement) {
    throw new Error(`没有找到需求：${requirementId}`);
  }

  printJson(await restoreRequirementMemory(repoPath, profile, {
    keyword,
    requirement: requirementId ? requirement : requirement,
  }));
}

function formatDossier(dossier: RequirementDossier): string {
  if (dossier.items.length === 0) {
    return [
      "SpecWeft Requirement Dossier / 需求档案",
      "",
      dossier.summary,
      "",
      "还没有可展示的需求档案。先创建需求或生成一次 review。",
    ].join("\n");
  }

  return [
    "SpecWeft Requirement Dossier / 需求档案",
    "",
    dossier.summary,
    "",
    `项目：${dossier.projectName}`,
    `需求数：${dossier.totalRequirements}`,
    `记忆数：${dossier.totalSessions}`,
    `当前需求：${dossier.activeRequirementId ?? "-"}`,
    "",
    ...dossier.items.map(formatDossierItem),
  ].join("\n");
}

function formatDossierItem(item: RequirementDossierItem, index: number): string {
  const active = item.active ? "（当前）" : "";
  return [
    `${index + 1}. ${item.title}${active}`,
    `   状态：${item.status}`,
    `   记忆数：${item.sessionCount}，讲解次数：${item.reviewCount}`,
    `   摘要：${item.summary}`,
    `   关键文件：${item.keyFiles.slice(0, 6).join(", ") || "-"}`,
    `   关键词：${item.keywords.slice(0, 8).join(", ") || "-"}`,
    `   代码状态：current ${item.statusCounts.current} / stale ${item.statusCounts.stale} / reverted ${item.statusCounts.reverted} / unknown ${item.statusCounts.unknown}`,
    `   恢复方式：${item.restoreHint}`,
    `   下一步：${item.nextAction}`,
    "   最近修改：",
    formatDossierSessions(item.sessions),
    item.sessionsOmitted > 0 ? `   另有 ${item.sessionsOmitted} 条修改已省略；使用 --full 查看完整记录。` : "",
    "",
  ].filter(Boolean).join("\n");
}

function formatDossierSessions(sessions: RequirementDossierSession[]): string {
  if (sessions.length === 0) {
    return "   - 暂无修改记录";
  }

  return sessions.map((session) => [
    `   - ${session.title}`,
    `     摘要：${session.summary}`,
    `     文件：${session.changedFiles.slice(0, 5).join(", ") || "-"}`,
    `     状态：${session.codeStatus ?? "unknown"} - ${session.codeStatusReason ?? "-"}`,
    `     报告：${session.reviewPath ?? "-"}`,
  ].join("\n")).join("\n");
}
