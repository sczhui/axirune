export const COMMANDS = [
  "check",
  "run",
  "fmt",
  "ast",
  "ir",
  "manifest",
  "build",
  "bench",
] as const;

export type CommandName = (typeof COMMANDS)[number];

export interface CliArguments {
  command: CommandName | null;
  input: string | null;
  json: boolean;
  write: boolean;
  check: boolean;
  help: boolean;
  version: boolean;
  markdown: boolean;
  out: string | null;
  samples: number | null;
  warmup: number | null;
}

export class UsageError extends Error {
  readonly exitCode = 2;
}

export function parseArguments(argv: readonly string[]): CliArguments {
  const parsed: CliArguments = {
    command: null,
    input: null,
    json: false,
    write: false,
    check: false,
    help: false,
    version: false,
    markdown: false,
    out: null,
    samples: null,
    warmup: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]!;
    if (argument === "--help" || argument === "-h") {
      parsed.help = true;
      continue;
    }
    if (argument === "--version" || argument === "-V") {
      parsed.version = true;
      continue;
    }
    if (argument === "--json") {
      parsed.json = true;
      continue;
    }
    if (argument === "--markdown") {
      parsed.markdown = true;
      continue;
    }
    if (argument === "--write" || argument === "-w") {
      parsed.write = true;
      continue;
    }
    if (argument === "--check") {
      parsed.check = true;
      continue;
    }
    if (argument === "--out" || argument === "-o") {
      parsed.out = takeValue(argv, ++index, argument);
      continue;
    }
    if (argument.startsWith("--out=")) {
      parsed.out = argument.slice("--out=".length);
      continue;
    }
    if (argument === "--samples") {
      parsed.samples = positiveInteger(takeValue(argv, ++index, argument), argument);
      continue;
    }
    if (argument.startsWith("--samples=")) {
      parsed.samples = positiveInteger(argument.slice("--samples=".length), "--samples");
      continue;
    }
    if (argument === "--warmup") {
      parsed.warmup = nonNegativeInteger(takeValue(argv, ++index, argument), argument);
      continue;
    }
    if (argument.startsWith("--warmup=")) {
      parsed.warmup = nonNegativeInteger(argument.slice("--warmup=".length), "--warmup");
      continue;
    }
    if (argument.startsWith("-") && argument !== "-") {
      throw new UsageError(`Unknown option: ${argument}`);
    }
    if (!parsed.command) {
      if (!COMMANDS.includes(argument as CommandName)) {
        throw new UsageError(`Unknown command: ${argument}`);
      }
      parsed.command = argument as CommandName;
      continue;
    }
    if (!parsed.input) {
      parsed.input = argument;
      continue;
    }
    throw new UsageError(`Unexpected argument: ${argument}`);
  }

  if (parsed.write && parsed.check) {
    throw new UsageError("fmt cannot use --write and --check together.");
  }
  return parsed;
}

function takeValue(argv: readonly string[], index: number, option: string): string {
  const value = argv[index];
  if (!value || value.startsWith("-")) {
    throw new UsageError(`${option} requires a value.`);
  }
  return value;
}

function positiveInteger(value: string, option: string): number {
  const parsed = nonNegativeInteger(value, option);
  if (parsed < 1) throw new UsageError(`${option} must be at least 1.`);
  return parsed;
}

function nonNegativeInteger(value: string, option: string): number {
  if (!/^\d+$/u.test(value)) throw new UsageError(`${option} must be an integer.`);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) throw new UsageError(`${option} is too large.`);
  return parsed;
}

export const HELP_TEXT = `Nexilume toolchain

Usage:
  nexilume <command> [file.nxl] [options]

Commands:
  check       Parse and type-check a source file
  run         Compile and execute a source file
  fmt         Print canonical source (--write or --check)
  ast         Emit the recoverable syntax tree as JSON
  ir          Emit checked Nexilume IR as JSON
  manifest    Emit the capability manifest as JSON
  build       Write canonical source, AST, IR and manifest artifacts
  bench       Benchmark parse, compile and run

Options:
  --json              Emit a machine-readable JSON envelope
  --write, -w         Update the input file (fmt only)
  --check             Exit non-zero if formatting differs (fmt only)
  --out, -o <path>    Build directory or benchmark output prefix
  --samples <count>   Timed samples per benchmark
  --warmup <count>    Warmup samples per benchmark
  --markdown          Emit benchmark Markdown
  --help, -h          Show this help
  --version, -V       Show the language version

Use "-" as the source path to read UTF-8 source from stdin.
`;
