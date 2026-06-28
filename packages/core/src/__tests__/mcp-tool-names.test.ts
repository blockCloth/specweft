import assert from "node:assert/strict";
import test from "node:test";
import { SPECWEFT_MCP_TOOL_NAMES } from "../mcp/tool-names.js";

test("exports a stable, deduplicated SpecWeft MCP tool list", () => {
  const toolNames = [...SPECWEFT_MCP_TOOL_NAMES];

  assert.equal(new Set(toolNames).size, toolNames.length);
  assert.ok(toolNames.includes("specweft.bootstrap_session"));
  assert.ok(toolNames.includes("specweft.prepare_task"));
  assert.ok(toolNames.includes("specweft.get_skill_context_index"));
  assert.ok(toolNames.includes("specweft.read_skill_detail"));
  assert.ok(toolNames.includes("specweft.get_project_readiness"));
  assert.ok(toolNames.includes("specweft.get_project_settings"));
  assert.ok(toolNames.includes("specweft.update_project_settings"));
  assert.ok(toolNames.includes("specweft.get_agent_activity"));
  assert.ok(toolNames.includes("specweft.get_memory_digest"));
  assert.ok(toolNames.includes("specweft.get_requirement_dossier"));
  assert.ok(toolNames.includes("specweft.start_work_segment"));
  assert.ok(toolNames.includes("specweft.record_current_diff"));
  assert.ok(toolNames.every((toolName) => toolName.startsWith("specweft.")));
});
