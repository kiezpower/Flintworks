// Preview pictures of levels and maps for the level selection: the whole world in the colours of
// the map (one picture pixel = 2 world pixels), the sky in the colour of the world type, with the
// castle and the goals marked. Made ahead by `npm run previews` from the real worlds
// (public/previews/<id>.png); a level without a picture (a new one, an editor draft) is painted
// from its map.txt instead.
import { BIOMES } from '../biomes.js';
import { G, animals, builds, crew } from '../state.js';
import { H, MINI, W, bg, mat } from '../world.js';
import { CHARS } from './palette.js';
import PREVIEWS from './previews.json';

const S = 2; // world pixels per picture pixel
const CAVE = '#2a1a10',
  CASTLE = '#f3ead8',
  GOAL = '#ffffff',
  CHEST = '#ffd23a',
  MONSTER = '#ff4040';
const skyOf = biome => `rgb(${BIOMES[biome || 'meadow'].sky[0].join(',')})`;
const colOf = (m, b, sky) => (m ? MINI[m] : b ? CAVE : sky);

// the markers on top: castle(s), what the goals are about, monsters
function marks(cx, L, k) {
  const dot = (x, y, col, w = 5, h = 5) => {
    cx.fillStyle = col;
    cx.fillRect(Math.round(x / k - w / 2), Math.round(y / k - h / 2), w, h);
  };
  cx.fillStyle = CASTLE;
  for (const b of builds) if (b.type === 'base') cx.fillRect(b.x / k, (b.gy - b.h) / k, b.w / k, b.h / k);
  for (const a of animals) {
    if (a.lost) dot(a.x + 2, a.y + 2, GOAL);
    else if (a.kind === 'monster') dot(a.x + 6, a.y + 4, MONSTER, 6, 5);
  }
  for (const c of crew) if (c.trapped) dot(c.x + 3, c.y + 5, GOAL);
  const goals = (L && L.goals) || [];
  if (goals.some(g => g.t === 'chests')) for (const ch of G.chests || []) dot(ch.x + 4, ch.y + 3, CHEST, 6, 5);
  for (const g of goals)
    if (g.t === 'reach' && L.areas && L.areas[g.area]) {
      const a = L.areas[g.area],
        x = a[0] < 0 ? W + a[0] : a[0];
      cx.strokeStyle = GOAL;
      cx.lineWidth = 1;
      cx.strokeRect(Math.round(x / k) + 0.5, Math.round(a[1] / k) + 0.5, Math.round(a[2] / k), Math.round(a[3] / k));
    }
}

// the world as it is now (after gen) as a preview, for `npm run previews`
function worldPreview(L, biome) {
  const pw = Math.ceil(W / S),
    ph = Math.ceil(H / S),
    sky = skyOf(biome);
  const c = document.createElement('canvas');
  c.width = pw;
  c.height = ph;
  const cx = c.getContext('2d');
  for (let y = 0; y < ph; y++)
    for (let x = 0; x < pw; x++) {
      const i = y * S * W + x * S;
      cx.fillStyle = colOf(mat[i], bg[i], sky);
      cx.fillRect(x, y, 1, 1);
    }
  marks(cx, L, S);
  return c;
}
// a level package painted straight from its map (no '?' filling, no roughening, no markers)
function mapPreview(L) {
  const rows = L.map.split('\n').filter(r => r.length),
    sky = skyOf(L.biome);
  const c = document.createElement('canvas');
  c.width = rows[0].length;
  c.height = rows.length;
  const cx = c.getContext('2d');
  rows.forEach((r, y) =>
    [...r].forEach((ch, x) => {
      const [m, b] = CHARS[ch] || [0, 0];
      cx.fillStyle = colOf(m, b && !m, sky);
      cx.fillRect(x, y, 1, 1);
    }),
  );
  return c;
}
// a checksum of the world, kept with each picture: when it changes the picture is out of date
function worldHash() {
  let h = 2166136261;
  for (let i = 0; i < W * H; i++) {
    h ^= mat[i] | (bg[i] << 4);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}
// what the level selection shows: the picture made ahead, else one painted from the map
function previewOf(id, L) {
  if (PREVIEWS[id]) {
    const img = new Image();
    img.src = `previews/${id}.png`;
    img.alt = '';
    return img;
  }
  return L && L.map ? mapPreview(L) : null;
}

export { PREVIEWS, mapPreview, previewOf, worldHash, worldPreview };
