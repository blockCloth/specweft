import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  createMemoryHandoff,
  recallSessions,
  saveSessionMemory,
} from "../memory/session-memory.js";
import type { ProjectProfile } from "../schemas/types.js";

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
