import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import { createReviewReport } from "../diff/diff-analyzer.js";
import { createWorkSegmentStatus, startWorkSegment } from "../work-segments/work-segment-manager.js";
import { createRequirement } from "../requirements/requirement-manager.js";
import type { ProjectProfile } from "../schemas/types.js";

const execFileAsync = promisify(execFile);

test("records and closes an active work segment when review is saved", async () => {
  const repoPath = await mkdtemp(path.join(os.tmpdir(), "specweft-work-segment-record-"));

  try {
    await initGitRepo(repoPath);
    await writeFile(path.join(repoPath, "package.json"), JSON.stringify({ name: "segment-demo" }), "utf-8");
    await writeFile(path.join(repoPath, "index.ts"), "export const value = 1;\n", "utf-8");
    await git(repoPath, ["add", "."]);
    await git(repoPath, ["commit", "-m", "initial"]);

    const profile = createProfile(repoPath);
    const requirement = await createRequirement(repoPath, {
      projectId: profile.id,
      title: "Segment review",
      keywords: ["segment", "review"],
    });
    const started = await startWorkSegment(repoPath, {
      projectId: profile.id,
      requirement,
      title: "Segment review",
      task: "explain work segment review",
    });
    await writeFile(path.join(repoPath, "index.ts"), "export const value = 2;\n", "utf-8");

    const report = await createReviewReport(repoPath, profile, "Segment review", 7, requirement.id);
    const status = await createWorkSegmentStatus(repoPath, profile);

    assert.equal(report.memory.workSegmentId, started.segment.id);
    assert.equal(status.activeSegment, undefined);
    assert.equal(status.recentSegments[0]?.status, "recorded");
    assert.equal(status.recentSegments[0]?.memoryId, report.memory.id);
    assert.deepEqual(status.recentSegments[0]?.newChangedFiles, ["index.ts"]);
  } finally {
    await rm(repoPath, { recursive: true, force: true });
  }
});

test("interrupts the previous active work segment when a new one starts", async () => {
  const repoPath = await mkdtemp(path.join(os.tmpdir(), "specweft-work-segment-interrupt-"));

  try {
    await initGitRepo(repoPath);
    await writeFile(path.join(repoPath, "package.json"), JSON.stringify({ name: "segment-demo" }), "utf-8");
    await git(repoPath, ["add", "."]);
    await git(repoPath, ["commit", "-m", "initial"]);

    const profile = createProfile(repoPath);
    const first = await startWorkSegment(repoPath, {
      projectId: profile.id,
      task: "first task",
      title: "First task",
    });
    const second = await startWorkSegment(repoPath, {
      projectId: profile.id,
      task: "second task",
      title: "Second task",
    });
    const status = await createWorkSegmentStatus(repoPath, profile);

    assert.equal(second.interruptedSegment?.id, first.segment.id);
    assert.equal(status.activeSegment?.id, second.segment.id);
    assert.equal(status.recentSegments.some((segment) =>
      segment.id === first.segment.id && segment.status === "interrupted"
    ), true);
  } finally {
    await rm(repoPath, { recursive: true, force: true });
  }
});

async function initGitRepo(repoPath: string): Promise<void> {
  await mkdir(repoPath, { recursive: true });
  await git(repoPath, ["init"]);
  await git(repoPath, ["config", "user.email", "specweft@example.com"]);
  await git(repoPath, ["config", "user.name", "SpecWeft"]);
}

async function git(repoPath: string, args: string[]): Promise<void> {
  await execFileAsync("git", args, { cwd: repoPath });
}

function createProfile(repoPath: string): ProjectProfile {
  return {
    id: "project",
    name: "segment-demo",
    rootPath: repoPath,
    languages: ["typescript"],
    frameworks: [],
    packageManager: "pnpm",
    testCommands: [],
    buildCommands: [],
    ruleFiles: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}
