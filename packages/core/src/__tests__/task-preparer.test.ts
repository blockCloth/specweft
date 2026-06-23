import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { initializeGlobalPools } from "../pool/pool-manager.js";
import { applyProjectSkill } from "../selection/selection-manager.js";
import { saveSessionMemory } from "../memory/session-memory.js";
import { prepareTask, recommendSkillsForTask } from "../task/task-preparer.js";
import { scanProject } from "../scanner/project-scanner.js";
import { createRequirement } from "../requirements/requirement-manager.js";

test("prepares task context with file pointers, Skill suggestions, and memory matches", async () => {
  const home = await mkdtemp(path.join(os.tmpdir(), "specweft-task-home-"));
  const repoPath = await mkdtemp(path.join(os.tmpdir(), "specweft-task-repo-"));

  try {
    process.env.SPECWEFT_HOME = home;
    await writeFile(path.join(repoPath, "package.json"), JSON.stringify({
      name: "demo-app",
      scripts: {
        test: "vitest",
      },
      dependencies: {
        react: "latest",
      },
    }), "utf-8");
    await writeFile(path.join(repoPath, "login-service.ts"), "export function login() {}\n", "utf-8");
    await initializeGlobalPools();
    await applyProjectSkill(repoPath, "diff-explainer");
    const requirement = await createRequirement(repoPath, {
      projectId: "project",
      title: "登录校验优化",
      keywords: ["登录", "校验", "login", "validation"],
      summary: "持续优化登录校验逻辑和相关提示。",
    });
    await saveSessionMemory(repoPath, {
      projectId: "project",
      requirementId: requirement.id,
      requirementTitle: requirement.title,
      title: "Login validation review",
      keywords: ["login", "validation"],
      summary: "Adjusted login validation and reviewed related UI behavior.",
      changedFiles: ["login-service.ts"],
    });

    const prepared = await prepareTask(repoPath, "帮我继续优化登录校验");

    assert.equal(prepared.projectName, "demo-app");
    assert.match(prepared.requirement.clarifiedGoal, /登录校验/);
    assert.equal(prepared.taskAnalysis.intent, "refactor");
    assert.equal(prepared.taskAnalysis.ambiguity, "low");
    assert.equal(prepared.matchedRequirement?.requirementId, requirement.id);
    assert.match(prepared.matchedRequirement?.recordDiffTool ?? "", new RegExp(requirement.id));
    assert.ok(prepared.codePointers.some((item) => item.path === "login-service.ts"));
    assert.ok(prepared.skillSuggestions.some((item) => item.id === "diff-explainer"));
    assert.ok(prepared.memorySuggestions.some((item) => item.title === "Login validation review"));
    assert.ok(prepared.executionPlan.some((item) => item.tool === "specweft.start_work_segment"));
    assert.ok(prepared.executionPlan.some((item) => item.action.includes(requirement.id)));
    assert.ok(prepared.executionPlan.some((item) => item.tool === "specweft.restore_requirement"));
    assert.ok(prepared.executionPlan.some((item) => item.tool === "specweft.record_current_diff"));
    assert.ok(prepared.executionPlan.some((item) => item.title === "先读相关源码"));
    assert.match(prepared.agentInstructions, /specweft\.record_current_diff/);
    assert.match(prepared.agentInstructions, new RegExp(requirement.id));
    assert.match(prepared.agentInstructions, /Execution plan/);
  } finally {
    delete process.env.SPECWEFT_HOME;
    await rm(home, { recursive: true, force: true });
    await rm(repoPath, { recursive: true, force: true });
  }
});

test("locates related files by source content and asks before vague edits", async () => {
  const home = await mkdtemp(path.join(os.tmpdir(), "specweft-task-content-home-"));
  const repoPath = await mkdtemp(path.join(os.tmpdir(), "specweft-task-content-repo-"));

  try {
    process.env.SPECWEFT_HOME = home;
    await writeFile(path.join(repoPath, "package.json"), JSON.stringify({ name: "content-demo" }), "utf-8");
    await writeFile(
      path.join(repoPath, "service.ts"),
      [
        "export function validateCredentials(input: string) {",
        "  // login validation rejects empty passwords",
        "  return input.length > 0;",
        "}",
      ].join("\n"),
      "utf-8",
    );
    await initializeGlobalPools();

    const prepared = await prepareTask(repoPath, "优化一下");
    const contentPrepared = await prepareTask(repoPath, "优化登录校验空密码提示");

    assert.equal(prepared.taskAnalysis.ambiguity, "high");
    assert.equal(prepared.taskAnalysis.shouldAskBeforeEdit, true);
    assert.ok(prepared.requirement.missingQuestions.length > 0);
    assert.ok(prepared.executionPlan.some((item) => item.title === "补齐需求边界"));

    const pointer = contentPrepared.codePointers.find((item) => item.path === "service.ts");
    assert.ok(pointer);
    assert.match(pointer?.matchSource ?? "", /content|path\+content/);
    assert.match(pointer?.preview ?? "", /login validation/);
    assert.ok(pointer?.matchedSignals?.some((signal) => signal.startsWith("content:")));
  } finally {
    delete process.env.SPECWEFT_HOME;
    await rm(home, { recursive: true, force: true });
    await rm(repoPath, { recursive: true, force: true });
  }
});

test("prioritizes domain terms over noisy Chinese token windows", async () => {
  const home = await mkdtemp(path.join(os.tmpdir(), "specweft-task-domain-home-"));
  const repoPath = await mkdtemp(path.join(os.tmpdir(), "specweft-task-domain-repo-"));
  const memoryDir = path.join(repoPath, "packages", "core", "src", "memory");
  const commandDir = path.join(repoPath, "packages", "cli", "src", "commands");

  try {
    process.env.SPECWEFT_HOME = home;
    await writeFile(path.join(repoPath, "package.json"), JSON.stringify({ name: "domain-demo" }), "utf-8");
    await Promise.all([
      mkdir(memoryDir, { recursive: true }),
      mkdir(commandDir, { recursive: true }),
    ]);
    await writeFile(
      path.join(memoryDir, "requirement-dossier.ts"),
      "export function renderRequirementDossier() { return '需求档案 memory display'; }\n",
      "utf-8",
    );
    await writeFile(
      path.join(commandDir, "handoff.ts"),
      "export function createMemoryHandoff() { return 'memory handoff'; }\n",
      "utf-8",
    );
    await initializeGlobalPools();

    const prepared = await prepareTask(repoPath, "优化需求档案里的记忆展示");

    assert.equal(prepared.codePointers[0]?.path, "packages/core/src/memory/requirement-dossier.ts");
    assert.ok(prepared.taskAnalysis.suggestedSearches.includes("需求档案"));
    assert.ok(!prepared.taskAnalysis.suggestedSearches.some((token) => token === "化需" || token === "求档"));
  } finally {
    delete process.env.SPECWEFT_HOME;
    await rm(home, { recursive: true, force: true });
    await rm(repoPath, { recursive: true, force: true });
  }
});

test("prioritizes UI entrypoints over tests for display-oriented tasks", async () => {
  const home = await mkdtemp(path.join(os.tmpdir(), "specweft-task-ui-home-"));
  const repoPath = await mkdtemp(path.join(os.tmpdir(), "specweft-task-ui-repo-"));
  const webDir = path.join(repoPath, "packages", "web", "src");
  const testDir = path.join(repoPath, "packages", "core", "src", "__tests__");

  try {
    process.env.SPECWEFT_HOME = home;
    await writeFile(path.join(repoPath, "package.json"), JSON.stringify({ name: "ui-demo" }), "utf-8");
    await Promise.all([
      mkdir(webDir, { recursive: true }),
      mkdir(testDir, { recursive: true }),
    ]);
    await writeFile(
      path.join(webDir, "ui.ts"),
      "export function renderRequirementDossier() { return '需求档案 记忆 展示 render ui'; }\n",
      "utf-8",
    );
    await writeFile(
      path.join(testDir, "memory.test.ts"),
      "test('requirement dossier memory display', () => {});\n",
      "utf-8",
    );
    await initializeGlobalPools();

    const prepared = await prepareTask(repoPath, "优化需求档案里的记忆展示");

    assert.equal(prepared.codePointers[0]?.path, "packages/web/src/ui.ts");
    assert.equal(prepared.codePointers[0]?.fileRole, "ui");
    assert.notEqual(prepared.codePointers[0]?.fileRole, "test");
  } finally {
    delete process.env.SPECWEFT_HOME;
    await rm(home, { recursive: true, force: true });
    await rm(repoPath, { recursive: true, force: true });
  }
});

test("does not attach an unrelated active requirement to a new task", async () => {
  const home = await mkdtemp(path.join(os.tmpdir(), "specweft-task-unrelated-home-"));
  const repoPath = await mkdtemp(path.join(os.tmpdir(), "specweft-task-unrelated-repo-"));

  try {
    process.env.SPECWEFT_HOME = home;
    await writeFile(path.join(repoPath, "package.json"), JSON.stringify({ name: "demo-app" }), "utf-8");
    await initializeGlobalPools();
    await createRequirement(repoPath, {
      projectId: "project",
      title: "Memory timeline",
      keywords: ["memory", "timeline"],
    });

    const prepared = await prepareTask(repoPath, "帮我优化登录校验");

    assert.doesNotMatch(prepared.requirement.clarifiedGoal, /Memory timeline/);
    assert.equal(prepared.memorySuggestions.length, 0);
    assert.ok(prepared.executionPlan.some((item) => item.title === "先定位模块" || item.title === "先读相关源码"));
  } finally {
    delete process.env.SPECWEFT_HOME;
    await rm(home, { recursive: true, force: true });
    await rm(repoPath, { recursive: true, force: true });
  }
});

test("recommends task Skills without requiring MCP installation", async () => {
  const home = await mkdtemp(path.join(os.tmpdir(), "specweft-skill-router-home-"));
  const repoPath = await mkdtemp(path.join(os.tmpdir(), "specweft-skill-router-repo-"));

  try {
    process.env.SPECWEFT_HOME = home;
    await writeFile(path.join(repoPath, "package.json"), JSON.stringify({
      name: "review-demo",
      scripts: {},
    }), "utf-8");
    await initializeGlobalPools();
    const profile = await scanProject(repoPath);
    const suggestions = await recommendSkillsForTask(profile, repoPath, "讲解这次 diff 并给我 review 清单");

    assert.ok(suggestions.length > 0);
    assert.equal(suggestions[0]?.id, "diff-explainer");
    assert.equal(suggestions[0]?.status, "recommended");
  } finally {
    delete process.env.SPECWEFT_HOME;
    await rm(home, { recursive: true, force: true });
    await rm(repoPath, { recursive: true, force: true });
  }
});
