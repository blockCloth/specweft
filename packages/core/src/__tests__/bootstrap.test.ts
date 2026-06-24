import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
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
    const codexSkill = await readFile(
      path.join(repoPath, ".codex", "skills", "specweft-prepare-task", "SKILL.md"),
      "utf-8",
    );
    const claudeCommand = await readFile(
      path.join(repoPath, ".claude", "commands", "specweft", "review.md"),
      "utf-8",
    );

    assert.equal(result.profile.rootPath, repoPath);
    assert.deepEqual(result.enabled.mcps.map((item) => item.id), ["filesystem", "git"]);
    assert.deepEqual(result.enabled.skills.map((item) => item.id), ["diff-explainer", "test-planner"]);
    assert.ok(result.instructionPaths.some((filePath) => filePath.endsWith(".specweft/agent-instructions.md")));
    assert.ok(result.harness.files.some((file) => file.path.endsWith(".codex/skills/specweft-prepare-task/SKILL.md")));
    assert.ok(result.harness.files.some((file) => file.path.endsWith(".claude/commands/specweft/review.md")));
    assert.ok(result.harness.skillNames.includes("specweft-prepare-task"));
    assert.ok(result.harness.commandNames.includes("specweft-review"));
    assert.match(instruction, /specweft\.bootstrap_session/);
    assert.match(instruction, /specweft\.get_memory_digest/);
    assert.match(instruction, /specweft\.get_requirement_dossier/);
    assert.match(instruction, /specweft\.prepare_task/);
    assert.match(instruction, /specweft\.restore_requirement/);
    assert.match(instruction, /specweft\.start_work_segment/);
    assert.match(instruction, /specweft\.record_current_diff/);
    assert.match(instruction, /guardrail\.startWorkSegmentInput/);
    assert.match(instruction, /agentReview\.suggestedAgentResponse/);
    assert.match(claudeInstruction, /specweft\.bootstrap_session/);
    assert.match(claudeInstruction, /specweft\.get_memory_digest/);
    assert.match(claudeInstruction, /specweft\.get_requirement_dossier/);
    assert.match(claudeInstruction, /specweft\.prepare_task/);
    assert.match(claudeInstruction, /specweft\.start_work_segment/);
    assert.match(codexSkill, /specweft\.prepare_task/);
    assert.match(codexSkill, /specweft\.restore_requirement/);
    assert.match(codexSkill, /guardrail\.startWorkSegmentInput/);
    assert.match(codexSkill, /guardrail\.recordCurrentDiffInput/);
    assert.match(claudeCommand, /specweft\.record_current_diff/);
  } finally {
    delete process.env.SPECWEFT_HOME;
    await rm(home, { recursive: true, force: true });
    await rm(repoPath, { recursive: true, force: true });
  }
});

test("updates existing SpecWeft instruction blocks during init", async () => {
  const home = await mkdtemp(path.join(os.tmpdir(), "specweft-bootstrap-home-"));
  const repoPath = await mkdtemp(path.join(os.tmpdir(), "specweft-bootstrap-repo-"));

  try {
    process.env.SPECWEFT_HOME = home;
    await writeFile(
      path.join(repoPath, "AGENTS.md"),
      [
        "# Existing Agent Notes",
        "",
        "Keep this user-owned paragraph.",
        "",
        "<!-- SPECWEFT:START -->",
        "# Old SpecWeft Block",
        "",
        "Call `specweft.prepare_task` only.",
        "<!-- SPECWEFT:END -->",
        "",
        "Keep this footer.",
      ].join("\n"),
      "utf-8",
    );

    await initializeSpecWeftProject(repoPath);

    const instruction = await readFile(path.join(repoPath, "AGENTS.md"), "utf-8");
    assert.match(instruction, /Keep this user-owned paragraph/);
    assert.match(instruction, /Keep this footer/);
    assert.doesNotMatch(instruction, /Old SpecWeft Block/);
    assert.match(instruction, /specweft\.start_work_segment/);
    assert.match(instruction, /specweft\.record_current_diff/);
    assert.match(instruction, /guardrail\.recordCurrentDiffInput/);
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
    assert.equal(bootstrap.memoryDigest.totalMemories, 0);
    assert.equal(bootstrap.requirementDossier.totalSessions, 0);
    assert.ok(bootstrap.workflow.some((item) => item.actions.join(" ").includes("prepare_task")));
    assert.ok(bootstrap.workflow.some((item) => item.actions.join(" ").includes("get_memory_digest")));
    assert.ok(bootstrap.workflow.some((item) => item.actions.join(" ").includes("get_requirement_dossier")));
    assert.ok(bootstrap.workflow.some((item) => item.actions.join(" ").includes("restore_requirement")));
    assert.ok(bootstrap.workflow.some((item) => item.actions.join(" ").includes("record_current_diff")));
    assert.ok(bootstrap.workflow.some((item) => item.actions.join(" ").includes("get_recording_status")));
    assert.ok(bootstrap.workflow.some((item) => item.actions.join(" ").includes("guardrail.startWorkSegmentInput")));
    assert.ok(bootstrap.workflow.some((item) => item.actions.join(" ").includes("agentReview.suggestedAgentResponse")));
  } finally {
    delete process.env.SPECWEFT_HOME;
    await rm(home, { recursive: true, force: true });
    await rm(repoPath, { recursive: true, force: true });
  }
});
