#!/usr/bin/env node

import { createHash } from "node:crypto";
import { realpathSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, extname, join, parse, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  CAPSULE_EXTENSION,
  compileSource,
  createCapsule,
  createCapsuleFromIR,
  decompileCapsule,
  formatSource,
  hasErrors,
  inspectCapsule,
  IR_VERSION,
  LANGUAGE_EXTENSION,
  LANGUAGE_NAME,
  LANGUAGE_VERSION,
  SUPPORTED_LANGUAGE_EXTENSIONS,
  parseSource,
  runProgram,
  runSource,
  verifyCapsule,
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

interface LoadedCapsule {
  bytes: Uint8Array;
  sourceName: string;
  absolutePath: string;
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
      throw new UsageError(
        `${args.command ?? "command"} requires an input file.`,
      );
    }
    if (args.command === "assemble") {
      return await assembleCommand(args, args.input, environment, stdout);
    }
    if (
      args.command === "verify" ||
      args.command === "inspect" ||
      args.command === "decompile" ||
      (args.command === "run" && extname(args.input).toLowerCase() === CAPSULE_EXTENSION)
    ) {
      const loaded = await loadCapsule(args.input, environment);
      return await executeCapsuleCommand(args, loaded, stdout, stderr);
    }
    const loaded = await loadSource(args.input, environment);
    return await executeSourceCommand(args, loaded, stdout, stderr);
  } catch (error) {
    const payload = {
      schema: "axirune-cli/error@1",
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
    case "compile":
      return compileCommand(args, loaded, stdout, stderr);
    case "build":
      return buildCommand(args, loaded, stdout, stderr);
    case "bench":
    case "verify":
    case "inspect":
    case "decompile":
    case "assemble":
    case null:
      throw new UsageError("A command is required.");
  }
}

async function executeCapsuleCommand(
  args: CliArguments,
  loaded: LoadedCapsule,
  stdout: (chunk: string) => void,
  stderr: (chunk: string) => void,
): Promise<number> {
  switch (args.command) {
    case "verify":
      return verifyCommand(args, loaded, stdout, stderr);
    case "inspect":
      return inspectCommand(args, loaded, stdout);
    case "decompile":
      return decompileCommand(args, loaded, stdout);
    case "run":
      return runCapsuleCommand(args, loaded, stdout, stderr);
    case "check":
    case "fmt":
    case "ast":
    case "ir":
    case "manifest":
    case "compile":
    case "assemble":
    case "build":
    case "bench":
    case null:
      throw new UsageError(`${args.command ?? "command"} requires Axirune source.`);
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
        schema: "axirune-cli/check@1",
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
        schema: "axirune-cli/run@1",
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
          schema: "axirune-cli/fmt@1",
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
          schema: "axirune-cli/fmt@1",
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
          schema: "axirune-cli/fmt@1",
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
        schema: "axirune-cli/fmt@1",
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
      schema: "axirune-ast/1",
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
      schema: "axirune-capability-manifest/1",
      source: loaded.sourceName,
      ok: compiled.ok,
      manifest: capabilityManifestFromIR(compiled.ir),
      diagnostics: compiled.diagnostics,
    }),
  );
  return compiled.ok ? 0 : 1;
}

async function compileCommand(
  args: CliArguments,
  loaded: LoadedSource,
  stdout: (chunk: string) => void,
  stderr: (chunk: string) => void,
): Promise<number> {
  rejectOptions(args, ["json", "out"]);
  const compiled = compileSource(loaded.source);
  if (!compiled.ok || hasErrors(compiled.diagnostics)) {
    if (args.json) {
      stdout(
        stableJson({
          schema: "axirune-cli/compile@1",
          command: "compile",
          source: loaded.sourceName,
          ok: false,
          diagnostics: compiled.diagnostics,
        }),
      );
    } else {
      printDiagnostics(compiled.diagnostics, loaded, stderr);
    }
    return 1;
  }
  const capsule = await createCapsule({
    source: loaded.source,
    sourceName: loaded.sourceName,
  });
  const output = args.out
    ? resolve(loaded.workingDirectory, args.out)
    : loaded.absolutePath
      ? join(dirname(loaded.absolutePath), `${parse(loaded.absolutePath).name}${CAPSULE_EXTENSION}`)
      : resolve(loaded.workingDirectory, `stdin${CAPSULE_EXTENSION}`);
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, capsule.bytes);
  if (args.json) {
    stdout(
      stableJson({
        schema: "axirune-cli/compile@1",
        command: "compile",
        source: loaded.sourceName,
        ok: true,
        artifact: output,
        contentId: capsule.contentId,
        semanticDigest: capsule.semanticDigest,
      }),
    );
  } else {
    stdout(`Compiled ${loaded.sourceName} → ${output}\n`);
    stdout(`  content ${capsule.contentId}\n`);
    stdout(`  semantic ${capsule.semanticDigest}\n`);
  }
  return 0;
}

async function assembleCommand(
  args: CliArguments,
  input: string,
  environment: CliEnvironment,
  stdout: (chunk: string) => void,
): Promise<number> {
  rejectOptions(args, ["json", "out"]);
  if (input === "-") {
    throw new UsageError("Checked IR assembly from stdin is not supported.");
  }
  if (!input.toLowerCase().endsWith(".air.json")) {
    throw new UsageError("assemble expects a checked .air.json artifact.");
  }
  const cwd = resolve(environment.cwd ?? process.cwd());
  const absoluteInput = resolve(cwd, input);
  let document: unknown;
  try {
    document = JSON.parse(await readFile(absoluteInput, "utf8"));
  } catch (error) {
    throw new UsageError(
      `Cannot parse checked IR JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  const ir =
    document !== null &&
    typeof document === "object" &&
    !Array.isArray(document) &&
    Object.hasOwn(document, "ir")
      ? (document as Record<string, unknown>).ir
      : document;
  const capsule = await createCapsuleFromIR({ ir });
  const output = args.out
    ? resolve(cwd, args.out)
    : resolve(cwd, `${input.slice(0, -".air.json".length)}${CAPSULE_EXTENSION}`);
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, capsule.bytes);
  if (args.json) {
    stdout(
      stableJson({
        schema: "axirune-cli/assemble@1",
        command: "assemble",
        source: input,
        ok: true,
        artifact: output,
        contentId: capsule.contentId,
        semanticDigest: capsule.semanticDigest,
        sourceEmbedded: false,
      }),
    );
  } else {
    stdout(`Assembled ${input} → ${output}\n`);
    stdout(`  content ${capsule.contentId}\n`);
    stdout("  source projection omitted\n");
  }
  return 0;
}

async function verifyCommand(
  args: CliArguments,
  loaded: LoadedCapsule,
  stdout: (chunk: string) => void,
  stderr: (chunk: string) => void,
): Promise<number> {
  rejectOptions(args, ["json"]);
  const result = await verifyCapsule(loaded.bytes);
  if (args.json) {
    stdout(
      stableJson({
        schema: "axirune-cli/verify@1",
        command: "verify",
        source: loaded.sourceName,
        ...result,
      }),
    );
  } else if (result.ok) {
    stdout(`Verified ${loaded.sourceName}.\n`);
    stdout(`  content ${result.contentId}\n`);
    stdout(`  semantic ${result.semanticDigest}\n`);
    stdout("  integrity verified; publisher identity not authenticated\n");
  } else {
    for (const issue of result.issues) stderr(`${issue.code}: ${issue.message}\n`);
  }
  return result.ok ? 0 : 1;
}

async function inspectCommand(
  args: CliArguments,
  loaded: LoadedCapsule,
  stdout: (chunk: string) => void,
): Promise<number> {
  rejectOptions(args, ["json"]);
  const result = await inspectCapsule(loaded.bytes);
  const envelope = {
    schema: "axirune-cli/inspect@1",
    command: "inspect",
    artifact: loaded.sourceName,
    ok: true,
    ...result,
  };
  stdout(stableJson(envelope));
  return 0;
}

async function decompileCommand(
  args: CliArguments,
  loaded: LoadedCapsule,
  stdout: (chunk: string) => void,
): Promise<number> {
  rejectOptions(args, ["json", "out"]);
  const source = await decompileCapsule(loaded.bytes);
  if (!args.out) {
    if (args.json) {
      stdout(
        stableJson({
          schema: "axirune-cli/decompile@1",
          command: "decompile",
          source: loaded.sourceName,
          ok: true,
          code: source,
        }),
      );
    } else {
      stdout(source);
    }
    return 0;
  }
  const output = resolve(loaded.workingDirectory, args.out);
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, source, "utf8");
  if (args.json) {
    stdout(
      stableJson({
        schema: "axirune-cli/decompile@1",
        command: "decompile",
        source: loaded.sourceName,
        ok: true,
        output,
      }),
    );
  } else {
    stdout(`Decompiled ${loaded.sourceName} → ${output}\n`);
  }
  return 0;
}

async function runCapsuleCommand(
  args: CliArguments,
  loaded: LoadedCapsule,
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
  const inspected = await inspectCapsule(loaded.bytes);
  const host = await createHostAdapters({
    cwd: loaded.workingDirectory,
    readRoots: args.allowRead,
    writeRoots: args.allowWrite,
    networkHosts: args.allowNet,
  });
  const input = args.inputJson === null ? undefined : parseInputJson(args.inputJson);
  const result = await runProgram(inspected.ir, {
    mockTools: false,
    tools: host.tools,
    capabilities: host.capabilities,
    ...(inspected.metadata.program.entry.kind === "frame"
      ? { entry: inspected.metadata.program.entry.frame }
      : {}),
    ...(input ? { input } : {}),
  });
  const ok = result.status === "completed" && !hasErrors(result.diagnostics);
  if (args.json) {
    stdout(
      stableJson({
        schema: "axirune-cli/run@1",
        command: "run",
        source: loaded.sourceName,
        capsule: inspected.contentId,
        ok,
        ...result,
      }),
    );
  } else {
    for (const diagnostic of result.diagnostics) {
      stderr(`${diagnostic.code}: ${diagnostic.message}\n`);
    }
    for (const emission of result.emissions) stdout(`${renderValue(emission)}\n`);
    if (result.emissions.length === 0 && result.value !== undefined) {
      stdout(`${renderValue(result.value)}\n`);
    }
    if (!ok) stderr(`Run ${result.status}.\n`);
  }
  return ok ? 0 : 1;
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
          schema: "axirune-cli/build@1",
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
  const canonicalCompiled = compileSource(formatted.code);
  if (!canonicalCompiled.ok || hasErrors(canonicalCompiled.diagnostics)) {
    throw new Error("Canonical source failed the build invariant.");
  }
  const capsule = await createCapsule({
    source: loaded.source,
    sourceName: loaded.sourceName,
  });
  const artifacts = {
    source: join(outputDirectory, `${stem}${LANGUAGE_EXTENSION}`),
    ast: join(outputDirectory, `${stem}.ast.json`),
    ir: join(outputDirectory, `${stem}.air.json`),
    manifest: join(outputDirectory, `${stem}.capabilities.json`),
    capsule: join(outputDirectory, `${stem}${CAPSULE_EXTENSION}`),
    build: join(outputDirectory, `${stem}.build.json`),
  };
  const contents = {
    source: formatted.code,
    ast: stableJson({ schema: "axirune-ast/1", program: canonicalCompiled.program }),
    ir: stableJson({ schema: IR_VERSION, ir: canonicalCompiled.ir }),
    manifest: stableJson({
      schema: "axirune-capability-manifest/1",
      manifest: capabilityManifestFromIR(canonicalCompiled.ir),
    }),
    capsule: capsule.bytes,
  };
  const buildRecord = {
    schema: "axirune-build/1",
    languageVersion: LANGUAGE_VERSION,
    source: loaded.sourceName,
    sourceChecksum: sha256(contents.source),
    capsuleContentId: capsule.contentId,
    semanticDigest: capsule.semanticDigest,
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
    writeFile(artifacts.capsule, contents.capsule),
    writeFile(artifacts.build, stableJson(buildRecord), "utf8"),
  ]);

  if (args.json) {
    stdout(
      stableJson({
        schema: "axirune-cli/build@1",
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
  const extension = extname(input).toLowerCase();
  if (!SUPPORTED_LANGUAGE_EXTENSIONS.includes(extension as (typeof SUPPORTED_LANGUAGE_EXTENSIONS)[number])) {
    throw new UsageError(
      `Axirune source files use ${LANGUAGE_EXTENSION}; legacy .nxl files are also accepted.`,
    );
  }
  const absolutePath = resolve(environment.cwd ?? process.cwd(), input);
  return {
    source: await readFile(absolutePath, "utf8"),
    sourceName: input,
    absolutePath,
    workingDirectory: resolve(environment.cwd ?? process.cwd()),
  };
}

async function loadCapsule(
  input: string,
  environment: CliEnvironment,
): Promise<LoadedCapsule> {
  if (input === "-") {
    throw new UsageError("Binary capsule input from stdin is not supported.");
  }
  if (extname(input).toLowerCase() !== CAPSULE_EXTENSION) {
    throw new UsageError(`Axirune execution capsules use ${CAPSULE_EXTENSION}.`);
  }
  const absolutePath = resolve(environment.cwd ?? process.cwd(), input);
  return {
    bytes: new Uint8Array(await readFile(absolutePath)),
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

function sha256(value: string | Uint8Array): string {
  const hash = createHash("sha256");
  if (typeof value === "string") hash.update(value, "utf8");
  else hash.update(value);
  return `sha256:${hash.digest("hex")}`;
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
