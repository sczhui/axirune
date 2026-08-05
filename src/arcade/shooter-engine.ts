export const SHOOTER_SNAPSHOT_SCHEMA = "axirune-arcade-shooter/1" as const;
export const SHOOTER_TICK_RATE = 60;

const TIME_UNITS_PER_SECOND = 1_000_000;
const MAX_ADVANCE_MS = 10_000;

export type ShooterStatus = "running" | "paused" | "game-over";
export type EnemyKind = "scout" | "striker" | "bulwark";
export type BulletOwner = "player" | "enemy";

export interface ShooterInput {
  left?: boolean;
  right?: boolean;
  up?: boolean;
  down?: boolean;
  fire?: boolean;
}

export interface ShooterConfig {
  worldWidth: number;
  worldHeight: number;
  playerWidth: number;
  playerHeight: number;
  playerSpeed: number;
  playerMaxHealth: number;
  playerFireIntervalTicks: number;
  playerBulletSpeed: number;
  firstWaveDelayTicks: number;
  betweenWaveTicks: number;
  baseEnemiesPerWave: number;
  maxEnemiesPerWave: number;
  enemyHorizontalSpeed: number;
  enemyDescentPerBounce: number;
  enemyBulletSpeed: number;
  enemyFireIntervalTicks: number;
  comboWindowTicks: number;
}

export interface PlayerState {
  id: 0;
  x: number;
  y: number;
  width: number;
  height: number;
  health: number;
  maxHealth: number;
  fireCooldownTicks: number;
}

export interface EnemyState {
  id: number;
  kind: EnemyKind;
  x: number;
  y: number;
  width: number;
  height: number;
  velocityX: number;
  health: number;
  maxHealth: number;
  scoreValue: number;
  firePhase: number;
}

export interface BulletState {
  id: number;
  owner: BulletOwner;
  x: number;
  y: number;
  width: number;
  height: number;
  velocityY: number;
  damage: number;
}

export interface ShooterSnapshot {
  schema: typeof SHOOTER_SNAPSHOT_SCHEMA;
  initialSeed: number;
  randomState: number;
  tick: number;
  accumulatorUnits: number;
  status: ShooterStatus;
  score: number;
  combo: number;
  maxCombo: number;
  comboExpiresAtTick: number;
  wave: number;
  nextWaveAtTick: number | null;
  nextEntityId: number;
  config: ShooterConfig;
  player: PlayerState;
  enemies: EnemyState[];
  bullets: BulletState[];
}

export type ShooterEvent =
  | { type: "player-fired"; tick: number; bulletId: number }
  | { type: "enemy-fired"; tick: number; enemyId: number; bulletId: number }
  | { type: "enemy-hit"; tick: number; enemyId: number; health: number }
  | {
      type: "enemy-destroyed";
      tick: number;
      enemyId: number;
      x: number;
      y: number;
      scoreAwarded: number;
      combo: number;
    }
  | {
      type: "player-hit";
      tick: number;
      sourceId: number;
      health: number;
    }
  | { type: "wave-started"; tick: number; wave: number; enemyCount: number }
  | { type: "wave-cleared"; tick: number; wave: number; nextWave: number }
  | { type: "game-over"; tick: number; score: number };

export interface ShooterAdvanceResult {
  steps: number;
  events: ShooterEvent[];
}

export interface ShooterEngineOptions {
  seed?: number;
  config?: Partial<ShooterConfig>;
}

export class ShooterSnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ShooterSnapshotError";
  }
}

const DEFAULT_CONFIG: ShooterConfig = {
  worldWidth: 360,
  worldHeight: 640,
  playerWidth: 34,
  playerHeight: 38,
  playerSpeed: 270,
  playerMaxHealth: 3,
  playerFireIntervalTicks: 8,
  playerBulletSpeed: 540,
  firstWaveDelayTicks: 1,
  betweenWaveTicks: 75,
  baseEnemiesPerWave: 3,
  maxEnemiesPerWave: 8,
  enemyHorizontalSpeed: 54,
  enemyDescentPerBounce: 18,
  enemyBulletSpeed: 240,
  enemyFireIntervalTicks: 150,
  comboWindowTicks: 180,
};

const INTEGER_CONFIG_KEYS: readonly (keyof ShooterConfig)[] = [
  "worldWidth",
  "worldHeight",
  "playerWidth",
  "playerHeight",
  "playerMaxHealth",
  "playerFireIntervalTicks",
  "firstWaveDelayTicks",
  "betweenWaveTicks",
  "baseEnemiesPerWave",
  "maxEnemiesPerWave",
  "enemyFireIntervalTicks",
  "comboWindowTicks",
];

interface EnemyArchetype {
  width: number;
  height: number;
  health: number;
  scoreValue: number;
}

const ENEMY_ARCHETYPES: Readonly<Record<EnemyKind, EnemyArchetype>> = {
  scout: { width: 26, height: 22, health: 1, scoreValue: 100 },
  striker: { width: 31, height: 27, health: 2, scoreValue: 160 },
  bulwark: { width: 39, height: 31, health: 3, scoreValue: 250 },
};

export class ShooterEngine {
  private state: ShooterSnapshot;

  constructor(options: ShooterEngineOptions = {}) {
    const config = resolveConfig(options.config);
    const seed = normalizeSeed(options.seed ?? 0xa81f_4e2d);
    this.state = createInitialSnapshot(seed, config);
  }

  static fromSnapshot(snapshot: ShooterSnapshot): ShooterEngine {
    assertSnapshot(snapshot);
    const engine = new ShooterEngine({
      seed: snapshot.initialSeed,
      config: snapshot.config,
    });
    engine.state = cloneSnapshot(snapshot);
    return engine;
  }

  static deserialize(serialized: string): ShooterEngine {
    let value: unknown;
    try {
      value = JSON.parse(serialized);
    } catch {
      throw new ShooterSnapshotError("Snapshot is not valid JSON.");
    }
    assertSnapshot(value);
    return ShooterEngine.fromSnapshot(value);
  }

  get status(): ShooterStatus {
    return this.state.status;
  }

  get score(): number {
    return this.state.score;
  }

  get tickCount(): number {
    return this.state.tick;
  }

  snapshot(): ShooterSnapshot {
    return cloneSnapshot(this.state);
  }

  serialize(): string {
    return JSON.stringify(this.state);
  }

  pause(): void {
    if (this.state.status === "running") {
      this.state.status = "paused";
    }
  }

  resume(): void {
    if (this.state.status === "paused") {
      this.state.status = "running";
    }
  }

  togglePause(): ShooterStatus {
    if (this.state.status === "paused") {
      this.resume();
    } else {
      this.pause();
    }
    return this.state.status;
  }

  restart(seed: number = this.state.initialSeed): void {
    this.state = createInitialSnapshot(normalizeSeed(seed), this.state.config);
  }

  /** Advances exactly one simulation tick. Rendering cadence never enters the simulation. */
  tick(input: ShooterInput = {}): ShooterAdvanceResult {
    if (this.state.status !== "running") {
      return { steps: 0, events: [] };
    }
    return { steps: 1, events: this.simulateTick(normalizeInput(input)) };
  }

  /**
   * Converts wall-clock duration into deterministic 60 Hz ticks using integer time units.
   * The caller should pass a held input state for the whole duration.
   */
  advance(elapsedMs: number, input: ShooterInput = {}): ShooterAdvanceResult {
    if (!Number.isFinite(elapsedMs) || elapsedMs < 0 || elapsedMs > MAX_ADVANCE_MS) {
      throw new RangeError(`elapsedMs must be between 0 and ${MAX_ADVANCE_MS}.`);
    }
    if (this.state.status !== "running") {
      return { steps: 0, events: [] };
    }

    const elapsedMicros = Math.round(elapsedMs * 1_000);
    this.state.accumulatorUnits += elapsedMicros * SHOOTER_TICK_RATE;
    const heldInput = normalizeInput(input);
    const events: ShooterEvent[] = [];
    let steps = 0;

    while (
      this.state.accumulatorUnits >= TIME_UNITS_PER_SECOND &&
      this.state.status === "running"
    ) {
      this.state.accumulatorUnits -= TIME_UNITS_PER_SECOND;
      events.push(...this.simulateTick(heldInput));
      steps += 1;
    }

    return { steps, events };
  }

  private simulateTick(input: Required<ShooterInput>): ShooterEvent[] {
    const events: ShooterEvent[] = [];
    this.state.tick += 1;

    if (
      this.state.combo > 0 &&
      this.state.tick > this.state.comboExpiresAtTick
    ) {
      this.state.combo = 0;
    }

    this.movePlayer(input);
    this.updatePlayerWeapon(input, events);
    this.spawnWaveIfDue(events);
    this.moveEnemies();
    this.updateEnemyWeapons(events);
    this.moveBullets();
    this.resolveBulletCollisions(events);
    this.resolveEnemyCollisions(events);
    this.removeOutOfBoundsBullets();
    this.scheduleNextWave(events);
    this.finishIfPlayerDestroyed(events);

    return events;
  }

  private movePlayer(input: Required<ShooterInput>): void {
    const horizontal = Number(input.right) - Number(input.left);
    const vertical = Number(input.down) - Number(input.up);
    if (horizontal === 0 && vertical === 0) {
      return;
    }

    const magnitude = Math.hypot(horizontal, vertical);
    const distance = this.state.config.playerSpeed / SHOOTER_TICK_RATE;
    this.state.player.x = clamp(
      this.state.player.x + (horizontal / magnitude) * distance,
      0,
      this.state.config.worldWidth - this.state.player.width,
    );
    this.state.player.y = clamp(
      this.state.player.y + (vertical / magnitude) * distance,
      this.state.config.worldHeight * 0.45,
      this.state.config.worldHeight - this.state.player.height - 12,
    );
  }

  private updatePlayerWeapon(
    input: Required<ShooterInput>,
    events: ShooterEvent[],
  ): void {
    if (this.state.player.fireCooldownTicks > 0) {
      this.state.player.fireCooldownTicks -= 1;
    }
    if (!input.fire || this.state.player.fireCooldownTicks > 0) {
      return;
    }

    const bullet = this.createBullet(
      "player",
      this.state.player.x + this.state.player.width / 2 - 2,
      this.state.player.y - 13,
      -this.state.config.playerBulletSpeed,
    );
    this.state.bullets.push(bullet);
    this.state.player.fireCooldownTicks =
      this.state.config.playerFireIntervalTicks;
    events.push({
      type: "player-fired",
      tick: this.state.tick,
      bulletId: bullet.id,
    });
  }

  private spawnWaveIfDue(events: ShooterEvent[]): void {
    if (
      this.state.nextWaveAtTick === null ||
      this.state.tick < this.state.nextWaveAtTick ||
      this.state.enemies.length > 0
    ) {
      return;
    }

    this.state.wave += 1;
    const count = Math.min(
      this.state.config.maxEnemiesPerWave,
      this.state.config.baseEnemiesPerWave + this.state.wave,
    );
    const sideMargin = 34;
    const formationWidth = this.state.config.worldWidth - sideMargin * 2;

    for (let index = 0; index < count; index += 1) {
      const kind = enemyKindFor(this.state.wave, index);
      const archetype = ENEMY_ARCHETYPES[kind];
      const column = index % 5;
      const row = Math.floor(index / 5);
      const columnsInRow = Math.min(5, count - row * 5);
      const gap = columnsInRow === 1 ? 0 : formationWidth / (columnsInRow - 1);
      const centerX =
        columnsInRow === 1
          ? this.state.config.worldWidth / 2
          : sideMargin + column * gap;
      const speedVariation = 0.88 + this.nextRandom() * 0.24;
      const direction = (index + this.state.wave) % 2 === 0 ? 1 : -1;
      const firePhase = Math.floor(
        this.nextRandom() * this.state.config.enemyFireIntervalTicks,
      );

      this.state.enemies.push({
        id: this.allocateEntityId(),
        kind,
        x: clamp(
          centerX - archetype.width / 2,
          0,
          this.state.config.worldWidth - archetype.width,
        ),
        y: 48 + row * 44,
        width: archetype.width,
        height: archetype.height,
        velocityX:
          direction * this.state.config.enemyHorizontalSpeed * speedVariation,
        health: archetype.health,
        maxHealth: archetype.health,
        scoreValue: archetype.scoreValue,
        firePhase,
      });
    }

    this.state.nextWaveAtTick = null;
    events.push({
      type: "wave-started",
      tick: this.state.tick,
      wave: this.state.wave,
      enemyCount: count,
    });
  }

  private moveEnemies(): void {
    for (const enemy of this.state.enemies) {
      enemy.x += enemy.velocityX / SHOOTER_TICK_RATE;
      if (enemy.x < 0) {
        enemy.x = 0;
        enemy.velocityX = Math.abs(enemy.velocityX);
        enemy.y += this.state.config.enemyDescentPerBounce;
      } else if (enemy.x + enemy.width > this.state.config.worldWidth) {
        enemy.x = this.state.config.worldWidth - enemy.width;
        enemy.velocityX = -Math.abs(enemy.velocityX);
        enemy.y += this.state.config.enemyDescentPerBounce;
      }
    }
  }

  private updateEnemyWeapons(events: ShooterEvent[]): void {
    for (const enemy of this.state.enemies) {
      if (
        (this.state.tick + enemy.firePhase) %
          this.state.config.enemyFireIntervalTicks !==
        0
      ) {
        continue;
      }
      const bullet = this.createBullet(
        "enemy",
        enemy.x + enemy.width / 2 - 2,
        enemy.y + enemy.height + 1,
        this.state.config.enemyBulletSpeed,
      );
      this.state.bullets.push(bullet);
      events.push({
        type: "enemy-fired",
        tick: this.state.tick,
        enemyId: enemy.id,
        bulletId: bullet.id,
      });
    }
  }

  private moveBullets(): void {
    for (const bullet of this.state.bullets) {
      bullet.y += bullet.velocityY / SHOOTER_TICK_RATE;
    }
  }

  private resolveBulletCollisions(events: ShooterEvent[]): void {
    const consumedBullets = new Set<number>();
    const destroyedEnemies = new Set<number>();

    for (const bullet of this.state.bullets) {
      if (bullet.owner !== "player" || consumedBullets.has(bullet.id)) {
        continue;
      }
      for (const enemy of this.state.enemies) {
        if (destroyedEnemies.has(enemy.id) || !overlaps(bullet, enemy)) {
          continue;
        }
        consumedBullets.add(bullet.id);
        enemy.health = Math.max(0, enemy.health - bullet.damage);
        events.push({
          type: "enemy-hit",
          tick: this.state.tick,
          enemyId: enemy.id,
          health: enemy.health,
        });
        if (enemy.health === 0) {
          destroyedEnemies.add(enemy.id);
          this.awardEnemy(enemy, events);
        }
        break;
      }
    }

    for (const bullet of this.state.bullets) {
      if (
        bullet.owner !== "enemy" ||
        consumedBullets.has(bullet.id) ||
        !overlaps(bullet, this.state.player)
      ) {
        continue;
      }
      consumedBullets.add(bullet.id);
      this.damagePlayer(bullet.id, bullet.damage, events);
    }

    if (consumedBullets.size > 0) {
      this.state.bullets = this.state.bullets.filter(
        (bullet) => !consumedBullets.has(bullet.id),
      );
    }
    if (destroyedEnemies.size > 0) {
      this.state.enemies = this.state.enemies.filter(
        (enemy) => !destroyedEnemies.has(enemy.id),
      );
    }
  }

  private resolveEnemyCollisions(events: ShooterEvent[]): void {
    const removedEnemies = new Set<number>();
    for (const enemy of this.state.enemies) {
      if (
        enemy.y > this.state.config.worldHeight ||
        overlaps(enemy, this.state.player)
      ) {
        removedEnemies.add(enemy.id);
        this.damagePlayer(enemy.id, 1, events);
      }
    }
    if (removedEnemies.size > 0) {
      this.state.enemies = this.state.enemies.filter(
        (enemy) => !removedEnemies.has(enemy.id),
      );
    }
  }

  private removeOutOfBoundsBullets(): void {
    this.state.bullets = this.state.bullets.filter(
      (bullet) =>
        bullet.y + bullet.height >= 0 &&
        bullet.y <= this.state.config.worldHeight,
    );
  }

  private scheduleNextWave(events: ShooterEvent[]): void {
    if (
      this.state.status === "running" &&
      this.state.enemies.length === 0 &&
      this.state.nextWaveAtTick === null
    ) {
      this.state.nextWaveAtTick =
        this.state.tick + this.state.config.betweenWaveTicks;
      events.push({
        type: "wave-cleared",
        tick: this.state.tick,
        wave: this.state.wave,
        nextWave: this.state.wave + 1,
      });
    }
  }

  private finishIfPlayerDestroyed(events: ShooterEvent[]): void {
    if (this.state.player.health > 0 || this.state.status === "game-over") {
      return;
    }
    this.state.status = "game-over";
    // Discard unconsumed wall-clock input so a terminal snapshot remains valid
    // even when game-over occurs during a large advance() call.
    this.state.accumulatorUnits = 0;
    events.push({
      type: "game-over",
      tick: this.state.tick,
      score: this.state.score,
    });
  }

  private awardEnemy(enemy: EnemyState, events: ShooterEvent[]): void {
    this.state.combo =
      this.state.combo > 0 && this.state.tick <= this.state.comboExpiresAtTick
        ? this.state.combo + 1
        : 1;
    this.state.maxCombo = Math.max(this.state.maxCombo, this.state.combo);
    this.state.comboExpiresAtTick =
      this.state.tick + this.state.config.comboWindowTicks;
    const scoreAwarded = enemy.scoreValue * this.state.combo;
    this.state.score += scoreAwarded;
    events.push({
      type: "enemy-destroyed",
      tick: this.state.tick,
      enemyId: enemy.id,
      x: enemy.x + enemy.width / 2,
      y: enemy.y + enemy.height / 2,
      scoreAwarded,
      combo: this.state.combo,
    });
  }

  private damagePlayer(
    sourceId: number,
    damage: number,
    events: ShooterEvent[],
  ): void {
    if (this.state.player.health <= 0) {
      return;
    }
    this.state.player.health = Math.max(0, this.state.player.health - damage);
    events.push({
      type: "player-hit",
      tick: this.state.tick,
      sourceId,
      health: this.state.player.health,
    });
  }

  private createBullet(
    owner: BulletOwner,
    x: number,
    y: number,
    velocityY: number,
  ): BulletState {
    return {
      id: this.allocateEntityId(),
      owner,
      x,
      y,
      width: 4,
      height: owner === "player" ? 13 : 9,
      velocityY,
      damage: 1,
    };
  }

  private allocateEntityId(): number {
    const id = this.state.nextEntityId;
    this.state.nextEntityId += 1;
    return id;
  }

  private nextRandom(): number {
    this.state.randomState =
      (Math.imul(1_664_525, this.state.randomState) + 1_013_904_223) >>> 0;
    return this.state.randomState / 0x1_0000_0000;
  }
}

export function createShooterEngine(
  options: ShooterEngineOptions = {},
): ShooterEngine {
  return new ShooterEngine(options);
}

function createInitialSnapshot(
  seed: number,
  config: ShooterConfig,
): ShooterSnapshot {
  const copiedConfig = { ...config };
  return {
    schema: SHOOTER_SNAPSHOT_SCHEMA,
    initialSeed: seed,
    randomState: seed,
    tick: 0,
    accumulatorUnits: 0,
    status: "running",
    score: 0,
    combo: 0,
    maxCombo: 0,
    comboExpiresAtTick: 0,
    wave: 0,
    nextWaveAtTick: copiedConfig.firstWaveDelayTicks,
    nextEntityId: 1,
    config: copiedConfig,
    player: {
      id: 0,
      x: (copiedConfig.worldWidth - copiedConfig.playerWidth) / 2,
      y: copiedConfig.worldHeight - copiedConfig.playerHeight - 28,
      width: copiedConfig.playerWidth,
      height: copiedConfig.playerHeight,
      health: copiedConfig.playerMaxHealth,
      maxHealth: copiedConfig.playerMaxHealth,
      fireCooldownTicks: 0,
    },
    enemies: [],
    bullets: [],
  };
}

function resolveConfig(partial: Partial<ShooterConfig> = {}): ShooterConfig {
  const config = { ...DEFAULT_CONFIG, ...partial };
  validateConfig(config);
  return config;
}

function validateConfig(config: ShooterConfig): void {
  for (const [key, value] of Object.entries(config)) {
    if (!Number.isFinite(value) || value <= 0) {
      throw new RangeError(`Shooter config ${key} must be a positive number.`);
    }
  }
  for (const key of INTEGER_CONFIG_KEYS) {
    if (!Number.isInteger(config[key])) {
      throw new RangeError(`Shooter config ${key} must be an integer.`);
    }
  }
  if (config.worldWidth < config.playerWidth + 24) {
    throw new RangeError("Shooter worldWidth is too small for the player.");
  }
  if (config.worldHeight < config.playerHeight + 120) {
    throw new RangeError("Shooter worldHeight is too small for the player.");
  }
  if (config.baseEnemiesPerWave > config.maxEnemiesPerWave) {
    throw new RangeError(
      "Shooter baseEnemiesPerWave cannot exceed maxEnemiesPerWave.",
    );
  }
}

function normalizeSeed(seed: number): number {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffff_ffff) {
    throw new RangeError("Shooter seed must be an unsigned 32-bit integer.");
  }
  return seed >>> 0;
}

function normalizeInput(input: ShooterInput): Required<ShooterInput> {
  return {
    left: input.left === true,
    right: input.right === true,
    up: input.up === true,
    down: input.down === true,
    fire: input.fire === true,
  };
}

function enemyKindFor(wave: number, index: number): EnemyKind {
  const sequence = (wave * 3 + index * 2) % 10;
  if (sequence >= 8) {
    return "bulwark";
  }
  return sequence >= 4 ? "striker" : "scout";
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

function overlaps(left: Bounds, right: Bounds): boolean {
  return (
    left.x < right.x + right.width &&
    left.x + left.width > right.x &&
    left.y < right.y + right.height &&
    left.y + left.height > right.y
  );
}

function cloneSnapshot(snapshot: ShooterSnapshot): ShooterSnapshot {
  return {
    ...snapshot,
    config: { ...snapshot.config },
    player: { ...snapshot.player },
    enemies: snapshot.enemies.map((enemy) => ({ ...enemy })),
    bullets: snapshot.bullets.map((bullet) => ({ ...bullet })),
  };
}

function assertSnapshot(value: unknown): asserts value is ShooterSnapshot {
  if (!isRecord(value) || value.schema !== SHOOTER_SNAPSHOT_SCHEMA) {
    throw new ShooterSnapshotError(
      `Snapshot schema must be ${SHOOTER_SNAPSHOT_SCHEMA}.`,
    );
  }
  if (!isRecord(value.config)) {
    throw new ShooterSnapshotError("Snapshot config is missing.");
  }
  try {
    validateConfig(value.config as unknown as ShooterConfig);
    normalizeSeed(value.initialSeed as number);
    normalizeSeed(value.randomState as number);
  } catch (error) {
    throw new ShooterSnapshotError(messageOf(error));
  }

  assertIntegerField(value, "tick", 0);
  assertIntegerField(value, "accumulatorUnits", 0, TIME_UNITS_PER_SECOND - 1);
  assertIntegerField(value, "score", 0);
  assertIntegerField(value, "combo", 0);
  assertIntegerField(value, "maxCombo", 0);
  assertIntegerField(value, "comboExpiresAtTick", 0);
  assertIntegerField(value, "wave", 0);
  assertIntegerField(value, "nextEntityId", 1);
  if (
    value.status !== "running" &&
    value.status !== "paused" &&
    value.status !== "game-over"
  ) {
    throw new ShooterSnapshotError("Snapshot status is invalid.");
  }
  if (value.nextWaveAtTick !== null) {
    assertIntegerField(value, "nextWaveAtTick", 0);
  }
  if (!isRecord(value.player)) {
    throw new ShooterSnapshotError("Snapshot player is missing.");
  }
  assertEntity(value.player, "player");
  if (value.player.id !== 0) {
    throw new ShooterSnapshotError("Snapshot player id must be zero.");
  }
  assertIntegerField(value.player, "health", 0);
  assertIntegerField(value.player, "maxHealth", 1);
  assertIntegerField(value.player, "fireCooldownTicks", 0);

  if (!Array.isArray(value.enemies) || !Array.isArray(value.bullets)) {
    throw new ShooterSnapshotError("Snapshot entity lists are invalid.");
  }
  const ids = new Set<number>();
  for (const enemy of value.enemies) {
    if (!isRecord(enemy)) {
      throw new ShooterSnapshotError("Snapshot enemy is invalid.");
    }
    assertEntity(enemy, "enemy");
    assertPositiveEntityId(enemy, ids);
    if (
      enemy.kind !== "scout" &&
      enemy.kind !== "striker" &&
      enemy.kind !== "bulwark"
    ) {
      throw new ShooterSnapshotError("Snapshot enemy kind is invalid.");
    }
    assertFiniteField(enemy, "velocityX");
    assertIntegerField(enemy, "health", 0);
    assertIntegerField(enemy, "maxHealth", 1);
    assertIntegerField(enemy, "scoreValue", 1);
    assertIntegerField(enemy, "firePhase", 0);
  }
  for (const bullet of value.bullets) {
    if (!isRecord(bullet)) {
      throw new ShooterSnapshotError("Snapshot bullet is invalid.");
    }
    assertEntity(bullet, "bullet");
    assertPositiveEntityId(bullet, ids);
    if (bullet.owner !== "player" && bullet.owner !== "enemy") {
      throw new ShooterSnapshotError("Snapshot bullet owner is invalid.");
    }
    assertFiniteField(bullet, "velocityY");
    assertIntegerField(bullet, "damage", 1);
  }
  if ([...ids].some((id) => id >= (value.nextEntityId as number))) {
    throw new ShooterSnapshotError(
      "Snapshot nextEntityId must exceed every live entity id.",
    );
  }
}

function assertEntity(record: Record<string, unknown>, label: string): void {
  for (const key of ["x", "y", "width", "height"] as const) {
    assertFiniteField(record, key);
  }
  if ((record.width as number) <= 0 || (record.height as number) <= 0) {
    throw new ShooterSnapshotError(`Snapshot ${label} bounds are invalid.`);
  }
}

function assertPositiveEntityId(
  record: Record<string, unknown>,
  ids: Set<number>,
): void {
  assertIntegerField(record, "id", 1);
  const id = record.id as number;
  if (ids.has(id)) {
    throw new ShooterSnapshotError("Snapshot entity ids must be unique.");
  }
  ids.add(id);
}

function assertFiniteField(record: Record<string, unknown>, key: string): void {
  if (typeof record[key] !== "number" || !Number.isFinite(record[key])) {
    throw new ShooterSnapshotError(`Snapshot ${key} must be finite.`);
  }
}

function assertIntegerField(
  record: Record<string, unknown>,
  key: string,
  minimum: number,
  maximum = Number.MAX_SAFE_INTEGER,
): void {
  const value = record[key];
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < minimum ||
    value > maximum
  ) {
    throw new ShooterSnapshotError(`Snapshot ${key} is invalid.`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
