import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type {
  MarketplaceMcpCandidate,
  MarketplaceMcpInstallResult,
  MarketplaceSkill,
  MarketplaceSkillInstallResult,
  MarketplaceSkillPreview,
  McpManifest,
  McpRegistryItem,
  PoolInitResult,
  RegistryFile,
  SkillDetail,
  SkillRegistryItem,
} from "../schemas/types.js";
import {
  createMarketplaceMcpId,
  createMcpManifestFromCandidate,
} from "../marketplace/mcp-marketplace.js";
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
  skillEntryPath,
  skillDir,
  skillRegistryPath,
} from "./pool-paths.js";

const DEFAULT_MARKETPLACE_TIMEOUT_MS = 8000;

// 初始化全局池。这个函数只写入 SpecWeft 自己的 home 目录，不改任何项目配置。
export async function initializeGlobalPools(): Promise<PoolInitResult> {
  await mkdir(mcpManifestDir(), { recursive: true });

  for (const manifest of BUILTIN_MCP_MANIFESTS) {
    await writeJsonFile(path.join(mcpManifestDir(), `${manifest.id}.json`), manifest);
  }

  await writeJsonFile(
    mcpRegistryPath(),
    mergeRegistry(await listMcpPool(), builtinMcpRegistry()),
  );

  for (const skill of BUILTIN_SKILLS) {
    await mkdir(skillDir(skill.item.id), { recursive: true });
    await writeFile(skill.item.skillPath, skill.content, "utf-8");
  }

  await writeJsonFile(
    skillRegistryPath(),
    mergeSkillRegistry(await listSkillPool(), builtinSkillRegistry()),
  );

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

// 读取 Skill 本体内容，用于 Web UI 展示详情，避免用户在看不到 SKILL.md 时盲目启用。
export async function readSkillDetail(skillId: string): Promise<SkillDetail | undefined> {
  const registry = await listSkillPool();
  const item = registry.items.find((entry) => entry.id === skillId);

  if (!item) {
    return undefined;
  }

  return {
    item,
    content: await readFile(item.skillPath, "utf-8"),
  };
}

// 读取单个 MCP manifest，后续 runtime assembly 会用它生成 Codex/Claude 配置。
export async function readMcpManifest(
  item: McpRegistryItem,
): Promise<McpManifest | undefined> {
  return readJsonFile<McpManifest>(item.manifestPath);
}

// 把市场候选 MCP 写入全局 MCP Pool。这里存的是 manifest，不直接修改用户的 Codex/Claude 配置。
export async function installMarketplaceMcp(
  candidate: MarketplaceMcpCandidate,
): Promise<MarketplaceMcpInstallResult> {
  const registry = await listMcpPool();
  const manifest = createMcpManifestFromCandidate(candidate);
  const manifestPath = path.join(mcpManifestDir(), `${manifest.id}.json`);
  const item: McpRegistryItem = {
    id: manifest.id,
    name: manifest.name,
    manifestPath,
    source: "marketplace",
  };
  const existingIndex = registry.items.findIndex((entry) => entry.id === item.id);

  await writeJsonFile(manifestPath, manifest);

  if (existingIndex >= 0) {
    registry.items[existingIndex] = item;
  } else {
    registry.items.push(item);
  }

  await writeJsonFile(mcpRegistryPath(), registry);

  return {
    item,
    manifest,
    manifestPath,
    installedAt: new Date().toISOString(),
  };
}

export { createMarketplaceMcpId };

// 把市场候选 Skill 安装到全局 Skill 池。项目是否启用由 selection-manager 单独负责。
export async function installMarketplaceSkill(
  skill: MarketplaceSkill,
  content?: string,
): Promise<MarketplaceSkillInstallResult> {
  const registry = await listSkillPool();
  const now = new Date().toISOString();
  const skillId = createMarketplaceSkillId(skill);
  const skillPath = skillEntryPath(skillId);
  const skillContent = content ?? await fetchMarketplaceSkillContent(skill);
  const item: SkillRegistryItem = {
    id: skillId,
    name: skill.name,
    description: skill.description,
    skillPath,
    source: "marketplace",
    tags: createMarketplaceSkillTags(skill),
    risk: "medium",
    marketplace: {
      author: skill.author,
      githubUrl: skill.githubUrl,
      path: skill.path,
      branch: skill.branch,
      updatedAt: skill.updatedAt,
      stars: skill.stars,
      forks: skill.forks,
    },
  };
  const existingIndex = registry.items.findIndex((entry) => entry.id === skillId);

  await mkdir(skillDir(skillId), { recursive: true });
  await writeFile(skillPath, skillContent, "utf-8");

  if (existingIndex >= 0) {
    registry.items[existingIndex] = item;
  } else {
    registry.items.push(item);
  }

  await writeJsonFile(skillRegistryPath(), registry);

  return {
    item,
    skillPath,
    installedAt: now,
    contentSource: createMarketplaceSkillRawUrl(skill),
  };
}

// 按用户动作预览市场 Skill 内容；只读取远程 SKILL.md，不写入全局池，也不启用到项目。
export async function previewMarketplaceSkill(
  skill: MarketplaceSkill,
): Promise<MarketplaceSkillPreview> {
  return {
    skill,
    content: await fetchMarketplaceSkillContent(skill),
    contentSource: createMarketplaceSkillRawUrl(skill),
  };
}

export function createMarketplaceSkillId(skill: MarketplaceSkill): string {
  return `marketplace-${slugify(skill.author)}-${slugify(skill.name)}`;
}

async function fetchMarketplaceSkillContent(skill: MarketplaceSkill): Promise<string> {
  const url = createMarketplaceSkillRawUrl(skill);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_MARKETPLACE_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        accept: "text/plain",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

function createMarketplaceSkillRawUrl(skill: MarketplaceSkill): string {
  const match = /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/tree\/([^/]+)\/(.+)$/.exec(skill.githubUrl);
  if (!match) {
    throw new Error(`Unsupported marketplace Skill URL: ${skill.githubUrl}`);
  }

  const [, owner, repo, branchFromUrl, dirPath] = match;
  // The marketplace can report a default branch that disagrees with the concrete GitHub tree URL.
  // The tree URL is the source of truth for this specific Skill path.
  const branch = branchFromUrl || skill.branch;
  return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${dirPath}/${skill.path}`;
}

function createMarketplaceSkillTags(skill: MarketplaceSkill): string[] {
  const tags = new Set(["marketplace", skill.author]);
  for (const token of `${skill.name} ${skill.description}`.toLowerCase().split(/[^a-z0-9+#.]+/)) {
    if (token.length >= 3 && tags.size < 8) {
      tags.add(token);
    }
  }

  return [...tags];
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function mergeRegistry<T extends { id: string }>(
  existing: RegistryFile<T>,
  incoming: RegistryFile<T>,
): RegistryFile<T> {
  const itemsById = new Map(existing.items.map((item) => [item.id, item]));

  // 内置项每次初始化都更新，市场/手动项保留，避免用户安装的 Skill 被 pool init 清掉。
  for (const item of incoming.items) {
    itemsById.set(item.id, item);
  }

  return {
    version: Math.max(existing.version, incoming.version),
    items: [...itemsById.values()],
  };
}

function mergeSkillRegistry(
  existing: RegistryFile<SkillRegistryItem>,
  incoming: RegistryFile<SkillRegistryItem>,
): RegistryFile<SkillRegistryItem> {
  const itemsById = new Map(existing.items.map((item) => [item.id, item]));

  // 内置 Skill 由 SpecWeft 管理，每次初始化都覆盖元数据和 SKILL.md。
  // 市场或用户安装的 Skill 保留，避免初始化清掉用户自己的能力池。
  for (const item of incoming.items) {
    itemsById.set(item.id, item);
  }

  return {
    version: Math.max(existing.version, incoming.version),
    items: [...itemsById.values()],
  };
}
