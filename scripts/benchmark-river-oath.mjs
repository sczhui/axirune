#!/usr/bin/env node

import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

export const RIVER_OATH_BENCHMARK_SCHEMA = "axirune-benchmark/river-oath/1";
export const RIVER_OATH_INPUT_SCHEMA = "river-oath-input-script/1";
export const DEFAULT_RIVER_OATH_STEPS_PER_HERO = 12_000;
export const RIVER_OATH_MINIMUM_TOTAL_TICKS = 36_000;
export const RIVER_OATH_WARMUP_TICKS_PER_HERO = 600;

export const RIVER_OATH_ENTITY_LIMITS = Object.freeze({
  players: 1,
  enemies: 24,
  pickups: 8,
  effects: 192,
  total: 225,
});

export const RIVER_OATH_BENCHMARK_SCENARIOS = Object.freeze([
  Object.freeze({
    heroId: "willow-duelist",
    seed: 0x5757_1101,
    inputScript: "river-oath-input/willow-flow/1",
    branchPreference: Object.freeze(["harbor-road", "beacon-ascent"]),
  }),
  Object.freeze({
    heroId: "astral-lancer",
    seed: 0xa57a_1202,
    inputScript: "river-oath-input/astral-vanguard/1",
    branchPreference: Object.freeze(["forge-road", "quench-route", "beacon-ascent"]),
  }),
  Object.freeze({
    heroId: "iron-tactician",
    seed: 0x1f0a_1303,
    inputScript: "river-oath-input/iron-formation/1",
    branchPreference: Object.freeze(["forge-road", "quench-route", "beacon-ascent"]),
  }),
]);

/**
 * Run the three release scenarios against an injected API. The command-line
 * entry point injects only JavaScript loaded from dist-toolchain, while source
 * tests can exercise the exact same report contract without a subprocess.
 */
export function createRiverOathBenchmarkReport(api, options = {}) {
  assertRiverOathApi(api);
  const configuration = normalizeOptions(options);
  assertHeroCoverage(api.RIVER_OATH_HERO_IDS);

  const heroes = RIVER_OATH_BENCHMARK_SCENARIOS.map((scenario) =>
    benchmarkHero(api, scenario, configuration.stepsPerHero),
  );
  const totalTicks = heroes.reduce((sum, hero) => sum + hero.measurement.ticks, 0);
  const elapsedMs = heroes.reduce((sum, hero) => sum + hero.measurement.elapsedMs, 0);
  const deterministicHeroes = heroes.filter(({ determinism }) => determinism.matched).length;
  const finiteHeroes = heroes.filter(({ validation }) => validation.finiteNumbers).length;
  const boundedHeroes = heroes.filter(({ entities }) => entities.withinLimits).length;
  const restoredHeroes = heroes.filter(
    ({ serialization }) => serialization.roundTripByteStable && serialization.continuationMatched,
  ).length;
  const minimumCoverageMet = totalTicks >= RIVER_OATH_MINIMUM_TOTAL_TICKS;
  const validationPassed = heroes.every(
    ({ determinism, validation, entities, serialization }) =>
      determinism.matched &&
      validation.finiteNumbers &&
      validation.insideArena &&
      entities.withinLimits &&
      serialization.roundTripByteStable &&
      serialization.continuationMatched,
  );

  return {
    schema: RIVER_OATH_BENCHMARK_SCHEMA,
    generatedAt: new Date().toISOString(),
    languageVersion: api.LANGUAGE_VERSION,
    runtime: {
      node: process.version,
      platform: process.platform,
      architecture: process.arch,
      clock: "process.hrtime.bigint",
    },
    configuration: {
      fixedStepHz: api.RIVER_OATH_FIXED_HZ,
      inputSchema: RIVER_OATH_INPUT_SCHEMA,
      warmupTicksPerHero: RIVER_OATH_WARMUP_TICKS_PER_HERO,
      measuredTicksPerHero: configuration.stepsPerHero,
      minimumTotalTicks: RIVER_OATH_MINIMUM_TOTAL_TICKS,
      entityLimits: RIVER_OATH_ENTITY_LIMITS,
      scenarios: RIVER_OATH_BENCHMARK_SCENARIOS.map(
        ({ heroId, seed, inputScript, branchPreference }) => ({
          heroId,
          seed,
          inputScript,
          branchPreference: [...branchPreference],
        }),
      ),
      timingScope:
        "Primary fixed-tick run including snapshot validation; warmup and deterministic replay are excluded.",
    },
    coverage: {
      heroes: heroes.length,
      heroIds: heroes.map(({ heroId }) => heroId),
      totalTicks,
      minimumTotalTicks: RIVER_OATH_MINIMUM_TOTAL_TICKS,
      minimumCoverageMet,
    },
    heroes,
    aggregate: {
      totalTicks,
      elapsedMs: round(elapsedMs, 3),
      ticksPerSecond: rate(totalTicks, elapsedMs),
      deterministicHeroes,
      finiteHeroes,
      boundedHeroes,
      restoredHeroes,
      peakLiveEntities: heroes.reduce(
        (maximum, hero) => Math.max(maximum, hero.entities.peak.total),
        0,
      ),
      validationPassed,
    },
    passed: validationPassed && minimumCoverageMet,
  };
}

export function parseRiverOathBenchmarkArgs(argv) {
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
    if (argument === "--steps") {
      const value = argv[index + 1];
      if (value === undefined) throw new Error("--steps requires a value.");
      options.stepsPerHero = parseInteger(value, "--steps", 1, 10_000_000);
      index += 1;
      continue;
    }
    throw new Error(`Unknown benchmark option: ${argument}`);
  }

  return { options, pretty, output };
}

export async function loadCompiledRiverOathApi() {
  const engineUrl = new URL("../dist-toolchain/src/arcade/river-oath/index.js", import.meta.url);
  const metadataUrl = new URL("../dist-toolchain/src/language/metadata.js", import.meta.url);
  try {
    const [riverOath, metadata] = await Promise.all([
      import(engineUrl.href),
      import(metadataUrl.href),
    ]);
    return { ...riverOath, ...metadata };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(
      [
        "Compiled River Oath modules are missing.",
        "Run `npm run build:toolchain` before this benchmark.",
        `Loader detail: ${detail}`,
      ].join("\n"),
      { cause: error },
    );
  }
}

async function runCli() {
  const { options, pretty, output } = parseRiverOathBenchmarkArgs(process.argv.slice(2));
  const api = await loadCompiledRiverOathApi();
  const report = createRiverOathBenchmarkReport(api, options);
  const json = `${JSON.stringify(report, null, pretty ? 2 : undefined)}\n`;
  if (output) await writeFile(resolve(output), json, "utf8");
  process.stdout.write(json);
  if (!report.passed) process.exitCode = 1;
}

function benchmarkHero(api, scenario, stepsPerHero) {
  simulate(api, scenario, RIVER_OATH_WARMUP_TICKS_PER_HERO, null);

  const started = process.hrtime.bigint();
  const measured = simulate(api, scenario, stepsPerHero, null);
  const elapsedNanoseconds = process.hrtime.bigint() - started;
  const elapsedMs = Number(elapsedNanoseconds) / 1_000_000;
  const restoreAtTick = Math.floor(stepsPerHero / 2);
  const replay = simulate(api, scenario, stepsPerHero, restoreAtTick);
  const determinismMatched = measured.digest === replay.digest;
  const continuationMatched =
    replay.serialization.restored &&
    replay.serialization.roundTripByteStable &&
    determinismMatched;

  return {
    heroId: scenario.heroId,
    seed: scenario.seed,
    inputScript: scenario.inputScript,
    branchPreference: [...scenario.branchPreference],
    measurement: {
      ticks: stepsPerHero,
      elapsedMs: round(elapsedMs, 3),
      ticksPerSecond: rate(stepsPerHero, elapsedMs),
      lifecycle: measured.lifecycle,
      events: measured.events,
    },
    determinism: {
      matched: determinismMatched,
      measuredDigest: measured.digest,
      replayDigest: replay.digest,
      digestAlgorithm: "sha256",
      inputScript: scenario.inputScript,
    },
    serialization: {
      restoreAtTick,
      checkpointDigest: replay.serialization.checkpointDigest,
      roundTripByteStable: replay.serialization.roundTripByteStable,
      continuationMatched,
    },
    validation: {
      finiteNumbers: measured.validation.finiteNumbers && replay.validation.finiteNumbers,
      insideArena: measured.validation.insideArena && replay.validation.insideArena,
      inspectedSnapshots: measured.validation.inspectedSnapshots + replay.validation.inspectedSnapshots,
    },
    entities: {
      peak: measured.peaks,
      replayPeak: replay.peaks,
      limits: RIVER_OATH_ENTITY_LIMITS,
      withinLimits: withinEntityLimits(measured.peaks) && withinEntityLimits(replay.peaks),
    },
    finalSummary: measured.summary,
  };
}

function simulate(api, scenario, tickCount, restoreAtTick) {
  let engine = api.createRiverOathEngine({ heroId: scenario.heroId, seed: scenario.seed });
  const lifecycle = emptyLifecycle();
  const events = {};
  const peaks = emptyPeaks();
  let inspectedSnapshots = 0;
  let checkpointDigest = null;
  let roundTripByteStable = restoreAtTick === null;
  let restored = restoreAtTick === null;

  recordEvents(events, engine.start());
  lifecycle.starts += 1;
  inspect(engine.snapshot());

  for (let tick = 0; tick < tickCount; tick += 1) {
    engine = ensureRunning(api, engine, scenario, lifecycle, events);
    if (restoreAtTick === tick) {
      const serialized = engine.serialize();
      checkpointDigest = digest(serialized);
      const restoredEngine = api.RiverOathEngine.deserialize(serialized);
      roundTripByteStable = restoredEngine.serialize() === serialized;
      restored = true;
      engine = restoredEngine;
    }

    const result = engine.tick(scriptedInput(scenario.inputScript, tick));
    if (result.steps !== 1) {
      throw new Error(
        `${scenario.heroId} executed ${result.steps} fixed steps at benchmark tick ${tick}; expected 1.`,
      );
    }
    recordEvents(events, result.events);
    inspect(engine.snapshot());
  }

  if (restoreAtTick === tickCount) {
    const serialized = engine.serialize();
    checkpointDigest = digest(serialized);
    const restoredEngine = api.RiverOathEngine.deserialize(serialized);
    roundTripByteStable = restoredEngine.serialize() === serialized;
    restored = true;
    engine = restoredEngine;
    inspect(engine.snapshot());
  }

  const serialized = engine.serialize();
  return {
    digest: digest(serialized),
    lifecycle,
    events: sortedRecord(events),
    peaks,
    summary: summarize(engine.snapshot()),
    validation: {
      finiteNumbers: true,
      insideArena: true,
      inspectedSnapshots,
    },
    serialization: {
      restored,
      checkpointDigest,
      roundTripByteStable,
    },
  };

  function inspect(snapshot) {
    assertFiniteSnapshot(snapshot);
    assertInsideArena(snapshot);
    observeEntities(peaks, snapshot);
    inspectedSnapshots += 1;
  }
}

function ensureRunning(api, engine, scenario, lifecycle, events) {
  for (let transition = 0; transition < 4 && engine.status !== "running"; transition += 1) {
    if (engine.status === "ready") {
      recordEvents(events, engine.start());
      lifecycle.starts += 1;
      continue;
    }
    if (engine.status === "paused") {
      engine.resume();
      lifecycle.resumes += 1;
      continue;
    }
    if (engine.status === "stage-clear") {
      const snapshot = engine.snapshot();
      const branchId = scenario.branchPreference.find((id) =>
        snapshot.branch.available.includes(id),
      ) ?? snapshot.branch.available[0];
      if (branchId) {
        recordEvents(events, engine.chooseBranch(branchId));
        lifecycle.branchesSelected += 1;
      }
      engine.advanceStage();
      lifecycle.stagesAdvanced += 1;
      continue;
    }
    if (engine.status === "campaign-clear" || engine.status === "game-over") {
      if (engine.status === "campaign-clear") lifecycle.campaignRestarts += 1;
      else lifecycle.gameOverRestarts += 1;
      engine.restart();
      continue;
    }
    throw new Error(`Unsupported River Oath benchmark status: ${engine.status}`);
  }
  if (engine.status !== "running") {
    throw new Error(`River Oath benchmark could not resume ${scenario.heroId}.`);
  }
  return engine;
}

function scriptedInput(inputScript, tick) {
  if (inputScript === "river-oath-input/willow-flow/1") {
    const travel = tick % 480;
    return {
      moveX: travel < 300 ? 1 : travel < 390 ? -0.65 : 0.25,
      moveLane: tick % 240 < 110 ? 0.72 : tick % 240 < 210 ? -0.72 : 0,
      light: tick % 22 === 0 || tick % 22 === 10,
      heavy: tick % 181 === 63,
      launcher: tick % 233 === 101,
      dodge: tick % 127 === 53,
      guard: tick % 277 >= 250,
      skill: tick % 313 === 157,
    };
  }
  if (inputScript === "river-oath-input/astral-vanguard/1") {
    const travel = tick % 540;
    return {
      moveX: travel < 350 ? 0.88 : travel < 455 ? -0.8 : 0,
      moveLane: tick % 300 < 132 ? -0.58 : tick % 300 < 264 ? 0.58 : 0,
      light: tick % 25 === 0 || tick % 25 === 11,
      heavy: tick % 149 === 71,
      launcher: tick % 197 === 97,
      dodge: tick % 139 === 42,
      guard: tick % 251 >= 228,
      skill: tick % 283 === 141,
    };
  }
  if (inputScript === "river-oath-input/iron-formation/1") {
    const travel = tick % 600;
    return {
      moveX: travel < 390 ? 0.72 : travel < 510 ? -0.48 : 0,
      moveLane: tick % 360 < 150 ? 0.46 : tick % 360 < 300 ? -0.46 : 0,
      light: tick % 28 === 0 || tick % 28 === 12,
      heavy: tick % 131 === 65,
      launcher: tick % 211 === 107,
      dodge: tick % 167 === 83,
      guard: tick % 223 >= 184,
      skill: tick % 269 === 134,
    };
  }
  throw new Error(`Unknown River Oath input script: ${inputScript}`);
}

function assertFiniteSnapshot(snapshot) {
  const visit = (value, path) => {
    if (typeof value === "number" && !Number.isFinite(value)) {
      throw new Error(`Non-finite River Oath value at ${path}.`);
    }
    if (Array.isArray(value)) {
      value.forEach((child, index) => visit(child, `${path}[${index}]`));
      return;
    }
    if (value && typeof value === "object") {
      for (const [key, child] of Object.entries(value)) visit(child, `${path}.${key}`);
    }
  };
  visit(snapshot, "snapshot");
}

function assertInsideArena(snapshot) {
  const arena = snapshot.campaign.stages[snapshot.stageIndex]?.scene.arena;
  if (!arena) throw new Error(`Missing arena for River Oath stage ${snapshot.stageIndex}.`);
  const liveObjects = [snapshot.player, ...snapshot.enemies, ...snapshot.pickups, ...snapshot.effects];
  for (const object of liveObjects) {
    if (
      object.x < arena.minX ||
      object.x > arena.maxX ||
      object.lane < arena.minLane ||
      object.lane > arena.maxLane
    ) {
      throw new Error(`River Oath entity ${object.id} escaped the active arena.`);
    }
  }
}

function observeEntities(peaks, snapshot) {
  const total = 1 + snapshot.enemies.length + snapshot.pickups.length + snapshot.effects.length;
  peaks.players = 1;
  peaks.enemies = Math.max(peaks.enemies, snapshot.enemies.length);
  peaks.pickups = Math.max(peaks.pickups, snapshot.pickups.length);
  peaks.effects = Math.max(peaks.effects, snapshot.effects.length);
  peaks.total = Math.max(peaks.total, total);
}

function withinEntityLimits(peaks) {
  return (
    peaks.players <= RIVER_OATH_ENTITY_LIMITS.players &&
    peaks.enemies <= RIVER_OATH_ENTITY_LIMITS.enemies &&
    peaks.pickups <= RIVER_OATH_ENTITY_LIMITS.pickups &&
    peaks.effects <= RIVER_OATH_ENTITY_LIMITS.effects &&
    peaks.total <= RIVER_OATH_ENTITY_LIMITS.total
  );
}

function summarize(snapshot) {
  return {
    status: snapshot.status,
    tick: snapshot.tick,
    stage: snapshot.stageIndex + 1,
    stageId: snapshot.campaign.stages[snapshot.stageIndex]?.id ?? null,
    wave: snapshot.waveIndex + 1,
    score: snapshot.score,
    defeatedEnemies: snapshot.defeatedEnemies,
    randomState: snapshot.randomState >>> 0,
    player: {
      heroId: snapshot.player.heroId,
      health: snapshot.player.health,
      focus: snapshot.player.focus,
      x: round(snapshot.player.x, 6),
      lane: round(snapshot.player.lane, 6),
      action: snapshot.player.action,
      comboHits: snapshot.player.combo.hits,
    },
    liveEntities: {
      enemies: snapshot.enemies.length,
      pickups: snapshot.pickups.length,
      effects: snapshot.effects.length,
    },
    routeHistory: [...snapshot.branch.routeHistory],
  };
}

function emptyPeaks() {
  return { players: 0, enemies: 0, pickups: 0, effects: 0, total: 0 };
}

function emptyLifecycle() {
  return {
    starts: 0,
    resumes: 0,
    branchesSelected: 0,
    stagesAdvanced: 0,
    campaignRestarts: 0,
    gameOverRestarts: 0,
  };
}

function recordEvents(counts, events) {
  for (const event of events) counts[event.type] = (counts[event.type] ?? 0) + 1;
}

function sortedRecord(record) {
  return Object.fromEntries(Object.entries(record).sort(([left], [right]) => left.localeCompare(right)));
}

function digest(serialized) {
  return `sha256:${createHash("sha256").update(serialized).digest("hex")}`;
}

function normalizeOptions(options) {
  return Object.freeze({
    stepsPerHero: integerOption(
      options.stepsPerHero,
      DEFAULT_RIVER_OATH_STEPS_PER_HERO,
      "stepsPerHero",
      1,
      10_000_000,
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
  if (!/^\d+$/u.test(value)) throw new Error(`${name} must be an integer.`);
  return integerOption(Number(value), undefined, name, minimum, maximum);
}

function rate(ticks, elapsedMs) {
  if (elapsedMs <= 0) return 0;
  return Math.round(ticks / (elapsedMs / 1_000));
}

function round(value, places) {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

function assertRiverOathApi(api) {
  const required = [
    "LANGUAGE_VERSION",
    "RIVER_OATH_FIXED_HZ",
    "RIVER_OATH_HERO_IDS",
    "RiverOathEngine",
    "createRiverOathEngine",
  ];
  for (const name of required) {
    if (!(name in api)) throw new Error(`River Oath benchmark API is missing ${name}.`);
  }
  if (typeof api.RiverOathEngine.deserialize !== "function") {
    throw new Error("River Oath benchmark API is missing RiverOathEngine.deserialize.");
  }
}

function assertHeroCoverage(heroIds) {
  const expected = new Set(RIVER_OATH_BENCHMARK_SCENARIOS.map(({ heroId }) => heroId));
  const actual = new Set(heroIds);
  if (expected.size !== 3 || actual.size !== 3 || [...expected].some((id) => !actual.has(id))) {
    throw new Error("River Oath benchmark requires exactly the three published heroes.");
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
