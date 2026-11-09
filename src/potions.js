// Potions (like Terraria's and Noita's flasks): the glowing mushrooms on cave floors deep down
// (decor.js) can be picked with the action button. Brought to the castle they go into the store, and
// a brewing cauldron (a building) brews potions from them by itself (store.js AUTO). A player
// passing the castle takes one of each kind along; with one chosen in the bag the action button
// drinks it:
//   Heiltrank   – strength full again
//   Leuchttrank – a minute of a light twice as big
//   Grabtrank   – a minute of digging half again as fast
// Only the host picks, brews and pours; the picked mushrooms go to everybody with the game (the
// same mushrooms grow on every device, from the place), the light with the Wühler.
import { decor } from './decor.js';
import { addFloat } from './floats.js';
import { sfx } from './sound.js';
import { G, crew, parts } from './state.js';
import { stock, takeStock } from './store.js';
import { toast } from './ui.js';

const POTIONS = {
  potHeal: { name: 'Heiltrank', col: '#e8483a', sub: 'Volle Kraft' },
  potGlow: { name: 'Leuchttrank', col: '#ffe066', sub: 'Eine Minute lang doppelt so viel Licht' },
  potDig: { name: 'Grabtrank', col: '#6fd0ff', sub: 'Eine Minute lang anderthalbmal so schnell graben' },
};
const isPotion = t => !!POTIONS[t];
const MINUTE = 3600;
const key = d => d.x + ',' + d.y;

// ---- mushrooms ----
const shroomNear = c =>
  decor.find(d => d.kind === 'shroom' && !d.picked && Math.abs(d.x - (c.x + 3)) < 7 && Math.abs(d.y - (c.y + 10)) < 4) || null;
function shroomContext(c) {
  if (c.pid == null || c.inv.length >= 16) return null;
  const d = shroomNear(c);
  return d ? { label: 'Pflücken', fn: () => pick(c, d) } : null;
}
function pick(c, d) {
  if (d.picked || c.inv.length >= 16) return;
  d.picked = true;
  (G.picked ||= []).push(key(d));
  c.inv.push('shroom');
  addFloat(c.x + 3, c.y - 4, '+1', '#ffffff', 'shroom');
  sfx('pick', c.x, c.y);
  for (let q = 0; q < 6; q++) parts.push({ x: d.x, y: d.y - 2, vx: (Math.random() - 0.5), vy: -Math.random(), l: 24, c: '#9be3c8' });
  if (!G.shroomTip) {
    G.shroomTip = true;
    toast('Leuchtpilz! In der Burg einlagern – ein Braukessel braut Tränke daraus');
  }
}
// the picked ones a client hears about (net/sync.js), and after loading: gone from the cave floor
function applyPicked(list) {
  G.picked = list || [];
  if (!G.picked.length) return;
  const set = new Set(G.picked);
  for (const d of decor) if (d.kind === 'shroom' && set.has(key(d))) d.picked = true;
}

// ---- at the castle: one of each kind for the way (store.js arriveAtBase), players only ----
function takePotions(c) {
  if (c.pid == null || c.bot) return;
  for (const t of Object.keys(POTIONS))
    if (!c.inv.includes(t) && stock(t) > 0 && c.inv.length < 16) {
      takeStock(t, 1);
      c.inv.push(t);
    }
}

// ---- drinking ----
function potionContext(c) {
  const t = c.inv[c.isel];
  return isPotion(t) ? { label: 'Trinken', fn: () => drink(c, t) } : null;
}
function drink(c, t) {
  const k = c.inv.indexOf(t);
  if (k < 0 || c.dead) return;
  c.inv.splice(k, 1);
  if (c.isel >= c.inv.length) c.isel = Math.max(0, c.inv.length - 1);
  if (t === 'potHeal') c.energy = 100;
  if (t === 'potGlow') c.glowT = MINUTE;
  if (t === 'potDig') c.digT = MINUTE;
  const P = POTIONS[t];
  for (let q = 0; q < 12; q++) parts.push({ x: c.x + 3, y: c.y + 2, vx: (Math.random() - 0.5) * 1.2, vy: -Math.random() * 1.4, l: 30, c: P.col });
  addFloat(c.x + 3, c.y - 6, P.name, P.col);
  sfx('lift', c.x, c.y);
}
// every tick (host): the effects wear off
function potionTick() {
  if (G.netClient) return;
  for (const c of crew) {
    if (c.glowT > 0) c.glowT--;
    if (c.digT > 0) c.digT--;
  }
}

// the cauldron bubbles while it brews (drawn over the building)
function drawBrew(ctx, b, cx, cy) {
  if (!(b.busy > 0)) return;
  const x = b.x - cx,
    y = b.gy - b.h - cy;
  for (let k = 0; k < 3; k++) {
    const t = (G.frame + k * 17) % 50,
      px = x + 4 + ((k * 3 + (G.frame >> 4)) % 6),
      py = y + 3 - t / 10;
    ctx.fillStyle = k === 1 ? '#bff2dc' : '#7fe0b8';
    ctx.fillRect(Math.round(px), Math.round(py), 1, 1);
  }
}

export { POTIONS, applyPicked, drawBrew, isPotion, potionContext, potionTick, shroomContext, takePotions };
