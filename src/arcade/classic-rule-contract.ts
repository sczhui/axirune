import type { RuntimeValue } from "../language/index.js";

export const CLASSIC_RULE_SCHEMA = "axirune-arcade/classic/1" as const;

export type ClassicRulePhase = "calm" | "charged" | "surge";

export interface ClassicRuleContract {
  readonly schema: typeof CLASSIC_RULE_SCHEMA;
  readonly game: string;
  readonly stage: number;
  readonly score: number;
  readonly tempo: number;
  readonly gravity: number;
  readonly enemySpeed: number;
  readonly spawnIntervalMs: number;
  readonly reward: number;
  readonly phase: ClassicRulePhase;
}

export function validateClassicRuleContract(
  value: RuntimeValue,
  expectedGame: string,
): ClassicRuleContract {
  const record = asRecord(value);
  if (record.schema !== CLASSIC_RULE_SCHEMA) {
    throw new Error("Classic World rule schema is invalid.");
  }
  if (record.game !== expectedGame) {
    throw new Error(`Classic World rules target ${String(record.game)}, not ${expectedGame}.`);
  }

  return Object.freeze({
    schema: CLASSIC_RULE_SCHEMA,
    game: expectedGame,
    stage: integer(record.stage, 1, 99, "stage"),
    score: integer(record.score, 0, 999_999_999, "score"),
    tempo: finiteNumber(record.tempo, 0.25, 3, "tempo"),
    gravity: finiteNumber(record.gravity, 0, 3_000, "gravity"),
    enemySpeed: finiteNumber(record.enemy_speed, 0, 800, "enemy_speed"),
    spawnIntervalMs: integer(record.spawn_interval_ms, 80, 10_000, "spawn_interval_ms"),
    reward: integer(record.reward, 1, 1_000_000, "reward"),
    phase: phase(record.phase),
  });
}

function asRecord(value: RuntimeValue): Record<string, RuntimeValue> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Classic World rules must yield a Record.");
  }
  return value as Record<string, RuntimeValue>;
}

function finiteNumber(
  value: RuntimeValue | undefined,
  minimum: number,
  maximum: number,
  label: string,
): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < minimum ||
    value > maximum
  ) {
    throw new Error(`${label} must be a finite Number between ${minimum} and ${maximum}.`);
  }
  return value;
}

function integer(
  value: RuntimeValue | undefined,
  minimum: number,
  maximum: number,
  label: string,
): number {
  const result = finiteNumber(value, minimum, maximum, label);
  if (!Number.isSafeInteger(result)) throw new Error(`${label} must be an integer.`);
  return result;
}

function phase(value: RuntimeValue | undefined): ClassicRulePhase {
  if (value !== "calm" && value !== "charged" && value !== "surge") {
    throw new Error("phase must be calm, charged, or surge.");
  }
  return value;
}
