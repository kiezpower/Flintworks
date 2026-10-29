// Skins bought with crystals: outfits for the Wühler (jacket, belt and trousers recoloured) and
// building styles (the wooden parts of every building sprite recoloured). Only looks: they are
// sent to the other players with the name and cap and work in every mode, Versus included.
import { SPR } from './sprites.js';

// palette overrides for portrait.js ART (T/t/L jacket, b/g belt, p/P trousers)
const OUTFITS = {
  blue: { name: 'Blauer Kittel', k: 0, pal: {} },
  green: {
    name: 'Förstergrün',
    k: 40,
    pal: { T: '#3f7a3a', t: '#2c5a2a', L: '#6aa85c', p: '#4a3a22', P: '#3a2c1a' },
  },
  red: { name: 'Feuerrot', k: 60, pal: { T: '#a83a2a', t: '#7a2a1e', L: '#d86a4a', g: '#f0d060' } },
  leather: {
    name: 'Lederschurz',
    k: 80,
    pal: { T: '#8a5a32', t: '#6a4022', L: '#b07a4a', b: '#2e1d12', g: '#c0c6cc' },
  },
  night: {
    name: 'Nachtschicht',
    k: 120,
    pal: { T: '#34343e', t: '#22222a', L: '#5a5a6a', b: '#121216', g: '#9ad0ff', p: '#2a2a32', P: '#1c1c22' },
  },
  royal: {
    name: 'Königsrobe',
    k: 200,
    pal: { T: '#6a3a9a', t: '#4a2672', L: '#9a6ad0', b: '#e0b844', g: '#fff2a0', p: '#4a2672', P: '#36184f' },
  },
};
const BSTYLES = {
  wood: { name: 'Holzbau', k: 0 },
  stone: { name: 'Steinbau', k: 100 },
  winter: { name: 'Winterkleid', k: 150 },
  gold: { name: 'Goldglanz', k: 300 },
};
const outfitPal = id => (OUTFITS[id] || OUTFITS.blue).pal;

// what travels with the player: "outfit.style" (one short field, see server/relay.js)
const skinTag = (outfit, style) => `${OUTFITS[outfit] ? outfit : 'blue'}.${BSTYLES[style] ? style : 'wood'}`;
function parseSkin(s) {
  const [o, b] = String(s || '').split('.');
  return { outfit: OUTFITS[o] ? o : 'blue', style: BSTYLES[b] ? b : 'wood' };
}

// ---- building styles: the woody browns of a sprite take the style's colours ----
function hsl(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;
  const mx = Math.max(r, g, b),
    mn = Math.min(r, g, b),
    l = (mx + mn) / 2,
    d = mx - mn;
  if (!d) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [(h * 60 + 360) % 360, s, l];
}
function rgb(h, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s,
    x = c * (1 - Math.abs(((h / 60) % 2) - 1)),
    m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}
const clamp01 = v => Math.max(0, Math.min(1, v));
const RECOLOR = {
  stone: (h, s, l) => [30, 0.06, clamp01(l * 1.05)],
  winter: (h, s, l) => [210, 0.18, clamp01(l * 1.12 + 0.06)],
  gold: (h, s, l) => [44, clamp01(s + 0.35), clamp01(l * 1.15 + 0.05)],
};
const cache = new Map();
function restyle(spr, style) {
  const key = spr;
  let byStyle = cache.get(key);
  if (!byStyle) cache.set(key, (byStyle = {}));
  if (byStyle[style]) return byStyle[style];
  const w = spr.width,
    h = spr.height,
    out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const g = out.getContext('2d');
  g.drawImage(spr, 0, 0);
  const id = g.getImageData(0, 0, w, h),
    d = id.data,
    f = RECOLOR[style];
  for (let i = 0; i < d.length; i += 4) {
    if (!d[i + 3]) continue;
    const [hh, ss, ll] = hsl(d[i], d[i + 1], d[i + 2]);
    // wood: orange-brown hues, not too bright (windows and lamps stay as they are)
    if (hh < 12 || hh > 48 || ss < 0.18 || ll < 0.12 || ll > 0.72) continue;
    const [r, gg, b] = rgb(...f(hh, ss, ll));
    d[i] = r;
    d[i + 1] = gg;
    d[i + 2] = b;
  }
  // winter: snow on every top edge
  if (style === 'winter')
    for (let x = 0; x < w; x++)
      for (let y = 0; y < h; y++) {
        const i = (y * w + x) * 4;
        if (!d[i + 3]) continue;
        d[i] = 240;
        d[i + 1] = 246;
        d[i + 2] = 252;
        break;
      }
  g.putImageData(id, 0, 0);
  return (byStyle[style] = out);
}
// the sprite of a building in its owner's style
function buildSprite(b) {
  const spr = SPR[b.type];
  if (!spr || !b.skin || b.skin === 'wood' || !RECOLOR[b.skin] || typeof document === 'undefined') return spr;
  return restyle(spr, b.skin);
}

export { BSTYLES, OUTFITS, buildSprite, outfitPal, parseSkin, restyle, skinTag };
