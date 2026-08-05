import { describe, expect, it } from "vitest";
import {
  RIVER_OATH_FIXED_HZ,
  RIVER_OATH_HERO_IDS,
  RiverOathEngine,
  createRiverOathEngine,
} from "../../src/arcade/river-oath/index.js";
import { LANGUAGE_VERSION } from "../../src/language/metadata.js";
import {
  DEFAULT_RIVER_OATH_STEPS_PER_HERO,
  RIVER_OATH_BENCHMARK_SCENARIOS,
  RIVER_OATH_BENCHMARK_SCHEMA,
  RIVER_OATH_INPUT_SCHEMA,
  RIVER_OATH_MINIMUM_TOTAL_TICKS,
  createRiverOathBenchmarkReport,
  parseRiverOathBenchmarkArgs,
} from "../../scripts/benchmark-river-oath.mjs";

const API = {
  LANGUAGE_VERSION,
  RIVER_OATH_FIXED_HZ,
  RIVER_OATH_HERO_IDS,
  RiverOathEngine,
  createRiverOathEngine,
};

describe("River Oath release benchmark contract", () => {
  it("reports a fixed seed/input scenario for every published hero", () => {
    const report = createRiverOathBenchmarkReport(API, { stepsPerHero: 180 });

    expect(report.schema).toBe(RIVER_OATH_BENCHMARK_SCHEMA);
    expect(report.languageVersion).toBe(LANGUAGE_VERSION);
    expect(new Date(report.generatedAt).toISOString()).toBe(report.generatedAt);
    expect(report.configuration).toMatchObject({
      fixedStepHz: RIVER_OATH_FIXED_HZ,
      inputSchema: RIVER_OATH_INPUT_SCHEMA,
      measuredTicksPerHero: 180,
      minimumTotalTicks: RIVER_OATH_MINIMUM_TOTAL_TICKS,
    });
    expect(report.configuration.scenarios).toEqual(
      RIVER_OATH_BENCHMARK_SCENARIOS.map(
        ({ heroId, seed, inputScript, branchPreference }) => ({
          heroId,
          seed,
          inputScript,
          branchPreference: [...branchPreference],
        }),
      ),
    );
    expect(report.coverage).toMatchObject({
      heroes: 3,
      heroIds: [...RIVER_OATH_HERO_IDS],
      totalTicks: 540,
      minimumCoverageMet: false,
    });
    expect(new Set(report.heroes.map(({ seed }) => seed)).size).toBe(3);
    expect(new Set(report.heroes.map(({ inputScript }) => inputScript)).size).toBe(3);
  });

  it("matches replay digests after a byte-stable serialization restore", () => {
    const report = createRiverOathBenchmarkReport(API, { stepsPerHero: 360 });

    expect(report.aggregate).toMatchObject({
      totalTicks: 1_080,
      deterministicHeroes: 3,
      finiteHeroes: 3,
      boundedHeroes: 3,
      restoredHeroes: 3,
      validationPassed: true,
    });
    expect(report.passed).toBe(false);
    for (const hero of report.heroes) {
      expect(hero.measurement).toMatchObject({ ticks: 360 });
      expect(hero.measurement.elapsedMs).toBeGreaterThanOrEqual(0);
      expect(hero.measurement.ticksPerSecond).toBeGreaterThan(0);
      expect(hero.determinism).toMatchObject({
        matched: true,
        inputScript: hero.inputScript,
        digestAlgorithm: "sha256",
      });
      expect(hero.determinism.measuredDigest).toMatch(/^sha256:[\da-f]{64}$/u);
      expect(hero.determinism.replayDigest).toBe(hero.determinism.measuredDigest);
      expect(hero.serialization).toMatchObject({
        restoreAtTick: 180,
        roundTripByteStable: true,
        continuationMatched: true,
      });
      expect(hero.serialization.checkpointDigest).toMatch(/^sha256:[\da-f]{64}$/u);
      expect(hero.validation).toMatchObject({ finiteNumbers: true, insideArena: true });
      expect(hero.validation.inspectedSnapshots).toBeGreaterThanOrEqual(722);
      expect(hero.entities.withinLimits).toBe(true);
      expect(hero.entities.peak.enemies).toBeLessThanOrEqual(hero.entities.limits.enemies);
      expect(hero.entities.peak.pickups).toBeLessThanOrEqual(hero.entities.limits.pickups);
      expect(hero.entities.peak.effects).toBeLessThanOrEqual(hero.entities.limits.effects);
      expect(hero.entities.peak.total).toBeLessThanOrEqual(hero.entities.limits.total);
      expect(Number.isFinite(hero.finalSummary.player.x)).toBe(true);
      expect(Number.isFinite(hero.finalSummary.player.lane)).toBe(true);
    }
  });

  it("parses --pretty, --out, and bounded --steps without ambiguous values", () => {
    expect(
      parseRiverOathBenchmarkArgs([
        "--steps",
        String(DEFAULT_RIVER_OATH_STEPS_PER_HERO),
        "--pretty",
        "--out",
        "public/river-oath-benchmark-results.json",
      ]),
    ).toEqual({
      options: { stepsPerHero: DEFAULT_RIVER_OATH_STEPS_PER_HERO },
      pretty: true,
      output: "public/river-oath-benchmark-results.json",
    });
    expect(() => parseRiverOathBenchmarkArgs(["--steps", "0"])).toThrow(/between 1/u);
    expect(() => parseRiverOathBenchmarkArgs(["--steps", "3.5"])).toThrow(/integer/u);
    expect(() => parseRiverOathBenchmarkArgs(["--steps"])).toThrow(/requires a value/u);
    expect(() => parseRiverOathBenchmarkArgs(["--out", "--pretty"])).toThrow(/requires a path/u);
    expect(() => parseRiverOathBenchmarkArgs(["--unknown"])).toThrow(
      /Unknown benchmark option/u,
    );
  });
});
