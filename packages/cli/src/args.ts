export type CliArgs = {
  command?: string;
  subcommand?: string;
  target?: string;
  repo: string;
  keyword?: string;
  title?: string;
  port?: number;
};

export function parseArgs(argv: string[]): CliArgs {
  // pnpm script 透传参数时可能把 "--" 也传进来，这里先兼容掉。
  const normalizedArgv = argv[0] === "--" ? argv.slice(1) : argv;
  const [command, maybeSubcommand, maybeTarget, ...rest] = normalizedArgv;
  const args: CliArgs = {
    command,
    repo: ".",
  };

  if (command === "pool" || command === "apply" || command === "selection") {
    args.subcommand = maybeSubcommand;
    args.target = maybeTarget;
  }

  // v0 先手写极小参数解析，方便理解 CLI 原理；后续可替换成 commander。
  const optionArgs =
    command === "pool" || command === "apply" || command === "selection"
      ? rest
      : normalizedArgv.slice(1);
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

    if (current === "--title" && next) {
      args.title = next;
      index += 1;
      continue;
    }

    if (current === "--port" && next) {
      const port = Number(next);
      if (Number.isFinite(port)) {
        args.port = port;
      }
      index += 1;
    }
  }

  return args;
}
