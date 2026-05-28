import { mkdir, readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import type { ProjectProfile } from "../schemas/types.js";
import { projectConfigDir, toPosixPath } from "../utils/path.js";
import { readJsonFile, writeJsonFile } from "../utils/json.js";

const IGNORED_DIRS = new Set([
  ".git",
  ".idea",
  ".vscode",
  ".specweft",
  "node_modules",
  "dist",
  "build",
  "target",
  ".venv",
  "__pycache__",
]);

const RULE_FILES = ["AGENTS.md", "CLAUDE.md", ".cursorrules", ".windsurfrules"];

// init 命令使用这个函数：扫描项目后，把结果持久化到项目内的 .specweft 目录。
export async function initializeProject(repoPath: string): Promise<ProjectProfile> {
  const profile = await scanProject(repoPath);
  const configDir = projectConfigDir(repoPath);

  await mkdir(configDir, { recursive: true });
  await writeJsonFile(path.join(configDir, "profile.json"), profile);
  await ensureJsonFile(path.join(configDir, "mcp.json"), { version: 1, selected: [] });
  await ensureJsonFile(path.join(configDir, "skills.json"), { version: 1, selected: [] });
  await ensureJsonFile(path.join(configDir, "memory.json"), { sessions: [] });

  return profile;
}

// 只做“项目画像”，不读取业务代码细节；后续推荐 MCP/Skills 会依赖这个画像。
export async function scanProject(repoPath: string): Promise<ProjectProfile> {
  const files = await listFiles(repoPath);
  const packageJson = await readPackageJson(repoPath);
  const now = new Date().toISOString();

  return {
    id: createProjectId(repoPath),
    name: packageJson?.name ?? path.basename(repoPath),
    rootPath: repoPath,
    languages: detectLanguages(files),
    frameworks: detectFrameworks(files, packageJson),
    packageManager: detectPackageManager(files),
    testCommands: detectTestCommands(packageJson),
    buildCommands: detectBuildCommands(packageJson),
    ruleFiles: files.filter((file) => RULE_FILES.includes(path.basename(file))),
    createdAt: now,
    updatedAt: now,
  };
}

async function listFiles(repoPath: string): Promise<string[]> {
  const result: string[] = [];

  // 递归遍历目录。这里跳过 node_modules/dist 等目录，避免扫描成本失控。
  async function walk(currentDir: string): Promise<void> {
    const entries = await readdir(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory() && IGNORED_DIRS.has(entry.name)) {
        continue;
      }

      const absolutePath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        await walk(absolutePath);
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      const fileStat = await stat(absolutePath);
      // v0 不处理大文件，避免把锁文件、二进制或生成物读进项目画像。
      if (fileStat.size > 2_000_000) {
        continue;
      }

      result.push(toPosixPath(path.relative(repoPath, absolutePath)));
    }
  }

  await walk(repoPath);
  return result;
}

// 只声明当前需要读取的 package.json 字段，避免把 npm 元数据类型化得过早。
type PackageJson = {
  name?: string;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

async function readPackageJson(repoPath: string): Promise<PackageJson | undefined> {
  try {
    const content = await readFile(path.join(repoPath, "package.json"), "utf-8");
    return JSON.parse(content) as PackageJson;
  } catch {
    return undefined;
  }
}

// 当前先通过扩展名粗略识别语言；后续可以接 tree-sitter 或更精细的扫描。
function detectLanguages(files: string[]): string[] {
  const languages = new Set<string>();

  if (files.some((file) => file.endsWith(".ts") || file.endsWith(".tsx"))) {
    languages.add("typescript");
  }
  if (files.some((file) => file.endsWith(".js") || file.endsWith(".jsx"))) {
    languages.add("javascript");
  }
  if (files.some((file) => file.endsWith(".py"))) {
    languages.add("python");
  }
  if (files.some((file) => file.endsWith(".java"))) {
    languages.add("java");
  }

  return [...languages];
}

function detectFrameworks(files: string[], packageJson?: PackageJson): string[] {
  const frameworks = new Set<string>();
  // dependencies 和 devDependencies 都可能包含框架依赖。
  const deps = {
    ...packageJson?.dependencies,
    ...packageJson?.devDependencies,
  };

  if (deps.react) {
    frameworks.add("react");
  }
  if (deps.vite) {
    frameworks.add("vite");
  }
  if (deps.next) {
    frameworks.add("next");
  }
  if (deps.fastify) {
    frameworks.add("fastify");
  }
  if (deps.express) {
    frameworks.add("express");
  }
  if (files.includes("pyproject.toml")) {
    frameworks.add("python-project");
  }

  return [...frameworks];
}

function detectPackageManager(files: string[]): string | undefined {
  if (files.includes("pnpm-lock.yaml")) {
    return "pnpm";
  }
  if (files.includes("yarn.lock")) {
    return "yarn";
  }
  if (files.includes("package-lock.json")) {
    return "npm";
  }
  if (files.includes("bun.lockb")) {
    return "bun";
  }
  return undefined;
}

function detectTestCommands(packageJson?: PackageJson): string[] {
  if (!packageJson?.scripts) {
    return [];
  }

  return Object.entries(packageJson.scripts)
    .filter(([name]) => name.includes("test"))
    .map(([name]) => `npm run ${name}`);
}

function detectBuildCommands(packageJson?: PackageJson): string[] {
  if (!packageJson?.scripts?.build) {
    return [];
  }

  return ["npm run build"];
}

function createProjectId(repoPath: string): string {
  // 用路径生成稳定 ID；同一个本地项目每次 init 都会得到同一个 projectId。
  return crypto.createHash("sha256").update(repoPath).digest("hex").slice(0, 16);
}

async function ensureJsonFile(filePath: string, value: unknown): Promise<void> {
  const existing = await readJsonFile<unknown>(filePath);
  if (existing !== undefined) {
    return;
  }

  await writeJsonFile(filePath, value);
}
