import { createRuntimeAssembly, resolveRepoPath } from "@specweft/core";
import { printJson } from "../output.js";

export async function runAssembly(repoArg: string): Promise<void> {
  const repoPath = resolveRepoPath(repoArg);
  const result = await createRuntimeAssembly(repoPath);
  printJson(result);
}
