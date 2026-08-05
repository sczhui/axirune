import { describe, expect, it } from "vitest";
import {
  SHOOTER_TICK_RATE,
  ShooterEngine,
  ShooterSnapshotError,
  createShooterEngine,
  type EnemyState,
  type ShooterSnapshot,
} from "../../src/arcade/shooter-engine.js";

const QUIET_ARENA = {
  firstWaveDelayTicks: 10_000,
  enemyFireIntervalTicks: 10_000,
};

describe("deterministic arcade shooter engine", () => {
  it("produces the same state at 60 Hz regardless of elapsed-time slicing", () => {
    const wholeSecond = createShooterEngine({ seed: 42, config: QUIET_ARENA });
    const slicedSecond = createShooterEngine({ seed: 42, config: QUIET_ARENA });

    const whole = wholeSecond.advance(1_000, { right: true, fire: true });
    for (let frame = 0; frame < 100; frame += 1) {
      slicedSecond.advance(10, { right: true, fire: true });
    }

    expect(whole.steps).toBe(SHOOTER_TICK_RATE);
    expect(slicedSecond.snapshot()).toEqual(wholeSecond.snapshot());
  });

  it("moves, clamps, and rate-limits player fire without a rendering clock", () => {
    const engine = createShooterEngine({ seed: 7, config: QUIET_ARENA });
    const initial = engine.snapshot();

    for (let tick = 0; tick < 20; tick += 1) {
      engine.tick({ right: true, down: true, fire: true });
    }
    const active = engine.snapshot();

    expect(active.player.x).toBeGreaterThan(initial.player.x);
    expect(active.player.y).toBeLessThanOrEqual(
      active.config.worldHeight - active.player.height - 12,
    );
    expect(active.bullets.filter((bullet) => bullet.owner === "player")).toHaveLength(
      3,
    );

    for (let tick = 0; tick < 300; tick += 1) {
      engine.tick({ right: true, down: true });
    }
    const clamped = engine.snapshot();
    expect(clamped.player.x).toBe(
      clamped.config.worldWidth - clamped.player.width,
    );
    expect(clamped.player.y).toBe(
      clamped.config.worldHeight - clamped.player.height - 12,
    );
  });

  it("spawns deterministic original enemy waves", () => {
    const first = createShooterEngine({ seed: 2026 });
    const second = createShooterEngine({ seed: 2026 });

    const firstEvents = first.tick().events;
    const secondEvents = second.tick().events;

    expect(firstEvents).toContainEqual({
      type: "wave-started",
      tick: 1,
      wave: 1,
      enemyCount: 4,
    });
    expect(secondEvents).toEqual(firstEvents);
    expect(second.snapshot().enemies).toEqual(first.snapshot().enemies);
    expect(first.snapshot().enemies.map((enemy) => enemy.kind)).toEqual([
      "scout",
      "striker",
      "striker",
      "bulwark",
    ]);
  });

  it("resolves collisions and multiplies consecutive kill scores by combo", () => {
    let engine = createShooterEngine({ seed: 9, config: QUIET_ARENA });
    engine = placeTargetInFiringLine(engine, 100);

    const firstKill = engine.tick({ fire: true }).events;
    expect(firstKill).toContainEqual(
      expect.objectContaining({
        type: "enemy-destroyed",
        scoreAwarded: 100,
        combo: 1,
      }),
    );
    expect(firstKill).toContainEqual(
      expect.objectContaining({
        type: "wave-cleared",
        wave: 0,
        nextWave: 1,
      }),
    );

    engine = placeTargetInFiringLine(engine, 100);
    const secondKill = engine.tick({ fire: true }).events;
    const afterCombo = engine.snapshot();

    expect(secondKill).toContainEqual(
      expect.objectContaining({
        type: "enemy-destroyed",
        scoreAwarded: 200,
        combo: 2,
      }),
    );
    expect(afterCombo.score).toBe(300);
    expect(afterCombo.maxCombo).toBe(2);
  });

  it("pauses without accumulating time and restarts from the original seed", () => {
    const engine = createShooterEngine({ seed: 73, config: QUIET_ARENA });
    engine.advance(500, { left: true });
    engine.pause();
    const paused = engine.snapshot();

    expect(engine.advance(1_000, { right: true, fire: true })).toEqual({
      steps: 0,
      events: [],
    });
    expect(engine.snapshot()).toEqual(paused);

    engine.resume();
    expect(engine.tick().steps).toBe(1);
    engine.restart();

    expect(engine.snapshot()).toEqual(
      createShooterEngine({ seed: 73, config: QUIET_ARENA }).snapshot(),
    );
  });

  it("enters game-over on a player collision and still emits a valid snapshot", () => {
    const seedEngine = createShooterEngine({ seed: 19, config: QUIET_ARENA });
    const snapshot = seedEngine.snapshot();
    snapshot.player.health = 1;
    snapshot.nextWaveAtTick = null;
    snapshot.enemies = [
      {
        ...targetFor(snapshot, snapshot.nextEntityId, 100),
        x: snapshot.player.x,
        y: snapshot.player.y,
      },
    ];
    snapshot.nextEntityId += 1;
    const engine = ShooterEngine.fromSnapshot(snapshot);

    const result = engine.advance(1_000);

    expect(result.events).toContainEqual(
      expect.objectContaining({ type: "player-hit", health: 0 }),
    );
    expect(result.events).toContainEqual(
      expect.objectContaining({ type: "game-over", score: 0 }),
    );
    expect(engine.status).toBe("game-over");
    expect(engine.snapshot().accumulatorUnits).toBe(0);
    expect(ShooterEngine.deserialize(engine.serialize()).snapshot()).toEqual(
      engine.snapshot(),
    );
  });

  it("round-trips a JSON snapshot and continues the same deterministic replay", () => {
    const original = createShooterEngine({ seed: 0xcafe, config: QUIET_ARENA });
    original.advance(427, { left: true, fire: true });

    const restored = ShooterEngine.deserialize(original.serialize());
    expect(restored.snapshot()).toEqual(original.snapshot());

    const script = [
      { right: true },
      { up: true, fire: true },
      { left: true, down: true },
    ];
    for (const input of script) {
      expect(restored.tick(input)).toEqual(original.tick(input));
    }
    expect(restored.snapshot()).toEqual(original.snapshot());
  });

  it("rejects malformed or self-conflicting snapshots", () => {
    const snapshot = createShooterEngine().snapshot();
    snapshot.nextEntityId = 1;
    snapshot.bullets.push({
      id: 1,
      owner: "player",
      x: 10,
      y: 10,
      width: 4,
      height: 13,
      velocityY: -540,
      damage: 1,
    });

    expect(() => ShooterEngine.fromSnapshot(snapshot)).toThrow(
      ShooterSnapshotError,
    );
    expect(() => ShooterEngine.deserialize("not-json")).toThrow(
      "Snapshot is not valid JSON.",
    );
  });
});

function placeTargetInFiringLine(
  engine: ShooterEngine,
  scoreValue: number,
): ShooterEngine {
  const snapshot = engine.snapshot();
  snapshot.player.fireCooldownTicks = 0;
  snapshot.nextWaveAtTick = null;
  snapshot.enemies = [targetFor(snapshot, snapshot.nextEntityId, scoreValue)];
  snapshot.nextEntityId += 1;
  return ShooterEngine.fromSnapshot(snapshot);
}

function targetFor(
  snapshot: ShooterSnapshot,
  id: number,
  scoreValue: number,
): EnemyState {
  return {
    id,
    kind: "scout",
    x: snapshot.player.x + snapshot.player.width / 2 - 10,
    y: snapshot.player.y - 30,
    width: 20,
    height: 16,
    velocityX: 0,
    health: 1,
    maxHealth: 1,
    scoreValue,
    firePhase: 1,
  };
}
