// The characters of a level map (map.txt): every character is one material, standing for
// zoom × zoom cells of the world. Like the palette of Map.bmp in the original Clonk.
import { ACID, AIR, COAL, EARTH, GEM, GOLD, GRANITE, LAVA, LOAM, ORE, PLANK, ROCK, SAND, WATER } from '../world.js';

// [material, has a back wall (cave or tunnel)]
const CHARS = {
  '.': [AIR, 0], // sky
  ',': [AIR, 1], // cave or tunnel
  '#': [EARTH, 1],
  R: [ROCK, 1],
  S: [SAND, 1],
  L: [LOAM, 1],
  G: [GOLD, 1],
  O: [ORE, 1],
  C: [COAL, 1],
  E: [GEM, 1],
  X: [GRANITE, 1],
  P: [PLANK, 1],
  '~': [WATER, 1],
  '%': [LAVA, 1],
  A: [ACID, 1],
  '?': [EARTH, 1], // earth that the generator fills with stones, veins and caves (fill in level.json)
};
// these keep their exact outline: borders, pools and pipes must not leak
const FIXED = new Set([GRANITE, WATER, LAVA, ACID, PLANK]);

// Maps are bundled run-length encoded (vite.config.js): "RLE1:" and per row runs like "12.3#"
// (a count, then the character; the palette has no digits). Plain maps pass through.
function unpackMap(t) {
  if (!t.startsWith('RLE1:')) return t;
  return t
    .slice(5)
    .split('\n')
    .map(r => r.replace(/(\d+)(\D)/g, (_, n, c) => c.repeat(+n)))
    .join('\n');
}

export { CHARS, FIXED, unpackMap };
