import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { initializeGlobalPools } from "../pool/pool-manager.js";
import {
  applyProjectSkill,
  disableProjectSkill,
  ignoreProjectSkill,
} from "../selection/selection-manager.js";
import {
  createSkillContextIndex,
  readSkillDetailForContext,
} from "../skills/skill-context.js";

test("creates a metadata-only Skill context with lazy detail reads", async () => {
  const home = await mkdtemp(path.join(os.tmpdir(), "specweft-skill-context-home-"));
  const repoPath = await mkdtemp(path.join(os.tmpdir(), "specweft-skill-context-repo-"));

  try {
    process.env.SPECWEFT_HOME = home;
    await writeFile(path.join(repoPath, "package.json"), JSON.stringify({ name: "context-demo" }), "utf-8");
    await initializeGlobalPools();
    await applyProjectSkill(repoPath, "diff-explainer");
    await disableProjectSkill(repoPath, "test-planner");

    const context = await createSkillContextIndex(repoPath, { scope: "all" });

    assert.equal(context.policy.loadMode, "lazy");
    assert.equal(context.policy.requiresSelectionRevision, true);
    assert.ok(context.allowedSkillIds.includes("diff-explainer"));
    assert.ok(context.blockedSkillIds.includes("test-planner"));
    assert.doesNotMatch(JSON.stringify(context), /# Diff 讲解器/);

    const detail = await readSkillDetailForContext(repoPath, "diff-explainer", context.selectionRevision);
    assert.equal(detail.status, "ready");
    assert.match(detail.content ?? "", /# Diff 讲解器/);

    const blocked = await readSkillDetailForContext(repoPath, "test-planner", context.selectionRevision);
    assert.equal(blocked.status, "blocked");
    assert.equal(blocked.content, undefined);
  } finally {
    delete process.env.SPECWEFT_HOME;
    await rm(home, { recursive: true, force: true });
    await rm(repoPath, { recursive: true, force: true });
  }
});

test("marks previously loaded Skill context stale after selection changes", async () => {
  const home = await mkdtemp(path.join(os.tmpdir(), "specweft-skill-context-stale-home-"));
  const repoPath = await mkdtemp(path.join(os.tmpdir(), "specweft-skill-context-stale-repo-"));

  try {
    process.env.SPECWEFT_HOME = home;
    await writeFile(path.join(repoPath, "package.json"), JSON.stringify({ name: "stale-demo" }), "utf-8");
    await initializeGlobalPools();
    await applyProjectSkill(repoPath, "diff-explainer");

    const firstContext = await createSkillContextIndex(repoPath, { scope: "enabled" });
    await disableProjectSkill(repoPath, "diff-explainer");
    const staleDetail = await readSkillDetailForContext(
      repoPath,
      "diff-explainer",
      firstContext.selectionRevision,
    );
    const latestContext = await createSkillContextIndex(repoPath, { scope: "enabled" });

    assert.equal(staleDetail.status, "stale");
    assert.notEqual(latestContext.selectionRevision, firstContext.selectionRevision);
    assert.equal(staleDetail.content, undefined);
  } finally {
    delete process.env.SPECWEFT_HOME;
    await rm(home, { recursive: true, force: true });
    await rm(repoPath, { recursive: true, force: true });
  }
});

test("keeps ignored Skills out of enabled and task context", async () => {
  const home = await mkdtemp(path.join(os.tmpdir(), "specweft-skill-context-ignore-home-"));
  const repoPath = await mkdtemp(path.join(os.tmpdir(), "specweft-skill-context-ignore-repo-"));

  try {
    process.env.SPECWEFT_HOME = home;
    await writeFile(path.join(repoPath, "package.json"), JSON.stringify({ name: "ignore-demo" }), "utf-8");
    await initializeGlobalPools();
    await ignoreProjectSkill(repoPath, "test-planner");

    const enabledContext = await createSkillContextIndex(repoPath, { scope: "enabled" });
    const taskContext = await createSkillContextIndex(repoPath, {
      scope: "task",
      skillIds: ["test-planner"],
    });

    assert.ok(!enabledContext.items.some((item) => item.id === "test-planner"));
    assert.ok(!taskContext.items.some((item) => item.id === "test-planner"));
  } finally {
    delete process.env.SPECWEFT_HOME;
    await rm(home, { recursive: true, force: true });
    await rm(repoPath, { recursive: true, force: true });
  }
});
