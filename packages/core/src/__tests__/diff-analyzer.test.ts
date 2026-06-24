import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import test from "node:test";
import { analyzeCurrentDiff, createAgentReviewPacket, createReviewReport } from "../diff/diff-analyzer.js";
import { createRequirement } from "../requirements/requirement-manager.js";
import { saveSessionMemory } from "../memory/session-memory.js";
import { startWorkSegment } from "../work-segments/work-segment-manager.js";
import { getRecordingStatus } from "../recording/recording-status.js";
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
    assert.equal(report.review.generationSource, "rules");
    assert.match(report.review.summary, /当前 diff 修改了 1 个文件/);
    assert.equal(report.review.reviewDigest.title, "Explain <diff>");
    assert.match(report.review.reviewDigest.requirementContext, /没有活跃工作段/);
    assert.match(report.review.reviewDigest.oneLineSummary, /本次修改围绕/);
    assert.ok(report.review.reviewDigest.whyChanged.length > 0);
    assert.ok(report.review.reviewDigest.implementationPath.length > 0);
    assert.ok(report.review.reviewDigest.sections.some((item) => item.title.includes("项目根目录")));
    assert.ok(report.review.reviewDigest.readingPath.some((item) => item.path === "index.ts"));
    assert.ok(report.review.reviewDigest.validation.length > 0);
    assert.ok(report.review.mainChanges.some((item) => item.includes("index.ts")));
    assert.ok(report.review.implementationSummary.some((item) => item.includes("运行时代码")));
    assert.ok(report.review.sourceReadingGuide.some((item) => item.path === "index.ts"));
    assert.match(report.review.reviewOverview.title, /识别出 1 个修改批次/);
    assert.ok(report.review.reviewOverview.batches.some((batch) => batch.files.some((file) => file.path === "index.ts")));
    assert.ok(report.review.reviewOverview.keyValues.some((item) => item.key === "识别批次数" && item.value === "1"));
    assert.match(report.html, /Explain &lt;diff&gt;/);
    assert.match(report.html, /需求上下文/);
    assert.match(report.html, /需求分块/);
    assert.match(report.html, /为什么这样改/);
    assert.match(report.html, /阅读入口/);
    assert.match(report.html, /实现内容总结/);
    assert.match(report.html, /本次修改概览/);
    assert.match(report.html, /改动分组/);
    assert.match(report.html, /需求拆解/);
    assert.match(report.html, /高级源码详情/);
    assert.match(report.html, /生成方式/);
    assert.match(report.html, /分组依据/);
    assert.match(report.html, /置信度/);
    assert.match(report.html, /<section>/);
    assert.match(markdown, /# Explain <diff>/);
    assert.match(markdown, /## Implemented Functionality/);
    assert.match(markdown, /## Review Digest/);
    assert.match(markdown, /需求上下文/);
    assert.match(markdown, /需求分块/);
    assert.match(markdown, /为什么这样改/);
    assert.match(markdown, /阅读入口/);
    assert.match(markdown, /## Review Overview/);
    assert.match(markdown, /## Requirement Blocks/);
    assert.match(markdown, /## Change Groups/);
    assert.match(markdown, /## Advanced Source Details/);
    assert.match(markdown, /分组依据/);
    assert.match(markdown, /置信度/);
    assert.ok(report.review.changeGroups.some((group) => group.files.some((file) => file.path === "index.ts")));
    assert.ok(report.review.requirementBlocks.some((block) => block.files.some((file) => file.path === "index.ts")));
    assert.ok(report.review.requirementBlocks.every((block) => block.keyValues.some((item) => item.key === "建议动作")));
    assert.equal(report.memory.reviewPath, report.reportPath);
    assert.equal(report.memory.codeStatus, "current");
    assert.ok(report.memory.codeSnapshot?.hasChanges);
    assert.ok(report.memory.codeSnapshot?.changedFiles.includes("index.ts"));
    assert.equal(report.memory.requirementId, report.requirement?.id);
    assert.ok(report.reportPath.includes(path.join(".specweft", "reports", report.requirement?.id ?? "")));
    assert.ok(report.memory.changedFiles.includes("index.ts"));
  } finally {
    await rm(repoPath, { recursive: true, force: true });
  }
});

test("creates an agent review packet that is digest-first and patch-free", async () => {
  const repoPath = await mkdtemp(path.join(os.tmpdir(), "specweft-agent-review-packet-"));

  try {
    await execFileAsync("git", ["init"], { cwd: repoPath });
    await execFileAsync("git", ["config", "user.email", "specweft@example.com"], { cwd: repoPath });
    await execFileAsync("git", ["config", "user.name", "SpecWeft"], { cwd: repoPath });
    await writeFile(path.join(repoPath, "index.ts"), "export const oldValue = 1;\n", "utf-8");
    await execFileAsync("git", ["add", "index.ts"], { cwd: repoPath });
    await execFileAsync("git", ["commit", "-m", "initial"], { cwd: repoPath });
    await writeFile(path.join(repoPath, "index.ts"), "export const newValue = 2;\n", "utf-8");

    const report = await createReviewReport(repoPath, profile(repoPath), "Agent packet review");
    const diff = await analyzeCurrentDiff(repoPath);
    const packet = createAgentReviewPacket({
      title: report.title,
      review: report.review,
      diff,
      requirement: report.requirement,
      reportPath: report.reportPath,
    });

    assert.equal(packet.title, "Agent packet review");
    assert.equal(packet.digest.title, "Agent packet review");
    assert.ok(packet.sourceReading.some((item) => item.path === "index.ts"));
    assert.ok(packet.digest.sections.some((item) => item.title.includes("项目根目录")));
    assert.match(packet.suggestedAgentResponse, /为什么这样改/);
    assert.match(packet.suggestedAgentResponse, /阅读入口/);
    assert.ok(packet.nextActions.some((item) => item.includes("digest")));
    assert.equal(packet.advanced.omittedPatch, true);
    assert.equal(packet.advanced.fullReviewAvailable, true);
    assert.equal(packet.advanced.reportPath, report.reportPath);
    assert.ok(!JSON.stringify(packet).includes("diff --git"));
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

test("does not persist a review report for an empty diff", async () => {
  const repoPath = await mkdtemp(path.join(os.tmpdir(), "specweft-review-empty-"));

  try {
    await execFileAsync("git", ["init"], { cwd: repoPath });
    await execFileAsync("git", ["config", "user.email", "specweft@example.com"], { cwd: repoPath });
    await execFileAsync("git", ["config", "user.name", "SpecWeft"], { cwd: repoPath });
    await writeFile(path.join(repoPath, "index.ts"), "export const value = 1;\n", "utf-8");
    await execFileAsync("git", ["add", "index.ts"], { cwd: repoPath });
    await execFileAsync("git", ["commit", "-m", "initial"], { cwd: repoPath });

    await assert.rejects(
      () => createReviewReport(repoPath, profile(repoPath), "Empty review"),
      /没有未提交的代码改动/,
    );
  } finally {
    await rm(repoPath, { recursive: true, force: true });
  }
});

test("ignores SpecWeft local state when checking current diff", async () => {
  const repoPath = await mkdtemp(path.join(os.tmpdir(), "specweft-review-local-state-"));

  try {
    await execFileAsync("git", ["init"], { cwd: repoPath });
    await execFileAsync("git", ["config", "user.email", "specweft@example.com"], { cwd: repoPath });
    await execFileAsync("git", ["config", "user.name", "SpecWeft"], { cwd: repoPath });
    await writeFile(path.join(repoPath, "index.ts"), "export const value = 1;\n", "utf-8");
    await execFileAsync("git", ["add", "index.ts"], { cwd: repoPath });
    await execFileAsync("git", ["commit", "-m", "initial"], { cwd: repoPath });
    await mkdir(path.join(repoPath, ".specweft", "reports"), { recursive: true });
    await writeFile(path.join(repoPath, ".specweft", "memory.json"), "{\"sessions\": []}\n", "utf-8");
    await writeFile(path.join(repoPath, ".specweft", "reports", "draft.md"), "# draft\n", "utf-8");

    const diff = await analyzeCurrentDiff(repoPath);

    assert.equal(diff.changedFiles.length, 0);
    assert.equal(diff.stats.files, 0);
  } finally {
    await rm(repoPath, { recursive: true, force: true });
  }
});

test("ignores tracked SpecWeft local state in patch text", async () => {
  const repoPath = await mkdtemp(path.join(os.tmpdir(), "specweft-review-tracked-local-state-"));

  try {
    await execFileAsync("git", ["init"], { cwd: repoPath });
    await execFileAsync("git", ["config", "user.email", "specweft@example.com"], { cwd: repoPath });
    await execFileAsync("git", ["config", "user.name", "SpecWeft"], { cwd: repoPath });
    await mkdir(path.join(repoPath, ".specweft"), { recursive: true });
    await writeFile(path.join(repoPath, "index.ts"), "export const value = 1;\n", "utf-8");
    await writeFile(path.join(repoPath, ".specweft", "memory.json"), "{\"sessions\": []}\n", "utf-8");
    await execFileAsync("git", ["add", "."], { cwd: repoPath });
    await execFileAsync("git", ["commit", "-m", "initial"], { cwd: repoPath });
    await writeFile(path.join(repoPath, ".specweft", "memory.json"), "{\"sessions\": [{\"id\":\"local\"}]}\n", "utf-8");

    const diff = await analyzeCurrentDiff(repoPath);

    assert.equal(diff.changedFiles.length, 0);
    assert.equal(diff.diffText.trim(), "");
  } finally {
    await rm(repoPath, { recursive: true, force: true });
  }
});

test("uses active work segment boundaries in review guidance", async () => {
  const repoPath = await mkdtemp(path.join(os.tmpdir(), "specweft-review-segment-boundary-"));

  try {
    await execFileAsync("git", ["init"], { cwd: repoPath });
    await execFileAsync("git", ["config", "user.email", "specweft@example.com"], { cwd: repoPath });
    await execFileAsync("git", ["config", "user.name", "SpecWeft"], { cwd: repoPath });
    await writeFile(path.join(repoPath, "old.ts"), "export const oldValue = 1;\n", "utf-8");
    await writeFile(path.join(repoPath, "new.ts"), "export const newValue = 1;\n", "utf-8");
    await execFileAsync("git", ["add", "."], { cwd: repoPath });
    await execFileAsync("git", ["commit", "-m", "initial"], { cwd: repoPath });

    await writeFile(path.join(repoPath, "old.ts"), "export const oldValue = 2;\n", "utf-8");
    await startWorkSegment(repoPath, {
      projectId: "project",
      title: "New request",
      task: "change new file only",
    });
    await writeFile(path.join(repoPath, "new.ts"), "export const newValue = 2;\n", "utf-8");

    const report = await createReviewReport(repoPath, profile(repoPath), "Segment boundary review");

    assert.match(report.review.intent, /当前工作段是「New request」/);
    assert.ok(report.review.requirementBlocks.some((block) =>
      block.kind === "current-work"
      && block.title.includes("New request")
      && block.files.some((file) => file.path === "new.ts"),
    ));
    assert.ok(report.review.requirementBlocks.some((block) =>
      block.kind === "carried-work"
      && block.files.some((file) => file.path === "old.ts"),
    ));
    assert.ok(report.review.reviewWalkthrough.some((item) => item.includes("本工作段新增改动文件：new.ts")));
    assert.match(report.review.reviewDigest.requirementContext, /New request/);
    assert.ok(report.review.reviewDigest.whyChanged.some((item) => item.includes("New request")));
    assert.ok(report.review.reviewDigest.whyChanged.some((item) => item.includes("旧改动")));
    assert.ok(["medium", "high"].includes(report.review.reviewDigest.confidence));
    assert.ok(report.review.reviewWalkthrough.some((item) => item.includes("开始工作段前已经存在的改动仍在 diff 中：old.ts")));
    assert.ok(report.review.risks.some((item) => item.includes("工作段开始时已有未提交改动")));
    assert.ok(report.review.reviewChecklist.some((item) => item.includes("carriedChangedFiles")));
    assert.match(report.html, /本工作段新增改动文件：new\.ts/);
  } finally {
    await rm(repoPath, { recursive: true, force: true });
  }
});

test("uses active work segment title as default review title", async () => {
  const repoPath = await mkdtemp(path.join(os.tmpdir(), "specweft-review-default-title-"));

  try {
    await execFileAsync("git", ["init"], { cwd: repoPath });
    await execFileAsync("git", ["config", "user.email", "specweft@example.com"], { cwd: repoPath });
    await execFileAsync("git", ["config", "user.name", "SpecWeft"], { cwd: repoPath });
    await writeFile(path.join(repoPath, "index.ts"), "export const value = 1;\n", "utf-8");
    await execFileAsync("git", ["add", "."], { cwd: repoPath });
    await execFileAsync("git", ["commit", "-m", "initial"], { cwd: repoPath });

    await startWorkSegment(repoPath, {
      projectId: "project",
      title: "优化登录提示文案",
      task: "优化登录提示文案",
    });
    await writeFile(path.join(repoPath, "index.ts"), "export const value = 2;\n", "utf-8");

    const report = await createReviewReport(repoPath, profile(repoPath), undefined);

    assert.equal(report.title, "优化登录提示文案");
    assert.equal(report.memory.title, "优化登录提示文案");
    assert.ok(report.reportPath.includes("优化登录提示文案"));
  } finally {
    await rm(repoPath, { recursive: true, force: true });
  }
});

test("keeps recorded status after saving a review with a Chinese report path", async () => {
  const repoPath = await mkdtemp(path.join(os.tmpdir(), "specweft-review-chinese-path-"));

  try {
    await execFileAsync("git", ["init"], { cwd: repoPath });
    await execFileAsync("git", ["config", "user.email", "specweft@example.com"], { cwd: repoPath });
    await execFileAsync("git", ["config", "user.name", "SpecWeft"], { cwd: repoPath });
    await writeFile(path.join(repoPath, "login.ts"), "export const login = 'old';\n", "utf-8");
    await execFileAsync("git", ["add", "."], { cwd: repoPath });
    await execFileAsync("git", ["commit", "-m", "initial"], { cwd: repoPath });

    await writeFile(path.join(repoPath, "login.ts"), "export const login = 'new';\n", "utf-8");
    await createReviewReport(repoPath, profile(repoPath), "登录提示优化");

    const status = await getRecordingStatus(repoPath);

    assert.equal(status.status, "recorded");
    assert.equal(status.isRecorded, true);
    assert.deepEqual(status.currentSnapshot.changedFiles, ["login.ts"]);
  } finally {
    await rm(repoPath, { recursive: true, force: true });
  }
});

test("groups mixed diffs into titled key-value change groups", async () => {
  const repoPath = await mkdtemp(path.join(os.tmpdir(), "specweft-review-groups-"));

  try {
    await execFileAsync("git", ["init"], { cwd: repoPath });
    await execFileAsync("git", ["config", "user.email", "specweft@example.com"], { cwd: repoPath });
    await execFileAsync("git", ["config", "user.name", "SpecWeft"], { cwd: repoPath });
    await writeFile(path.join(repoPath, "package.json"), "{\"name\":\"review-groups\"}\n", "utf-8");
    await mkdir(path.join(repoPath, "packages/core/src"), { recursive: true });
    await mkdir(path.join(repoPath, "packages/web/src"), { recursive: true });
    await writeFile(path.join(repoPath, "packages/core/src/index.ts"), "export const core = 1;\n", "utf-8");
    await writeFile(path.join(repoPath, "packages/web/src/ui.ts"), "export const ui = 1;\n", "utf-8");
    await writeFile(path.join(repoPath, "README.md"), "# Review Groups\n", "utf-8");
    await execFileAsync("git", ["add", "."], { cwd: repoPath });
    await execFileAsync("git", ["commit", "-m", "initial"], { cwd: repoPath });

    await writeFile(path.join(repoPath, "packages/core/src/index.ts"), "export const core = 2;\n", "utf-8");
    await writeFile(path.join(repoPath, "packages/web/src/ui.ts"), "export const ui = 2;\n", "utf-8");
    await writeFile(path.join(repoPath, "README.md"), "# Review Groups\n\nUpdated docs.\n", "utf-8");

    const report = await createReviewReport(repoPath, profile(repoPath), "Grouped review");
    const titles = report.review.changeGroups.map((group) => group.title);

    assert.ok(titles.some((title) => title.includes("Core")));
    assert.ok(titles.some((title) => title.includes("Web")));
    assert.ok(titles.some((title) => title.includes("文档")));
    assert.ok(report.review.changeGroups.every((group) => group.keyValues.length >= 4));
    assert.ok(report.review.changeGroups.every((group) => group.matchReason.length > 0));
    assert.ok(report.review.changeGroups.every((group) => ["high", "medium", "low"].includes(group.confidence)));
  } finally {
    await rm(repoPath, { recursive: true, force: true });
  }
});

test("splits same-package changes by functional area when history is unavailable", async () => {
  const repoPath = await mkdtemp(path.join(os.tmpdir(), "specweft-review-functional-groups-"));

  try {
    await execFileAsync("git", ["init"], { cwd: repoPath });
    await execFileAsync("git", ["config", "user.email", "specweft@example.com"], { cwd: repoPath });
    await execFileAsync("git", ["config", "user.name", "SpecWeft"], { cwd: repoPath });
    await mkdir(path.join(repoPath, "packages/core/src/memory"), { recursive: true });
    await mkdir(path.join(repoPath, "packages/core/src/task"), { recursive: true });
    await mkdir(path.join(repoPath, "packages/core/src/diff"), { recursive: true });
    await writeFile(
      path.join(repoPath, "packages/core/src/memory/session-memory.ts"),
      "export const memory = 1;\n",
      "utf-8",
    );
    await writeFile(
      path.join(repoPath, "packages/core/src/task/task-preparer.ts"),
      "export const prepare = 1;\n",
      "utf-8",
    );
    await writeFile(
      path.join(repoPath, "packages/core/src/diff/diff-analyzer.ts"),
      "export const review = 1;\n",
      "utf-8",
    );
    await execFileAsync("git", ["add", "."], { cwd: repoPath });
    await execFileAsync("git", ["commit", "-m", "initial"], { cwd: repoPath });

    await writeFile(
      path.join(repoPath, "packages/core/src/memory/session-memory.ts"),
      "export const memory = 2;\n",
      "utf-8",
    );
    await writeFile(
      path.join(repoPath, "packages/core/src/task/task-preparer.ts"),
      "export const prepare = 2;\n",
      "utf-8",
    );
    await writeFile(
      path.join(repoPath, "packages/core/src/diff/diff-analyzer.ts"),
      "export const review = 2;\n",
      "utf-8",
    );

    const report = await createReviewReport(repoPath, profile(repoPath), "功能域分组讲解");
    const titles = report.review.changeGroups.map((group) => group.title);

    assert.ok(titles.includes("记忆索引与需求档案"));
    assert.ok(titles.includes("任务准备与文件定位"));
    assert.ok(titles.includes("代码讲解与 Review 报告"));
    assert.equal(report.review.changeGroups.length, 3);
    assert.ok(report.review.changeGroups.every((group) => group.matchReason.includes("功能域")));
  } finally {
    await rm(repoPath, { recursive: true, force: true });
  }
});

test("keeps functional groups when broad active history only matches generic keywords", async () => {
  const repoPath = await mkdtemp(path.join(os.tmpdir(), "specweft-review-broad-history-"));

  try {
    await execFileAsync("git", ["init"], { cwd: repoPath });
    await execFileAsync("git", ["config", "user.email", "specweft@example.com"], { cwd: repoPath });
    await execFileAsync("git", ["config", "user.name", "SpecWeft"], { cwd: repoPath });
    await mkdir(path.join(repoPath, "packages/core/src/memory"), { recursive: true });
    await mkdir(path.join(repoPath, "packages/core/src/task"), { recursive: true });
    await mkdir(path.join(repoPath, "packages/core/src/diff"), { recursive: true });
    await writeFile(path.join(repoPath, "packages/core/src/memory/session-memory.ts"), "export const memory = 1;\n", "utf-8");
    await writeFile(path.join(repoPath, "packages/core/src/task/task-preparer.ts"), "export const prepare = 1;\n", "utf-8");
    await writeFile(path.join(repoPath, "packages/core/src/diff/diff-analyzer.ts"), "export const review = 1;\n", "utf-8");
    await execFileAsync("git", ["add", "."], { cwd: repoPath });
    await execFileAsync("git", ["commit", "-m", "initial"], { cwd: repoPath });

    const requirement = await createRequirement(repoPath, {
      projectId: "project",
      title: "宽泛历史需求",
      keywords: ["typescript", "index.ts", "package.json"],
    });
    await saveSessionMemory(repoPath, {
      projectId: "project",
      requirementId: requirement.id,
      requirementTitle: requirement.title,
      title: "宽泛历史记录",
      keywords: ["typescript", "index.ts", "package.json"],
      summary: "这条历史记录覆盖很多不相关文件。",
      changedFiles: ["README.md", "package.json", "src/index.ts"],
    });

    await writeFile(path.join(repoPath, "packages/core/src/memory/session-memory.ts"), "export const memory = 2;\n", "utf-8");
    await writeFile(path.join(repoPath, "packages/core/src/task/task-preparer.ts"), "export const prepare = 2;\n", "utf-8");
    await writeFile(path.join(repoPath, "packages/core/src/diff/diff-analyzer.ts"), "export const review = 2;\n", "utf-8");

    const report = await createReviewReport(repoPath, profile(repoPath), "宽泛历史不应吞掉功能域");
    const titles = report.review.changeGroups.map((group) => group.title);

    assert.ok(titles.includes("记忆索引与需求档案"));
    assert.ok(titles.includes("任务准备与文件定位"));
    assert.ok(titles.includes("代码讲解与 Review 报告"));
    assert.ok(!titles.includes("需求：宽泛历史需求"));
  } finally {
    await rm(repoPath, { recursive: true, force: true });
  }
});

test("does not let low-signal shared files alone override functional grouping", async () => {
  const repoPath = await mkdtemp(path.join(os.tmpdir(), "specweft-review-low-signal-history-"));

  try {
    await execFileAsync("git", ["init"], { cwd: repoPath });
    await execFileAsync("git", ["config", "user.email", "specweft@example.com"], { cwd: repoPath });
    await execFileAsync("git", ["config", "user.name", "SpecWeft"], { cwd: repoPath });
    await mkdir(path.join(repoPath, "packages/web/src"), { recursive: true });
    await mkdir(path.join(repoPath, "packages/core/src/schemas"), { recursive: true });
    await writeFile(path.join(repoPath, "package.json"), "{\"name\":\"demo\"}\n", "utf-8");
    await writeFile(path.join(repoPath, "packages/web/src/ui.ts"), "export const ui = 1;\n", "utf-8");
    await writeFile(path.join(repoPath, "packages/core/src/schemas/types.ts"), "export type Demo = 1;\n", "utf-8");
    await execFileAsync("git", ["add", "."], { cwd: repoPath });
    await execFileAsync("git", ["commit", "-m", "initial"], { cwd: repoPath });

    const requirement = await createRequirement(repoPath, {
      projectId: "project",
      title: "旧 UI 历史",
      keywords: ["ui"],
    });
    await saveSessionMemory(repoPath, {
      projectId: "project",
      requirementId: requirement.id,
      requirementTitle: requirement.title,
      title: "旧 UI 记录",
      keywords: ["ui"],
      summary: "上一轮只留下了公共文件记录。",
      changedFiles: ["package.json", "packages/core/src/schemas/types.ts"],
    });

    await writeFile(path.join(repoPath, "package.json"), "{\"name\":\"demo\",\"version\":\"1.0.0\"}\n", "utf-8");
    await writeFile(path.join(repoPath, "packages/web/src/ui.ts"), "export const ui = 2;\n", "utf-8");
    await writeFile(path.join(repoPath, "packages/core/src/schemas/types.ts"), "export type Demo = 2;\n", "utf-8");

    const report = await createReviewReport(repoPath, profile(repoPath), "低信号历史不应覆盖 UI");
    const uiGroup = report.review.changeGroups.find((group) => group.title === "Web UI 展示与交互");

    assert.ok(uiGroup);
    assert.ok(uiGroup.files.some((file) => file.path === "packages/web/src/ui.ts"));
    assert.ok(report.review.changeGroups.some((group) => group.title === "配置与发布入口调整"));
    assert.ok(!report.review.changeGroups.some((group) => group.title === "需求：旧 UI 历史"));
  } finally {
    await rm(repoPath, { recursive: true, force: true });
  }
});

test("splits one mixed diff into separate historical requirement groups", async () => {
  const repoPath = await mkdtemp(path.join(os.tmpdir(), "specweft-review-mixed-requirements-"));

  try {
    await execFileAsync("git", ["init"], { cwd: repoPath });
    await execFileAsync("git", ["config", "user.email", "specweft@example.com"], { cwd: repoPath });
    await execFileAsync("git", ["config", "user.name", "SpecWeft"], { cwd: repoPath });
    await mkdir(path.join(repoPath, "src"), { recursive: true });
    await writeFile(path.join(repoPath, "src/login.ts"), "export const login = 1;\n", "utf-8");
    await writeFile(path.join(repoPath, "src/billing.ts"), "export const billing = 1;\n", "utf-8");
    await execFileAsync("git", ["add", "."], { cwd: repoPath });
    await execFileAsync("git", ["commit", "-m", "initial"], { cwd: repoPath });

    const loginRequirement = await createRequirement(repoPath, {
      projectId: "project",
      title: "登录校验优化",
      keywords: ["login", "登录"],
    });
    await saveSessionMemory(repoPath, {
      projectId: "project",
      requirementId: loginRequirement.id,
      requirementTitle: loginRequirement.title,
      title: "登录校验第一版",
      keywords: ["login", "登录"],
      summary: "上一轮修改集中在登录校验逻辑。",
      changedFiles: ["src/login.ts"],
    });

    const billingRequirement = await createRequirement(repoPath, {
      projectId: "project",
      title: "账单流程优化",
      keywords: ["billing", "账单"],
    });
    await saveSessionMemory(repoPath, {
      projectId: "project",
      requirementId: billingRequirement.id,
      requirementTitle: billingRequirement.title,
      title: "账单流程第一版",
      keywords: ["billing", "账单"],
      summary: "上一轮修改集中在账单流程。",
      changedFiles: ["src/billing.ts"],
    });

    await writeFile(path.join(repoPath, "src/login.ts"), "export const login = 2;\n", "utf-8");
    await writeFile(path.join(repoPath, "src/billing.ts"), "export const billing = 2;\n", "utf-8");

    const report = await createReviewReport(repoPath, profile(repoPath), "混合需求讲解");
    const groups = report.review.changeGroups;

    assert.ok(groups.some((group) => group.title === "需求：登录校验优化"));
    assert.ok(groups.some((group) => group.title === "需求：账单流程优化"));
    assert.ok(groups.every((group) => group.keyValues.some((item) => item.key === "分组依据")));
    assert.ok(groups.every((group) => group.keyValues.some((item) => item.key === "置信度")));
    assert.equal(report.review.reviewOverview.batches.length, 2);
    assert.match(report.review.reviewDigest.requirementContext, /2 条需求线/);
    assert.equal(report.review.reviewDigest.sections.length, 2);
    assert.ok(report.review.reviewDigest.sections.some((section) =>
      section.title.includes("登录校验优化")
      && section.readingEntry?.path === "src/login.ts",
    ));
    assert.ok(report.review.reviewDigest.sections.some((section) =>
      section.title.includes("账单流程优化")
      && section.readingEntry?.path === "src/billing.ts",
    ));
    assert.ok(report.review.reviewDigest.whyChanged.some((item) => item.includes("登录校验优化")));
    assert.ok(report.review.reviewDigest.implementationPath.length >= 2);
    assert.ok(report.review.reviewOverview.batches.some((batch) => batch.title.includes("登录校验优化")));
    assert.ok(report.review.reviewOverview.batches.some((batch) => batch.title.includes("账单流程优化")));
    assert.ok(report.review.reviewOverview.readingOrder.some((item) => item.includes("登录校验优化")));
    assert.ok(report.review.requirementBlocks.some((block) =>
      block.kind === "historical-requirement"
      && block.title === "需求：登录校验优化"
      && block.keyValues.some((item) => item.key === "自动标题"),
    ));
    assert.ok(report.review.requirementBlocks.some((block) =>
      block.kind === "historical-requirement"
      && block.title === "需求：账单流程优化"
      && block.keyValues.some((item) => item.key === "建议动作"),
    ));
  } finally {
    await rm(repoPath, { recursive: true, force: true });
  }
});

test("groups review changes by matched requirement memory when file overlap is strong", async () => {
  const repoPath = await mkdtemp(path.join(os.tmpdir(), "specweft-review-requirement-groups-"));

  try {
    await execFileAsync("git", ["init"], { cwd: repoPath });
    await execFileAsync("git", ["config", "user.email", "specweft@example.com"], { cwd: repoPath });
    await execFileAsync("git", ["config", "user.name", "SpecWeft"], { cwd: repoPath });
    await mkdir(path.join(repoPath, "src"), { recursive: true });
    await writeFile(path.join(repoPath, "src/login.ts"), "export const login = 1;\n", "utf-8");
    await execFileAsync("git", ["add", "."], { cwd: repoPath });
    await execFileAsync("git", ["commit", "-m", "initial"], { cwd: repoPath });

    const requirement = await createRequirement(repoPath, {
      projectId: "project",
      title: "登录校验优化",
      keywords: ["login", "登录"],
    });
    await saveSessionMemory(repoPath, {
      projectId: "project",
      requirementId: requirement.id,
      requirementTitle: requirement.title,
      title: "登录校验第一版",
      keywords: ["login", "登录"],
      summary: "上一轮修改集中在登录校验逻辑。",
      changedFiles: ["src/login.ts"],
    });

    await writeFile(path.join(repoPath, "src/login.ts"), "export const login = 2;\n", "utf-8");

    const report = await createReviewReport(repoPath, profile(repoPath), "继续登录校验");

    assert.ok(report.review.changeGroups.some((group) => group.title === "需求：登录校验优化"));
    assert.ok(report.review.changeGroups.some((group) =>
      group.keyValues.some((item) => item.key === "范围" && item.value.includes("登录校验优化")),
    ));
  } finally {
    await rm(repoPath, { recursive: true, force: true });
  }
});

test("uses explicit review requirement as grouping context", async () => {
  const repoPath = await mkdtemp(path.join(os.tmpdir(), "specweft-review-explicit-requirement-"));

  try {
    await execFileAsync("git", ["init"], { cwd: repoPath });
    await execFileAsync("git", ["config", "user.email", "specweft@example.com"], { cwd: repoPath });
    await execFileAsync("git", ["config", "user.name", "SpecWeft"], { cwd: repoPath });
    await mkdir(path.join(repoPath, "src"), { recursive: true });
    await writeFile(path.join(repoPath, "src/billing.ts"), "export const billing = 1;\n", "utf-8");
    await execFileAsync("git", ["add", "."], { cwd: repoPath });
    await execFileAsync("git", ["commit", "-m", "initial"], { cwd: repoPath });

    const billingRequirement = await createRequirement(repoPath, {
      projectId: "project",
      title: "Billing flow",
      keywords: ["billing"],
    });
    await createRequirement(repoPath, {
      projectId: "project",
      title: "Active unrelated work",
      keywords: ["unrelated"],
    });

    await writeFile(path.join(repoPath, "src/billing.ts"), "export const billing = 2;\n", "utf-8");

    const report = await createReviewReport(
      repoPath,
      profile(repoPath),
      "Billing review",
      7,
      billingRequirement.id,
    );

    assert.equal(report.requirement?.id, billingRequirement.id);
    assert.ok(report.review.changeGroups.some((group) => group.title === "需求：Billing flow"));
    assert.ok(report.review.changeGroups.some((group) =>
      group.reviewNotes.some((note) => note.includes("当前活跃需求")),
    ));
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
