import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  listRegisteredProjects,
  registerProject,
  setActiveProject,
} from "../projects/project-registry.js";

test("registers multiple projects in the global project registry", async () => {
  const home = await mkdtemp(path.join(os.tmpdir(), "specweft-project-registry-home-"));
  const firstRepo = await createRepo("first-project");
  const secondRepo = await createRepo("second-project");

  try {
    process.env.SPECWEFT_HOME = home;

    await registerProject(firstRepo);
    await registerProject(secondRepo);
    const registry = await listRegisteredProjects();

    assert.equal(registry.activeProjectPath, secondRepo);
    assert.deepEqual(registry.projects.map((item) => item.rootPath), [secondRepo, firstRepo]);
    assert.deepEqual(registry.projects.map((item) => item.name), ["second-project", "first-project"]);

    const active = await setActiveProject(firstRepo);
    assert.equal(active.activeProjectPath, firstRepo);
  } finally {
    delete process.env.SPECWEFT_HOME;
    await rm(home, { recursive: true, force: true });
    await rm(firstRepo, { recursive: true, force: true });
    await rm(secondRepo, { recursive: true, force: true });
  }
});

async function createRepo(name: string): Promise<string> {
  const repoPath = await mkdtemp(path.join(os.tmpdir(), `specweft-${name}-`));
  await writeFile(path.join(repoPath, "package.json"), JSON.stringify({ name }), "utf-8");
  return repoPath;
}
