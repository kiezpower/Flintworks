// The tutorial world: Funkenhain, a small village whose hearth fire has gone out, and the way
// down to the Glutstein beneath it. Every part of the path teaches one thing (tutsteps.js):
//
//   [castle] hearth huts  ▲bump  well ↓shaft                                      ramp ↗ surface
//   ─────────────────────█████─────╥──────────────────────────────────────────────────╱─────
//                                  ║                                                ╱
//                     ┌────────────╨──┬──flint──┬──ore──┬beams┐      ┌───────────┬╱
//                     │   cave        █        ▓       ▓     │abyss │ cave-in   │ Glutstein room
//                     └───────────────┴────────┴───────┴─────┘      └───────────┘   ◆ on a rock
//
// The bump is rock (no pick yet) and 7 px high: higher than a step (3 px), lower than a jump
// (17 px). The shaft goes 22 px through plain earth into the first cave; the flint wall is rock
// (the pick comes with that step), the ore wall is ore. The abyss is 44 px wide: too far for a
// jump, short enough for one plank bridge (84 px). The cave-in corridor is where the ceiling
// comes down (tutscene.js), the ramp brings the Glutstein back up to the surface.
import { spawnItem } from './entities.js';
import { GAME_MODES } from './modes.js';
import { G, animals, crew, items, trees } from './state.js';
import { AIR, EARTH, H, ORE, ROCK, W, bg, mat, paint, shade, surf } from './world.js';

// x positions of the path; heights (dy) are below the castle's ground
const TUT = {
  hearth: { x: 130 },
  huts: [
    { x: 142, w: 18, h: 14 },
    { x: 166, w: 15, h: 11 },
  ],
  bump: { x0: 190, x1: 197, up: 7 },
  well: { x: 222 },
  shaft: { x: 240 },
  cave: { x0: 216, x1: 334, top: 22, floor: 38 }, // (air from top to floor-1)
  flint: { x0: 262, x1: 270 },
  ore: { x0: 294, x1: 302 },
  beams: [314, 322],
  gap: { x0: 334, x1: 378, deep: 72 },
  hall: { x0: 378, x1: 500 }, // the cave-in corridor (same height as the cave)
  room: { x0: 500, x1: 566, top: 8, floor: 46 },
  glut: { x: 533 },
  ramp: { x0: 566, x1: 658 },
  end: 720, // the flat part ends here and blends into the normal world
};
const DUSK = 0.55; // (the time of day while the fire is out; the finale turns it to noon)
const ground = () => surf[90];
const at = dy => ground() + dy;
const caveFloor = () => at(TUT.cave.floor);
const shaftSpot = () => ({ x: TUT.shaft.x, y: ground() });
const hearthSpot = () => ({ x: TUT.hearth.x, y: ground() });
const glutSpot = () => ({ x: TUT.glut.x, y: at(TUT.room.floor) - 4 });
// the floor of the ramp at x (y of the first solid row)
const rampFloor = x => Math.round(at(TUT.room.floor) - (x - TUT.ramp.x0) * (TUT.room.floor / (TUT.ramp.x1 - TUT.ramp.x0)));
// how many cells of a material are left in a box (cheap: the walls are small)
function left(x0, x1, y0, y1, m) {
  let n = 0;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) if (mat[y * W + x] === m) n++;
  return n;
}
const flintLeft = () => left(TUT.flint.x0, TUT.flint.x1, at(TUT.cave.top), caveFloor(), ROCK);
const FLINT_CELLS = (TUT.flint.x1 - TUT.flint.x0) * (TUT.cave.floor - TUT.cave.top);

function set(x, y, m) {
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const i = y * W + x;
  mat[i] = m;
  bg[i] = m === AIR ? 0 : 1;
  paint(i);
}
// air with a dug-out back wall (a cave, not open sky)
function hollow(x, y) {
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const i = y * W + x;
  mat[i] = AIR;
  bg[i] = 1;
  paint(i);
}
function setup() {
  const gy = ground();
  // flat ground and plain earth below it, so nothing surprising lies on the way
  for (let x = 108; x < TUT.end + 40; x++) {
    const t = Math.max(0, (x - TUT.end) / 40),
      s = Math.round(gy * (1 - t) + surf[x] * t);
    for (let y = 0; y < Math.min(H - 12, s + 112); y++) {
      shade[y * W + x] = (shade[y * W + x] & 3) | (y > s && y <= s + 3 ? 4 : 0);
      set(x, y, y > s ? EARTH : AIR);
    }
    surf[x] = s;
  }
  // the bump on the village road: a low block of rock with rounded top corners
  const B = TUT.bump;
  for (let y = gy - B.up + 1; y <= gy + 3; y++)
    for (let x = B.x0; x < B.x1; x++) {
      if (y === gy - B.up + 1 && (x === B.x0 || x === B.x1 - 1)) continue;
      set(x, y, ROCK);
    }
  for (let x = B.x0; x < B.x1; x++) surf[x] = gy - B.up;
  // the first cave, under the well
  const C = TUT.cave;
  for (let x = C.x0; x < C.x1; x++) {
    // (a slightly rounded ceiling at the far left end)
    const top = at(C.top) + (x - C.x0 < 4 ? 4 - (x - C.x0) : 0);
    for (let y = top; y < at(C.floor); y++) hollow(x, y);
  }
  // the flint wall (rock: the pick is needed) and the ore wall, each from floor to ceiling
  for (let y = at(C.top); y < at(C.floor); y++) {
    for (let x = TUT.flint.x0; x < TUT.flint.x1; x++) set(x, y, ROCK);
    for (let x = TUT.ore.x0; x < TUT.ore.x1; x++) set(x, y, ORE);
  }
  // the abyss: deep, with earth at the bottom
  const A = TUT.gap;
  for (let x = A.x0; x < A.x1; x++) for (let y = at(C.top); y < at(A.deep); y++) hollow(x, y);
  // the cave-in corridor, then a step down into the Glutstein room
  for (let x = TUT.hall.x0; x < TUT.hall.x1; x++) for (let y = at(C.top); y < at(C.floor); y++) hollow(x, y);
  const R = TUT.room;
  for (let x = R.x0; x < R.x1; x++) {
    const d = Math.abs(x - (R.x0 + R.x1) / 2) / ((R.x1 - R.x0) / 2),
      top = at(R.top) + Math.round(d * d * 8);
    for (let y = top; y < at(R.floor); y++) hollow(x, y);
  }
  // the Glutstein lies on a small rock
  for (let x = TUT.glut.x - 4; x < TUT.glut.x + 4; x++)
    for (let y = at(R.floor) - 3; y < at(R.floor); y++) if (!(y === at(R.floor) - 3 && (x === TUT.glut.x - 4 || x === TUT.glut.x + 3))) set(x, y, ROCK);
  // the ramp up to the surface: an old tunnel, 13 px high, rising 1 px every 2 px
  for (let x = TUT.ramp.x0 - 2; x < TUT.ramp.x1 + 2; x++) {
    const f = rampFloor(Math.min(TUT.ramp.x1, Math.max(TUT.ramp.x0, x)));
    for (let y = f - 13; y < f; y++) if (y > gy) hollow(x, y);
  }
  // the old beams of a broken bridge, at the edge of the abyss
  for (const x of TUT.beams) spawnItem('wood', x, caveFloor() - 3, 0, 0, 0);
  // nothing on the path: no trees, no animals; no gas
  for (let k = trees.length - 1; k >= 0; k--) if (trees[k].x < TUT.end + 10) trees.splice(k, 1);
  for (let k = items.length - 1; k >= 0; k--) if (items[k].x < TUT.end + 20 && items[k].t !== 'wood') items.splice(k, 1);
  for (let k = animals.length - 1; k >= 0; k--) if (animals[k].x < TUT.end + 60) animals.splice(k, 1);
  G.gas = [];
  if (G.chests) G.chests = G.chests.filter(ch => ch.x > TUT.end + 20);
  // dusk over the village: the fire is out (the clock stands still in the tutorial, weather.js);
  // the finale brings the day back (tutscene.js)
  G.dayT = DUSK;
  G.tutLit = 0;
  // you start alone with empty pockets: only what is taught is in play
  crew.length = 1;
  crew[0].inv = [];
  crew[0].isel = 0;
}

GAME_MODES.tut = {
  name: 'Tutorial',
  desc: 'Der Glutstein',
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

export { DUSK, FLINT_CELLS, TUT, at, caveFloor, flintLeft, glutSpot, ground, hearthSpot, rampFloor, shaftSpot };
