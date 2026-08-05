import { describe, expect, it } from "vitest";
import {
  DEFAULT_RIVER_OATH_RULES,
  RIVER_OATH_CAMPAIGN,
  RIVER_OATH_ENEMY_KINDS,
  RIVER_OATH_HERO_IDS,
  RiverOathEngine,
  RiverOathSnapshotError,
  createRiverOathEngine,
  resolveRiverOathRules,
  toRiverOathAxiruneRuleInput,
  toRiverOathRuleFrameInput,
} from "../../src/arcade/river-oath/index.js";

describe("River Oath content and rule contracts", () => {
  it("defines four original scenes with exactly three authored waves each", () => {
    expect(RIVER_OATH_CAMPAIGN.stages.map(({ id, scene }) => [id, scene.title])).toEqual([
      ["reedwater-causeway", "Reedwater Causeway"],
      ["cinder-foundry", "Cinder Foundry"],
      ["moonwake-harbor", "Moonwake Harbor"],
      ["cloudbreak-beacon", "Cloudbreak Beacon"],
    ]);
    for (const stage of RIVER_OATH_CAMPAIGN.stages) {
      expect(stage.waves, stage.id).toHaveLength(3);
      expect(stage.scene.layers, stage.id).toHaveLength(3);
      expect(stage.scene.setPieces.length, stage.id).toBeGreaterThanOrEqual(3);
      expect(stage.waves.at(-1)?.boss, stage.id).toBe(true);
    }
    expect(RIVER_OATH_CAMPAIGN.stages.map((stage) => stage.waves[2]?.spawns[0]?.kind)).toEqual([
      "reedwater-warden",
      "cinder-overseer",
      "harbor-master",
      "cloudbreak-oath",
    ]);
    expect(RIVER_OATH_ENEMY_KINDS).toHaveLength(12);
    const ordinaryKinds = new Set(
      RIVER_OATH_CAMPAIGN.stages.flatMap((stage) =>
        stage.waves.slice(0, 2).flatMap((wave) => wave.spawns.map(({ kind }) => kind)),
      ),
    );
    expect(ordinaryKinds).toEqual(
      new Set([
        "river-raider",
        "reed-spearman",
        "hill-archer",
        "lacquer-guard",
        "rope-hooker",
        "ember-alchemist",
        "banner-caller",
        "iron-breaker",
      ]),
    );
    expect(new Set(RIVER_OATH_ENEMY_KINDS.map((kind) => DEFAULT_RIVER_OATH_RULES.enemies[kind].attackStyle)).size).toBe(12);
  });

  it("offers three mechanically distinct heroes and weapon/skill profiles", () => {
    expect(RIVER_OATH_HERO_IDS).toHaveLength(3);
    const heroes = RIVER_OATH_HERO_IDS.map((id) => DEFAULT_RIVER_OATH_RULES.heroes[id]);
    expect(new Set(heroes.map(({ healthMultiplier }) => healthMultiplier)).size).toBe(3);
    expect(new Set(heroes.map(({ moveSpeedMultiplier }) => moveSpeedMultiplier)).size).toBe(3);
    expect(new Set(heroes.map(({ weapon }) => weapon.id)).size).toBe(3);
    expect(new Set(heroes.map(({ skill }) => skill.id)).size).toBe(3);

    const healthByHero = RIVER_OATH_HERO_IDS.map(
      (heroId) => createRiverOathEngine({ heroId }).snapshot().player.maxHealth,
    );
    expect(new Set(healthByHero).size).toBe(3);
  });

  it("deep-merges safe rule overrides without mutating defaults", () => {
    const rules = resolveRiverOathRules({
      player: { maxHealth: 222 },
      heroes: {
        "willow-duelist": {
          weapon: { damageMultiplier: 1.5 },
          skill: { rangeMultiplier: 1.7 },
        },
      },
      combat: { launcher: { damage: 77 }, guardDamageMultiplier: 0.1 },
      pickups: { dropChance: 1 },
      waves: { betweenWaveTicks: 2 },
    });

    expect(rules.player.maxHealth).toBe(222);
    expect(rules.heroes["willow-duelist"].weapon).toMatchObject({
      id: "willow-sabre",
      damageMultiplier: 1.5,
    });
    expect(rules.heroes["willow-duelist"].skill.rangeMultiplier).toBe(1.7);
    expect(rules.combat.launcher).toMatchObject({ damage: 77, activeTick: 15 });
    expect(rules.combat.guardDamageMultiplier).toBe(0.1);
    expect(DEFAULT_RIVER_OATH_RULES.player.maxHealth).toBe(160);
  });

  it("rejects invalid injected values before a simulation is created", () => {
    expect(() => resolveRiverOathRules({ waves: { maximumEnemies: 0 } })).toThrow(
      /maximumEnemies/,
    );
    expect(() =>
      resolveRiverOathRules({ combat: { launcher: { activeTick: 999 } } }),
    ).toThrow(/activeTick/);
    expect(() =>
      resolveRiverOathRules({ pickups: { dropChance: 1.2 } }),
    ).toThrow(/dropChance/);
  });

  it("maps the current stage and wave into a capsule-friendly rules input", () => {
    const engine = createRiverOathEngine({ seed: 73, heroId: "iron-tactician" });
    const input = toRiverOathRuleFrameInput(engine.snapshot());

    expect(input).toEqual({
      schema: "axirune-arcade/river-oath-rule-input/1",
      tick: 0,
      stage: 1,
      stageId: "reedwater-causeway",
      wave: 1,
      waveId: "causeway-vanguard",
      bossWave: false,
      heroId: "iron-tactician",
      playerHealth: 195,
      playerFocus: 0,
      enemyCount: 4,
      defeated: 0,
      combo: 0,
      bossPhase: 0,
      selectedBranch: null,
      randomState: engine.snapshot().randomState,
    });
    expect(toRiverOathAxiruneRuleInput(engine.snapshot())).toEqual({
      stage: 1,
      wave: 1,
      defeated: 0,
      combo: 0,
    });
  });

  it("rejects malformed, unbounded, and non-finite snapshots", () => {
    const engine = createRiverOathEngine();
    const outside = engine.snapshot();
    outside.player.x = -1;
    expect(() => RiverOathEngine.fromSnapshot(outside)).toThrow(RiverOathSnapshotError);

    const nonFinite = engine.snapshot();
    nonFinite.enemies[0]!.lane = Number.NaN;
    expect(() => RiverOathEngine.fromSnapshot(nonFinite)).toThrow(/non-finite/);

    const malformed = engine.snapshot();
    Object.assign(malformed, { status: "teleporting" });
    expect(() => RiverOathEngine.fromSnapshot(malformed)).toThrow(/status/);
  });
});
