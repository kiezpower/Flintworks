// The tutorial world: a fixed meadow with a short teaching path to the right of the castle. It
// teaches only the core loop – walk, jump, dig to gold, carry it home and sell it – the rest
// comes as tips in the first real round (lessons.js).
//
//   [castle]  start   ▲bump   ✦      flat … the normal world
//   ──────────────────█████───────────────
//                            ░gold░
//
// The bump is rock (no pick yet: it cannot be dug) and 7 px high: higher than a step (3 px),
// much lower than a jump (17 px), so the only way on is a jump. The gold lies just under the
// ground, close enough to dig to in a few strokes; a sparkle above it shows where.
import { blob } from './gen.js';
import { GAME_MODES } from './modes.js';
import { G, animals, crew, items, parts, trees } from './state.js';
import { AIR, EARTH, GOLD, H, ROCK, W, bg, mat, paint, shade, surf } from './world.js';

// x positions of the path; heights are relative to the castle's ground
const TUT = {
  bump: { x0: 140, x1: 146, up: 7 },
  gold: { x: 178, dy: 8 },
  end: 280, // the flat part ends here and blends into the normal world
};
const ground = () => surf[90];
const goldSpot = () => ({ x: TUT.gold.x, y: ground() + TUT.gold.dy });
const bumpTop = () => ({ x: (TUT.bump.x0 + TUT.bump.x1) / 2, y: ground() - TUT.bump.up });
// is there gold left in the vein (looked at a few pixels, cheap)
function goldLeft() {
  const g = goldSpot();
  for (let y = g.y - 4; y <= g.y + 4; y++)
    for (let x = g.x - 8; x <= g.x + 8; x++) if (mat[y * W + x] === GOLD) return true;
  return false;
}
// a twinkle on the ground above the vein, now and then, while the gold is still in there
function sparkle() {
  if (G.frame % 40 || !goldLeft()) return;
  const g = goldSpot(),
    x = g.x + Math.round((Math.random() - 0.5) * 10);
  parts.push({ x, y: ground() - 1, vx: 0, vy: -0.15, l: 30, c: '#fff3c0', g: 0 });
  parts.push({ x: x + 1, y: ground() - 2, vx: 0, vy: -0.1, l: 18, c: '#f2c230', g: 0 });
}

function set(x, y, m) {
  const i = y * W + x;
  mat[i] = m;
  bg[i] = m === AIR ? 0 : 1;
  paint(i);
}
function setup() {
  const gy = ground();
  // flat ground and plain earth below it, so nothing surprising lies on the way
  for (let x = 108; x < TUT.end; x++) {
    const t = Math.max(0, (x - (TUT.end - 40)) / 40),
      s = Math.round(gy * (1 - t) + surf[x] * t);
    for (let y = 0; y < Math.min(H - 12, s + 60); y++) {
      shade[y * W + x] = (shade[y * W + x] & 3) | (y > s && y <= s + 3 ? 4 : 0);
      set(x, y, y > s ? EARTH : AIR);
    }
    surf[x] = s;
  }
  // the bump: a low block of rock with rounded top corners, a little into the ground
  const B = TUT.bump;
  for (let y = gy - B.up + 1; y <= gy + 3; y++)
    for (let x = B.x0; x < B.x1; x++) {
      if (y === gy - B.up + 1 && (x === B.x0 || x === B.x1 - 1)) continue;
      set(x, y, ROCK);
    }
  for (let x = B.x0; x < B.x1; x++) surf[x] = gy - B.up;
  // a dense vein just under the ground
  blob(TUT.gold.x, gy + TUT.gold.dy, 7, 3, GOLD);
  for (let y = gy; y < gy + TUT.gold.dy + 10; y++)
    for (let x = TUT.gold.x - 14; x < TUT.gold.x + 14; x++) paint(y * W + x);
  // nothing on the path: no trees, no items, no animals nearby
  for (let k = trees.length - 1; k >= 0; k--) if (trees[k].x < TUT.end + 10) trees.splice(k, 1);
  for (let k = items.length - 1; k >= 0; k--) if (items[k].x < TUT.end + 20) items.splice(k, 1);
  for (let k = animals.length - 1; k >= 0; k--) if (animals[k].x < TUT.end + 60) animals.splice(k, 1);
  G.gas = [];
  // bright day for the first look (the clock stands still in the tutorial, weather.js)
  G.dayT = 0.3;
  // you start alone with empty pockets: only what is taught is in play
  crew.length = 1;
  crew[0].inv = [];
  crew[0].isel = 0;
}

GAME_MODES.tut = {
  name: 'Tutorial',
  desc: 'Die erste Schicht',
  biome: 'meadow',
  seed: 4711,
  diff: 'relaxed',
  goal: 1,
  prog: () => 0, // the tutorial itself ends the game
  stars: [99, 99],
  campaign: true,
  tutorial: true,
  evRate: 0,
  setup,
};

export { TUT, bumpTop, goldLeft, goldSpot, ground, sparkle };
