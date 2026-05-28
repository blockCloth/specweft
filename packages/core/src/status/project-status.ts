import path from "path";
import { projectConfigDir, resolveRepoPath } from "../utils/path.js";
import type { ProjectStatus } from "../schemas/types.js";
import { recommendForProject } from "../recommendations/recommender.js";
import { scanProject } from "../scanner/project-scanner.js";


export async function currentProjectStatus(rootPath: string): Promise<ProjectStatus> {
    const profile = await scanProject(rootPath);
    const repoPath = resolveRepoPath(rootPath);
    const recommendations = await recommendForProject(profile, repoPath);
    const configDir = projectConfigDir(repoPath);
    const profilePath = path.join(configDir, "profile.json");
    const memoryPath = path.join(configDir, "memory.json");


    return {
        repoPath: resolveRepoPath(repoPath),
        profilePath: profilePath,
        memoryPath: memoryPath,
        projectName: profile.name,
        mcps: recommendations.filter((item) => item.type === "mcp")
            .map((item) => item.name),
        skills: recommendations.filter((item) => item.type === "skill")
            .map((item) => item.name)
    };
}
