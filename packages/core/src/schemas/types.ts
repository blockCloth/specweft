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

export type CompressionStrategy = "summary" | "sliding-window" | "none";

export type ProjectSettings = {
  version: number;
  changeRecording: {
    autoRecordDiff: boolean;
    autoLinkRequirement: boolean;
    retentionDays: number;
  };
  contextMemory: {
    maxRetainedTurns: number;
    compressionStrategy: CompressionStrategy;
    ignorePaths: string[];
  };
  capabilities: {
    skillRegistryUrl: string;
    autoCheckSkillUpdates: boolean;
    mcpStdioTimeoutMs: number;
  };
  updatedAt: string;
};

export type ProjectSettingsPatch = {
  changeRecording?: Partial<ProjectSettings["changeRecording"]>;
  contextMemory?: Partial<ProjectSettings["contextMemory"]>;
  capabilities?: Partial<ProjectSettings["capabilities"]>;
};

export type AgentActivityKind =
  | "bootstrap_session"
  | "prepare_task"
  | "restore_requirement"
  | "start_work_segment"
  | "complete_work_segment"
  | "review_current_diff"
  | "record_current_diff"
  | "recommend_skills"
  | "recommend_tools"
  | "apply_skill"
  | "apply_mcp"
  | "install_skill"
  | "install_mcp"
  | "settings_updated"
  | "requirement_created"
  | "requirement_selected"
  | "project_registered"
  | "project_selected"
  | "memory_recalled"
  | "memory_handoff"
  | "system";

export type AgentActivitySource = "web" | "mcp" | "cli" | "system";

export type AgentActivityStatus = "success" | "attention" | "error";

export type AgentActivityEvent = {
  id: string;
  repoPath: string;
  kind: AgentActivityKind;
  source: AgentActivitySource;
  status: AgentActivityStatus;
  title: string;
  summary: string;
  toolName?: string;
  requirementId?: string;
  requirementTitle?: string;
  target?: string;
  metadata: Record<string, string | number | boolean>;
  createdAt: string;
};

export type AgentActivityLog = {
  version: number;
  generatedAt: string;
  events: AgentActivityEvent[];
  summary: {
    total: number;
    success: number;
    attention: number;
    error: number;
    lastEventAt?: string;
  };
};

export type MemoryCompressionRecord = {
  id: string;
  requirementId?: string;
  requirementTitle?: string;
  strategy: CompressionStrategy;
  sourceSessionCount: number;
  retainedSessionCount: number;
  omittedSessionCount: number;
  summary: string;
  keywords: string[];
  keyFiles: string[];
  createdAt: string;
};

export type MemoryCompressionFile = {
  version: number;
  records: MemoryCompressionRecord[];
};

export type RecommendationRisk = "low" | "medium" | "high";

export type CapabilityKind = "mcp" | "skill" | "cli" | "hook";

export type CapabilityStatus = "available" | "recommended" | "enabled" | "disabled" | "ignored";

export type CapabilityManifest = {
  id: string;
  name: string;
  kind: CapabilityKind;
  description: string;
  source: PoolSource;
  installCommand?: string;
  runCommand?: string;
  permissions: string[];
  authRequired: boolean;
  risk: PoolRisk;
  tags: string[];
  compatibleClients: Array<"codex" | "claude" | "cursor" | "gemini" | "generic">;
  status: CapabilityStatus;
  reason?: string;
};

export type CapabilityCenter = {
  project: ProjectProfile;
  generatedAt: string;
  capabilities: CapabilityManifest[];
  summary: {
    total: number;
    recommended: number;
    enabled: number;
    highRisk: number;
  };
};

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

export type MarketplaceSkillPreview = {
  skill: MarketplaceSkill;
  content: string;
  contentSource: string;
};

export type SkillUpdateStatus = "current" | "update-available" | "unknown" | "skipped";

export type SkillUpdateItem = {
  id: string;
  name: string;
  source: PoolSource;
  status: SkillUpdateStatus;
  currentUpdatedAt?: string;
  latestUpdatedAt?: string;
  latestGithubUrl?: string;
  reason: string;
};

export type SkillUpdateCheck = {
  enabled: boolean;
  registryUrl: string;
  generatedAt: string;
  checkedCount: number;
  updateCount: number;
  skippedCount: number;
  items: SkillUpdateItem[];
  warnings: string[];
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
  snapshot: GitChangeSnapshot;
  stats: {
    files: number;
    additions: number;
    deletions: number;
  };
};

export type CodeSnapshotStatus = "current" | "stale" | "reverted" | "unknown";

export type GitChangeSnapshot = {
  head: string;
  diffHash: string;
  changedFiles: string[];
  hasChanges: boolean;
  capturedAt: string;
};

export type CodeSnapshotState = {
  status: CodeSnapshotStatus;
  reason: string;
  checkedAt: string;
  currentSnapshot?: GitChangeSnapshot;
};

export type RecordingStatus = {
  hasChanges: boolean;
  isRecorded: boolean;
  status: "clean" | "recorded" | "unrecorded" | "changed-after-record";
  reason: string;
  currentSnapshot: GitChangeSnapshot;
  latestMatchingMemory?: SessionMemory;
  latestMemory?: SessionMemory;
};

export type SourceReadingItem = {
  path: string;
  absolutePath: string;
  reason: string;
  command: string;
};

export type ReviewGenerationSource = "rules" | "llm" | "rules+llm";

export type ReviewChangeGroup = {
  id: string;
  title: string;
  purpose: string;
  area: string;
  matchReason: string;
  confidence: "high" | "medium" | "low";
  files: DiffFileChange[];
  keyValues: Array<{
    key: string;
    value: string;
  }>;
  reviewNotes: string[];
  testSuggestions: string[];
};

export type ReviewRequirementBlockKind = "current-work" | "historical-requirement" | "functional-area" | "carried-work";

export type ReviewRequirementBlock = {
  id: string;
  title: string;
  kind: ReviewRequirementBlockKind;
  confidence: "high" | "medium" | "low";
  summary: string;
  evidence: string[];
  files: DiffFileChange[];
  keyValues: Array<{
    key: string;
    value: string;
  }>;
  reviewFocus: string[];
  testSuggestions: string[];
  suggestedAction: string;
};

export type ReviewOverviewBatch = {
  id: string;
  title: string;
  kind: ReviewRequirementBlockKind;
  summary: string;
  suggestedAction: string;
  confidence: "high" | "medium" | "low";
  files: DiffFileChange[];
  keyValues: Array<{
    key: string;
    value: string;
  }>;
  sourceBlockIds: string[];
  sourceGroupIds: string[];
  sourceGroupTitles: string[];
};

export type ReviewOverview = {
  title: string;
  summary: string;
  keyValues: Array<{
    key: string;
    value: string;
  }>;
  batches: ReviewOverviewBatch[];
  readingOrder: string[];
};

export type ReviewDigest = {
  title: string;
  requirementContext: string;
  oneLineSummary: string;
  sections: Array<{
    title: string;
    kind: ReviewRequirementBlock["kind"];
    summary: string;
    whyChanged: string;
    implementation: string;
    readingEntry?: {
      title: string;
      path: string;
      reason: string;
    };
    validation?: string;
    confidence: "high" | "medium" | "low";
  }>;
  whyChanged: string[];
  implementationPath: string[];
  readingPath: Array<{
    title: string;
    path: string;
    reason: string;
  }>;
  reviewNotes: string[];
  validation: string[];
  confidence: "high" | "medium" | "low";
  confidenceReasons: string[];
};

export type ReviewDraft = {
  summary: string;
  intent: string;
  generationSource?: ReviewGenerationSource;
  llmSummary?: string;
  llmReviewNotes?: string[];
  llmModel?: string;
  llmError?: string;
  reviewDigest: ReviewDigest;
  reviewOverview: ReviewOverview;
  requirementBlocks: ReviewRequirementBlock[];
  changeGroups: ReviewChangeGroup[];
  implementationSummary: string[];
  mainChanges: string[];
  sourceReadingGuide: SourceReadingItem[];
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
  html: string;
  review: ReviewDraft;
  memory: SessionMemory;
  requirement?: RequirementRecord;
};

export type AgentReviewPacket = {
  title: string;
  requirement?: {
    id: string;
    title: string;
  };
  digest: ReviewDigest;
  changedFiles: string[];
  sourceReading: Array<{
    path: string;
    reason: string;
  }>;
  suggestedAgentResponse: string;
  nextActions: string[];
  advanced: {
    reportPath?: string;
    fullReviewAvailable: boolean;
    omittedPatch: boolean;
  };
};

export type SessionMemory = {
  id: string;
  projectId: string;
  requirementId?: string;
  requirementTitle?: string;
  workSegmentId?: string;
  title: string;
  keywords: string[];
  summary: string;
  changedFiles: string[];
  codeSnapshot?: GitChangeSnapshot;
  codeStatus?: CodeSnapshotStatus;
  codeStatusReason?: string;
  reviewPath?: string;
  nextThreadPrompt?: string;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
};

export type RequirementStatus = "active" | "paused" | "done";

export type RequirementRecord = {
  id: string;
  projectId: string;
  title: string;
  keywords: string[];
  summary?: string;
  status: RequirementStatus;
  reviewCount: number;
  lastReviewPath?: string;
  lastMemoryId?: string;
  createdAt: string;
  updatedAt: string;
};

export type RequirementFile = {
  version: number;
  activeRequirementId?: string;
  requirements: RequirementRecord[];
};

export type WorkSegmentStatus = "active" | "recorded" | "interrupted" | "abandoned";

export type WorkSegment = {
  id: string;
  projectId: string;
  requirementId?: string;
  requirementTitle?: string;
  title: string;
  task: string;
  status: WorkSegmentStatus;
  startSnapshot: GitChangeSnapshot;
  endSnapshot?: GitChangeSnapshot;
  baselineChangedFiles: string[];
  currentChangedFiles: string[];
  newChangedFiles: string[];
  carriedChangedFiles: string[];
  reviewPath?: string;
  memoryId?: string;
  summary?: string;
  createdAt: string;
  updatedAt: string;
  endedAt?: string;
};

export type WorkSegmentFile = {
  version: number;
  activeSegmentId?: string;
  segments: WorkSegment[];
};

export type WorkSegmentInput = {
  projectId: string;
  title?: string;
  task: string;
  requirement?: RequirementRecord;
};

export type WorkSegmentCompletionInput = {
  segmentId?: string;
  status?: Exclude<WorkSegmentStatus, "active">;
  title?: string;
  summary?: string;
  reviewPath?: string;
  memoryId?: string;
  requirement?: RequirementRecord;
};

export type WorkSegmentStatusReport = {
  projectId: string;
  projectName: string;
  generatedAt: string;
  activeSegment?: WorkSegment;
  recentSegments: WorkSegment[];
  summary: {
    total: number;
    active: number;
    recorded: number;
    interrupted: number;
    abandoned: number;
  };
  guidance: string[];
};

export type RequirementTimelineItem = {
  requirement: RequirementRecord;
  sessions: SessionMemory[];
  statusCounts: Record<CodeSnapshotStatus, number>;
  latestSession?: SessionMemory;
};

export type MemoryTimeline = {
  projectId: string;
  generatedAt: string;
  activeRequirementId?: string;
  items: RequirementTimelineItem[];
  unscopedSessions: SessionMemory[];
  summary: {
    requirements: number;
    sessions: number;
    current: number;
    stale: number;
    reverted: number;
    unknown: number;
  };
};

export type RequirementDossierSession = {
  id: string;
  title: string;
  summary: string;
  keywords: string[];
  changedFiles: string[];
  reviewPath?: string;
  codeStatus?: CodeSnapshotStatus;
  codeStatusReason?: string;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
};

export type RequirementDossierItem = {
  id: string;
  requirementId?: string;
  title: string;
  status: RequirementStatus | "unscoped";
  active: boolean;
  summary: string;
  latestSummary?: string;
  reviewCount: number;
  sessionCount: number;
  sessionsOmitted: number;
  keywords: string[];
  keyFiles: string[];
  statusCounts: Record<CodeSnapshotStatus, number>;
  latestUpdatedAt?: string;
  restoreHint: string;
  nextAction: string;
  sessions: RequirementDossierSession[];
};

export type RequirementDossier = {
  projectId: string;
  projectName: string;
  generatedAt: string;
  activeRequirementId?: string;
  totalRequirements: number;
  totalSessions: number;
  items: RequirementDossierItem[];
  summary: string;
};

export type RequirementInput = {
  projectId: string;
  title: string;
  keywords?: string[];
  summary?: string;
};

export type RequirementReviewLink = {
  reviewPath: string;
  memoryId: string;
  summary: string;
  keywords: string[];
};

export type MemoryHandoff = {
  projectId: string;
  projectName: string;
  requirementId?: string;
  requirementTitle?: string;
  generatedAt: string;
  sessions: SessionMemory[];
  keywords: string[];
  changedFiles: string[];
  codeStatusSummary: string[];
  summary: string;
  prompt: string;
};

export type MemoryIndexItem = {
  id: string;
  requirementId?: string;
  requirementTitle?: string;
  title: string;
  keywords: string[];
  summary: string;
  changedFiles: string[];
  codeStatus?: CodeSnapshotStatus;
  codeStatusReason?: string;
  reviewPath?: string;
  updatedAt: string;
  expiresAt: string;
  restoreHint: string;
};

export type MemoryIndex = {
  projectId: string;
  projectName: string;
  generatedAt: string;
  totalMemories: number;
  items: MemoryIndexItem[];
  summary: string;
};

export type MemoryDigestItem = {
  id: string;
  requirementId?: string;
  requirementTitle?: string;
  title: string;
  latestSummary: string;
  compressedSummary?: string;
  compressionCount: number;
  retainedSessionCount: number;
  omittedSessionCount: number;
  keywords: string[];
  keyFiles: string[];
  sessionCount: number;
  statusCounts: Record<CodeSnapshotStatus, number>;
  latestUpdatedAt: string;
  restoreHint: string;
};

export type MemoryDigest = {
  projectId: string;
  projectName: string;
  generatedAt: string;
  settings: {
    maxRetainedTurns: number;
    compressionStrategy: CompressionStrategy;
    ignorePaths: string[];
  };
  totalMemories: number;
  totalThreads: number;
  totalCompressionCount: number;
  items: MemoryDigestItem[];
  summary: string;
};

export type RequirementRestore = {
  requirement?: RequirementRecord;
  sessions: SessionMemory[];
  handoff: MemoryHandoff;
  compression?: MemoryCompressionRecord;
  summary: string;
};

export type TaskCodePointer = {
  path: string;
  reason: string;
  confidence: "low" | "medium" | "high";
  matchSource?: "path" | "content" | "path+content" | "memory";
  fileRole?: "runtime" | "ui" | "test" | "docs" | "config" | "memory" | "requirement" | "cli" | "unknown";
  matchedSignals?: string[];
};

export type TaskIntentKind = "bugfix" | "feature" | "refactor" | "review" | "test" | "docs" | "config" | "unknown";

export type TaskAnalysis = {
  intent: TaskIntentKind;
  ambiguity: "low" | "medium" | "high";
  confidence: "low" | "medium" | "high";
  summary: string;
  signals: string[];
  routingReason: string;
  shouldAskBeforeEdit: boolean;
  suggestedSearches: string[];
};

export type TaskSkillSuggestion = {
  id: string;
  name: string;
  reason: string;
  matchedSignals: string[];
  usageHint: string;
  localRuleNote: string;
  conflictRisk: RecommendationRisk;
  status: "recommended" | "enabled" | "disabled" | "ignored";
  loadPolicy: SkillContextLoadPolicy;
  selectionRevision: string;
  staleIfRevisionChanges: boolean;
  detailToolInput?: {
    skillId: string;
    selectionRevision: string;
  };
};

export type TaskMemorySuggestion = {
  memoryId: string;
  requirementId?: string;
  title: string;
  keywords: string[];
  reason: string;
  restoreTool: string;
};

export type PreparedTaskRequirementMatch = {
  requirementId: string;
  title: string;
  status: RequirementStatus;
  reason: string;
  keywords: string[];
  reviewCount: number;
  startWorkSegmentTool: string;
  recordDiffTool: string;
};

export type TaskExecutionStep = {
  order: number;
  title: string;
  action: string;
  reason: string;
  when: "always" | "if_missing_context" | "if_relevant_memory" | "if_relevant_skill" | "after_edit";
  tool?: string;
};

export type TaskGuardrail = {
  boundaryRequired: boolean;
  requirementId?: string;
  requirementTitle?: string;
  startWorkSegmentInput: {
    task: string;
    title: string;
    requirementId?: string;
  };
  recordCurrentDiffInput: {
    title: string;
    requirementId?: string;
  };
  finalResponseChecklist: string[];
};

export type PreparedTask = {
  projectId: string;
  projectName: string;
  generatedAt: string;
  taskAnalysis: TaskAnalysis;
  requirement: {
    originalInput: string;
    clarifiedGoal: string;
    missingQuestions: string[];
    acceptanceCriteria: string[];
  };
  codePointers: TaskCodePointer[];
  matchedRequirement: PreparedTaskRequirementMatch | null;
  skillSuggestions: TaskSkillSuggestion[];
  skillContext: SkillContextIndex;
  memorySuggestions: TaskMemorySuggestion[];
  memoryIndex: MemoryIndex;
  executionPlan: TaskExecutionStep[];
  guardrail: TaskGuardrail;
  agentInstructions: string;
};

export type BootstrapSession = {
  projectId: string;
  projectName: string;
  generatedAt: string;
  profile: ProjectProfile;
  settings: ProjectSettings;
  recommendations: ToolRecommendation[];
  capabilityCenter: CapabilityCenter;
  assembly: RuntimeAssembly;
  handoff: MemoryHandoff;
  memoryDigest: MemoryDigest;
  requirementDossier: RequirementDossier;
  workflow: {
    when: string;
    actions: string[];
  }[];
};

export type AgentHarnessClient = "generic" | "codex" | "claude";
export type AgentHarnessKind = "skill" | "command" | "prompt";

export type AgentHarnessFile = {
  client: AgentHarnessClient;
  kind: AgentHarnessKind;
  name: string;
  path: string;
};

export type AgentHarnessResult = {
  version: number;
  files: AgentHarnessFile[];
  skillNames: string[];
  commandNames: string[];
};

export type AgentConnectionClient = {
  client: AgentHarnessClient;
  label: string;
  files: AgentHarnessFile[];
  setupCommand: string;
  verificationCommands: string[];
  configFormat: "toml" | "json" | "local-files";
  configSnippet?: string;
};

export type AgentConnectionStep = {
  phase: string;
  trigger: string;
  mcpTools: string[];
  userBenefit: string;
};

export type AgentConnectionPackage = {
  repoPath: string;
  projectName: string;
  generatedAt: string;
  server: {
    name: string;
    transport: "stdio";
    command: string;
    args: string[];
    toolCount: number;
  };
  clients: AgentConnectionClient[];
  autoUseFlow: AgentConnectionStep[];
  requiredTools: string[];
  verificationCommands: string[];
  notes: string[];
};

export type ProjectReadinessStatus = "ready" | "attention";

export type ProjectReadinessItem = {
  id: "agent-connection" | "skill-path" | "change-review" | "memory-entry";
  title: string;
  status: ProjectReadinessStatus;
  summary: string;
  action: string;
  target: "connect" | "tools" | "review" | "memory" | "settings";
  signals: string[];
  nextSteps: string[];
  agentTools: string[];
  commands: string[];
  uiAction: {
    label: string;
    target: "connect" | "tools" | "review" | "memory" | "settings" | "overview";
    focusTarget?: string;
  };
};

export type ProjectReadiness = {
  repoPath: string;
  projectName: string;
  generatedAt: string;
  score: number;
  readyCount: number;
  attentionCount: number;
  summary: string;
  items: ProjectReadinessItem[];
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
  harness: AgentHarnessResult;
  bootstrap: BootstrapSession;
  nextCommands: string[];
};

export type ConnectionDoctorCheck = {
  id: string;
  label: string;
  ok: boolean;
  severity: "error" | "warn";
  detail: string;
  fix?: string;
};

export type ConnectionDoctorReport = {
  repoPath: string;
  projectName: string;
  generatedAt: string;
  toolCount: number;
  checks: ConnectionDoctorCheck[];
  errors: number;
  warnings: number;
  ready: boolean;
  summary: string;
  nextSteps: string[];
};

export type ProjectStatus = {
  repoPath: string;
  profilePath: string;
  memoryPath: string;
  memoryProtection: MemoryProtectionStatus;
  projectName: string;
  skills: string[];
  mcps: string[];
  readiness: ProjectReadiness;
};

export type MemoryProtectionFileStatus = {
  id: "memory" | "requirements" | "workSegments" | "agentActivity";
  label: string;
  path: string;
  exists: boolean;
  encrypted: boolean;
  algorithm?: string;
  version?: number;
};

export type MemoryProtectionStatus = {
  keyEnv: "SPECWEFT_MEMORY_KEY";
  keyConfigured: boolean;
  protectedFiles: number;
  plaintextFiles: number;
  missingFiles: number;
  files: MemoryProtectionFileStatus[];
  warnings: string[];
  summary: string;
};

export type MemoryProtectionResult = MemoryProtectionStatus & {
  migratedFiles: string[];
  createdFiles: string[];
  skippedFiles: string[];
};

export type RegisteredProject = {
  id: string;
  name: string;
  rootPath: string;
  languages: string[];
  frameworks: string[];
  lastOpenedAt: string;
};

export type ProjectRegistryFile = {
  version: number;
  activeProjectPath?: string;
  projects: RegisteredProject[];
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
  marketplace?: {
    author: string;
    githubUrl: string;
    path: string;
    branch: string;
    updatedAt: string;
    stars?: number;
    forks?: number;
  };
};

export type SkillDetail = {
  item: SkillRegistryItem;
  content: string;
};

export type SkillContextScope = "enabled" | "task" | "all";

export type SkillContextLoadPolicy = "metadata-only" | "read-on-demand" | "blocked";

export type SkillContextIndexItem = {
  id: string;
  name: string;
  description: string;
  source: PoolSource;
  tags: string[];
  risk: PoolRisk;
  status: CapabilityStatus;
  activationHints: string[];
  loadPolicy: SkillContextLoadPolicy;
  reason: string;
};

export type SkillContextPolicy = {
  loadMode: "lazy";
  requiresSelectionRevision: boolean;
  maxAutoLoadedSkills: number;
  invalidatesWhen: string[];
  staleInstruction: string;
};

export type SkillContextIndex = {
  repoPath: string;
  generatedAt: string;
  scope: SkillContextScope;
  selectionRevision: string;
  enabledSkillIds: string[];
  disabledSkillIds: string[];
  ignoredSkillIds: string[];
  allowedSkillIds: string[];
  metadataOnlySkillIds: string[];
  blockedSkillIds: string[];
  items: SkillContextIndexItem[];
  policy: SkillContextPolicy;
  summary: string;
};

export type SkillDetailAccessStatus = "ready" | "stale" | "blocked" | "missing";

export type SkillDetailAccess = {
  skillId: string;
  status: SkillDetailAccessStatus;
  currentSelectionRevision: string;
  expectedSelectionRevision?: string;
  item?: SkillRegistryItem;
  content?: string;
  reason: string;
  guidance: string[];
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
  timeoutMs?: number;
};

export type AssemblySkill = {
  id: string;
  path: string;
};

export type RuntimeAssembly = {
  mcpServers: Record<string, AssemblyMcpServer>;
  skills: AssemblySkill[];
  skillContext: SkillContextIndex;
};
