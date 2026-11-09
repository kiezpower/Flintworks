// Back down to where you were digging (like SteamWorld Dig's tubes and Terraria's mirror): the
// castle remembers the last spot each player stood on deep down (more than 15 m below the
// surface), and its panel offers the trip back there for a few coins. Only in the free modes
// (campaign levels have their best times). The host remembers and moves; the command comes from
// the castle panel (ui.js).
import { register } from './commands.js';
import { addFloat } from './floats.js';
import { sfx } from './sound.js';
import { G, crew, parts } from './state.js';
import { LIQ, W, free, mat, surf } from './world.js';

const PRICE = 5,
  MIN = 60; // landscape pixels below the surface (15 m)
const depthOf = (x, y) => y + 10 - surf[Math.max(0, Math.min(W - 1, Math.round(x + 3)))];

// every half second (host): where each player stands, if it is deep down and on firm ground
function descendTick() {
  if (G.netClient || !G.richDeep) return;
  for (const c of crew) {
    if (c.pid == null || c.bot || c.dead || c.tumble || c.climb || c.ride != null) continue;
    if (depthOf(c.x, c.y) < MIN || free(c.x, c.y + 1, 6, 10)) continue;
    if (LIQ[mat[Math.round(c.y + 5) * W + Math.round(c.x + 3)]]) continue;
    c.lastDeep = [Math.round(c.x), Math.round(c.y)];
  }
}
// what the castle panel offers: null, or the depth in metres and the price
function descendOffer(c) {
  if (!G.richDeep || !c || !c.lastDeep) return null;
  return { m: Math.round(depthOf(c.lastDeep[0], c.lastDeep[1]) / 4), price: PRICE };
}
register('descend', c => {
  const o = descendOffer(c);
  if (!o || G.money < PRICE || c.dead) return;
  const [x, y] = c.lastDeep;
  // (the spot may have been dug away or filled since: the nearest free place above it)
  let ty = y;
  while (ty > y - 12 && !free(x, ty, 6, 10)) ty--;
  if (!free(x, ty, 6, 10)) return;
  G.money -= PRICE;
  for (let q = 0; q < 10; q++) parts.push({ x: c.x + 3, y: c.y + 5, vx: (Math.random() - 0.5) * 1.5, vy: -Math.random(), l: 24, c: '#c9bba0' });
  Object.assign(c, { x, y: ty, vx: 0, vy: 0, climb: false, hangle: false, tumble: false, hook: null });
  for (let q = 0; q < 10; q++) parts.push({ x: x + 3, y: ty + 5, vx: (Math.random() - 0.5) * 1.5, vy: -Math.random(), l: 24, c: '#c9bba0' });
  addFloat(x + 3, ty - 4, `-${PRICE}`, '#ffe066');
  sfx('lift', x, ty);
});

export { descendOffer, descendTick };
