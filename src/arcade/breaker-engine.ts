/**
 * Prism Bastion's browser-safe deterministic game engine.
 *
 * The engine owns rules and simulation only. Rendering, audio, input sampling,
 * and frame-time accumulation remain host concerns. Call `stepBreakerGame`
 * exactly once per fixed simulation tick.
 */

export const BREAKER_SNAPSHOT_SCHEMA = "axirune.arcade.prism-bastion/1";
export const BREAKER_FIXED_STEP_HZ = 120;
export const BREAKER_FIXED_STEP_SECONDS = 1 / BREAKER_FIXED_STEP_HZ;
export const BREAKER_LEVEL_COUNT = 3;

export const BREAKER_RULES = Object.freeze({
  worldWidth: 960,
  worldHeight: 640,
  paddleY: 590,
  paddleHeight: 18,
  paddleSpeed: 690,
  ballRadius: 8,
  initialLives: 3,
  maxCollisionSubsteps: 12,
  novaRadius: 108,
});

export type BreakerPhase =
  | "ready"
  | "playing"
  | "paused"
  | "level-clear"
  | "won"
  | "game-over";

export type BreakerBrickKind =
  | "lumen"
  | "shell"
  | "crown"
  | "nova"
  | "voidstone";

export type BreakerDamageSource = "ball" | "nova";

export const BREAKER_BRICK_RULES: Readonly<
  Record<
    BreakerBrickKind,
    Readonly<{ hp: number; points: number; destructible: boolean }>
  >
> = Object.freeze({
  lumen: Object.freeze({ hp: 1, points: 100, destructible: true }),
  shell: Object.freeze({ hp: 2, points: 180, destructible: true }),
  crown: Object.freeze({ hp: 3, points: 320, destructible: true }),
  nova: Object.freeze({ hp: 1, points: 220, destructible: true }),
  voidstone: Object.freeze({ hp: 1, points: 0, destructible: false }),
});

export interface BreakerPaddle {
  /** Horizontal center in world units. */
  x: number;
  y: number;
  width: number;
  height: number;
  velocityX: number;
}

export interface BreakerBall {
  id: string;
  /** Center point in world units. */
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
  radius: number;
  attached: boolean;
}

export interface BreakerBrick {
  id: string;
  kind: BreakerBrickKind;
  x: number;
  y: number;
  width: number;
  height: number;
  hp: number;
  maxHp: number;
  /** Per-instance score value. Hosts may tune this from a verified rule contract. */
  points: number;
  destructible: boolean;
}

export type BreakerEvent =
  | { type: "ball-launched"; ballId: string }
  | { type: "paddle-hit"; ballId: string; offset: number }
  | {
      type: "brick-hit";
      brickId: string;
      brickKind: BreakerBrickKind;
      source: BreakerDamageSource;
      remainingHp: number;
    }
  | {
      type: "brick-broken";
      brickId: string;
      brickKind: BreakerBrickKind;
      source: BreakerDamageSource;
      combo: number;
      points: number;
    }
  | { type: "voidstone-deflect"; brickId: string }
  | { type: "nova-burst"; brickId: string; x: number; y: number }
  | { type: "life-lost"; livesRemaining: number }
  | { type: "level-clear"; level: number }
  | { type: "level-start"; level: number; name: string }
  | { type: "game-won"; score: number }
  | { type: "game-over"; score: number };

export interface BreakerGameState {
  schema: typeof BREAKER_SNAPSHOT_SCHEMA;
  gameId: "prism-bastion";
  tick: number;
  phase: BreakerPhase;
  pausedFrom: Exclude<BreakerPhase, "paused" | "won" | "game-over"> | null;
  initialSeed: number;
  rngState: number;
  initialLives: number;
  level: number;
  levelName: string;
  score: number;
  combo: number;
  bestCombo: number;
  lives: number;
  paddle: BreakerPaddle;
  balls: BreakerBall[];
  bricks: BreakerBrick[];
  /** Events produced by the most recent fixed tick. */
  events: BreakerEvent[];
}

export interface BreakerInput {
  /** Keyboard/controller direction. Values outside [-1, 1] are clamped. */
  axis?: number;
  /** Optional pointer/touch target in world coordinates. */
  targetX?: number;
  /** One-tick command. */
  launch?: boolean;
  /** One-tick command. */
  togglePause?: boolean;
  /** One-tick command. Restarts the campaign with its original seed. */
  restart?: boolean;
}

export interface CreateBreakerGameOptions {
  seed?: number;
  lives?: number;
}

interface LevelDefinition {
  name: string;
  paddleWidth: number;
  ballSpeed: number;
  bricks: BreakerBrick[];
}

const PHASES = new Set<BreakerPhase>([
  "ready",
  "playing",
  "paused",
  "level-clear",
  "won",
  "game-over",
]);

const BRICK_KINDS = new Set<BreakerBrickKind>([
  "lumen",
  "shell",
  "crown",
  "nova",
  "voidstone",
]);

const EVENT_TYPES = new Set<BreakerEvent["type"]>([
  "ball-launched",
  "paddle-hit",
  "brick-hit",
  "brick-broken",
  "voidstone-deflect",
  "nova-burst",
  "life-lost",
  "level-clear",
  "level-start",
  "game-won",
  "game-over",
]);

const LEVEL_NAMES = ["Aurora Gate", "Mirror Foundry", "Nova Crown"] as const;
const EPSILON = 0.000_001;

export function createBreakerGame(
  options: CreateBreakerGameOptions = {},
): BreakerGameState {
  const initialSeed = normalizeSeed(options.seed ?? 0xa817_c0de);
  const initialLives = clampInteger(
    options.lives ?? BREAKER_RULES.initialLives,
    1,
    9,
  );
  const level = createLevel(1);
  const paddle = createPaddle(level.paddleWidth);

  return {
    schema: BREAKER_SNAPSHOT_SCHEMA,
    gameId: "prism-bastion",
    tick: 0,
    phase: "ready",
    pausedFrom: null,
    initialSeed,
    rngState: initialSeed,
    initialLives,
    level: 1,
    levelName: level.name,
    score: 0,
    combo: 0,
    bestCombo: 0,
    lives: initialLives,
    paddle,
    balls: [createAttachedBall(paddle)],
    bricks: level.bricks,
    events: [],
  };
}

/** Advances the simulation by exactly one 1/120 second tick. */
export function stepBreakerGame(
  current: BreakerGameState,
  input: BreakerInput = {},
): BreakerGameState {
  assertBreakerState(current);

  if (input.restart) {
    return createBreakerGame({
      seed: current.initialSeed,
      lives: current.initialLives,
    });
  }

  const state = cloneState(current);
  state.events = [];

  applyPauseCommand(state, input);
  if (state.phase === "paused" || isTerminalPhase(state.phase)) {
    return state;
  }

  if (input.launch && state.phase === "level-clear") {
    loadLevel(state, state.level + 1);
  }
  if (input.launch && state.phase === "ready") {
    launchAttachedBalls(state);
  }

  updatePaddle(state, input);
  if (state.phase === "ready") {
    attachBallsToPaddle(state);
  } else if (state.phase === "playing") {
    updateBalls(state);
    if (state.phase === "playing") {
      resolveLevelCompletion(state);
    }
    // Clearing the final brick wins the tick even if an orb also crossed the
    // lower boundary during that same fixed step.
    if (state.phase === "playing") {
      resolveLostBalls(state);
    }
  }

  state.tick += 1;
  quantizeState(state);
  return state;
}

/** Runs a deterministic sequence of fixed ticks, useful for tests and replays. */
export function runBreakerTicks(
  state: BreakerGameState,
  inputs: readonly BreakerInput[],
): BreakerGameState {
  return inputs.reduce(stepBreakerGame, state);
}

/** Creates a stable JSON checkpoint that can be stored or replayed later. */
export function serializeBreakerState(state: BreakerGameState): string {
  assertBreakerState(state);
  return JSON.stringify(state);
}

/** Restores and validates an untrusted JSON checkpoint. */
export function restoreBreakerState(snapshot: string): BreakerGameState {
  let value: unknown;
  try {
    value = JSON.parse(snapshot);
  } catch (error) {
    throw new BreakerSnapshotError(
      `Snapshot is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  assertBreakerState(value);
  return cloneState(value);
}

export class BreakerSnapshotError extends Error {
  readonly name = "BreakerSnapshotError";
}

function applyPauseCommand(state: BreakerGameState, input: BreakerInput): void {
  if (!input.togglePause) return;

  if (state.phase === "paused") {
    state.phase = state.pausedFrom ?? "ready";
    state.pausedFrom = null;
    return;
  }
  if (
    state.phase === "ready" ||
    state.phase === "playing" ||
    state.phase === "level-clear"
  ) {
    state.pausedFrom = state.phase;
    state.phase = "paused";
  }
}

function updatePaddle(state: BreakerGameState, input: BreakerInput): void {
  const paddle = state.paddle;
  const previousX = paddle.x;
  const minimumX = paddle.width / 2;
  const maximumX = BREAKER_RULES.worldWidth - paddle.width / 2;

  let intendedVelocity = 0;
  if (typeof input.targetX === "number" && Number.isFinite(input.targetX)) {
    const target = clamp(input.targetX, minimumX, maximumX);
    intendedVelocity = clamp(
      (target - paddle.x) / BREAKER_FIXED_STEP_SECONDS,
      -BREAKER_RULES.paddleSpeed,
      BREAKER_RULES.paddleSpeed,
    );
  } else {
    intendedVelocity =
      clamp(input.axis ?? 0, -1, 1) * BREAKER_RULES.paddleSpeed;
  }

  paddle.x = clamp(
    paddle.x + intendedVelocity * BREAKER_FIXED_STEP_SECONDS,
    minimumX,
    maximumX,
  );
  paddle.velocityX = (paddle.x - previousX) / BREAKER_FIXED_STEP_SECONDS;
}

function updateBalls(state: BreakerGameState): void {
  for (const ball of state.balls) {
    if (ball.attached) continue;

    const speed = Math.hypot(ball.velocityX, ball.velocityY);
    const travel = speed * BREAKER_FIXED_STEP_SECONDS;
    const safeDistance = Math.max(ball.radius * 0.45, 1);
    const substeps = Math.min(
      BREAKER_RULES.maxCollisionSubsteps,
      Math.max(1, Math.ceil(travel / safeDistance)),
    );
    const substepSeconds = BREAKER_FIXED_STEP_SECONDS / substeps;

    for (let substep = 0; substep < substeps; substep += 1) {
      const previousX = ball.x;
      const previousY = ball.y;
      ball.x += ball.velocityX * substepSeconds;
      ball.y += ball.velocityY * substepSeconds;

      resolveWallCollision(ball);
      resolvePaddleCollision(state, ball, previousY);
      resolveBrickCollision(state, ball, previousX, previousY);

      if (ball.y - ball.radius > BREAKER_RULES.worldHeight) break;
    }
  }
}

function resolveWallCollision(ball: BreakerBall): void {
  if (ball.x - ball.radius < 0) {
    ball.x = ball.radius;
    ball.velocityX = Math.abs(ball.velocityX);
  } else if (ball.x + ball.radius > BREAKER_RULES.worldWidth) {
    ball.x = BREAKER_RULES.worldWidth - ball.radius;
    ball.velocityX = -Math.abs(ball.velocityX);
  }
  if (ball.y - ball.radius < 0) {
    ball.y = ball.radius;
    ball.velocityY = Math.abs(ball.velocityY);
  }
}

function resolvePaddleCollision(
  state: BreakerGameState,
  ball: BreakerBall,
  previousY: number,
): void {
  const paddle = state.paddle;
  if (ball.velocityY <= 0) return;
  if (
    !circleIntersectsRectangle(
      ball,
      paddle.x - paddle.width / 2,
      paddle.y,
      paddle.width,
      paddle.height,
    )
  ) {
    return;
  }
  if (previousY + ball.radius > paddle.y + 2) return;

  ball.y = paddle.y - ball.radius - EPSILON;
  const offset = clamp(
    (ball.x - paddle.x) / Math.max(paddle.width / 2, 1),
    -1,
    1,
  );
  const speed = Math.max(Math.hypot(ball.velocityX, ball.velocityY), 1);
  const maximumAngle = (65 * Math.PI) / 180;
  let velocityX =
    Math.sin(offset * maximumAngle) * speed + paddle.velocityX * 0.12;
  velocityX = clamp(velocityX, -speed * 0.92, speed * 0.92);
  ball.velocityX = velocityX;
  ball.velocityY = -Math.sqrt(Math.max(speed * speed - velocityX * velocityX, 1));

  state.combo = 0;
  state.events.push({ type: "paddle-hit", ballId: ball.id, offset });
}

function resolveBrickCollision(
  state: BreakerGameState,
  ball: BreakerBall,
  previousX: number,
  previousY: number,
): void {
  for (const brick of state.bricks) {
    if (brick.destructible && brick.hp <= 0) continue;
    if (
      !circleIntersectsRectangle(
        ball,
        brick.x,
        brick.y,
        brick.width,
        brick.height,
      )
    ) {
      continue;
    }

    const normal = collisionNormal(ball, brick, previousX, previousY);
    const velocityAlongNormal =
      ball.velocityX * normal.x + ball.velocityY * normal.y;
    if (velocityAlongNormal < 0) {
      ball.velocityX -= 2 * velocityAlongNormal * normal.x;
      ball.velocityY -= 2 * velocityAlongNormal * normal.y;
    } else {
      // Degenerate overlaps can occur after a restored user-edited snapshot.
      if (Math.abs(normal.x) > 0) ball.velocityX *= -1;
      if (Math.abs(normal.y) > 0) ball.velocityY *= -1;
    }
    ball.x = previousX + normal.x * EPSILON;
    ball.y = previousY + normal.y * EPSILON;

    if (!brick.destructible) {
      state.events.push({ type: "voidstone-deflect", brickId: brick.id });
    } else {
      damageBrickAndResolveNova(state, brick, "ball");
    }
    return;
  }
}

function damageBrickAndResolveNova(
  state: BreakerGameState,
  brick: BreakerBrick,
  source: BreakerDamageSource,
): void {
  const novaQueue: BreakerBrick[] = [];
  const queuedNovaIds = new Set<string>();
  damageBrick(state, brick, source, novaQueue, queuedNovaIds);

  while (novaQueue.length > 0) {
    const nova = novaQueue.shift();
    if (!nova) break;
    const centerX = nova.x + nova.width / 2;
    const centerY = nova.y + nova.height / 2;
    state.events.push({
      type: "nova-burst",
      brickId: nova.id,
      x: centerX,
      y: centerY,
    });

    for (const candidate of state.bricks) {
      if (
        candidate.id === nova.id ||
        !candidate.destructible ||
        candidate.hp <= 0
      ) {
        continue;
      }
      const candidateX = candidate.x + candidate.width / 2;
      const candidateY = candidate.y + candidate.height / 2;
      if (
        Math.hypot(candidateX - centerX, candidateY - centerY) <=
        BREAKER_RULES.novaRadius
      ) {
        damageBrick(state, candidate, "nova", novaQueue, queuedNovaIds);
      }
    }
  }
}

function damageBrick(
  state: BreakerGameState,
  brick: BreakerBrick,
  source: BreakerDamageSource,
  novaQueue: BreakerBrick[],
  queuedNovaIds: Set<string>,
): void {
  if (!brick.destructible || brick.hp <= 0) return;

  brick.hp -= 1;
  state.events.push({
    type: "brick-hit",
    brickId: brick.id,
    brickKind: brick.kind,
    source,
    remainingHp: brick.hp,
  });
  if (brick.hp > 0) return;

  state.combo += 1;
  state.bestCombo = Math.max(state.bestCombo, state.combo);
  const multiplier = Math.min(8, 1 + Math.floor((state.combo - 1) / 4));
  const awardedPoints = brick.points * multiplier;
  state.score += awardedPoints;
  state.events.push({
    type: "brick-broken",
    brickId: brick.id,
    brickKind: brick.kind,
    source,
    combo: state.combo,
    points: awardedPoints,
  });

  if (brick.kind === "nova" && !queuedNovaIds.has(brick.id)) {
    queuedNovaIds.add(brick.id);
    novaQueue.push(brick);
  }
}

function resolveLostBalls(state: BreakerGameState): void {
  state.balls = state.balls.filter(
    (ball) => ball.y - ball.radius <= BREAKER_RULES.worldHeight,
  );
  if (state.balls.length > 0) return;

  state.lives -= 1;
  state.combo = 0;
  state.events.push({ type: "life-lost", livesRemaining: state.lives });
  if (state.lives <= 0) {
    state.phase = "game-over";
    state.events.push({ type: "game-over", score: state.score });
    return;
  }

  state.phase = "ready";
  state.paddle.velocityX = 0;
  state.balls = [createAttachedBall(state.paddle)];
}

function resolveLevelCompletion(state: BreakerGameState): void {
  if (state.bricks.some((brick) => brick.destructible && brick.hp > 0)) return;

  if (state.level >= BREAKER_LEVEL_COUNT) {
    state.phase = "won";
    state.events.push({ type: "game-won", score: state.score });
    return;
  }
  state.phase = "level-clear";
  state.events.push({ type: "level-clear", level: state.level });
}

function loadLevel(state: BreakerGameState, levelNumber: number): void {
  const normalizedLevel = clampInteger(levelNumber, 1, BREAKER_LEVEL_COUNT);
  const level = createLevel(normalizedLevel);
  state.level = normalizedLevel;
  state.levelName = level.name;
  state.phase = "ready";
  state.pausedFrom = null;
  state.combo = 0;
  state.bricks = level.bricks;
  state.paddle = createPaddle(level.paddleWidth);
  state.balls = [createAttachedBall(state.paddle)];
  state.events.push({
    type: "level-start",
    level: normalizedLevel,
    name: level.name,
  });
}

function launchAttachedBalls(state: BreakerGameState): void {
  const level = createLevel(state.level);
  for (const ball of state.balls) {
    if (!ball.attached) continue;
    const random = nextRandom(state);
    const horizontalFactor = (random * 2 - 1) * 0.58;
    ball.velocityX = level.ballSpeed * horizontalFactor;
    ball.velocityY = -Math.sqrt(
      level.ballSpeed * level.ballSpeed - ball.velocityX * ball.velocityX,
    );
    ball.attached = false;
    state.events.push({ type: "ball-launched", ballId: ball.id });
  }
  state.phase = "playing";
}

function attachBallsToPaddle(state: BreakerGameState): void {
  for (const ball of state.balls) {
    if (!ball.attached) continue;
    ball.x = state.paddle.x;
    ball.y = state.paddle.y - ball.radius - 3;
    ball.velocityX = 0;
    ball.velocityY = 0;
  }
}

function createPaddle(width: number): BreakerPaddle {
  return {
    x: BREAKER_RULES.worldWidth / 2,
    y: BREAKER_RULES.paddleY,
    width,
    height: BREAKER_RULES.paddleHeight,
    velocityX: 0,
  };
}

function createAttachedBall(paddle: BreakerPaddle): BreakerBall {
  return {
    id: "orb-1",
    x: paddle.x,
    y: paddle.y - BREAKER_RULES.ballRadius - 3,
    velocityX: 0,
    velocityY: 0,
    radius: BREAKER_RULES.ballRadius,
    attached: true,
  };
}

function createLevel(levelNumber: number): LevelDefinition {
  const index = clampInteger(levelNumber, 1, BREAKER_LEVEL_COUNT);
  const paddleWidths = [150, 138, 126] as const;
  const ballSpeeds = [430, 475, 520] as const;
  const rows = index === 1 ? 6 : index === 2 ? 7 : 8;
  const columns = 10;
  const brickWidth = 74;
  const brickHeight = 28;
  const gapX = 10;
  const gapY = 11;
  const originX =
    (BREAKER_RULES.worldWidth -
      (columns * brickWidth + (columns - 1) * gapX)) /
    2;
  const originY = 82;
  const bricks: BreakerBrick[] = [];

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const kind = levelBrickKind(index, row, column, rows, columns);
      if (kind === null) continue;
      bricks.push(
        makeBrick(
          `L${index}-R${row + 1}-C${column + 1}`,
          kind,
          originX + column * (brickWidth + gapX),
          originY + row * (brickHeight + gapY),
          brickWidth,
          brickHeight,
        ),
      );
    }
  }

  return {
    name: LEVEL_NAMES[index - 1] ?? LEVEL_NAMES[0],
    paddleWidth: paddleWidths[index - 1] ?? paddleWidths[0],
    ballSpeed: ballSpeeds[index - 1] ?? ballSpeeds[0],
    bricks,
  };
}

function levelBrickKind(
  level: number,
  row: number,
  column: number,
  rows: number,
  columns: number,
): BreakerBrickKind | null {
  if (level === 1) {
    if ((row === 0 && column % 3 === 1) || (row === 4 && column === 4)) {
      return "nova";
    }
    if (row < 2) return "shell";
    return "lumen";
  }

  if (level === 2) {
    const distanceFromCenter = Math.abs(column - (columns - 1) / 2);
    if (row === 3 && distanceFromCenter > 3.5) return null;
    if (row === 2 && (column === 2 || column === 7)) return "voidstone";
    if ((row + column) % 7 === 0) return "nova";
    if (row === 0 || row === rows - 1) return "crown";
    return (row + column) % 3 === 0 ? "shell" : "lumen";
  }

  const isOuterColumn = column === 0 || column === columns - 1;
  if ((row === 2 || row === 5) && (column === 3 || column === 6)) {
    return "voidstone";
  }
  if ((row * 3 + column) % 8 === 0) return "nova";
  if (row < 2 || isOuterColumn) return "crown";
  return (row + column) % 2 === 0 ? "shell" : "lumen";
}

function makeBrick(
  id: string,
  kind: BreakerBrickKind,
  x: number,
  y: number,
  width: number,
  height: number,
): BreakerBrick {
  const rule = BREAKER_BRICK_RULES[kind];
  return {
    id,
    kind,
    x,
    y,
    width,
    height,
    hp: rule.hp,
    maxHp: rule.hp,
    points: rule.points,
    destructible: rule.destructible,
  };
}

function circleIntersectsRectangle(
  ball: Pick<BreakerBall, "x" | "y" | "radius">,
  rectangleX: number,
  rectangleY: number,
  rectangleWidth: number,
  rectangleHeight: number,
): boolean {
  const nearestX = clamp(ball.x, rectangleX, rectangleX + rectangleWidth);
  const nearestY = clamp(ball.y, rectangleY, rectangleY + rectangleHeight);
  const deltaX = ball.x - nearestX;
  const deltaY = ball.y - nearestY;
  return deltaX * deltaX + deltaY * deltaY <= ball.radius * ball.radius;
}

function collisionNormal(
  ball: BreakerBall,
  brick: BreakerBrick,
  previousX: number,
  previousY: number,
): { x: number; y: number } {
  const left = brick.x - ball.radius;
  const right = brick.x + brick.width + ball.radius;
  const top = brick.y - ball.radius;
  const bottom = brick.y + brick.height + ball.radius;

  if (previousY <= top) return { x: 0, y: -1 };
  if (previousY >= bottom) return { x: 0, y: 1 };
  if (previousX <= left) return { x: -1, y: 0 };
  if (previousX >= right) return { x: 1, y: 0 };

  const penetrations = [
    { depth: Math.abs(ball.x - left), x: -1, y: 0 },
    { depth: Math.abs(right - ball.x), x: 1, y: 0 },
    { depth: Math.abs(ball.y - top), x: 0, y: -1 },
    { depth: Math.abs(bottom - ball.y), x: 0, y: 1 },
  ];
  penetrations.sort((first, second) => first.depth - second.depth);
  const normal = penetrations[0];
  return normal ? { x: normal.x, y: normal.y } : { x: 0, y: -1 };
}

function nextRandom(state: BreakerGameState): number {
  let value = state.rngState >>> 0;
  value ^= value << 13;
  value ^= value >>> 17;
  value ^= value << 5;
  state.rngState = value >>> 0;
  return state.rngState / 0x1_0000_0000;
}

function cloneState(state: BreakerGameState): BreakerGameState {
  return {
    ...state,
    paddle: { ...state.paddle },
    balls: state.balls.map((ball) => ({ ...ball })),
    bricks: state.bricks.map((brick) => ({ ...brick })),
    events: state.events.map((event) => ({ ...event })),
  };
}

function quantizeState(state: BreakerGameState): void {
  state.paddle.x = quantize(state.paddle.x);
  state.paddle.velocityX = quantize(state.paddle.velocityX);
  for (const ball of state.balls) {
    ball.x = quantize(ball.x);
    ball.y = quantize(ball.y);
    ball.velocityX = quantize(ball.velocityX);
    ball.velocityY = quantize(ball.velocityY);
  }
}

function quantize(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function normalizeSeed(seed: number): number {
  if (!Number.isFinite(seed)) return 0xa817_c0de;
  const normalized = Math.trunc(seed) >>> 0;
  return normalized === 0 ? 0x6d2b_79f5 : normalized;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function clampInteger(value: number, minimum: number, maximum: number): number {
  if (!Number.isFinite(value)) return minimum;
  return Math.trunc(clamp(value, minimum, maximum));
}

function isTerminalPhase(phase: BreakerPhase): boolean {
  return phase === "won" || phase === "game-over";
}

function assertBreakerState(value: unknown): asserts value is BreakerGameState {
  if (!isRecord(value)) failSnapshot("Snapshot root must be an object.");
  if (value.schema !== BREAKER_SNAPSHOT_SCHEMA) {
    failSnapshot(`Unsupported snapshot schema: ${String(value.schema)}.`);
  }
  if (value.gameId !== "prism-bastion") {
    failSnapshot("Snapshot gameId must be prism-bastion.");
  }
  assertInteger(value.tick, "tick", 0);
  if (typeof value.phase !== "string" || !PHASES.has(value.phase as BreakerPhase)) {
    failSnapshot("phase is invalid.");
  }
  if (
    value.pausedFrom !== null &&
    value.pausedFrom !== "ready" &&
    value.pausedFrom !== "playing" &&
    value.pausedFrom !== "level-clear"
  ) {
    failSnapshot("pausedFrom is invalid.");
  }
  if ((value.phase === "paused") !== (value.pausedFrom !== null)) {
    failSnapshot("pausedFrom must be present exactly while the game is paused.");
  }
  assertUnsignedInteger(value.initialSeed, "initialSeed");
  assertUnsignedInteger(value.rngState, "rngState");
  if (value.initialSeed === 0 || value.rngState === 0) {
    failSnapshot("initialSeed and rngState must be non-zero.");
  }
  assertInteger(value.initialLives, "initialLives", 1, 9);
  assertInteger(value.level, "level", 1, BREAKER_LEVEL_COUNT);
  if (typeof value.levelName !== "string" || value.levelName.length === 0) {
    failSnapshot("levelName must be a non-empty string.");
  }
  if (value.levelName !== LEVEL_NAMES[value.level - 1]) {
    failSnapshot("levelName does not match level.");
  }
  assertInteger(value.score, "score", 0);
  assertInteger(value.combo, "combo", 0);
  assertInteger(value.bestCombo, "bestCombo", 0);
  assertInteger(value.lives, "lives", 0, 9);
  if (value.bestCombo < value.combo) {
    failSnapshot("bestCombo cannot be lower than combo.");
  }
  if (value.phase === "level-clear" && value.level >= BREAKER_LEVEL_COUNT) {
    failSnapshot("The final level must transition to won, not level-clear.");
  }
  if (value.phase === "won" && value.level !== BREAKER_LEVEL_COUNT) {
    failSnapshot("A won campaign must be on the final level.");
  }
  if ((value.phase === "game-over") !== (value.lives === 0)) {
    failSnapshot("lives must be zero exactly when the game is over.");
  }
  assertPaddle(value.paddle);

  if (!Array.isArray(value.balls)) failSnapshot("balls must be an array.");
  const ballIds = new Set<string>();
  for (const ball of value.balls) {
    assertBall(ball);
    if (ballIds.has(ball.id)) failSnapshot(`Duplicate ball id: ${ball.id}.`);
    ballIds.add(ball.id);
  }
  if (
    value.balls.length === 0 &&
    value.phase !== "game-over" &&
    value.phase !== "won"
  ) {
    failSnapshot("A non-terminal game must contain at least one ball.");
  }

  if (!Array.isArray(value.bricks)) failSnapshot("bricks must be an array.");
  const brickIds = new Set<string>();
  for (const brick of value.bricks) {
    assertBrick(brick);
    if (brickIds.has(brick.id)) failSnapshot(`Duplicate brick id: ${brick.id}.`);
    brickIds.add(brick.id);
  }

  if (!Array.isArray(value.events)) failSnapshot("events must be an array.");
  for (const event of value.events) assertEvent(event);
}

function assertPaddle(value: unknown): asserts value is BreakerPaddle {
  if (!isRecord(value)) failSnapshot("paddle must be an object.");
  assertFinite(value.x, "paddle.x");
  assertFinite(value.y, "paddle.y");
  assertPositive(value.width, "paddle.width");
  assertPositive(value.height, "paddle.height");
  assertFinite(value.velocityX, "paddle.velocityX");
}

function assertBall(value: unknown): asserts value is BreakerBall {
  if (!isRecord(value)) failSnapshot("Each ball must be an object.");
  assertIdentifier(value.id, "ball.id");
  assertFinite(value.x, "ball.x");
  assertFinite(value.y, "ball.y");
  assertFinite(value.velocityX, "ball.velocityX");
  assertFinite(value.velocityY, "ball.velocityY");
  assertPositive(value.radius, "ball.radius");
  if (typeof value.attached !== "boolean") {
    failSnapshot("ball.attached must be a boolean.");
  }
}

function assertBrick(value: unknown): asserts value is BreakerBrick {
  if (!isRecord(value)) failSnapshot("Each brick must be an object.");
  assertIdentifier(value.id, "brick.id");
  if (
    typeof value.kind !== "string" ||
    !BRICK_KINDS.has(value.kind as BreakerBrickKind)
  ) {
    failSnapshot("brick.kind is invalid.");
  }
  assertFinite(value.x, "brick.x");
  assertFinite(value.y, "brick.y");
  assertPositive(value.width, "brick.width");
  assertPositive(value.height, "brick.height");
  assertInteger(value.hp, "brick.hp", 0);
  assertInteger(value.maxHp, "brick.maxHp", 1);
  assertInteger(value.points, "brick.points", 0);
  if (value.hp > value.maxHp) failSnapshot("brick.hp cannot exceed maxHp.");
  if (typeof value.destructible !== "boolean") {
    failSnapshot("brick.destructible must be a boolean.");
  }
  const rule = BREAKER_BRICK_RULES[value.kind as BreakerBrickKind];
  if (
    value.maxHp !== rule.hp ||
    value.destructible !== rule.destructible
  ) {
    failSnapshot(`brick structural rules do not match the ${String(value.kind)} kind.`);
  }
}

function assertEvent(value: unknown): asserts value is BreakerEvent {
  if (!isRecord(value) || typeof value.type !== "string") {
    failSnapshot("Each event must be an object with a type.");
  }
  if (!EVENT_TYPES.has(value.type as BreakerEvent["type"])) {
    failSnapshot(`Unknown event type: ${value.type}.`);
  }

  switch (value.type as BreakerEvent["type"]) {
    case "ball-launched":
      assertIdentifier(value.ballId, "event.ballId");
      return;
    case "paddle-hit":
      assertIdentifier(value.ballId, "event.ballId");
      assertFinite(value.offset, "event.offset");
      if (value.offset < -1 || value.offset > 1) {
        failSnapshot("event.offset must be from -1 to 1.");
      }
      return;
    case "brick-hit":
      assertBrickEventBase(value);
      assertDamageSource(value.source);
      assertInteger(value.remainingHp, "event.remainingHp", 0, 3);
      return;
    case "brick-broken":
      assertBrickEventBase(value);
      assertDamageSource(value.source);
      assertInteger(value.combo, "event.combo", 1);
      assertInteger(value.points, "event.points", 0);
      return;
    case "voidstone-deflect":
      assertIdentifier(value.brickId, "event.brickId");
      return;
    case "nova-burst":
      assertIdentifier(value.brickId, "event.brickId");
      assertFinite(value.x, "event.x");
      assertFinite(value.y, "event.y");
      return;
    case "life-lost":
      assertInteger(value.livesRemaining, "event.livesRemaining", 0, 9);
      return;
    case "level-clear":
      assertInteger(value.level, "event.level", 1, BREAKER_LEVEL_COUNT);
      return;
    case "level-start":
      assertInteger(value.level, "event.level", 1, BREAKER_LEVEL_COUNT);
      assertIdentifier(value.name, "event.name");
      return;
    case "game-won":
    case "game-over":
      assertInteger(value.score, "event.score", 0);
      return;
  }
}

function assertBrickEventBase(value: Record<string, unknown>): void {
  assertIdentifier(value.brickId, "event.brickId");
  if (
    typeof value.brickKind !== "string" ||
    !BRICK_KINDS.has(value.brickKind as BreakerBrickKind)
  ) {
    failSnapshot("event.brickKind is invalid.");
  }
}

function assertDamageSource(value: unknown): asserts value is BreakerDamageSource {
  if (value !== "ball" && value !== "nova") {
    failSnapshot("event.source must be ball or nova.");
  }
}

function assertIdentifier(value: unknown, label: string): asserts value is string {
  if (typeof value !== "string" || value.length === 0 || value.length > 128) {
    failSnapshot(`${label} must be a non-empty string of at most 128 characters.`);
  }
}

function assertPositive(value: unknown, label: string): asserts value is number {
  assertFinite(value, label);
  if (value <= 0) failSnapshot(`${label} must be positive.`);
}

function assertFinite(value: unknown, label: string): asserts value is number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    failSnapshot(`${label} must be a finite number.`);
  }
}

function assertInteger(
  value: unknown,
  label: string,
  minimum: number,
  maximum = Number.MAX_SAFE_INTEGER,
): asserts value is number {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < minimum ||
    value > maximum
  ) {
    failSnapshot(`${label} must be an integer from ${minimum} to ${maximum}.`);
  }
}

function assertUnsignedInteger(value: unknown, label: string): asserts value is number {
  assertInteger(value, label, 0, 0xffff_ffff);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function failSnapshot(message: string): never {
  throw new BreakerSnapshotError(message);
}
