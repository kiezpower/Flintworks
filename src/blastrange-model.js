// The practice pit owns its terrain, clock and score. It never touches a running world or RNG.
export const WIDTH = 240, HEIGHT = 120;
const GRAVITY = 0.12, ANGLE = Math.PI / 4;
export const surface = x => Math.round(43 + x * 0.07 + Math.sin(x * 0.08) * 2);
export const ORIGIN = { x: 24, y: surface(16) - 10 };
export function newRange() {
  const cells = new Uint8Array(WIDTH * HEIGHT);
  const veins = [[65, 65, 10, 8, 3], [95, 74, 12, 9, 3], [151, 77, 12, 8, 3],
    [182, 84, 11, 8, 3], [115, 94, 7, 5, 13], [213, 78, 8, 6, 13]];
  for (let y = 0; y < HEIGHT; y++) for (let x = 0; x < WIDTH; x++) {
    if (y < surface(x)) continue;
    let material = 1;
    for (const [vx, vy, rx, ry, m] of veins) if (((x - vx) / rx) ** 2 + ((y - vy) / ry) ** 2 < 1) material = m;
    cells[y * WIDTH + x] = material;
  }
  return { cells, target: 65, shots: 3, score: 0, chain: 0, clock: 0, bomb: null, blasts: [], events: [],
    barrels: [65, 94, 151, 181].map(x => ({ x, y: surface(x) + 12, due: null, depth: 0, spent: false })) };
}
export const busy = s => !!s.bomb || s.barrels.some(b => b.due != null);
export const finished = s => !s.shots && !busy(s);
export function aim(s, x) { s.target = Math.round(Math.max(45, Math.min(220, x))); }
function projectile(s) {
  const dx = s.target - ORIGIN.x, dy = surface(s.target) - ORIGIN.y;
  const speed = Math.sqrt(GRAVITY * dx * dx / (2 * Math.cos(ANGLE) ** 2 * (dx * Math.tan(ANGLE) + dy)));
  return { ...ORIGIN, vx: Math.cos(ANGLE) * speed, vy: -Math.sin(ANGLE) * speed, landed: false, fuse: 24, age: 0 };
}
const solid = (s, x, y) => y >= HEIGHT - 2 || (y >= 0 && !!s.cells[Math.floor(y) * WIDTH + Math.floor(x)]);
function move(s, b) {
  if (b.landed) return;
  b.vy += GRAVITY;
  const steps = Math.max(1, Math.ceil(Math.hypot(b.vx, b.vy)));
  for (let i = 0; i < steps; i++) {
    const x = b.x + b.vx / steps, y = b.y + b.vy / steps;
    if (x < 2 || x > WIDTH - 3 || solid(s, x, y + 2)) { b.landed = true; return; }
    b.x = x; b.y = y;
  }
}
export function trajectory(s) {
  const b = projectile(s), points = [];
  for (let i = 0; i < 180 && !b.landed; i++) { move(s, b); if (i % 3 === 0 || b.landed) points.push([b.x, b.y]); }
  return points;
}
export function fire(s) {
  if (!s.shots || busy(s)) return false;
  s.shots--; s.chain = 0; s.bomb = projectile(s);
  return true;
}
function explode(s, x, y, radius, depth) {
  let gold = 0, gems = 0;
  for (let yy = Math.max(0, Math.floor(y - radius)); yy < Math.min(HEIGHT - 2, y + radius); yy++)
    for (let xx = Math.max(0, Math.floor(x - radius)); xx < Math.min(WIDTH, x + radius); xx++) {
      if (Math.hypot(xx - x, yy - y) > radius) continue;
      const index = yy * WIDTH + xx, m = s.cells[index];
      if (m === 3) gold++;
      if (m === 13) gems++;
      s.cells[index] = 0;
    }
  const points = (gold + gems * 5) * (depth + 1);
  s.score += points; s.chain = Math.max(s.chain, depth);
  for (const b of s.barrels) if (!b.spent && b.due == null && Math.hypot(b.x - x, b.y - y) <= radius + 3) {
    b.due = s.clock + 9; b.depth = depth + 1;
  }
  const blast = { x, y, radius, life: 20, depth, points };
  s.blasts.push(blast); s.events.push(blast);
}
export function tick(s) {
  s.clock++; s.events = [];
  for (const b of s.blasts) b.life--;
  s.blasts = s.blasts.filter(b => b.life > 0);
  if (s.bomb) {
    const b = s.bomb;
    move(s, b); b.age++;
    if ((b.landed && --b.fuse <= 0) || b.age > 240) { s.bomb = null; explode(s, b.x, b.y, 24, 0); }
  }
  for (const b of s.barrels) if (!b.spent && b.due != null && b.due <= s.clock) {
    b.spent = true; b.due = null; explode(s, b.x, b.y, 34, b.depth);
  }
}
