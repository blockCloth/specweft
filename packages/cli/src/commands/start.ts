import { spawn } from "node:child_process";
import { resolveRepoPath } from "@specweft/core";

// 一键启动本地 Web UI。这里复用 packages/web 的 dev 入口，避免 CLI 和 Web 互相复制服务逻辑。
export async function runStart(repoArg: string, port = 4177): Promise<void> {
  const repoPath = resolveRepoPath(repoArg);
  const child = spawn(
    "pnpm",
    [
      "--filter",
      "@specweft/web",
      "dev",
      "--",
      "--repo",
      repoPath,
      "--port",
      String(port),
    ],
    {
      stdio: "inherit",
      env: process.env,
    },
  );

  await new Promise<void>((resolve, reject) => {
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code && code !== 0) {
        reject(new Error(`SpecWeft UI exited with code ${code}`));
        return;
      }
      resolve();
    });
  });
}
