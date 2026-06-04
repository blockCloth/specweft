import os from "node:os";
import path from "node:path";

export function specweftHome(): string {
  return process.env.SPECWEFT_HOME || path.join(os.homedir(), ".specweft");
}

export function mcpPoolDir(): string {
  return path.join(specweftHome(), "mcp");
}

export function mcpManifestDir(): string {
  return path.join(mcpPoolDir(), "manifests");
}

export function mcpRegistryPath(): string {
  return path.join(mcpPoolDir(), "registry.json");
}

export function skillPoolDir(): string {
  return path.join(specweftHome(), "skills");
}

export function skillRegistryPath(): string {
  return path.join(skillPoolDir(), "registry.json");
}

export function skillDir(skillId: string): string {
  return path.join(skillPoolDir(), skillId);
}

export function skillEntryPath(skillId: string): string {
  return path.join(skillDir(skillId), "SKILL.md");
}
