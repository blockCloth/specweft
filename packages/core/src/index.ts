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
} from "./schemas/types.js";

export { resolveRepoPath } from "./utils/path.js";
export { initializeProject, scanProject } from "./scanner/project-scanner.js";
export { recommendForProject } from "./recommendations/recommender.js";
export {
  analyzeCurrentDiff,
  createReviewDraft,
  createReviewReport,
} from "./diff/diff-analyzer.js";
export { recallSessions, saveSessionMemory } from "./memory/session-memory.js";
export { currentProjectStatus } from "./status/project-status.js";
export { initializeGlobalPools, listMcpPool, listSkillPool } from "./pool/pool-manager.js";
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
