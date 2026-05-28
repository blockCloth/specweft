import path from "node:path";
import { projectConfigDir } from "../utils/path.js";

export function mcpProjectSelectionPath(repoPath: string): string {
  // projectConfigDir(repoPath) 已经是 <repo>/.specweft，不要再拼 specweft。
  return path.join(projectConfigDir(repoPath), "mcp.json");
}

export function skillProjectSelectionPath(repoPath: string): string {
  return path.join(projectConfigDir(repoPath), "skills.json");
}
