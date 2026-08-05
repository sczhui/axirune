import type { ClassicRuleContract } from "../classic-rule-contract.js";
import {
  CLASSIC_WORLD_HEIGHT,
  CLASSIC_WORLD_WIDTH,
  type ClassicActor,
  type ClassicPoint,
  type ClassicWorldState,
} from "./micro-engine.js";

const PALETTES = {
  forge: ["#07100d", "#10251f", "#e7973f", "#bdf765"],
  solar: ["#06111b", "#123752", "#ffbd55", "#71eff1"],
  moon: ["#080b1c", "#1c2852", "#b6c9ff", "#ff786b"],
  circuit: ["#050a0c", "#10251e", "#bdf765", "#64e9f4"],
  prism: ["#080718", "#20184b", "#72efff", "#d7ff70"],
  harbor: ["#06131a", "#174252", "#e7a64e", "#75edf2"],
} as const;

export function renderClassicWorld(
  context: CanvasRenderingContext2D,
  state: ClassicWorldState,
  contract: ClassicRuleContract,
  nowSeconds: number,
): void {
  context.save();
  context.clearRect(0, 0, CLASSIC_WORLD_WIDTH, CLASSIC_WORLD_HEIGHT);
  switch (state.gameId) {
    case "aetherstep-foundry":
    case "moonthread-ronin":
    case "alloy-tempest":
      renderSideMotion(context, state, nowSeconds);
      break;
    case "sunwake-corsairs":
      renderSunwake(context, state, nowSeconds);
      break;
    case "chromaline-circuit":
    case "dustcoil-courier":
      renderRoad(context, state, nowSeconds);
      break;
    case "prism-stack":
      renderPrismStack(context, state, nowSeconds);
      break;
    case "glyph-current":
      renderGlyphCurrent(context, state, nowSeconds);
      break;
    case "orbit-foundry":
      renderOrbitFoundry(context, state, nowSeconds, contract);
      break;
    case "harbor-brawl":
    case "circuit-strikers":
      renderArena(context, state, nowSeconds);
      break;
    case "signal-bloom":
      renderSignalBloom(context, state, nowSeconds);
      break;
    default:
      renderTileWorld(context, state, nowSeconds);
  }
  renderParticles(context, state);
  renderAtmosphere(context, contract, nowSeconds);
  context.restore();
}

function renderSideMotion(
  context: CanvasRenderingContext2D,
  state: ClassicWorldState,
  now: number,
): void {
  const palette = state.gameId === "moonthread-ronin" ? PALETTES.moon
    : state.gameId === "alloy-tempest" ? PALETTES.solar
      : PALETTES.forge;
  const sky = context.createLinearGradient(0, 0, 0, CLASSIC_WORLD_HEIGHT);
  sky.addColorStop(0, palette[0]);
  sky.addColorStop(0.58, palette[1]);
  sky.addColorStop(1, "#020504");
  context.fillStyle = sky;
  context.fillRect(0, 0, CLASSIC_WORLD_WIDTH, CLASSIC_WORLD_HEIGHT);

  context.globalAlpha = 0.28;
  for (let layer = 0; layer < 4; layer += 1) {
    const offset = (now * (8 + layer * 6)) % 170;
    context.fillStyle = layer % 2 === 0 ? palette[2] : palette[3];
    for (let index = -1; index < 8; index += 1) {
      const x = index * 170 - offset + layer * 32;
      const height = 105 + ((index * 47 + layer * 61) % 170);
      context.fillRect(x, 390 - height, 80 - layer * 7, height);
      context.fillRect(x + 18, 375 - height, 12, 18);
    }
  }
  context.globalAlpha = 1;

  if (state.gameId === "aetherstep-foundry") {
    drawHeatChannels(context, now);
  } else if (state.gameId === "moonthread-ronin") {
    drawMoonThreads(context, now);
  } else {
    drawStormBands(context, now);
  }

  drawPlatforms(context, state);
  for (const actor of state.actors) {
    if (actor.kind === "relic") drawRelic(context, actor, now);
    else drawEnemyConstruct(context, actor, palette[2], now);
  }
  for (const shot of state.shots) drawProjectile(context, shot, palette[3]);
  drawConstruct(context, state.player, palette[3], palette[2], state.gameId === "moonthread-ronin" ? "blade" : "runner", now);
}

function drawHeatChannels(context: CanvasRenderingContext2D, now: number): void {
  const glow = context.createLinearGradient(0, 440, 0, 530);
  glow.addColorStop(0, "rgba(255,142,55,0.05)");
  glow.addColorStop(1, "rgba(255,106,39,0.72)");
  context.fillStyle = glow;
  context.fillRect(0, 440, CLASSIC_WORLD_WIDTH, 100);
  context.strokeStyle = "rgba(255,210,90,0.6)";
  context.lineWidth = 3;
  for (let index = 0; index < 10; index += 1) {
    const y = 485 + Math.sin(now * 2.1 + index) * 12;
    context.beginPath();
    context.moveTo(index * 110 - 70, y);
    context.bezierCurveTo(index * 110, y - 22, index * 110 + 40, y + 18, index * 110 + 120, y - 8);
    context.stroke();
  }
}

function drawMoonThreads(context: CanvasRenderingContext2D, now: number): void {
  context.strokeStyle = "rgba(176,205,255,0.32)";
  context.lineWidth = 1.5;
  for (let index = 0; index < 13; index += 1) {
    context.beginPath();
    context.moveTo(-40, 80 + index * 29);
    context.bezierCurveTo(260, 30 + index * 36, 620, 150 + Math.sin(now + index) * 16, 1_000, 45 + index * 30);
    context.stroke();
  }
  const moon = context.createRadialGradient(780, 100, 10, 780, 100, 84);
  moon.addColorStop(0, "rgba(231,239,255,0.96)");
  moon.addColorStop(0.2, "rgba(183,204,255,0.42)");
  moon.addColorStop(1, "rgba(90,115,190,0)");
  context.fillStyle = moon;
  context.beginPath(); context.arc(780, 100, 84, 0, Math.PI * 2); context.fill();
}

function drawStormBands(context: CanvasRenderingContext2D, now: number): void {
  context.save();
  context.translate(480, 220);
  for (let index = 0; index < 9; index += 1) {
    context.rotate(0.21);
    context.strokeStyle = index % 2 ? "rgba(99,232,244,0.16)" : "rgba(255,145,63,0.18)";
    context.lineWidth = 8 - index * 0.55;
    context.beginPath(); context.arc(0, 0, 95 + index * 34 + Math.sin(now + index) * 4, 0.2, 3.8); context.stroke();
  }
  context.restore();
}

function drawPlatforms(context: CanvasRenderingContext2D, state: ClassicWorldState): void {
  const segments: readonly (readonly [number, number, number])[] = state.gameId === "moonthread-ronin"
    ? [[0, 460, 300], [300, 415, 220], [520, 370, 200], [720, 310, 240]]
    : [[0, 460, 230], [230, 424, 115], [345, 460, 85], [430, 390, 140], [570, 460, 130], [700, 340, 120], [820, 460, 140]];
  for (const [x, y, width] of segments) {
    const gradient = context.createLinearGradient(0, y, 0, y + 34);
    gradient.addColorStop(0, "#d5e9ae");
    gradient.addColorStop(0.08, "#638f64");
    gradient.addColorStop(1, "#142c27");
    context.fillStyle = gradient;
    roundRect(context, x, y, width, 34, 5);
    context.fill();
    context.strokeStyle = "rgba(200,255,188,0.28)";
    context.stroke();
  }
}

function renderSunwake(context: CanvasRenderingContext2D, state: ClassicWorldState, now: number): void {
  const sky = context.createLinearGradient(0, 0, CLASSIC_WORLD_WIDTH, CLASSIC_WORLD_HEIGHT);
  sky.addColorStop(0, "#061824");
  sky.addColorStop(0.56, "#15556b");
  sky.addColorStop(1, "#ff9c47");
  context.fillStyle = sky;
  context.fillRect(0, 0, CLASSIC_WORLD_WIDTH, CLASSIC_WORLD_HEIGHT);
  for (let layer = 0; layer < 5; layer += 1) {
    context.fillStyle = `rgba(255,225,167,${0.045 + layer * 0.018})`;
    for (let index = 0; index < 7; index += 1) {
      const x = ((index * 190 - now * (13 + layer * 9) + layer * 57) % 1_250) - 140;
      const y = 80 + layer * 85 + Math.sin(index + layer) * 30;
      context.beginPath(); context.ellipse(x, y, 110, 29, 0, 0, Math.PI * 2); context.fill();
    }
  }
  drawSolarCraft(context, state.player.x, state.player.y, true, now);
  for (const enemy of state.actors) drawSolarCraft(context, enemy.x, enemy.y, false, now + enemy.id);
  for (const shot of state.shots) drawProjectile(context, shot, shot.friendly ? "#f7e876" : "#ff735f");
}

function drawSolarCraft(context: CanvasRenderingContext2D, x: number, y: number, friendly: boolean, now: number): void {
  context.save(); context.translate(x, y); if (!friendly) context.scale(-1, 1);
  context.shadowColor = friendly ? "#76eff4" : "#ff805e"; context.shadowBlur = 18;
  context.fillStyle = friendly ? "#d9fff1" : "#ffe0b4";
  context.beginPath(); context.moveTo(30, 0); context.lineTo(-14, -15); context.lineTo(-6, 0); context.lineTo(-14, 15); context.closePath(); context.fill();
  context.fillStyle = friendly ? "#5ae4ed" : "#ff8b51";
  context.beginPath(); context.moveTo(4, 0); context.lineTo(-20, -32); context.lineTo(-8, -4); context.closePath(); context.fill();
  context.beginPath(); context.moveTo(4, 0); context.lineTo(-20, 32); context.lineTo(-8, 4); context.closePath(); context.fill();
  context.strokeStyle = "rgba(255,255,255,0.7)"; context.lineWidth = 1.5;
  context.beginPath(); context.moveTo(-18, 0); context.lineTo(-40 - Math.sin(now * 8) * 5, 0); context.stroke();
  context.restore();
}

function renderRoad(context: CanvasRenderingContext2D, state: ClassicWorldState, now: number): void {
  const desert = state.gameId === "dustcoil-courier";
  const sky = context.createLinearGradient(0, 0, 0, 360);
  sky.addColorStop(0, desert ? "#1b1a20" : "#06121b");
  sky.addColorStop(1, desert ? "#b36c3e" : "#225b66");
  context.fillStyle = sky; context.fillRect(0, 0, CLASSIC_WORLD_WIDTH, 330);
  context.fillStyle = desert ? "#342019" : "#07100f"; context.fillRect(0, 330, CLASSIC_WORLD_WIDTH, 210);
  const horizonY = 175;
  context.fillStyle = desert ? "#2a211f" : "#11181a";
  context.beginPath(); context.moveTo(420, horizonY); context.lineTo(540, horizonY); context.lineTo(820, 540); context.lineTo(140, 540); context.closePath(); context.fill();
  context.strokeStyle = desert ? "rgba(255,187,102,0.5)" : "rgba(100,235,244,0.5)";
  context.lineWidth = 3;
  for (const side of [-1, 1]) {
    context.beginPath(); context.moveTo(480 + side * 18, horizonY); context.lineTo(480 + side * 310, 540); context.stroke();
  }
  for (let index = 0; index < 13; index += 1) {
    const progress = ((index / 13 + now * 0.34) % 1);
    const y = horizonY + progress * progress * 390;
    const half = 22 + progress * 280;
    context.globalAlpha = 0.18 + progress * 0.38;
    context.beginPath(); context.moveTo(480 - half, y); context.lineTo(480 + half, y); context.stroke();
  }
  context.globalAlpha = 1;
  for (const obstacle of state.actors) drawRoadVehicle(context, obstacle.x, obstacle.y, false, desert);
  drawRoadVehicle(context, state.player.x, state.player.y, true, desert);
}

function drawRoadVehicle(context: CanvasRenderingContext2D, x: number, y: number, friendly: boolean, desert: boolean): void {
  const scale = 0.52 + clamp(y / 540, 0, 1) * 0.7;
  context.save(); context.translate(x, y); context.scale(scale, scale);
  context.shadowColor = friendly ? "#bdf765" : desert ? "#ff9a53" : "#64e9f4"; context.shadowBlur = 16;
  context.fillStyle = friendly ? "#d8ff88" : desert ? "#b76139" : "#367c91";
  roundRect(context, -25, -38, 50, 76, 14); context.fill();
  context.fillStyle = "#08100f"; roundRect(context, -15, -23, 30, 28, 7); context.fill();
  context.fillStyle = "#f3f0c4"; context.fillRect(-19, 23, 10, 5); context.fillRect(9, 23, 10, 5);
  context.restore();
}

function renderPrismStack(context: CanvasRenderingContext2D, state: ClassicWorldState, now: number): void {
  const background = context.createRadialGradient(480, 220, 40, 480, 270, 520);
  background.addColorStop(0, "#2c215e"); background.addColorStop(1, "#050510");
  context.fillStyle = background; context.fillRect(0, 0, CLASSIC_WORLD_WIDTH, CLASSIC_WORLD_HEIGHT);
  context.save(); context.translate(340, 40);
  context.fillStyle = "rgba(5,8,16,0.82)"; roundRect(context, -18, -18, 318, 486, 18); context.fill();
  context.strokeStyle = "rgba(115,239,255,0.35)"; context.lineWidth = 2; context.stroke();
  const size = 28;
  for (let y = 0; y < state.board.length; y += 1) {
    for (let x = 0; x < state.board[y]!.length; x += 1) {
      const value = state.board[y]![x]!;
      drawPrismCell(context, x * size, y * size, size - 2, value, now + x + y);
    }
  }
  if (state.piece) {
    for (const cell of rotatedPieceCells(state.piece.cells, state.piece.rotation)) {
      drawPrismCell(context, (state.piece.x + cell.x) * size, (state.piece.y + cell.y) * size, size - 2, state.piece.color, now);
    }
  }
  context.restore();
  context.fillStyle = "rgba(214,255,238,0.72)"; context.font = "600 12px ui-monospace";
  context.fillText("TRI-SHARD MATRIX", 695, 110);
  context.fillStyle = "rgba(189,247,101,0.16)"; context.fillRect(695, 132, 180, 2);
  context.fillStyle = "rgba(214,255,238,0.45)"; context.font = "500 10px ui-monospace";
  context.fillText("IRREGULAR CRYSTALS", 695, 166); context.fillText("3 CIRCUITS TO CLEAR", 695, 190);
}

function drawPrismCell(context: CanvasRenderingContext2D, x: number, y: number, size: number, value: number, now: number): void {
  if (value === 0) {
    context.fillStyle = "rgba(255,255,255,0.025)"; context.fillRect(x, y, size, size); return;
  }
  const colors = ["#72efff", "#c9ff70", "#ffb55c", "#d986ff"];
  const color = colors[(value - 1) % colors.length]!;
  context.save(); context.translate(x + size / 2, y + size / 2); context.rotate(Math.sin(now * 0.7) * 0.025);
  context.shadowColor = color; context.shadowBlur = 11; context.fillStyle = color;
  context.beginPath(); context.moveTo(0, -size * 0.44); context.lineTo(size * 0.42, -size * 0.08); context.lineTo(size * 0.23, size * 0.42); context.lineTo(-size * 0.35, size * 0.31); context.lineTo(-size * 0.42, -size * 0.15); context.closePath(); context.fill();
  context.fillStyle = "rgba(255,255,255,0.45)"; context.beginPath(); context.moveTo(0, -size * 0.36); context.lineTo(size * 0.12, size * 0.1); context.lineTo(-size * 0.28, -size * 0.12); context.closePath(); context.fill();
  context.restore();
}

function renderGlyphCurrent(context: CanvasRenderingContext2D, state: ClassicWorldState, now: number): void {
  const background = context.createLinearGradient(0, 0, CLASSIC_WORLD_WIDTH, CLASSIC_WORLD_HEIGHT);
  background.addColorStop(0, "#05121a"); background.addColorStop(1, "#102d34");
  context.fillStyle = background; context.fillRect(0, 0, CLASSIC_WORLD_WIDTH, CLASSIC_WORLD_HEIGHT);
  for (let index = 0; index < 15; index += 1) {
    context.strokeStyle = `rgba(90,230,238,${0.04 + (index % 3) * 0.03})`;
    context.beginPath(); context.moveTo(-40, 40 + index * 36); context.bezierCurveTo(220, 10 + index * 42, 700, 100 + index * 28 + Math.sin(now + index) * 12, 1_020, 20 + index * 35); context.stroke();
  }
  const size = 50; const originX = 280; const originY = 66;
  for (let y = 0; y < 8; y += 1) for (let x = 0; x < 8; x += 1) {
    const value = state.board[y]![x]!;
    drawGlyph(context, originX + x * size, originY + y * size, size - 5, value, now + x * 0.2 + y * 0.3);
  }
  drawCursor(context, originX + state.cursor.x * size, originY + state.cursor.y * size, size - 5, "#d8ff72");
  if (state.selected) drawCursor(context, originX + state.selected.x * size, originY + state.selected.y * size, size - 5, "#ffb55c");
}

function drawGlyph(context: CanvasRenderingContext2D, x: number, y: number, size: number, value: number, now: number): void {
  const colors = ["#66e9f4", "#bdf765", "#ffb45e", "#d28cff", "#ff786e"];
  const color = colors[(value - 1 + colors.length) % colors.length]!;
  context.save(); context.translate(x + size / 2, y + size / 2); context.rotate(Math.sin(now) * 0.04);
  context.fillStyle = "rgba(3,10,13,0.78)"; roundRect(context, -size / 2, -size / 2, size, size, 12); context.fill();
  context.strokeStyle = color; context.shadowColor = color; context.shadowBlur = 9; context.lineWidth = 2;
  context.beginPath();
  if (value % 5 === 1) { context.arc(0, 0, 11, 0, Math.PI * 2); context.moveTo(-16, 0); context.lineTo(16, 0); }
  else if (value % 5 === 2) { context.moveTo(-15, 13); context.lineTo(0, -16); context.lineTo(15, 13); context.closePath(); }
  else if (value % 5 === 3) { context.moveTo(-14, -14); context.lineTo(14, 14); context.moveTo(14, -14); context.lineTo(-14, 14); }
  else if (value % 5 === 4) { context.rect(-12, -12, 24, 24); context.moveTo(-18, 0); context.lineTo(18, 0); }
  else { for (let i = 0; i < 6; i += 1) { const a = i * Math.PI / 3; const b = (i + 2) * Math.PI / 3; context.moveTo(Math.cos(a) * 15, Math.sin(a) * 15); context.lineTo(Math.cos(b) * 15, Math.sin(b) * 15); } }
  context.stroke(); context.restore();
}

function renderOrbitFoundry(
  context: CanvasRenderingContext2D,
  state: ClassicWorldState,
  now: number,
  contract: ClassicRuleContract,
): void {
  const background = context.createRadialGradient(480, 250, 45, 480, 260, 510);
  background.addColorStop(0, "#243726"); background.addColorStop(0.55, "#0b1915"); background.addColorStop(1, "#020605");
  context.fillStyle = background; context.fillRect(0, 0, CLASSIC_WORLD_WIDTH, CLASSIC_WORLD_HEIGHT);
  context.strokeStyle = "rgba(189,247,101,0.22)"; context.lineWidth = 2;
  for (let radius = 90; radius < 430; radius += 54) { context.beginPath(); context.ellipse(480, 250, radius, radius * 0.58, -0.12, 0, Math.PI * 2); context.stroke(); }
  for (const bumper of [{ x: 330, y: 190, r: 43 }, { x: 480, y: 135, r: 38 }, { x: 635, y: 205, r: 46 }, { x: 480, y: 310, r: 34 }]) {
    const glow = context.createRadialGradient(bumper.x, bumper.y, 2, bumper.x, bumper.y, bumper.r);
    glow.addColorStop(0, "#fffbd0"); glow.addColorStop(0.22, "#ffb24f"); glow.addColorStop(1, "#4e2217");
    context.fillStyle = glow; context.shadowColor = "#ffac47"; context.shadowBlur = 22;
    context.beginPath(); context.arc(bumper.x, bumper.y, bumper.r, 0, Math.PI * 2); context.fill();
    context.shadowBlur = 0; context.strokeStyle = "rgba(255,245,180,0.7)"; context.stroke();
  }
  context.fillStyle = "rgba(0,0,0,0.45)"; context.beginPath(); context.moveTo(200, 540); context.lineTo(330, 370); context.lineTo(630, 370); context.lineTo(760, 540); context.closePath(); context.fill();
  drawFlipper(context, 385, 450, -0.22 - (state.inputLatch.primary ? 0.5 : 0), "#bdf765");
  drawFlipper(context, 575, 450, Math.PI + 0.22 + (state.inputLatch.secondary ? 0.5 : 0), "#64e9f4");
  const ballGlow = context.createRadialGradient(state.player.x - 3, state.player.y - 4, 1, state.player.x, state.player.y, state.player.radius * 1.8);
  ballGlow.addColorStop(0, "#fff"); ballGlow.addColorStop(0.35, "#9effef"); ballGlow.addColorStop(1, "rgba(80,238,230,0)");
  context.fillStyle = ballGlow; context.shadowColor = "#64e9f4"; context.shadowBlur = 16;
  context.beginPath(); context.arc(state.player.x, state.player.y, state.player.radius * 1.8, 0, Math.PI * 2); context.fill();
  context.shadowBlur = 0;
  context.fillStyle = "rgba(214,255,238,0.48)"; context.font = "500 10px ui-monospace";
  context.fillText(`GRAVITY ${contract.gravity.toFixed(0)} / ORBIT ${Math.floor(now * 10) % 360}`, 34, 42);
}

function renderArena(context: CanvasRenderingContext2D, state: ClassicWorldState, now: number): void {
  if (state.gameId === "harbor-brawl") {
    const water = context.createLinearGradient(0, 0, 0, CLASSIC_WORLD_HEIGHT);
    water.addColorStop(0, "#0d3340"); water.addColorStop(1, "#031014");
    context.fillStyle = water; context.fillRect(0, 0, CLASSIC_WORLD_WIDTH, CLASSIC_WORLD_HEIGHT);
    context.strokeStyle = "rgba(101,233,244,0.12)";
    for (let y = 45; y < 540; y += 28) { context.beginPath(); context.moveTo(0, y); context.quadraticCurveTo(480, y + Math.sin(now + y) * 13, 960, y); context.stroke(); }
    context.fillStyle = "#392b20"; roundRect(context, 60, 110, 840, 380, 24); context.fill();
    context.fillStyle = "#725338"; for (let x = 80; x < 900; x += 68) context.fillRect(x, 120, 8, 360);
    for (const enemy of state.actors) drawConstruct(context, enemy, "#ff8b63", "#ffd27c", "raider", now + enemy.id);
    drawConstruct(context, state.player, "#68eaf4", "#bdf765", "brawler", now);
  } else {
    context.fillStyle = "#07110f"; context.fillRect(0, 0, CLASSIC_WORLD_WIDTH, CLASSIC_WORLD_HEIGHT);
    const field = context.createLinearGradient(0, 40, 0, 500); field.addColorStop(0, "#123e35"); field.addColorStop(1, "#0a251f");
    context.fillStyle = field; roundRect(context, 34, 50, 892, 440, 26); context.fill();
    context.strokeStyle = "rgba(189,247,101,0.45)"; context.lineWidth = 3; context.stroke();
    context.beginPath(); context.moveTo(480, 50); context.lineTo(480, 490); context.stroke();
    context.beginPath(); context.arc(480, 270, 75, 0, Math.PI * 2); context.stroke();
    context.strokeRect(34, 205, 56, 130); context.strokeRect(870, 205, 56, 130);
    const ball = state.actors.find(({ kind }) => kind === "ball");
    if (ball) { context.fillStyle = "#f4ffcf"; context.shadowColor = "#bdf765"; context.shadowBlur = 16; context.beginPath(); context.arc(ball.x, ball.y, 14, 0, Math.PI * 2); context.fill(); context.shadowBlur = 0; }
    for (const actor of state.actors.filter(({ kind }) => kind === "striker-opponent")) drawConstruct(context, actor, "#ff7a6c", "#ffc46c", "striker", now);
    drawConstruct(context, state.player, "#68eaf4", "#bdf765", "striker", now);
  }
}

function renderSignalBloom(context: CanvasRenderingContext2D, state: ClassicWorldState, now: number): void {
  const background = context.createRadialGradient(480, 270, 40, 480, 270, 530);
  background.addColorStop(0, "#153b2d"); background.addColorStop(0.55, "#071912"); background.addColorStop(1, "#020705");
  context.fillStyle = background; context.fillRect(0, 0, CLASSIC_WORLD_WIDTH, CLASSIC_WORLD_HEIGHT);
  context.strokeStyle = "rgba(189,247,101,0.11)";
  for (let index = 0; index < 24; index += 1) {
    const x = (index * 83 + Math.sin(index) * 37) % 1_000;
    context.beginPath(); context.moveTo(x, 540); context.bezierCurveTo(x - 24, 420, x + 33, 310, x + Math.sin(now + index) * 12, 210); context.stroke();
  }
  for (const target of state.actors) drawSignalFlower(context, target, now);
  context.strokeStyle = "#f2ffbc"; context.lineWidth = 2; context.shadowColor = "#bdf765"; context.shadowBlur = 12;
  context.beginPath(); context.arc(state.player.x, state.player.y, 19, 0, Math.PI * 2); context.moveTo(state.player.x - 27, state.player.y); context.lineTo(state.player.x + 27, state.player.y); context.moveTo(state.player.x, state.player.y - 27); context.lineTo(state.player.x, state.player.y + 27); context.stroke(); context.shadowBlur = 0;
}

function drawSignalFlower(context: CanvasRenderingContext2D, target: ClassicActor, now: number): void {
  const color = target.friendly ? "#64e9f4" : "#ff7c68";
  context.save(); context.translate(target.x, target.y); context.rotate(now * 0.35 + target.id);
  context.strokeStyle = color; context.fillStyle = `${color}33`; context.shadowColor = color; context.shadowBlur = 18; context.lineWidth = 2;
  for (let index = 0; index < 6; index += 1) {
    context.rotate(Math.PI / 3); context.beginPath(); context.ellipse(target.radius * 0.7, 0, target.radius * 0.62, target.radius * 0.25, 0, 0, Math.PI * 2); context.fill(); context.stroke();
  }
  context.fillStyle = "#f3ffd1"; context.beginPath(); context.arc(0, 0, target.radius * 0.26, 0, Math.PI * 2); context.fill(); context.restore();
}

function renderTileWorld(context: CanvasRenderingContext2D, state: ClassicWorldState, now: number): void {
  const background = context.createLinearGradient(0, 0, CLASSIC_WORLD_WIDTH, CLASSIC_WORLD_HEIGHT);
  const isLumen = state.gameId === "lumen-labyrinth";
  background.addColorStop(0, isLumen ? "#020608" : "#08120f");
  background.addColorStop(1, isLumen ? "#101b28" : "#173026");
  context.fillStyle = background; context.fillRect(0, 0, CLASSIC_WORLD_WIDTH, CLASSIC_WORLD_HEIGHT);
  const rows = state.board.length; const columns = state.board[0]?.length ?? 1;
  const cellWidth = Math.min(56, 830 / columns); const cellHeight = Math.min(52, 455 / rows);
  const originX = (CLASSIC_WORLD_WIDTH - columns * cellWidth) / 2;
  const originY = (CLASSIC_WORLD_HEIGHT - rows * cellHeight) / 2;
  for (let y = 0; y < rows; y += 1) for (let x = 0; x < columns; x += 1) {
    drawTile(context, originX + x * cellWidth, originY + y * cellHeight, cellWidth, cellHeight, state.board[y]![x]!, state.gameId, now + x + y);
  }
  for (const point of state.trail) drawGridPulse(context, originX, originY, cellWidth, cellHeight, point, "#64e9f4", 0.68);
  for (const actor of state.actors) {
    if (actor.kind === "spark-bomb") drawGridPulse(context, originX, originY, cellWidth, cellHeight, actor, "#ffb354", 0.9 + Math.sin(now * 8) * 0.08);
    else if (actor.kind === "crate") drawCrate(context, originX + (actor.x + 0.5) * cellWidth, originY + (actor.y + 0.5) * cellHeight, Math.min(cellWidth, cellHeight) * 0.68);
    else drawGridConstruct(context, originX, originY, cellWidth, cellHeight, actor, "#ff7d67", now);
  }
  for (const shot of state.shots) drawGridPulse(context, originX, originY, cellWidth, cellHeight, shot, "#f2ff98", 0.45);
  drawGridConstruct(context, originX, originY, cellWidth, cellHeight, state.player, "#bdf765", now);
}

function drawTile(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  value: number,
  gameId: string,
  now: number,
): void {
  const gap = 2;
  if (value === 1) {
    const wall = context.createLinearGradient(x, y, x + width, y + height);
    wall.addColorStop(0, gameId === "lumen-labyrinth" ? "#24334b" : "#365349"); wall.addColorStop(1, "#101a18");
    context.fillStyle = wall; roundRect(context, x + gap, y + gap, width - gap * 2, height - gap * 2, 7); context.fill();
    context.strokeStyle = "rgba(220,255,220,0.11)"; context.stroke();
    return;
  }
  context.fillStyle = (Math.floor(x / width) + Math.floor(y / height)) % 2 ? "rgba(255,255,255,0.025)" : "rgba(255,255,255,0.045)";
  context.fillRect(x + gap, y + gap, width - gap * 2, height - gap * 2);
  if (value === 2) {
    const glow = context.createRadialGradient(x + width / 2, y + height / 2, 1, x + width / 2, y + height / 2, Math.min(width, height) * 0.38);
    glow.addColorStop(0, "#f8ffd5"); glow.addColorStop(0.28, "#bdf765"); glow.addColorStop(1, "rgba(189,247,101,0)");
    context.fillStyle = glow; context.beginPath(); context.arc(x + width / 2, y + height / 2, Math.min(width, height) * (0.34 + Math.sin(now) * 0.03), 0, Math.PI * 2); context.fill();
  } else if (value === 5) {
    context.strokeStyle = "#ffbb5c"; context.lineWidth = 2; context.beginPath(); context.arc(x + width / 2, y + height / 2, Math.min(width, height) * 0.3, 0, Math.PI * 2); context.stroke();
  }
}

function drawConstruct(
  context: CanvasRenderingContext2D,
  point: ClassicPoint & { radius: number; facing?: number },
  primary: string,
  secondary: string,
  variant: string,
  now: number,
): void {
  context.save(); context.translate(point.x, point.y); context.scale(point.facing ?? 1, 1);
  context.shadowColor = primary; context.shadowBlur = 14;
  context.fillStyle = primary; context.beginPath(); context.moveTo(0, -point.radius); context.lineTo(point.radius * 0.78, -point.radius * 0.12); context.lineTo(point.radius * 0.5, point.radius); context.lineTo(-point.radius * 0.58, point.radius * 0.82); context.lineTo(-point.radius * 0.82, -point.radius * 0.18); context.closePath(); context.fill();
  context.fillStyle = "#08110f"; context.beginPath(); context.arc(0, -point.radius * 0.05, point.radius * 0.36, 0, Math.PI * 2); context.fill();
  context.fillStyle = secondary; context.beginPath(); context.arc(Math.sin(now * 4) * 1.5, -point.radius * 0.05, point.radius * 0.15, 0, Math.PI * 2); context.fill();
  context.strokeStyle = secondary; context.lineWidth = 3;
  if (variant === "blade") { context.beginPath(); context.moveTo(point.radius * 0.5, -point.radius * 0.3); context.lineTo(point.radius * 1.55, -point.radius * 0.8); context.stroke(); }
  else if (variant === "brawler") { context.beginPath(); context.moveTo(-point.radius * 0.65, 0); context.lineTo(-point.radius * 1.25, point.radius * 0.4); context.moveTo(point.radius * 0.65, 0); context.lineTo(point.radius * 1.25, point.radius * 0.4); context.stroke(); }
  else if (variant === "striker") { context.beginPath(); context.arc(0, 0, point.radius * 1.15, -0.4, 0.4); context.stroke(); }
  context.restore();
}

function drawEnemyConstruct(context: CanvasRenderingContext2D, actor: ClassicActor, color: string, now: number): void {
  drawConstruct(context, actor, color, "#fff2b1", "enemy", now + actor.id);
}

function drawRelic(context: CanvasRenderingContext2D, actor: ClassicActor, now: number): void {
  context.save(); context.translate(actor.x, actor.y); context.rotate(now * 0.7 + actor.id);
  context.fillStyle = "#eaff9b"; context.shadowColor = "#bdf765"; context.shadowBlur = 20;
  context.beginPath(); context.moveTo(0, -15); context.lineTo(12, 0); context.lineTo(0, 15); context.lineTo(-12, 0); context.closePath(); context.fill();
  context.restore();
}

function drawProjectile(context: CanvasRenderingContext2D, actor: ClassicActor, color: string): void {
  context.fillStyle = color; context.shadowColor = color; context.shadowBlur = 16;
  context.beginPath(); context.ellipse(actor.x, actor.y, actor.radius * 2.1, actor.radius * 0.7, 0, 0, Math.PI * 2); context.fill(); context.shadowBlur = 0;
}

function drawFlipper(context: CanvasRenderingContext2D, x: number, y: number, angle: number, color: string): void {
  context.save(); context.translate(x, y); context.rotate(angle); context.fillStyle = color; context.shadowColor = color; context.shadowBlur = 13; roundRect(context, 0, -9, 130, 18, 9); context.fill(); context.restore();
}

function drawGridConstruct(
  context: CanvasRenderingContext2D,
  originX: number,
  originY: number,
  cellWidth: number,
  cellHeight: number,
  point: ClassicPoint & { radius: number },
  color: string,
  now: number,
): void {
  const x = originX + (point.x + 0.5) * cellWidth;
  const y = originY + (point.y + 0.5) * cellHeight;
  const radius = Math.min(cellWidth, cellHeight) * 0.28;
  context.save(); context.translate(x, y); context.rotate(Math.sin(now * 1.7 + x) * 0.06);
  context.fillStyle = color; context.shadowColor = color; context.shadowBlur = 13;
  context.beginPath(); for (let index = 0; index < 6; index += 1) { const angle = -Math.PI / 2 + index * Math.PI / 3; const px = Math.cos(angle) * radius; const py = Math.sin(angle) * radius; if (index === 0) context.moveTo(px, py); else context.lineTo(px, py); } context.closePath(); context.fill();
  context.fillStyle = "#07100e"; context.beginPath(); context.arc(0, 0, radius * 0.38, 0, Math.PI * 2); context.fill();
  context.fillStyle = "#fffbc2"; context.beginPath(); context.arc(0, 0, radius * 0.14, 0, Math.PI * 2); context.fill(); context.restore();
}

function drawGridPulse(
  context: CanvasRenderingContext2D,
  originX: number,
  originY: number,
  cellWidth: number,
  cellHeight: number,
  point: ClassicPoint,
  color: string,
  scale: number,
): void {
  const x = originX + (point.x + 0.5) * cellWidth;
  const y = originY + (point.y + 0.5) * cellHeight;
  context.fillStyle = color; context.shadowColor = color; context.shadowBlur = 18;
  context.beginPath(); context.arc(x, y, Math.min(cellWidth, cellHeight) * scale * 0.42, 0, Math.PI * 2); context.fill(); context.shadowBlur = 0;
}

function drawCrate(context: CanvasRenderingContext2D, x: number, y: number, size: number): void {
  const gradient = context.createLinearGradient(x - size / 2, y - size / 2, x + size / 2, y + size / 2);
  gradient.addColorStop(0, "#ffd17a"); gradient.addColorStop(1, "#805528");
  context.fillStyle = gradient; context.shadowColor = "#ffb75d"; context.shadowBlur = 10; roundRect(context, x - size / 2, y - size / 2, size, size, 7); context.fill();
  context.strokeStyle = "rgba(255,247,190,0.75)"; context.beginPath(); context.moveTo(x - size * 0.3, y); context.lineTo(x + size * 0.3, y); context.moveTo(x, y - size * 0.3); context.lineTo(x, y + size * 0.3); context.stroke(); context.shadowBlur = 0;
}

function renderParticles(context: CanvasRenderingContext2D, state: ClassicWorldState): void {
  for (const particle of state.particles) {
    const life = clamp(particle.timer / 0.78, 0, 1);
    const color = particle.kind.includes("damage") ? "#ff7667"
      : particle.kind.includes("sun") || particle.kind.includes("orbit") ? "#ffbc58"
        : particle.kind.includes("victory") || particle.kind.includes("relic") ? "#bdf765"
          : "#64e9f4";
    context.globalAlpha = life;
    context.fillStyle = color; context.shadowColor = color; context.shadowBlur = 9;
    context.beginPath(); context.arc(particle.x, particle.y, particle.radius * life, 0, Math.PI * 2); context.fill();
  }
  context.globalAlpha = 1; context.shadowBlur = 0;
}

function renderAtmosphere(context: CanvasRenderingContext2D, contract: ClassicRuleContract, now: number): void {
  context.save();
  context.globalCompositeOperation = "screen";
  const color = contract.phase === "surge" ? "255,112,84" : contract.phase === "charged" ? "100,233,244" : "189,247,101";
  const vignette = context.createRadialGradient(480, 270, 90, 480, 270, 570);
  vignette.addColorStop(0, `rgba(${color},0.025)`); vignette.addColorStop(0.78, `rgba(${color},0.015)`); vignette.addColorStop(1, "rgba(0,0,0,0)");
  context.fillStyle = vignette; context.fillRect(0, 0, CLASSIC_WORLD_WIDTH, CLASSIC_WORLD_HEIGHT);
  context.globalAlpha = 0.07;
  for (let index = 0; index < 50; index += 1) {
    const x = (index * 193 + Math.sin(index * 7) * 90) % 960;
    const y = (index * 97 + now * (4 + (index % 4))) % 540;
    context.fillStyle = `rgb(${color})`; context.fillRect(x, y, 1.5, 1.5);
  }
  context.restore();
}

function drawCursor(context: CanvasRenderingContext2D, x: number, y: number, size: number, color: string): void {
  context.strokeStyle = color; context.shadowColor = color; context.shadowBlur = 12; context.lineWidth = 3; roundRect(context, x - 2, y - 2, size + 4, size + 4, 10); context.stroke(); context.shadowBlur = 0;
}

function rotatedPieceCells(cells: readonly ClassicPoint[], rotation: number): ClassicPoint[] {
  return cells.map((cell) => {
    let x = cell.x; let y = cell.y;
    for (let turn = 0; turn < rotation; turn += 1) [x, y] = [-y, x];
    return { x, y };
  });
}

function roundRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const r = Math.min(radius, width / 2, height / 2);
  context.beginPath(); context.moveTo(x + r, y); context.arcTo(x + width, y, x + width, y + height, r); context.arcTo(x + width, y + height, x, y + height, r); context.arcTo(x, y + height, x, y, r); context.arcTo(x, y, x + width, y, r); context.closePath();
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}
