import type {
  MarketplaceConflictLevel,
  MarketplaceSkill,
  MarketplaceSkillCandidate,
  MarketplaceSkillSearchResult,
  ProjectProfile,
  ToolRecommendation,
} from "../schemas/types.js";

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
  const url = new URL(SKILLSMP_API_URL);
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
