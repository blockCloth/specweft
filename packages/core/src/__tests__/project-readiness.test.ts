import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { initializeSpecWeftProject } from "../bootstrap/bootstrap-session.js";
import { createProjectReadiness } from "../status/project-readiness.js";

test("creates a compact project readiness checklist for agents and UI", async () => {
  const home = await mkdtemp(path.join(os.tmpdir(), "specweft-readiness-home-"));
  const repoPath = await mkdtemp(path.join(os.tmpdir(), "specweft-readiness-repo-"));

  try {
    process.env.SPECWEFT_HOME = home;
    await writeFile(
      path.join(repoPath, "package.json"),
      JSON.stringify({
        name: "readiness-demo",
        scripts: {
          test: "node --test",
        },
        devDependencies: {
          typescript: "latest",
        },
      }, null, 2),
      "utf-8",
    );
    await initializeSpecWeftProject(repoPath);

    const readiness = await createProjectReadiness(repoPath);
    const ids = readiness.items.map((item) => item.id);

    assert.equal(readiness.projectName, "readiness-demo");
    assert.equal(readiness.items.length, 4);
    assert.deepEqual(ids, ["agent-connection", "skill-path", "change-review", "memory-entry"]);
    assert.ok(readiness.score >= 0 && readiness.score <= 100);
    assert.ok(readiness.items.every((item) => item.signals.length > 0));
    assert.ok(readiness.items.every((item) => item.nextSteps.length > 0));
    assert.ok(readiness.items.every((item) => item.agentTools.length > 0));
    assert.ok(readiness.items.every((item) => item.commands.length > 0));
    assert.ok(readiness.items.every((item) => item.uiAction.target));
    assert.equal(readiness.items.find((item) => item.id === "agent-connection")?.target, "connect");
    assert.equal(readiness.items.find((item) => item.id === "skill-path")?.target, "tools");
    assert.equal(readiness.items.find((item) => item.id === "change-review")?.target, "review");
    assert.ok(readiness.items.find((item) => item.id === "change-review")?.agentTools.includes("specweft.record_current_diff"));
    assert.ok(readiness.items.find((item) => item.id === "memory-entry")?.agentTools.includes("specweft.restore_requirement"));
  } finally {
    delete process.env.SPECWEFT_HOME;
    await rm(home, { recursive: true, force: true });
    await rm(repoPath, { recursive: true, force: true });
  }
});
