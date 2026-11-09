// Cave biomes deep down (like Terraria's underground biomes): in the free modes every world has a
// crystal cave and a mushroom cave, wide halls far below the surface with their own look. The
// crystal cave has gems in its walls, crystals on its floor and crystal beetles; the mushroom cave
// is full of glowing mushrooms (for potions, potions.js) and of spore toadstools that hop and
// poison. Entering one the first time is announced; once seen it shows on the map. Made with the
// world (on every device, from the seed, with its own random numbers); which are seen goes with
// the game.
import { announce } from './announce.js';
import { mkAnimal } from './entities.js';
import { GAME_MODES } from './modes.js';
import { G, animals, crew } from './state.js';
import { AIR, GEM, GRANITE, H, ROCK, W, bg, mat, surf } from './world.js';

const KIND = {
  crystal: { name: 'Kristallhöhle', news: 'Eine Kristallhöhle! Edelsteine in den Wänden – Vorsicht vor den Kristallkäfern.', foe: 'crawler', tint: 'rgba(110,200,255,0.10)', col: '#7fd8ff' },
  mushroom: { name: 'Pilzhöhle', news: 'Eine Pilzhöhle! Viele Leuchtpilze – Vorsicht vor den Sporenpilzen.', foe: 'spore', tint: 'rgba(120,240,160,0.10)', col: '#9be3c8' },
};
const RX = 38,
  RY = 14;

function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// is (x, y) inside zone z (a little margin)
const inZone = (z, x, y, m = 1) => ((x - z.x) / (z.rx * m)) ** 2 + ((y - z.y) / (z.ry * m)) ** 2 <= 1;
const zoneAt = (x, y, m = 1) => (G.zones || []).find(z => inZone(z, x, y, m)) || null;

// called by gen() after the hoards (free modes only)
function placeZones() {
  G.zones = [];
  const M = GAME_MODES[G.mode];
  if (!M || M.campaign || M.pkg || M.daily || G.tut || H < 240) return;
  const r = seeded(G.seed * 2654435769 + 0x27d4eb2f);
  ['crystal', 'mushroom'].forEach((kind, k) => {
    const x = Math.round(W * (k ? 0.62 : 0.2) + r() * W * 0.18),
      top = Math.max(surf[x] + 150, Math.floor(H * 0.6)),
      y = Math.min(H - RY - 8, Math.floor(top + r() * Math.max(1, H - RY - 10 - top)));
    const z = { kind, x, y, rx: RX, ry: RY, seen: false, col: KIND[kind].col };
    // the hall: a wide oval of air, a rock floor under its lower half
    for (let yy = y - RY; yy <= y + RY; yy++)
      for (let xx = x - RX; xx <= x + RX; xx++) {
        if (xx < 2 || xx >= W - 2 || yy < 2 || yy >= H - 2) continue;
        const i = yy * W + xx;
        if (mat[i] === GRANITE) continue;
        if (inZone(z, xx, yy) && yy < y + RY * 0.6) {
          mat[i] = AIR;
          bg[i] = 1;
        } else if (inZone(z, xx, yy, 1.12) && yy >= y + RY * 0.4) mat[i] = ROCK;
      }
    // (a firm, even floor all along the hall, even where another cave runs underneath)
    const fy = y + Math.round(RY * 0.6);
    for (let yy = fy; yy < fy + 3; yy++)
      for (let xx = x - RX + 3; xx <= x + RX - 3; xx++) if (mat[yy * W + xx] !== GRANITE) mat[yy * W + xx] = ROCK;
    // the crystal cave: small gem veins in its walls
    if (kind === 'crystal')
      for (let q = 0; q < 14; q++) {
        const a = r() * Math.PI * 2,
          gx = Math.round(x + Math.cos(a) * (RX + 3)),
          gy = Math.round(y + Math.sin(a) * (RY + 2));
        for (let yy = gy - 1; yy <= gy + 1; yy++)
          for (let xx = gx - 1; xx <= gx + 1; xx++) {
            const i = yy * W + xx;
            if (xx > 1 && xx < W - 1 && yy > 1 && yy < H - 1 && mat[i] !== AIR && mat[i] !== GRANITE && r() < 0.8) mat[i] = GEM;
          }
      }
    G.zones.push(z);
  });
}
// after the creatures (gen.js): each zone's own (not in relaxed worlds)
function zoneCreatures() {
  if (G.relaxed) return;
  for (const z of G.zones || [])
    for (let q = 0; q < 3; q++) {
      const a = mkAnimal(KIND[z.kind].foe, z.x - 24 + q * 22, z.y);
      a.y = z.y + Math.round(RY * 0.4) - a.h - 1;
      animals.push(a);
    }
}
// every half second (host): a player in a zone for the first time hears about it
function zoneTick() {
  if (G.netClient) return;
  for (const z of G.zones || []) {
    if (z.seen) continue;
    if (crew.some(c => c.pid != null && !c.bot && !c.dead && inZone(z, c.x + 3, c.y + 5))) {
      z.seen = true;
      announce(KIND[z.kind].news);
    }
  }
}

// the zone's light in the picture: a faint tint over the hall
function drawZones(ctx, cx, cy) {
  for (const z of G.zones || []) {
    const x = z.x - cx,
      y = z.y - cy;
    if (x < -z.rx || x > G.VW + z.rx || y < -z.ry || y > G.VH + z.ry) continue;
    ctx.fillStyle = KIND[z.kind].tint;
    ctx.beginPath();
    ctx.ellipse(x, y, z.rx, z.ry, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}
export { KIND as ZONE_KIND, drawZones, placeZones, zoneAt, zoneCreatures, zoneTick };
