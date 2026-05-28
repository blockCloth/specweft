import { currentProjectStatus, resolveRepoPath } from "@specweft/core";
import { printJson } from "../output.js"


export async function runStatus(repoArg: string): Promise<void> {
    const repoPath = resolveRepoPath(repoArg);
    const status = await currentProjectStatus(repoPath);
    printJson(status);
}
