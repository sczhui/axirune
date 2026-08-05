import type {
  RiverOathAttackRule,
  RiverOathEnemyAttackStyle,
  RiverOathEnemyBehavior,
  RiverOathEnemyKind,
  RiverOathEnemyRule,
  RiverOathHeroId,
  RiverOathHeroProfile,
  RiverOathRuleOverrides,
  RiverOathRules,
} from "./types.js";

export const DEFAULT_RIVER_OATH_RULES: RiverOathRules = deepFreeze({
  schema: "axirune-arcade/river-oath-rules/1",
  player: {
    maxHealth: 160,
    moveSpeed: 258,
    laneSpeed: 188,
    maxFocus: 100,
    focusPerHit: 9,
    skillCost: 55,
  },
  heroes: {
    "willow-duelist": hero(
      "willow-duelist",
      "Suyin",
      "Willow Duelist",
      0.82,
      1.2,
      1.16,
      "willow-sabre",
      "Willow Sabre",
      1.08,
      0.94,
      "rain-of-leaves",
      "Rain of Leaves",
      0.92,
      1.22,
      0.82,
    ),
    "astral-lancer": hero(
      "astral-lancer",
      "Jiyan",
      "Astral Lancer",
      1,
      1,
      1,
      "star-pike",
      "Star Pike",
      1.2,
      1.08,
      "comet-standard",
      "Comet Standard",
      1.08,
      1.12,
      1,
    ),
    "iron-tactician": hero(
      "iron-tactician",
      "Moyan",
      "Iron Tactician",
      1.22,
      0.86,
      0.9,
      "command-blade",
      "Command Blade",
      0.94,
      1.22,
      "eightfold-seal",
      "Eightfold Seal",
      1.28,
      0.9,
      1.12,
    ),
  },
  combat: {
    light: {
      durationTicks: 18,
      activeTick: 7,
      damage: 18,
      range: 116,
      laneRange: 52,
      knockback: 22,
      maxTargets: 2,
    },
    lightChainMultipliers: [1, 1.25, 1.65],
    lightQueueStartTick: 8,
    heavy: {
      durationTicks: 34,
      activeTick: 18,
      damage: 42,
      range: 142,
      laneRange: 62,
      knockback: 54,
      maxTargets: 3,
    },
    launcher: {
      durationTicks: 30,
      activeTick: 15,
      damage: 30,
      range: 112,
      laneRange: 54,
      knockback: 18,
      maxTargets: 2,
    },
    skill: {
      durationTicks: 46,
      activeTick: 20,
      damage: 62,
      range: 206,
      laneRange: 138,
      knockback: 76,
      maxTargets: 12,
    },
    skillCooldownTicks: 240,
    dodgeDurationTicks: 22,
    dodgeInvulnerableTicks: 15,
    dodgeDistance: 154,
    guardDamageMultiplier: 0.28,
    launcherGravity: 1_240,
    comboWindowTicks: 108,
    hurtTicks: 20,
  },
  enemies: {
    "river-raider": enemy("skirmisher", "slash", 52, 126, 92, 10, 70, 42, 34, 17, 82, 120),
    "reed-spearman": enemy("reach", "thrust", 78, 104, 82, 15, 126, 45, 42, 22, 105, 190),
    "hill-archer": enemy("ranged", "arrow", 58, 82, 76, 12, 238, 40, 48, 26, 118, 210),
    "lacquer-guard": enemy("defender", "shield", 132, 76, 62, 17, 86, 58, 44, 23, 92, 290),
    "rope-hooker": enemy("controller", "hook", 88, 112, 98, 14, 176, 52, 46, 25, 108, 260),
    "ember-alchemist": enemy("bomber", "ember", 74, 84, 70, 18, 218, 92, 56, 31, 126, 320),
    "banner-caller": enemy("support", "rally", 96, 90, 78, 9, 168, 72, 52, 28, 138, 340),
    "iron-breaker": enemy("brute", "smash", 238, 68, 58, 28, 112, 68, 54, 30, 112, 520),
    "reedwater-warden": enemy("boss", "tide", 620, 112, 96, 27, 142, 74, 48, 23, 68, 1_600),
    "cinder-overseer": enemy("boss", "furnace", 700, 98, 82, 31, 188, 108, 58, 31, 76, 1_850),
    "harbor-master": enemy("boss", "anchor", 760, 104, 90, 34, 172, 82, 54, 27, 70, 2_100),
    "cloudbreak-oath": enemy("boss", "storm", 880, 118, 102, 38, 204, 116, 62, 29, 62, 2_500),
  },
  waves: {
    betweenWaveTicks: 84,
    maximumEnemies: 24,
  },
  pickups: {
    dropChance: 0.34,
    maximumPickups: 8,
    lifetimeTicks: 720,
    herbalHealing: 38,
    focusGain: 42,
    warDrumMultiplier: 1.28,
    warDrumDurationTicks: 420,
  },
});

export function resolveRiverOathRules(overrides: RiverOathRuleOverrides = {}): RiverOathRules {
  const resolved: RiverOathRules = {
    schema: "axirune-arcade/river-oath-rules/1",
    player: { ...DEFAULT_RIVER_OATH_RULES.player, ...overrides.player },
    heroes: {
      "willow-duelist": mergeHero(DEFAULT_RIVER_OATH_RULES.heroes["willow-duelist"], overrides.heroes?.["willow-duelist"]),
      "astral-lancer": mergeHero(DEFAULT_RIVER_OATH_RULES.heroes["astral-lancer"], overrides.heroes?.["astral-lancer"]),
      "iron-tactician": mergeHero(DEFAULT_RIVER_OATH_RULES.heroes["iron-tactician"], overrides.heroes?.["iron-tactician"]),
    },
    combat: {
      ...DEFAULT_RIVER_OATH_RULES.combat,
      ...overrides.combat,
      light: { ...DEFAULT_RIVER_OATH_RULES.combat.light, ...overrides.combat?.light },
      heavy: { ...DEFAULT_RIVER_OATH_RULES.combat.heavy, ...overrides.combat?.heavy },
      launcher: { ...DEFAULT_RIVER_OATH_RULES.combat.launcher, ...overrides.combat?.launcher },
      skill: { ...DEFAULT_RIVER_OATH_RULES.combat.skill, ...overrides.combat?.skill },
      lightChainMultipliers:
        overrides.combat?.lightChainMultipliers ??
        DEFAULT_RIVER_OATH_RULES.combat.lightChainMultipliers,
    },
    enemies: Object.fromEntries(
      RIVER_OATH_ENEMY_KINDS.map((kind) => [
        kind,
        { ...DEFAULT_RIVER_OATH_RULES.enemies[kind], ...overrides.enemies?.[kind] },
      ]),
    ) as Record<RiverOathEnemyKind, RiverOathEnemyRule>,
    waves: { ...DEFAULT_RIVER_OATH_RULES.waves, ...overrides.waves },
    pickups: { ...DEFAULT_RIVER_OATH_RULES.pickups, ...overrides.pickups },
  };
  assertRiverOathRules(resolved);
  return resolved;
}

export function assertRiverOathRules(rules: RiverOathRules): void {
  if (rules.schema !== "axirune-arcade/river-oath-rules/1") {
    throw new Error("River Oath rules schema is invalid.");
  }
  positiveFinite("player.maxHealth", rules.player.maxHealth);
  positiveFinite("player.moveSpeed", rules.player.moveSpeed);
  positiveFinite("player.laneSpeed", rules.player.laneSpeed);
  positiveFinite("player.maxFocus", rules.player.maxFocus);
  nonNegativeFinite("player.focusPerHit", rules.player.focusPerHit);
  positiveFinite("player.skillCost", rules.player.skillCost);
  for (const heroId of HERO_IDS) assertHero(rules.heroes[heroId], heroId);
  assertAttack("combat.light", rules.combat.light);
  assertAttack("combat.heavy", rules.combat.heavy);
  assertAttack("combat.launcher", rules.combat.launcher);
  assertAttack("combat.skill", rules.combat.skill);
  for (const [index, multiplier] of rules.combat.lightChainMultipliers.entries()) {
    positiveFinite(`combat.lightChainMultipliers.${index}`, multiplier);
  }
  integerInRange("combat.lightQueueStartTick", rules.combat.lightQueueStartTick, 0, rules.combat.light.durationTicks);
  integerInRange("combat.skillCooldownTicks", rules.combat.skillCooldownTicks, 0, 36_000);
  integerInRange("combat.dodgeDurationTicks", rules.combat.dodgeDurationTicks, 1, 600);
  integerInRange("combat.dodgeInvulnerableTicks", rules.combat.dodgeInvulnerableTicks, 0, rules.combat.dodgeDurationTicks);
  positiveFinite("combat.dodgeDistance", rules.combat.dodgeDistance);
  unitInterval("combat.guardDamageMultiplier", rules.combat.guardDamageMultiplier);
  positiveFinite("combat.launcherGravity", rules.combat.launcherGravity);
  integerInRange("combat.comboWindowTicks", rules.combat.comboWindowTicks, 1, 36_000);
  integerInRange("combat.hurtTicks", rules.combat.hurtTicks, 1, 600);
  if (rules.combat.lightChainMultipliers.length !== 3) {
    throw new Error("combat.lightChainMultipliers must contain exactly three values.");
  }
  for (const kind of RIVER_OATH_ENEMY_KINDS) {
    const rule = rules.enemies[kind];
    if (!ENEMY_BEHAVIORS.has(rule.behavior) || !ENEMY_ATTACK_STYLES.has(rule.attackStyle)) {
      throw new Error(`enemies.${kind} behavior or attack style is invalid.`);
    }
    positiveFinite(`enemies.${kind}.maxHealth`, rule.maxHealth);
    positiveFinite(`enemies.${kind}.moveSpeed`, rule.moveSpeed);
    positiveFinite(`enemies.${kind}.laneSpeed`, rule.laneSpeed);
    nonNegativeFinite(`enemies.${kind}.damage`, rule.damage);
    positiveFinite(`enemies.${kind}.attackRange`, rule.attackRange);
    positiveFinite(`enemies.${kind}.attackLaneRange`, rule.attackLaneRange);
    integerInRange(`enemies.${kind}.attackDurationTicks`, rule.attackDurationTicks, 1, 600);
    integerInRange(`enemies.${kind}.attackActiveTick`, rule.attackActiveTick, 1, rule.attackDurationTicks);
    integerInRange(`enemies.${kind}.attackCooldownTicks`, rule.attackCooldownTicks, 0, 36_000);
    nonNegativeFinite(`enemies.${kind}.score`, rule.score);
  }
  integerInRange("waves.betweenWaveTicks", rules.waves.betweenWaveTicks, 1, 36_000);
  integerInRange("waves.maximumEnemies", rules.waves.maximumEnemies, 1, 128);
  unitInterval("pickups.dropChance", rules.pickups.dropChance);
  integerInRange("pickups.maximumPickups", rules.pickups.maximumPickups, 0, 64);
  integerInRange("pickups.lifetimeTicks", rules.pickups.lifetimeTicks, 1, 36_000);
  nonNegativeFinite("pickups.herbalHealing", rules.pickups.herbalHealing);
  nonNegativeFinite("pickups.focusGain", rules.pickups.focusGain);
  positiveFinite("pickups.warDrumMultiplier", rules.pickups.warDrumMultiplier);
  integerInRange("pickups.warDrumDurationTicks", rules.pickups.warDrumDurationTicks, 1, 36_000);
}

export const RIVER_OATH_HERO_IDS = [
  "willow-duelist",
  "astral-lancer",
  "iron-tactician",
] as const satisfies readonly RiverOathHeroId[];

const HERO_IDS = RIVER_OATH_HERO_IDS;

export const RIVER_OATH_ENEMY_KINDS = [
  "river-raider",
  "reed-spearman",
  "hill-archer",
  "lacquer-guard",
  "rope-hooker",
  "ember-alchemist",
  "banner-caller",
  "iron-breaker",
  "reedwater-warden",
  "cinder-overseer",
  "harbor-master",
  "cloudbreak-oath",
] as const satisfies readonly RiverOathEnemyKind[];

const ENEMY_BEHAVIORS = new Set<RiverOathEnemyBehavior>([
  "skirmisher",
  "reach",
  "ranged",
  "defender",
  "controller",
  "bomber",
  "support",
  "brute",
  "boss",
]);

const ENEMY_ATTACK_STYLES = new Set<RiverOathEnemyAttackStyle>([
  "slash",
  "thrust",
  "arrow",
  "shield",
  "hook",
  "ember",
  "rally",
  "smash",
  "tide",
  "furnace",
  "anchor",
  "storm",
]);

function enemy(
  behavior: RiverOathEnemyBehavior,
  attackStyle: RiverOathEnemyAttackStyle,
  maxHealth: number,
  moveSpeed: number,
  laneSpeed: number,
  damage: number,
  attackRange: number,
  attackLaneRange: number,
  attackDurationTicks: number,
  attackActiveTick: number,
  attackCooldownTicks: number,
  score: number,
): RiverOathEnemyRule {
  return {
    behavior,
    attackStyle,
    maxHealth,
    moveSpeed,
    laneSpeed,
    damage,
    attackRange,
    attackLaneRange,
    attackDurationTicks,
    attackActiveTick,
    attackCooldownTicks,
    score,
  };
}

function hero(
  id: RiverOathHeroId,
  name: string,
  title: string,
  healthMultiplier: number,
  moveSpeedMultiplier: number,
  laneSpeedMultiplier: number,
  weaponId: string,
  weaponLabel: string,
  reachMultiplier: number,
  damageMultiplier: number,
  skillId: string,
  skillLabel: string,
  skillDamageMultiplier: number,
  skillRangeMultiplier: number,
  skillCostMultiplier: number,
): RiverOathHeroProfile {
  return {
    id,
    name,
    title,
    healthMultiplier,
    moveSpeedMultiplier,
    laneSpeedMultiplier,
    weapon: { id: weaponId, label: weaponLabel, reachMultiplier, damageMultiplier },
    skill: {
      id: skillId,
      label: skillLabel,
      damageMultiplier: skillDamageMultiplier,
      rangeMultiplier: skillRangeMultiplier,
      costMultiplier: skillCostMultiplier,
    },
  };
}

function mergeHero(
  base: RiverOathHeroProfile,
  override?: NonNullable<RiverOathRuleOverrides["heroes"]>[RiverOathHeroId],
): RiverOathHeroProfile {
  return {
    ...base,
    ...override,
    id: base.id,
    weapon: { ...base.weapon, ...override?.weapon },
    skill: { ...base.skill, ...override?.skill },
  };
}

function assertHero(heroProfile: RiverOathHeroProfile, id: RiverOathHeroId): void {
  if (heroProfile.id !== id || !heroProfile.name || !heroProfile.title) {
    throw new Error(`heroes.${id} identity is invalid.`);
  }
  positiveFinite(`heroes.${id}.healthMultiplier`, heroProfile.healthMultiplier);
  positiveFinite(`heroes.${id}.moveSpeedMultiplier`, heroProfile.moveSpeedMultiplier);
  positiveFinite(`heroes.${id}.laneSpeedMultiplier`, heroProfile.laneSpeedMultiplier);
  positiveFinite(`heroes.${id}.weapon.reachMultiplier`, heroProfile.weapon.reachMultiplier);
  positiveFinite(`heroes.${id}.weapon.damageMultiplier`, heroProfile.weapon.damageMultiplier);
  positiveFinite(`heroes.${id}.skill.damageMultiplier`, heroProfile.skill.damageMultiplier);
  positiveFinite(`heroes.${id}.skill.rangeMultiplier`, heroProfile.skill.rangeMultiplier);
  positiveFinite(`heroes.${id}.skill.costMultiplier`, heroProfile.skill.costMultiplier);
}

function assertAttack(path: string, rule: RiverOathAttackRule): void {
  integerInRange(`${path}.durationTicks`, rule.durationTicks, 1, 600);
  integerInRange(`${path}.activeTick`, rule.activeTick, 1, rule.durationTicks);
  positiveFinite(`${path}.damage`, rule.damage);
  positiveFinite(`${path}.range`, rule.range);
  positiveFinite(`${path}.laneRange`, rule.laneRange);
  nonNegativeFinite(`${path}.knockback`, rule.knockback);
  integerInRange(`${path}.maxTargets`, rule.maxTargets, 1, 128);
}

function positiveFinite(path: string, value: number): void {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${path} must be positive and finite.`);
}

function nonNegativeFinite(path: string, value: number): void {
  if (!Number.isFinite(value) || value < 0) throw new Error(`${path} must be non-negative and finite.`);
}

function unitInterval(path: string, value: number): void {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error(`${path} must be between zero and one.`);
  }
}

function integerInRange(path: string, value: number, minimum: number, maximum: number): void {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${path} must be an integer from ${minimum} through ${maximum}.`);
  }
}

function deepFreeze<Value>(value: Value): Value {
  if (value && typeof value === "object") {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}
