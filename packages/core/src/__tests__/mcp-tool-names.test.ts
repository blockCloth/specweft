import assert from "node:assert/strict";
import test from "node:test";
import { SPECWEFT_MCP_TOOL_NAMES } from "../mcp/tool-names.js";

test("exports a stable, deduplicated SpecWeft MCP tool list", () => {
  const toolNames = [...SPECWEFT_MCP_TOOL_NAMES];

  assert.equal(new Set(toolNames).size, toolNames.length);
  assert.ok(toolNames.includes("specweft.bootstrap_session"));
  assert.ok(toolNames.includes("specweft.prepare_task"));
  assert.ok(toolNames.includes("specweft.get_memory_digest"));
  assert.ok(toolNames.includes("specweft.get_requirement_dossier"));
  assert.ok(toolNames.includes("specweft.start_work_segment"));
  assert.ok(toolNames.includes("specweft.record_current_diff"));
  assert.ok(toolNames.every((toolName) => toolName.startsWith("specweft.")));
});
