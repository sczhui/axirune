#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { fixture } from "./fixtures.js";
import {
  formatBenchmarkMarkdown,
  runBenchmarkSuite,
  type BenchmarkOptions,
} from "./suite.js";

export interface BenchmarkCliOptions extends BenchmarkOptions {
  jsonOnly: boolean;
  markdownOnly: boolean;
  outputPrefix?: string;
}

export async function runBenchmarkCommand(
  argv: readonly string[],
  write: (chunk: string) => void = (chunk) => process.stdout.write(chunk),
): Promise<number> {
  try {
    const options = await parseBenchmarkArguments(argv);
    const report = await runBenchmarkSuite(options);
    const json = `${JSON.stringify(report, null, 2)}\n`;
    const markdown = formatBenchmarkMarkdown(report);
    const prefix = resolve(options.outputPrefix ?? "public/benchmark-results");
    await mkdir(dirname(prefix), { recursive: true });
    await Promise.all([
      writeFile(`${prefix}.json`, json, "utf8"),
      writeFile(`${prefix}.md`, markdown, "utf8"),
    ]);

    if (options.jsonOnly) write(json);
    else if (options.markdownOnly) write(markdown);
    else write(`${json}\n${markdown}`);
    return 0;
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    return 2;
  }
}

async function parseBenchmarkArguments(
  argv: readonly string[],
): Promise<BenchmarkCliOptions> {
  const options: BenchmarkCliOptions = { jsonOnly: false, markdownOnly: false };
  let sourceFile: string | undefined;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]!;
    if (argument === "--json") options.jsonOnly = true;
    else if (argument === "--markdown") options.markdownOnly = true;
    else if (argument === "--samples") {
      options.samples = integer(argv[++index], "--samples", 1);
    } else if (argument === "--warmup") {
      options.warmup = integer(argv[++index], "--warmup", 0);
    } else if (argument === "--file") {
      sourceFile = requireValue(argv[++index], "--file");
    } else if (argument === "--out") {
      options.outputPrefix = requireValue(argv[++index], "--out");
    } else {
      throw new Error(`Unknown benchmark option: ${argument}`);
    }
  }
  if (options.jsonOnly && options.markdownOnly) {
    throw new Error("Choose either --json or --markdown, not both.");
  }
  if (sourceFile) {
    const source = await readFile(sourceFile, "utf8");
    options.fixtures = [fixture(basename(sourceFile), source)];
  }
  return options;
}

function requireValue(value: string | undefined, option: string): string {
  if (!value || value.startsWith("-")) throw new Error(`${option} requires a value.`);
  return value;
}

function integer(value: string | undefined, option: string, minimum: number): number {
  const actual = requireValue(value, option);
  if (!/^\d+$/u.test(actual) || Number(actual) < minimum) {
    throw new Error(`${option} must be an integer of at least ${minimum}.`);
  }
  return Number(actual);
}

const executedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : "";
if (import.meta.url === executedPath) {
  process.exitCode = await runBenchmarkCommand(process.argv.slice(2));
}
