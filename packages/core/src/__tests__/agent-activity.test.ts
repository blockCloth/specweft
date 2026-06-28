import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { agentActivityPath, readAgentActivity, recordAgentActivity } from "../activity/agent-activity.js";

const originalMemoryKey = process.env.SPECWEFT_MEMORY_KEY;

test.afterEach(() => {
  if (originalMemoryKey === undefined) {
    delete process.env.SPECWEFT_MEMORY_KEY;
    return;
  }

  process.env.SPECWEFT_MEMORY_KEY = originalMemoryKey;
});

test("records recent agent activity without storing long prompts or raw objects", async () => {
  const repoPath = await mkdtemp(path.join(os.tmpdir(), "specweft-agent-activity-"));

  try {
    await recordAgentActivity(repoPath, {
      kind: "prepare_task",
      source: "mcp",
      title: "准备一个特别特别特别特别特别特别特别特别特别特别特别特别长的任务标题",
      summary: "用户输入了一个很长的需求，但活动流只保留简短摘要，不能保存完整 prompt 或源码内容。".repeat(8),
      toolName: "specweft.prepare_task",
      metadata: {
        codePointers: 3,
        files: ["src/a.ts", "src/b.ts", "src/c.ts", "src/d.ts", "src/e.ts", "src/f.ts", "src/g.ts"],
        raw: {
          unsafe: "object should not be stored as JSON",
        },
      },
    });

    const log = await readAgentActivity(repoPath);
    const raw = await readFile(agentActivityPath(repoPath), "utf-8");

    assert.equal(log.events.length, 1);
    assert.equal(log.summary.success, 1);
    assert.equal(log.events[0]?.kind, "prepare_task");
    assert.equal(log.events[0]?.source, "mcp");
    assert.ok((log.events[0]?.title.length ?? 0) <= 90);
    assert.ok((log.events[0]?.summary.length ?? 0) <= 260);
    assert.equal(log.events[0]?.metadata.codePointers, 3);
    assert.match(String(log.events[0]?.metadata.files), /src\/a\.ts/);
    assert.doesNotMatch(raw, /object should not be stored as JSON/);
  } finally {
    await rm(repoPath, { recursive: true, force: true });
  }
});

test("encrypts agent activity when memory protection is configured", async () => {
  const repoPath = await mkdtemp(path.join(os.tmpdir(), "specweft-agent-activity-encrypted-"));

  try {
    process.env.SPECWEFT_MEMORY_KEY = "agent activity memory key with enough entropy";
    await recordAgentActivity(repoPath, {
      kind: "record_current_diff",
      source: "mcp",
      title: "Sensitive review activity",
      summary: "Private requirement summary should not be visible in the activity file.",
      toolName: "specweft.record_current_diff",
    });

    const raw = await readFile(agentActivityPath(repoPath), "utf-8");
    const log = await readAgentActivity(repoPath);

    assert.match(raw, /specweftSecureJson/);
    assert.doesNotMatch(raw, /Private requirement summary/);
    assert.equal(log.events[0]?.title, "Sensitive review activity");

    delete process.env.SPECWEFT_MEMORY_KEY;
    await assert.rejects(
      () => readAgentActivity(repoPath),
      /SPECWEFT_MEMORY_KEY/,
    );
  } finally {
    await rm(repoPath, { recursive: true, force: true });
  }
});
