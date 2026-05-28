import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export async function writeJsonFile(filePath: string, value: unknown): Promise<void> {
  // 写文件前确保目录存在，调用方不用关心 .specweft 是否已创建。
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf-8");
}

export async function readJsonFile<T>(filePath: string): Promise<T | undefined> {
  try {
    const content = await readFile(filePath, "utf-8");
    return JSON.parse(content) as T;
  } catch {
    // v0 把“不存在或 JSON 损坏”都当作未读取到；后续可区分错误类型。
    return undefined;
  }
}
