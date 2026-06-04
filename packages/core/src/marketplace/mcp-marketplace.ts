import type {
  MarketplaceMcp,
  MarketplaceMcpCandidate,
  MarketplaceMcpSearchResult,
  McpManifest,
  ProjectProfile,
  ToolRecommendation,
} from "../schemas/types.js";

const GITHUB_SEARCH_API_URL = "https://api.github.com/search/repositories";
const OFFICIAL_REGISTRY_API_URL = "https://registry.modelcontextprotocol.io/v0.1/servers";
const DEFAULT_LIMIT = 12;
const DEFAULT_TIMEOUT_MS = 8000;
const MAX_KEYWORDS = 5;

type SearchOptions = {
  limit?: number;
  timeoutMs?: number;
  keywords?: string[];
  requirement?: string;
  search?: (keyword: string, options: SearchOptions) => Promise<MarketplaceMcp[]>;
};

type GithubSearchResponse = {
  items?: Array<{
    id: number;
    name: string;
    full_name: string;
    html_url: string;
    description: string | null;
    stargazers_count: number;
    forks_count: number;
    updated_at: string;
    owner: {
      login: string;
    };
    topics?: string[];
  }>;
};

type OfficialRegistryResponse = {
  servers?: OfficialRegistryServer[];
  items?: OfficialRegistryServer[];
  data?: OfficialRegistryServer[];
};

type OfficialRegistryServer = {
  id?: string;
  name?: string;
  title?: string;
  description?: string;
  repository?: {
    url?: string;
    source?: string;
    id?: string;
  };
  packages?: Array<{
    registry_type?: string;
    registryType?: string;
    registry_base_url?: string;
    registryBaseUrl?: string;
    identifier?: string;
    version?: string;
    package_arguments?: unknown[];
    packageArguments?: unknown[];
    runtime_hint?: string;
    runtimeHint?: string;
    transport?: {
      type?: string;
    };
    environment_variables?: Array<{
      name?: string;
      description?: string;
      required?: boolean;
    }>;
    environmentVariables?: Array<{
      name?: string;
      description?: string;
      required?: boolean;
    }>;
  }>;
  remotes?: Array<{
    transport_type?: string;
    transportType?: string;
    url?: string;
    headers?: Array<{
      name?: string;
      description?: string;
      required?: boolean;
    }>;
  }>;
  version_detail?: {
    version?: string;
    release_date?: string;
    is_latest?: boolean;
  };
  versionDetail?: {
    version?: string;
    releaseDate?: string;
    isLatest?: boolean;
  };
};

const CURATED_HOT_MCPS: MarketplaceMcp[] = [
  {
    id: "curated-github",
    name: "GitHub MCP Server",
    author: "github",
    description: "Official GitHub MCP server for repository, issue, pull request, and code workflow automation.",
    githubUrl: "https://github.com/github/github-mcp-server",
    stars: 0,
    forks: 0,
    updatedAt: "",
    packageName: "@github/github-mcp-server",
    runtime: "stdio",
    envVars: ["GITHUB_PERSONAL_ACCESS_TOKEN"],
    permissions: ["network", "github", "repository"],
    tags: ["github", "git", "pull-request", "issues", "code-review"],
  },
  {
    id: "curated-playwright",
    name: "Playwright MCP",
    author: "microsoft",
    description: "Browser automation MCP for web testing, screenshots, and UI interaction.",
    githubUrl: "https://github.com/microsoft/playwright-mcp",
    stars: 0,
    forks: 0,
    updatedAt: "",
    packageName: "@playwright/mcp",
    runtime: "stdio",
    envVars: [],
    permissions: ["browser", "network"],
    tags: ["browser", "playwright", "testing", "frontend", "e2e"],
  },
  {
    id: "curated-supabase",
    name: "Supabase MCP",
    author: "supabase",
    description: "Supabase MCP server for database, project, and SQL workflow context.",
    githubUrl: "https://github.com/supabase-community/supabase-mcp",
    stars: 0,
    forks: 0,
    updatedAt: "",
    packageName: "@supabase/mcp-server-supabase",
    runtime: "stdio",
    envVars: ["SUPABASE_ACCESS_TOKEN"],
    permissions: ["network", "database"],
    tags: ["supabase", "postgres", "database", "sql"],
  },
  {
    id: "curated-postgres",
    name: "Postgres MCP",
    author: "modelcontextprotocol",
    description: "Postgres MCP server for read-focused database context and query workflows.",
    githubUrl: "https://github.com/modelcontextprotocol/servers",
    stars: 0,
    forks: 0,
    updatedAt: "",
    packageName: "@modelcontextprotocol/server-postgres",
    runtime: "stdio",
    envVars: ["POSTGRES_CONNECTION_STRING"],
    permissions: ["database"],
    tags: ["postgres", "database", "sql"],
  },
  {
    id: "curated-slack",
    name: "Slack MCP",
    author: "modelcontextprotocol",
    description: "Slack MCP server for channel, message, and workspace collaboration context.",
    githubUrl: "https://github.com/modelcontextprotocol/servers",
    stars: 0,
    forks: 0,
    updatedAt: "",
    packageName: "@modelcontextprotocol/server-slack",
    runtime: "stdio",
    envVars: ["SLACK_BOT_TOKEN", "SLACK_TEAM_ID"],
    permissions: ["network", "workspace"],
    tags: ["slack", "chat", "team"],
  },
  {
    id: "curated-notion",
    name: "Notion MCP",
    author: "modelcontextprotocol",
    description: "Notion MCP server for docs, knowledge base, and workspace context.",
    githubUrl: "https://github.com/modelcontextprotocol/servers",
    stars: 0,
    forks: 0,
    updatedAt: "",
    packageName: "@modelcontextprotocol/server-notion",
    runtime: "stdio",
    envVars: ["NOTION_API_KEY"],
    permissions: ["network", "workspace"],
    tags: ["notion", "docs", "knowledge-base"],
  },
  {
    id: "curated-aws",
    name: "AWS MCP",
    author: "awslabs",
    description: "AWS MCP servers for cloud infrastructure, docs, and operational workflows.",
    githubUrl: "https://github.com/awslabs/mcp",
    stars: 0,
    forks: 0,
    updatedAt: "",
    packageName: "awslabs.aws-documentation-mcp-server",
    runtime: "stdio",
    envVars: ["AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "AWS_REGION"],
    permissions: ["network", "cloud"],
    tags: ["aws", "cloud", "infrastructure"],
  },
  {
    id: "curated-brave-search",
    name: "Brave Search MCP",
    author: "modelcontextprotocol",
    description: "Web search MCP server for research and documentation lookup.",
    githubUrl: "https://github.com/modelcontextprotocol/servers",
    stars: 0,
    forks: 0,
    updatedAt: "",
    packageName: "@modelcontextprotocol/server-brave-search",
    runtime: "stdio",
    envVars: ["BRAVE_API_KEY"],
    permissions: ["network", "search"],
    tags: ["search", "web", "research"],
  },
];

export async function recommendMarketplaceMcps(
  profile: ProjectProfile,
  recommendations: ToolRecommendation[],
  options: SearchOptions = {},
): Promise<MarketplaceMcpSearchResult> {
  const keywords = options.keywords?.length
    ? options.keywords.map((keyword) => normalizeKeyword(keyword)).filter(Boolean).slice(0, MAX_KEYWORDS)
    : createMarketplaceMcpKeywords(profile, recommendations, options.requirement);
  const warnings: string[] = [];
  const candidates = new Map<string, MarketplaceMcpCandidate>();
  const seededCandidates = CURATED_HOT_MCPS
    .filter((mcp) => keywords.some((keyword) => isRelevantMcp(keyword, mcp)))
    .map((mcp) => createCandidate(keywords.find((keyword) => isRelevantMcp(keyword, mcp)) ?? "popular", mcp, profile, options.requirement));

  for (const candidate of seededCandidates) {
    candidates.set(createCandidateKey(candidate), candidate);
  }

  const results = await Promise.all(
    keywords.map(async (keyword) => {
      try {
        return {
          keyword,
          mcps: await searchMarketplace(keyword, options),
          error: undefined,
        };
      } catch (error) {
        return {
          keyword,
          mcps: [],
          error,
        };
      }
    }),
  );

  for (const result of results) {
    if (result.error) {
      const message = result.error instanceof Error ? result.error.message : String(result.error);
      warnings.push(`MCP search failed for "${result.keyword}": ${message}`);
      continue;
    }

    for (const mcp of result.mcps) {
      if (!isRelevantMcp(result.keyword, mcp)) {
        continue;
      }

      const candidate = createCandidate(result.keyword, mcp, profile, options.requirement);
      const key = createCandidateKey(candidate);
      const existing = candidates.get(key);
      if (!existing || isBetterCandidate(candidate, existing)) {
        candidates.set(key, candidate);
      }
    }
  }

  return {
    source: "official-registry+curated+github",
    keywords,
    candidates: [...candidates.values()]
      .sort((left, right) => {
        if (left.installable !== right.installable) {
          return left.installable ? -1 : 1;
        }
        return right.relevance - left.relevance;
      })
      .slice(0, options.limit ?? DEFAULT_LIMIT),
    warnings,
  };
}

export function createMarketplaceMcpKeywords(
  profile: ProjectProfile,
  recommendations: ToolRecommendation[],
  requirement?: string,
): string[] {
  const keywords = new Set<string>();
  const requirementText = normalizeText(requirement ?? "");

  for (const framework of profile.frameworks) {
    keywords.add(framework);
  }
  for (const language of profile.languages) {
    keywords.add(language);
  }

  if (profile.packageManager) {
    keywords.add(profile.packageManager);
  }
  if (recommendations.some((item) => item.id === "git" || item.reason.toLowerCase().includes("git"))) {
    keywords.add("github");
  }
  if (recommendations.some((item) => item.reason.toLowerCase().includes("test"))) {
    keywords.add("playwright");
  }

  const semanticKeywords: Array<[string, string[]]> = [
    ["github", ["github", "pull request", "pr", "issue", "repo", "代码审查", "仓库"]],
    ["playwright", ["browser", "frontend", "ui", "e2e", "test", "浏览器", "前端", "测试"]],
    ["postgres", ["postgres", "database", "db", "sql", "数据库"]],
    ["supabase", ["supabase"]],
    ["slack", ["slack", "message", "channel", "team", "聊天"]],
    ["notion", ["notion", "docs", "wiki", "knowledge", "文档", "知识库"]],
    ["aws", ["aws", "cloud", "lambda", "s3", "云", "部署"]],
    ["search", ["search", "web", "research", "browser", "搜索", "联网"]],
  ];

  for (const [keyword, triggers] of semanticKeywords) {
    if (triggers.some((trigger) => requirementText.includes(trigger))) {
      keywords.add(keyword);
    }
  }

  if (keywords.size === 0) {
    keywords.add("github");
    keywords.add("playwright");
    keywords.add("postgres");
  }

  return [...keywords]
    .map((keyword) => normalizeKeyword(keyword))
    .filter(Boolean)
    .slice(0, MAX_KEYWORDS);
}

export function createMcpManifestFromCandidate(candidate: MarketplaceMcpCandidate): McpManifest {
  if (candidate.suggestedManifest) {
    return candidate.suggestedManifest;
  }

  return createSuggestedManifest(candidate);
}

async function searchMarketplace(keyword: string, options: SearchOptions): Promise<MarketplaceMcp[]> {
  if (options.search) {
    return options.search(keyword, options);
  }

  const [official, github] = await Promise.allSettled([
    searchOfficialRegistry(keyword, options),
    searchGithubMcpServers(keyword, options),
  ]);
  const mcps: MarketplaceMcp[] = [];

  if (official.status === "fulfilled") {
    mcps.push(...official.value);
  }
  if (github.status === "fulfilled") {
    mcps.push(...github.value);
  }
  if (official.status === "rejected" && github.status === "rejected") {
    throw official.reason instanceof Error ? official.reason : new Error(String(official.reason));
  }

  return dedupeMcps(mcps);
}

async function searchOfficialRegistry(
  keyword: string,
  options: SearchOptions,
): Promise<MarketplaceMcp[]> {
  const url = new URL(OFFICIAL_REGISTRY_API_URL);
  // 官方 Registry API 当前是聚合器读取接口，没有稳定搜索参数；先取一页再本地过滤，失败时还有 GitHub 兜底。
  url.searchParams.set("limit", String(Math.max(50, Math.min((options.limit ?? DEFAULT_LIMIT) * 8, 100))));

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
      throw new Error(`Official registry HTTP ${response.status}`);
    }

    const body = (await response.json()) as OfficialRegistryResponse | OfficialRegistryServer[];
    const servers = Array.isArray(body)
      ? body
      : body.servers ?? body.items ?? body.data ?? [];

    return servers
      .map((server) => createMcpFromOfficialRegistry(server))
      .filter((mcp): mcp is MarketplaceMcp => Boolean(mcp));
  } finally {
    clearTimeout(timeout);
  }
}

async function searchGithubMcpServers(
  keyword: string,
  options: SearchOptions,
): Promise<MarketplaceMcp[]> {
  const url = new URL(GITHUB_SEARCH_API_URL);
  url.searchParams.set("q", `${keyword} mcp server model context protocol in:name,description,readme`);
  url.searchParams.set("sort", "stars");
  url.searchParams.set("order", "desc");
  url.searchParams.set("per_page", String(Math.min(options.limit ?? DEFAULT_LIMIT, 20)));

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        accept: "application/vnd.github+json",
        "x-github-api-version": "2022-11-28",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const body = (await response.json()) as GithubSearchResponse;
    return (body.items ?? []).filter(isGithubMcpRepository).map((item) => {
      const text = normalizeText(`${item.name} ${item.description ?? ""} ${(item.topics ?? []).join(" ")}`);
      const packageName = inferPackageName(item.full_name, text);
      return {
        id: `github-${item.id}`,
        name: item.name,
        author: item.owner.login,
        description: item.description ?? "MCP server discovered from GitHub search.",
        githubUrl: item.html_url,
        stars: item.stargazers_count,
        forks: item.forks_count,
        updatedAt: item.updated_at,
        packageName,
        runtime: "stdio",
        envVars: inferEnvVars(text),
        permissions: inferPermissions(text),
        tags: [...new Set(["github-search", ...(item.topics ?? [])])].slice(0, 10),
      };
    });
  } finally {
    clearTimeout(timeout);
  }
}

function createCandidate(
  keyword: string,
  mcp: MarketplaceMcp,
  profile: ProjectProfile,
  requirement?: string,
): MarketplaceMcpCandidate {
  const riskReasons = detectRiskReasons(mcp);
  const suggestedManifest = createSuggestedManifest(mcp);

  return {
    ...mcp,
    keyword,
    relevance: scoreMcp(keyword, mcp, profile, requirement),
    installable: Boolean(suggestedManifest.launch || suggestedManifest.url),
    risk: createRiskLevel(mcp, riskReasons),
    riskReasons,
    suggestedManifest,
  };
}

function createSuggestedManifest(mcp: MarketplaceMcp): McpManifest {
  const id = createMarketplaceMcpId(mcp);
  const base = {
    id,
    name: mcp.name,
    description: mcp.description,
    permissions: mcp.permissions,
    risk: createRiskLevel(mcp, detectRiskReasons(mcp)),
    tags: [...new Set(["marketplace", ...mcp.tags])],
  };

  if (mcp.runtime === "remote" && mcp.url) {
    return {
      ...base,
      runtime: "remote",
      url: mcp.url,
      env: mcp.envVars,
    };
  }

  if (mcp.packageName) {
    return {
      ...base,
      runtime: "stdio",
      launch: {
        command: "npx",
        args: ["-y", mcp.packageName],
      },
      env: mcp.envVars,
    };
  }

  return {
    ...base,
    runtime: "stdio",
    launch: {
      command: "npx",
      args: ["-y", id],
    },
    env: mcp.envVars,
  };
}

export function createMarketplaceMcpId(mcp: MarketplaceMcp): string {
  return `marketplace-${slugify(mcp.author)}-${slugify(mcp.name)}`;
}

function detectRiskReasons(mcp: MarketplaceMcp): string[] {
  const reasons: string[] = [];

  if (mcp.permissions.includes("database")) {
    reasons.push("Database access may expose or modify project data; verify read/write scope before use.");
  }
  if (mcp.permissions.includes("cloud")) {
    reasons.push("Cloud MCPs can affect infrastructure or billing; require explicit credentials and review.");
  }
  if (mcp.permissions.includes("network")) {
    reasons.push("Network access may send project context to external services.");
  }
  if (mcp.envVars.length > 0) {
    reasons.push(`Requires environment variable(s): ${mcp.envVars.join(", ")}.`);
  }

  return reasons;
}

function createRiskLevel(mcp: MarketplaceMcp, reasons: string[]): "low" | "medium" | "high" {
  if (mcp.permissions.includes("cloud") || mcp.permissions.includes("database")) {
    return "high";
  }
  if (mcp.permissions.includes("network") || mcp.envVars.length > 0 || reasons.length > 0) {
    return "medium";
  }
  return "low";
}

function isRelevantMcp(keyword: string, mcp: MarketplaceMcp): boolean {
  const coreText = normalizeText(`${mcp.name} ${mcp.description} ${mcp.packageName ?? ""} ${mcp.author}`);
  const tagText = normalizeText(mcp.tags.filter((tag) => tag !== "github-search").join(" "));
  const text = `${coreText} ${tagText}`;
  const normalizedKeyword = normalizeKeyword(keyword);

  if (normalizedKeyword === "github") {
    return hasAnyToken(coreText, ["github", "pull request", "pull requests", "issue", "issues", "repository", "repositories"])
      || normalizeKeyword(mcp.author) === "github";
  }

  if (normalizedKeyword === "typescript" || normalizedKeyword === "javascript" || normalizedKeyword === "pnpm") {
    return hasAnyToken(text, ["playwright", "github", "node", "browser", "testing"]);
  }
  if (normalizedKeyword === "java") {
    return hasAnyToken(text, ["github", "postgres", "database", "slack", "aws"]);
  }

  return hasToken(text, normalizedKeyword);
}

function scoreMcp(
  keyword: string,
  mcp: MarketplaceMcp,
  profile: ProjectProfile,
  requirement?: string,
): number {
  const text = normalizeText(`${mcp.name} ${mcp.description} ${mcp.tags.join(" ")} ${mcp.packageName ?? ""}`);
  const requirementText = normalizeText(requirement ?? "");
  let score = Math.min(mcp.stars / 100, 80);

  if (hasToken(text, normalizeKeyword(keyword))) {
    score += 30;
  }
  if (mcp.packageName) {
    score += 18;
  }
  for (const framework of profile.frameworks) {
    if (hasToken(text, normalizeKeyword(framework))) {
      score += 15;
    }
  }
  for (const language of profile.languages) {
    if (isRelevantMcp(language, mcp)) {
      score += 8;
    }
  }
  for (const tag of mcp.tags) {
    if (requirementText.includes(normalizeKeyword(tag))) {
      score += 12;
    }
  }

  return Math.round(score);
}

function isBetterCandidate(
  candidate: MarketplaceMcpCandidate,
  existing: MarketplaceMcpCandidate,
): boolean {
  if (candidate.installable !== existing.installable) {
    return candidate.installable;
  }
  if (candidate.relevance !== existing.relevance) {
    return candidate.relevance > existing.relevance;
  }
  return candidate.stars > existing.stars;
}

function createCandidateKey(mcp: MarketplaceMcp): string {
  return `${mcp.author}:${mcp.name}`.toLowerCase();
}

function createMcpFromOfficialRegistry(server: OfficialRegistryServer): MarketplaceMcp | undefined {
  const name = (server.title ?? server.name)?.trim();
  if (!name) {
    return undefined;
  }

  const packageInfo = server.packages?.find((item) => item.identifier)
    ?? server.packages?.[0];
  const remoteInfo = server.remotes?.find((item) => item.url)
    ?? server.remotes?.[0];
  const repositoryUrl = server.repository?.url;
  const text = normalizeText([
    name,
    server.description ?? "",
    packageInfo?.identifier ?? "",
    repositoryUrl ?? "",
    remoteInfo?.url ?? "",
  ].join(" "));
  const runtime = remoteInfo?.url && !packageInfo?.identifier ? "remote" : "stdio";
  const packageEnvVars = packageInfo?.environmentVariables ?? packageInfo?.environment_variables ?? [];
  const envVars = [
    ...packageEnvVars.map((item) => item.name ?? ""),
    ...(remoteInfo?.headers ?? []).map((item) => item.name ?? ""),
  ].map((item) => item.trim()).filter(Boolean);
  const author = inferAuthor(repositoryUrl, name);

  return {
    id: `official-${slugify(server.id ?? `${author}-${name}`)}`,
    name,
    author,
    description: server.description?.trim() || "MCP server from the official Model Context Protocol registry.",
    githubUrl: repositoryUrl?.startsWith("https://github.com/") ? repositoryUrl : undefined,
    homepageUrl: repositoryUrl && !repositoryUrl.startsWith("https://github.com/") ? repositoryUrl : undefined,
    stars: 0,
    forks: 0,
    updatedAt: server.versionDetail?.releaseDate ?? server.version_detail?.release_date ?? "",
    packageName: packageInfo?.identifier,
    runtime,
    url: remoteInfo?.url,
    envVars,
    permissions: inferPermissions(text),
    tags: [...new Set(["official-registry", ...createRegistryTags(text)])].slice(0, 10),
  };
}

function dedupeMcps(mcps: MarketplaceMcp[]): MarketplaceMcp[] {
  const byKey = new Map<string, MarketplaceMcp>();

  for (const mcp of mcps) {
    const key = mcp.packageName ?? mcp.githubUrl ?? `${mcp.author}:${mcp.name}`.toLowerCase();
    const existing = byKey.get(key);
    if (!existing || mcp.stars > existing.stars || mcp.tags.includes("official-registry")) {
      byKey.set(key, mcp);
    }
  }

  return [...byKey.values()];
}

function inferPackageName(fullName: string, text: string): string | undefined {
  if (fullName === "github/github-mcp-server") {
    return "@github/github-mcp-server";
  }
  if (fullName === "microsoft/playwright-mcp") {
    return "@playwright/mcp";
  }
  if (text.includes("supabase")) {
    return "@supabase/mcp-server-supabase";
  }
  if (text.includes("@modelcontextprotocol/server")) {
    const match = /@modelcontextprotocol\/server-[a-z0-9-]+/.exec(text);
    return match?.[0];
  }
  return undefined;
}

function inferAuthor(repositoryUrl: string | undefined, fallbackName: string): string {
  if (!repositoryUrl) {
    return fallbackName.split(/[/-]/)[0] ?? "unknown";
  }

  const match = /^https:\/\/github\.com\/([^/]+)\/([^/]+)/.exec(repositoryUrl);
  if (match?.[1]) {
    return match[1];
  }

  try {
    return new URL(repositoryUrl).hostname.replace(/^www\./, "");
  } catch {
    return fallbackName.split(/[/-]/)[0] ?? "unknown";
  }
}

function createRegistryTags(text: string): string[] {
  const tags: string[] = [];
  const knownTags = [
    "github",
    "browser",
    "playwright",
    "postgres",
    "database",
    "slack",
    "notion",
    "aws",
    "search",
    "filesystem",
    "jira",
    "docs",
  ];

  for (const tag of knownTags) {
    if (text.includes(tag)) {
      tags.push(tag);
    }
  }

  return tags;
}

function isGithubMcpRepository(item: NonNullable<GithubSearchResponse["items"]>[number]): boolean {
  const text = normalizeText(`${item.name} ${item.full_name} ${item.description ?? ""} ${(item.topics ?? []).join(" ")}`);
  return hasToken(text, "mcp")
    || text.includes("model context protocol")
    || text.includes("modelcontextprotocol");
}

function inferEnvVars(text: string): string[] {
  const envVars = new Set<string>();

  if (text.includes("github")) {
    envVars.add("GITHUB_PERSONAL_ACCESS_TOKEN");
  }
  if (text.includes("supabase")) {
    envVars.add("SUPABASE_ACCESS_TOKEN");
  }
  if (text.includes("slack")) {
    envVars.add("SLACK_BOT_TOKEN");
  }
  if (text.includes("notion")) {
    envVars.add("NOTION_API_KEY");
  }
  if (text.includes("aws")) {
    envVars.add("AWS_ACCESS_KEY_ID");
    envVars.add("AWS_SECRET_ACCESS_KEY");
  }
  if (text.includes("brave")) {
    envVars.add("BRAVE_API_KEY");
  }

  return [...envVars];
}

function inferPermissions(text: string): string[] {
  const permissions = new Set<string>();

  if (text.includes("browser") || text.includes("playwright") || text.includes("puppeteer")) {
    permissions.add("browser");
    permissions.add("network");
  }
  if (text.includes("database") || text.includes("postgres") || text.includes("sqlite") || text.includes("supabase")) {
    permissions.add("database");
  }
  if (text.includes("aws") || text.includes("cloudflare") || text.includes("kubernetes")) {
    permissions.add("cloud");
    permissions.add("network");
  }
  if (text.includes("slack") || text.includes("notion") || text.includes("jira")) {
    permissions.add("workspace");
    permissions.add("network");
  }
  if (text.includes("github") || text.includes("search")) {
    permissions.add("network");
  }

  return permissions.size ? [...permissions] : ["network"];
}

function hasAnyToken(text: string, tokens: string[]): boolean {
  return tokens.some((token) => hasToken(text, token));
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

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
