import { createHash } from "node:crypto";
import { cpus } from "node:os";
import { performance } from "node:perf_hooks";
import {
  compileSource,
  LANGUAGE_VERSION,
  parseSource,
  runSource,
} from "../src/language/index.js";
import {
  builtinBenchmarkFixtures,
  type BenchmarkFixture,
} from "./fixtures.js";

export interface BenchmarkOptions {
  samples?: number;
  warmup?: number;
  fixtures?: BenchmarkFixture[];
}

export interface TimingStatistics {
  samples: number;
  minMs: number;
  maxMs: number;
  meanMs: number;
  medianMs: number;
  p95Ms: number;
  standardDeviationMs: number;
  operationsPerSecond: number;
  valuesMs: number[];
}

export interface BenchmarkCaseResult {
  name: string;
  fixture: {
    name: string;
    bytes: number;
    lines: number;
    checksum: string;
  };
  timing: TimingStatistics;
}

export interface BenchmarkReport {
  schema: "nexilume-benchmark/1";
  checksum: string;
  generatedAt: string;
  languageVersion: string;
  runtime: {
    node: string;
    platform: NodeJS.Platform;
    architecture: string;
    cpu: string;
    logicalCpus: number;
  };
  configuration: {
    samples: number;
    warmup: number;
  };
  cases: BenchmarkCaseResult[];
}

const DEFAULT_SAMPLES = 30;
const DEFAULT_WARMUP = 5;

export async function runBenchmarkSuite(
  options: BenchmarkOptions = {},
): Promise<BenchmarkReport> {
  const samples = options.samples ?? DEFAULT_SAMPLES;
  const warmup = options.warmup ?? DEFAULT_WARMUP;
  const fixtures = options.fixtures ?? builtinBenchmarkFixtures();
  validateConfiguration(samples, warmup, fixtures);

  const cases: BenchmarkCaseResult[] = [];
  for (const current of fixtures) {
    const compiled = compileSource(current.source);
    if (!compiled.ok) {
      const summary = compiled.diagnostics
        .filter((item) => item.severity === "error")
        .map((item) => `${item.code}: ${item.message}`)
        .join("; ");
      throw new Error(`Benchmark fixture ${current.name} does not compile: ${summary}`);
    }
    const preflight = await runSource(current.source, { mockTools: false });
    if (preflight.status !== "completed") {
      const summary = preflight.diagnostics
        .filter((item) => item.severity === "error")
        .map((item) => `${item.code}: ${item.message}`)
        .join("; ");
      throw new Error(`Benchmark fixture ${current.name} does not run: ${summary}`);
    }

    cases.push({
      name: "parse",
      fixture: fixtureMetadata(current),
      timing: await measure(samples, warmup, () => {
        parseSource(current.source);
      }),
    });
    cases.push({
      name: "compile",
      fixture: fixtureMetadata(current),
      timing: await measure(samples, warmup, () => {
        compileSource(current.source);
      }),
    });
    cases.push({
      name: "run",
      fixture: fixtureMetadata(current),
      timing: await measure(samples, warmup, async () => {
        const result = await runSource(current.source, { mockTools: false });
        if (result.status !== "completed") {
          throw new Error(
            `Benchmark fixture ${current.name} changed runtime status to ${result.status}.`,
          );
        }
      }),
    });
  }

  const cpuList = cpus();
  return {
    schema: "nexilume-benchmark/1",
    checksum: suiteChecksum(fixtures),
    generatedAt: new Date().toISOString(),
    languageVersion: LANGUAGE_VERSION,
    runtime: {
      node: process.version,
      platform: process.platform,
      architecture: process.arch,
      cpu: cpuList[0]?.model ?? "unknown",
      logicalCpus: cpuList.length,
    },
    configuration: { samples, warmup },
    cases,
  };
}

async function measure(
  samples: number,
  warmup: number,
  operation: () => void | Promise<void>,
): Promise<TimingStatistics> {
  for (let index = 0; index < warmup; index += 1) {
    await operation();
  }

  const values: number[] = [];
  for (let index = 0; index < samples; index += 1) {
    const start = performance.now();
    await operation();
    values.push(performance.now() - start);
  }
  return statistics(values);
}

export function statistics(values: readonly number[]): TimingStatistics {
  if (values.length === 0) throw new Error("At least one timing sample is required.");
  const sorted = [...values].sort((left, right) => left - right);
  const sum = values.reduce((total, value) => total + value, 0);
  const mean = sum / values.length;
  const variance =
    values.reduce((total, value) => total + (value - mean) ** 2, 0) / values.length;
  const percentileIndex = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil(sorted.length * 0.95) - 1),
  );
  const median =
    sorted.length % 2 === 0
      ? (sorted[sorted.length / 2 - 1]! + sorted[sorted.length / 2]!) / 2
      : sorted[Math.floor(sorted.length / 2)]!;

  return {
    samples: values.length,
    minMs: sorted[0]!,
    maxMs: sorted[sorted.length - 1]!,
    meanMs: mean,
    medianMs: median,
    p95Ms: sorted[percentileIndex]!,
    standardDeviationMs: Math.sqrt(variance),
    operationsPerSecond: mean === 0 ? Number.POSITIVE_INFINITY : 1_000 / mean,
    valuesMs: [...values],
  };
}

export function formatBenchmarkMarkdown(report: BenchmarkReport): string {
  const rows = report.cases.map((entry) => {
    const timing = entry.timing;
    return `| ${entry.fixture.name} | ${entry.fixture.bytes} | ${entry.name} | ${formatNumber(timing.meanMs)} | ${formatNumber(timing.medianMs)} | ${formatNumber(timing.p95Ms)} | ${formatNumber(timing.operationsPerSecond)} |`;
  });
  return [
    "# Nexilume benchmark",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    `Input checksum: \`${report.checksum}\``,
    "",
    `Runtime: ${report.runtime.node} · ${report.runtime.platform}/${report.runtime.architecture} · ${report.runtime.cpu}`,
    "",
    `Configuration: ${report.configuration.samples} measured samples after ${report.configuration.warmup} warmups.`,
    "",
    "| Fixture | Bytes | Operation | Mean (ms) | Median (ms) | p95 (ms) | ops/s |",
    "| --- | ---: | --- | ---: | ---: | ---: | ---: |",
    ...rows,
    "",
    "_Every value above is measured in this run; the report contains no precomputed timings._",
    "",
  ].join("\n");
}

function fixtureMetadata(current: BenchmarkFixture): BenchmarkCaseResult["fixture"] {
  return {
    name: current.name,
    bytes: current.bytes,
    lines: current.lines,
    checksum: current.checksum,
  };
}

function formatNumber(value: number): string {
  return Number.isFinite(value) ? value.toFixed(3) : "∞";
}

function validateConfiguration(
  samples: number,
  warmup: number,
  fixtures: readonly BenchmarkFixture[],
): void {
  if (!Number.isSafeInteger(samples) || samples < 1) {
    throw new Error("samples must be a positive integer.");
  }
  if (!Number.isSafeInteger(warmup) || warmup < 0) {
    throw new Error("warmup must be a non-negative integer.");
  }
  if (fixtures.length === 0) throw new Error("At least one benchmark fixture is required.");
}

function suiteChecksum(fixtures: readonly BenchmarkFixture[]): string {
  const hash = createHash("sha256");
  for (const current of fixtures) {
    hash.update(current.name, "utf8");
    hash.update("\0", "utf8");
    hash.update(current.checksum, "utf8");
    hash.update("\0", "utf8");
  }
  return `sha256:${hash.digest("hex")}`;
}
