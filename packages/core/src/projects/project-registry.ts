import type {
  ProjectProfile,
  ProjectRegistryFile,
  RegisteredProject,
} from "../schemas/types.js";
import { projectRegistryPath } from "../pool/pool-paths.js";
import { readJsonFile, writeJsonFile } from "../utils/json.js";
import { scanProject } from "../scanner/project-scanner.js";

export async function listRegisteredProjects(): Promise<ProjectRegistryFile> {
  return normalizeRegistry(await readJsonFile<ProjectRegistryFile>(projectRegistryPath()));
}

export async function registerProject(repoPath: string): Promise<ProjectRegistryFile> {
  const registry = await listRegisteredProjects();
  const profile = await scanProject(repoPath);
  const project = createRegisteredProject(profile);
  const existingIndex = registry.projects.findIndex((item) => item.rootPath === repoPath);

  if (existingIndex >= 0) {
    registry.projects[existingIndex] = project;
  } else {
    registry.projects.unshift(project);
  }

  registry.activeProjectPath = repoPath;
  registry.projects = sortProjects(registry.projects);
  await writeJsonFile(projectRegistryPath(), registry);

  return registry;
}

export async function setActiveProject(repoPath: string): Promise<ProjectRegistryFile> {
  const registry = await registerProject(repoPath);
  registry.activeProjectPath = repoPath;
  await writeJsonFile(projectRegistryPath(), registry);
  return registry;
}

function createRegisteredProject(profile: ProjectProfile): RegisteredProject {
  return {
    id: profile.id,
    name: profile.name,
    rootPath: profile.rootPath,
    languages: profile.languages,
    frameworks: profile.frameworks,
    lastOpenedAt: new Date().toISOString(),
  };
}

function normalizeRegistry(registry?: ProjectRegistryFile): ProjectRegistryFile {
  return {
    version: 1,
    activeProjectPath: registry?.activeProjectPath,
    projects: registry?.projects ?? [],
  };
}

function sortProjects(projects: RegisteredProject[]): RegisteredProject[] {
  return [...projects].sort((left, right) => {
    return right.lastOpenedAt.localeCompare(left.lastOpenedAt);
  });
}
