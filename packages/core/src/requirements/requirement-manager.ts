import crypto from "node:crypto";
import path from "node:path";
import type {
  RequirementFile,
  RequirementInput,
  RequirementRecord,
  RequirementReviewLink,
} from "../schemas/types.js";
import { readJsonFile, writeJsonFile } from "../utils/json.js";
import { projectConfigDir } from "../utils/path.js";

export async function listRequirements(repoPath: string): Promise<RequirementFile> {
  return readRequirementFile(repoPath);
}

export async function getActiveRequirement(repoPath: string): Promise<RequirementRecord | undefined> {
  const file = await readRequirementFile(repoPath);
  return file.requirements.find((requirement) => requirement.id === file.activeRequirementId);
}

export async function createRequirement(
  repoPath: string,
  input: RequirementInput,
): Promise<RequirementRecord> {
  const file = await readRequirementFile(repoPath);
  const now = new Date().toISOString();
  const title = input.title.trim();

  if (!title) {
    throw new Error("Requirement title is required.");
  }

  const requirement: RequirementRecord = {
    id: createRequirementId(input.projectId, title, now),
    projectId: input.projectId,
    title,
    keywords: normalizeKeywords(input.keywords ?? [title]),
    summary: input.summary?.trim() || undefined,
    status: "active",
    reviewCount: 0,
    createdAt: now,
    updatedAt: now,
  };

  file.requirements.unshift(requirement);
  file.activeRequirementId = requirement.id;
  await writeRequirementFile(repoPath, file);

  return requirement;
}

export async function setActiveRequirement(
  repoPath: string,
  requirementId: string,
): Promise<RequirementRecord> {
  const file = await readRequirementFile(repoPath);
  const requirement = file.requirements.find((item) => item.id === requirementId);

  if (!requirement) {
    throw new Error(`Requirement not found: ${requirementId}`);
  }

  file.activeRequirementId = requirement.id;
  requirement.status = requirement.status === "done" ? "active" : requirement.status;
  requirement.updatedAt = new Date().toISOString();
  await writeRequirementFile(repoPath, file);

  return requirement;
}

export async function resolveRequirementForReview(
  repoPath: string,
  input: RequirementInput,
  explicitRequirementId?: string,
): Promise<RequirementRecord> {
  if (explicitRequirementId?.trim()) {
    return setActiveRequirement(repoPath, explicitRequirementId.trim());
  }

  const active = await getActiveRequirement(repoPath);
  if (active) {
    return active;
  }

  return createRequirement(repoPath, input);
}

export async function attachReviewToRequirement(
  repoPath: string,
  requirementId: string,
  link: RequirementReviewLink,
): Promise<RequirementRecord> {
  const file = await readRequirementFile(repoPath);
  const requirement = file.requirements.find((item) => item.id === requirementId);

  if (!requirement) {
    throw new Error(`Requirement not found: ${requirementId}`);
  }

  requirement.reviewCount += 1;
  requirement.lastReviewPath = link.reviewPath;
  requirement.lastMemoryId = link.memoryId;
  requirement.summary = link.summary;
  requirement.keywords = normalizeKeywords([...requirement.keywords, ...link.keywords]);
  requirement.updatedAt = new Date().toISOString();
  file.activeRequirementId = requirement.id;
  await writeRequirementFile(repoPath, file);

  return requirement;
}

function requirementPath(repoPath: string): string {
  return path.join(projectConfigDir(repoPath), "requirements.json");
}

async function readRequirementFile(repoPath: string): Promise<RequirementFile> {
  const file = await readJsonFile<RequirementFile>(requirementPath(repoPath));

  return {
    version: file?.version ?? 1,
    activeRequirementId: file?.activeRequirementId,
    requirements: [...(file?.requirements ?? [])].sort((left, right) =>
      right.updatedAt.localeCompare(left.updatedAt),
    ),
  };
}

async function writeRequirementFile(repoPath: string, file: RequirementFile): Promise<void> {
  await writeJsonFile(requirementPath(repoPath), {
    version: 1,
    activeRequirementId: file.activeRequirementId,
    requirements: [...file.requirements].sort((left, right) =>
      right.updatedAt.localeCompare(left.updatedAt),
    ),
  });
}

function normalizeKeywords(keywords: string[]): string[] {
  return [
    ...new Set(
      keywords
        .map((keyword) => keyword.trim())
        .filter(Boolean),
    ),
  ].slice(0, 20);
}

function createRequirementId(projectId: string, title: string, createdAt: string): string {
  return crypto
    .createHash("sha256")
    .update(`${projectId}:${title}:${createdAt}`)
    .digest("hex")
    .slice(0, 16);
}
