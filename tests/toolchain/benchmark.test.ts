import { describe, expect, it } from "vitest";
import {
  formatBenchmarkMarkdown,
  runBenchmarkSuite,
  statistics,
} from "../../benchmarks/suite.js";
import {
  builtinBenchmarkFixtures,
  fixture,
} from "../../benchmarks/fixtures.js";

describe("benchmark reporting", () => {
  it("computes distribution statistics from samples", () => {
    const result = statistics([4, 1, 3, 2]);
    expect(result.samples).toBe(4);
    expect(result.minMs).toBe(1);
    expect(result.maxMs).toBe(4);
    expect(result.medianMs).toBe(2.5);
    expect(result.p95Ms).toBe(4);
    expect(result.meanMs).toBe(2.5);
    expect(result.valuesMs).toEqual([4, 1, 3, 2]);
  });

  it("renders measured fields and checksum in Markdown", () => {
    const timing = statistics([1, 2, 3]);
    const markdown = formatBenchmarkMarkdown({
      schema: "axirune-benchmark/1",
      checksum: "sha256:test",
      generatedAt: "2026-07-28T00:00:00.000Z",
      languageVersion: "0.3.0",
      runtime: {
        node: "v24",
        platform: "linux",
        architecture: "x64",
        cpu: "test",
        logicalCpus: 1,
      },
      configuration: { samples: 3, warmup: 1 },
      cases: [
        {
          name: "parse",
          fixture: {
            name: "fixture",
            bytes: 10,
            lines: 1,
            checksum: "sha256:fixture",
          },
          timing,
        },
      ],
    });
    expect(markdown).toContain("Input checksum: `sha256:test`");
    expect(markdown).toContain("| fixture | 10 | parse |");
    expect(markdown).toContain("3 measured samples");
  });

  it("measures parse, compile and run instead of returning canned values", async () => {
    const report = await runBenchmarkSuite({
      samples: 2,
      warmup: 0,
      fixtures: [
        fixture(
          "tiny",
          `space tiny
task main
  give Text
  yield «measured»
/task
launch main
`,
        ),
      ],
    });
    expect(report.cases.map((entry) => entry.name)).toEqual([
      "parse",
      "compile",
      "run",
    ]);
    for (const entry of report.cases) {
      expect(entry.timing.valuesMs).toHaveLength(2);
      expect(entry.timing.valuesMs.every((value) => value >= 0)).toBe(true);
    }
  });

  it("executes realistic invoice, transform and recursive fixtures", async () => {
    const realisticNames = new Set([
      "invoice-calculation",
      "data-transform",
      "recursive-factorial",
    ]);
    const fixtures = builtinBenchmarkFixtures().filter((entry) =>
      realisticNames.has(entry.name),
    );
    expect(fixtures.map((entry) => entry.name)).toEqual([
      "invoice-calculation",
      "data-transform",
      "recursive-factorial",
    ]);
    const report = await runBenchmarkSuite({
      samples: 1,
      warmup: 0,
      fixtures,
    });
    expect(report.cases).toHaveLength(9);
    expect(
      report.cases.every(
        (entry) => entry.timing.samples === 1 && entry.timing.valuesMs[0]! >= 0,
      ),
    ).toBe(true);
  });
});
