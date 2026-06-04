import { resolveRepoPath } from "@specweft/core";
import { startWebServer } from "@specweft/web";

// 一键启动本地 Web UI。CLI 直接调用 Web 包，保证 npm 全局安装后也能运行。
export async function runStart(repoArg: string, port = 4177): Promise<void> {
  const repoPath = resolveRepoPath(repoArg);
  await startWebServer({ repoPath, port });
}
