import { describe, expect, it } from "vitest";
import {
  ARCADE_CLASSIC_GAME_IDS,
  ARCADE_CLASSICS_CATALOG,
} from "../../src/arcade/classics/catalog.js";
import {
  createClassicWorldState,
  restartClassicWorld,
  snapshotClassicWorld,
  startClassicWorld,
  stepClassicWorld,
} from "../../src/arcade/classics/micro-engine.js";
import { LANGUAGE_VERSION } from "../../src/language/metadata.js";
import {
  CLASSICS_BENCHMARK_SCHEMA,
  CLASSICS_FLAGSHIP_GAMES,
  CLASSICS_INPUT_SCRIPT,
  createClassicsBenchmarkReport,
  parseClassicsBenchmarkArgs,
} from "../../scripts/benchmark-classics.mjs";

const API = {
  ARCADE_CLASSICS_CATALOG,
  LANGUAGE_VERSION,
  createClassicWorldState,
  restartClassicWorld,
  snapshotClassicWorld,
  startClassicWorld,
  stepClassicWorld,
};

describe("Classic Worlds benchmark contract", () => {
  it("reports all 20 games as 18 measured shared worlds plus 2 dedicated flagships", () => {
    const report = createClassicsBenchmarkReport(API, {
      seed: 0x1357_2468,
      warmupSteps: 8,
      measuredSteps: 180,
    });

    expect(report.schema).toBe(CLASSICS_BENCHMARK_SCHEMA);
    expect(report.languageVersion).toBe(LANGUAGE_VERSION);
    expect(new Date(report.generatedAt).toISOString()).toBe(report.generatedAt);
    expect(report.configuration).toMatchObject({
      seed: 0x1357_2468,
      inputScript: CLASSICS_INPUT_SCRIPT,
      warmupSteps: 8,
      measuredSteps: 180,
    });
    expect(report.coverage).toEqual({
      catalogGames: 20,
      measuredSharedGames: 18,
      separatelyReportedFlagships: 2,
      gameIds: [...ARCADE_CLASSIC_GAME_IDS],
    });
    expect(report.sharedEngine.games).toHaveLength(18);
    expect(report.flagships).toHaveLength(2);

    const covered = [
      ...report.sharedEngine.games.map(({ gameId }) => gameId),
      ...report.flagships.map(({ gameId }) => gameId),
    ];
    expect(new Set(covered)).toEqual(new Set(ARCADE_CLASSIC_GAME_IDS));
    expect(new Set(covered).size).toBe(20);
    expect(report.flagships.map(({ gameId }) => gameId)).toEqual(
      CLASSICS_FLAGSHIP_GAMES.map(({ gameId }) => gameId),
    );
    expect(report.flagships.every(({ measurement }) => measurement === "reported-separately")).toBe(
      true,
    );
  });

  it("emits measured throughput, deterministic summaries, and bounded entity peaks per shared game", () => {
    const report = createClassicsBenchmarkReport(API, {
      seed: 0x2468_1357,
      warmupSteps: 4,
      measuredSteps: 240,
    });

    expect(report.passed).toBe(true);
    for (const game of report.sharedEngine.games) {
      expect(game.measurement.steps, game.gameId).toBe(240);
      expect(game.measurement.elapsedMs, game.gameId).toBeGreaterThanOrEqual(0);
      expect(game.measurement.stepsPerSecond, game.gameId).toBeGreaterThan(0);
      expect(game.determinism, game.gameId).toMatchObject({
        matched: true,
        inputScript: CLASSICS_INPUT_SCRIPT,
      });
      expect(game.determinism.finalDigest, game.gameId).toMatch(/^sha256:[\da-f]{64}$/u);
      expect(game.determinism.replayDigest, game.gameId).toBe(game.determinism.finalDigest);
      expect(Number.isFinite(game.finalSummary.player.x), game.gameId).toBe(true);
      expect(Number.isFinite(game.finalSummary.player.y), game.gameId).toBe(true);
      expect(Number.isFinite(game.finalSummary.score), game.gameId).toBe(true);
      expect(game.entities.withinLimits, game.gameId).toBe(true);
      expect(game.entities.peak.actors, game.gameId).toBeLessThanOrEqual(game.entities.limits.actors);
      expect(game.entities.peak.shots, game.gameId).toBeLessThanOrEqual(game.entities.limits.shots);
      expect(game.entities.peak.particles, game.gameId).toBeLessThanOrEqual(
        game.entities.limits.particles,
      );
      expect(game.entities.peak.trail, game.gameId).toBeLessThanOrEqual(game.entities.limits.trail);
      expect(game.entities.peak.boardCells, game.gameId).toBeLessThanOrEqual(
        game.entities.limits.boardCells,
      );
    }

    expect(report.sharedEngine.aggregate).toMatchObject({
      totalSteps: 18 * 240,
      deterministicGames: 18,
      gamesWithinEntityLimits: 18,
    });
    expect(report.sharedEngine.aggregate.stepsPerSecond).toBeGreaterThan(0);
  });

  it("keeps the deterministic summary stable while excluding timing from its digest", () => {
    const options = { seed: 424_242, warmupSteps: 0, measuredSteps: 120 };
    const first = createClassicsBenchmarkReport(API, options);
    const second = createClassicsBenchmarkReport(API, options);

    expect(
      first.sharedEngine.games.map(({ gameId, determinism, finalSummary, entities }) => ({
        gameId,
        digest: determinism.finalDigest,
        finalSummary,
        peak: entities.peak,
      })),
    ).toEqual(
      second.sharedEngine.games.map(({ gameId, determinism, finalSummary, entities }) => ({
        gameId,
        digest: determinism.finalDigest,
        finalSummary,
        peak: entities.peak,
      })),
    );
  });

  it("parses bounded CLI controls without accepting ambiguous values", () => {
    expect(
      parseClassicsBenchmarkArgs([
        "--steps",
        "900",
        "--warmup",
        "30",
        "--seed",
        "0x1234abcd",
        "--pretty",
        "--out",
        "public/classics-benchmark-results.json",
      ]),
    ).toEqual({
      options: { measuredSteps: 900, warmupSteps: 30, seed: 0x1234_abcd },
      pretty: true,
      output: "public/classics-benchmark-results.json",
    });
    expect(() => parseClassicsBenchmarkArgs(["--steps", "0"])).toThrow(/between 1/u);
    expect(() => parseClassicsBenchmarkArgs(["--seed", "not-a-number"])).toThrow(/integer/u);
    expect(() => parseClassicsBenchmarkArgs(["--unknown"])).toThrow(/Unknown benchmark option/u);
  });
});
