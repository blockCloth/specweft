import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  createBootstrapSession,
  initializeSpecWeftProject,
} from "../bootstrap/bootstrap-session.js";

test("initializes project for agent bootstrap workflow", async () => {
  const home = await mkdtemp(path.join(os.tmpdir(), "specweft-bootstrap-home-"));
  const repoPath = await mkdtemp(path.join(os.tmpdir(), "specweft-bootstrap-repo-"));

  try {
    process.env.SPECWEFT_HOME = home;
    const result = await initializeSpecWeftProject(repoPath);
    const instruction = await readFile(path.join(repoPath, "AGENTS.md"), "utf-8");
    const claudeInstruction = await readFile(path.join(repoPath, "CLAUDE.md"), "utf-8");

    assert.equal(result.profile.rootPath, repoPath);
    assert.deepEqual(result.enabled.mcps.map((item) => item.id), ["filesystem", "git"]);
    assert.deepEqual(result.enabled.skills.map((item) => item.id), ["diff-explainer", "test-planner"]);
    assert.ok(result.instructionPaths.some((filePath) => filePath.endsWith(".specweft/agent-instructions.md")));
    assert.match(instruction, /specweft\.bootstrap_session/);
    assert.match(claudeInstruction, /specweft\.bootstrap_session/);
  } finally {
    delete process.env.SPECWEFT_HOME;
    await rm(home, { recursive: true, force: true });
    await rm(repoPath, { recursive: true, force: true });
  }
});

test("creates bootstrap session with profile, assembly, recommendations, and workflow", async () => {
  const home = await mkdtemp(path.join(os.tmpdir(), "specweft-bootstrap-home-"));
  const repoPath = await mkdtemp(path.join(os.tmpdir(), "specweft-bootstrap-repo-"));

  try {
    process.env.SPECWEFT_HOME = home;
    await initializeSpecWeftProject(repoPath);
    const bootstrap = await createBootstrapSession(repoPath);

    assert.equal(bootstrap.projectName, path.basename(repoPath));
    assert.ok(bootstrap.recommendations.length >= 4);
    assert.ok(Object.keys(bootstrap.assembly.mcpServers).includes("filesystem"));
    assert.ok(bootstrap.assembly.skills.some((skill) => skill.id === "diff-explainer"));
    assert.ok(bootstrap.workflow.some((item) => item.actions.join(" ").includes("review_current_diff")));
  } finally {
    delete process.env.SPECWEFT_HOME;
    await rm(home, { recursive: true, force: true });
    await rm(repoPath, { recursive: true, force: true });
  }
});
