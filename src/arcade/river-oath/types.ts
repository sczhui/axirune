export const RIVER_OATH_SNAPSHOT_SCHEMA = "axirune-arcade/river-oath-snapshot/1" as const;
export const RIVER_OATH_FIXED_HZ = 60 as const;

export type RiverOathStatus =
  | "ready"
  | "running"
  | "paused"
  | "stage-clear"
  | "campaign-clear"
  | "game-over";

export type RiverOathPlayerAction =
  | "idle"
  | "walk"
  | "light"
  | "heavy"
  | "dodge"
  | "guard"
  | "launcher"
  | "skill"
  | "hurt"
  | "defeated";

export type RiverOathEnemyAction =
  | "idle"
  | "approach"
  | "strafe"
  | "attack"
  | "recover"
  | "hurt"
  | "defeated";

export type RiverOathEnemyKind =
  | "river-raider"
  | "reed-spearman"
  | "hill-archer"
  | "lacquer-guard"
  | "rope-hooker"
  | "ember-alchemist"
  | "banner-caller"
  | "iron-breaker"
  | "reedwater-warden"
  | "cinder-overseer"
  | "harbor-master"
  | "cloudbreak-oath";

export type RiverOathEnemyBehavior =
  | "skirmisher"
  | "reach"
  | "ranged"
  | "defender"
  | "controller"
  | "bomber"
  | "support"
  | "brute"
  | "boss";

export type RiverOathEnemyAttackStyle =
  | "slash"
  | "thrust"
  | "arrow"
  | "shield"
  | "hook"
  | "ember"
  | "rally"
  | "smash"
  | "tide"
  | "furnace"
  | "anchor"
  | "storm";

export type RiverOathHeroId = "willow-duelist" | "astral-lancer" | "iron-tactician";
export type RiverOathPickupKind = "herbal-draught" | "focus-seal" | "war-drum";

export interface RiverOathInput {
  /** Horizontal world movement, normalized to [-1, 1]. */
  readonly moveX?: number;
  /** Foreground/background lane movement, normalized to [-1, 1]. */
  readonly moveLane?: number;
  readonly light?: boolean;
  readonly heavy?: boolean;
  readonly dodge?: boolean;
  readonly guard?: boolean;
  readonly launcher?: boolean;
  readonly skill?: boolean;
  readonly pause?: boolean;
}

export interface RiverOathInputLatch {
  light: boolean;
  heavy: boolean;
  dodge: boolean;
  guard: boolean;
  launcher: boolean;
  skill: boolean;
  pause: boolean;
}

export interface RiverOathArenaBounds {
  minX: number;
  maxX: number;
  minLane: number;
  maxLane: number;
}

export interface RiverOathSceneLayer {
  id: string;
  depth: number;
  motif: string;
  parallax: number;
  tint: string;
}

export interface RiverOathScene {
  id: string;
  title: string;
  subtitle: string;
  timeOfDay: "dawn" | "day" | "dusk" | "night";
  weather: "clear" | "mist" | "rain" | "embers";
  palette: readonly [string, string, string, string];
  arena: RiverOathArenaBounds;
  layers: readonly RiverOathSceneLayer[];
  setPieces: readonly string[];
}

export interface RiverOathEnemySpawn {
  kind: RiverOathEnemyKind;
  count: number;
  side: "left" | "right" | "split";
  lane: number;
  spacing: number;
}

export interface RiverOathWaveDefinition {
  id: string;
  intro: string;
  boss: boolean;
  spawns: readonly RiverOathEnemySpawn[];
}

export interface RiverOathStageDefinition {
  id: string;
  scene: RiverOathScene;
  waves: readonly RiverOathWaveDefinition[];
  branches?: readonly RiverOathBranchDefinition[];
}

export interface RiverOathBranchDefinition {
  id: string;
  label: string;
  nextStageId: string;
  routeTag: string;
}

export interface RiverOathCampaign {
  schema: "axirune-arcade/river-oath-campaign/1";
  id: string;
  title: string;
  stages: readonly RiverOathStageDefinition[];
}

export interface RiverOathAttackRule {
  durationTicks: number;
  activeTick: number;
  damage: number;
  range: number;
  laneRange: number;
  knockback: number;
  maxTargets: number;
}

export interface RiverOathHeroProfile {
  id: RiverOathHeroId;
  name: string;
  title: string;
  weapon: {
    id: string;
    label: string;
    reachMultiplier: number;
    damageMultiplier: number;
  };
  skill: {
    id: string;
    label: string;
    damageMultiplier: number;
    rangeMultiplier: number;
    costMultiplier: number;
  };
  healthMultiplier: number;
  moveSpeedMultiplier: number;
  laneSpeedMultiplier: number;
}

export interface RiverOathEnemyRule {
  behavior: RiverOathEnemyBehavior;
  attackStyle: RiverOathEnemyAttackStyle;
  maxHealth: number;
  moveSpeed: number;
  laneSpeed: number;
  damage: number;
  attackRange: number;
  attackLaneRange: number;
  attackDurationTicks: number;
  attackActiveTick: number;
  attackCooldownTicks: number;
  score: number;
}

export interface RiverOathRules {
  schema: "axirune-arcade/river-oath-rules/1";
  player: {
    maxHealth: number;
    moveSpeed: number;
    laneSpeed: number;
    maxFocus: number;
    focusPerHit: number;
    skillCost: number;
  };
  heroes: Record<RiverOathHeroId, RiverOathHeroProfile>;
  combat: {
    light: RiverOathAttackRule;
    lightChainMultipliers: readonly [number, number, number];
    lightQueueStartTick: number;
    heavy: RiverOathAttackRule;
    launcher: RiverOathAttackRule;
    skill: RiverOathAttackRule;
    skillCooldownTicks: number;
    dodgeDurationTicks: number;
    dodgeInvulnerableTicks: number;
    dodgeDistance: number;
    guardDamageMultiplier: number;
    launcherGravity: number;
    comboWindowTicks: number;
    hurtTicks: number;
  };
  enemies: Record<RiverOathEnemyKind, RiverOathEnemyRule>;
  waves: {
    betweenWaveTicks: number;
    maximumEnemies: number;
  };
  pickups: {
    dropChance: number;
    maximumPickups: number;
    lifetimeTicks: number;
    herbalHealing: number;
    focusGain: number;
    warDrumMultiplier: number;
    warDrumDurationTicks: number;
  };
}

export interface RiverOathRuleOverrides {
  readonly player?: Partial<RiverOathRules["player"]>;
  readonly heroes?: Partial<{
    readonly [Hero in RiverOathHeroId]: Partial<Omit<RiverOathHeroProfile, "weapon" | "skill">> & {
      readonly weapon?: Partial<RiverOathHeroProfile["weapon"]>;
      readonly skill?: Partial<RiverOathHeroProfile["skill"]>;
    };
  }>;
  readonly combat?: Partial<Omit<RiverOathRules["combat"], "light" | "heavy" | "launcher" | "skill">> & {
    readonly light?: Partial<RiverOathAttackRule>;
    readonly heavy?: Partial<RiverOathAttackRule>;
    readonly launcher?: Partial<RiverOathAttackRule>;
    readonly skill?: Partial<RiverOathAttackRule>;
  };
  readonly enemies?: Partial<{
    readonly [Kind in RiverOathEnemyKind]: Partial<RiverOathRules["enemies"][Kind]>;
  }>;
  readonly waves?: Partial<RiverOathRules["waves"]>;
  readonly pickups?: Partial<RiverOathRules["pickups"]>;
}

export interface RiverOathComboState {
  chainStep: 0 | 1 | 2;
  queued: boolean;
  hits: number;
  expiresInTicks: number;
}

export interface RiverOathFighterState {
  id: number;
  heroId: RiverOathHeroId;
  x: number;
  lane: number;
  velocityX: number;
  velocityLane: number;
  facing: -1 | 1;
  health: number;
  maxHealth: number;
  focus: number;
  action: RiverOathPlayerAction;
  actionTick: number;
  attackSerial: number;
  attackConnected: boolean;
  invulnerableTicks: number;
  skillCooldownTicks: number;
  attackBuffTicks: number;
  combo: RiverOathComboState;
}

export interface RiverOathEnemyState {
  id: number;
  kind: RiverOathEnemyKind;
  x: number;
  lane: number;
  height: number;
  velocityHeight: number;
  velocityX: number;
  velocityLane: number;
  facing: -1 | 1;
  health: number;
  maxHealth: number;
  action: RiverOathEnemyAction;
  actionTick: number;
  attackCooldownTicks: number;
  lastPlayerAttackSerial: number;
  phase: 1 | 2 | 3;
  boss: boolean;
}

export interface RiverOathPickupState {
  id: number;
  kind: RiverOathPickupKind;
  x: number;
  lane: number;
  ageTicks: number;
}

export interface RiverOathBranchState {
  available: readonly string[];
  selected: string | null;
  routeHistory: string[];
}

export type RiverOathEffectKind =
  | "slash"
  | "impact"
  | "dust"
  | "focus"
  | "defeat"
  | "boss-aura";

export interface RiverOathEffectState {
  id: number;
  kind: RiverOathEffectKind;
  x: number;
  lane: number;
  ageTicks: number;
  durationTicks: number;
  intensity: number;
}

export interface RiverOathSnapshot {
  schema: typeof RIVER_OATH_SNAPSHOT_SCHEMA;
  fixedStepHz: typeof RIVER_OATH_FIXED_HZ;
  initialSeed: number;
  randomState: number;
  tick: number;
  accumulatorUnits: number;
  status: RiverOathStatus;
  score: number;
  defeatedEnemies: number;
  stageIndex: number;
  waveIndex: number;
  betweenWaveTicksRemaining: number;
  nextEntityId: number;
  nextEffectId: number;
  rules: RiverOathRules;
  campaign: RiverOathCampaign;
  player: RiverOathFighterState;
  enemies: RiverOathEnemyState[];
  pickups: RiverOathPickupState[];
  effects: RiverOathEffectState[];
  branch: RiverOathBranchState;
  inputLatch: RiverOathInputLatch;
  message: string;
}

export type RiverOathEvent =
  | { type: "stage-started"; tick: number; stageIndex: number; stageId: string }
  | { type: "wave-started"; tick: number; stageIndex: number; waveIndex: number; enemyCount: number }
  | { type: "player-action"; tick: number; action: RiverOathPlayerAction; chainStep: number }
  | { type: "enemy-hit"; tick: number; enemyId: number; damage: number; health: number; combo: number }
  | { type: "enemy-defeated"; tick: number; enemyId: number; scoreAwarded: number }
  | { type: "player-hit"; tick: number; enemyId: number; damage: number; health: number }
  | { type: "attack-guarded"; tick: number; enemyId: number; damage: number; health: number }
  | { type: "pickup-spawned"; tick: number; pickupId: number; kind: RiverOathPickupKind }
  | { type: "pickup-collected"; tick: number; pickupId: number; kind: RiverOathPickupKind }
  | { type: "branch-selected"; tick: number; branchId: string; nextStageId: string }
  | { type: "boss-phase"; tick: number; enemyId: number; phase: 2 | 3 }
  | { type: "wave-cleared"; tick: number; stageIndex: number; waveIndex: number }
  | { type: "stage-cleared"; tick: number; stageIndex: number; score: number }
  | { type: "campaign-cleared"; tick: number; score: number }
  | { type: "game-over"; tick: number; score: number };

export interface RiverOathAdvanceResult {
  readonly steps: number;
  readonly events: readonly RiverOathEvent[];
}

export interface RiverOathEngineOptions {
  readonly seed?: number;
  readonly heroId?: RiverOathHeroId;
  readonly rules?: RiverOathRuleOverrides;
  readonly campaign?: RiverOathCampaign;
}

/** Plain-data projection passed to a compiled Axirune rules capsule each fixed frame. */
export interface RiverOathRuleFrameInput {
  readonly schema: "axirune-arcade/river-oath-rule-input/1";
  readonly tick: number;
  readonly stage: number;
  readonly stageId: string;
  readonly wave: number;
  readonly waveId: string;
  readonly bossWave: boolean;
  readonly heroId: RiverOathHeroId;
  readonly playerHealth: number;
  readonly playerFocus: number;
  readonly enemyCount: number;
  readonly defeated: number;
  readonly combo: number;
  readonly bossPhase: 0 | 1 | 2 | 3;
  readonly selectedBranch: string | null;
  readonly randomState: number;
}

/** Exact input record accepted by apps/arcade/river-oath.axi. */
export interface RiverOathAxiruneRuleInput {
  readonly stage: number;
  readonly wave: number;
  readonly defeated: number;
  readonly combo: number;
}
