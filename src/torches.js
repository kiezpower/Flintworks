// Torches (like Terraria's): the castle makes them from wood and coal (store.js AUTO), a player
// passing by takes up to three along, and with one chosen in the bag the action button sets it
// against a wall: a small fire that keeps lighting the place for good, shows on the map and
// uncovers the map around it (fog.js). When the wall behind it is dug away, the torch falls off.
// Only the host sets and checks them; everybody gets them with the game (G.torches: [x, y]).
import { register } from './commands.js';
import { addFloat } from './floats.js';
import { sfx } from './sound.js';
import { G, crew, parts } from './state.js';
import { stock, takeStock } from './store.js';
import { W, mat, solid } from './world.js';

const MAX = 60;

// the wall a torch can stand against: beside the Wühler, at chest height
function wallSpot(c) {
  const y = Math.round(c.y + 4);
  for (const side of [c.face || 1, -(c.face || 1)]) {
    const x = side > 0 ? Math.round(c.x + 7) : Math.round(c.x - 1);
    if (solid(x, y) && !solid(x - side, y)) return [x - side, y];
  }
  return null;
}
function torchContext(c) {
  if (c.inv[c.isel] !== 'torch') return null;
  const s = wallSpot(c);
  return s ? { label: 'Fackel setzen', fn: () => setTorch(c, s) } : null;
}
function setTorch(c, s) {
  const k = c.inv.indexOf('torch');
  if (k < 0) return;
  c.inv.splice(k, 1);
  if (c.isel >= c.inv.length) c.isel = Math.max(0, c.inv.length - 1);
  G.torches = (G.torches || []).filter(t => Math.abs(t[0] - s[0]) > 2 || Math.abs(t[1] - s[1]) > 2);
  G.torches.push(s);
  if (G.torches.length > MAX) G.torches.shift();
  sfx('fuse', s[0], s[1], 0.5);
  G.invKey = '';
}
// every half second (host): a torch whose wall is gone falls off
function torchTick() {
  if (G.netClient || !G.torches || !G.torches.length) return;
  G.torches = G.torches.filter(([x, y]) => {
    if (solid(x - 1, y) || solid(x + 1, y)) return true;
    for (let q = 0; q < 6; q++) parts.push({ x, y, vx: (Math.random() - 0.5), vy: -Math.random(), l: 20, c: '#ff9a3a' });
    return false;
  });
}
// at the castle (store.js arriveAtBase): up to three for the way, players only
function takeTorches(c) {
  if (c.pid == null || c.bot) return;
  let have = c.inv.filter(t => t === 'torch').length;
  while (have < 3 && stock('torch') > 0 && c.inv.length < 16) {
    takeStock('torch', 1);
    c.inv.push('torch');
    have++;
  }
}

// the picture: a stick with a flickering flame
function drawTorches(ctx, cx, cy) {
  for (const [x, y] of G.torches || []) {
    const sx = Math.round(x - cx),
      sy = Math.round(y - cy);
    if (sx < -6 || sx > G.VW + 6 || sy < -8 || sy > G.VH + 6) continue;
    const f = (G.frame + x * 7) % 12 < 6;
    ctx.fillStyle = '#24160c';
    ctx.fillRect(sx - 1, sy - 4, 3, 7);
    ctx.fillStyle = '#8b5e34';
    ctx.fillRect(sx, sy - 1, 1, 4);
    ctx.fillStyle = f ? '#ff8a2a' : '#ffb347';
    ctx.fillRect(sx, sy - 3, 1, 2);
    ctx.fillStyle = '#fff2a0';
    ctx.fillRect(sx, f ? sy - 3 : sy - 2, 1, 1);
  }
}
// on the map: small orange dots
function markTorches(mctx, MK) {
  mctx.fillStyle = '#ffb347';
  for (const [x, y] of G.torches || []) mctx.fillRect(Math.floor(x / MK), Math.floor(y / MK), 1, 1);
}

export { drawTorches, markTorches, takeTorches, torchContext, torchTick };
