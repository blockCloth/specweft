import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, unlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import test from "node:test";
import { createGitChangeSnapshot } from "../git/change-snapshot.js";
import { createMemoryTimeline } from "../memory/memory-timeline.js";
import { createRequirementDossier } from "../memory/requirement-dossier.js";
import {
  createMemoryDigest,
  createMemoryIndex,
  createMemoryHandoff,
  recallSessions,
  restoreRequirementMemory,
  saveSessionMemory,
} from "../memory/session-memory.js";
import { getRecordingStatus } from "../recording/recording-status.js";
import { createRequirement } from "../requirements/requirement-manager.js";
import type { ProjectProfile } from "../schemas/types.js";

const execFileAsync = promisify(execFile);

test("creates a keyword-based memory handoff prompt", async () => {
  const repoPath = await mkdtemp(path.join(os.tmpdir(), "specweft-memory-test-"));

  try {
    await saveSessionMemory(repoPath, {
      projectId: "project",
      title: "Review memory handoff UI",
      keywords: ["memory", "handoff", "ui"],
      summary: "Added a handoff card that helps a new thread inherit recent context.",
      changedFiles: ["packages/web/src/ui.ts", "packages/core/src/memory/session-memory.ts"],
      nextThreadPrompt: "Continue from the memory UI and verify the handoff prompt.",
    });

    const sessions = await recallSessions(repoPath, "handoff");
    const handoff = await createMemoryHandoff(repoPath, profile(repoPath), "handoff");

    assert.equal(sessions.length, 1);
    assert.equal(handoff.sessions.length, 1);
    assert.match(handoff.summary, /Recovered 1 recent SpecWeft memory/);
    assert.match(handoff.prompt, /Continue from this SpecWeft handoff/);
    assert.match(handoff.prompt, /packages\/web\/src\/ui\.ts/);
    assert.ok(handoff.keywords.includes("handoff"));
  } finally {
    await rm(repoPath, { recursive: true, force: true });
  }
});

test("creates a requirement timeline with code status counts", async () => {
  const repoPath = await mkdtemp(path.join(os.tmpdir(), "specweft-memory-timeline-"));

  try {
    const requirement = await createRequirement(repoPath, {
      projectId: "project",
      title: "Timeline UI",
      keywords: ["timeline"],
    });

    await saveSessionMemory(repoPath, {
      projectId: "project",
      requirementId: requirement.id,
      requirementTitle: requirement.title,
      title: "Timeline review",
      keywords: ["timeline"],
      summary: "Added timeline cards.",
      changedFiles: ["packages/web/src/ui.ts"],
    });

    const timeline = await createMemoryTimeline(repoPath, profile(repoPath));

    assert.equal(timeline.summary.requirements, 1);
    assert.equal(timeline.summary.sessions, 1);
    assert.equal(timeline.items[0]?.requirement.id, requirement.id);
    assert.equal(timeline.items[0]?.sessions.length, 1);
    assert.equal(timeline.items[0]?.statusCounts.unknown, 1);
  } finally {
    await rm(repoPath, { recursive: true, force: true });
  }
});

test("creates a requirement dossier that groups repeated requirement reviews", async () => {
  const repoPath = await mkdtemp(path.join(os.tmpdir(), "specweft-requirement-dossier-"));

  try {
    const requirement = await createRequirement(repoPath, {
      projectId: "project",
      title: "Review explanation UX",
      keywords: ["review", "explanation"],
      summary: "Help users understand code changes after AI edits.",
    });

    await saveSessionMemory(repoPath, {
      projectId: "project",
      requirementId: requirement.id,
      requirementTitle: requirement.title,
      title: "First review pass",
      keywords: ["review", "grouping"],
      summary: "Grouped changed files by requirement.",
      changedFiles: ["packages/core/src/diff/diff-analyzer.ts", "packages/web/src/ui.ts"],
    });
    await saveSessionMemory(repoPath, {
      projectId: "project",
      requirementId: requirement.id,
      requirementTitle: requirement.title,
      title: "Second review pass",
      keywords: ["review", "dossier"],
      summary: "Added a requirement dossier for repeated changes.",
      changedFiles: ["packages/core/src/memory/requirement-dossier.ts", "packages/web/src/ui.ts"],
    });

    const dossier = await createRequirementDossier(repoPath, profile(repoPath));
    const fullDossier = await createRequirementDossier(repoPath, profile(repoPath), {
      includeSessions: true,
    });
    const item = dossier.items.find((candidate) => candidate.requirementId === requirement.id);
    const fullItem = fullDossier.items.find((candidate) => candidate.requirementId === requirement.id);

    assert.equal(dossier.totalRequirements, 1);
    assert.equal(dossier.totalSessions, 2);
    assert.ok(item);
    assert.equal(item?.sessionCount, 2);
    assert.equal(item?.sessions.length, 0);
    assert.equal(item?.sessionsOmitted, 2);
    assert.equal(item?.active, true);
    assert.match(item?.summary ?? "", /记录 2 次修改/);
    assert.ok(item?.keyFiles.includes("packages/web/src/ui.ts"));
    assert.match(item?.restoreHint ?? "", /restore_requirement/);
    assert.equal(fullItem?.sessions.length, 2);
    assert.equal(fullItem?.sessionsOmitted, 0);
    assert.equal(fullItem?.sessions[0]?.title, "Second review pass");
  } finally {
    await rm(repoPath, { recursive: true, force: true });
  }
});

test("creates a lightweight memory index and restores requirement memory on demand", async () => {
  const repoPath = await mkdtemp(path.join(os.tmpdir(), "specweft-memory-index-"));

  try {
    const requirement = await createRequirement(repoPath, {
      projectId: "project",
      title: "Login cleanup",
      keywords: ["login", "cleanup"],
    });

    await saveSessionMemory(repoPath, {
      projectId: "project",
      requirementId: requirement.id,
      requirementTitle: requirement.title,
      title: "Login cleanup review",
      keywords: ["login", "cleanup"],
      summary: "Removed confusing login branching and kept the review notes scoped.",
      changedFiles: ["src/login-service.ts"],
    });

    const index = await createMemoryIndex(repoPath, profile(repoPath));
    const digest = await createMemoryDigest(repoPath, profile(repoPath));
    const restored = await restoreRequirementMemory(repoPath, profile(repoPath), {
      keyword: "login",
      requirement,
    });

    assert.equal(index.items.length, 1);
    assert.equal(index.items[0]?.requirementId, requirement.id);
    assert.match(index.items[0]?.restoreHint ?? "", /specweft\.restore_requirement/);
    assert.equal(digest.totalThreads, 1);
    assert.equal(digest.items[0]?.title, "Login cleanup");
    assert.equal(digest.items[0]?.sessionCount, 1);
    assert.ok(digest.items[0]?.keyFiles.includes("src/login-service.ts"));
    assert.match(digest.items[0]?.restoreHint ?? "", /requirementId=/);
    assert.equal(restored.sessions.length, 1);
    assert.equal(restored.requirement?.id, requirement.id);
    assert.match(restored.handoff.prompt, /Login cleanup review/);
  } finally {
    await rm(repoPath, { recursive: true, force: true });
  }
});

test("filters and persists cleanup for expired memories", async () => {
  const repoPath = await mkdtemp(path.join(os.tmpdir(), "specweft-memory-expired-"));

  try {
    const memoryDir = path.join(repoPath, ".specweft");
    const now = Date.now();
    await mkdir(memoryDir, { recursive: true });
    await writeFile(path.join(memoryDir, "memory.json"), JSON.stringify({
      sessions: [
        {
          id: "expired",
          projectId: "project",
          title: "Expired login review",
          keywords: ["login", "expired"],
          summary: "This memory should disappear from active views.",
          changedFiles: ["src/expired-login.ts"],
          createdAt: new Date(now - 10_000).toISOString(),
          updatedAt: new Date(now - 10_000).toISOString(),
          expiresAt: new Date(now - 1_000).toISOString(),
        },
        {
          id: "active",
          projectId: "project",
          title: "Active login review",
          keywords: ["login", "active"],
          summary: "This memory should remain visible.",
          changedFiles: ["src/active-login.ts"],
          createdAt: new Date(now).toISOString(),
          updatedAt: new Date(now).toISOString(),
          expiresAt: new Date(now + 86_400_000).toISOString(),
        },
      ],
    }, null, 2), "utf-8");

    const sessions = await recallSessions(repoPath, "login");
    const index = await createMemoryIndex(repoPath, profile(repoPath));
    const digest = await createMemoryDigest(repoPath, profile(repoPath));
    const handoff = await createMemoryHandoff(repoPath, profile(repoPath), "login");
    const memoryFile = JSON.parse(
      await readFile(path.join(repoPath, ".specweft", "memory.json"), "utf-8"),
    ) as { sessions: Array<{ title: string }> };

    assert.equal(sessions.length, 1);
    assert.equal(sessions[0]?.title, "Active login review");
    assert.equal(index.totalMemories, 1);
    assert.equal(digest.totalMemories, 1);
    assert.equal(handoff.sessions.length, 1);
    assert.equal(memoryFile.sessions.length, 1);
    assert.equal(memoryFile.sessions[0]?.title, "Active login review");
  } finally {
    await rm(repoPath, { recursive: true, force: true });
  }
});

test("detects unrecorded and recorded current diff", async () => {
  const repoPath = await mkdtemp(path.join(os.tmpdir(), "specweft-recording-status-"));

  try {
    await execFileAsync("git", ["init"], { cwd: repoPath });
    await execFileAsync("git", ["config", "user.email", "specweft@example.com"], { cwd: repoPath });
    await execFileAsync("git", ["config", "user.name", "SpecWeft"], { cwd: repoPath });
    await execFileAsync("git", ["commit", "--allow-empty", "-m", "initial"], { cwd: repoPath });
    await writeFile(path.join(repoPath, "feature.ts"), "export const value = 1;\n", "utf-8");

    const unrecorded = await getRecordingStatus(repoPath);
    assert.equal(unrecorded.status, "unrecorded");
    assert.equal(unrecorded.isRecorded, false);

    const snapshot = await createGitChangeSnapshot(repoPath);
    await saveSessionMemory(repoPath, {
      projectId: "project",
      title: "Recorded feature",
      keywords: ["feature"],
      summary: "Recorded the feature diff.",
      changedFiles: ["feature.ts"],
      codeSnapshot: snapshot,
    });

    const recorded = await getRecordingStatus(repoPath);
    assert.equal(recorded.status, "recorded");
    assert.equal(recorded.isRecorded, true);
  } finally {
    await rm(repoPath, { recursive: true, force: true });
  }
});

test("marks recalled memory as reverted when its diff is gone", async () => {
  const repoPath = await mkdtemp(path.join(os.tmpdir(), "specweft-memory-revert-"));

  try {
    await execFileAsync("git", ["init"], { cwd: repoPath });
    await execFileAsync("git", ["config", "user.email", "specweft@example.com"], { cwd: repoPath });
    await execFileAsync("git", ["config", "user.name", "SpecWeft"], { cwd: repoPath });
    await execFileAsync("git", ["commit", "--allow-empty", "-m", "initial"], { cwd: repoPath });
    await writeFile(path.join(repoPath, "feature.ts"), "export const value = 1;\n", "utf-8");

    const snapshot = await createGitChangeSnapshot(repoPath);
    await saveSessionMemory(repoPath, {
      projectId: "project",
      title: "Feature diff",
      keywords: ["feature"],
      summary: "Added a feature file.",
      changedFiles: ["feature.ts"],
      codeSnapshot: snapshot,
      codeStatus: "current",
      codeStatusReason: "Saved from current diff.",
    });

    await unlink(path.join(repoPath, "feature.ts"));

    const sessions = await recallSessions(repoPath, "feature");

    assert.equal(sessions.length, 1);
    assert.equal(sessions[0]?.codeStatus, "reverted");
    assert.match(sessions[0]?.codeStatusReason ?? "", /回滚|切换|没有未提交改动/);
  } finally {
    await rm(repoPath, { recursive: true, force: true });
  }
});

function profile(rootPath: string): ProjectProfile {
  return {
    id: "project",
    name: "specweft",
    rootPath,
    languages: ["typescript"],
    frameworks: [],
    packageManager: "pnpm",
    testCommands: [],
    buildCommands: [],
    ruleFiles: [],
    createdAt: "",
    updatedAt: "",
  };
}
