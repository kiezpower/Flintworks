// The tutorial world: a fixed meadow with a short teaching path to the right of the castle.
// From left to right: castle, a flat plot for the first hut, two trees, a rock too high to jump
// over (blast it with a flint: what is left of it can be jumped) and a small gold vein just under
// the ground behind it.
//
//   [castle]  plot   🌲  🌲     ▲rock▲   gold
//   ─────────────────────────── █████ ──────────
//                               █████  ░░░
import { blob, plantTree } from './gen.js';
import { GAME_MODES } from './modes.js';
import { G, animals, crew, items, trees } from './state.js';
import { AIR, EARTH, GOLD, H, ROCK, W, bg, mat, paint, shade, surf } from './world.js';

// x positions of the path; heights are relative to the castle's ground
const TUT = {
  plot: 130, // stand here to build the hut
  trees: [160, 176],
  // a thrown flint hits 9–22 px above the ground; narrow enough that one blast cuts right through
  rock: { x0: 212, x1: 220, up: 26, down: 6 },
  gold: { x: 238, dy: 12 },
  end: 330, // the flat part ends here and blends into the normal world
};
const ground = () => surf[90];
// the way through the rock is open when a Wühler fits through (11 px) above a stump it can jump
const rockOpen = () => {
  const R = TUT.rock,
    gy = ground();
  const clear = y => {
    for (let x = R.x0; x < R.x1; x++) if (mat[y * W + x] === ROCK) return false;
    return true;
  };
  for (let b = 0, run = 0; b < 26; b++) {
    run = clear(gy - b) ? run + 1 : 0;
    if (run >= 11) return true;
    if (b - run > 15) return false;
  }
  return false;
};
// after the blast: loose splinters on the path would block digging, a cap left floating over
// the gap goes too, and the hole shows sky again instead of a cave wall
function tidyRock() {
  const R = TUT.rock,
    gy = ground();
  for (let x = R.x0 - 40; x < TUT.end; x++) {
    const needle = x >= R.x0 && x < R.x1;
    let stump = needle;
    for (let y = gy; y >= gy - R.up - 12; y--) {
      const i = y * W + x;
      if (mat[i] !== ROCK) stump = false;
      if ((mat[i] === ROCK && !stump) || (mat[i] === AIR && bg[i])) set(x, y, AIR);
    }
  }
}
const rockTop = () => ({ x: (TUT.rock.x0 + TUT.rock.x1) / 2, y: ground() - TUT.rock.up });
const goldSpot = () => ({ x: TUT.gold.x, y: ground() + TUT.gold.dy });

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
  // the rock: rounded on top, a little into the ground
  const R = TUT.rock,
    mid = (R.x0 + R.x1 - 1) / 2,
    half = (R.x1 - R.x0) / 2;
  for (let y = gy - R.up; y < gy + R.down; y++)
    for (let x = R.x0; x < R.x1; x++) {
      if (gy - y > R.up - 3 && Math.abs(x - mid) > half - (gy - y - R.up + 4)) continue;
      set(x, y, ROCK);
    }
  blob(TUT.gold.x, gy + TUT.gold.dy, 8, 4, GOLD);
  for (let y = gy; y < gy + TUT.gold.dy + 10; y++)
    for (let x = TUT.gold.x - 14; x < TUT.gold.x + 14; x++) paint(y * W + x);
  // only the two trees of the path, nothing lying around, no animals nearby
  for (let k = trees.length - 1; k >= 0; k--) if (trees[k].x < TUT.end + 10) trees.splice(k, 1);
  for (const x of TUT.trees) plantTree(x, 4);
  for (let k = items.length - 1; k >= 0; k--) if (items[k].x < TUT.end + 20) items.splice(k, 1);
  for (let k = animals.length - 1; k >= 0; k--) if (animals[k].x < TUT.end + 60) animals.splice(k, 1);
  G.gas = [];
  // you start alone; a helper turns up later in the tutorial
  crew.length = 1;
  crew[0].inv = ['flint', 'rock'];
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

export { TUT, goldSpot, ground, rockOpen, rockTop, tidyRock };
