import type { ClassicRuleContract } from "../classic-rule-contract.js";
import {
  getArcadeClassicGame,
  type ArcadeClassicGameId,
  type ArcadeEngineFamily,
} from "./catalog.js";

export const CLASSIC_WORLD_WIDTH = 960;
export const CLASSIC_WORLD_HEIGHT = 540;

export type ClassicWorldStatus =
  | "ready"
  | "running"
  | "paused"
  | "stage-clear"
  | "won"
  | "game-over";

export interface ClassicWorldInput {
  readonly left: boolean;
  readonly right: boolean;
  readonly up: boolean;
  readonly down: boolean;
  readonly primary: boolean;
  readonly secondary: boolean;
  readonly pointerX?: number;
  readonly pointerY?: number;
  readonly pointerActive?: boolean;
}

export const NEUTRAL_CLASSIC_INPUT: ClassicWorldInput = Object.freeze({
  left: false,
  right: false,
  up: false,
  down: false,
  primary: false,
  secondary: false,
});

export interface ClassicPoint {
  x: number;
  y: number;
}

export interface ClassicPlayer extends ClassicPoint {
  vx: number;
  vy: number;
  angle: number;
  radius: number;
  energy: number;
  cooldown: number;
  grounded: boolean;
  facing: -1 | 1;
}

export interface ClassicActor extends ClassicPoint {
  id: number;
  kind: string;
  vx: number;
  vy: number;
  radius: number;
  hp: number;
  age: number;
  timer: number;
  value: number;
  friendly: boolean;
}

export interface ClassicPiece {
  cells: readonly ClassicPoint[];
  x: number;
  y: number;
  color: number;
  rotation: number;
}

export interface ClassicWorldState {
  readonly gameId: ArcadeClassicGameId;
  readonly engineFamily: ArcadeEngineFamily;
  status: ClassicWorldStatus;
  tick: number;
  stage: number;
  score: number;
  lives: number;
  streak: number;
  progress: number;
  clock: number;
  spawnClock: number;
  message: string;
  rng: number;
  initialSeed: number;
  nextActorId: number;
  player: ClassicPlayer;
  actors: ClassicActor[];
  shots: ClassicActor[];
  particles: ClassicActor[];
  trail: ClassicPoint[];
  board: number[][];
  piece: ClassicPiece | null;
  cursor: ClassicPoint;
  selected: ClassicPoint | null;
  direction: ClassicPoint;
  queuedDirection: ClassicPoint;
  objective: number;
  inputLatch: { primary: boolean; secondary: boolean };
}

export interface ClassicWorldSnapshot {
  readonly schema: "axirune-arcade/classic-world-snapshot/1";
  readonly state: ClassicWorldState;
}

export function createClassicWorldState(
  gameId: ArcadeClassicGameId,
  contract: ClassicRuleContract,
  seed = seedForGame(gameId),
): ClassicWorldState {
  if (contract.game !== gameId) {
    throw new Error(`Rule contract ${contract.game} cannot start ${gameId}.`);
  }
  const game = getArcadeClassicGame(gameId);
  const normalizedSeed = normalizeSeed(seed);
  const state: ClassicWorldState = {
    gameId,
    engineFamily: game.engineFamily,
    status: "ready",
    tick: 0,
    stage: contract.stage,
    score: contract.score,
    lives: 3,
    streak: 0,
    progress: 0,
    clock: 0,
    spawnClock: 0,
    message: "CAPSULE VERIFIED",
    rng: normalizedSeed,
    initialSeed: normalizedSeed,
    nextActorId: 1,
    player: playerAt(130, 410),
    actors: [],
    shots: [],
    particles: [],
    trail: [],
    board: [],
    piece: null,
    cursor: { x: 0, y: 0 },
    selected: null,
    direction: { x: 1, y: 0 },
    queuedDirection: { x: 1, y: 0 },
    objective: 0,
    inputLatch: { primary: false, secondary: false },
  };
  initialiseWorld(state, contract);
  return state;
}

export function startClassicWorld(state: ClassicWorldState): ClassicWorldState {
  const next = cloneState(state);
  if (next.status === "ready" || next.status === "paused") {
    next.status = "running";
    next.message = next.tick === 0 ? "LINK ACTIVE" : "RESUMED";
  }
  return next;
}

export function pauseClassicWorld(state: ClassicWorldState): ClassicWorldState {
  const next = cloneState(state);
  if (next.status === "running") {
    next.status = "paused";
    next.message = "SIMULATION PAUSED";
  } else if (next.status === "paused") {
    next.status = "running";
    next.message = "RESUMED";
  }
  return next;
}

export function restartClassicWorld(
  state: ClassicWorldState,
  contract: ClassicRuleContract,
): ClassicWorldState {
  return createClassicWorldState(state.gameId, contract, state.initialSeed);
}

export function advanceClassicWorld(
  state: ClassicWorldState,
  contract: ClassicRuleContract,
): ClassicWorldState {
  if (state.status !== "stage-clear") return cloneState(state);
  const next = createClassicWorldState(state.gameId, contract, state.rng);
  next.score = state.score;
  next.lives = state.lives;
  next.streak = state.streak;
  next.status = "running";
  next.message = `STAGE ${contract.stage}`;
  return next;
}

export function stepClassicWorld(
  state: ClassicWorldState,
  input: ClassicWorldInput,
  contract: ClassicRuleContract,
  deltaSeconds: number,
): ClassicWorldState {
  if (state.gameId !== contract.game) throw new Error("Classic rule/game mismatch.");
  if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0 || deltaSeconds > 0.1) {
    throw new Error("Classic World delta must be between 0 and 0.1 seconds.");
  }

  const next = cloneState(state);
  const pressedPrimary = input.primary && !state.inputLatch.primary;
  const pressedSecondary = input.secondary && !state.inputLatch.secondary;
  next.inputLatch = { primary: input.primary, secondary: input.secondary };
  if (next.status !== "running") return next;

  next.tick += 1;
  next.clock += deltaSeconds;
  next.spawnClock += deltaSeconds;
  next.player.cooldown = Math.max(0, next.player.cooldown - deltaSeconds);

  switch (next.gameId) {
    case "aetherstep-foundry":
    case "moonthread-ronin":
    case "alloy-tempest":
      stepSideMotion(next, input, contract, deltaSeconds, pressedPrimary, pressedSecondary);
      break;
    case "sunwake-corsairs":
      stepProjectileField(next, input, contract, deltaSeconds);
      break;
    case "chromaline-circuit":
    case "dustcoil-courier":
      stepRoadline(next, input, contract, deltaSeconds);
      break;
    case "prism-stack":
      stepPrismStack(next, input, contract, deltaSeconds, pressedPrimary, pressedSecondary);
      break;
    case "glyph-current":
      stepGlyphCurrent(next, input, contract, deltaSeconds, pressedPrimary, pressedSecondary);
      break;
    case "orbit-foundry":
      stepOrbitFoundry(next, input, contract, deltaSeconds);
      break;
    case "harbor-brawl":
    case "circuit-strikers":
      stepArena(next, input, contract, deltaSeconds, pressedPrimary);
      break;
    case "signal-bloom":
      stepTargetStage(next, input, contract, deltaSeconds, pressedPrimary);
      break;
    case "bastion-treads":
    case "emberglass-atlas":
    case "vault-cartographer":
    case "sparkcell-siege":
    case "neon-coil":
    case "lumen-labyrinth":
      stepTileWorld(next, input, contract, deltaSeconds, pressedPrimary, pressedSecondary);
      break;
    default:
      break;
  }

  stepParticles(next, deltaSeconds);
  validateFiniteState(next);
  return next;
}

export function snapshotClassicWorld(state: ClassicWorldState): ClassicWorldSnapshot {
  return Object.freeze({
    schema: "axirune-arcade/classic-world-snapshot/1",
    state: cloneState(state),
  });
}

export function restoreClassicWorld(snapshot: ClassicWorldSnapshot): ClassicWorldState {
  if (snapshot.schema !== "axirune-arcade/classic-world-snapshot/1") {
    throw new Error("Classic World snapshot schema is invalid.");
  }
  const restored = cloneState(snapshot.state);
  validateFiniteState(restored);
  return restored;
}

function initialiseWorld(state: ClassicWorldState, contract: ClassicRuleContract): void {
  switch (state.gameId) {
    case "aetherstep-foundry":
      state.player = playerAt(90, 420);
      state.player.grounded = true;
      state.objective = 3;
      state.actors = [
        actor(state, "relic", 280, 385, 13, true, 1, 1),
        actor(state, "relic", 520, 315, 13, true, 1, 1),
        actor(state, "relic", 760, 245, 13, true, 1, 1),
        actor(state, "crawler", 410, 430, 18, false, 1, 0),
        actor(state, "crawler", 690, 430, 18, false, 1, 0),
      ];
      break;
    case "moonthread-ronin":
      state.player = playerAt(100, 430);
      state.player.grounded = true;
      state.player.energy = 1;
      state.objective = 5;
      state.actors = Array.from({ length: 5 }, (_, index) =>
        actor(state, "sentinel", 290 + index * 135, 420 - (index % 2) * 72, 18, false, 1, 0),
      );
      break;
    case "alloy-tempest":
      state.player = playerAt(90, 420);
      state.player.grounded = true;
      state.objective = 8;
      break;
    case "sunwake-corsairs":
      state.player = playerAt(140, 270);
      state.objective = 12;
      break;
    case "chromaline-circuit":
    case "dustcoil-courier":
      state.player = playerAt(480, 438);
      state.objective = 24 + contract.stage * 4;
      break;
    case "prism-stack":
      state.board = createBoard(10, 16);
      state.piece = nextShardPiece(state);
      state.objective = 3;
      break;
    case "glyph-current":
      state.board = createGlyphBoard(state, 8, 8);
      state.cursor = { x: 3, y: 3 };
      state.objective = 10;
      break;
    case "orbit-foundry":
      state.player = { ...playerAt(760, 410), vx: -210, vy: -280, radius: 11 };
      state.objective = 2_500 + contract.stage * 750;
      break;
    case "harbor-brawl":
      state.player = playerAt(180, 365);
      state.objective = 9;
      break;
    case "circuit-strikers":
      state.player = playerAt(260, 270);
      state.actors = [actor(state, "ball", 480, 270, 14, true, 1, 0)];
      state.objective = 3;
      break;
    case "signal-bloom":
      state.player = playerAt(480, 270);
      state.objective = 12;
      break;
    default:
      initialiseTileWorld(state);
  }
}

function stepSideMotion(
  state: ClassicWorldState,
  input: ClassicWorldInput,
  contract: ClassicRuleContract,
  dt: number,
  pressedPrimary: boolean,
  pressedSecondary: boolean,
): void {
  const runSpeed = (state.gameId === "moonthread-ronin" ? 250 : 220) * contract.tempo;
  const axis = Number(input.right) - Number(input.left);
  state.player.vx += (axis * runSpeed - state.player.vx) * Math.min(1, dt * 12);
  if (axis !== 0) state.player.facing = axis < 0 ? -1 : 1;

  if (pressedPrimary && state.player.grounded) {
    state.player.vy = state.gameId === "moonthread-ronin" ? -570 : -530;
    state.player.grounded = false;
    burst(state, state.player.x, state.player.y + 15, 7, "spark");
  } else if (
    pressedPrimary &&
    state.gameId === "moonthread-ronin" &&
    state.player.energy >= 1 &&
    state.player.cooldown <= 0
  ) {
    // One Moonthread air-step is available between landings. Near a side
    // boundary it becomes a wall kick; elsewhere it follows the facing side.
    const direction = state.player.x <= 30
      ? 1
      : state.player.x >= CLASSIC_WORLD_WIDTH - 30
        ? -1
        : state.player.facing;
    state.player.vx = direction * 330;
    state.player.vy = Math.min(state.player.vy, -260);
    state.player.energy = 0;
    state.player.cooldown = 0.22;
    state.message = "MOONTHREAD AIR-STEP";
    burst(state, state.player.x, state.player.y, 9, "moon-thread");
  }

  if (state.gameId === "alloy-tempest" && (input.secondary || pressedSecondary) && state.player.cooldown <= 0) {
    state.shots.push({
      ...actor(state, "pulse", state.player.x + state.player.facing * 22, state.player.y, 6, true, 1, contract.reward),
      vx: state.player.facing * 620,
    });
    state.player.cooldown = 0.09;
  }

  state.player.vy += contract.gravity * dt;
  state.player.x += state.player.vx * dt;
  state.player.y += state.player.vy * dt;
  state.player.x = clamp(state.player.x, 26, CLASSIC_WORLD_WIDTH - 26);
  if (state.player.y < 24) {
    state.player.y = 24;
    state.player.vy = Math.max(0, state.player.vy);
    if (state.gameId === "moonthread-ronin") state.player.energy = 0;
  }

  const platformY = 460 - platformHeightAt(state.player.x, state.gameId);
  if (state.player.y >= platformY && state.player.vy >= 0) {
    state.player.y = platformY;
    state.player.vy = 0;
    state.player.grounded = true;
    if (state.gameId === "moonthread-ronin") state.player.energy = 1;
  } else if (state.player.y < platformY) {
    state.player.grounded = false;
  }

  if (state.player.y > CLASSIC_WORLD_HEIGHT + 40) hurtPlayer(state, "FELL INTO THE FOUNDRY");

  for (const actorValue of state.actors) {
    if (actorValue.hp <= 0) continue;
    actorValue.age += dt;
    if (actorValue.kind === "relic") {
      actorValue.y += Math.sin(actorValue.age * 3) * 0.18;
      if (distance(state.player, actorValue) < 30) {
        actorValue.hp = 0;
        state.progress += 1;
        award(state, contract.reward, "STAR CORE LINKED");
        burst(state, actorValue.x, actorValue.y, 14, "relic-fragment");
      }
      continue;
    }

    actorValue.vx ||= actorValue.id % 2 === 0 ? contract.enemySpeed * 0.55 : -contract.enemySpeed * 0.55;
    actorValue.x += actorValue.vx * dt;
    if (actorValue.x < 250 || actorValue.x > 900) actorValue.vx *= -1;
    if (state.gameId === "moonthread-ronin" && pressedSecondary && distance(state.player, actorValue) < 82) {
      actorValue.hp = 0;
      state.progress += 1;
      award(state, contract.reward, "SENTINEL DISARMED");
      burst(state, actorValue.x, actorValue.y, 12, "slash");
    } else if (distance(state.player, actorValue) < state.player.radius + actorValue.radius) {
      hurtPlayer(state, "ARMOR FRACTURE");
      actorValue.vx *= -1;
    }
  }

  stepShots(state, dt, contract, (shot, target) => {
    if (target.kind === "crawler" || target.kind === "sentinel" || target.kind === "turret") {
      target.hp -= 1;
      shot.hp = 0;
      if (target.hp <= 0) {
        state.progress += 1;
        award(state, contract.reward, "TARGET CLEARED");
        burst(state, target.x, target.y, 12, "spark");
      }
    }
  });

  if (state.gameId === "alloy-tempest") spawnSideEnemy(state, contract, dt);
  if (state.gameId === "aetherstep-foundry") {
    const relics = state.actors.filter(({ kind, hp }) => kind === "relic" && hp > 0).length;
    if (relics === 0 && state.player.x > 870) clearStage(state, "FOUNDRY GATE OPEN");
  } else if (state.progress >= state.objective) {
    clearStage(state, state.gameId === "moonthread-ronin" ? "MOON SEAL BROKEN" : "CORE DISMANTLED");
  }
}

function stepProjectileField(
  state: ClassicWorldState,
  input: ClassicWorldInput,
  contract: ClassicRuleContract,
  dt: number,
): void {
  const speed = 240 * contract.tempo;
  const dx = Number(input.right) - Number(input.left);
  const dy = Number(input.down) - Number(input.up);
  state.player.x = clamp(state.player.x + dx * speed * dt, 36, 720);
  state.player.y = clamp(state.player.y + dy * speed * dt, 42, 498);
  if (input.primary && state.player.cooldown <= 0) {
    state.shots.push({
      ...actor(state, "sun-bolt", state.player.x + 28, state.player.y, 6, true, 1, contract.reward),
      vx: 650,
    });
    state.player.cooldown = 0.085;
  }

  if (state.spawnClock * 1_000 >= contract.spawnIntervalMs) {
    state.spawnClock = 0;
    const enemy = actor(state, state.progress % 5 === 4 ? "corsair-heavy" : "corsair", 1_010, randomRange(state, 70, 470), 20, false, state.progress % 5 === 4 ? 3 : 1, 0);
    enemy.vx = -contract.enemySpeed;
    enemy.vy = randomRange(state, -40, 40);
    state.actors.push(enemy);
  }

  for (const enemy of state.actors) {
    if (enemy.hp <= 0) continue;
    enemy.x += enemy.vx * dt;
    enemy.y += enemy.vy * dt;
    enemy.y = clamp(enemy.y, 32, 508);
    enemy.age += dt;
    if (enemy.age > 0.8 && Math.floor(enemy.age * 2.2) !== Math.floor((enemy.age - dt) * 2.2)) {
      const shot = actor(state, "ember-shot", enemy.x - 18, enemy.y, 7, false, 1, 0);
      shot.vx = -220 - contract.enemySpeed * 0.35;
      state.shots.push(shot);
    }
    if (enemy.x < -50) {
      enemy.hp = 0;
      hurtPlayer(state, "CORSAIR BREACHED THE LANE");
    }
  }

  stepShots(state, dt, contract, (shot, target) => {
    if (shot.friendly === target.friendly) return;
    target.hp -= 1;
    shot.hp = 0;
    if (target.friendly) {
      hurtPlayer(state, "HULL IMPACT");
    } else if (target.hp <= 0) {
      state.progress += 1;
      award(state, contract.reward, "CORSAIR DISPERSED");
      burst(state, target.x, target.y, 18, "sun-fragment");
    }
  });
  if (state.progress >= state.objective) clearStage(state, "SOLAR LANE SECURED");
}

function stepRoadline(
  state: ClassicWorldState,
  input: ClassicWorldInput,
  contract: ClassicRuleContract,
  dt: number,
): void {
  const steering = (Number(input.right) - Number(input.left)) * 360 * contract.tempo;
  state.player.vx += (steering - state.player.vx) * Math.min(1, dt * 7);
  state.player.x = clamp(state.player.x + state.player.vx * dt, 250, 710);
  state.player.energy = clamp(state.player.energy + (input.primary ? 0.23 : -0.08) * dt, 0, 1);
  const roadSpeed = contract.enemySpeed * (1.2 + state.player.energy * 0.55);
  state.progress += roadSpeed * dt / 210;

  if (state.spawnClock * 1_000 >= contract.spawnIntervalMs) {
    state.spawnClock = 0;
    const obstacle = actor(
      state,
      state.gameId === "chromaline-circuit" ? "rival" : "checkpoint-hazard",
      randomRange(state, 300, 660),
      -45,
      22,
      false,
      1,
      0,
    );
    obstacle.vy = roadSpeed * randomRange(state, 0.85, 1.25);
    state.actors.push(obstacle);
  }

  for (const obstacle of state.actors) {
    if (obstacle.hp <= 0) continue;
    obstacle.y += obstacle.vy * dt;
    obstacle.x += Math.sin(obstacle.age * 1.8 + obstacle.id) * 18 * dt;
    obstacle.age += dt;
    if (distance(state.player, obstacle) < 34) {
      obstacle.hp = 0;
      state.player.energy *= 0.35;
      hurtPlayer(state, "CHASSIS IMPACT");
    } else if (obstacle.y > 590) {
      obstacle.hp = 0;
      award(state, Math.round(contract.reward * 0.5), "CLEAN PASS");
    }
  }
  state.actors = state.actors.filter(({ hp, y }) => hp > 0 && y < 640);
  if (state.progress >= state.objective) clearStage(state, "SECTOR COMPLETE");
}

function stepPrismStack(
  state: ClassicWorldState,
  input: ClassicWorldInput,
  contract: ClassicRuleContract,
  dt: number,
  pressedPrimary: boolean,
  pressedSecondary: boolean,
): void {
  const piece = state.piece;
  if (!piece) return;
  if ((input.left || input.right) && state.player.cooldown <= 0) {
    const dx = input.left ? -1 : 1;
    if (pieceFits(state.board, piece, piece.x + dx, piece.y, piece.rotation)) piece.x += dx;
    state.player.cooldown = 0.12;
  }
  if (pressedPrimary) {
    const rotation = (piece.rotation + 1) % 4;
    if (pieceFits(state.board, piece, piece.x, piece.y, rotation)) piece.rotation = rotation;
  }
  if (pressedSecondary) {
    while (pieceFits(state.board, piece, piece.x, piece.y + 1, piece.rotation)) piece.y += 1;
    lockPiece(state, contract);
    return;
  }

  const interval = input.down ? 0.035 : Math.max(0.1, 0.72 / contract.tempo);
  if (state.spawnClock >= interval) {
    state.spawnClock = 0;
    if (pieceFits(state.board, piece, piece.x, piece.y + 1, piece.rotation)) piece.y += 1;
    else lockPiece(state, contract);
  }
}

function stepGlyphCurrent(
  state: ClassicWorldState,
  input: ClassicWorldInput,
  contract: ClassicRuleContract,
  _dt: number,
  pressedPrimary: boolean,
  pressedSecondary: boolean,
): void {
  if (state.player.cooldown <= 0) {
    const dx = Number(input.right) - Number(input.left);
    const dy = Number(input.down) - Number(input.up);
    if (dx !== 0 || dy !== 0) {
      state.cursor.x = clamp(Math.round(state.cursor.x + Math.sign(dx)), 0, 7);
      state.cursor.y = clamp(Math.round(state.cursor.y + Math.sign(dy)), 0, 7);
      state.player.cooldown = 0.11;
    }
  }
  if (pressedPrimary) {
    state.selected = state.selected ? null : { ...state.cursor };
    state.message = state.selected ? "GLYPH HELD" : "SELECTION CLEARED";
  }
  if (pressedSecondary || (pressedPrimary && state.selected && !samePoint(state.selected, state.cursor))) {
    const from = state.selected ?? state.cursor;
    const to = pressedSecondary
      ? { x: Math.min(7, state.cursor.x + 1), y: state.cursor.y }
      : state.cursor;
    if (manhattan(from, to) === 1) {
      swapBoard(state.board, from, to);
      const cleared = clearGlyphMatches(state);
      if (cleared === 0) swapBoard(state.board, from, to);
      else {
        state.progress += cleared;
        award(state, contract.reward * cleared, `${cleared} GLYPHS ALIGNED`);
        refillGlyphBoard(state);
      }
    }
    state.selected = null;
  }
  if (state.progress >= state.objective) clearStage(state, "CURRENT STABILIZED");
}

function stepOrbitFoundry(
  state: ClassicWorldState,
  input: ClassicWorldInput,
  contract: ClassicRuleContract,
  dt: number,
): void {
  const ball = state.player;
  ball.vy += contract.gravity * dt;
  ball.x += ball.vx * dt;
  ball.y += ball.vy * dt;
  if (ball.x < 42 || ball.x > 918) {
    ball.x = clamp(ball.x, 42, 918);
    ball.vx *= -0.92;
  }
  if (ball.y < 38) {
    ball.y = 38;
    ball.vy = Math.abs(ball.vy) * 0.9;
  }

  const bumpers = [
    { x: 330, y: 190, r: 43 },
    { x: 480, y: 135, r: 38 },
    { x: 635, y: 205, r: 46 },
    { x: 480, y: 310, r: 34 },
  ];
  for (const bumper of bumpers) {
    const dx = ball.x - bumper.x;
    const dy = ball.y - bumper.y;
    const length = Math.hypot(dx, dy) || 1;
    if (length < ball.radius + bumper.r) {
      const nx = dx / length;
      const ny = dy / length;
      const speed = Math.max(360, Math.hypot(ball.vx, ball.vy) * 1.04);
      ball.x = bumper.x + nx * (ball.radius + bumper.r + 1);
      ball.y = bumper.y + ny * (ball.radius + bumper.r + 1);
      ball.vx = nx * speed;
      ball.vy = ny * speed;
      award(state, contract.reward, "ORBITAL TARGET");
      burst(state, bumper.x, bumper.y, 10, "orbit-spark");
    }
  }

  const leftFlipper = input.left || input.primary;
  const rightFlipper = input.right || input.secondary;
  if (ball.y > 420 && ball.y < 492) {
    if (leftFlipper && ball.x > 250 && ball.x < 480 && ball.vy > 0) {
      ball.vx = 210;
      ball.vy = -470 * contract.tempo;
    }
    if (rightFlipper && ball.x >= 480 && ball.x < 710 && ball.vy > 0) {
      ball.vx = -210;
      ball.vy = -470 * contract.tempo;
    }
  }
  if (ball.y > CLASSIC_WORLD_HEIGHT - ball.radius) hurtPlayer(state, "STAR CORE DRAINED", () => {
    state.player = { ...playerAt(760, 410), vx: -210, vy: -320, radius: 11 };
  });
  state.progress = state.score;
  if (state.score >= state.objective) clearStage(state, "MULTIBALL FORGE LIT");
}

function stepArena(
  state: ClassicWorldState,
  input: ClassicWorldInput,
  contract: ClassicRuleContract,
  dt: number,
  pressedPrimary: boolean,
): void {
  const speed = 210 * contract.tempo;
  const dx = Number(input.right) - Number(input.left);
  const dy = Number(input.down) - Number(input.up);
  state.player.x = clamp(state.player.x + dx * speed * dt, 40, 920);
  state.player.y = clamp(state.player.y + dy * speed * dt, 90, 470);
  if (dx !== 0) state.player.facing = dx < 0 ? -1 : 1;

  if (state.gameId === "harbor-brawl") {
    if (state.spawnClock * 1_000 >= contract.spawnIntervalMs && state.actors.filter(({ hp }) => hp > 0).length < 4) {
      state.spawnClock = 0;
      const enemy = actor(state, "dock-raider", randomRange(state, 650, 900), randomRange(state, 180, 440), 22, false, 2, 0);
      state.actors.push(enemy);
    }
    for (const enemy of state.actors) {
      if (enemy.hp <= 0) continue;
      const dxEnemy = state.player.x - enemy.x;
      const dyEnemy = state.player.y - enemy.y;
      const length = Math.hypot(dxEnemy, dyEnemy) || 1;
      enemy.x += (dxEnemy / length) * contract.enemySpeed * 0.45 * dt;
      enemy.y += (dyEnemy / length) * contract.enemySpeed * 0.34 * dt;
      if (pressedPrimary && length < 86) {
        enemy.hp -= 1;
        burst(state, enemy.x, enemy.y, 7, "impact");
        if (enemy.hp <= 0) {
          state.progress += 1;
          award(state, contract.reward, "RAIDER DISARMED");
        }
      } else if (length < 34 && enemy.timer <= 0) {
        enemy.timer = 1.1;
        hurtPlayer(state, "HARBOR IMPACT");
      }
      enemy.timer = Math.max(0, enemy.timer - dt);
    }
    if (state.progress >= state.objective) clearStage(state, "PIER SECURED");
    return;
  }

  const ball = state.actors.find(({ kind }) => kind === "ball");
  if (!ball) return;
  ball.x += ball.vx * dt;
  ball.y += ball.vy * dt;
  ball.vx *= Math.pow(0.992, dt * 60);
  ball.vy *= Math.pow(0.992, dt * 60);
  if (ball.y < 72 || ball.y > 468) ball.vy *= -0.9;
  ball.y = clamp(ball.y, 72, 468);
  const opponent = state.actors.find(({ kind }) => kind === "striker-opponent") ?? actor(state, "striker-opponent", 710, 270, 24, false, 1, 0);
  if (!state.actors.includes(opponent)) state.actors.push(opponent);
  opponent.x += Math.sign(ball.x - opponent.x) * contract.enemySpeed * 0.45 * dt;
  opponent.y += Math.sign(ball.y - opponent.y) * contract.enemySpeed * 0.38 * dt;
  if (distance(opponent, ball) < 38) {
    ball.vx = -360 * contract.tempo;
    ball.vy += (ball.y - opponent.y) * 4;
  }
  if (pressedPrimary && distance(state.player, ball) < 54) {
    ball.vx = 480 * contract.tempo;
    ball.vy = dy * 170;
    state.message = "CHARGED STRIKE";
  }
  if (ball.x > 946 && ball.y > 205 && ball.y < 335) {
    state.progress += 1;
    award(state, contract.reward * 5, "GOAL CIRCUIT CLOSED");
    ball.x = 480;
    ball.y = 270;
    ball.vx = 0;
    ball.vy = 0;
  } else if (ball.x < 14 && ball.y > 205 && ball.y < 335) {
    hurtPlayer(state, "OPPONENT SCORED");
    ball.x = 480;
    ball.y = 270;
    ball.vx = 0;
    ball.vy = 0;
  }
  if (state.progress >= state.objective) clearStage(state, "MATCH WON");
}

function stepTargetStage(
  state: ClassicWorldState,
  input: ClassicWorldInput,
  contract: ClassicRuleContract,
  dt: number,
  pressedPrimary: boolean,
): void {
  const speed = 330 * contract.tempo;
  if (input.pointerActive && input.pointerX !== undefined && input.pointerY !== undefined) {
    state.player.x = clamp(input.pointerX, 24, 936);
    state.player.y = clamp(input.pointerY, 62, 516);
  } else {
    state.player.x = clamp(state.player.x + (Number(input.right) - Number(input.left)) * speed * dt, 24, 936);
    state.player.y = clamp(state.player.y + (Number(input.down) - Number(input.up)) * speed * dt, 62, 516);
  }
  if (state.spawnClock * 1_000 >= contract.spawnIntervalMs && state.actors.filter(({ hp }) => hp > 0).length < 5) {
    state.spawnClock = 0;
    const friendly = random(state) < 0.24;
    const target = actor(state, friendly ? "friendly-signal" : "anomaly", randomRange(state, 80, 880), randomRange(state, 100, 470), randomRange(state, 23, 38), friendly, 1, 0);
    target.timer = randomRange(state, 0.55, 1.05) / contract.tempo;
    state.actors.push(target);
  }
  for (const target of state.actors) {
    target.age += dt;
    target.timer -= dt;
    if (target.timer <= 0 && target.hp > 0) {
      target.hp = 0;
      if (!target.friendly) {
        state.streak = 0;
        state.message = "ANOMALY EXPIRED";
      }
    }
  }
  if (pressedPrimary) {
    const target = [...state.actors]
      .filter(({ hp }) => hp > 0)
      .sort((a, b) => distance(state.player, a) - distance(state.player, b))[0];
    if (target && distance(state.player, target) <= target.radius + 18) {
      target.hp = 0;
      if (target.friendly) {
        state.streak = 0;
        state.score = Math.max(0, state.score - contract.reward);
        state.message = "FRIENDLY SIGNAL — HOLD FIRE";
      } else {
        state.progress += 1;
        award(state, contract.reward, "ANOMALY CLEANSED");
        burst(state, target.x, target.y, 16, "bloom");
      }
    } else {
      state.streak = 0;
      state.message = "MISS";
    }
  }
  state.actors = state.actors.filter(({ hp }) => hp > 0);
  if (state.progress >= state.objective) clearStage(state, "SIGNAL GARDEN PURE");
}

function stepTileWorld(
  state: ClassicWorldState,
  input: ClassicWorldInput,
  contract: ClassicRuleContract,
  dt: number,
  pressedPrimary: boolean,
  pressedSecondary: boolean,
): void {
  if (state.gameId === "neon-coil") {
    stepNeonCoil(state, input, contract, dt);
    return;
  }
  const gridWidth = state.board[0]?.length ?? 15;
  const gridHeight = state.board.length || 9;
  if (state.player.cooldown <= 0) {
    const dx = Number(input.right) - Number(input.left);
    const dy = Number(input.down) - Number(input.up);
    if (dx !== 0 || dy !== 0) {
      const direction = Math.abs(dx) >= Math.abs(dy)
        ? { x: Math.sign(dx), y: 0 }
        : { x: 0, y: Math.sign(dy) };
      state.direction = direction;
      tryGridMove(state, direction.x, direction.y);
      state.player.cooldown = Math.max(0.07, 0.13 / contract.tempo);
    }
  }

  if (pressedPrimary) {
    if (state.gameId === "bastion-treads") fireGridPulse(state, contract);
    else if (state.gameId === "sparkcell-siege") placeSparkBomb(state);
    else attackAdjacentGridActor(state, contract);
  }
  if (pressedSecondary && state.gameId === "vault-cartographer") {
    state.message = "ROUTE ANCHOR SAVED";
  }

  if (state.gameId === "sparkcell-siege") stepBombs(state, contract, dt);
  stepGridActors(state, contract, dt, gridWidth, gridHeight);
  collectGridCell(state, contract);

  if (state.gameId === "vault-cartographer") {
    const targets = countCells(state.board, 5);
    const crates = state.actors.filter(({ kind, hp }) => kind === "crate" && hp > 0);
    const aligned = crates.filter((crate) => state.board[Math.round(crate.y)]?.[Math.round(crate.x)] === 5).length;
    state.progress = aligned;
    if (targets > 0 && aligned >= targets) clearStage(state, "VAULT ROUTE COMPLETE");
  } else if (state.gameId === "lumen-labyrinth") {
    if (countCells(state.board, 2) === 0) clearStage(state, "LABYRINTH ILLUMINATED");
  } else if (state.gameId === "bastion-treads" || state.gameId === "sparkcell-siege") {
    if (state.progress >= state.objective) clearStage(state, "GRID SECURED");
  } else if (state.progress >= state.objective) {
    clearStage(state, "RELIC GATE UNLOCKED");
  }
}

function initialiseTileWorld(state: ClassicWorldState): void {
  const width = 15;
  const height = 9;
  state.board = createBoard(width, height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (x === 0 || y === 0 || x === width - 1 || y === height - 1) state.board[y]![x] = 1;
      else if ((x * 7 + y * 11 + state.stage) % 13 === 0) state.board[y]![x] = 1;
    }
  }
  state.player = playerAt(1, 1);
  state.player.radius = 0.34;
  state.objective = state.gameId === "lumen-labyrinth" ? 0 : state.gameId === "vault-cartographer" ? 3 : 6;

  if (state.gameId === "vault-cartographer") {
    for (const point of [{ x: 5, y: 2 }, { x: 9, y: 4 }, { x: 12, y: 7 }]) state.board[point.y]![point.x] = 5;
    state.actors = [
      actor(state, "crate", 4, 2, 0.38, true, 1, 0),
      actor(state, "crate", 8, 4, 0.38, true, 1, 0),
      actor(state, "crate", 11, 7, 0.38, true, 1, 0),
    ];
    return;
  }

  const collectibleCount = state.gameId === "lumen-labyrinth" ? 34 : 7;
  for (let index = 0; index < collectibleCount; index += 1) {
    const point = randomOpenCell(state);
    state.board[point.y]![point.x] = 2;
  }
  const enemyCount = state.gameId === "emberglass-atlas" ? 5 : state.gameId === "lumen-labyrinth" ? 3 : 6;
  for (let index = 0; index < enemyCount; index += 1) {
    const point = randomOpenCell(state);
    state.actors.push(actor(state, state.gameId === "bastion-treads" ? "tread" : "grid-hunter", point.x, point.y, 0.34, false, 1, 0));
  }
}

function stepNeonCoil(
  state: ClassicWorldState,
  input: ClassicWorldInput,
  contract: ClassicRuleContract,
  _dt: number,
): void {
  const requested = input.left ? { x: -1, y: 0 }
    : input.right ? { x: 1, y: 0 }
      : input.up ? { x: 0, y: -1 }
        : input.down ? { x: 0, y: 1 }
          : null;
  if (requested && !(requested.x === -state.direction.x && requested.y === -state.direction.y)) {
    state.queuedDirection = requested;
  }
  const interval = Math.max(0.065, 0.14 / contract.tempo);
  if (state.spawnClock < interval) return;
  state.spawnClock = 0;
  state.direction = { ...state.queuedDirection };
  const nextHead = {
    x: Math.round(state.player.x + state.direction.x),
    y: Math.round(state.player.y + state.direction.y),
  };
  const hitWall = state.board[nextHead.y]?.[nextHead.x] === 1;
  const hitTrail = state.trail.some((point) => samePoint(point, nextHead));
  if (hitWall || hitTrail) {
    hurtPlayer(state, "COIL INTERRUPTED", () => {
      state.player.x = 2;
      state.player.y = 2;
      state.trail = [];
      state.direction = { x: 1, y: 0 };
      state.queuedDirection = { x: 1, y: 0 };
    });
    return;
  }
  state.trail.unshift({ x: Math.round(state.player.x), y: Math.round(state.player.y) });
  state.player.x = nextHead.x;
  state.player.y = nextHead.y;
  if (state.board[nextHead.y]?.[nextHead.x] === 2) {
    state.board[nextHead.y]![nextHead.x] = 0;
    state.progress += 1;
    award(state, contract.reward, "DATA NODE ABSORBED");
    const point = randomOpenCell(state);
    state.board[point.y]![point.x] = 2;
  } else {
    const length = 4 + Math.min(18, state.progress);
    if (state.trail.length > length) state.trail.length = length;
  }
  if (state.progress >= 9 + state.stage * 2) clearStage(state, "COIL STABLE");
}

function tryGridMove(state: ClassicWorldState, dx: number, dy: number): void {
  const x = Math.round(state.player.x + dx);
  const y = Math.round(state.player.y + dy);
  const cell = state.board[y]?.[x];
  if (cell === undefined || cell === 1) return;
  if (state.gameId === "vault-cartographer") {
    const crate = state.actors.find(({ kind, hp, x: crateX, y: crateY }) =>
      kind === "crate" && hp > 0 && Math.round(crateX) === x && Math.round(crateY) === y,
    );
    if (crate) {
      const nextX = x + dx;
      const nextY = y + dy;
      const blocked = state.board[nextY]?.[nextX] === 1 || state.actors.some(({ kind, hp, x: actorX, y: actorY }) =>
        kind === "crate" && hp > 0 && Math.round(actorX) === nextX && Math.round(actorY) === nextY,
      );
      if (blocked) return;
      crate.x = nextX;
      crate.y = nextY;
    }
  }
  state.player.x = x;
  state.player.y = y;
}

function collectGridCell(state: ClassicWorldState, contract: ClassicRuleContract): void {
  const x = Math.round(state.player.x);
  const y = Math.round(state.player.y);
  if (state.board[y]?.[x] !== 2) return;
  state.board[y]![x] = 0;
  state.progress += 1;
  award(state, contract.reward, "LUMEN COLLECTED");
}

function fireGridPulse(state: ClassicWorldState, contract: ClassicRuleContract): void {
  const shot = actor(state, "grid-pulse", state.player.x, state.player.y, 0.16, true, 1, contract.reward);
  shot.vx = state.direction.x * 8;
  shot.vy = state.direction.y * 8;
  state.shots.push(shot);
}

function placeSparkBomb(state: ClassicWorldState): void {
  if (state.actors.some(({ kind, hp }) => kind === "spark-bomb" && hp > 0)) return;
  const bomb = actor(state, "spark-bomb", Math.round(state.player.x), Math.round(state.player.y), 0.3, true, 1, 0);
  bomb.timer = 1.8;
  state.actors.push(bomb);
  state.message = "SPARKCELL ARMED";
}

function attackAdjacentGridActor(state: ClassicWorldState, contract: ClassicRuleContract): void {
  const targetX = Math.round(state.player.x + state.direction.x);
  const targetY = Math.round(state.player.y + state.direction.y);
  const target = state.actors.find(({ friendly, hp, x, y }) =>
    !friendly && hp > 0 && Math.round(x) === targetX && Math.round(y) === targetY,
  );
  if (target) {
    target.hp = 0;
    state.progress += 1;
    award(state, contract.reward, "WARDEN DISPERSED");
  }
}

function stepGridActors(
  state: ClassicWorldState,
  contract: ClassicRuleContract,
  dt: number,
  width: number,
  height: number,
): void {
  for (const shot of state.shots) {
    if (shot.hp <= 0) continue;
    shot.x += shot.vx * dt;
    shot.y += shot.vy * dt;
    const cell = state.board[Math.round(shot.y)]?.[Math.round(shot.x)];
    if (cell === undefined || cell === 1) shot.hp = 0;
    const enemy = state.actors.find(({ friendly, hp, x, y, kind }) =>
      !friendly && kind !== "spark-bomb" && hp > 0 && Math.hypot(x - shot.x, y - shot.y) < 0.52,
    );
    if (enemy) {
      enemy.hp = 0;
      shot.hp = 0;
      state.progress += 1;
      award(state, contract.reward, "TREAD DISABLED");
    }
  }
  state.shots = state.shots.filter(({ hp }) => hp > 0);

  if (state.tick % Math.max(8, Math.round(24 / contract.tempo)) !== 0) return;
  for (const enemy of state.actors) {
    if (enemy.hp <= 0 || enemy.friendly || enemy.kind === "spark-bomb" || enemy.kind === "crate") continue;
    const dx = Math.sign(state.player.x - enemy.x);
    const dy = Math.sign(state.player.y - enemy.y);
    const horizontal = random(state) > 0.42;
    const nextX = clamp(Math.round(enemy.x + (horizontal ? dx : 0)), 1, width - 2);
    const nextY = clamp(Math.round(enemy.y + (horizontal ? 0 : dy)), 1, height - 2);
    if (state.board[nextY]?.[nextX] !== 1) {
      enemy.x = nextX;
      enemy.y = nextY;
    }
    if (distance(enemy, state.player) < 0.7) hurtPlayer(state, "GRID CONTACT");
  }
}

function stepBombs(state: ClassicWorldState, contract: ClassicRuleContract, dt: number): void {
  for (const bomb of state.actors) {
    if (bomb.kind !== "spark-bomb" || bomb.hp <= 0) continue;
    bomb.timer -= dt;
    if (bomb.timer > 0) continue;
    bomb.hp = 0;
    const cells = [
      { x: bomb.x, y: bomb.y },
      { x: bomb.x - 1, y: bomb.y },
      { x: bomb.x + 1, y: bomb.y },
      { x: bomb.x, y: bomb.y - 1 },
      { x: bomb.x, y: bomb.y + 1 },
    ];
    for (const point of cells) {
      const enemy = state.actors.find(({ friendly, hp, x, y, kind }) =>
        !friendly && kind !== "spark-bomb" && hp > 0 && Math.round(x) === point.x && Math.round(y) === point.y,
      );
      if (enemy) {
        enemy.hp = 0;
        state.progress += 1;
        award(state, contract.reward, "CHAIN CELL CLEARED");
      }
    }
    state.particles.push(...cells.map((point) => ({
      ...actor(state, "grid-flame", point.x, point.y, 0.38, true, 1, 0),
      timer: 0.32,
    })));
  }
}

function stepParticles(state: ClassicWorldState, dt: number): void {
  for (const particle of state.particles) {
    particle.age += dt;
    particle.timer -= dt;
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.vy += 70 * dt;
  }
  state.particles = state.particles.filter(({ timer }) => timer > 0);
  state.actors = state.actors.filter(({ hp }) => hp > 0);
  state.shots = state.shots.filter(({ hp }) => hp > 0);
}

function stepShots(
  state: ClassicWorldState,
  dt: number,
  _contract: ClassicRuleContract,
  onHit: (shot: ClassicActor, target: ClassicActor) => void,
): void {
  for (const shot of state.shots) {
    if (shot.hp <= 0) continue;
    shot.x += shot.vx * dt;
    shot.y += shot.vy * dt;
    shot.age += dt;
    if (!shot.friendly && distance(shot, state.player) < shot.radius + state.player.radius * 0.5) {
      shot.hp = 0;
      hurtPlayer(state, "PROJECTILE IMPACT");
      continue;
    }
    for (const target of state.actors) {
      if (target.hp > 0 && distance(shot, target) < shot.radius + target.radius) onHit(shot, target);
    }
    if (shot.x < -80 || shot.x > 1_040 || shot.y < -80 || shot.y > 620) shot.hp = 0;
  }
}

function spawnSideEnemy(state: ClassicWorldState, contract: ClassicRuleContract, _dt: number): void {
  if (state.spawnClock * 1_000 < contract.spawnIntervalMs) return;
  state.spawnClock = 0;
  const enemy = actor(state, "turret", 980, 430, 19, false, 2, 0);
  enemy.vx = -contract.enemySpeed * 0.72;
  state.actors.push(enemy);
}

function lockPiece(state: ClassicWorldState, contract: ClassicRuleContract): void {
  const piece = state.piece;
  if (!piece) return;
  for (const cell of rotatedCells(piece)) {
    const x = piece.x + cell.x;
    const y = piece.y + cell.y;
    if (state.board[y]?.[x] !== undefined) state.board[y]![x] = piece.color;
  }
  let cleared = 0;
  for (let y = state.board.length - 1; y >= 0; y -= 1) {
    if (state.board[y]!.every((cell) => cell > 0)) {
      state.board.splice(y, 1);
      state.board.unshift(Array.from({ length: 10 }, () => 0));
      cleared += 1;
      y += 1;
    }
  }
  if (cleared > 0) {
    state.progress += cleared;
    award(state, contract.reward * cleared * cleared, `${cleared} PRISM CIRCUIT${cleared > 1 ? "S" : ""}`);
  }
  state.piece = nextShardPiece(state);
  if (!pieceFits(state.board, state.piece, state.piece.x, state.piece.y, state.piece.rotation)) {
    hurtPlayer(state, "PRISM STACK SATURATED", () => {
      state.board = createBoard(10, 16);
      state.piece = nextShardPiece(state);
    });
  }
  if (state.progress >= state.objective) clearStage(state, "PRISM MATRIX BALANCED");
}

function nextShardPiece(state: ClassicWorldState): ClassicPiece {
  const shapes: readonly (readonly ClassicPoint[])[] = [
    [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }],
    [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: -1, y: 0 }],
    [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }],
    [{ x: 0, y: 0 }, { x: 0, y: 1 }],
  ];
  const shape = shapes[Math.floor(random(state) * shapes.length)]!;
  return { cells: shape.map((cell) => ({ ...cell })), x: 5, y: 0, color: 1 + Math.floor(random(state) * 4), rotation: 0 };
}

function rotatedCells(piece: ClassicPiece): ClassicPoint[] {
  return piece.cells.map((cell) => {
    let x = cell.x;
    let y = cell.y;
    for (let turn = 0; turn < piece.rotation; turn += 1) [x, y] = [-y, x];
    return { x, y };
  });
}

function pieceFits(board: readonly (readonly number[])[], piece: ClassicPiece, x: number, y: number, rotation: number): boolean {
  const rotated = { ...piece, rotation };
  return rotatedCells(rotated).every((cell) => {
    const boardX = x + cell.x;
    const boardY = y + cell.y;
    return boardX >= 0 && boardX < 10 && boardY >= 0 && boardY < 16 && board[boardY]?.[boardX] === 0;
  });
}

function createGlyphBoard(state: ClassicWorldState, width: number, height: number): number[][] {
  const board = createBoard(width, height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let value = 1 + Math.floor(random(state) * 5);
      while ((x >= 2 && board[y]![x - 1] === value && board[y]![x - 2] === value) ||
        (y >= 2 && board[y - 1]![x] === value && board[y - 2]![x] === value)) {
        value = 1 + (value % 5);
      }
      board[y]![x] = value;
    }
  }
  return board;
}

function clearGlyphMatches(state: ClassicWorldState): number {
  const marked = new Set<string>();
  for (let y = 0; y < 8; y += 1) {
    for (let x = 0; x < 8; x += 1) {
      const value = state.board[y]![x];
      if (x <= 5 && value === state.board[y]![x + 1] && value === state.board[y]![x + 2]) {
        marked.add(`${x},${y}`); marked.add(`${x + 1},${y}`); marked.add(`${x + 2},${y}`);
      }
      if (y <= 5 && value === state.board[y + 1]![x] && value === state.board[y + 2]![x]) {
        marked.add(`${x},${y}`); marked.add(`${x},${y + 1}`); marked.add(`${x},${y + 2}`);
      }
    }
  }
  for (const key of marked) {
    const [x, y] = key.split(",").map(Number) as [number, number];
    state.board[y]![x] = 0;
  }
  return marked.size;
}

function refillGlyphBoard(state: ClassicWorldState): void {
  for (let x = 0; x < 8; x += 1) {
    const values = state.board.map((row) => row[x]).filter((value) => value !== 0) as number[];
    while (values.length < 8) values.unshift(1 + Math.floor(random(state) * 5));
    for (let y = 0; y < 8; y += 1) state.board[y]![x] = values[y]!;
  }
}

function clearStage(state: ClassicWorldState, message: string): void {
  state.status = state.stage >= 3 ? "won" : "stage-clear";
  state.message = state.stage >= 3 ? `${message} · WORLD COMPLETE` : message;
  burst(state, CLASSIC_WORLD_WIDTH / 2, CLASSIC_WORLD_HEIGHT / 2, 36, "victory");
}

function hurtPlayer(state: ClassicWorldState, message: string, reset?: () => void): void {
  if (state.status !== "running") return;
  state.lives -= 1;
  state.streak = 0;
  state.message = message;
  burst(state, scaleGridX(state.player.x, state), scaleGridY(state.player.y, state), 16, "damage");
  reset?.();
  if (state.lives <= 0) {
    state.lives = 0;
    state.status = "game-over";
    state.message = `${message} · LINK LOST`;
  }
}

function award(state: ClassicWorldState, value: number, message: string): void {
  state.streak += 1;
  state.score += Math.max(1, Math.round(value * (1 + Math.min(12, state.streak) * 0.08)));
  state.message = message;
}

function burst(state: ClassicWorldState, x: number, y: number, count: number, kind: string): void {
  for (let index = 0; index < count; index += 1) {
    const angle = random(state) * Math.PI * 2;
    const speed = randomRange(state, 45, 190);
    const particle = actor(state, kind, x, y, randomRange(state, 2, 6), true, 1, 0);
    particle.vx = Math.cos(angle) * speed;
    particle.vy = Math.sin(angle) * speed;
    particle.timer = randomRange(state, 0.32, 0.78);
    state.particles.push(particle);
  }
}

function actor(
  state: ClassicWorldState,
  kind: string,
  x: number,
  y: number,
  radius: number,
  friendly: boolean,
  hp: number,
  value: number,
): ClassicActor {
  return { id: state.nextActorId++, kind, x, y, vx: 0, vy: 0, radius, hp, age: 0, timer: 0, value, friendly };
}

function playerAt(x: number, y: number): ClassicPlayer {
  return { x, y, vx: 0, vy: 0, angle: 0, radius: 20, energy: 0.45, cooldown: 0, grounded: false, facing: 1 };
}

function createBoard(width: number, height: number): number[][] {
  return Array.from({ length: height }, () => Array.from({ length: width }, () => 0));
}

function randomOpenCell(state: ClassicWorldState): ClassicPoint {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const y = 1 + Math.floor(random(state) * Math.max(1, state.board.length - 2));
    const x = 1 + Math.floor(random(state) * Math.max(1, (state.board[0]?.length ?? 3) - 2));
    if (state.board[y]?.[x] === 0 && !(Math.round(state.player.x) === x && Math.round(state.player.y) === y)) return { x, y };
  }
  return { x: 2, y: 2 };
}

function random(state: ClassicWorldState): number {
  let value = state.rng >>> 0;
  value ^= value << 13;
  value ^= value >>> 17;
  value ^= value << 5;
  state.rng = value >>> 0;
  return state.rng / 0x1_0000_0000;
}

function randomRange(state: ClassicWorldState, minimum: number, maximum: number): number {
  return minimum + random(state) * (maximum - minimum);
}

function normalizeSeed(seed: number): number {
  const normalized = Math.trunc(seed) >>> 0;
  return normalized || 0x6d2b_79f5;
}

function seedForGame(gameId: string): number {
  let hash = 0x811c_9dc5;
  for (const character of gameId) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 0x0100_0193);
  }
  return normalizeSeed(hash);
}

function cloneState(state: ClassicWorldState): ClassicWorldState {
  return {
    ...state,
    player: { ...state.player },
    actors: state.actors.map((value) => ({ ...value })),
    shots: state.shots.map((value) => ({ ...value })),
    particles: state.particles.map((value) => ({ ...value })),
    trail: state.trail.map((value) => ({ ...value })),
    board: state.board.map((row) => [...row]),
    piece: state.piece ? { ...state.piece, cells: state.piece.cells.map((value) => ({ ...value })) } : null,
    cursor: { ...state.cursor },
    selected: state.selected ? { ...state.selected } : null,
    direction: { ...state.direction },
    queuedDirection: { ...state.queuedDirection },
    inputLatch: { ...state.inputLatch },
  };
}

function validateFiniteState(state: ClassicWorldState): void {
  const values = [
    state.tick,
    state.stage,
    state.score,
    state.lives,
    state.streak,
    state.progress,
    state.clock,
    state.player.x,
    state.player.y,
    state.player.vx,
    state.player.vy,
    ...state.actors.flatMap(({ x, y, vx, vy }) => [x, y, vx, vy]),
    ...state.shots.flatMap(({ x, y, vx, vy }) => [x, y, vx, vy]),
  ];
  if (values.some((value) => !Number.isFinite(value))) throw new Error("Classic World state contains a non-finite number.");
  if (!Number.isSafeInteger(state.tick) || state.tick < 0) throw new Error("Classic World tick is invalid.");
  if (state.actors.length > 512 || state.shots.length > 512 || state.particles.length > 2_048) {
    throw new Error("Classic World entity budget exceeded.");
  }
}

function platformHeightAt(x: number, gameId: ArcadeClassicGameId): number {
  if (gameId === "moonthread-ronin") return x > 720 ? 150 : x > 520 ? 90 : x > 300 ? 45 : 0;
  if (x > 700 && x < 820) return 120;
  if (x > 430 && x < 570) return 70;
  if (x > 230 && x < 345) return 36;
  return 0;
}

function countCells(board: readonly (readonly number[])[], value: number): number {
  return board.reduce((count, row) => count + row.filter((cell) => cell === value).length, 0);
}

function swapBoard(board: number[][], first: ClassicPoint, second: ClassicPoint): void {
  const value = board[first.y]![first.x]!;
  board[first.y]![first.x] = board[second.y]![second.x]!;
  board[second.y]![second.x] = value;
}

function distance(first: ClassicPoint, second: ClassicPoint): number {
  return Math.hypot(first.x - second.x, first.y - second.y);
}

function manhattan(first: ClassicPoint, second: ClassicPoint): number {
  return Math.abs(first.x - second.x) + Math.abs(first.y - second.y);
}

function samePoint(first: ClassicPoint, second: ClassicPoint): boolean {
  return first.x === second.x && first.y === second.y;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function scaleGridX(value: number, state: ClassicWorldState): number {
  return state.engineFamily === "grid-field" ? 64 + value * 56 : value;
}

function scaleGridY(value: number, state: ClassicWorldState): number {
  return state.engineFamily === "grid-field" ? 36 + value * 52 : value;
}
