import { createCapabilityCenter, resolveRepoPath, scanProject } from "@specweft/core";
import { printJson } from "../output.js";
import { recordCliActivity } from "./activity.js";

export async function runCapabilities(repoArg: string): Promise<void> {
  const repoPath = resolveRepoPath(repoArg);
  const profile = await scanProject(repoPath);
  const capabilityCenter = await createCapabilityCenter(profile, repoPath);
  await recordCliActivity(repoPath, {
    kind: "recommend_tools",
    title: "查看能力中心",
    summary: `CLI 已读取当前项目可用能力：${capabilityCenter.summary.total} 个能力，${capabilityCenter.summary.recommended} 个推荐。`,
    toolName: "specweft capabilities",
    metadata: {
      total: capabilityCenter.summary.total,
      recommended: capabilityCenter.summary.recommended,
      enabled: capabilityCenter.summary.enabled,
      highRisk: capabilityCenter.summary.highRisk,
    },
  });
  printJson(capabilityCenter);
}
