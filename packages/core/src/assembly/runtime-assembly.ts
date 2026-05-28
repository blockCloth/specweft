import {
    listMcpPool,
    listSkillPool,
    readMcpManifest,
} from "../pool/pool-manager.js";
import type {
    ProjectSelectionFile,
    ProjectSelectionItem,
    RuntimeAssembly,
} from "../schemas/types.js";
import {
    mcpProjectSelectionPath,
    skillProjectSelectionPath,
} from "../selection/selection-path.js";
import { readJsonFile } from "../utils/json.js";

export async function createRuntimeAssembly(repoPath: string): Promise<RuntimeAssembly> {
    // 读取当前项目已经启用的 MCP 和 Skills。
    const selectedMcpServers = await readProjectSelectionFile(
        mcpProjectSelectionPath(repoPath),
    );
    const selectedSkills = await readProjectSelectionFile(
        skillProjectSelectionPath(repoPath),
    );

    const selectedMcpIds = new Set(
        selectedMcpServers.selected
            .filter((item) => item.status === "enabled")
            .map((item) => item.id),
    );
    const selectedSkillIds = new Set(
        selectedSkills.selected
            .filter((item) => item.status === "enabled")
            .map((item) => item.id),
    );

    // 从全局池读取所有可用 MCP / Skills，再按项目选择过滤。
    const allMcpServers = await listMcpPool();
    const allSkills = await listSkillPool();
    const mcpServers: RuntimeAssembly["mcpServers"] = {};

    for (const item of allMcpServers.items) {
        if (!selectedMcpIds.has(item.id)) {
            continue;
        }

        const manifest = await readMcpManifest(item);
        if (!manifest || manifest.runtime !== "stdio" || !manifest.launch) {
            continue;
        }

        mcpServers[item.id] = {
            command: replaceProjectRoot(manifest.launch.command, repoPath),
            args: manifest.launch.args.map((arg) => replaceProjectRoot(arg, repoPath)),
        };
    }

    const skills = allSkills.items
        .filter((item) => selectedSkillIds.has(item.id))
        .map((item) => ({
            id: item.id,
            path: item.skillPath,
        }));

    return {
        mcpServers,
        skills,
    };
}

async function readProjectSelectionFile(filePath: string): Promise<ProjectSelectionFile> {
    return (
        (await readJsonFile<ProjectSelectionFile>(filePath)) ?? {
            version: 1,
            selected: [] as ProjectSelectionItem[],
        }
    );
}

function replaceProjectRoot(value: string, repoPath: string): string {
    return value.replaceAll("{{projectRoot}}", repoPath);
}
