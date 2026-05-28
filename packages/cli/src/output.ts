export function printJson(value: unknown): void {
  // CLI 命令默认输出 JSON，方便后续被脚本、Web 或 MCP adapter 复用。
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

export function printText(value: string): void {
  process.stdout.write(`${value}\n`);
}
