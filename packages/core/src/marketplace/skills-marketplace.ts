import type {
  MarketplaceConflictLevel,
  MarketplaceSkill,
  MarketplaceSkillCandidate,
  MarketplaceSkillSearchResult,
  ProjectProfile,
  SkillRegistryItem,
  SkillUpdateCheck,
  SkillUpdateItem,
  ToolRecommendation,
} from "../schemas/types.js";
import { listSkillPool } from "../pool/pool-manager.js";
import { readProjectSkillSelection } from "../selection/selection-manager.js";
import { readProjectSettings } from "../settings/project-settings.js";

const SKILLSMP_API_URL = "https://skillsmp.com/api/skills";
const DEFAULT_LIMIT = 12;
const DEFAULT_TIMEOUT_MS = 8000;
const MAX_KEYWORDS = 5;

type SkillsMpResponse = {
  skills?: MarketplaceSkill[];
};

type SearchOptions = {
  limit?: number;
  timeoutMs?: number;
  registryUrl?: string;
  search?: (keyword: string, options: SearchOptions) => Promise<MarketplaceSkill[]>;
  keywords?: string[];
};

export async function recommendMarketplaceSkills(
  profile: ProjectProfile,
  recommendations: ToolRecommendation[],
  options: SearchOptions = {},
): Promise<MarketplaceSkillSearchResult> {
  const keywords = options.keywords?.length
    ? options.keywords.map((keyword) => normalizeKeyword(keyword)).filter(Boolean).slice(0, MAX_KEYWORDS)
    : createMarketplaceKeywords(profile, recommendations);
  const warnings: string[] = [];
  const candidates = new Map<string, MarketplaceSkillCandidate>();
  const results = await Promise.all(
    keywords.map(async (keyword) => {
      try {
        return {
          keyword,
          skills: await searchMarketplace(keyword, options),
          error: undefined,
        };
      } catch (error) {
        return {
          keyword,
          skills: [],
          error,
        };
      }
    }),
  );

  for (const result of results) {
    if (result.error) {
      const message = result.error instanceof Error ? result.error.message : String(result.error);
      warnings.push(`skillsmp search failed for "${result.keyword}": ${message}`);
      continue;
    }

    for (const skill of result.skills) {
      if (!isRelevantSkill(result.keyword, skill)) {
        continue;
      }

      const candidate = createCandidate(result.keyword, skill, profile);
      const key = createCandidateKey(candidate);
      const existing = candidates.get(key);
      if (!existing || isBetterCandidate(candidate, existing)) {
        candidates.set(key, candidate);
      }
    }
  }

  return {
    source: "skillsmp",
    keywords,
    candidates: [...candidates.values()]
      .sort((left, right) => {
        if (left.conflictLevel !== right.conflictLevel) {
          return conflictRank(left.conflictLevel) - conflictRank(right.conflictLevel);
        }
        return right.relevance - left.relevance;
      })
      .slice(0, options.limit ?? DEFAULT_LIMIT),
    warnings,
  };
}

export async function checkMarketplaceSkillUpdates(
  repoPath: string,
  options: SearchOptions = {},
): Promise<SkillUpdateCheck> {
  const settings = await readProjectSettings(repoPath);
  const registryUrl = options.registryUrl || settings.capabilities.skillRegistryUrl;
  const timeoutMs = options.timeoutMs ?? settings.capabilities.mcpStdioTimeoutMs;
  const [skillPool, skillSelection] = await Promise.all([
    listSkillPool(),
    readProjectSkillSelection(repoPath),
  ]);
  const enabledSkillIds = new Set(
    skillSelection.selected
      .filter((item) => item.status === "enabled")
      .map((item) => item.id),
  );
  const enabledSkills = skillPool.items.filter((item) => enabledSkillIds.has(item.id));

  if (!settings.capabilities.autoCheckSkillUpdates) {
    const items = enabledSkills.map((skill) => createSkippedUpdateItem(skill, "Skill update checks are disabled in project settings."));
    return createSkillUpdateCheck(false, registryUrl, items, []);
  }

  const warnings: string[] = [];
  const items = await Promise.all(enabledSkills.map(async (skill) => {
    if (skill.source !== "marketplace" || !skill.marketplace) {
      return createSkippedUpdateItem(skill, "Only marketplace Skills with source metadata can be checked for updates.");
    }

    try {
      const matches = await searchMarketplace(skill.name, {
        ...options,
        registryUrl,
        timeoutMs,
        limit: Math.max(options.limit ?? DEFAULT_LIMIT, 12),
      });
      const latest = findMatchingMarketplaceSkill(skill, matches);
      if (!latest) {
        return createUnknownUpdateItem(skill, "No matching Skill was found in the configured registry.");
      }

      return createUpdateItem(skill, latest);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      warnings.push(`Skill update check failed for "${skill.name}": ${message}`);
      return createUnknownUpdateItem(skill, message);
    }
  }));

  return createSkillUpdateCheck(true, registryUrl, items, warnings);
}

export function createMarketplaceKeywords(
  profile: ProjectProfile,
  recommendations: ToolRecommendation[],
): string[] {
  const keywords = new Set<string>();

  for (const language of profile.languages) {
    keywords.add(language);
  }

  for (const framework of profile.frameworks) {
    keywords.add(framework);
  }

  if (recommendations.some((item) => item.id === "test-planner")) {
    keywords.add("testing");
  }

  if (recommendations.some((item) => item.id === "diff-explainer")) {
    keywords.add("review");
  }

  return [...keywords]
    .map((keyword) => normalizeKeyword(keyword))
    .filter(Boolean)
    .slice(0, MAX_KEYWORDS);
}

async function searchSkillsMp(
  keyword: string,
  options: SearchOptions,
): Promise<MarketplaceSkill[]> {
  const url = new URL(options.registryUrl || SKILLSMP_API_URL);
  url.searchParams.set("page", "1");
  url.searchParams.set("limit", String(options.limit ?? DEFAULT_LIMIT));
  url.searchParams.set("sortBy", "stars");
  url.searchParams.set("search", keyword);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const body = (await response.json()) as SkillsMpResponse;
    return body.skills ?? [];
  } finally {
    clearTimeout(timeout);
  }
}

async function searchMarketplace(
  keyword: string,
  options: SearchOptions,
): Promise<MarketplaceSkill[]> {
  if (options.search) {
    return options.search(keyword, options);
  }

  return searchSkillsMp(keyword, options);
}

function createCandidate(
  keyword: string,
  skill: MarketplaceSkill,
  profile: ProjectProfile,
): MarketplaceSkillCandidate {
  const conflictReasons = detectConflictReasons(skill, profile);
  const conflictLevel = createConflictLevel(conflictReasons);

  return {
    ...skill,
    keyword,
    relevance: scoreSkill(keyword, skill, profile),
    conflictLevel,
    conflictReasons,
  };
}

function createCandidateKey(skill: MarketplaceSkill): string {
  return `${skill.author}:${skill.name}`.toLowerCase();
}

function findMatchingMarketplaceSkill(
  installed: SkillRegistryItem,
  candidates: MarketplaceSkill[],
): MarketplaceSkill | undefined {
  const metadata = installed.marketplace;
  if (!metadata) {
    return undefined;
  }

  return candidates.find((candidate) => candidate.id === installed.id)
    ?? candidates.find((candidate) => candidate.githubUrl === metadata.githubUrl)
    ?? candidates.find((candidate) => (
      normalizeText(candidate.author) === normalizeText(metadata.author)
      && normalizeText(candidate.name) === normalizeText(installed.name)
    ));
}

function createUpdateItem(
  installed: SkillRegistryItem,
  latest: MarketplaceSkill,
): SkillUpdateItem {
  const currentUpdatedAt = installed.marketplace?.updatedAt;
  const hasUpdate = compareUpdatedAt(latest.updatedAt, currentUpdatedAt) > 0;

  return {
    id: installed.id,
    name: installed.name,
    source: installed.source,
    status: hasUpdate ? "update-available" : "current",
    currentUpdatedAt,
    latestUpdatedAt: latest.updatedAt,
    latestGithubUrl: latest.githubUrl,
    reason: hasUpdate
      ? "A newer marketplace version appears to be available. Preview before reinstalling."
      : "Installed Skill metadata matches the latest marketplace result.",
  };
}

function createSkippedUpdateItem(skill: SkillRegistryItem, reason: string): SkillUpdateItem {
  return {
    id: skill.id,
    name: skill.name,
    source: skill.source,
    status: "skipped",
    currentUpdatedAt: skill.marketplace?.updatedAt,
    reason,
  };
}

function createUnknownUpdateItem(skill: SkillRegistryItem, reason: string): SkillUpdateItem {
  return {
    id: skill.id,
    name: skill.name,
    source: skill.source,
    status: "unknown",
    currentUpdatedAt: skill.marketplace?.updatedAt,
    reason,
  };
}

function createSkillUpdateCheck(
  enabled: boolean,
  registryUrl: string,
  items: SkillUpdateItem[],
  warnings: string[],
): SkillUpdateCheck {
  return {
    enabled,
    registryUrl,
    generatedAt: new Date().toISOString(),
    checkedCount: items.filter((item) => item.status !== "skipped").length,
    updateCount: items.filter((item) => item.status === "update-available").length,
    skippedCount: items.filter((item) => item.status === "skipped").length,
    items,
    warnings,
  };
}

function compareUpdatedAt(left: string | undefined, right: string | undefined): number {
  if (!left && !right) {
    return 0;
  }
  if (!left) {
    return -1;
  }
  if (!right) {
    return 1;
  }

  const leftNumber = Number(left);
  const rightNumber = Number(right);
  if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) {
    return leftNumber - rightNumber;
  }

  const leftDate = Date.parse(left);
  const rightDate = Date.parse(right);
  if (Number.isFinite(leftDate) && Number.isFinite(rightDate)) {
    return leftDate - rightDate;
  }

  return left.localeCompare(right);
}

function isBetterCandidate(
  candidate: MarketplaceSkillCandidate,
  existing: MarketplaceSkillCandidate,
): boolean {
  if (candidate.relevance !== existing.relevance) {
    return candidate.relevance > existing.relevance;
  }

  return candidate.stars > existing.stars;
}

function isRelevantSkill(keyword: string, skill: MarketplaceSkill): boolean {
  const normalizedKeyword = normalizeKeyword(keyword);
  const text = normalizeText(`${skill.name} ${skill.description}`);

  if (normalizedKeyword === "java") {
    const withoutJavascript = text.replaceAll("javascript", " ");
    return hasToken(withoutJavascript, "java")
      || hasToken(withoutJavascript, "spring")
      || hasToken(withoutJavascript, "quarkus")
      || hasToken(withoutJavascript, "graalvm");
  }

  if (normalizedKeyword === "typescript") {
    return hasToken(text, "typescript") || hasToken(text, "ts");
  }

  if (normalizedKeyword === "javascript") {
    return hasToken(text, "javascript") || hasToken(text, "node");
  }

  return hasToken(text, normalizedKeyword);
}

function detectConflictReasons(skill: MarketplaceSkill, profile: ProjectProfile): string[] {
  const reasons: string[] = [];
  const text = normalizeText(`${skill.name} ${skill.description}`);
  const hasLocalRules = profile.ruleFiles.length > 0;
  const standardsLike = [
    "coding standards",
    "standard",
    "standards",
    "convention",
    "conventions",
    "style",
    "rules",
    "best practices",
    "architecture",
  ].some((keyword) => text.includes(keyword));

  if (hasLocalRules && standardsLike) {
    reasons.push(
      `Project already has local rule file(s): ${profile.ruleFiles.join(", ")}. Review before using an external standards skill.`,
    );
  }

  if (text.includes("javascript") && profile.languages.includes("java") && !profile.languages.includes("javascript")) {
    reasons.push("Looks JavaScript-related while the project is Java-focused.");
  }

  return reasons;
}

function createConflictLevel(reasons: string[]): MarketplaceConflictLevel {
  if (reasons.some((reason) => reason.includes("local rule file"))) {
    return "high";
  }
  if (reasons.length > 0) {
    return "medium";
  }
  return "none";
}

function scoreSkill(keyword: string, skill: MarketplaceSkill, profile: ProjectProfile): number {
  const text = normalizeText(`${skill.name} ${skill.description}`);
  const normalizedKeyword = normalizeKeyword(keyword);
  let score = Math.min(skill.stars / 1000, 100);

  if (hasToken(text, normalizedKeyword)) {
    score += 25;
  }

  for (const language of profile.languages) {
    if (hasToken(text, normalizeKeyword(language))) {
      score += 15;
    }
  }

  for (const framework of profile.frameworks) {
    if (hasToken(text, normalizeKeyword(framework))) {
      score += 10;
    }
  }

  return Math.round(score);
}

function conflictRank(level: MarketplaceConflictLevel): number {
  if (level === "none") {
    return 0;
  }
  if (level === "low") {
    return 1;
  }
  if (level === "medium") {
    return 2;
  }
  return 3;
}

function hasToken(text: string, token: string): boolean {
  return new RegExp(`(^|[^a-z0-9])${escapeRegExp(token)}([^a-z0-9]|$)`).test(text);
}

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/[-_/]+/g, " ");
}

function normalizeKeyword(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9+#.]+/g, " ");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
