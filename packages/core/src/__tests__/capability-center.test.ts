import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createCapabilityCenter } from "../capabilities/capability-center.js";
import { initializeSpecWeftProject } from "../bootstrap/bootstrap-session.js";
import { scanProject } from "../scanner/project-scanner.js";

test("creates a unified capability center with MCP, Skill, and CLI capabilities", async () => {
  const home = await mkdtemp(path.join(os.tmpdir(), "specweft-capability-home-"));
  const repoPath = await mkdtemp(path.join(os.tmpdir(), "specweft-capability-repo-"));

  try {
    process.env.SPECWEFT_HOME = home;
    await writeFile(
      path.join(repoPath, "package.json"),
      JSON.stringify({
        name: "capability-demo",
        scripts: {
          test: "vitest run",
        },
        devDependencies: {
          typescript: "latest",
          vite: "latest",
        },
      }),
      "utf-8",
    );
    await writeFile(path.join(repoPath, "index.ts"), "export const ok = true;\n", "utf-8");

    await initializeSpecWeftProject(repoPath);
    const profile = await scanProject(repoPath);
    const center = await createCapabilityCenter(profile, repoPath);
    const ids = center.capabilities.map((item) => item.id);

    assert.ok(ids.includes("filesystem"));
    assert.ok(ids.includes("diff-explainer"));
    assert.ok(ids.includes("cli-ripgrep"));
    assert.ok(ids.includes("cli-vitest"));
    assert.ok(ids.includes("cli-playwright"));
    assert.equal(center.summary.enabled, 4);
    assert.ok(center.summary.recommended >= 3);
    assert.equal(center.capabilities.find((item) => item.id === "cli-vitest")?.kind, "cli");
  } finally {
    delete process.env.SPECWEFT_HOME;
    await rm(home, { recursive: true, force: true });
    await rm(repoPath, { recursive: true, force: true });
  }
});
