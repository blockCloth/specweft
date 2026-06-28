import {
    listMcpPool,
    listSkillPool,
    readMcpManifest,
} from "../pool/pool-manager.js";
import type {
    RuntimeAssembly,
} from "../schemas/types.js";
import { readProjectMcpSelection, readProjectSkillSelection } from "../selection/selection-manager.js";
import { readProjectSettings } from "../settings/project-settings.js";
import { createSkillContextIndex } from "../skills/skill-context.js";

export async function createRuntimeAssembly(repoPath: string): Promise<RuntimeAssembly> {
    // 读取当前项目已经启用的 MCP 和 Skills。
    const [selectedMcpServers, selectedSkills] = await Promise.all([
        readProjectMcpSelection(repoPath),
        readProjectSkillSelection(repoPath),
    ]);

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
    const [allSkills, settings, skillContext] = await Promise.all([
        listSkillPool(),
        readProjectSettings(repoPath),
        createSkillContextIndex(repoPath, { scope: "enabled" }),
    ]);
    const mcpServers: RuntimeAssembly["mcpServers"] = {};

    for (const item of allMcpServers.items) {
        if (!selectedMcpIds.has(item.id)) {
            continue;
        }

        const manifest = await readMcpManifest(item);
        if (!manifest) {
            continue;
        }

        if (manifest.runtime === "stdio" && manifest.launch) {
            mcpServers[item.id] = {
                transport: "stdio",
                command: replaceProjectRoot(manifest.launch.command, repoPath),
                args: manifest.launch.args.map((arg) => replaceProjectRoot(arg, repoPath)),
                env: createEnvMap(manifest.env),
                timeoutMs: settings.capabilities.mcpStdioTimeoutMs,
            };
            continue;
        }

        if (manifest.runtime === "remote" && manifest.url) {
            mcpServers[item.id] = {
                transport: "remote",
                url: replaceProjectRoot(manifest.url, repoPath),
                env: createEnvMap(manifest.env),
                headers: manifest.headers,
            };
        }
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
        skillContext,
    };
}

function replaceProjectRoot(value: string, repoPath: string): string {
    return value.replaceAll("{{projectRoot}}", repoPath);
}

function createEnvMap(envVars: string[] | undefined): Record<string, string> | undefined {
    if (!envVars?.length) {
        return undefined;
    }

    return Object.fromEntries(envVars.map((envVar) => [envVar, process.env[envVar] ?? ""]));
}
