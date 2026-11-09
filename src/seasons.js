// Seasons (like the year in Terraria's and Stardew's farms): in the green worlds of free play every
// day of the game (10 minutes) is a season – spring, summer, autumn, winter, then spring again.
// The fields grow fast in spring, hardly at all in winter (farm.js), so bread is best put by before
// the cold comes: the settlers eat every morning (villagers.js). The leafy trees blossom in spring,
// turn red and gold in autumn and stand bare in winter, the pines get snow, and the rain falls as
// snow (weather.js, rainfx.js). The host counts the days (G.dayN, saved and sent with the game);
// the change is announced to everybody.
import { announce } from './announce.js';
import { GAME_MODES } from './modes.js';
import { treeSprite } from './sprites.js';
import { G } from './state.js';

const NAMES = ['Frühling', 'Sommer', 'Herbst', 'Winter'];
const NEWS = [
  'Der Frühling beginnt – die Felder wachsen schneller.',
  'Der Sommer beginnt.',
  'Der Herbst beginnt – legt Brot auf Vorrat, bald kommt der Winter.',
  'Der Winter beginnt – auf den Feldern wächst kaum etwas.',
];
// how fast grain grows in each season
const GROWTH = [1.3, 1, 0.8, 0.15];

// seasons only in the green worlds of the free modes (not in campaign levels, maps, the
// Tagesschacht or the tutorial: their worlds are made for one look)
function hasSeasons() {
  const M = GAME_MODES[G.mode];
  return !!M && !M.campaign && !M.pkg && !M.daily && !G.tut && G.biome === 'meadow';
}
// 0 spring … 3 winter, or null where there are no seasons
const season = () => (hasSeasons() ? (G.dayN || 0) % 4 : null);
const seasonName = () => (season() == null ? null : NAMES[season()]);
const growth = () => (season() == null ? 1 : GROWTH[season()]);
// is it cold here: the rain comes as snow
const cold = () => G.biome === 'winter' || season() === 3;

// every tick, with the clock (weather.js): a new day when the clock goes round (host)
function dayPassed(before) {
  if (G.netClient || G.dayT >= before) return;
  G.dayN = (G.dayN || 0) + 1;
  if (season() != null) announce(NEWS[season()]);
}

// the trees in the season's dress: the picture to draw instead of t.spr (cached per sprite)
const dress = new WeakMap(),
  snowy = {};
function treeLook(t) {
  const s = season();
  if (s == null || s === 1 || t.fall) return t.spr;
  if (t.type === 'pine') return s === 3 ? snowy[t.stage] || (snowy[t.stage] = treeSprite('snowpine', t.stage)) : t.spr;
  if (t.type !== 'oak') return t.spr;
  let m = dress.get(t.spr);
  if (!m) dress.set(t.spr, (m = {}));
  return m[s] || (m[s] = recolour(t.spr, s));
}
const AUTUMN = [
  [216, 134, 44],
  [200, 90, 40],
  [224, 176, 58],
  [184, 69, 42],
];
function recolour(src, s) {
  const c = document.createElement('canvas');
  c.width = src.width;
  c.height = src.height;
  const g = c.getContext('2d');
  g.drawImage(src, 0, 0);
  const img = g.getImageData(0, 0, c.width, c.height),
    d = img.data;
  for (let y = 0; y < c.height; y++)
    for (let x = 0; x < c.width; x++) {
      const i = (y * c.width + x) * 4,
        r = d[i],
        gg = d[i + 1],
        b = d[i + 2];
      // leaves: the green pixels
      if (!d[i + 3] || gg < r + 12 || gg < b) continue;
      const h = (x * 73856093) ^ (y * 19349663),
        k = ((h >>> 0) % 100) / 100,
        lum = (r + gg + b) / 3 / 110;
      if (s === 0) {
        // blossoms here and there
        if (k < 0.14) [d[i], d[i + 1], d[i + 2]] = k < 0.05 ? [255, 250, 246] : [244, 190, 210];
      } else if (s === 2) {
        const [ar, ag, ab] = AUTUMN[(h >>> 3) % AUTUMN.length];
        d[i] = Math.min(255, ar * lum);
        d[i + 1] = Math.min(255, ag * lum);
        d[i + 2] = Math.min(255, ab * lum);
      } else {
        // winter: bare, a little frost left on the twigs
        if (k < 0.2) [d[i], d[i + 1], d[i + 2]] = [222, 232, 240];
        else d[i + 3] = 0;
      }
    }
  g.putImageData(img, 0, 0);
  return c;
}

export { cold, dayPassed, growth, hasSeasons, season, seasonName, treeLook };
