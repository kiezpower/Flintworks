// The map shows only what has been seen (like Terraria's and Noita's maps): in the free modes the
// ground is dark on the map until a Wühler (a player or a helper) has been close to it. The sky
// and a strip under the surface are always known. So gold, caves, shrines and hoards have to be
// found – the treasure map (hoards.js) shows the way to one. Campaign levels, maps and the
// Tagesschicht keep the whole map. Counted in map cells (4 × 4 landscape pixels); every device
// uncovers around the Wühler it knows of, and the save keeps it.
import { G, crew } from './state.js';
import { H, W, surf } from './world.js';

const MK = 4,
  R = 9; // how far a Wühler sees, in map cells (36 landscape pixels)
let seen = null,
  MW = 0,
  MH = 0;

// (set with the world by gen.js: free modes only; a loaded game has it when its save has fog)
const fogOn = () => !!G.fogOn;
// a new world: only the sky and the strip under the surface are known
function resetFog() {
  MW = Math.ceil(W / MK);
  MH = Math.ceil(H / MK);
  seen = new Uint8Array(MW * MH);
  for (let mx = 0; mx < MW; mx++) {
    const top = Math.floor((surf[Math.min(W - 1, mx * MK)] + 12) / MK);
    for (let my = 0; my <= Math.min(MH - 1, top); my++) seen[my * MW + mx] = 1;
  }
}
// every few ticks: what is around each Wühler is seen
function fogTick() {
  if (!seen || MW !== Math.ceil(W / MK) || MH !== Math.ceil(H / MK)) resetFog();
  // (torches keep the place around them seen, torches.js)
  for (const [x, y] of G.torches || []) uncover(Math.floor(x / MK), Math.floor(y / MK), 6);
  for (const c of crew)
    if (!c.dead) uncover(Math.floor((c.x + 3) / MK), Math.floor((c.y + 5) / MK), c.glowT > 0 ? R * 2 : R);
}
// a disc of map cells around (cx, cy), radius r, is seen
function uncover(cx, cy, r) {
  for (let dy = -r; dy <= r; dy++) {
    const y = cy + dy;
    if (y < 0 || y >= MH) continue;
    const w = Math.floor(Math.sqrt(r * r - dy * dy));
    for (let x = Math.max(0, cx - w); x <= Math.min(MW - 1, cx + w); x++) seen[y * MW + x] = 1;
  }
}
// is this map cell known (always, where there is no fog)
const known = (mx, my) => !fogOn() || !seen || seen[my * MW + mx] === 1;
const knownAt = (x, y) => known(Math.floor(x / MK), Math.floor(y / MK));

// for the save: the seen cells, eight to a byte
function fogPack() {
  if (!seen || !fogOn()) return null;
  const out = new Uint8Array(Math.ceil(seen.length / 8));
  for (let k = 0; k < seen.length; k++) if (seen[k]) out[k >> 3] |= 1 << (k & 7);
  return out;
}
function fogUnpack(u8) {
  resetFog();
  // (a save from before the fog knew the whole map)
  if (!u8) return seen.fill(1);
  for (let k = 0; k < seen.length; k++) if (u8[k >> 3] & (1 << (k & 7))) seen[k] = 1;
}

export { fogOn, fogPack, fogTick, fogUnpack, known, knownAt, resetFog };
