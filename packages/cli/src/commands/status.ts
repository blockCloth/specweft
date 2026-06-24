import { currentProjectStatus, resolveRepoPath, type ProjectStatus } from "@specweft/core";
import { printText } from "../output.js";


export async function runStatus(repoArg: string): Promise<void> {
    const repoPath = resolveRepoPath(repoArg);
    const status = await currentProjectStatus(repoPath);
    printText(formatStatus(status));
}

function formatStatus(status: ProjectStatus): string {
    return [
        "SpecWeft 项目状态",
        "",
        `项目：${status.projectName}`,
        `路径：${status.repoPath}`,
        `画像文件：${status.profilePath}`,
        `记忆文件：${status.memoryPath}`,
        "",
        "需求记忆保护：",
        `- ${status.memoryProtection.summary}`,
        `- 密钥变量：${status.memoryProtection.keyEnv}`,
        `- 密钥状态：${status.memoryProtection.keyConfigured ? "已检测到" : "未检测到"}`,
        ...status.memoryProtection.files.map((file) =>
            `- ${file.label}: ${file.exists ? file.path : "未创建"}，${file.encrypted ? "已加密" : file.exists ? "明文" : "缺失"}`
        ),
        ...status.memoryProtection.warnings.map((warning) => `- 提醒：${warning}`),
        "",
        "Skills：",
        status.skills.length ? status.skills.map((skill) => `- ${skill}`).join("\n") : "- 暂无推荐或启用 Skill",
        "",
        "MCP：",
        status.mcps.length ? status.mcps.map((mcp) => `- ${mcp}`).join("\n") : "- 暂无推荐或启用 MCP",
    ].join("\n");
}
