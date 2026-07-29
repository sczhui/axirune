#!/usr/bin/env node

import { createHash } from "node:crypto";
import { realpathSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, extname, join, parse, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  compileSource,
  formatSource,
  hasErrors,
  IR_VERSION,
  LANGUAGE_EXTENSION,
  LANGUAGE_NAME,
  LANGUAGE_VERSION,
  parseSource,
  runSource,
  type Diagnostic,
  type RuntimeValue,
} from "../language/index.js";
import { fixture } from "../../benchmarks/fixtures.js";
import {
  formatBenchmarkMarkdown,
  runBenchmarkSuite,
} from "../../benchmarks/suite.js";
import {
  HELP_TEXT,
  parseArguments,
  UsageError,
  type CliArguments,
} from "./arguments.js";
import { formatDiagnostics, stableJson } from "./output.js";
import { capabilityManifestFromIR } from "./manifest.js";
import { createHostAdapters } from "./host-adapters.js";

export interface CliEnvironment {
  cwd?: string;
  stdin?: string;
  stdout?: (chunk: string) => void;
  stderr?: (chunk: string) => void;
}

interface LoadedSource {
  source: string;
  sourceName: string;
  absolutePath: string | null;
  workingDirectory: string;
}

export async function runCli(
  argv: readonly string[],
  environment: CliEnvironment = {},
): Promise<number> {
  const stdout = environment.stdout ?? ((chunk: string) => process.stdout.write(chunk));
  const stderr = environment.stderr ?? ((chunk: string) => process.stderr.write(chunk));
  let args: CliArguments;

  try {
    args = parseArguments(argv);
  } catch (error) {
    stderr(`${messageOf(error)}\n\n${HELP_TEXT}`);
    return error instanceof UsageError ? error.exitCode : 2;
  }

  if (args.help || (!args.command && !args.version)) {
    stdout(HELP_TEXT);
    return 0;
  }
  if (args.version) {
    stdout(`${LANGUAGE_NAME} ${LANGUAGE_VERSION}\n`);
    return 0;
  }

  try {
    if (args.command === "bench") {
      return await benchCommand(args, environment.cwd, stdout);
    }
    if (!args.input) {
      throw new UsageError(`${args.command ?? "command"} requires a .nxl source file.`);
    }
    const loaded = await loadSource(args.input, environment);
    return await executeSourceCommand(args, loaded, stdout, stderr);
  } catch (error) {
    const payload = {
      schema: "nexilume-cli/error@1",
      ok: false,
      error: messageOf(error),
    };
    if (args.json) stdout(stableJson(payload));
    else stderr(`${payload.error}\n`);
    return error instanceof UsageError ? error.exitCode : 2;
  }
}

async function executeSourceCommand(
  args: CliArguments,
  loaded: LoadedSource,
  stdout: (chunk: string) => void,
  stderr: (chunk: string) => void,
): Promise<number> {
  switch (args.command) {
    case "check":
      return checkCommand(args, loaded, stdout, stderr);
    case "run":
      return runCommand(args, loaded, stdout, stderr);
    case "fmt":
      return formatCommand(args, loaded, stdout, stderr);
    case "ast": {
      rejectOptions(args, ["json"]);
      return astCommand(loaded, stdout);
    }
    case "ir": {
      rejectOptions(args, ["json"]);
      return irCommand(loaded, stdout);
    }
    case "manifest": {
      rejectOptions(args, ["json"]);
      return manifestCommand(loaded, stdout);
    }
    case "build":
      return buildCommand(args, loaded, stdout, stderr);
    case "bench":
    case null:
      throw new UsageError("A command is required.");
  }
}

function checkCommand(
  args: CliArguments,
  loaded: LoadedSource,
  stdout: (chunk: string) => void,
  stderr: (chunk: string) => void,
): number {
  rejectOptions(args, ["json"]);
  const compiled = compileSource(loaded.source);
  const ok = compiled.ok && !hasErrors(compiled.diagnostics);
  if (args.json) {
    stdout(
      stableJson({
        schema: "nexilume-cli/check@1",
        command: "check",
        source: loaded.sourceName,
        ok,
        diagnostics: compiled.diagnostics,
      }),
    );
  } else {
    printDiagnostics(compiled.diagnostics, loaded, stderr);
    if (ok) stdout(`Checked ${loaded.sourceName}: no errors.\n`);
  }
  return ok ? 0 : 1;
}

async function runCommand(
  args: CliArguments,
  loaded: LoadedSource,
  stdout: (chunk: string) => void,
  stderr: (chunk: string) => void,
): Promise<number> {
  rejectOptions(args, [
    "json",
    "allow-read",
    "allow-write",
    "allow-net",
    "input-json",
  ]);
  const host = await createHostAdapters({
    cwd: loaded.workingDirectory,
    readRoots: args.allowRead,
    writeRoots: args.allowWrite,
    networkHosts: args.allowNet,
  });
  const input = args.inputJson === null ? undefined : parseInputJson(args.inputJson);
  const result = await runSource(loaded.source, {
    mockTools: false,
    tools: host.tools,
    capabilities: host.capabilities,
    ...(input ? { input } : {}),
  });
  const ok = result.status === "completed" && !hasErrors(result.diagnostics);
  if (args.json) {
    stdout(
      stableJson({
        schema: "nexilume-cli/run@1",
        command: "run",
        source: loaded.sourceName,
        ok,
        ...result,
      }),
    );
  } else {
    printDiagnostics(result.diagnostics, loaded, stderr);
    for (const emission of result.emissions) {
      stdout(`${renderValue(emission)}\n`);
    }
    if (result.emissions.length === 0 && result.value !== undefined) {
      stdout(`${renderValue(result.value)}\n`);
    }
    if (!ok) stderr(`Run ${result.status}.\n`);
  }
  return ok ? 0 : 1;
}

async function formatCommand(
  args: CliArguments,
  loaded: LoadedSource,
  stdout: (chunk: string) => void,
  stderr: (chunk: string) => void,
): Promise<number> {
  rejectOptions(args, ["json", "write", "check"]);
  const formatted = formatSource(loaded.source);
  const invalid = hasErrors(formatted.diagnostics);
  const changed = formatted.code !== loaded.source;
  if (!args.json) printDiagnostics(formatted.diagnostics, loaded, stderr);
  if (invalid) {
    if (args.json) {
      stdout(
        stableJson({
          schema: "nexilume-cli/fmt@1",
          command: "fmt",
          source: loaded.sourceName,
          ok: false,
          changed,
          written: false,
          diagnostics: formatted.diagnostics,
        }),
      );
    }
    return 1;
  }
  if (args.write) {
    if (!loaded.absolutePath) throw new UsageError("--write cannot be used with stdin.");
    if (changed) await writeFile(loaded.absolutePath, formatted.code, "utf8");
    if (args.json) {
      stdout(
        stableJson({
          schema: "nexilume-cli/fmt@1",
          command: "fmt",
          source: loaded.sourceName,
          ok: true,
          changed,
          written: changed,
          diagnostics: formatted.diagnostics,
        }),
      );
    } else {
      stdout(`${changed ? "Formatted" : "Unchanged"} ${loaded.sourceName}.\n`);
    }
    return 0;
  }
  if (args.check) {
    if (args.json) {
      stdout(
        stableJson({
          schema: "nexilume-cli/fmt@1",
          command: "fmt",
          source: loaded.sourceName,
          ok: !changed,
          changed,
          written: false,
          diagnostics: formatted.diagnostics,
        }),
      );
    } else {
      stdout(`${changed ? "Needs formatting" : "Formatted"} ${loaded.sourceName}.\n`);
    }
    return changed ? 1 : 0;
  }
  if (args.json) {
    stdout(
      stableJson({
        schema: "nexilume-cli/fmt@1",
        command: "fmt",
        source: loaded.sourceName,
        ok: true,
        changed,
        written: false,
        code: formatted.code,
        diagnostics: formatted.diagnostics,
      }),
    );
  } else {
    stdout(formatted.code);
  }
  return 0;
}

function astCommand(loaded: LoadedSource, stdout: (chunk: string) => void): number {
  const parsed = parseSource(loaded.source);
  stdout(
    stableJson({
      schema: "nexilume-ast/1",
      source: loaded.sourceName,
      program: parsed.program,
      diagnostics: parsed.diagnostics,
    }),
  );
  return hasErrors(parsed.diagnostics) ? 1 : 0;
}

function irCommand(loaded: LoadedSource, stdout: (chunk: string) => void): number {
  const compiled = compileSource(loaded.source);
  stdout(
    stableJson({
      schema: IR_VERSION,
      source: loaded.sourceName,
      ok: compiled.ok,
      ir: compiled.ir,
      diagnostics: compiled.diagnostics,
    }),
  );
  return compiled.ok ? 0 : 1;
}

function manifestCommand(loaded: LoadedSource, stdout: (chunk: string) => void): number {
  const compiled = compileSource(loaded.source);
  stdout(
    stableJson({
      schema: "nexilume-capability-manifest/1",
      source: loaded.sourceName,
      ok: compiled.ok,
      manifest: capabilityManifestFromIR(compiled.ir),
      diagnostics: compiled.diagnostics,
    }),
  );
  return compiled.ok ? 0 : 1;
}

async function buildCommand(
  args: CliArguments,
  loaded: LoadedSource,
  stdout: (chunk: string) => void,
  stderr: (chunk: string) => void,
): Promise<number> {
  rejectOptions(args, ["json", "out"]);
  const compiled = compileSource(loaded.source);
  const formatted = formatSource(loaded.source);
  const diagnostics = mergeDiagnostics(compiled.diagnostics, formatted.diagnostics);
  if (!compiled.ok || hasErrors(diagnostics)) {
    if (args.json) {
      stdout(
        stableJson({
          schema: "nexilume-cli/build@1",
          command: "build",
          source: loaded.sourceName,
          ok: false,
          diagnostics,
          artifacts: [],
        }),
      );
    } else {
      printDiagnostics(diagnostics, loaded, stderr);
    }
    return 1;
  }

  const outputDirectory = args.out
    ? resolve(loaded.workingDirectory, args.out)
    : resolve(dirname(loaded.absolutePath ?? loaded.workingDirectory), "build");
  const stem = loaded.absolutePath ? parse(loaded.absolutePath).name : "stdin";
  await mkdir(outputDirectory, { recursive: true });
  const artifacts = {
    source: join(outputDirectory, `${stem}${LANGUAGE_EXTENSION}`),
    ast: join(outputDirectory, `${stem}.ast.json`),
    ir: join(outputDirectory, `${stem}.air.json`),
    manifest: join(outputDirectory, `${stem}.capabilities.json`),
    build: join(outputDirectory, `${stem}.build.json`),
  };
  const contents = {
    source: formatted.code,
    ast: stableJson({ schema: "nexilume-ast/1", program: compiled.program }),
    ir: stableJson({ schema: IR_VERSION, ir: compiled.ir }),
    manifest: stableJson({
      schema: "nexilume-capability-manifest/1",
      manifest: capabilityManifestFromIR(compiled.ir),
    }),
  };
  const buildRecord = {
    schema: "nexilume-build/1",
    languageVersion: LANGUAGE_VERSION,
    source: loaded.sourceName,
    sourceChecksum: sha256(contents.source),
    artifacts: Object.fromEntries(
      Object.entries(artifacts)
        .filter(([key]) => key !== "build")
        .map(([key, value]) => [key, basename(value)]),
    ),
    checksums: Object.fromEntries(
      Object.entries(contents).map(([key, value]) => [key, sha256(value)]),
    ),
  };

  await Promise.all([
    writeFile(artifacts.source, contents.source, "utf8"),
    writeFile(artifacts.ast, contents.ast, "utf8"),
    writeFile(artifacts.ir, contents.ir, "utf8"),
    writeFile(artifacts.manifest, contents.manifest, "utf8"),
    writeFile(artifacts.build, stableJson(buildRecord), "utf8"),
  ]);

  if (args.json) {
    stdout(
      stableJson({
        schema: "nexilume-cli/build@1",
        command: "build",
        source: loaded.sourceName,
        ok: true,
        outputDirectory,
        artifacts,
        diagnostics,
      }),
    );
  } else {
    stdout(`Built ${loaded.sourceName} → ${outputDirectory}\n`);
    for (const artifact of Object.values(artifacts)) stdout(`  ${artifact}\n`);
  }
  return 0;
}

async function benchCommand(
  args: CliArguments,
  cwd: string | undefined,
  stdout: (chunk: string) => void,
): Promise<number> {
  rejectOptions(args, ["json", "markdown", "out", "samples", "warmup", "input"]);
  if (args.json && args.markdown) {
    throw new UsageError("bench accepts either --json or --markdown, not both.");
  }
  const fixtures = args.input
    ? [
        fixture(
          basename(args.input),
          await readFile(resolve(cwd ?? process.cwd(), args.input), "utf8"),
        ),
      ]
    : undefined;
  const report = await runBenchmarkSuite({
    samples: args.samples ?? undefined,
    warmup: args.warmup ?? undefined,
    fixtures,
  });
  const json = stableJson(report);
  const markdown = formatBenchmarkMarkdown(report);

  if (args.out) {
    const prefix = resolve(cwd ?? process.cwd(), args.out);
    await mkdir(dirname(prefix), { recursive: true });
    await Promise.all([
      writeFile(`${prefix}.json`, json, "utf8"),
      writeFile(`${prefix}.md`, markdown, "utf8"),
    ]);
    if (args.json) stdout(json);
    else if (args.markdown) stdout(markdown);
    else stdout(`Wrote ${prefix}.json and ${prefix}.md\n`);
  } else if (args.json) stdout(json);
  else if (args.markdown) stdout(markdown);
  else stdout(`${json}\n${markdown}`);
  return 0;
}

async function loadSource(
  input: string,
  environment: CliEnvironment,
): Promise<LoadedSource> {
  if (input === "-") {
    const source = environment.stdin ?? (await readStdin());
    return {
      source,
      sourceName: "<stdin>",
      absolutePath: null,
      workingDirectory: resolve(environment.cwd ?? process.cwd()),
    };
  }
  if (extname(input).toLowerCase() !== LANGUAGE_EXTENSION) {
    throw new UsageError(`Nexilume source files use the ${LANGUAGE_EXTENSION} extension.`);
  }
  const absolutePath = resolve(environment.cwd ?? process.cwd(), input);
  return {
    source: await readFile(absolutePath, "utf8"),
    sourceName: input,
    absolutePath,
    workingDirectory: resolve(environment.cwd ?? process.cwd()),
  };
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

function mergeDiagnostics(
  left: readonly Diagnostic[],
  right: readonly Diagnostic[],
): Diagnostic[] {
  const seen = new Set<string>();
  return [...left, ...right].filter((item) => {
    const key = `${item.code}:${item.span.start.offset}:${item.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function printDiagnostics(
  diagnostics: readonly Diagnostic[],
  loaded: LoadedSource,
  stderr: (chunk: string) => void,
): void {
  if (diagnostics.length === 0) return;
  stderr(
    `${formatDiagnostics(diagnostics, {
      source: loaded.source,
      sourceName: loaded.sourceName,
    })}\n`,
  );
}

function rejectOptions(args: CliArguments, allowed: readonly string[]): void {
  const used: [string, boolean][] = [
    ["json", args.json],
    ["write", args.write],
    ["check", args.check],
    ["markdown", args.markdown],
    ["out", args.out !== null],
    ["samples", args.samples !== null],
    ["warmup", args.warmup !== null],
    ["allow-read", args.allowRead.length > 0],
    ["allow-write", args.allowWrite.length > 0],
    ["allow-net", args.allowNet.length > 0],
    ["input-json", args.inputJson !== null],
  ];
  const rejected = used.find(([name, enabled]) => enabled && !allowed.includes(name));
  if (rejected) throw new UsageError(`--${rejected[0]} is not valid for ${args.command}.`);
}

function renderValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (value === undefined) return "nothing";
  return JSON.stringify(value);
}

function sha256(value: string): string {
  return `sha256:${createHash("sha256").update(value, "utf8").digest("hex")}`;
}

function parseInputJson(value: string): Readonly<Record<string, RuntimeValue>> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch (error) {
    throw new UsageError(
      `--input-json is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new UsageError("--input-json must contain a JSON object.");
  }
  return normalizeInputObject(parsed as Record<string, unknown>, 0);
}

function normalizeInputObject(
  value: Record<string, unknown>,
  depth: number,
): Readonly<Record<string, RuntimeValue>> {
  if (depth > 64) throw new UsageError("--input-json exceeds the maximum nesting depth.");
  const normalized: Record<string, RuntimeValue> = Object.create(null) as Record<
    string,
    RuntimeValue
  >;
  for (const [key, entry] of Object.entries(value)) {
    if (key === "__proto__" || key === "prototype" || key === "constructor") {
      throw new UsageError(`--input-json contains unsafe key ${JSON.stringify(key)}.`);
    }
    normalized[key] = normalizeInputValue(entry, depth + 1);
  }
  return normalized;
}

function normalizeInputValue(value: unknown, depth: number): RuntimeValue {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean" ||
    (typeof value === "number" && Number.isFinite(value))
  ) {
    return value;
  }
  if (Array.isArray(value)) {
    if (depth > 64) throw new UsageError("--input-json exceeds the maximum nesting depth.");
    return value.map((entry) => normalizeInputValue(entry, depth + 1));
  }
  if (typeof value === "object") {
    return normalizeInputObject(value as Record<string, unknown>, depth);
  }
  throw new UsageError("--input-json contains a value that cannot be represented.");
}

function messageOf(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

const executedPath = process.argv[1] ? realpathSync(resolve(process.argv[1])) : "";
if (fileURLToPath(import.meta.url) === executedPath) {
  process.exitCode = await runCli(process.argv.slice(2));
}
