export type CliArgs = {
  command?: string;
  subcommand?: string;
  target?: string;
  repo: string;
  keyword?: string;
  requirement?: string;
  title?: string;
  task?: string;
  port?: number;
  json?: boolean;
  full?: boolean;
  statusOnly?: boolean;
};

export function parseArgs(argv: string[]): CliArgs {
  // pnpm script 透传参数时可能把 "--" 也传进来，这里先兼容掉。
  const normalizedArgv = argv[0] === "--" ? argv.slice(1) : argv;
  const commandIndex = findCommandIndex(normalizedArgv);
  const command = commandIndex >= 0 ? normalizedArgv[commandIndex] : normalizedArgv[0];
  const commandTail = commandIndex >= 0 ? normalizedArgv.slice(commandIndex + 1) : normalizedArgv.slice(1);
  const maybeSubcommand = commandTail[0];
  const maybeTarget = commandTail[1];
  const rest = commandTail.slice(2);
  const args: CliArgs = {
    command,
    repo: ".",
  };

  if (command === "pool" || command === "apply" || command === "selection" || command === "segment") {
    args.subcommand = maybeSubcommand;
    args.target = maybeTarget;
  }

  // v0 先手写极小参数解析，方便理解 CLI 原理；后续可替换成 commander。
  const optionArgs = [
    ...normalizedArgv.slice(0, Math.max(commandIndex, 0)),
    ...(command === "pool" || command === "apply" || command === "selection" || command === "segment" ? rest : commandTail),
  ];
  for (let index = 0; index < optionArgs.length; index += 1) {
    const current = optionArgs[index];
    const next = optionArgs[index + 1];

    if (current === "--repo" && next) {
      args.repo = next;
      index += 1;
      continue;
    }

    if (current === "--keyword" && next) {
      args.keyword = next;
      index += 1;
      continue;
    }

    if (current === "--requirement" && next) {
      args.requirement = next;
      index += 1;
      continue;
    }

    if (current === "--title" && next) {
      args.title = next;
      index += 1;
      continue;
    }

    if (current === "--task" && next) {
      args.task = next;
      index += 1;
      continue;
    }

    if (current === "--port" && next) {
      args.port = parsePort(next);
      index += 1;
      continue;
    }

    if (current === "--json") {
      args.json = true;
      continue;
    }

    if (current === "--full") {
      args.full = true;
      continue;
    }

    if (current === "--status") {
      args.statusOnly = true;
    }
  }

  if ((command === "start" || command === "open") && maybeSubcommand && !maybeSubcommand.startsWith("-")) {
    args.port = parsePort(maybeSubcommand);
  }

  if (command === "prepare" && !args.task) {
    const positionalTask = collectPositionalTask(commandTail);
    if (positionalTask) {
      args.task = positionalTask;
    }
  }

  return args;
}

function collectPositionalTask(values: string[]): string | undefined {
  const optionNamesWithValue = new Set(["--repo", "--keyword", "--requirement", "--title", "--task", "--port"]);
  const parts: string[] = [];

  for (let index = 0; index < values.length; index += 1) {
    const current = values[index];
    if (optionNamesWithValue.has(current)) {
      index += 1;
      continue;
    }
    if (current.startsWith("-")) {
      continue;
    }
    parts.push(current);
  }

  return parts.join(" ").trim() || undefined;
}

function findCommandIndex(argv: string[]): number {
  const optionNamesWithValue = new Set(["--repo", "--keyword", "--requirement", "--title", "--task", "--port"]);

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    if (optionNamesWithValue.has(current)) {
      index += 1;
      continue;
    }
    if (current.startsWith("-")) {
      continue;
    }
    return index;
  }

  return -1;
}

function parsePort(value: string): number {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`--port 必须是 1 到 65535 之间的整数，当前值：${value}`);
  }

  return port;
}
