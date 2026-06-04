export type ProjectProfile = {
  id: string;
  name: string;
  rootPath: string;
  languages: string[];
  frameworks: string[];
  packageManager?: string;
  testCommands: string[];
  buildCommands: string[];
  ruleFiles: string[];
  createdAt: string;
  updatedAt: string;
};

export type RecommendationRisk = "low" | "medium" | "high";

export type ToolRecommendation = {
  id: string;
  type: "mcp" | "skill";
  name: string;
  reason: string;
  risk: RecommendationRisk;
  status: "recommended" | "enabled" | "disabled" | "ignored";
};

export type MarketplaceSkill = {
  id: string;
  name: string;
  author: string;
  authorAvatar?: string;
  description: string;
  githubUrl: string;
  stars: number;
  forks: number;
  updatedAt: string;
  path: string;
  branch: string;
};

export type MarketplaceConflictLevel = "none" | "low" | "medium" | "high";

export type MarketplaceSkillCandidate = MarketplaceSkill & {
  keyword: string;
  relevance: number;
  conflictLevel: MarketplaceConflictLevel;
  conflictReasons: string[];
};

export type MarketplaceSkillSearchResult = {
  source: "skillsmp";
  keywords: string[];
  candidates: MarketplaceSkillCandidate[];
  warnings: string[];
};

export type MarketplaceSkillInstallResult = {
  item: SkillRegistryItem;
  skillPath: string;
  installedAt: string;
  contentSource: string;
};

export type MarketplaceMcp = {
  id: string;
  name: string;
  author: string;
  description: string;
  githubUrl?: string;
  homepageUrl?: string;
  stars: number;
  forks: number;
  updatedAt: string;
  packageName?: string;
  runtime: McpRuntime;
  url?: string;
  envVars: string[];
  permissions: string[];
  tags: string[];
};

export type MarketplaceMcpCandidate = MarketplaceMcp & {
  keyword: string;
  relevance: number;
  installable: boolean;
  risk: PoolRisk;
  riskReasons: string[];
  suggestedManifest?: McpManifest;
};

export type MarketplaceMcpSearchResult = {
  source: "official-registry+curated+github";
  keywords: string[];
  candidates: MarketplaceMcpCandidate[];
  warnings: string[];
};

export type MarketplaceMcpInstallResult = {
  item: McpRegistryItem;
  manifest: McpManifest;
  manifestPath: string;
  installedAt: string;
};

export type DiffFileChange = {
  path: string;
  additions: number;
  deletions: number;
  changeType: "added" | "modified" | "deleted" | "renamed" | "unknown";
};

export type DiffSummary = {
  repoPath: string;
  changedFiles: DiffFileChange[];
  diffText: string;
  stats: {
    files: number;
    additions: number;
    deletions: number;
  };
};

export type ReviewDraft = {
  summary: string;
  intent: string;
  mainChanges: string[];
  reviewWalkthrough: string[];
  impactAreas: string[];
  overEngineeringSignals: string[];
  reviewChecklist: string[];
  risks: string[];
  testSuggestions: string[];
  nextThreadPrompt: string;
};

export type ReviewReport = {
  title: string;
  reportPath: string;
  markdown: string;
  memory: SessionMemory;
};

export type SessionMemory = {
  id: string;
  projectId: string;
  title: string;
  keywords: string[];
  summary: string;
  changedFiles: string[];
  reviewPath?: string;
  nextThreadPrompt?: string;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
};

export type MemoryHandoff = {
  projectId: string;
  projectName: string;
  generatedAt: string;
  sessions: SessionMemory[];
  keywords: string[];
  changedFiles: string[];
  summary: string;
  prompt: string;
};

export type BootstrapSession = {
  projectId: string;
  projectName: string;
  generatedAt: string;
  profile: ProjectProfile;
  recommendations: ToolRecommendation[];
  assembly: RuntimeAssembly;
  handoff: MemoryHandoff;
  workflow: {
    when: string;
    actions: string[];
  }[];
};

export type SpecWeftInitResult = {
  repoPath: string;
  profile: ProjectProfile;
  pool: PoolInitResult;
  enabled: {
    mcps: ProjectSelectionItem[];
    skills: ProjectSelectionItem[];
  };
  instructionPaths: string[];
  bootstrap: BootstrapSession;
  nextCommands: string[];
};

export type ProjectStatus = {
  repoPath: string;
  profilePath: string;
  memoryPath: string;
  projectName: string;
  skills: string[];
  mcps: string[];
};

export type PoolSource = "builtin" | "marketplace" | "manual";
export type PoolRisk = "low" | "medium" | "high";
export type McpRuntime = "stdio" | "remote";

export type RegistryFile<T> = {
  version: number;
  items: T[];
};

export type McpRegistryItem = {
  id: string;
  name: string;
  manifestPath: string;
  source: PoolSource;
};

export type McpManifest = {
  id: string;
  name: string;
  description: string;
  runtime: McpRuntime;
  launch?: {
    command: string;
    args: string[];
  };
  url?: string;
  env?: string[];
  headers?: Record<string, string>;
  permissions: string[];
  risk: PoolRisk;
  tags: string[];
};

export type SkillRegistryItem = {
  id: string;
  name: string;
  description: string;
  skillPath: string;
  source: PoolSource;
  tags: string[];
  risk: PoolRisk;
};

export type PoolInitResult = {
  mcpRegistryPath: string;
  skillRegistryPath: string;
  mcpCount: number;
  skillCount: number;
};

// 项目级选择状态：全局池里有很多 MCP/Skills，项目只记录自己启用了哪些。
export type ProjectSelectionStatus = "enabled" | "disabled" | "ignored";

export type ProjectSelectionItem = {
  id: string;
  status: ProjectSelectionStatus;
  reason: string;
  appliedAt: string;
};

export type ProjectSelectionFile = {
  version: number;
  selected: ProjectSelectionItem[];
};


// 装载mcp 和 skill
export type AssemblyMcpServer = {
  transport: McpRuntime;
  command?: string;
  args?: string[];
  url?: string;
  env?: Record<string, string>;
  headers?: Record<string, string>;
};

export type AssemblySkill = {
  id: string;
  path: string;
};

export type RuntimeAssembly = {
  mcpServers: Record<string, AssemblyMcpServer>;
  skills: AssemblySkill[];
};
