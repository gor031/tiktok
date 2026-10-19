import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Coins, FastForward, Pause, Play, RotateCcw, Sparkles } from 'lucide-react';
import {
  W, H, COLS, ROWS, TILE, GAP, BOARD_X, BOARD_Y, BOARD_W, BOARD_H, PATH, ENEMY_LIMIT, MAX_STAR,
  UNIT_DEFS, UNIT_TYPES, Game, Unit, UnitType, Enemy,
  createGame, step, summon, moveUnit, sellUnit, canSummon, canMerge, tileAt, tileCenter, pathPos,
  unitStats, sellValue, isBossWave, formatNum,
} from './engine';

const FONT = '"Black Han Sans", "Plus Jakarta Sans", sans-serif';
const BEST_KEY = 'tower-defense-best-wave';
const STAR_AURA = ['', '', '', '#4fc3f7', '#ba68c8', '#ffb74d', '#ff5252', '#ffffff'];

interface Drag { from: number; x: number; y: number; moved: boolean }

interface Hud {
  coins: number;
  cost: number;
  wave: number;
  over: Game['over'];
  canSummon: boolean;
  selected: { idx: number; unit: Unit } | null;
}

function readBest() {
  try { return Number(localStorage.getItem(BEST_KEY)) || 0; } catch { return 0; }
}

function saveBest(wave: number) {
  try { localStorage.setItem(BEST_KEY, String(wave)); } catch { /* storage unavailable */ }
}

// --- Drawing helpers ---

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function outlined(
  ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number,
  fill: string, align: CanvasTextAlign = 'center', stroke = '#000'
) {
  ctx.font = `${size}px ${FONT}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(3, size * 0.2);
  ctx.strokeStyle = stroke;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y);
}

function drawBackground(ctx: CanvasRenderingContext2D) {
  // Grass
  ctx.fillStyle = '#6abf4b';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#61b443';
  for (let y = 0; y < H; y += 36) {
    for (let x = (y / 36) % 2 ? 36 : 0; x < W; x += 72) ctx.fillRect(x, y, 36, 36);
  }

  // Bushes along the edges
  const bushes = [[14, 128], [526, 128], [14, 740], [526, 740], [270, 748], [14, 430], [526, 430]];
  for (const [bx, by] of bushes) {
    ctx.fillStyle = '#2e7d32';
    for (const [dx, dy, r] of [[-10, 4, 14], [10, 4, 14], [0, -8, 16]]) {
      ctx.beginPath();
      ctx.arc(bx + dx, by + dy, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#43a047';
    ctx.beginPath();
    ctx.arc(bx - 3, by - 10, 8, 0, Math.PI * 2);
    ctx.fill();
  }

  // Dirt path ring
  const { x0, y0, x1, y1 } = PATH;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#b68d57';
  ctx.lineWidth = 54;
  ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
  ctx.strokeStyle = '#e3c58e';
  ctx.lineWidth = 46;
  ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
  ctx.setLineDash([10, 16]);
  ctx.strokeStyle = 'rgba(160,120,70,0.35)';
  ctx.lineWidth = 3;
  ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
  ctx.setLineDash([]);

  // Spawn portal
  ctx.fillStyle = '#4a148c';
  ctx.beginPath();
  ctx.ellipse(x0, y0, 24, 24, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#9c27b0';
  ctx.beginPath();
  ctx.ellipse(x0, y0, 15, 15, 0, 0, Math.PI * 2);
  ctx.fill();

  // Castle walls
  const pad = 16;
  roundRect(ctx, BOARD_X - pad, BOARD_Y - pad, BOARD_W + pad * 2, BOARD_H + pad * 2, 14);
  ctx.fillStyle = '#90a4ae';
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#455a64';
  ctx.stroke();
  roundRect(ctx, BOARD_X - 6, BOARD_Y - 6, BOARD_W + 12, BOARD_H + 12, 10);
  ctx.fillStyle = '#5d4037';
  ctx.fill();

  // Corner towers
  for (const [cx, cy] of [
    [BOARD_X - pad, BOARD_Y - pad], [BOARD_X + BOARD_W + pad, BOARD_Y - pad],
    [BOARD_X - pad, BOARD_Y + BOARD_H + pad], [BOARD_X + BOARD_W + pad, BOARD_Y + BOARD_H + pad],
  ]) {
    roundRect(ctx, cx - 20, cy - 20, 40, 40, 6);
    ctx.fillStyle = '#cfd8dc';
    ctx.fill();
    ctx.strokeStyle = '#455a64';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = '#b0bec5';
    for (const [dx, dy] of [[-12, -12], [4, -12], [-12, 4], [4, 4]]) ctx.fillRect(cx + dx, cy + dy, 8, 8);
  }

  // Wooden tiles
  for (let i = 0; i < COLS * ROWS; i++) {
    const c = i % COLS;
    const r = Math.floor(i / COLS);
    const x = BOARD_X + c * (TILE + GAP);
    const y = BOARD_Y + r * (TILE + GAP);
    roundRect(ctx, x, y, TILE, TILE, 10);
    ctx.fillStyle = '#c48e5a';
    ctx.fill();
    roundRect(ctx, x + 4, y + 4, TILE - 8, TILE - 8, 8);
    ctx.fillStyle = '#d9a56e';
    ctx.fill();
  }
}

function drawFace(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, angry = false) {
  for (const dx of [-7, 7]) {
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(x + dx * s, y, 5 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(x + dx * s + 1 * s, y + 1 * s, 2.6 * s, 0, Math.PI * 2);
    ctx.fill();
  }
  if (angry) {
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 2.5 * s;
    ctx.beginPath();
    ctx.moveTo(x - 12 * s, y - 9 * s);
    ctx.lineTo(x - 3 * s, y - 6 * s);
    ctx.moveTo(x + 12 * s, y - 9 * s);
    ctx.lineTo(x + 3 * s, y - 6 * s);
    ctx.stroke();
  }
  ctx.strokeStyle = '#111';
  ctx.lineWidth = 2 * s;
  ctx.beginPath();
  ctx.arc(x, y + 7 * s, 4 * s, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.stroke();
}

function drawStar(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.45 : r;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fillStyle = '#ffd54f';
  ctx.fill();
  ctx.strokeStyle = '#5d4037';
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

function drawUnit(ctx: CanvasRenderingContext2D, type: UnitType, star: number, x: number, y: number, scale: number, t: number) {
  const def = UNIT_DEFS[type];
  ctx.save();
  ctx.translate(x, y);

  // Shadow and tier aura
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(0, 26, 24, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  if (STAR_AURA[star]) {
    ctx.strokeStyle = STAR_AURA[star];
    ctx.globalAlpha = 0.6 + 0.3 * Math.sin(t * 5);
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.ellipse(0, 24, 30, 10, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  ctx.scale(scale, scale);
  ctx.translate(0, Math.sin(t * 4 + x) * 1.5);
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#1b1b1b';

  switch (type) {
    case 'tomato': {
      ctx.fillStyle = def.body;
      ctx.beginPath();
      ctx.ellipse(0, 4, 25, 22, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = def.accent;
      for (let i = 0; i < 5; i++) {
        ctx.save();
        ctx.translate(0, -16);
        ctx.rotate((i / 5) * Math.PI * 2);
        ctx.beginPath();
        ctx.ellipse(0, -6, 4, 9, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      // Boxing gloves
      ctx.fillStyle = '#c62828';
      for (const dx of [-24, 24]) {
        ctx.beginPath();
        ctx.arc(dx, 12, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      drawFace(ctx, 0, 4, 1, true);
      break;
    }
    case 'melon': {
      ctx.fillStyle = def.body;
      ctx.beginPath();
      ctx.arc(0, 2, 25, 0, Math.PI * 2);
      ctx.fill();
      ctx.save();
      ctx.clip();
      ctx.strokeStyle = def.accent;
      ctx.lineWidth = 5;
      for (const dx of [-16, 0, 16]) {
        ctx.beginPath();
        ctx.ellipse(dx, 2, 5, 28, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
      ctx.strokeStyle = '#1b1b1b';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 2, 25, 0, Math.PI * 2);
      ctx.stroke();
      // Cannon barrel
      ctx.fillStyle = '#5d4037';
      roundRect(ctx, 14, -6, 20, 12, 4);
      ctx.fill();
      ctx.stroke();
      drawFace(ctx, -4, 2, 0.9);
      break;
    }
    case 'sunflower': {
      ctx.fillStyle = def.body;
      for (let i = 0; i < 12; i++) {
        ctx.save();
        ctx.rotate((i / 12) * Math.PI * 2 + t * 0.6);
        ctx.beginPath();
        ctx.ellipse(0, -22, 6, 11, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.restore();
      }
      ctx.fillStyle = '#8d6e63';
      ctx.beginPath();
      ctx.arc(0, 0, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.stroke();
      drawFace(ctx, 0, -1, 0.85);
      break;
    }
    case 'cactus': {
      ctx.fillStyle = def.body;
      roundRect(ctx, -14, -24, 28, 50, 14);
      ctx.fill();
      ctx.stroke();
      roundRect(ctx, -28, -6, 12, 22, 6);
      ctx.fill();
      ctx.stroke();
      roundRect(ctx, 16, -14, 12, 22, 6);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = def.accent;
      ctx.beginPath();
      ctx.arc(0, -26, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#1b5e20';
      for (const [dx, dy] of [[-8, 14], [8, 18], [-6, -14], [7, -10]]) ctx.fillRect(dx, dy, 2, 4);
      drawFace(ctx, 0, -2, 0.85);
      break;
    }
    case 'pepper': {
      ctx.fillStyle = def.body;
      ctx.beginPath();
      ctx.moveTo(0, -18);
      ctx.bezierCurveTo(26, -18, 22, 18, 4, 30);
      ctx.bezierCurveTo(-20, 18, -26, -18, 0, -18);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = def.accent;
      roundRect(ctx, -4, -30, 8, 14, 3);
      ctx.fill();
      ctx.stroke();
      // Little flame on top
      ctx.fillStyle = '#ffca28';
      ctx.beginPath();
      ctx.ellipse(10, -26, 5, 8 + Math.sin(t * 12) * 2, 0.3, 0, Math.PI * 2);
      ctx.fill();
      drawFace(ctx, 0, 0, 0.9, true);
      break;
    }
  }
  ctx.restore();

  // Stars above the head
  if (star <= 4) {
    const total = star * 13;
    for (let i = 0; i < star; i++) drawStar(ctx, x - total / 2 + 6.5 + i * 13, y - 40 * scale, 7);
  } else {
    drawStar(ctx, x - 12, y - 40 * scale, 9);
    outlined(ctx, `${star}`, x + 6, y - 40 * scale, 18, '#ffd54f');
  }
}

function drawEnemy(ctx: CanvasRenderingContext2D, e: Enemy, t: number) {
  const p = pathPos(e.dist);
  const r = e.boss ? 32 : 15;
  const bob = Math.abs(Math.sin(t * 8 + e.id)) * (e.boss ? 3 : 4);
  ctx.save();
  ctx.translate(p.x, p.y - bob);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(0, r + bob - 2, r * 0.9, r * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = e.boss ? '#7b1fa2' : `hsl(${e.hue}, 55%, 52%)`;
  ctx.strokeStyle = '#1b1b1b';
  ctx.lineWidth = e.boss ? 4 : 2.5;
  // Horns
  for (const dx of [-0.55, 0.55]) {
    ctx.beginPath();
    ctx.moveTo(dx * r - 4, -r * 0.6);
    ctx.lineTo(dx * r * 1.2, -r * 1.25);
    ctx.lineTo(dx * r + 4, -r * 0.75);
    ctx.fill();
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  if (e.hitT > 0) {
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fill();
  }
  if (e.slowT > 0) {
    ctx.strokeStyle = '#81d4fa';
    ctx.lineWidth = 3;
    ctx.stroke();
  }
  drawFace(ctx, 0, -2, e.boss ? 1.9 : 0.8, true);

  if (e.boss) {
    ctx.fillStyle = '#ffd54f';
    ctx.strokeStyle = '#5d4037';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-18, -r + 2);
    ctx.lineTo(-18, -r - 16);
    ctx.lineTo(-9, -r - 6);
    ctx.lineTo(0, -r - 20);
    ctx.lineTo(9, -r - 6);
    ctx.lineTo(18, -r - 16);
    ctx.lineTo(18, -r + 2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  if (e.burnT > 0) {
    ctx.fillStyle = 'rgba(255,120,0,0.85)';
    ctx.beginPath();
    ctx.ellipse(r * 0.5, -r * 0.6, 4, 7 + Math.sin(t * 20) * 2, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  if (e.hp < e.maxHp) {
    const bw = e.boss ? 64 : 30;
    const bh = e.boss ? 7 : 4;
    const by = p.y - r - (e.boss ? 30 : 12) - bob;
    ctx.fillStyle = '#212121';
    ctx.fillRect(p.x - bw / 2 - 1, by - 1, bw + 2, bh + 2);
    ctx.fillStyle = e.boss ? '#ff5252' : '#76ff03';
    ctx.fillRect(p.x - bw / 2, by, bw * Math.max(0, e.hp / e.maxHp), bh);
  }
}

function drawProjectiles(ctx: CanvasRenderingContext2D, g: Game) {
  for (const p of g.projectiles) {
    switch (p.type) {
      case 'tomato':
        ctx.fillStyle = '#e53935';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'melon':
        ctx.fillStyle = '#2e7d32';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#1b1b1b';
        ctx.lineWidth = 2;
        ctx.stroke();
        break;
      case 'sunflower':
        ctx.fillStyle = '#ffeb3b';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'cactus': {
        const a = Math.atan2(p.ty - p.y, p.tx - p.x);
        ctx.strokeStyle = '#33691e';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(p.x - Math.cos(a) * 10, p.y - Math.sin(a) * 10);
        ctx.lineTo(p.x + Math.cos(a) * 6, p.y + Math.sin(a) * 6);
        ctx.stroke();
        break;
      }
      case 'pepper':
        ctx.fillStyle = 'rgba(255,152,0,0.45)';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ff5722';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
        ctx.fill();
        break;
    }
  }
}

function drawSkull(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = '#eceff1';
  ctx.beginPath();
  ctx.arc(x, y - 2, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(x - 6, y + 4, 12, 7);
  ctx.fillStyle = '#263238';
  ctx.beginPath();
  ctx.arc(x - 4, y - 2, 3, 0, Math.PI * 2);
  ctx.arc(x + 4, y - 2, 3, 0, Math.PI * 2);
  ctx.fill();
}

function drawHud(ctx: CanvasRenderingContext2D, g: Game) {
  // Enemy counter (lose at the limit)
  const ratio = g.enemies.length / ENEMY_LIMIT;
  roundRect(ctx, W / 2 - 92, 14, 184, 46, 23);
  ctx.fillStyle = 'rgba(38,50,56,0.9)';
  ctx.fill();
  ctx.strokeStyle = ratio > 0.75 ? '#ff5252' : '#80cbc4';
  ctx.lineWidth = 3;
  ctx.stroke();
  drawSkull(ctx, W / 2 - 62, 37);
  outlined(ctx, `${g.enemies.length} / ${ENEMY_LIMIT}`, W / 2 + 14, 38, 26, ratio > 0.75 ? '#ff8a80' : '#fff');
  roundRect(ctx, W / 2 - 80, 66, 160, 8, 4);
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.fill();
  roundRect(ctx, W / 2 - 80, 66, Math.max(8, 160 * Math.min(1, ratio)), 8, 4);
  ctx.fillStyle = ratio > 0.75 ? '#ff5252' : ratio > 0.5 ? '#ffca28' : '#69f0ae';
  ctx.fill();

  // Wave + timer
  const boss = isBossWave(g.wave);
  outlined(ctx, `WAVE ${g.wave}`, 18, 30, 26, boss ? '#ff8a80' : '#ffe53b', 'left');
  const left = Math.max(0, g.waveDuration - g.waveTime);
  outlined(ctx, `${Math.floor(left / 60)}:${Math.floor(left % 60).toString().padStart(2, '0')}`, 18, 62, 22, left < 6 && boss ? '#ff5252' : '#fff', 'left');

  // Boss HP bar
  const bossEnemy = g.enemies.find(e => e.boss);
  if (bossEnemy) {
    outlined(ctx, 'BOSS', W - 18, 30, 22, '#ff8a80', 'right');
    roundRect(ctx, W - 160, 52, 142, 14, 7);
    ctx.fillStyle = '#212121';
    ctx.fill();
    roundRect(ctx, W - 158, 54, Math.max(6, 138 * (bossEnemy.hp / bossEnemy.maxHp)), 10, 5);
    ctx.fillStyle = '#ff5252';
    ctx.fill();
  }
}

function drawBanner(ctx: CanvasRenderingContext2D, g: Game) {
  const b = g.banner;
  if (!b) return;
  const inT = Math.min(1, b.t / 0.25);
  const outT = Math.max(0, (b.t - 1.45) / 0.35);
  const slide = (1 - inT) * W - outT * W;
  const y = 430;
  ctx.save();
  ctx.translate(slide, 0);
  ctx.globalAlpha = 1 - outT * 0.5;
  if (b.boss) {
    ctx.fillStyle = '#111';
    ctx.fillRect(0, y - 52, W, 104);
    ctx.fillStyle = '#ffe53b';
    ctx.fillRect(0, y - 44, W, 88);
    // Boss icon
    ctx.fillStyle = '#7b1fa2';
    ctx.beginPath();
    ctx.arc(90, y, 36, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 4;
    ctx.stroke();
    drawFace(ctx, 90, y - 2, 1.6, true);
    outlined(ctx, b.text, W / 2 + 50, y + 2, 42, '#fff');
  } else {
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(0, y - 36, W, 72);
    outlined(ctx, b.text, W / 2, y + 2, 44, '#ffe53b');
  }
  ctx.restore();
}

function render(ctx: CanvasRenderingContext2D, bg: HTMLCanvasElement, g: Game, drag: Drag | null, selected: number) {
  const t = g.time;
  ctx.save();
  if (g.shake > 0) ctx.translate((Math.random() - 0.5) * g.shake * 14, (Math.random() - 0.5) * g.shake * 14);
  ctx.drawImage(bg, 0, 0, W, H);

  // Selected unit range
  const sel = selected >= 0 ? g.tiles[selected] : null;
  if (sel) {
    const c = tileCenter(selected);
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(c.x, c.y, unitStats(sel).range, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  // Drop target highlight while dragging
  const dragUnit = drag?.moved ? g.tiles[drag.from] : null;
  if (drag && dragUnit) {
    const to = tileAt(drag.x, drag.y);
    if (to >= 0 && to !== drag.from) {
      const target = g.tiles[to];
      const color = !target ? '#69f0ae' : canMerge(dragUnit, target) ? '#ffd54f' : '#4fc3f7';
      const c = tileCenter(to);
      roundRect(ctx, c.x - TILE / 2, c.y - TILE / 2, TILE, TILE, 10);
      ctx.fillStyle = color + '66';
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = 4;
      ctx.stroke();
    }
    // Hint matching partners
    g.tiles.forEach((u, i) => {
      if (i !== drag.from && canMerge(dragUnit, u)) {
        const c = tileCenter(i);
        roundRect(ctx, c.x - TILE / 2 + 2, c.y - TILE / 2 + 2, TILE - 4, TILE - 4, 9);
        ctx.strokeStyle = `rgba(255,213,79,${0.5 + 0.4 * Math.sin(t * 10)})`;
        ctx.lineWidth = 3;
        ctx.stroke();
      }
    });
  }

  if (sel) {
    const c = tileCenter(selected);
    roundRect(ctx, c.x - TILE / 2, c.y - TILE / 2, TILE, TILE, 10);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  // Units
  g.tiles.forEach((u, i) => {
    if (!u) return;
    const c = tileCenter(i);
    const pop = Math.max(0, 1 - (t - u.born) / 0.25);
    const scale = 1 + pop * 0.35 + (u.anim > 0 ? 0.1 : 0);
    ctx.globalAlpha = drag?.moved && drag.from === i ? 0.3 : 1;
    drawUnit(ctx, u.type, u.star, c.x, c.y, scale, t);
    ctx.globalAlpha = 1;
  });

  // Enemies, back to front
  [...g.enemies].sort((a, b) => pathPos(a.dist).y - pathPos(b.dist).y).forEach(e => drawEnemy(ctx, e, t));
  drawProjectiles(ctx, g);

  for (const r of g.rings) {
    const p = r.t / r.life;
    ctx.globalAlpha = 1 - p;
    ctx.strokeStyle = r.color;
    ctx.lineWidth = 5 * (1 - p) + 1;
    ctx.beginPath();
    ctx.arc(r.x, r.y, r.r * (0.3 + 0.7 * p), 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  for (const tx of g.texts) {
    const p = tx.t / tx.life;
    ctx.globalAlpha = 1 - Math.max(0, p - 0.6) / 0.4;
    outlined(ctx, tx.text, tx.x, tx.y - p * 34, tx.size, tx.color);
  }
  ctx.globalAlpha = 1;

  if (drag && dragUnit) drawUnit(ctx, dragUnit.type, dragUnit.star, drag.x, drag.y - 10, 1.15, t);

  drawHud(ctx, g);
  drawBanner(ctx, g);
  ctx.restore();
}

// --- Component ---

export default function TowerDefense() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game>(createGame());
  const dragRef = useRef<Drag | null>(null);
  const selectedRef = useRef(-1);
  const speedRef = useRef(1);
  const pausedRef = useRef(true);

  const [screen, setScreen] = useState<'start' | 'playing' | 'over'>('start');
  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [best, setBest] = useState(readBest);
  const [hud, setHud] = useState<Hud>({ coins: 0, cost: 0, wave: 1, over: null, canSummon: false, selected: null });

  const syncHud = () => {
    const g = gameRef.current;
    const idx = selectedRef.current;
    const unit = idx >= 0 ? g.tiles[idx] : null;
    if (idx >= 0 && !unit) selectedRef.current = -1;
    setHud({
      coins: g.coins,
      cost: g.summonCost,
      wave: g.wave,
      over: g.over,
      canSummon: canSummon(g),
      selected: unit ? { idx, unit: { ...unit } } : null,
    });
  };

  // Main loop: fixed sub-steps, render every frame
  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = W * dpr;
    canvas.height = H * dpr;

    const bg = document.createElement('canvas');
    bg.width = W * dpr;
    bg.height = H * dpr;
    const bgCtx = bg.getContext('2d')!;
    bgCtx.scale(dpr, dpr);
    drawBackground(bgCtx);

    let raf = 0;
    let last = performance.now();
    let hudTimer = 0;
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const g = gameRef.current;
      if (!pausedRef.current && !g.over) {
        for (let i = 0; i < speedRef.current; i++) step(g, dt);
        if (g.over) {
          const reached = g.wave;
          setBest(prev => {
            if (reached > prev) saveBest(reached);
            return Math.max(prev, reached);
          });
          setScreen('over');
        }
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      render(ctx, bg, g, dragRef.current, selectedRef.current);
      hudTimer += dt;
      if (hudTimer > 0.1) {
        hudTimer = 0;
        syncHud();
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    document.fonts?.load(`40px "Black Han Sans"`).catch(() => {});
    if (import.meta.env.DEV) (window as unknown as { __td: typeof gameRef }).__td = gameRef;
    return () => cancelAnimationFrame(raf);
  }, []);

  // Space bar summons
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' && screen === 'playing') {
        e.preventDefault();
        handleSummon();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [screen]);

  const toLogical = (e: React.PointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: ((e.clientX - rect.left) / rect.width) * W, y: ((e.clientY - rect.top) / rect.height) * H };
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (screen !== 'playing' || pausedRef.current) return;
    const { x, y } = toLogical(e);
    const idx = tileAt(x, y);
    if (idx >= 0 && gameRef.current.tiles[idx]) {
      dragRef.current = { from: idx, x, y, moved: false };
      e.currentTarget.setPointerCapture(e.pointerId);
    } else {
      selectedRef.current = -1;
      syncHud();
    }
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const { x, y } = toLogical(e);
    const c = tileCenter(drag.from);
    if (!drag.moved && Math.hypot(x - c.x, y - c.y) > 14) drag.moved = true;
    drag.x = x;
    drag.y = y;
  };

  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag) return;
    if (!drag.moved) {
      selectedRef.current = selectedRef.current === drag.from ? -1 : drag.from;
    } else {
      const { x, y } = toLogical(e);
      const result = moveUnit(gameRef.current, drag.from, tileAt(x, y));
      if (result === 'merged') navigator.vibrate?.(30);
      selectedRef.current = -1;
    }
    syncHud();
  };

  const handleSummon = () => {
    if (pausedRef.current) return;
    if (summon(gameRef.current) >= 0) navigator.vibrate?.(10);
    syncHud();
  };

  const handleSell = () => {
    if (selectedRef.current < 0) return;
    sellUnit(gameRef.current, selectedRef.current);
    selectedRef.current = -1;
    syncHud();
  };

  const startGame = () => {
    gameRef.current = createGame();
    selectedRef.current = -1;
    dragRef.current = null;
    pausedRef.current = false;
    setPaused(false);
    setScreen('playing');
    syncHud();
  };

  const togglePause = () => {
    pausedRef.current = !pausedRef.current;
    setPaused(pausedRef.current);
  };

  const toggleSpeed = () => {
    speedRef.current = speedRef.current === 1 ? 2 : 1;
    setSpeed(speedRef.current);
  };

  const sel = hud.selected;
  const selStats = sel ? unitStats(sel.unit) : null;
  const g = gameRef.current;

  return (
    <div className="min-h-[100dvh] bg-[#0f1f0f] text-white font-sans flex flex-col items-center select-none">
      <div
        className="relative w-full flex flex-col"
        style={{ maxWidth: `min(480px, calc((100dvh - 168px) * ${W / H}))` }}
      >
        {/* Top bar */}
        <div className="flex items-center justify-between px-3 h-11">
          <Link to="/" className="p-2 -ml-2 text-zinc-400 hover:text-white"><ArrowLeft className="w-5 h-5" /></Link>
          <span className="text-sm text-zinc-400">최고 기록 <b className="text-[#ffe53b]">WAVE {best}</b></span>
          <button onClick={togglePause} disabled={screen !== 'playing'} className="p-2 -mr-2 text-zinc-400 hover:text-white disabled:opacity-30">
            {paused ? <Play className="w-5 h-5" /> : <Pause className="w-5 h-5" />}
          </button>
        </div>

        <div className="relative">
          <canvas
            ref={canvasRef}
            className="w-full block rounded-xl touch-none"
            style={{ aspectRatio: `${W} / ${H}` }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={() => { dragRef.current = null; }}
          />

          {screen === 'start' && (
            <div className="absolute inset-0 rounded-xl bg-black/60 backdrop-blur-[2px] flex flex-col items-center justify-center px-6 text-center">
              <h1 className="game-title text-5xl sm:text-6xl leading-tight">
                <span className="text-white">도파민 터지는</span><br />
                <span className="text-[#ffe53b]">타워 디펜스</span>
              </h1>
              <ul className="mt-6 grid grid-cols-1 gap-1.5 text-sm text-zinc-200 text-left">
                {UNIT_TYPES.map(t => (
                  <li key={t} className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full border border-black" style={{ background: UNIT_DEFS[t].body }} />
                    <b>{UNIT_DEFS[t].name}</b>
                    <span className="text-zinc-400">{UNIT_DEFS[t].desc}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-5 text-sm text-zinc-300 leading-relaxed">
                코인으로 식물을 <b className="text-[#ffe53b]">소환</b>하고<br />
                같은 식물 · 같은 별끼리 <b className="text-[#ffe53b]">드래그해서 합성</b>!<br />
                몬스터가 {ENEMY_LIMIT}마리 쌓이거나 보스를 못 잡으면 패배
              </p>
              <button
                onClick={startGame}
                className="mt-7 px-12 py-4 rounded-full bg-[#ffe53b] text-black text-xl font-black shadow-[0_6px_0_#b59f00] active:translate-y-1 active:shadow-[0_2px_0_#b59f00] transition-all"
              >
                게임 시작
              </button>
            </div>
          )}

          {screen === 'over' && (
            <div className="absolute inset-0 rounded-xl bg-black/70 flex flex-col items-center justify-center px-6 text-center">
              <h2 className="game-title text-5xl text-[#ff8a80]">GAME OVER</h2>
              <p className="mt-4 text-zinc-300">
                {hud.over === 'boss' ? '보스를 제한 시간 안에 잡지 못했어요' : `몬스터가 ${ENEMY_LIMIT}마리 쌓였어요`}
              </p>
              <p className="game-title mt-6 text-4xl text-[#ffe53b]">WAVE {g.wave}</p>
              <p className="mt-2 text-sm text-zinc-400">처치 {g.kills}마리 · 최고 기록 WAVE {best}</p>
              <button
                onClick={startGame}
                className="mt-8 px-10 py-4 rounded-full bg-[#ffe53b] text-black text-lg font-black flex items-center gap-2 shadow-[0_6px_0_#b59f00] active:translate-y-1 active:shadow-[0_2px_0_#b59f00] transition-all"
              >
                <RotateCcw className="w-5 h-5" /> 다시 하기
              </button>
            </div>
          )}

          {screen === 'playing' && paused && (
            <button onClick={togglePause} className="absolute inset-0 rounded-xl bg-black/50 flex items-center justify-center">
              <span className="game-title text-5xl text-white">일시정지</span>
            </button>
          )}
        </div>

        {/* Controls */}
        <div className="px-3 pt-3 pb-4 flex flex-col gap-2.5">
          <div className="flex items-center gap-2 h-11">
            <div className="flex items-center gap-1.5 bg-black/40 rounded-full pl-2.5 pr-4 h-full">
              <Coins className="w-5 h-5 text-[#ffd54f]" />
              <span className="font-black text-lg tabular-nums">{hud.coins}</span>
            </div>
            {sel && selStats ? (
              <div className="flex-1 flex items-center justify-between gap-2 bg-black/40 rounded-full pl-4 pr-1 h-full min-w-0">
                <span className="flex flex-col leading-tight min-w-0">
                  <span className="text-sm truncate">
                    <b>{UNIT_DEFS[sel.unit.type].name}</b>
                    <span className="text-[#ffd54f]"> ★{sel.unit.star}</span>
                  </span>
                  <span className="text-xs text-zinc-400 truncate">DPS {formatNum(selStats.dmg * selStats.rate)} · {UNIT_DEFS[sel.unit.type].desc}</span>
                </span>
                <button onClick={handleSell} className="shrink-0 bg-[#e53935] hover:bg-[#ef5350] rounded-full px-3 h-9 text-sm font-bold">
                  판매 +{sellValue(sel.unit)}
                </button>
              </div>
            ) : (
              <p className="flex-1 text-xs text-zinc-500 leading-tight px-1">
                같은 식물 · 같은 별끼리 끌어다 놓으면 합성 (최대 ★{MAX_STAR}) · 탭하면 사거리/판매
              </p>
            )}
            <button
              onClick={toggleSpeed}
              className={`h-full px-3 rounded-full font-black flex items-center gap-1 ${speed === 2 ? 'bg-[#ff7043] text-white' : 'bg-black/40 text-zinc-300'}`}
            >
              <FastForward className="w-4 h-4" /> {speed}x
            </button>
          </div>

          <button
            onClick={handleSummon}
            disabled={screen !== 'playing' || !hud.canSummon}
            className="h-16 rounded-2xl bg-gradient-to-b from-[#ffe53b] to-[#ffb300] text-black font-black text-2xl flex items-center justify-center gap-3 shadow-[0_6px_0_#a06a00] active:translate-y-1 active:shadow-[0_2px_0_#a06a00] transition-all disabled:from-zinc-600 disabled:to-zinc-700 disabled:text-zinc-400 disabled:shadow-[0_6px_0_#3f3f46]"
          >
            <Sparkles className="w-6 h-6" /> 소환
            <span className="flex items-center gap-1 text-lg bg-black/15 rounded-full px-3 py-0.5">
              <Coins className="w-4 h-4" /> {hud.cost}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
