import { describe, expect, it } from "vitest";
import type { ClassicRuleContract } from "../../src/arcade/classic-rule-contract.js";
import {
  CLASSIC_WORLD_HEIGHT,
  CLASSIC_WORLD_WIDTH,
  NEUTRAL_CLASSIC_INPUT,
  createClassicWorldState,
  restoreClassicWorld,
  snapshotClassicWorld,
  startClassicWorld,
  stepClassicWorld,
  type ClassicWorldInput,
  type ClassicWorldState,
} from "../../src/arcade/classics/micro-engine.js";
import type { ArcadeClassicGameId } from "../../src/arcade/classics/catalog.js";

const MICRO_GAME_IDS = [
  "aetherstep-foundry",
  "bastion-treads",
  "sunwake-corsairs",
  "emberglass-atlas",
  "moonthread-ronin",
  "alloy-tempest",
  "chromaline-circuit",
  "dustcoil-courier",
  "prism-stack",
  "glyph-current",
  "vault-cartographer",
  "sparkcell-siege",
  "neon-coil",
  "orbit-foundry",
  "lumen-labyrinth",
  "harbor-brawl",
  "circuit-strikers",
  "signal-bloom",
] as const satisfies readonly ArcadeClassicGameId[];

describe("Classic Worlds shared deterministic engines", () => {
  it("creates a playable, finite state for all 18 new worlds", () => {
    for (const id of MICRO_GAME_IDS) {
      const state = createClassicWorldState(id, rules(id), 0x1357_2468);
      expect(state).toMatchObject({ gameId: id, status: "ready", stage: 1, lives: 3 });
      expect(Number.isFinite(state.player.x)).toBe(true);
      expect(Number.isFinite(state.player.y)).toBe(true);
    }
  });

  it("replays identical input frames to an identical snapshot in every world", () => {
    for (const id of MICRO_GAME_IDS) {
      const first = simulate(startClassicWorld(createClassicWorldState(id, rules(id), 0xabc0_1234)), rules(id), 240);
      const second = simulate(startClassicWorld(createClassicWorldState(id, rules(id), 0xabc0_1234)), rules(id), 240);
      expect(snapshotClassicWorld(first), id).toEqual(snapshotClassicWorld(second));
    }
  });

  it("round-trips snapshots and continues deterministically", () => {
    const contract = rules("sunwake-corsairs");
    const midpoint = simulate(
      startClassicWorld(createClassicWorldState("sunwake-corsairs", contract, 424_242)),
      contract,
      160,
    );
    const restored = restoreClassicWorld(snapshotClassicWorld(midpoint));
    expect(simulate(midpoint, contract, 120)).toEqual(simulate(restored, contract, 120));
  });

  it("provides mechanism-specific input feedback across all eight engine families", () => {
    const platformRules = rules("aetherstep-foundry");
    const platform = stepClassicWorld(
      startClassicWorld(createClassicWorldState("aetherstep-foundry", platformRules)),
      { ...NEUTRAL_CLASSIC_INPUT, primary: true },
      platformRules,
      1 / 60,
    );
    expect(platform.player.vy).toBeLessThan(0);

    const projectileRules = rules("sunwake-corsairs");
    const projectile = stepClassicWorld(
      startClassicWorld(createClassicWorldState("sunwake-corsairs", projectileRules)),
      { ...NEUTRAL_CLASSIC_INPUT, primary: true },
      projectileRules,
      1 / 60,
    );
    expect(projectile.shots.some(({ friendly }) => friendly)).toBe(true);

    const roadRules = rules("chromaline-circuit");
    const road = simulate(
      startClassicWorld(createClassicWorldState("chromaline-circuit", roadRules)),
      roadRules,
      30,
    );
    expect(road.progress).toBeGreaterThan(0);

    const stackRules = rules("prism-stack");
    const stack = stepClassicWorld(
      startClassicWorld(createClassicWorldState("prism-stack", stackRules)),
      { ...NEUTRAL_CLASSIC_INPUT, secondary: true },
      stackRules,
      1 / 60,
    );
    expect(stack.board.flat().some((cell) => cell > 0)).toBe(true);

    const tileRules = rules("emberglass-atlas");
    const tileStart = startClassicWorld(createClassicWorldState("emberglass-atlas", tileRules));
    const tile = stepClassicWorld(
      tileStart,
      { ...NEUTRAL_CLASSIC_INPUT, right: true },
      tileRules,
      1 / 20,
    );
    expect(tile.tick).toBe(1);

    const orbitRules = rules("orbit-foundry");
    const orbitStart = startClassicWorld(createClassicWorldState("orbit-foundry", orbitRules));
    const orbit = stepClassicWorld(orbitStart, NEUTRAL_CLASSIC_INPUT, orbitRules, 1 / 120);
    expect([orbit.player.x, orbit.player.y]).not.toEqual([orbitStart.player.x, orbitStart.player.y]);

    const arenaRules = rules("harbor-brawl");
    const arena = simulate(
      startClassicWorld(createClassicWorldState("harbor-brawl", arenaRules)),
      arenaRules,
      180,
    );
    expect(arena.actors.length + arena.progress).toBeGreaterThan(0);

    const targetRules = rules("signal-bloom");
    let target = startClassicWorld(createClassicWorldState("signal-bloom", targetRules));
    target = stepClassicWorld(
      target,
      { ...NEUTRAL_CLASSIC_INPUT, pointerActive: true, pointerX: 720, pointerY: 180 },
      targetRules,
      1 / 60,
    );
    expect(target.player).toMatchObject({ x: 720, y: 180 });
  });

  it("limits Moonthread to one air-step per landing and clamps the upper world edge", () => {
    const contract = rules("moonthread-ronin");
    let state = startClassicWorld(createClassicWorldState("moonthread-ronin", contract));
    state = stepClassicWorld(
      state,
      { ...NEUTRAL_CLASSIC_INPUT, primary: true },
      contract,
      1 / 60,
    );
    state = stepClassicWorld(state, NEUTRAL_CLASSIC_INPUT, contract, 1 / 60);
    state = stepClassicWorld(
      state,
      { ...NEUTRAL_CLASSIC_INPUT, primary: true },
      contract,
      1 / 60,
    );
    expect(state.player.energy).toBe(0);
    expect(state.message).toBe("MOONTHREAD AIR-STEP");

    for (let frame = 0; frame < 16; frame += 1) {
      state = stepClassicWorld(state, NEUTRAL_CLASSIC_INPUT, contract, 1 / 60);
    }
    expect(state.player.grounded).toBe(false);
    expect(state.player.cooldown).toBe(0);
    const velocityBeforeRejectedStep = state.player.vy;
    state = stepClassicWorld(
      state,
      { ...NEUTRAL_CLASSIC_INPUT, primary: true },
      contract,
      1 / 60,
    );
    expect(state.player.energy).toBe(0);
    expect(state.player.vy).toBeCloseTo(
      velocityBeforeRejectedStep + contract.gravity / 60,
      8,
    );

    state.player.y = 24.5;
    state.player.vy = -600;
    state.inputLatch.primary = false;
    const clamped = stepClassicWorld(state, NEUTRAL_CLASSIC_INPUT, contract, 1 / 60);
    expect(clamped.player.y).toBe(24);
    expect(clamped.player.vy).toBe(0);
  });

  it("survives a bounded long replay without NaN or runaway entities", () => {
    for (const id of MICRO_GAME_IDS) {
      const contract = rules(id);
      const replay = simulateWithBounds(
        startClassicWorld(createClassicWorldState(id, contract)),
        contract,
        1_200,
      );
      const state = replay.state;
      const numeric = [state.player.x, state.player.y, state.score, state.progress, state.clock];
      expect(numeric.every(Number.isFinite), id).toBe(true);
      expect(replay.minimumX, `${id} minimum x`).toBeGreaterThanOrEqual(0);
      expect(replay.maximumX, `${id} maximum x`).toBeLessThanOrEqual(CLASSIC_WORLD_WIDTH);
      expect(replay.minimumY, `${id} minimum y`).toBeGreaterThanOrEqual(0);
      expect(replay.maximumY, `${id} maximum y`).toBeLessThanOrEqual(CLASSIC_WORLD_HEIGHT);
      expect(state.actors.length, id).toBeLessThanOrEqual(512);
      expect(state.shots.length, id).toBeLessThanOrEqual(512);
      expect(state.particles.length, id).toBeLessThanOrEqual(2_048);

      const restored = restoreClassicWorld(snapshotClassicWorld(state));
      expect(restored, `${id} restored state`).toEqual(state);
      expect(snapshotClassicWorld(restored), `${id} restored snapshot`).toEqual(
        snapshotClassicWorld(state),
      );
    }
  });
});

function rules(game: string): ClassicRuleContract {
  return {
    schema: "axirune-arcade/classic/1",
    game,
    stage: 1,
    score: 0,
    tempo: 1,
    gravity: gravityFor(game),
    enemySpeed: 120,
    spawnIntervalMs: 420,
    reward: 100,
    phase: "calm",
  };
}

function simulateWithBounds(
  initial: ClassicWorldState,
  contract: ClassicRuleContract,
  frames: number,
) {
  let state = initial;
  let minimumX = state.player.x;
  let maximumX = state.player.x;
  let minimumY = state.player.y;
  let maximumY = state.player.y;
  for (let frame = 0; frame < frames; frame += 1) {
    state = stepClassicWorld(state, scriptedInput(frame), contract, 1 / 60);
    minimumX = Math.min(minimumX, state.player.x);
    maximumX = Math.max(maximumX, state.player.x);
    minimumY = Math.min(minimumY, state.player.y);
    maximumY = Math.max(maximumY, state.player.y);
  }
  return { state, minimumX, maximumX, minimumY, maximumY };
}

function gravityFor(game: string): number {
  if (game === "aetherstep-foundry") return 1_680;
  if (game === "moonthread-ronin") return 1_540;
  if (game === "alloy-tempest") return 1_420;
  if (game === "orbit-foundry") return 460;
  return 0;
}

function simulate(
  initial: ClassicWorldState,
  contract: ClassicRuleContract,
  frames: number,
): ClassicWorldState {
  let state = initial;
  for (let frame = 0; frame < frames && state.status === "running"; frame += 1) {
    state = stepClassicWorld(state, scriptedInput(frame), contract, 1 / 60);
  }
  return state;
}

function scriptedInput(frame: number): ClassicWorldInput {
  return {
    left: frame % 180 >= 120,
    right: frame % 180 < 90,
    up: frame % 140 > 108,
    down: frame % 140 > 70 && frame % 140 < 95,
    primary: frame % 31 === 0,
    secondary: frame % 47 === 0,
    pointerActive: frame % 40 < 2,
    pointerX: 120 + (frame * 17) % 720,
    pointerY: 90 + (frame * 11) % 360,
  };
}
