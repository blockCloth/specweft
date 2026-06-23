import {
  initializeGlobalPools,
  listMcpPool,
  listSkillPool,
} from "@specweft/core";
import { printJson } from "../output.js";

export async function runPool(subcommand?: string, target?: string): Promise<void> {
  if (subcommand === "init") {
    const result = await initializeGlobalPools();
    printJson(result);
    return;
  }

  if (subcommand === "list" && target === "mcp") {
    const pool = await listMcpPool();
    printJson(pool);
    return;
  }

  if (subcommand === "list" && target === "skills") {
    const pool = await listSkillPool();
    printJson(pool);
    return;
  }

  throw new Error("pool 用法：specweft pool init | specweft pool list mcp | specweft pool list skills");
}
