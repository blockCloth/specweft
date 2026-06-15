import { createCapabilityCenter, resolveRepoPath, scanProject } from "@specweft/core";
import { printJson } from "../output.js";

export async function runCapabilities(repoArg: string): Promise<void> {
  const repoPath = resolveRepoPath(repoArg);
  const profile = await scanProject(repoPath);
  const capabilityCenter = await createCapabilityCenter(profile, repoPath);
  printJson(capabilityCenter);
}
