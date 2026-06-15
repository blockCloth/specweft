// core 的公共出口。CLI/Web/MCP 都应该从这里引用能力，避免深入依赖内部目录。
export type {
  DiffSummary,
  ProjectProfile,
  PoolInitResult,
  ReviewDraft,
  ReviewReport,
  RegistryFile,
  SessionMemory,
  McpManifest,
  McpRegistryItem,
  ProjectSelectionFile,
  ProjectSelectionItem,
  ProjectSelectionStatus,
  RuntimeAssembly,
  SkillRegistryItem,
  ToolRecommendation,
  ProjectStatus,
  RegisteredProject,
  ProjectRegistryFile,
  MarketplaceSkill,
  MarketplaceSkillCandidate,
  MarketplaceSkillInstallResult,
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
  createMemoryHandoff,
  recallSessions,
  saveSessionMemory,
} from "./memory/session-memory.js";
export { currentProjectStatus } from "./status/project-status.js";
export {
  createMarketplaceMcpId,
  createMarketplaceSkillId,
  initializeGlobalPools,
  installMarketplaceMcp,
  installMarketplaceSkill,
  listMcpPool,
  listSkillPool,
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
