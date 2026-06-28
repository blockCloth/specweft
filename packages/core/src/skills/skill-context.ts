import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import type {
  CapabilityStatus,
  ProjectSelectionFile,
  ProjectSelectionItem,
  SkillContextIndex,
  SkillContextIndexItem,
  SkillContextLoadPolicy,
  SkillContextScope,
  SkillDetailAccess,
  SkillRegistryItem,
} from "../schemas/types.js";
import { listSkillPool } from "../pool/pool-manager.js";
import { readProjectSkillSelection } from "../selection/selection-manager.js";

const DEFAULT_MAX_CONTEXT_ITEMS = 24;
const MAX_AUTO_LOADED_SKILLS = 2;

type SkillContextIndexOptions = {
  scope?: SkillContextScope;
  skillIds?: string[];
  maxItems?: number;
};

export async function createSkillContextIndex(
  repoPath: string,
  options: SkillContextIndexOptions = {},
): Promise<SkillContextIndex> {
  const [skillPool, selection] = await Promise.all([
    listSkillPool(),
    readProjectSkillSelection(repoPath),
  ]);
  const scope = options.scope ?? "enabled";
  const selectedIds = new Set(options.skillIds ?? []);
  const selectionById = createSelectionStatusMap(selection);
  const enabledSkillIds = sortedSelectionIds(selection, "enabled");
  const disabledSkillIds = sortedSelectionIds(selection, "disabled");
  const ignoredSkillIds = sortedSelectionIds(selection, "ignored");
  const selectionRevision = createSkillSelectionRevision(selection);
  const items = skillPool.items
    .map((skill) => createSkillContextItem(skill, selectionById.get(skill.id)))
    .filter((item) => includeSkillContextItem(item, scope, selectedIds))
    .sort(sortSkillContextItems)
    .slice(0, options.maxItems ?? DEFAULT_MAX_CONTEXT_ITEMS);
  const allowedSkillIds = items
    .filter((item) => item.loadPolicy === "read-on-demand")
    .slice(0, MAX_AUTO_LOADED_SKILLS)
    .map((item) => item.id);
  const metadataOnlySkillIds = items
    .filter((item) => item.loadPolicy === "metadata-only")
    .map((item) => item.id);
  const blockedSkillIds = items
    .filter((item) => item.loadPolicy === "blocked")
    .map((item) => item.id);

  return {
    repoPath,
    generatedAt: new Date().toISOString(),
    scope,
    selectionRevision,
    enabledSkillIds,
    disabledSkillIds,
    ignoredSkillIds,
    allowedSkillIds,
    metadataOnlySkillIds,
    blockedSkillIds,
    items,
    policy: {
      loadMode: "lazy",
      requiresSelectionRevision: true,
      maxAutoLoadedSkills: MAX_AUTO_LOADED_SKILLS,
      invalidatesWhen: [
        "A new specweft.prepare_task result is generated.",
        "A Skill is enabled, disabled, ignored, installed, or removed.",
        "The current task no longer lists the Skill in allowedSkillIds.",
      ],
      staleInstruction: "Do not rely on previously loaded Skill content unless it is still listed in the latest skillContext.allowedSkillIds and the selectionRevision matches.",
    },
    summary: createSkillContextSummary(scope, allowedSkillIds, selectionRevision),
  };
}

export async function createTaskSkillContextIndex(
  repoPath: string,
  skillIds: string[],
): Promise<SkillContextIndex> {
  return createSkillContextIndex(repoPath, {
    scope: "task",
    skillIds,
    maxItems: Math.max(skillIds.length, DEFAULT_MAX_CONTEXT_ITEMS),
  });
}

export async function readSkillDetailForContext(
  repoPath: string,
  skillId: string,
  expectedSelectionRevision?: string,
): Promise<SkillDetailAccess> {
  const [skillPool, selection] = await Promise.all([
    listSkillPool(),
    readProjectSkillSelection(repoPath),
  ]);
  const currentSelectionRevision = createSkillSelectionRevision(selection);
  const item = skillPool.items.find((entry) => entry.id === skillId);

  if (!item) {
    return {
      skillId,
      status: "missing",
      currentSelectionRevision,
      expectedSelectionRevision,
      reason: `Skill not found in the global pool: ${skillId}`,
      guidance: [
        "Use specweft.get_skill_context_index or specweft.recommend_skills_for_task before reading Skill details.",
      ],
    };
  }

  if (expectedSelectionRevision && expectedSelectionRevision !== currentSelectionRevision) {
    return {
      skillId,
      status: "stale",
      currentSelectionRevision,
      expectedSelectionRevision,
      item,
      reason: "The project Skill selection changed after this context was prepared.",
      guidance: [
        "Discard previously loaded Skill content.",
        "Call specweft.prepare_task again and only read Skills from the latest skillContext.allowedSkillIds.",
      ],
    };
  }

  const status = createSelectionStatusMap(selection).get(skillId) ?? "available";
  if (status !== "enabled") {
    return {
      skillId,
      status: "blocked",
      currentSelectionRevision,
      expectedSelectionRevision,
      item,
      reason: createBlockedSkillReason(status),
      guidance: [
        "Do not load this Skill into the current task context.",
        "Enable it explicitly first if the user wants this Skill to participate.",
      ],
    };
  }

  return {
    skillId,
    status: "ready",
    currentSelectionRevision,
    expectedSelectionRevision,
    item,
    content: await readFile(item.skillPath, "utf-8"),
    reason: "Skill is enabled for this project and the selection revision matches.",
    guidance: [
      "Use this Skill only for the current prepared task.",
      "Discard it when a new prepare_task result or different selectionRevision appears.",
    ],
  };
}

export function createSkillSelectionRevision(selection: ProjectSelectionFile): string {
  const payload = selection.selected
    .map((item) => `${item.id}:${item.status}:${item.appliedAt}`)
    .sort()
    .join("|");

  return createHash("sha256")
    .update(`v${selection.version}|${payload}`)
    .digest("hex")
    .slice(0, 16);
}

export function createSkillLoadPolicy(
  status: CapabilityStatus,
): SkillContextLoadPolicy {
  if (status === "enabled") {
    return "read-on-demand";
  }
  if (status === "disabled" || status === "ignored") {
    return "blocked";
  }
  return "metadata-only";
}

function createSelectionStatusMap(
  selection: ProjectSelectionFile,
): Map<string, ProjectSelectionItem["status"]> {
  return new Map(selection.selected.map((item) => [item.id, item.status]));
}

function sortedSelectionIds(
  selection: ProjectSelectionFile,
  status: ProjectSelectionItem["status"],
): string[] {
  return selection.selected
    .filter((item) => item.status === status)
    .map((item) => item.id)
    .sort();
}

function createSkillContextItem(
  skill: SkillRegistryItem,
  selectedStatus?: ProjectSelectionItem["status"],
): SkillContextIndexItem {
  const status: CapabilityStatus = selectedStatus ?? "available";

  return {
    id: skill.id,
    name: skill.name,
    description: skill.description,
    source: skill.source,
    tags: skill.tags,
    risk: skill.risk,
    status,
    activationHints: createActivationHints(skill),
    loadPolicy: createSkillLoadPolicy(status),
    reason: createContextItemReason(status),
  };
}

function includeSkillContextItem(
  item: SkillContextIndexItem,
  scope: SkillContextScope,
  selectedIds: Set<string>,
): boolean {
  if (item.status === "ignored") {
    return scope === "all";
  }
  if (scope === "enabled") {
    return item.status === "enabled";
  }
  if (scope === "task") {
    return selectedIds.has(item.id);
  }
  return true;
}

function sortSkillContextItems(
  left: SkillContextIndexItem,
  right: SkillContextIndexItem,
): number {
  const leftRank = statusRank(left.status);
  const rightRank = statusRank(right.status);

  if (leftRank !== rightRank) {
    return leftRank - rightRank;
  }

  return left.name.localeCompare(right.name);
}

function statusRank(status: CapabilityStatus): number {
  if (status === "enabled") {
    return 0;
  }
  if (status === "recommended") {
    return 1;
  }
  if (status === "available") {
    return 2;
  }
  if (status === "disabled") {
    return 3;
  }
  return 4;
}

function createActivationHints(skill: SkillRegistryItem): string[] {
  return [
    ...skill.tags.slice(0, 4),
    skill.source,
    `${skill.risk}-risk`,
  ];
}

function createContextItemReason(status: CapabilityStatus): string {
  if (status === "enabled") {
    return "Enabled for this project. The full SKILL.md may be read lazily when selected for the current task.";
  }
  if (status === "disabled") {
    return "Disabled by the user. Keep it out of automatic task context.";
  }
  if (status === "ignored") {
    return "Ignored by the user. Do not recommend or load it unless the user restores it.";
  }
  return "Available in the local Skill pool. Keep metadata-only until the user enables it.";
}

function createBlockedSkillReason(status: CapabilityStatus): string {
  if (status === "disabled") {
    return "Skill is disabled for this project.";
  }
  if (status === "ignored") {
    return "Skill is ignored for this project.";
  }
  return "Skill is not enabled for this project.";
}

function createSkillContextSummary(
  scope: SkillContextScope,
  allowedSkillIds: string[],
  selectionRevision: string,
): string {
  if (allowedSkillIds.length === 0) {
    return `Skill context ${selectionRevision} (${scope}) is metadata-only; no Skill detail should be loaded automatically.`;
  }

  return `Skill context ${selectionRevision} (${scope}) allows lazy detail reads for: ${allowedSkillIds.join(", ")}.`;
}
