import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import test from "node:test";
import { analyzeCurrentDiff, createReviewReport } from "../diff/diff-analyzer.js";
import type { ProjectProfile } from "../schemas/types.js";

const execFileAsync = promisify(execFile);

test("creates a structured review report with HTML and session memory", async () => {
  const repoPath = await mkdtemp(path.join(os.tmpdir(), "specweft-review-repo-"));

  try {
    await execFileAsync("git", ["init"], { cwd: repoPath });
    await execFileAsync("git", ["config", "user.email", "specweft@example.com"], { cwd: repoPath });
    await execFileAsync("git", ["config", "user.name", "SpecWeft"], { cwd: repoPath });
    await writeFile(path.join(repoPath, "index.ts"), "export const oldValue = 1;\n", "utf-8");
    await execFileAsync("git", ["add", "index.ts"], { cwd: repoPath });
    await execFileAsync("git", ["commit", "-m", "initial"], { cwd: repoPath });
    await writeFile(path.join(repoPath, "index.ts"), "export const newValue = 2;\n", "utf-8");

    const report = await createReviewReport(repoPath, profile(repoPath), "Explain <diff>");
    const markdown = await readFile(report.reportPath, "utf-8");

    assert.equal(report.title, "Explain <diff>");
    assert.match(report.review.summary, /当前 diff 修改了 1 个文件/);
    assert.ok(report.review.mainChanges.some((item) => item.includes("index.ts")));
    assert.match(report.html, /Explain &lt;diff&gt;/);
    assert.match(report.html, /<section>/);
    assert.match(markdown, /# Explain <diff>/);
    assert.equal(report.memory.reviewPath, report.reportPath);
    assert.ok(report.memory.changedFiles.includes("index.ts"));
  } finally {
    await rm(repoPath, { recursive: true, force: true });
  }
});

test("includes untracked files in current diff analysis", async () => {
  const repoPath = await mkdtemp(path.join(os.tmpdir(), "specweft-review-untracked-"));

  try {
    await execFileAsync("git", ["init"], { cwd: repoPath });
    await writeFile(path.join(repoPath, "new-file.ts"), "export const value = 1;\n", "utf-8");

    const diff = await analyzeCurrentDiff(repoPath);

    assert.ok(diff.changedFiles.some((file) => file.path === "new-file.ts"));
    assert.equal(diff.changedFiles.find((file) => file.path === "new-file.ts")?.changeType, "added");
    assert.equal(diff.stats.files, 1);
    assert.equal(diff.stats.additions, 1);
  } finally {
    await rm(repoPath, { recursive: true, force: true });
  }
});

function profile(rootPath: string): ProjectProfile {
  return {
    id: "project",
    name: "review-demo",
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
