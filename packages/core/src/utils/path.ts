import path from "node:path";

export function resolveRepoPath(repoPath: string): string {
  // 所有命令都先把用户输入的相对路径转成绝对路径，避免后续 cwd 混乱。
  return path.resolve(process.cwd(), repoPath);
}

export function toPosixPath(filePath: string): string {
  // 内部统一使用 /，这样 macOS/Linux/Windows 的路径输出更一致。
  return filePath.split(path.sep).join("/");
}

export function projectConfigDir(repoPath: string): string {
  return path.join(repoPath, ".specweft");
}
