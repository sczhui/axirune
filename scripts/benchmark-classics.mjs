#!/usr/bin/env node

import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

export const CLASSICS_BENCHMARK_SCHEMA = "axirune-benchmark/classics/1";
export const CLASSICS_INPUT_SCRIPT = "classic-input-script/1";
export const DEFAULT_CLASSICS_SEED = 0x4a17c0de;
export const DEFAULT_CLASSICS_WARMUP_STEPS = 600;
export const DEFAULT_CLASSICS_MEASURED_STEPS = 6_000;

export const CLASSICS_ENTITY_LIMITS = Object.freeze({
  actors: 512,
  shots: 512,
  particles: 2_048,
  trail: 4_096,
  boardCells: 512,
});

export const CLASSICS_FLAGSHIP_GAMES = Object.freeze([
  Object.freeze({
    gameId: "vector-siege",
    implementation: "src/arcade/shooter-engine.ts",
    deterministicContract: "tests/arcade/shooter-engine.test.ts",
  }),
  Object.freeze({
    gameId: "prism-bastion",
    implementation: "src/arcade/breaker-engine.ts",
    deterministicContract: "tests/arcade/breaker-engine.test.ts",
  }),
]);

const FLAGSHIP_IDS = new Set(CLASSICS_FLAGSHIP_GAMES.map(({ gameId }) => gameId));

const GRAVITY_BY_GAME = Object.freeze({
  "aetherstep-foundry": 1_680,
  "alloy-tempest": 1_420,
  "harbor-brawl": 920,
  "moonthread-ronin": 1_540,
  "orbit-foundry": 460,
});

/**
 * Benchmark all shared Classic Worlds engines. The injected API makes the
 * report contract testable from TypeScript source while the CLI deliberately
 * loads only precompiled JavaScript from dist-toolchain.
 */
export function createClassicsBenchmarkReport(api, options = {}) {
  assertClassicApi(api);
  const configuration = normalizeOptions(options);
  const catalog = [...api.ARCADE_CLASSICS_CATALOG];
  const sharedGames = catalog.filter(({ id }) => !FLAGSHIP_IDS.has(id));
  const flagships = CLASSICS_FLAGSHIP_GAMES.map((flagship) => {
    const game = catalog.find(({ id }) => id === flagship.gameId);
    if (!game) throw new Error(`Catalog is missing flagship ${flagship.gameId}.`);
    return Object.freeze({
      ...flagship,
      title: game.title,
      engineFamily: game.engineFamily,
      fixedStepHz: game.fixedStepHz,
      tier: "dedicated-engine",
      measurement: "reported-separately",
    });
  });

  if (catalog.length !== 20 || sharedGames.length !== 18 || flagships.length !== 2) {
    throw new Error(
      `Classic benchmark expects a 20-game catalog split into 18 shared worlds and 2 flagships; received ${catalog.length}/${sharedGames.length}/${flagships.length}.`,
    );
  }

  const games = sharedGames.map((game) => benchmarkSharedGame(api, game, configuration));
  const totalSteps = games.reduce((sum, game) => sum + game.measurement.steps, 0);
  const elapsedMs = games.reduce((sum, game) => sum + game.measurement.elapsedMs, 0);
  const maxObservedEntities = games.reduce(
    (maximum, game) => Math.max(maximum, game.entities.peak.total),
    0,
  );
  const gameIds = catalog.map(({ id }) => id);

  return {
    schema: CLASSICS_BENCHMARK_SCHEMA,
    generatedAt: new Date().toISOString(),
    languageVersion: api.LANGUAGE_VERSION,
    runtime: {
      node: process.version,
      platform: process.platform,
      architecture: process.arch,
      clock: "process.hrtime.bigint",
    },
    configuration: {
      seed: configuration.seed,
      inputScript: CLASSICS_INPUT_SCRIPT,
      warmupSteps: configuration.warmupSteps,
      measuredSteps: configuration.measuredSteps,
      entityLimits: CLASSICS_ENTITY_LIMITS,
    },
    coverage: {
      catalogGames: catalog.length,
      measuredSharedGames: games.length,
      separatelyReportedFlagships: flagships.length,
      gameIds,
    },
    sharedEngine: {
      implementation: "src/arcade/classics/micro-engine.ts",
      games,
      aggregate: {
        totalSteps,
        elapsedMs: round(elapsedMs, 3),
        stepsPerSecond: rate(totalSteps, elapsedMs),
        deterministicGames: games.filter(({ determinism }) => determinism.matched).length,
        gamesWithinEntityLimits: games.filter(({ entities }) => entities.withinLimits).length,
        maxObservedEntities,
      },
    },
    flagships,
    passed:
      games.every(({ determinism }) => determinism.matched) &&
      games.every(({ entities }) => entities.withinLimits),
  };
}

export function parseClassicsBenchmarkArgs(argv) {
  const options = {};
  let pretty = false;
  let output;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--pretty") {
      pretty = true;
      continue;
    }
    if (argument === "--out") {
      const value = argv[index + 1];
      if (value === undefined || value.startsWith("-")) throw new Error("--out requires a path.");
      output = value;
      index += 1;
      continue;
    }
    if (argument !== "--steps" && argument !== "--warmup" && argument !== "--seed") {
      throw new Error(`Unknown benchmark option: ${argument}`);
    }
    const value = argv[index + 1];
    if (value === undefined) throw new Error(`${argument} requires a value.`);
    index += 1;
    if (argument === "--steps") options.measuredSteps = parseInteger(value, argument, 1, 1_000_000);
    if (argument === "--warmup") options.warmupSteps = parseInteger(value, argument, 0, 100_000);
    if (argument === "--seed") options.seed = parseInteger(value, argument, 1, 0xffff_ffff);
  }
  return { options, pretty, output };
}

export async function loadCompiledClassicsApi() {
  const catalogUrl = new URL("../dist-toolchain/src/arcade/classics/catalog.js", import.meta.url);
  const engineUrl = new URL("../dist-toolchain/src/arcade/classics/micro-engine.js", import.meta.url);
  try {
    const metadataUrl = new URL("../dist-toolchain/src/language/metadata.js", import.meta.url);
    const [catalog, engine, metadata] = await Promise.all([
      import(catalogUrl.href),
      import(engineUrl.href),
      import(metadataUrl.href),
    ]);
    return { ...catalog, ...engine, ...metadata };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(
      [
        "Compiled Classic Worlds modules are missing.",
        "Build them before running this benchmark:",
        "npx tsc --ignoreConfig --target ES2023 --module NodeNext --moduleResolution NodeNext --lib ES2023,DOM --types node --strict --skipLibCheck --noUncheckedIndexedAccess --rootDir . --outDir dist-toolchain src/arcade/classics/catalog.ts src/arcade/classics/micro-engine.ts src/arcade/classic-rule-contract.ts",
        `Loader detail: ${detail}`,
      ].join("\n"),
      { cause: error },
    );
  }
}

async function runCli() {
  const { options, pretty, output } = parseClassicsBenchmarkArgs(process.argv.slice(2));
  const api = await loadCompiledClassicsApi();
  const report = createClassicsBenchmarkReport(api, options);
  const json = `${JSON.stringify(report, null, pretty ? 2 : undefined)}\n`;
  if (output) await writeFile(resolve(output), json, "utf8");
  process.stdout.write(json);
}

function benchmarkSharedGame(api, game, configuration) {
  const contract = benchmarkContract(game.id);
  simulate(api, game, contract, configuration.seed, configuration.warmupSteps);

  const started = process.hrtime.bigint();
  const measured = simulate(
    api,
    game,
    contract,
    configuration.seed,
    configuration.measuredSteps,
  );
  const elapsedNanoseconds = process.hrtime.bigint() - started;
  const elapsedMs = Number(elapsedNanoseconds) / 1_000_000;
  const replay = simulate(
    api,
    game,
    contract,
    configuration.seed,
    configuration.measuredSteps,
  );

  return {
    gameId: game.id,
    title: game.title,
    engineFamily: game.engineFamily,
    fixedStepHz: game.fixedStepHz,
    seed: configuration.seed,
    measurement: {
      steps: configuration.measuredSteps,
      elapsedMs: round(elapsedMs, 3),
      stepsPerSecond: rate(configuration.measuredSteps, elapsedMs),
      terminalRestarts: measured.terminalRestarts,
    },
    determinism: {
      matched: measured.digest === replay.digest,
      finalDigest: measured.digest,
      replayDigest: replay.digest,
      inputScript: CLASSICS_INPUT_SCRIPT,
    },
    finalSummary: measured.summary,
    entities: {
      peak: measured.peaks,
      limits: CLASSICS_ENTITY_LIMITS,
      withinLimits: withinEntityLimits(measured.peaks),
    },
  };
}

function simulate(api, game, contract, seed, stepCount) {
  let state = api.startClassicWorld(api.createClassicWorldState(game.id, contract, seed));
  let terminalRestarts = 0;
  const peaks = emptyPeaks();
  observeEntities(peaks, state);

  for (let step = 0; step < stepCount; step += 1) {
    if (state.status !== "running") {
      state = api.startClassicWorld(api.restartClassicWorld(state, contract));
      terminalRestarts += 1;
      observeEntities(peaks, state);
    }
    state = api.stepClassicWorld(
      state,
      scriptedInput(step),
      contract,
      1 / game.fixedStepHz,
    );
    observeEntities(peaks, state);
  }

  const snapshot = api.snapshotClassicWorld(state);
  const serialized = JSON.stringify(snapshot);
  return {
    digest: `sha256:${createHash("sha256").update(serialized).digest("hex")}`,
    summary: summarizeState(state),
    peaks,
    terminalRestarts,
  };
}

function scriptedInput(step) {
  const horizontal = step % 240;
  const vertical = step % 180;
  return {
    left: horizontal >= 120 && horizontal < 210,
    right: horizontal < 90,
    up: vertical >= 126 && vertical < 160,
    down: vertical >= 72 && vertical < 102,
    primary: step % 29 === 0,
    secondary: step % 47 === 0,
    pointerActive: step % 60 < 6,
    pointerX: 96 + ((step * 17) % 768),
    pointerY: 72 + ((step * 11) % 396),
  };
}

function benchmarkContract(gameId) {
  return Object.freeze({
    schema: "axirune-arcade/classic/1",
    game: gameId,
    stage: 1,
    score: 0,
    tempo: 1,
    gravity: GRAVITY_BY_GAME[gameId] ?? 0,
    enemySpeed: 120,
    spawnIntervalMs: 420,
    reward: 100,
    phase: "calm",
  });
}

function summarizeState(state) {
  const boardRows = state.board.length;
  const boardColumns = state.board[0]?.length ?? 0;
  const boardOccupied = state.board.reduce(
    (count, row) => count + row.filter((cell) => cell !== 0).length,
    0,
  );
  return {
    status: state.status,
    tick: state.tick,
    stage: state.stage,
    score: state.score,
    lives: state.lives,
    streak: state.streak,
    progress: state.progress,
    clock: round(state.clock, 6),
    rng: state.rng >>> 0,
    player: {
      x: round(state.player.x, 6),
      y: round(state.player.y, 6),
      vx: round(state.player.vx, 6),
      vy: round(state.player.vy, 6),
      energy: round(state.player.energy, 6),
    },
    entities: {
      actors: state.actors.length,
      shots: state.shots.length,
      particles: state.particles.length,
      trail: state.trail.length,
      boardRows,
      boardColumns,
      boardOccupied,
    },
  };
}

function emptyPeaks() {
  return { actors: 0, shots: 0, particles: 0, trail: 0, boardCells: 0, total: 0 };
}

function observeEntities(peaks, state) {
  const boardCells = state.board.reduce(
    (count, row) => count + row.filter((cell) => cell !== 0).length,
    0,
  );
  const total =
    state.actors.length +
    state.shots.length +
    state.particles.length +
    state.trail.length +
    boardCells;
  peaks.actors = Math.max(peaks.actors, state.actors.length);
  peaks.shots = Math.max(peaks.shots, state.shots.length);
  peaks.particles = Math.max(peaks.particles, state.particles.length);
  peaks.trail = Math.max(peaks.trail, state.trail.length);
  peaks.boardCells = Math.max(peaks.boardCells, boardCells);
  peaks.total = Math.max(peaks.total, total);
}

function withinEntityLimits(peaks) {
  return (
    peaks.actors <= CLASSICS_ENTITY_LIMITS.actors &&
    peaks.shots <= CLASSICS_ENTITY_LIMITS.shots &&
    peaks.particles <= CLASSICS_ENTITY_LIMITS.particles &&
    peaks.trail <= CLASSICS_ENTITY_LIMITS.trail &&
    peaks.boardCells <= CLASSICS_ENTITY_LIMITS.boardCells
  );
}

function normalizeOptions(options) {
  return Object.freeze({
    seed: integerOption(options.seed, DEFAULT_CLASSICS_SEED, "seed", 1, 0xffff_ffff),
    warmupSteps: integerOption(
      options.warmupSteps,
      DEFAULT_CLASSICS_WARMUP_STEPS,
      "warmupSteps",
      0,
      100_000,
    ),
    measuredSteps: integerOption(
      options.measuredSteps,
      DEFAULT_CLASSICS_MEASURED_STEPS,
      "measuredSteps",
      1,
      1_000_000,
    ),
  });
}

function integerOption(value, fallback, name, minimum, maximum) {
  if (value === undefined) return fallback;
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${name} must be an integer between ${minimum} and ${maximum}.`);
  }
  return value;
}

function parseInteger(value, name, minimum, maximum) {
  if (!/^(?:0x[\da-f]+|\d+)$/iu.test(value)) {
    throw new Error(`${name} must be an integer.`);
  }
  return integerOption(Number(value), undefined, name, minimum, maximum);
}

function rate(steps, elapsedMs) {
  if (elapsedMs <= 0) return 0;
  return Math.round(steps / (elapsedMs / 1_000));
}

function round(value, places) {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

function assertClassicApi(api) {
  const required = [
    "ARCADE_CLASSICS_CATALOG",
    "LANGUAGE_VERSION",
    "createClassicWorldState",
    "startClassicWorld",
    "restartClassicWorld",
    "stepClassicWorld",
    "snapshotClassicWorld",
  ];
  for (const name of required) {
    if (!(name in api)) throw new Error(`Classic benchmark API is missing ${name}.`);
  }
}

function isCliEntry() {
  const entry = process.argv[1];
  return typeof entry === "string" && pathToFileURL(entry).href === import.meta.url;
}

if (isCliEntry()) {
  runCli().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
