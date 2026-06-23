import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  attachReviewToRequirement,
  createRequirement,
  getActiveRequirement,
  listRequirements,
  setActiveRequirement,
} from "../requirements/requirement-manager.js";

test("creates, activates, and updates project requirements", async () => {
  const repoPath = await mkdtemp(path.join(os.tmpdir(), "specweft-requirement-test-"));

  try {
    const first = await createRequirement(repoPath, {
      projectId: "project",
      title: "Skill detail preview",
      keywords: ["skill", "preview"],
    });
    const second = await createRequirement(repoPath, {
      projectId: "project",
      title: "MCP recommendation",
      keywords: ["mcp"],
    });
    const activeAfterCreate = await getActiveRequirement(repoPath);

    assert.equal(activeAfterCreate?.id, second.id);

    await setActiveRequirement(repoPath, first.id);
    const activeAfterSwitch = await getActiveRequirement(repoPath);
    assert.equal(activeAfterSwitch?.id, first.id);

    const updated = await attachReviewToRequirement(repoPath, first.id, {
      reviewPath: "/tmp/review.md",
      memoryId: "memory-1",
      summary: "Added a detail panel.",
      keywords: ["detail"],
    });
    const file = await listRequirements(repoPath);

    assert.equal(updated.reviewCount, 1);
    assert.equal(updated.lastMemoryId, "memory-1");
    assert.ok(updated.keywords.includes("detail"));
    assert.equal(file.activeRequirementId, first.id);
  } finally {
    await rm(repoPath, { recursive: true, force: true });
  }
});
