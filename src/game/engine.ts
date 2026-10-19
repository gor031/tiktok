// Pure game logic for the tower defense game (no DOM), so it can be simulated headlessly.

export const W = 540;
export const H = 760;
export const COLS = 4;
export const ROWS = 4;
export const TILE = 84;
export const GAP = 6;
export const BOARD_W = COLS * TILE + (COLS - 1) * GAP;
export const BOARD_H = ROWS * TILE + (ROWS - 1) * GAP;
export const PATH = { x0: 48, y0: 140, x1: 492, y1: 720 };
export const BOARD_X = (W - BOARD_W) / 2;
export const BOARD_Y = (PATH.y0 + PATH.y1) / 2 - BOARD_H / 2;
export const PATH_LEN = 2 * (PATH.x1 - PATH.x0 + PATH.y1 - PATH.y0);
export const ENEMY_LIMIT = 60;
export const MAX_STAR = 7;
export const BOSS_EVERY = 5;

export type UnitType = 'tomato' | 'melon' | 'sunflower' | 'cactus' | 'pepper';
type AttackKind = 'single' | 'splash' | 'rapid' | 'slow' | 'burn';

export interface UnitDef {
  name: string;
  desc: string;
  kind: AttackKind;
  body: string;
  accent: string;
  dmg: number;
  rate: number; // attacks per second
  range: number;
}

export const UNIT_DEFS: Record<UnitType, UnitDef> = {
  tomato: { name: '토마토 복서', desc: '강한 단일 공격', kind: 'single', body: '#e53935', accent: '#2e7d32', dmg: 22, rate: 1.0, range: 175 },
  melon: { name: '수박 대포', desc: '범위 폭발', kind: 'splash', body: '#43a047', accent: '#1b5e20', dmg: 13, rate: 0.6, range: 195 },
  sunflower: { name: '해바라기 거너', desc: '초고속 연사', kind: 'rapid', body: '#fdd835', accent: '#6d4c41', dmg: 6, rate: 3.2, range: 155 },
  cactus: { name: '선인장 궁수', desc: '적 감속', kind: 'slow', body: '#66bb6a', accent: '#f8bbd0', dmg: 10, rate: 1.2, range: 205 },
  pepper: { name: '고추 화염술사', desc: '지속 화상', kind: 'burn', body: '#ff7043', accent: '#388e3c', dmg: 8, rate: 0.9, range: 165 },
};
export const UNIT_TYPES = Object.keys(UNIT_DEFS) as UnitType[];

export interface Unit {
  id: number;
  type: UnitType;
  star: number;
  cooldown: number;
  anim: number;
  born: number;
}

export interface Enemy {
  id: number;
  hp: number;
  maxHp: number;
  speed: number;
  dist: number;
  boss: boolean;
  reward: number;
  slowT: number;
  slowF: number;
  burnT: number;
  burnDps: number;
  hitT: number;
  hue: number;
}

export interface Projectile {
  id: number;
  x: number;
  y: number;
  tx: number;
  ty: number;
  targetId: number;
  type: UnitType;
  star: number;
  dmg: number;
}

export interface FloatText { x: number; y: number; text: string; color: string; size: number; t: number; life: number }
export interface Ring { x: number; y: number; r: number; color: string; t: number; life: number }

export interface Game {
  time: number;
  wave: number;
  waveTime: number;
  waveDuration: number;
  toSpawn: number;
  spawnTimer: number;
  spawnInterval: number;
  coins: number;
  summonCost: number;
  tiles: (Unit | null)[];
  enemies: Enemy[];
  projectiles: Projectile[];
  texts: FloatText[];
  rings: Ring[];
  banner: { text: string; boss: boolean; t: number } | null;
  over: null | 'limit' | 'boss';
  kills: number;
  shake: number;
  nextId: number;
  rng: () => number;
}

export function isBossWave(wave: number) {
  return wave % BOSS_EVERY === 0;
}

export function enemyHp(wave: number) {
  return Math.round(26 * Math.pow(1.19, wave - 1) * (1 + wave * 0.02));
}

export function unitStats(u: Unit) {
  const def = UNIT_DEFS[u.type];
  return {
    dmg: def.dmg * Math.pow(2.25, u.star - 1),
    rate: def.rate * (1 + 0.12 * (u.star - 1)),
    range: def.range + 8 * (u.star - 1),
  };
}

export function sellValue(u: Unit) {
  return 8 * Math.pow(2, u.star - 1);
}

export function tileCenter(i: number) {
  const c = i % COLS;
  const r = Math.floor(i / COLS);
  return { x: BOARD_X + c * (TILE + GAP) + TILE / 2, y: BOARD_Y + r * (TILE + GAP) + TILE / 2 };
}

export function tileAt(x: number, y: number) {
  const c = Math.floor((x - BOARD_X) / (TILE + GAP));
  const r = Math.floor((y - BOARD_Y) / (TILE + GAP));
  if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return -1;
  const cx = x - BOARD_X - c * (TILE + GAP);
  const cy = y - BOARD_Y - r * (TILE + GAP);
  if (cx > TILE || cy > TILE) return -1;
  return r * COLS + c;
}

// Enemies walk clockwise around the castle, starting at the top-left corner
export function pathPos(dist: number) {
  const { x0, y0, x1, y1 } = PATH;
  const w = x1 - x0;
  const h = y1 - y0;
  let d = ((dist % PATH_LEN) + PATH_LEN) % PATH_LEN;
  if (d < w) return { x: x0 + d, y: y0 };
  d -= w;
  if (d < h) return { x: x1, y: y0 + d };
  d -= h;
  if (d < w) return { x: x1 - d, y: y1 };
  d -= w;
  return { x: x0, y: y1 - d };
}

export function createGame(rng: () => number = Math.random): Game {
  const g: Game = {
    time: 0,
    wave: 0,
    waveTime: 0,
    waveDuration: 0,
    toSpawn: 0,
    spawnTimer: 0,
    spawnInterval: 1,
    coins: 100,
    summonCost: 20,
    tiles: Array(COLS * ROWS).fill(null),
    enemies: [],
    projectiles: [],
    texts: [],
    rings: [],
    banner: null,
    over: null,
    kills: 0,
    shake: 0,
    nextId: 1,
    rng,
  };
  startWave(g, 1);
  return g;
}

function startWave(g: Game, wave: number) {
  g.wave = wave;
  g.waveTime = 0;
  const boss = isBossWave(wave);
  g.waveDuration = boss ? 40 : 20;
  g.toSpawn = boss ? 1 : Math.min(10 + wave, 36);
  g.spawnInterval = boss ? 0 : Math.min(1, 12 / g.toSpawn);
  g.spawnTimer = 0;
  if (wave > 1) g.coins += 10 + wave;
  g.banner = { text: boss ? '보스 소환 라운드' : `WAVE ${wave}`, boss, t: 0 };
}

function spawnEnemy(g: Game) {
  const boss = isBossWave(g.wave);
  const hp = enemyHp(g.wave) * (boss ? 12 + g.wave * 0.8 : 1);
  g.enemies.push({
    id: g.nextId++,
    hp,
    maxHp: hp,
    speed: boss ? 38 : 62 + Math.min(30, g.wave * 1.2),
    dist: 0,
    boss,
    reward: boss ? 60 + g.wave * 4 : 2 + Math.floor(g.wave / 4),
    slowT: 0,
    slowF: 0,
    burnT: 0,
    burnDps: 0,
    hitT: 0,
    hue: (g.wave * 47) % 360,
  });
  if (boss) g.shake = 0.5;
}

function addText(g: Game, x: number, y: number, text: string, color: string, size = 18, life = 0.8) {
  if (g.texts.length > 80) g.texts.shift();
  g.texts.push({ x, y, text, color, size, t: 0, life });
}

function damage(g: Game, e: Enemy, amount: number, showText: boolean) {
  if (e.hp <= 0) return;
  e.hp -= amount;
  e.hitT = 0.1;
  const p = pathPos(e.dist);
  if (showText) addText(g, p.x + (g.rng() - 0.5) * 16, p.y - 18, formatNum(amount), '#fff', e.boss ? 22 : 16, 0.6);
  if (e.hp <= 0) killEnemy(g, e);
}

function killEnemy(g: Game, e: Enemy) {
  g.coins += e.reward;
  g.kills++;
  const p = pathPos(e.dist);
  addText(g, p.x, p.y - 30, `+${e.reward}`, '#ffd54f', e.boss ? 34 : 18, 1);
  g.rings.push({ x: p.x, y: p.y, r: e.boss ? 90 : 26, color: e.boss ? '#ffd54f' : '#ffffff', t: 0, life: e.boss ? 0.6 : 0.3 });
  if (e.boss) {
    g.shake = 0.6;
    g.banner = { text: '보스 처치!', boss: false, t: 0 };
  }
}

export function formatNum(n: number) {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e4) return `${(n / 1e3).toFixed(0)}K`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return `${Math.round(n)}`;
}

function hit(g: Game, p: Projectile, target: Enemy | undefined) {
  const def = UNIT_DEFS[p.type];
  if (def.kind === 'splash') {
    const radius = 55 + 6 * p.star;
    g.rings.push({ x: p.tx, y: p.ty, r: radius, color: '#ff8a65', t: 0, life: 0.35 });
    for (const e of g.enemies) {
      const ep = pathPos(e.dist);
      if (Math.hypot(ep.x - p.tx, ep.y - p.ty) <= radius) damage(g, e, p.dmg, e === target);
    }
    return;
  }
  if (!target || target.hp <= 0) return;
  if (def.kind === 'slow') {
    target.slowT = 1.6;
    target.slowF = Math.max(target.slowF, Math.min(0.7, 0.3 + 0.06 * p.star));
  } else if (def.kind === 'burn') {
    target.burnT = 3;
    target.burnDps = Math.max(target.burnDps, p.dmg * 0.9);
  }
  damage(g, target, p.dmg, def.kind !== 'rapid');
}

export function step(g: Game, dt: number) {
  if (g.over) return;
  g.time += dt;
  g.waveTime += dt;
  g.shake = Math.max(0, g.shake - dt);
  if (g.banner) {
    g.banner.t += dt;
    if (g.banner.t > 1.8) g.banner = null;
  }

  // Spawning
  if (g.toSpawn > 0) {
    g.spawnTimer -= dt;
    while (g.toSpawn > 0 && g.spawnTimer <= 0) {
      spawnEnemy(g);
      g.toSpawn--;
      g.spawnTimer += g.spawnInterval;
    }
  }

  // Enemies move and burn
  for (const e of g.enemies) {
    const slow = e.slowT > 0 ? 1 - e.slowF : 1;
    e.dist += e.speed * slow * dt;
    e.slowT = Math.max(0, e.slowT - dt);
    if (e.slowT === 0) e.slowF = 0;
    e.hitT = Math.max(0, e.hitT - dt);
    if (e.burnT > 0) {
      e.burnT -= dt;
      e.hp -= e.burnDps * dt;
      if (e.hp <= 0) killEnemy(g, e);
      if (e.burnT <= 0) e.burnDps = 0;
    }
  }

  // Units focus the boss when it is in range, otherwise the enemy that has travelled furthest
  g.tiles.forEach((u, i) => {
    if (!u) return;
    u.anim = Math.max(0, u.anim - dt);
    u.cooldown -= dt;
    if (u.cooldown > 0) return;
    const { dmg, rate, range } = unitStats(u);
    const c = tileCenter(i);
    let best: Enemy | null = null;
    for (const e of g.enemies) {
      if (e.hp <= 0) continue;
      const p = pathPos(e.dist);
      if (Math.hypot(p.x - c.x, p.y - c.y) > range) continue;
      if (!best || (e.boss && !best.boss) || (e.boss === best.boss && e.dist > best.dist)) best = e;
    }
    if (!best) {
      u.cooldown = 0;
      return;
    }
    const tp = pathPos(best.dist);
    g.projectiles.push({ id: g.nextId++, x: c.x, y: c.y - 10, tx: tp.x, ty: tp.y, targetId: best.id, type: u.type, star: u.star, dmg });
    u.cooldown = 1 / rate;
    u.anim = 0.15;
  });

  // Projectiles home in on their target
  const byId = new Map(g.enemies.map(e => [e.id, e]));
  g.projectiles = g.projectiles.filter(p => {
    const target = byId.get(p.targetId);
    if (target && target.hp > 0) {
      const tp = pathPos(target.dist);
      p.tx = tp.x;
      p.ty = tp.y;
    }
    const dx = p.tx - p.x;
    const dy = p.ty - p.y;
    const d = Math.hypot(dx, dy);
    const move = 720 * dt;
    if (d <= move + 6) {
      hit(g, p, target && target.hp > 0 ? target : undefined);
      return false;
    }
    p.x += (dx / d) * move;
    p.y += (dy / d) * move;
    return true;
  });

  g.enemies = g.enemies.filter(e => e.hp > 0);

  for (const t of g.texts) t.t += dt;
  g.texts = g.texts.filter(t => t.t < t.life);
  for (const r of g.rings) r.t += dt;
  g.rings = g.rings.filter(r => r.t < r.life);

  // Lose conditions, then wave progression
  if (g.enemies.length >= ENEMY_LIMIT) {
    g.over = 'limit';
    return;
  }
  if (g.waveTime >= g.waveDuration) {
    if (isBossWave(g.wave) && g.enemies.some(e => e.boss)) {
      g.over = 'boss';
      return;
    }
    startWave(g, g.wave + 1);
  }
}

export function emptyTiles(g: Game) {
  return g.tiles.map((u, i) => (u ? -1 : i)).filter(i => i >= 0);
}

export function canSummon(g: Game) {
  return !g.over && g.coins >= g.summonCost && emptyTiles(g).length > 0;
}

export function summon(g: Game): number {
  if (!canSummon(g)) return -1;
  const empty = emptyTiles(g);
  const idx = empty[Math.floor(g.rng() * empty.length)];
  const type = UNIT_TYPES[Math.floor(g.rng() * UNIT_TYPES.length)];
  const lucky = g.rng() < 0.08;
  g.coins -= g.summonCost;
  g.summonCost += 1;
  g.tiles[idx] = { id: g.nextId++, type, star: lucky ? 2 : 1, cooldown: 0.3, anim: 0, born: g.time };
  const c = tileCenter(idx);
  if (lucky) addText(g, c.x, c.y - 40, '럭키! ★2', '#ffd54f', 22, 1.1);
  return idx;
}

export function canMerge(a: Unit | null, b: Unit | null) {
  return !!a && !!b && a.id !== b.id && a.type === b.type && a.star === b.star && a.star < MAX_STAR;
}

export function moveUnit(g: Game, from: number, to: number): 'moved' | 'merged' | 'swapped' | 'none' {
  if (g.over || from === to || from < 0 || to < 0) return 'none';
  const a = g.tiles[from];
  const b = g.tiles[to];
  if (!a) return 'none';
  if (!b) {
    g.tiles[to] = a;
    g.tiles[from] = null;
    return 'moved';
  }
  if (canMerge(a, b)) {
    b.star += 1;
    b.born = g.time;
    b.cooldown = 0.2;
    g.tiles[from] = null;
    const c = tileCenter(to);
    g.rings.push({ x: c.x, y: c.y, r: 60, color: '#ffd54f', t: 0, life: 0.45 });
    addText(g, c.x, c.y - 44, `LEVEL UP ★${b.star}`, '#ffd54f', 22, 1.1);
    return 'merged';
  }
  g.tiles[to] = a;
  g.tiles[from] = b;
  return 'swapped';
}

export function sellUnit(g: Game, idx: number) {
  const u = g.tiles[idx];
  if (!u || g.over) return 0;
  const value = sellValue(u);
  g.coins += value;
  g.tiles[idx] = null;
  const c = tileCenter(idx);
  addText(g, c.x, c.y - 30, `+${value}`, '#ffd54f', 20, 0.9);
  return value;
}
