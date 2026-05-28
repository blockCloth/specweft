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

export async function runApply(
    repoArg: string,
    subcommand?: string,
    target?: string,
): Promise<void> {
    if (!subcommand || !target) {
        throw new Error("apply usage: specweft apply mcp <id> | apply skill <id>");
    }

    const repoPath = resolveRepoPath(repoArg);

    if (subcommand === "mcp") {
        const result = await applyProjectMcp(repoPath, target);
        printJson(result);
        return;
    }

    if (subcommand === "skill") {
        const result = await applyProjectSkill(repoPath, target);
        printJson(result);
        return;
    }

    throw new Error(`Unknown apply target: ${subcommand}`);
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
        printJson({ mcp, skills });
        return;
    }

    const [action, type, id] = parseSelectionAction(subcommand, target);

    if (action === "disable" && type === "mcp") {
        printJson(await disableProjectMcp(repoPath, id));
        return;
    }

    if (action === "disable" && type === "skill") {
        printJson(await disableProjectSkill(repoPath, id));
        return;
    }

    if (action === "ignore" && type === "mcp") {
        printJson(await ignoreProjectMcp(repoPath, id));
        return;
    }

    if (action === "ignore" && type === "skill") {
        printJson(await ignoreProjectSkill(repoPath, id));
        return;
    }

    throw new Error("selection usage: specweft selection list | selection disable:mcp <id> | selection ignore:skill <id>");
}

function parseSelectionAction(
    subcommand?: string,
    target?: string,
): ["disable" | "ignore", "mcp" | "skill", string] {
    if (!subcommand || !target) {
        throw new Error("selection usage: specweft selection list | selection disable:mcp <id> | selection ignore:skill <id>");
    }

    const [action, type] = subcommand.split(":");
    if ((action !== "disable" && action !== "ignore") || (type !== "mcp" && type !== "skill")) {
        throw new Error("selection action must be disable:mcp, disable:skill, ignore:mcp, or ignore:skill");
    }

    return [action, type, target];
}
