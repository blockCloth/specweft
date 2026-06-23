export function printJson(value: unknown): void {
  // 只在命令明确需要机器可读输出时使用；面向用户的命令优先走 printText。
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

export function printText(value: string): void {
  process.stdout.write(`${value}\n`);
}
