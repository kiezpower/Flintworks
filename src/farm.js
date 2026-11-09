// Farming (like OpenClonk's wheat, mill and bread): on a field (a building) grain grows in four
// stages, faster in the rain, slower in winter and in the desert. Ripe, a Wühler standing on it
// harvests it with the action button (3 grain, then it is sown again by itself). The mill makes
// bread from grain in the store, by itself (store.js AUTO). Bread stays in the bag; at the castle a
// Wühler without bread takes a loaf from the store, and when his strength runs low he eats it, wherever
// he is. Only the host grows and harvests; the fields' growth goes with the buildings (sync).
import { spawnItem } from './entities.js';
import { addFloat } from './floats.js';
import { track } from './profile.js';
import { sfx } from './sound.js';
import { growth } from './seasons.js';
import { G, builds, crew } from './state.js';
import { stock, takeStock } from './store.js';

const GROW = 150 * 60; // ticks from sown to ripe in fair weather
// how fast it grows here and now
// (and with the season in the green worlds, seasons.js)
const pace = () => (G.rainT > 0 ? 2 : 1) * (G.biome === 'winter' ? 0.4 : G.biome === 'desert' ? 0.6 : 1) * growth();
const ripe = b => (b.grow || 0) >= 1;
const fieldUnder = c =>
  builds.find(b => b.type === 'field' && b.done && c.x + 6 > b.x && c.x < b.x + b.w && Math.abs(c.y + 10 - b.gy) < 4) || null;

// every tick (host): the grain grows; Wühler eat when weak and take bread at the castle
function updFarm() {
  if (G.netClient) return;
  const p = pace() / GROW;
  for (const b of builds) if (b.type === 'field' && b.done && !ripe(b)) b.grow = Math.min(1, (b.grow || 0) + p);
  if (G.frame % 30) return;
  for (const c of crew) {
    if (c.dead) continue;
    if (c.energy < 35 && c.inv.includes('bread')) {
      c.inv.splice(c.inv.indexOf('bread'), 1);
      c.energy = Math.min(100, c.energy + 50);
      addFloat(c.x + 3, c.y - 4, '+50', '#cfe8a8', 'bread');
      sfx('coin', c.x, c.y, 0.5);
    }
  }
}
// at the castle (store.js arriveAtBase): a loaf for the way, if there is one and none in the bag
function takeBread(c) {
  if (c.inv.includes('bread') || stock('bread') < 1 || c.inv.length >= 16) return;
  takeStock('bread', 1);
  c.inv.push('bread');
}
// the action button on a ripe field
function farmContext(c) {
  const b = fieldUnder(c);
  if (!b || !ripe(b)) return null;
  return { label: 'Ernten', fn: () => harvestNow(c, b) };
}
function harvestNow(c, b = fieldUnder(c)) {
  if (!b || !ripe(b)) return;
  b.grow = 0;
  for (let k = 0; k < 3; k++) spawnItem('grain', b.x + 4 + k * 7, b.gy - 6, (k - 1) * 0.4, -1.6, 10);
  sfx('chop', c.x, c.y);
  track('harvest');
}

// the crop on a field: rows of stalks that grow, turn gold and get ears when ripe
function drawFarms(ctx, cx, cy) {
  for (const b of builds) {
    if (b.type !== 'field' || !b.done) continue;
    const sx = b.x - cx,
      sy = b.gy - cy;
    if (sx > G.VW + 4 || sx + b.w < -4) continue;
    const g = b.grow || 0,
      h = Math.max(1, Math.round(g * 7)),
      gold = g >= 1;
    for (let x = 2; x < b.w - 1; x += 3) {
      const sway = gold && (G.frame >> 4) % 2 && x % 2 ? 1 : 0;
      ctx.fillStyle = gold ? '#c9a43a' : g > 0.6 ? '#8fa83a' : '#5f9a3c';
      ctx.fillRect(sx + x + sway, sy - 3 - h, 1, h);
      if (gold) {
        ctx.fillStyle = '#f2c230';
        ctx.fillRect(sx + x + sway - 1, sy - 4 - h, 2, 2);
      }
    }
  }
}

export { drawFarms, farmContext, harvestNow, takeBread, updFarm };
