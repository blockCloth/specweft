import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type {
  McpManifest,
  McpRegistryItem,
  PoolInitResult,
  RegistryFile,
  SkillRegistryItem,
} from "../schemas/types.js";
import { readJsonFile, writeJsonFile } from "../utils/json.js";
import {
  BUILTIN_MCP_MANIFESTS,
  BUILTIN_SKILLS,
  builtinMcpRegistry,
  builtinSkillRegistry,
} from "./builtin.js";
import {
  mcpManifestDir,
  mcpRegistryPath,
  skillDir,
  skillRegistryPath,
} from "./pool-paths.js";

// 初始化全局池。这个函数只写入 SpecWeft 自己的 home 目录，不改任何项目配置。
export async function initializeGlobalPools(): Promise<PoolInitResult> {
  await mkdir(mcpManifestDir(), { recursive: true });

  for (const manifest of BUILTIN_MCP_MANIFESTS) {
    await writeJsonFile(path.join(mcpManifestDir(), `${manifest.id}.json`), manifest);
  }

  await writeJsonFile(mcpRegistryPath(), builtinMcpRegistry());

  for (const skill of BUILTIN_SKILLS) {
    await mkdir(skillDir(skill.item.id), { recursive: true });
    await writeFile(skill.item.skillPath, skill.content, "utf-8");
  }

  await writeJsonFile(skillRegistryPath(), builtinSkillRegistry());

  return {
    mcpRegistryPath: mcpRegistryPath(),
    skillRegistryPath: skillRegistryPath(),
    mcpCount: BUILTIN_MCP_MANIFESTS.length,
    skillCount: BUILTIN_SKILLS.length,
  };
}

// 列出 MCP Pool 索引。这里不启动 MCP，只展示池子里“有哪些可用 MCP”。
export async function listMcpPool(): Promise<RegistryFile<McpRegistryItem>> {
  return (
    (await readJsonFile<RegistryFile<McpRegistryItem>>(mcpRegistryPath())) ?? {
      version: 1,
      items: [],
    }
  );
}

// 列出 Skill Pool 索引。Skill 本体在 ~/.specweft/skills/<id>/SKILL.md。
export async function listSkillPool(): Promise<RegistryFile<SkillRegistryItem>> {
  return (
    (await readJsonFile<RegistryFile<SkillRegistryItem>>(skillRegistryPath())) ?? {
      version: 1,
      items: [],
    }
  );
}

// 读取单个 MCP manifest，后续 runtime assembly 会用它生成 Codex/Claude 配置。
export async function readMcpManifest(
  item: McpRegistryItem,
): Promise<McpManifest | undefined> {
  return readJsonFile<McpManifest>(item.manifestPath);
}
