import { describe, expect, it } from "vitest";
import {
  BREAKER_FIXED_STEP_HZ,
  BREAKER_BRICK_RULES,
  BREAKER_LEVEL_COUNT,
  BREAKER_RULES,
  BreakerSnapshotError,
  createBreakerGame,
  restoreBreakerState,
  runBreakerTicks,
  serializeBreakerState,
  stepBreakerGame,
  type BreakerBrick,
  type BreakerBrickKind,
  type BreakerGameState,
} from "../../src/arcade/breaker-engine.js";

describe("Prism Bastion deterministic engine", () => {
  it("uses a fixed 120 Hz step and produces identical seeded replays", () => {
    const inputs = [
      { launch: true },
      ...Array.from({ length: 40 }, (_, index) => ({
        axis: index < 12 ? 1 : index < 28 ? -1 : 0,
      })),
      { targetX: 712 },
      { targetX: 712 },
    ];

    const first = runBreakerTicks(createBreakerGame({ seed: 42 }), inputs);
    const second = runBreakerTicks(createBreakerGame({ seed: 42 }), inputs);

    expect(BREAKER_FIXED_STEP_HZ).toBe(120);
    expect(serializeBreakerState(first)).toBe(serializeBreakerState(second));
    expect(first.tick).toBe(inputs.length);
    expect(first.balls[0]?.x).toBe(second.balls[0]?.x);
    expect(first.balls[0]?.y).toBe(second.balls[0]?.y);
    expect(
      serializeBreakerState(runBreakerTicks(createBreakerGame({ seed: 43 }), inputs)),
    ).not.toBe(serializeBreakerState(first));
  });

  it("keeps transitions pure and freezes simulation while paused", () => {
    const initial = createBreakerGame({ seed: 7 });
    const initialSnapshot = serializeBreakerState(initial);
    const playing = stepBreakerGame(initial, { launch: true });
    const beforePause = playing.balls[0];
    const paused = stepBreakerGame(playing, { togglePause: true });
    const frozen = stepBreakerGame(paused, { axis: 1 });

    expect(serializeBreakerState(initial)).toBe(initialSnapshot);
    expect(paused.phase).toBe("paused");
    expect(paused.tick).toBe(playing.tick);
    expect(frozen.tick).toBe(playing.tick);
    expect(frozen.balls[0]).toEqual(beforePause);

    const resumed = stepBreakerGame(frozen, { togglePause: true });
    expect(resumed.phase).toBe("playing");
    expect(resumed.tick).toBe(playing.tick + 1);
    expect(resumed.balls[0]?.y).not.toBe(beforePause?.y);
  });

  it("moves an attached orb with keyboard or pointer input and launches it", () => {
    const initial = createBreakerGame();
    const keyboard = stepBreakerGame(initial, { axis: 1 });
    const pointer = stepBreakerGame(keyboard, { targetX: 820 });

    expect(keyboard.paddle.x).toBeGreaterThan(initial.paddle.x);
    expect(keyboard.balls[0]?.x).toBe(keyboard.paddle.x);
    expect(pointer.paddle.x).toBeGreaterThan(keyboard.paddle.x);
    expect(pointer.balls[0]?.x).toBe(pointer.paddle.x);

    const launched = stepBreakerGame(pointer, { launch: true });
    expect(launched.phase).toBe("playing");
    expect(launched.balls[0]?.attached).toBe(false);
    expect(launched.balls[0]?.velocityY).toBeLessThan(0);
    expect(launched.events).toContainEqual(
      expect.objectContaining({ type: "ball-launched", ballId: "orb-1" }),
    );
  });

  it("accepts verified per-instance score tuning while preserving brick structure", () => {
    const tuned = createBreakerGame();
    const target = tuned.bricks.find((entry) => entry.destructible);
    if (!target) throw new Error("Expected a destructible brick.");
    target.points = 137;

    const restored = restoreBreakerState(serializeBreakerState(tuned));

    expect(restored.bricks.find(({ id }) => id === target.id)?.points).toBe(137);
  });

  it("models durable bricks, score, and combos", () => {
    let state = controlledCollisionState([
      brick("shell", "durable", 300, 200),
      brick("crown", "survivor", 650, 100),
    ]);

    state = stepBreakerGame(state);
    expect(state.bricks.find(({ id }) => id === "durable")?.hp).toBe(1);
    expect(state.score).toBe(0);
    expect(state.combo).toBe(0);

    const orb = state.balls[0];
    if (!orb) throw new Error("Expected controlled orb.");
    orb.x = 337;
    orb.y = 238;
    orb.velocityX = 0;
    orb.velocityY = -480;
    state = stepBreakerGame(state);

    expect(state.bricks.find(({ id }) => id === "durable")?.hp).toBe(0);
    expect(state.score).toBe(180);
    expect(state.combo).toBe(1);
    expect(state.bestCombo).toBe(1);
    expect(state.events).toContainEqual(
      expect.objectContaining({
        type: "brick-broken",
        brickId: "durable",
        combo: 1,
      }),
    );
  });

  it("chains Nova bursts without damaging Voidstone", () => {
    const state = controlledCollisionState([
      brick("nova", "burst", 300, 200),
      brick("lumen", "neighbor", 384, 200),
      brick("voidstone", "anchor", 216, 200),
      brick("crown", "survivor", 650, 100),
    ]);

    const result = stepBreakerGame(state);

    expect(result.bricks.find(({ id }) => id === "burst")?.hp).toBe(0);
    expect(result.bricks.find(({ id }) => id === "neighbor")?.hp).toBe(0);
    expect(result.bricks.find(({ id }) => id === "anchor")?.hp).toBe(1);
    expect(result.combo).toBe(2);
    expect(result.score).toBe(320);
    expect(result.events).toContainEqual(
      expect.objectContaining({ type: "nova-burst", brickId: "burst" }),
    );
    expect(result.events).toContainEqual(
      expect.objectContaining({
        type: "brick-broken",
        brickId: "neighbor",
        source: "nova",
      }),
    );
  });

  it("shapes paddle rebounds and resets the active combo", () => {
    const state = createBreakerGame();
    state.phase = "playing";
    state.combo = 6;
    state.bestCombo = 6;
    state.balls = [
      {
        id: "orb-1",
        x: state.paddle.x + state.paddle.width * 0.35,
        y: state.paddle.y - BREAKER_RULES.ballRadius - 2,
        velocityX: 0,
        velocityY: 480,
        radius: BREAKER_RULES.ballRadius,
        attached: false,
      },
    ];

    const result = stepBreakerGame(state);
    const orb = result.balls[0];

    expect(orb?.velocityY).toBeLessThan(0);
    expect(orb?.velocityX).toBeGreaterThan(0);
    expect(result.combo).toBe(0);
    expect(result.bestCombo).toBe(6);
    expect(result.events).toContainEqual(
      expect.objectContaining({ type: "paddle-hit", ballId: "orb-1" }),
    );
  });

  it("loses a life only after all balls leave play and reaches game over", () => {
    const state = createBreakerGame({ lives: 2 });
    state.phase = "playing";
    state.balls = [
      lostBall("orb-1"),
      {
        id: "orb-2",
        x: 480,
        y: 400,
        velocityX: 0,
        velocityY: -120,
        radius: BREAKER_RULES.ballRadius,
        attached: false,
      },
    ];

    const stillPlaying = stepBreakerGame(state);
    expect(stillPlaying.lives).toBe(2);
    expect(stillPlaying.phase).toBe("playing");
    expect(stillPlaying.balls.map(({ id }) => id)).toEqual(["orb-2"]);

    stillPlaying.balls = [lostBall("orb-2")];

    const recovered = stepBreakerGame(stillPlaying);
    expect(recovered.lives).toBe(1);
    expect(recovered.phase).toBe("ready");
    expect(recovered.balls[0]?.attached).toBe(true);
    expect(recovered.events).toContainEqual({
      type: "life-lost",
      livesRemaining: 1,
    });

    recovered.phase = "playing";
    recovered.balls = [lostBall("orb-2")];
    const ended = stepBreakerGame(recovered);
    expect(ended.lives).toBe(0);
    expect(ended.phase).toBe("game-over");
    expect(ended.balls).toEqual([]);
    expect(ended.events).toContainEqual(
      expect.objectContaining({ type: "game-over" }),
    );
  });

  it("advances through three named levels and ends the campaign", () => {
    const state = createBreakerGame();
    state.phase = "playing";
    state.bricks = state.bricks.map((entry) =>
      entry.destructible ? { ...entry, hp: 0 } : entry,
    );

    const cleared = stepBreakerGame(state);
    expect(cleared.phase).toBe("level-clear");
    expect(cleared.events).toContainEqual({ type: "level-clear", level: 1 });

    const secondLevel = stepBreakerGame(cleared, { launch: true });
    expect(secondLevel.level).toBe(2);
    expect(secondLevel.levelName).toBe("Mirror Foundry");
    expect(secondLevel.phase).toBe("playing");
    expect(secondLevel.events.map(({ type }) => type)).toEqual(
      expect.arrayContaining(["level-start", "ball-launched"]),
    );

    secondLevel.level = BREAKER_LEVEL_COUNT;
    secondLevel.levelName = "Nova Crown";
    secondLevel.phase = "playing";
    secondLevel.bricks = secondLevel.bricks.map((entry) =>
      entry.destructible ? { ...entry, hp: 0 } : entry,
    );
    const won = stepBreakerGame(secondLevel);
    expect(won.phase).toBe("won");
    expect(won.events).toContainEqual(
      expect.objectContaining({ type: "game-won" }),
    );
  });

  it("restarts the campaign and validates independent JSON snapshots", () => {
    const moved = runBreakerTicks(createBreakerGame({ seed: 99, lives: 4 }), [
      { launch: true },
      { axis: 1 },
      { axis: 1 },
    ]);
    const snapshot = serializeBreakerState(moved);
    const restored = restoreBreakerState(snapshot);

    expect(serializeBreakerState(restored)).toBe(snapshot);
    restored.paddle.x += 10;
    expect(restored.paddle.x).not.toBe(moved.paddle.x);

    const restarted = stepBreakerGame(moved, { restart: true });
    expect(serializeBreakerState(restarted)).toBe(
      serializeBreakerState(createBreakerGame({ seed: 99, lives: 4 })),
    );

    const wrongLevel = JSON.parse(snapshot) as { level: number };
    wrongLevel.level = BREAKER_LEVEL_COUNT + 1;
    expect(() => restoreBreakerState(JSON.stringify(wrongLevel))).toThrow(
      BreakerSnapshotError,
    );
    expect(() => restoreBreakerState('{"schema":"unknown"}')).toThrow(
      BreakerSnapshotError,
    );
    expect(() =>
      restoreBreakerState(snapshot.replace('"rngState":', '"rngState":null,"old":')),
    ).toThrow(BreakerSnapshotError);
  });
});

function controlledCollisionState(bricks: BreakerBrick[]): BreakerGameState {
  const state = createBreakerGame();
  state.phase = "playing";
  state.bricks = bricks;
  state.balls = [
    {
      id: "orb-1",
      x: 337,
      y: 238,
      velocityX: 0,
      velocityY: -480,
      radius: BREAKER_RULES.ballRadius,
      attached: false,
    },
  ];
  return state;
}

function brick(
  kind: BreakerBrickKind,
  id: string,
  x: number,
  y: number,
): BreakerBrick {
  const rule = BREAKER_BRICK_RULES[kind];
  return {
    id,
    kind,
    x,
    y,
    width: 74,
    height: 28,
    hp: rule.hp,
    maxHp: rule.hp,
    points: rule.points,
    destructible: rule.destructible,
  };
}

function lostBall(id: string) {
  return {
    id,
    x: 480,
    y: BREAKER_RULES.worldHeight + BREAKER_RULES.ballRadius + 2,
    velocityX: 0,
    velocityY: 120,
    radius: BREAKER_RULES.ballRadius,
    attached: false,
  };
}
