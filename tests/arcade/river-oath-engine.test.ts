import { describe, expect, it } from "vitest";
import {
  RIVER_OATH_FIXED_HZ,
  RiverOathEngine,
  createRiverOathEngine,
  getRiverOathStage,
  type RiverOathEvent,
  type RiverOathInput,
  type RiverOathPickupKind,
  type RiverOathSnapshot,
} from "../../src/arcade/river-oath/index.js";

const PEACEFUL_ENEMIES = {
  "river-raider": { damage: 0, attackCooldownTicks: 10_000 },
  "reed-spearman": { damage: 0, attackCooldownTicks: 10_000 },
  "hill-archer": { damage: 0, attackCooldownTicks: 10_000 },
  "lacquer-guard": { damage: 0, attackCooldownTicks: 10_000 },
  "rope-hooker": { damage: 0, attackCooldownTicks: 10_000 },
  "ember-alchemist": { damage: 0, attackCooldownTicks: 10_000 },
  "banner-caller": { damage: 0, attackCooldownTicks: 10_000 },
  "iron-breaker": { damage: 0, attackCooldownTicks: 10_000 },
  "reedwater-warden": { damage: 0, attackCooldownTicks: 10_000 },
  "cinder-overseer": { damage: 0, attackCooldownTicks: 10_000 },
  "harbor-master": { damage: 0, attackCooldownTicks: 10_000 },
  "cloudbreak-oath": { damage: 0, attackCooldownTicks: 10_000 },
} as const;

describe("River Oath deterministic brawler engine", () => {
  it("produces identical 60 Hz state regardless of elapsed-time slicing", () => {
    const whole = createRiverOathEngine({ seed: 42, rules: { enemies: PEACEFUL_ENEMIES } });
    const sliced = createRiverOathEngine({ seed: 42, rules: { enemies: PEACEFUL_ENEMIES } });
    whole.start();
    sliced.start();

    expect(whole.advance(1_000, { moveX: 1 }).steps).toBe(RIVER_OATH_FIXED_HZ);
    for (let index = 0; index < 100; index += 1) sliced.advance(10, { moveX: 1 });

    expect(sliced.snapshot()).toEqual(whole.snapshot());
  });

  it("replays a mixed action script identically from the same seed", () => {
    const first = createRiverOathEngine({ seed: 0xcafe_babe, rules: { enemies: PEACEFUL_ENEMIES } });
    const second = createRiverOathEngine({ seed: 0xcafe_babe, rules: { enemies: PEACEFUL_ENEMIES } });
    first.start();
    second.start();

    for (let frame = 0; frame < 900; frame += 1) {
      const input = scriptedInput(frame);
      expect(second.tick(input)).toEqual(first.tick(input));
    }
    expect(second.snapshot()).toEqual(first.snapshot());
  });

  it("supports light chains, heavy attacks, launchers, dodges, guards, and skills", () => {
    const chain = engineWithTarget({ enemyHealth: 2_000 });
    const comboEvents = runFrames(chain, 64, (frame) => ({
      light: frame === 0 || frame === 9 || frame === 27,
    }));
    expect(comboEvents.filter(({ type }) => type === "enemy-hit")).toHaveLength(3);
    expect(chain.snapshot().player.combo.hits).toBe(3);

    const heavy = engineWithTarget();
    heavy.tick({ heavy: true });
    expect(heavy.snapshot().player.action).toBe("heavy");
    expect(runFrames(heavy, 20).some(({ type }) => type === "enemy-hit")).toBe(true);

    const launcher = engineWithTarget({ enemyHealth: 500 });
    launcher.tick({ launcher: true });
    runFrames(launcher, 15);
    expect(launcher.snapshot().enemies[0]?.height).toBeGreaterThan(0);

    const dodge = engineWithTarget();
    const beforeDodge = dodge.snapshot().player.x;
    dodge.tick({ moveX: 1, dodge: true });
    runFrames(dodge, 4, () => ({ moveX: 1 }));
    expect(dodge.snapshot().player).toMatchObject({ action: "dodge" });
    expect(dodge.snapshot().player.x).toBeGreaterThan(beforeDodge);
    expect(dodge.snapshot().player.invulnerableTicks).toBeGreaterThan(0);

    const skill = engineWithTarget({ enemyHealth: 500, focus: 100 });
    skill.tick({ skill: true });
    expect(skill.snapshot().player.action).toBe("skill");
    expect(runFrames(skill, 22).some(({ type }) => type === "enemy-hit")).toBe(true);

    const guard = engineWithAttackingTarget();
    const guarded = guard.tick({ guard: true }).events;
    expect(guarded).toContainEqual(expect.objectContaining({ type: "attack-guarded" }));
    expect(guard.snapshot().player.action).toBe("guard");
  });

  it("applies each hero's health, movement, reach, and damage profile", () => {
    const willow = createRiverOathEngine({
      heroId: "willow-duelist",
      rules: { enemies: PEACEFUL_ENEMIES },
    });
    const iron = createRiverOathEngine({
      heroId: "iron-tactician",
      rules: { enemies: PEACEFUL_ENEMIES },
    });
    willow.start();
    iron.start();
    for (let tick = 0; tick < 30; tick += 1) {
      willow.tick({ moveX: 1 });
      iron.tick({ moveX: 1 });
    }
    expect(willow.snapshot().player.x).toBeGreaterThan(iron.snapshot().player.x);
    expect(willow.snapshot().player.maxHealth).toBeLessThan(iron.snapshot().player.maxHealth);

    const willowStrike = engineWithTarget({ heroId: "willow-duelist", enemyHealth: 500 });
    const ironStrike = engineWithTarget({ heroId: "iron-tactician", enemyHealth: 500 });
    runFrames(willowStrike, 9, (frame) => ({ light: frame === 0 }));
    runFrames(ironStrike, 9, (frame) => ({ light: frame === 0 }));
    expect(ironStrike.snapshot().enemies[0]!.health).toBeLessThan(
      willowStrike.snapshot().enemies[0]!.health,
    );
  });

  it("drives enemies through deterministic approach, attack, and boss phases", () => {
    const first = createRiverOathEngine({ seed: 999 });
    const second = createRiverOathEngine({ seed: 999 });
    first.start();
    second.start();
    const before = first.snapshot().enemies.map(({ x, lane }) => [x, lane]);
    runFrames(first, 180);
    runFrames(second, 180);
    expect(first.snapshot()).toEqual(second.snapshot());
    expect(first.snapshot().enemies.map(({ x, lane }) => [x, lane])).not.toEqual(before);

    const phaseTwo = engineWithBoss(300, 500, 1);
    expect(phaseTwo.tick().events).toContainEqual(
      expect.objectContaining({ type: "boss-phase", phase: 2 }),
    );
    const phaseThreeSnapshot = phaseTwo.snapshot();
    phaseThreeSnapshot.enemies[0]!.health = 120;
    phaseThreeSnapshot.enemies[0]!.phase = 2;
    const phaseThree = RiverOathEngine.fromSnapshot(phaseThreeSnapshot);
    expect(phaseThree.tick().events).toContainEqual(
      expect.objectContaining({ type: "boss-phase", phase: 3 }),
    );
  });

  it("spawns and collects all three deterministic pickup effects", () => {
    for (const kind of ["herbal-draught", "focus-seal", "war-drum"] as const) {
      const engine = createRiverOathEngine();
      const snapshot = engine.snapshot();
      snapshot.player.health = Math.max(1, snapshot.player.maxHealth - 60);
      snapshot.pickups = [
        { id: snapshot.nextEntityId, kind, x: snapshot.player.x, lane: snapshot.player.lane, ageTicks: 0 },
      ];
      snapshot.nextEntityId += 1;
      const restored = RiverOathEngine.fromSnapshot(snapshot);
      restored.start();
      const before = restored.snapshot();
      const events = restored.tick().events;
      const after = restored.snapshot();

      expect(events).toContainEqual(
        expect.objectContaining({ type: "pickup-collected", kind }),
      );
      expect(after.pickups).toHaveLength(0);
      expect(pickupChanged(kind, before, after)).toBe(true);
    }

    const dropEngine = engineWithTarget({ enemyHealth: 1, pickupDropChance: 1 });
    const events = runFrames(dropEngine, 10, (frame) => ({ light: frame === 0 }));
    expect(events).toContainEqual(expect.objectContaining({ type: "pickup-spawned" }));
  });

  it("clears waves, exposes a branch, and advances along the selected route", () => {
    const waveEngine = engineWithTarget({ enemyHealth: 1, betweenWaveTicks: 2 });
    const waveEvents = runFrames(waveEngine, 12, (frame) => ({ light: frame === 0 }));
    expect(waveEvents).toContainEqual(
      expect.objectContaining({ type: "wave-cleared", waveIndex: 0 }),
    );
    expect(waveEvents).toContainEqual(
      expect.objectContaining({ type: "wave-started", waveIndex: 1 }),
    );
    expect(waveEngine.snapshot().waveIndex).toBe(1);
    expect(waveEngine.snapshot().enemies.length).toBeGreaterThan(0);

    const engine = engineAtFinalWaveWithOneTarget();
    const events = runFrames(engine, 24, (frame) => ({ skill: frame === 0 }));
    expect(events).toContainEqual(expect.objectContaining({ type: "stage-cleared" }));
    expect(engine.snapshot()).toMatchObject({
      status: "stage-clear",
      branch: { available: ["forge-road", "harbor-road"], selected: null },
    });

    expect(engine.chooseBranch("harbor-road")).toContainEqual({
      type: "branch-selected",
      tick: engine.tickCount,
      branchId: "harbor-road",
      nextStageId: "moonwake-harbor",
    });
    engine.advanceStage();
    expect(getRiverOathStage(engine.snapshot()).id).toBe("moonwake-harbor");
    expect(engine.snapshot().branch.routeHistory).toEqual([
      "reedwater-causeway",
      "moonwake-harbor",
    ]);
  });

  it("round-trips JSON snapshots and continues with byte-equivalent state", () => {
    const original = createRiverOathEngine({ seed: 88, rules: { enemies: PEACEFUL_ENEMIES } });
    original.start();
    runFrames(original, 287, scriptedInput);
    const restored = RiverOathEngine.deserialize(original.serialize());
    expect(restored.snapshot()).toEqual(original.snapshot());

    for (let frame = 287; frame < 620; frame += 1) {
      expect(restored.tick(scriptedInput(frame))).toEqual(original.tick(scriptedInput(frame)));
    }
    expect(restored.serialize()).toBe(original.serialize());
  });

  it("keeps every live object finite and inside scene bounds over a long replay", () => {
    const engine = createRiverOathEngine({
      seed: 0x1234_5678,
      rules: { enemies: PEACEFUL_ENEMIES, pickups: { dropChance: 1 } },
    });
    engine.start();
    for (let frame = 0; frame < 7_200; frame += 1) engine.tick(scriptedInput(frame));

    const snapshot = engine.snapshot();
    const arena = getRiverOathStage(snapshot).scene.arena;
    expect(snapshot.enemies.length).toBeLessThanOrEqual(snapshot.rules.waves.maximumEnemies);
    expect(snapshot.pickups.length).toBeLessThanOrEqual(snapshot.rules.pickups.maximumPickups);
    expect(snapshot.effects.length).toBeLessThanOrEqual(192);
    for (const item of [snapshot.player, ...snapshot.enemies, ...snapshot.pickups, ...snapshot.effects]) {
      expect(Number.isFinite(item.x)).toBe(true);
      expect(Number.isFinite(item.lane)).toBe(true);
      expect(item.x).toBeGreaterThanOrEqual(arena.minX);
      expect(item.x).toBeLessThanOrEqual(arena.maxX);
      expect(item.lane).toBeGreaterThanOrEqual(arena.minLane);
      expect(item.lane).toBeLessThanOrEqual(arena.maxLane);
    }
    expect(RiverOathEngine.deserialize(engine.serialize()).snapshot()).toEqual(snapshot);
  });
});

function engineWithTarget(options: {
  heroId?: "willow-duelist" | "astral-lancer" | "iron-tactician";
  enemyHealth?: number;
  focus?: number;
  pickupDropChance?: number;
  betweenWaveTicks?: number;
} = {}): RiverOathEngine {
  const engine = createRiverOathEngine({
    seed: 51,
    heroId: options.heroId,
    rules: {
      enemies: { ...PEACEFUL_ENEMIES, "river-raider": { maxHealth: 2_000, damage: 0 } },
      pickups: { dropChance: options.pickupDropChance ?? 0 },
      waves: { betweenWaveTicks: options.betweenWaveTicks ?? 84 },
    },
  });
  const snapshot = engine.snapshot();
  const target = snapshot.enemies[0]!;
  target.kind = "river-raider";
  target.health = options.enemyHealth ?? 100;
  target.maxHealth = 2_000;
  target.x = snapshot.player.x + 62;
  target.lane = snapshot.player.lane;
  target.attackCooldownTicks = 10_000;
  snapshot.enemies = [target];
  snapshot.player.focus = options.focus ?? 0;
  const restored = RiverOathEngine.fromSnapshot(snapshot);
  restored.start();
  return restored;
}

function engineWithAttackingTarget(): RiverOathEngine {
  const engine = createRiverOathEngine();
  const snapshot = engine.snapshot();
  const target = snapshot.enemies[0]!;
  const rule = snapshot.rules.enemies[target.kind];
  target.x = snapshot.player.x + Math.min(40, rule.attackRange - 2);
  target.lane = snapshot.player.lane;
  target.action = "attack";
  target.actionTick = rule.attackActiveTick - 1;
  target.facing = -1;
  snapshot.enemies = [target];
  const restored = RiverOathEngine.fromSnapshot(snapshot);
  restored.start();
  return restored;
}

function engineWithBoss(health: number, maxHealth: number, phase: 1 | 2 | 3): RiverOathEngine {
  const engine = createRiverOathEngine();
  const snapshot = engine.snapshot();
  const target = snapshot.enemies[0]!;
  target.boss = true;
  target.health = health;
  target.maxHealth = maxHealth;
  target.phase = phase;
  target.attackCooldownTicks = 10_000;
  snapshot.enemies = [target];
  const restored = RiverOathEngine.fromSnapshot(snapshot);
  restored.start();
  return restored;
}

function engineAtFinalWaveWithOneTarget(): RiverOathEngine {
  const engine = createRiverOathEngine({
    rules: {
      combat: { skill: { damage: 2_000, activeTick: 2 } },
      pickups: { dropChance: 0 },
      enemies: PEACEFUL_ENEMIES,
    },
  });
  const snapshot = engine.snapshot();
  snapshot.waveIndex = 2;
  const target = snapshot.enemies[0]!;
  target.health = 1;
  target.maxHealth = 1;
  target.boss = true;
  target.x = snapshot.player.x + 50;
  target.lane = snapshot.player.lane;
  snapshot.enemies = [target];
  snapshot.player.focus = snapshot.rules.player.maxFocus;
  const restored = RiverOathEngine.fromSnapshot(snapshot);
  restored.start();
  return restored;
}

function runFrames(
  engine: RiverOathEngine,
  frames: number,
  inputForFrame: (frame: number) => RiverOathInput = () => ({}),
): RiverOathEvent[] {
  const events: RiverOathEvent[] = [];
  for (let frame = 0; frame < frames; frame += 1) {
    events.push(...engine.tick(inputForFrame(frame)).events);
  }
  return events;
}

function scriptedInput(frame: number): RiverOathInput {
  return {
    moveX: Math.sin(frame / 43),
    moveLane: Math.cos(frame / 67),
    light: frame % 47 === 0,
    heavy: frame % 131 === 0,
    launcher: frame % 173 === 0,
    dodge: frame % 109 === 0,
    guard: frame % 211 >= 190,
    skill: frame % 307 === 0,
  };
}

function pickupChanged(
  kind: RiverOathPickupKind,
  before: RiverOathSnapshot,
  after: RiverOathSnapshot,
): boolean {
  if (kind === "herbal-draught") return after.player.health > before.player.health;
  if (kind === "focus-seal") return after.player.focus > before.player.focus;
  return after.player.attackBuffTicks > before.player.attackBuffTicks;
}
