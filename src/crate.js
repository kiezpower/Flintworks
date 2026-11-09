// A storage chest deep down (like Terraria's chests): a small building that can only stand more
// than 15 m under the surface. Standing at it, the action button puts the finds from the bag into
// it (everything the castle would take: not flint, TNT, loam, bread, potions or torches), up to 30;
// with an empty bag it hands them back. Helpers with nothing to do fetch from a chest with six or
// more things in it and carry them home (helpers.js). The things go with the building (b.items).
import { addFloat } from './floats.js';
import { sfx } from './sound.js';
import { G, builds } from './state.js';
import { KEEP } from './store.js';

const CAP = 30;
const crateAt = c =>
  builds.find(b => b.type === 'crate' && b.done && c.x + 6 > b.x - 2 && c.x < b.x + b.w + 2 && Math.abs(c.y + 10 - b.gy) < 6) || null;
const storable = t => !KEEP.includes(t);

function crateContext(c) {
  const b = crateAt(c);
  if (!b) return null;
  b.items ||= [];
  if (c.inv.some(storable) && b.items.length < CAP) return { label: 'Ablegen', fn: () => putIn(c, b) };
  if (!c.inv.length && b.items.length) return { label: 'Aus der Truhe', fn: () => takeOut(c, b) };
  return null;
}
function putIn(c, b) {
  b.items ||= [];
  let n = 0;
  for (let k = c.inv.length - 1; k >= 0 && b.items.length < CAP; k--)
    if (storable(c.inv[k])) {
      b.items.push(c.inv.splice(k, 1)[0]);
      n++;
    }
  c.isel = Math.min(c.isel, Math.max(0, c.inv.length - 1));
  G.invKey = '';
  if (n) {
    addFloat(b.x + b.w / 2, b.gy - b.h - 3, `+${n}`, '#ffffff');
    sfx('clack', b.x, b.gy);
  }
}
// into a bag (a player's, or a helper's that fetches them): as many as fit
function takeOut(c, b, max = 16) {
  let n = 0;
  while (b.items && b.items.length && c.inv.length < max) {
    c.inv.push(b.items.pop());
    n++;
  }
  G.invKey = '';
  if (n) sfx('pick', b.x, b.gy);
  return n;
}
// a chest worth fetching from, for a helper (nobody else on it)
const crateToFetch = taken => builds.find(b => b.type === 'crate' && b.done && (b.items || []).length >= 6 && !taken(b)) || null;

export { crateContext, crateToFetch, takeOut };
