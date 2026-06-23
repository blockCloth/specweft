// core 的公共出口。CLI/Web/MCP 都应该从这里引用能力，避免深入依赖内部目录。
export type {
  DiffSummary,
  CodeSnapshotState,
  CodeSnapshotStatus,
  GitChangeSnapshot,
  MemoryTimeline,
  RequirementDossier,
  RequirementDossierItem,
  RequirementDossierSession,
  MemoryDigest,
  MemoryDigestItem,
  MemoryIndex,
  MemoryIndexItem,
  ProjectProfile,
  PoolInitResult,
  ReviewDraft,
  ReviewOverview,
  ReviewOverviewBatch,
  ReviewRequirementBlock,
  ReviewRequirementBlockKind,
  ReviewReport,
  SourceReadingItem,
  RecordingStatus,
  PreparedTask,
  RequirementRestore,
  RequirementTimelineItem,
  RegistryFile,
  SessionMemory,
  McpManifest,
  McpRegistryItem,
  ProjectSelectionFile,
  ProjectSelectionItem,
  ProjectSelectionStatus,
  RuntimeAssembly,
  SkillDetail,
  SkillRegistryItem,
  ToolRecommendation,
  ProjectStatus,
  RegisteredProject,
  ProjectRegistryFile,
  RequirementFile,
  RequirementInput,
  RequirementRecord,
  RequirementReviewLink,
  RequirementStatus,
  WorkSegment,
  WorkSegmentCompletionInput,
  WorkSegmentFile,
  WorkSegmentInput,
  WorkSegmentStatus,
  WorkSegmentStatusReport,
  TaskCodePointer,
  TaskMemorySuggestion,
  PreparedTaskRequirementMatch,
  TaskSkillSuggestion,
  MarketplaceSkill,
  MarketplaceSkillCandidate,
  MarketplaceSkillInstallResult,
  MarketplaceSkillPreview,
  MarketplaceSkillSearchResult,
  MarketplaceConflictLevel,
  MarketplaceMcp,
  MarketplaceMcpCandidate,
  MarketplaceMcpInstallResult,
  MarketplaceMcpSearchResult,
  MemoryHandoff,
  BootstrapSession,
  SpecWeftInitResult,
  CapabilityCenter,
  CapabilityKind,
  CapabilityManifest,
  CapabilityStatus,
} from "./schemas/types.js";

export { resolveRepoPath } from "./utils/path.js";
export {
  createBootstrapSession,
  initializeSpecWeftProject,
} from "./bootstrap/bootstrap-session.js";
export { initializeProject, scanProject } from "./scanner/project-scanner.js";
export { createCapabilityCenter } from "./capabilities/capability-center.js";
export {
  listRegisteredProjects,
  registerProject,
  setActiveProject,
} from "./projects/project-registry.js";
export {
  attachReviewToRequirement,
  createRequirement,
  getActiveRequirement,
  listRequirements,
  resolveRequirementForReview,
  setActiveRequirement,
} from "./requirements/requirement-manager.js";
export { recommendForProject } from "./recommendations/recommender.js";
export {
  createMarketplaceKeywords,
  recommendMarketplaceSkills,
} from "./marketplace/skills-marketplace.js";
export {
  createMarketplaceMcpKeywords,
  createMcpManifestFromCandidate,
  recommendMarketplaceMcps,
} from "./marketplace/mcp-marketplace.js";
export {
  analyzeCurrentDiff,
  createReviewDraft,
  createReviewReport,
} from "./diff/diff-analyzer.js";
export {
  createGitChangeSnapshot,
  evaluateCodeSnapshot,
} from "./git/change-snapshot.js";
export {
  createMemoryIndex,
  createMemoryDigest,
  createMemoryHandoff,
  listSessionMemories,
  recallSessions,
  restoreRequirementMemory,
  saveSessionMemory,
} from "./memory/session-memory.js";
export { createRequirementDossier } from "./memory/requirement-dossier.js";
export {
  completeWorkSegment,
  createWorkSegmentStatus,
  getActiveWorkSegment,
  listWorkSegments,
  startWorkSegment,
} from "./work-segments/work-segment-manager.js";
export {
  prepareTask,
  recommendSkillsForTask,
} from "./task/task-preparer.js";
export { createMemoryTimeline } from "./memory/memory-timeline.js";
export { getRecordingStatus } from "./recording/recording-status.js";
export { currentProjectStatus } from "./status/project-status.js";
export {
  SPECWEFT_MCP_TOOL_NAMES,
  type SpecWeftMcpToolName,
} from "./mcp/tool-names.js";
export {
  createMarketplaceMcpId,
  createMarketplaceSkillId,
  initializeGlobalPools,
  installMarketplaceMcp,
  installMarketplaceSkill,
  listMcpPool,
  listSkillPool,
  previewMarketplaceSkill,
  readSkillDetail,
} from "./pool/pool-manager.js";
export {
  applyProjectMcp,
  applyProjectSkill,
  disableProjectMcp,
  disableProjectSkill,
  ignoreProjectMcp,
  ignoreProjectSkill,
  readProjectMcpSelection,
  readProjectSkillSelection,
} from "./selection/selection-manager.js";
export { createRuntimeAssembly } from "./assembly/runtime-assembly.js";
