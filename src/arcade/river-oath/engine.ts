import { RIVER_OATH_CAMPAIGN } from "./campaign.js";
import { assertRiverOathRules, resolveRiverOathRules } from "./rules.js";
import {
  RIVER_OATH_FIXED_HZ,
  RIVER_OATH_SNAPSHOT_SCHEMA,
  type RiverOathAdvanceResult,
  type RiverOathArenaBounds,
  type RiverOathAttackRule,
  type RiverOathAxiruneRuleInput,
  type RiverOathCampaign,
  type RiverOathEffectKind,
  type RiverOathEnemyState,
  type RiverOathEngineOptions,
  type RiverOathEvent,
  type RiverOathFighterState,
  type RiverOathInput,
  type RiverOathInputLatch,
  type RiverOathHeroId,
  type RiverOathPickupKind,
  type RiverOathPlayerAction,
  type RiverOathRules,
  type RiverOathRuleFrameInput,
  type RiverOathSnapshot,
  type RiverOathStageDefinition,
  type RiverOathWaveDefinition,
} from "./types.js";

const TIME_UNITS_PER_SECOND = 1_000_000;
const MAX_ADVANCE_MS = 10_000;
const MAX_EFFECTS = 192;
const VALID_STATUSES = new Set([
  "ready",
  "running",
  "paused",
  "stage-clear",
  "campaign-clear",
  "game-over",
]);
const VALID_PLAYER_ACTIONS = new Set([
  "idle",
  "walk",
  "light",
  "heavy",
  "dodge",
  "guard",
  "launcher",
  "skill",
  "hurt",
  "defeated",
]);
const VALID_PICKUPS = new Set<RiverOathPickupKind>([
  "herbal-draught",
  "focus-seal",
  "war-drum",
]);
const EMPTY_INPUT: Required<RiverOathInput> = {
  moveX: 0,
  moveLane: 0,
  light: false,
  heavy: false,
  dodge: false,
  guard: false,
  launcher: false,
  skill: false,
  pause: false,
};

export class RiverOathSnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RiverOathSnapshotError";
  }
}

/**
 * Pure deterministic combat host for an original 2.5D historical-fantasy brawler.
 * Rendering, audio, wall-clock scheduling, models, tools, and network access stay outside.
 */
export class RiverOathEngine {
  private state: RiverOathSnapshot;

  constructor(options: RiverOathEngineOptions = {}) {
    const rules = resolveRiverOathRules(options.rules);
    const campaign = cloneJson(options.campaign ?? RIVER_OATH_CAMPAIGN);
    assertCampaign(campaign, rules);
    const seed = normalizeSeed(options.seed ?? 0x6f61_7468);
    this.state = createInitialSnapshot(
      seed,
      rules,
      campaign,
      options.heroId ?? "astral-lancer",
    );
  }

  static fromSnapshot(snapshot: RiverOathSnapshot): RiverOathEngine {
    assertRiverOathSnapshot(snapshot);
    const engine = Object.create(RiverOathEngine.prototype) as RiverOathEngine;
    engine.state = cloneJson(snapshot);
    return engine;
  }

  static deserialize(serialized: string): RiverOathEngine {
    let value: unknown;
    try {
      value = JSON.parse(serialized);
    } catch {
      throw new RiverOathSnapshotError("River Oath snapshot is not valid JSON.");
    }
    assertRiverOathSnapshot(value);
    return RiverOathEngine.fromSnapshot(value);
  }

  get status() {
    return this.state.status;
  }

  get tickCount(): number {
    return this.state.tick;
  }

  get stageIndex(): number {
    return this.state.stageIndex;
  }

  get waveIndex(): number {
    return this.state.waveIndex;
  }

  snapshot(): RiverOathSnapshot {
    return cloneJson(this.state);
  }

  serialize(): string {
    return JSON.stringify(this.state);
  }

  start(): readonly RiverOathEvent[] {
    if (this.state.status !== "ready") return [];
    this.state.status = "running";
    const stage = currentStage(this.state);
    const events: RiverOathEvent[] = [
      {
        type: "stage-started",
        tick: this.state.tick,
        stageIndex: this.state.stageIndex,
        stageId: stage.id,
      },
      waveStartedEvent(this.state),
    ];
    this.state.message = currentWave(this.state).intro;
    return events;
  }

  pause(): void {
    if (this.state.status === "running") this.state.status = "paused";
  }

  resume(): void {
    if (this.state.status === "paused") this.state.status = "running";
  }

  restart(): void {
    this.state = createInitialSnapshot(
      this.state.initialSeed,
      cloneJson(this.state.rules),
      cloneJson(this.state.campaign),
      this.state.player.heroId,
    );
  }

  /** Move to the next scene after a cleared stage. Final-stage completion is terminal. */
  advanceStage(): readonly RiverOathEvent[] {
    if (this.state.status !== "stage-clear") return [];
    const stage = currentStage(this.state);
    const selectedBranch =
      stage.branches?.find(({ id }) => id === this.state.branch.selected) ?? stage.branches?.[0];
    const nextStageIndex = selectedBranch
      ? this.state.campaign.stages.findIndex(({ id }) => id === selectedBranch.nextStageId)
      : this.state.stageIndex + 1;
    if (nextStageIndex < 0 || nextStageIndex >= this.state.campaign.stages.length) {
      throw new RiverOathSnapshotError("Selected branch does not lead to a campaign stage.");
    }
    this.state.stageIndex = nextStageIndex;
    this.state.waveIndex = 0;
    this.state.betweenWaveTicksRemaining = 0;
    this.state.effects = [];
    this.state.inputLatch = emptyLatch();
    const arena = currentStage(this.state).scene.arena;
    const retainedHealth = Math.min(
      this.state.player.maxHealth,
      this.state.player.health + Math.round(this.state.player.maxHealth * 0.3),
    );
    const heroId = this.state.player.heroId;
    this.state.player = createPlayer(this.state.rules, arena, heroId);
    this.state.player.health = retainedHealth;
    this.state.enemies = [];
    this.state.pickups = [];
    this.state.branch = {
      available: [],
      selected: null,
      routeHistory: [...this.state.branch.routeHistory, currentStage(this.state).id],
    };
    spawnCurrentWave(this.state);
    this.state.status = "ready";
    this.state.message = currentStage(this.state).scene.title;
    return [];
  }

  chooseBranch(branchId: string): readonly RiverOathEvent[] {
    if (this.state.status !== "stage-clear") return [];
    const branch = currentStage(this.state).branches?.find(({ id }) => id === branchId);
    if (!branch || !this.state.branch.available.includes(branchId)) {
      throw new RangeError(`Branch ${branchId} is not available from this stage.`);
    }
    this.state.branch.selected = branch.id;
    return [
      {
        type: "branch-selected",
        tick: this.state.tick,
        branchId: branch.id,
        nextStageId: branch.nextStageId,
      },
    ];
  }

  /** Execute exactly one 1/60-second simulation step when running. */
  tick(input: RiverOathInput = EMPTY_INPUT): RiverOathAdvanceResult {
    const normalized = normalizeInput(input);
    const edges = inputEdges(normalized, this.state.inputLatch);
    this.state.inputLatch = latchFor(normalized);

    if (edges.pause) {
      if (this.state.status === "running") {
        this.state.status = "paused";
        return { steps: 0, events: [] };
      }
      if (this.state.status === "paused") {
        this.state.status = "running";
        return { steps: 0, events: [] };
      }
    }
    if (this.state.status !== "running") return { steps: 0, events: [] };

    const events: RiverOathEvent[] = [];
    this.state.tick += 1;
    ageEffects(this.state);
    agePickups(this.state);
    updatePlayer(this.state, normalized, edges, events);
    updatePickups(this.state, events);
    updateEnemies(this.state, events);
    updateWaveProgress(this.state, events);
    assertLiveState(this.state);
    return { steps: 1, events };
  }

  /**
   * Convert host elapsed time into fixed ticks. Integer micro-units make slicing
   * deterministic: 1000 ms once and 10 ms one hundred times produce the same state.
   */
  advance(elapsedMs: number, input: RiverOathInput = EMPTY_INPUT): RiverOathAdvanceResult {
    if (!Number.isFinite(elapsedMs) || elapsedMs < 0 || elapsedMs > MAX_ADVANCE_MS) {
      throw new RangeError(`elapsedMs must be between 0 and ${MAX_ADVANCE_MS}.`);
    }
    if (this.state.status !== "running") return this.tick(input);

    this.state.accumulatorUnits +=
      Math.round(elapsedMs * 1_000) * RIVER_OATH_FIXED_HZ;
    let steps = 0;
    const events: RiverOathEvent[] = [];
    while (
      this.state.accumulatorUnits >= TIME_UNITS_PER_SECOND &&
      this.state.status === "running"
    ) {
      this.state.accumulatorUnits -= TIME_UNITS_PER_SECOND;
      const result = this.tick(input);
      steps += result.steps;
      events.push(...result.events);
    }
    if (this.state.status !== "running") this.state.accumulatorUnits = 0;
    return { steps, events };
  }
}

export function createRiverOathEngine(options: RiverOathEngineOptions = {}): RiverOathEngine {
  return new RiverOathEngine(options);
}

export function getRiverOathStage(
  snapshot: RiverOathSnapshot,
): RiverOathStageDefinition {
  return currentStage(snapshot);
}

export function toRiverOathRuleFrameInput(
  snapshot: RiverOathSnapshot,
): RiverOathRuleFrameInput {
  assertRiverOathSnapshot(snapshot);
  const stage = currentStage(snapshot);
  const wave = currentWave(snapshot);
  const boss = snapshot.enemies.find(({ boss: isBoss }) => isBoss);
  return {
    schema: "axirune-arcade/river-oath-rule-input/1",
    tick: snapshot.tick,
    stage: snapshot.stageIndex + 1,
    stageId: stage.id,
    wave: snapshot.waveIndex + 1,
    waveId: wave.id,
    bossWave: wave.boss,
    heroId: snapshot.player.heroId,
    playerHealth: snapshot.player.health,
    playerFocus: snapshot.player.focus,
    enemyCount: snapshot.enemies.length,
    defeated: snapshot.defeatedEnemies,
    combo: snapshot.player.combo.hits,
    bossPhase: boss?.phase ?? 0,
    selectedBranch: snapshot.branch.selected,
    randomState: snapshot.randomState,
  };
}

export function toRiverOathAxiruneRuleInput(
  snapshot: RiverOathSnapshot,
): RiverOathAxiruneRuleInput {
  const frame = toRiverOathRuleFrameInput(snapshot);
  return {
    stage: frame.stage,
    wave: frame.wave,
    defeated: frame.defeated,
    combo: frame.combo,
  };
}

export function assertRiverOathSnapshot(value: unknown): asserts value is RiverOathSnapshot {
  try {
    assertSnapshotValue(value);
  } catch (error) {
    if (error instanceof RiverOathSnapshotError) throw error;
    throw new RiverOathSnapshotError(
      error instanceof Error ? error.message : "River Oath snapshot is invalid.",
    );
  }
}

function createInitialSnapshot(
  seed: number,
  rules: RiverOathRules,
  campaign: RiverOathCampaign,
  heroId: RiverOathHeroId,
): RiverOathSnapshot {
  const arena = campaign.stages[0]?.scene.arena;
  if (!arena) throw new RiverOathSnapshotError("River Oath campaign has no opening stage.");
  const state: RiverOathSnapshot = {
    schema: RIVER_OATH_SNAPSHOT_SCHEMA,
    fixedStepHz: RIVER_OATH_FIXED_HZ,
    initialSeed: seed,
    randomState: seed,
    tick: 0,
    accumulatorUnits: 0,
    status: "ready",
    score: 0,
    defeatedEnemies: 0,
    stageIndex: 0,
    waveIndex: 0,
    betweenWaveTicksRemaining: 0,
    nextEntityId: 1,
    nextEffectId: 1,
    rules,
    campaign,
    player: createPlayer(rules, arena, heroId),
    enemies: [],
    pickups: [],
    effects: [],
    branch: { available: [], selected: null, routeHistory: [campaign.stages[0]?.id ?? ""] },
    inputLatch: emptyLatch(),
    message: campaign.stages[0]?.scene.title ?? "River Oath",
  };
  spawnCurrentWave(state);
  assertLiveState(state);
  return state;
}

function createPlayer(
  rules: RiverOathRules,
  arena: RiverOathArenaBounds,
  heroId: RiverOathHeroId,
): RiverOathFighterState {
  const hero = rules.heroes[heroId];
  if (!hero) throw new RiverOathSnapshotError(`Unknown River Oath hero: ${heroId}.`);
  const maxHealth = Math.round(rules.player.maxHealth * hero.healthMultiplier);
  return {
    id: 0,
    heroId,
    x: arena.minX + 164,
    lane: (arena.minLane + arena.maxLane) / 2,
    velocityX: 0,
    velocityLane: 0,
    facing: 1,
    health: maxHealth,
    maxHealth,
    focus: 0,
    action: "idle",
    actionTick: 0,
    attackSerial: 0,
    attackConnected: false,
    invulnerableTicks: 0,
    skillCooldownTicks: 0,
    attackBuffTicks: 0,
    combo: { chainStep: 0, queued: false, hits: 0, expiresInTicks: 0 },
  };
}

function updatePlayer(
  state: RiverOathSnapshot,
  input: Required<RiverOathInput>,
  edges: RiverOathInputLatch,
  events: RiverOathEvent[],
): void {
  const player = state.player;
  const combat = state.rules.combat;
  player.invulnerableTicks = Math.max(0, player.invulnerableTicks - 1);
  player.skillCooldownTicks = Math.max(0, player.skillCooldownTicks - 1);
  player.attackBuffTicks = Math.max(0, player.attackBuffTicks - 1);
  if (player.combo.expiresInTicks > 0) player.combo.expiresInTicks -= 1;
  if (player.combo.expiresInTicks === 0) {
    player.combo.hits = 0;
    if (player.action !== "light") player.combo.chainStep = 0;
  }

  if (player.action === "defeated") return;
  if (player.action === "hurt") {
    player.actionTick += 1;
    moveAndClampPlayer(
      state,
      player.velocityX / RIVER_OATH_FIXED_HZ,
      player.velocityLane / RIVER_OATH_FIXED_HZ,
    );
    player.velocityX *= 0.82;
    player.velocityLane *= 0.82;
    if (player.actionTick >= combat.hurtTicks) becomeIdle(player);
    return;
  }

  if (player.action === "dodge") {
    player.actionTick += 1;
    moveAndClampPlayer(
      state,
      player.velocityX / RIVER_OATH_FIXED_HZ,
      player.velocityLane / RIVER_OATH_FIXED_HZ,
    );
    addEffect(state, "dust", player.x, player.lane, 12, 0.45);
    if (player.actionTick >= combat.dodgeDurationTicks) becomeIdle(player);
    return;
  }

  if (player.action === "guard") {
    player.velocityX = 0;
    player.velocityLane = 0;
    player.actionTick += 1;
    if (input.guard) return;
    becomeIdle(player);
  }

  if (isAttackAction(player.action)) {
    if (
      player.action === "light" &&
      edges.light &&
      player.actionTick >= combat.lightQueueStartTick
    ) {
      player.combo.queued = true;
    }
    player.actionTick += 1;
    const attack = attackRuleFor(state.rules, player.action);
    if (player.actionTick === attack.activeTick) {
      resolvePlayerAttack(state, attack, events);
    }
    if (player.actionTick >= attack.durationTicks) {
      if (player.action === "light" && player.combo.queued && player.combo.chainStep < 2) {
        player.combo.chainStep = (player.combo.chainStep + 1) as 1 | 2;
        player.combo.queued = false;
        beginPlayerAction(state, "light", events);
      } else {
        player.combo.queued = false;
        becomeIdle(player);
      }
    }
    return;
  }

  if (edges.dodge) {
    beginDodge(state, input, events);
    return;
  }
  if (input.guard) {
    if (player.action !== "guard") beginPlayerAction(state, "guard", events);
    return;
  }
  const hero = state.rules.heroes[player.heroId];
  if (
    edges.skill &&
    player.focus >= state.rules.player.skillCost * hero.skill.costMultiplier &&
    player.skillCooldownTicks === 0
  ) {
    player.focus -= Math.round(state.rules.player.skillCost * hero.skill.costMultiplier);
    player.skillCooldownTicks = combat.skillCooldownTicks;
    beginPlayerAction(state, "skill", events);
    addEffect(state, "focus", player.x, player.lane, combat.skill.durationTicks, 1);
    return;
  }
  if (edges.launcher) {
    beginPlayerAction(state, "launcher", events);
    return;
  }
  if (edges.heavy) {
    beginPlayerAction(state, "heavy", events);
    return;
  }
  if (edges.light) {
    player.combo.chainStep = 0;
    beginPlayerAction(state, "light", events);
    return;
  }

  const magnitude = Math.hypot(input.moveX, input.moveLane);
  const scale = magnitude > 1 ? 1 / magnitude : 1;
  player.velocityX =
    input.moveX * scale * state.rules.player.moveSpeed * hero.moveSpeedMultiplier;
  player.velocityLane =
    input.moveLane * scale * state.rules.player.laneSpeed * hero.laneSpeedMultiplier;
  if (Math.abs(input.moveX) > 0.05) player.facing = input.moveX < 0 ? -1 : 1;
  moveAndClampPlayer(
    state,
    player.velocityX / RIVER_OATH_FIXED_HZ,
    player.velocityLane / RIVER_OATH_FIXED_HZ,
  );
  player.action = magnitude > 0.05 ? "walk" : "idle";
  player.actionTick = player.action === "walk" ? player.actionTick + 1 : 0;
}

function beginDodge(
  state: RiverOathSnapshot,
  input: Required<RiverOathInput>,
  events: RiverOathEvent[],
): void {
  const player = state.player;
  let moveX = input.moveX;
  let moveLane = input.moveLane;
  if (Math.hypot(moveX, moveLane) < 0.1) moveX = player.facing;
  const magnitude = Math.max(1, Math.hypot(moveX, moveLane));
  const speed =
    (state.rules.combat.dodgeDistance * RIVER_OATH_FIXED_HZ) /
    state.rules.combat.dodgeDurationTicks;
  player.velocityX = (moveX / magnitude) * speed;
  player.velocityLane = (moveLane / magnitude) * speed;
  player.invulnerableTicks = state.rules.combat.dodgeInvulnerableTicks;
  beginPlayerAction(state, "dodge", events);
}

function beginPlayerAction(
  state: RiverOathSnapshot,
  action: RiverOathPlayerAction,
  events: RiverOathEvent[],
): void {
  const player = state.player;
  player.action = action;
  player.actionTick = 0;
  player.attackConnected = false;
  if (isAttackAction(action)) player.attackSerial += 1;
  events.push({
    type: "player-action",
    tick: state.tick,
    action,
    chainStep: player.combo.chainStep,
  });
}

function becomeIdle(player: RiverOathFighterState): void {
  player.action = "idle";
  player.actionTick = 0;
  player.velocityX = 0;
  player.velocityLane = 0;
}

function resolvePlayerAttack(
  state: RiverOathSnapshot,
  attack: RiverOathAttackRule,
  events: RiverOathEvent[],
): void {
  const player = state.player;
  const isSkill = player.action === "skill";
  const hero = state.rules.heroes[player.heroId];
  const multiplier =
    player.action === "light"
      ? state.rules.combat.lightChainMultipliers[player.combo.chainStep]
      : 1;
  const profileDamage = isSkill
    ? hero.skill.damageMultiplier
    : hero.weapon.damageMultiplier;
  const buffMultiplier =
    player.attackBuffTicks > 0 ? state.rules.pickups.warDrumMultiplier : 1;
  const damage = Math.max(
    1,
    Math.round(attack.damage * multiplier * profileDamage * buffMultiplier),
  );
  const effectiveRange =
    attack.range * (isSkill ? hero.skill.rangeMultiplier : hero.weapon.reachMultiplier);
  const targets = state.enemies
    .filter((enemy) => {
      if (enemy.health <= 0 || enemy.lastPlayerAttackSerial === player.attackSerial) return false;
      const forwardDistance = (enemy.x - player.x) * player.facing;
      const horizontalHit = isSkill
        ? Math.abs(enemy.x - player.x) <= effectiveRange
        : forwardDistance >= -18 && forwardDistance <= effectiveRange;
      return horizontalHit && Math.abs(enemy.lane - player.lane) <= attack.laneRange;
    })
    .sort((left, right) => {
      const distanceDifference = distanceSquared(left, player) - distanceSquared(right, player);
      return distanceDifference === 0 ? left.id - right.id : distanceDifference;
    })
    .slice(0, attack.maxTargets);

  addEffect(state, "slash", player.x + player.facing * 54, player.lane, 14, 0.8);
  player.attackConnected = targets.length > 0;
  for (const enemy of targets) {
    const enemyRule = state.rules.enemies[enemy.kind];
    const defenderReduction =
      enemyRule.behavior === "defender" &&
      player.action !== "heavy" &&
      player.action !== "launcher" &&
      player.action !== "skill"
        ? 0.55
        : 1;
    const appliedDamage = Math.max(1, Math.round(damage * defenderReduction));
    enemy.lastPlayerAttackSerial = player.attackSerial;
    enemy.health = Math.max(0, enemy.health - appliedDamage);
    enemy.x += player.facing * attack.knockback;
    clampEnemyToArena(state, enemy);
    enemy.action = enemy.health === 0 ? "defeated" : "hurt";
    enemy.actionTick = 0;
    if (player.action === "launcher" && enemy.health > 0) {
      enemy.height = Math.max(enemy.height, 12);
      enemy.velocityHeight = 430;
    }
    player.combo.hits += 1;
    player.combo.expiresInTicks = state.rules.combat.comboWindowTicks;
    player.focus = Math.min(
      state.rules.player.maxFocus,
      player.focus + state.rules.player.focusPerHit,
    );
    addEffect(state, enemy.health === 0 ? "defeat" : "impact", enemy.x, enemy.lane, 20, 1);
    events.push({
      type: "enemy-hit",
      tick: state.tick,
      enemyId: enemy.id,
      damage: appliedDamage,
      health: enemy.health,
      combo: player.combo.hits,
    });
    updateBossPhase(state, enemy, events);
    if (enemy.health === 0) {
      state.defeatedEnemies += 1;
      const baseScore = enemyRule.score;
      const scoreAwarded = Math.round(baseScore * (1 + Math.floor((player.combo.hits - 1) / 3) * 0.25));
      state.score += scoreAwarded;
      events.push({
        type: "enemy-defeated",
        tick: state.tick,
        enemyId: enemy.id,
        scoreAwarded,
      });
      maybeSpawnPickup(state, enemy, events);
    }
  }
  state.enemies = state.enemies.filter((enemy) => enemy.health > 0);
}

function updateEnemies(state: RiverOathSnapshot, events: RiverOathEvent[]): void {
  const player = state.player;
  for (const enemy of state.enemies) {
    const rule = state.rules.enemies[enemy.kind];
    enemy.attackCooldownTicks = Math.max(0, enemy.attackCooldownTicks - 1);
    updateBossPhase(state, enemy, events);
    if (enemy.height > 0 || enemy.velocityHeight !== 0) {
      enemy.height += enemy.velocityHeight / RIVER_OATH_FIXED_HZ;
      enemy.velocityHeight -= state.rules.combat.launcherGravity / RIVER_OATH_FIXED_HZ;
      if (enemy.height <= 0) {
        enemy.height = 0;
        enemy.velocityHeight = 0;
      } else {
        enemy.action = "hurt";
        enemy.actionTick += 1;
        continue;
      }
    }

    if (enemy.action === "hurt") {
      enemy.actionTick += 1;
      if (enemy.actionTick >= Math.max(8, Math.round(state.rules.combat.hurtTicks * 0.65))) {
        enemy.action = "approach";
        enemy.actionTick = 0;
      }
      continue;
    }
    if (enemy.action === "attack") {
      enemy.actionTick += 1;
      if (enemy.actionTick === rule.attackActiveTick) resolveEnemyAttack(state, enemy, events);
      if (enemy.actionTick >= rule.attackDurationTicks) {
        enemy.action = "recover";
        enemy.actionTick = 0;
        enemy.attackCooldownTicks = rule.attackCooldownTicks + randomInteger(state, 0, 24);
      }
      continue;
    }
    if (enemy.action === "recover") {
      enemy.actionTick += 1;
      if (enemy.actionTick >= 12) {
        enemy.action = "approach";
        enemy.actionTick = 0;
      }
      continue;
    }

    const deltaX = player.x - enemy.x;
    const deltaLane = player.lane - enemy.lane;
    enemy.facing = deltaX < 0 ? -1 : 1;
    const phaseSpeed = enemy.phase === 1 ? 1 : enemy.phase === 2 ? 1.16 : 1.32;
    const laneAligned = Math.abs(deltaLane) <= rule.attackLaneRange;
    const inRange = Math.abs(deltaX) <= rule.attackRange;
    if (laneAligned && inRange && enemy.attackCooldownTicks === 0) {
      enemy.action = "attack";
      enemy.actionTick = 0;
      enemy.velocityX = 0;
      enemy.velocityLane = 0;
      continue;
    }

    const rangedRetreat =
      (rule.behavior === "ranged" ||
        rule.behavior === "bomber" ||
        rule.behavior === "support") &&
      Math.abs(deltaX) < rule.attackRange * 0.55;
    const directionX = rangedRetreat ? -Math.sign(deltaX) : Math.sign(deltaX);
    enemy.velocityX = inRange && !rangedRetreat ? 0 : directionX * rule.moveSpeed * phaseSpeed;
    enemy.velocityLane = laneAligned ? 0 : Math.sign(deltaLane) * rule.laneSpeed * phaseSpeed;
    enemy.x += enemy.velocityX / RIVER_OATH_FIXED_HZ;
    enemy.lane += enemy.velocityLane / RIVER_OATH_FIXED_HZ;
    enemy.action = enemy.velocityX === 0 && enemy.velocityLane !== 0 ? "strafe" : "approach";
    enemy.actionTick += 1;
    clampEnemyToArena(state, enemy);
  }
}

function resolveEnemyAttack(
  state: RiverOathSnapshot,
  enemy: RiverOathEnemyState,
  events: RiverOathEvent[],
): void {
  const player = state.player;
  const rule = state.rules.enemies[enemy.kind];
  if (rule.attackStyle === "rally") {
    for (const ally of state.enemies) {
      if (ally.id !== enemy.id && distanceSquared(ally, enemy) <= 220 ** 2) {
        ally.attackCooldownTicks = Math.min(ally.attackCooldownTicks, 12);
      }
    }
    addEffect(state, "boss-aura", enemy.x, enemy.lane, 34, 0.55);
  }
  if (
    player.invulnerableTicks > 0 ||
    Math.abs(player.x - enemy.x) > rule.attackRange ||
    Math.abs(player.lane - enemy.lane) > rule.attackLaneRange
  ) {
    return;
  }
  const phaseMultiplier = enemy.phase === 1 ? 1 : enemy.phase === 2 ? 1.25 : 1.5;
  const incomingFromFront = (enemy.x - player.x) * player.facing >= 0;
  const guarded = player.action === "guard" && incomingFromFront;
  const damage = Math.max(
    guarded ? 0 : 1,
    Math.round(
      rule.damage *
        phaseMultiplier *
        (guarded ? state.rules.combat.guardDamageMultiplier : 1),
    ),
  );
  player.health = Math.max(0, player.health - damage);
  if (!guarded) player.combo = { chainStep: 0, queued: false, hits: 0, expiresInTicks: 0 };
  const normalImpulse = enemy.facing * (guarded ? 48 : 210);
  const hookImpulse = Math.sign(enemy.x - player.x) * (guarded ? 34 : 238);
  player.velocityX =
    rule.attackStyle === "hook" || rule.attackStyle === "anchor"
      ? hookImpulse
      : normalImpulse;
  player.velocityLane =
    rule.attackStyle === "tide"
      ? Math.sign(player.lane - enemy.lane || 1) * 168
      : rule.attackStyle === "storm"
        ? ((state.tick + enemy.id) % 2 === 0 ? 1 : -1) * 224
        : 0;
  if (rule.attackStyle === "furnace") player.focus = Math.max(0, player.focus - 12);
  if (rule.attackStyle === "storm") player.focus = Math.max(0, player.focus - 18);
  player.invulnerableTicks = guarded ? 6 : state.rules.combat.hurtTicks + 10;
  if (!guarded || player.health === 0) {
    player.action = player.health === 0 ? "defeated" : "hurt";
    player.actionTick = 0;
  }
  addEffect(state, "impact", player.x, player.lane, 22, 1);
  events.push({
    type: guarded ? "attack-guarded" : "player-hit",
    tick: state.tick,
    enemyId: enemy.id,
    damage,
    health: player.health,
  });
  if (player.health === 0) {
    state.status = "game-over";
    state.accumulatorUnits = 0;
    state.message = "THE BANNER FALLS";
    events.push({ type: "game-over", tick: state.tick, score: state.score });
  }
}

function updateBossPhase(
  state: RiverOathSnapshot,
  enemy: RiverOathEnemyState,
  events: RiverOathEvent[],
): void {
  if (!enemy.boss || enemy.health <= 0) return;
  const ratio = enemy.health / enemy.maxHealth;
  const target: 1 | 2 | 3 = ratio <= 1 / 3 ? 3 : ratio <= 2 / 3 ? 2 : 1;
  while (enemy.phase < target) {
    enemy.phase = (enemy.phase + 1) as 2 | 3;
    enemy.attackCooldownTicks = 0;
    addEffect(state, "boss-aura", enemy.x, enemy.lane, 90, enemy.phase / 3);
    events.push({
      type: "boss-phase",
      tick: state.tick,
      enemyId: enemy.id,
      phase: enemy.phase,
    });
  }
}

function updateWaveProgress(state: RiverOathSnapshot, events: RiverOathEvent[]): void {
  if (state.status !== "running" || state.enemies.length > 0) return;
  const stage = currentStage(state);
  const finalWave = state.waveIndex === stage.waves.length - 1;
  if (finalWave) {
    events.push({
      type: "wave-cleared",
      tick: state.tick,
      stageIndex: state.stageIndex,
      waveIndex: state.waveIndex,
    });
    if (state.stageIndex === state.campaign.stages.length - 1) {
      state.status = "campaign-clear";
      state.message = "THE FIRST BANNER RISES";
      events.push({ type: "campaign-cleared", tick: state.tick, score: state.score });
    } else {
      state.status = "stage-clear";
      state.branch.available = stage.branches?.map(({ id }) => id) ?? [];
      state.branch.selected = null;
      state.message = `${stage.scene.title.toUpperCase()} SECURED`;
      events.push({
        type: "stage-cleared",
        tick: state.tick,
        stageIndex: state.stageIndex,
        score: state.score,
      });
    }
    state.accumulatorUnits = 0;
    return;
  }

  if (state.betweenWaveTicksRemaining === 0) {
    state.betweenWaveTicksRemaining = state.rules.waves.betweenWaveTicks;
    state.message = "THE FIELD DRAWS BREATH";
    events.push({
      type: "wave-cleared",
      tick: state.tick,
      stageIndex: state.stageIndex,
      waveIndex: state.waveIndex,
    });
    return;
  }
  state.betweenWaveTicksRemaining -= 1;
  if (state.betweenWaveTicksRemaining === 0) {
    state.waveIndex += 1;
    spawnCurrentWave(state);
    state.message = currentWave(state).intro;
    events.push(waveStartedEvent(state));
  }
}

function spawnCurrentWave(state: RiverOathSnapshot): void {
  const wave = currentWave(state);
  const arena = currentStage(state).scene.arena;
  const enemyCount = wave.spawns.reduce((total, spawn) => total + spawn.count, 0);
  if (enemyCount > state.rules.waves.maximumEnemies) {
    throw new RiverOathSnapshotError("Wave exceeds the configured enemy limit.");
  }
  for (const spawn of wave.spawns) {
    for (let index = 0; index < spawn.count; index += 1) {
      const useLeft =
        spawn.side === "left" || (spawn.side === "split" && index % 2 === 0);
      const x = useLeft
        ? arena.minX + 46 + index * spawn.spacing
        : arena.maxX - 46 - index * spawn.spacing;
      const lane = clamp(
        spawn.lane + randomInteger(state, -18, 18),
        arena.minLane,
        arena.maxLane,
      );
      const rule = state.rules.enemies[spawn.kind];
      state.enemies.push({
        id: state.nextEntityId,
        kind: spawn.kind,
        x: clamp(x, arena.minX, arena.maxX),
        lane,
        height: 0,
        velocityHeight: 0,
        velocityX: 0,
        velocityLane: 0,
        facing: useLeft ? 1 : -1,
        health: rule.maxHealth,
        maxHealth: rule.maxHealth,
        action: "idle",
        actionTick: 0,
        attackCooldownTicks: randomInteger(state, 12, 54),
        lastPlayerAttackSerial: -1,
        phase: 1,
        boss: wave.boss,
      });
      state.nextEntityId += 1;
    }
  }
}

function addEffect(
  state: RiverOathSnapshot,
  kind: RiverOathEffectKind,
  x: number,
  lane: number,
  durationTicks: number,
  intensity: number,
): void {
  const arena = currentStage(state).scene.arena;
  state.effects.push({
    id: state.nextEffectId,
    kind,
    x: clamp(x, arena.minX, arena.maxX),
    lane: clamp(lane, arena.minLane, arena.maxLane),
    ageTicks: 0,
    durationTicks,
    intensity,
  });
  state.nextEffectId += 1;
  if (state.effects.length > MAX_EFFECTS) {
    state.effects.splice(0, state.effects.length - MAX_EFFECTS);
  }
}

function maybeSpawnPickup(
  state: RiverOathSnapshot,
  enemy: RiverOathEnemyState,
  events: RiverOathEvent[],
): void {
  if (
    state.pickups.length >= state.rules.pickups.maximumPickups ||
    (!enemy.boss && randomInteger(state, 0, 9_999) >= state.rules.pickups.dropChance * 10_000)
  ) {
    return;
  }
  const kinds: readonly RiverOathPickupKind[] = ["herbal-draught", "focus-seal", "war-drum"];
  const kind = kinds[randomInteger(state, 0, kinds.length - 1)];
  if (!kind) return;
  const pickupId = state.nextEntityId;
  state.nextEntityId += 1;
  state.pickups.push({ id: pickupId, kind, x: enemy.x, lane: enemy.lane, ageTicks: 0 });
  events.push({ type: "pickup-spawned", tick: state.tick, pickupId, kind });
}

function agePickups(state: RiverOathSnapshot): void {
  for (const pickup of state.pickups) pickup.ageTicks += 1;
  state.pickups = state.pickups.filter(
    ({ ageTicks }) => ageTicks < state.rules.pickups.lifetimeTicks,
  );
}

function updatePickups(state: RiverOathSnapshot, events: RiverOathEvent[]): void {
  const retained = [] as RiverOathSnapshot["pickups"];
  for (const pickup of state.pickups) {
    const collected =
      Math.abs(pickup.x - state.player.x) <= 48 &&
      Math.abs(pickup.lane - state.player.lane) <= 36;
    if (!collected) {
      retained.push(pickup);
      continue;
    }
    if (pickup.kind === "herbal-draught") {
      state.player.health = Math.min(
        state.player.maxHealth,
        state.player.health + state.rules.pickups.herbalHealing,
      );
    } else if (pickup.kind === "focus-seal") {
      state.player.focus = Math.min(
        state.rules.player.maxFocus,
        state.player.focus + state.rules.pickups.focusGain,
      );
    } else {
      state.player.attackBuffTicks = state.rules.pickups.warDrumDurationTicks;
    }
    addEffect(state, "focus", pickup.x, pickup.lane, 26, 0.8);
    events.push({
      type: "pickup-collected",
      tick: state.tick,
      pickupId: pickup.id,
      kind: pickup.kind,
    });
  }
  state.pickups = retained;
}

function ageEffects(state: RiverOathSnapshot): void {
  for (const effect of state.effects) effect.ageTicks += 1;
  state.effects = state.effects.filter((effect) => effect.ageTicks < effect.durationTicks);
}

function moveAndClampPlayer(state: RiverOathSnapshot, deltaX: number, deltaLane: number): void {
  const arena = currentStage(state).scene.arena;
  state.player.x = clamp(state.player.x + deltaX, arena.minX, arena.maxX);
  state.player.lane = clamp(state.player.lane + deltaLane, arena.minLane, arena.maxLane);
}

function clampEnemyToArena(state: RiverOathSnapshot, enemy: RiverOathEnemyState): void {
  const arena = currentStage(state).scene.arena;
  enemy.x = clamp(enemy.x, arena.minX, arena.maxX);
  enemy.lane = clamp(enemy.lane, arena.minLane, arena.maxLane);
}

function attackRuleFor(rules: RiverOathRules, action: RiverOathPlayerAction): RiverOathAttackRule {
  if (action === "light") return rules.combat.light;
  if (action === "heavy") return rules.combat.heavy;
  if (action === "launcher") return rules.combat.launcher;
  if (action === "skill") return rules.combat.skill;
  throw new Error(`${action} is not an attack action.`);
}

function isAttackAction(
  action: RiverOathPlayerAction,
): action is "light" | "heavy" | "launcher" | "skill" {
  return action === "light" || action === "heavy" || action === "launcher" || action === "skill";
}

function waveStartedEvent(state: RiverOathSnapshot): RiverOathEvent {
  return {
    type: "wave-started",
    tick: state.tick,
    stageIndex: state.stageIndex,
    waveIndex: state.waveIndex,
    enemyCount: state.enemies.length,
  };
}

function currentStage(state: RiverOathSnapshot): RiverOathStageDefinition {
  const stage = state.campaign.stages[state.stageIndex];
  if (!stage) throw new RiverOathSnapshotError("Stage index is outside the campaign.");
  return stage;
}

function currentWave(state: RiverOathSnapshot): RiverOathWaveDefinition {
  const wave = currentStage(state).waves[state.waveIndex];
  if (!wave) throw new RiverOathSnapshotError("Wave index is outside the current stage.");
  return wave;
}

function normalizeInput(input: RiverOathInput): Required<RiverOathInput> {
  return {
    moveX: clamp(finiteOrZero(input.moveX), -1, 1),
    moveLane: clamp(finiteOrZero(input.moveLane), -1, 1),
    light: input.light === true,
    heavy: input.heavy === true,
    dodge: input.dodge === true,
    guard: input.guard === true,
    launcher: input.launcher === true,
    skill: input.skill === true,
    pause: input.pause === true,
  };
}

function inputEdges(
  input: Required<RiverOathInput>,
  latch: RiverOathInputLatch,
): RiverOathInputLatch {
  return {
    light: input.light && !latch.light,
    heavy: input.heavy && !latch.heavy,
    dodge: input.dodge && !latch.dodge,
    guard: input.guard && !latch.guard,
    launcher: input.launcher && !latch.launcher,
    skill: input.skill && !latch.skill,
    pause: input.pause && !latch.pause,
  };
}

function latchFor(input: Required<RiverOathInput>): RiverOathInputLatch {
  return {
    light: input.light,
    heavy: input.heavy,
    dodge: input.dodge,
    guard: input.guard,
    launcher: input.launcher,
    skill: input.skill,
    pause: input.pause,
  };
}

function emptyLatch(): RiverOathInputLatch {
  return {
    light: false,
    heavy: false,
    dodge: false,
    guard: false,
    launcher: false,
    skill: false,
    pause: false,
  };
}

function randomInteger(state: RiverOathSnapshot, minimum: number, maximum: number): number {
  let value = state.randomState >>> 0;
  value ^= value << 13;
  value ^= value >>> 17;
  value ^= value << 5;
  state.randomState = normalizeSeed(value);
  const span = maximum - minimum + 1;
  return minimum + (state.randomState % span);
}

function normalizeSeed(seed: number): number {
  if (!Number.isFinite(seed)) throw new RangeError("River Oath seed must be finite.");
  const normalized = Math.trunc(seed) >>> 0;
  return normalized === 0 ? 0x9e37_79b9 : normalized;
}

function assertSnapshotValue(value: unknown): asserts value is RiverOathSnapshot {
  if (!isRecord(value)) throw new RiverOathSnapshotError("Snapshot must be an object.");
  if (value.schema !== RIVER_OATH_SNAPSHOT_SCHEMA || value.fixedStepHz !== RIVER_OATH_FIXED_HZ) {
    throw new RiverOathSnapshotError("Snapshot schema or fixed-step rate is invalid.");
  }
  const state = value as unknown as RiverOathSnapshot;
  assertRiverOathRules(state.rules);
  assertCampaign(state.campaign, state.rules);
  if (!Number.isInteger(state.stageIndex) || state.stageIndex < 0 || state.stageIndex >= state.campaign.stages.length) {
    throw new RiverOathSnapshotError("Snapshot stage index is invalid.");
  }
  const stage = state.campaign.stages[state.stageIndex];
  if (!stage || !Number.isInteger(state.waveIndex) || state.waveIndex < 0 || state.waveIndex >= stage.waves.length) {
    throw new RiverOathSnapshotError("Snapshot wave index is invalid.");
  }
  assertLiveState(state);
}

function assertCampaign(campaign: RiverOathCampaign, rules: RiverOathRules): void {
  if (campaign.schema !== "axirune-arcade/river-oath-campaign/1") {
    throw new RiverOathSnapshotError("Campaign schema is invalid.");
  }
  if (!campaign.id || !campaign.title || campaign.stages.length === 0) {
    throw new RiverOathSnapshotError("Campaign must define at least one named stage.");
  }
  const stageIds = new Set<string>();
  for (const stage of campaign.stages) {
    if (!stage.id || stageIds.has(stage.id)) throw new RiverOathSnapshotError("Campaign stage ids must be unique.");
    stageIds.add(stage.id);
    const arena = stage.scene.arena;
    finiteNumbers([arena.minX, arena.maxX, arena.minLane, arena.maxLane], "scene arena");
    if (arena.minX >= arena.maxX || arena.minLane >= arena.maxLane) {
      throw new RiverOathSnapshotError("Scene arena bounds are inverted.");
    }
    if (!Array.isArray(stage.scene.layers) || stage.scene.layers.length < 3) {
      throw new RiverOathSnapshotError("Each scene needs at least three parallax layers.");
    }
    if (stage.waves.length === 0) {
      throw new RiverOathSnapshotError("Each stage needs at least one wave.");
    }
    for (const wave of stage.waves) {
      const count = wave.spawns.reduce<number>((total, spawn) => total + spawn.count, 0);
      if (!wave.id || count < 1 || count > rules.waves.maximumEnemies) {
        throw new RiverOathSnapshotError("Campaign wave size is invalid.");
      }
      for (const spawn of wave.spawns) {
        if (!Number.isInteger(spawn.count) || spawn.count < 1 || !rules.enemies[spawn.kind]) {
          throw new RiverOathSnapshotError("Campaign enemy spawn is invalid.");
        }
        if (!Number.isFinite(spawn.lane) || spawn.lane < arena.minLane || spawn.lane > arena.maxLane) {
          throw new RiverOathSnapshotError("Campaign enemy lane is outside its arena.");
        }
        if (!Number.isFinite(spawn.spacing) || spawn.spacing < 0) {
          throw new RiverOathSnapshotError("Campaign enemy spacing is invalid.");
        }
      }
    }
    for (const branch of stage.branches ?? []) {
      if (
        !branch.id ||
        !branch.label ||
        branch.nextStageId === stage.id ||
        !campaign.stages.some(({ id }) => id === branch.nextStageId)
      ) {
        throw new RiverOathSnapshotError("Campaign branch target is invalid.");
      }
    }
  }
}

function assertLiveState(state: RiverOathSnapshot): void {
  if (!VALID_STATUSES.has(state.status) || !VALID_PLAYER_ACTIONS.has(state.player.action)) {
    throw new RiverOathSnapshotError("Snapshot status or player action is invalid.");
  }
  if (!Number.isInteger(state.initialSeed) || state.initialSeed <= 0 || !Number.isInteger(state.randomState) || state.randomState <= 0) {
    throw new RiverOathSnapshotError("Random state is invalid.");
  }
  finiteNumbers(
    [
      state.tick,
      state.accumulatorUnits,
      state.score,
      state.defeatedEnemies,
      state.betweenWaveTicksRemaining,
      state.nextEntityId,
      state.nextEffectId,
      state.player.x,
      state.player.lane,
      state.player.velocityX,
      state.player.velocityLane,
      state.player.health,
      state.player.focus,
      state.player.attackBuffTicks,
    ],
    "snapshot",
  );
  for (const [label, value] of [
    ["tick", state.tick],
    ["accumulatorUnits", state.accumulatorUnits],
    ["score", state.score],
    ["defeatedEnemies", state.defeatedEnemies],
    ["betweenWaveTicksRemaining", state.betweenWaveTicksRemaining],
    ["nextEntityId", state.nextEntityId],
    ["nextEffectId", state.nextEffectId],
  ] as const) {
    if (!Number.isInteger(value) || value < 0) {
      throw new RiverOathSnapshotError(`${label} must be a non-negative integer.`);
    }
  }
  const arena = currentStage(state).scene.arena;
  assertInsideArena(state.player.x, state.player.lane, arena, "player");
  if (state.player.health < 0 || state.player.health > state.player.maxHealth) {
    throw new RiverOathSnapshotError("Player health is invalid.");
  }
  if (
    state.player.focus < 0 ||
    state.player.focus > state.rules.player.maxFocus ||
    !Number.isInteger(state.player.combo.chainStep) ||
    state.player.combo.chainStep < 0 ||
    state.player.combo.chainStep > 2
  ) {
    throw new RiverOathSnapshotError("Player focus or combo state is invalid.");
  }
  if (state.enemies.length > state.rules.waves.maximumEnemies) {
    throw new RiverOathSnapshotError("Live enemy count exceeds configured limit.");
  }
  const ids = new Set<number>();
  for (const enemy of state.enemies) {
    finiteNumbers(
      [
        enemy.id,
        enemy.x,
        enemy.lane,
        enemy.height,
        enemy.velocityHeight,
        enemy.velocityX,
        enemy.velocityLane,
        enemy.health,
        enemy.maxHealth,
      ],
      "enemy",
    );
    if (!Number.isInteger(enemy.id) || enemy.id <= 0 || ids.has(enemy.id)) {
      throw new RiverOathSnapshotError("Enemy ids must be unique positive integers.");
    }
    if (!state.rules.enemies[enemy.kind] || ![1, 2, 3].includes(enemy.phase)) {
      throw new RiverOathSnapshotError("Enemy kind or phase is invalid.");
    }
    ids.add(enemy.id);
    assertInsideArena(enemy.x, enemy.lane, arena, "enemy");
    if (enemy.health <= 0 || enemy.health > enemy.maxHealth) {
      throw new RiverOathSnapshotError("Live enemy health is invalid.");
    }
    if (enemy.height < 0 || enemy.height > 1_024) {
      throw new RiverOathSnapshotError("Enemy launch height is invalid.");
    }
  }
  if (state.pickups.length > state.rules.pickups.maximumPickups) {
    throw new RiverOathSnapshotError("Pickup limit exceeded.");
  }
  for (const pickup of state.pickups) {
    finiteNumbers([pickup.id, pickup.x, pickup.lane, pickup.ageTicks], "pickup");
    if (!Number.isInteger(pickup.id) || pickup.id <= 0 || ids.has(pickup.id)) {
      throw new RiverOathSnapshotError("Pickup ids must be unique positive integers.");
    }
    ids.add(pickup.id);
    if (!VALID_PICKUPS.has(pickup.kind)) {
      throw new RiverOathSnapshotError("Pickup kind is invalid.");
    }
    assertInsideArena(pickup.x, pickup.lane, arena, "pickup");
  }
  if (ids.size > 0 && state.nextEntityId <= Math.max(...ids)) {
    throw new RiverOathSnapshotError("nextEntityId must exceed every live entity id.");
  }
  if (!state.rules.heroes[state.player.heroId]) {
    throw new RiverOathSnapshotError("Snapshot hero id is invalid.");
  }
  const availableBranches = currentStage(state).branches?.map(({ id }) => id) ?? [];
  if (
    state.branch.available.some((id) => !availableBranches.includes(id)) ||
    (state.branch.selected !== null && !availableBranches.includes(state.branch.selected)) ||
    state.branch.routeHistory.some((id) => !state.campaign.stages.some((stage) => stage.id === id))
  ) {
    throw new RiverOathSnapshotError("Snapshot branch state is invalid.");
  }
  if (state.effects.length > MAX_EFFECTS) throw new RiverOathSnapshotError("Effect limit exceeded.");
  const effectIds = new Set<number>();
  for (const effect of state.effects) {
    finiteNumbers([effect.x, effect.lane, effect.ageTicks, effect.durationTicks, effect.intensity], "effect");
    assertInsideArena(effect.x, effect.lane, arena, "effect");
    if (!Number.isInteger(effect.id) || effect.id <= 0 || effectIds.has(effect.id)) {
      throw new RiverOathSnapshotError("Effect ids must be unique positive integers.");
    }
    effectIds.add(effect.id);
  }
  if (effectIds.size > 0 && state.nextEffectId <= Math.max(...effectIds)) {
    throw new RiverOathSnapshotError("nextEffectId must exceed every live effect id.");
  }
  if (Object.values(state.inputLatch).some((value) => typeof value !== "boolean")) {
    throw new RiverOathSnapshotError("Input latch values must be boolean.");
  }
}

function assertInsideArena(x: number, lane: number, arena: RiverOathArenaBounds, label: string): void {
  if (x < arena.minX || x > arena.maxX || lane < arena.minLane || lane > arena.maxLane) {
    throw new RiverOathSnapshotError(`${label} is outside the active arena.`);
  }
}

function finiteNumbers(values: readonly number[], label: string): void {
  if (values.some((value) => !Number.isFinite(value))) {
    throw new RiverOathSnapshotError(`${label} contains a non-finite number.`);
  }
}

function finiteOrZero(value: number | undefined): number {
  return value !== undefined && Number.isFinite(value) ? value : 0;
}

function distanceSquared(
  left: { x: number; lane: number },
  right: { x: number; lane: number },
): number {
  return (left.x - right.x) ** 2 + (left.lane - right.lane) ** 2;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cloneJson<Value>(value: Value): Value {
  return JSON.parse(JSON.stringify(value)) as Value;
}
