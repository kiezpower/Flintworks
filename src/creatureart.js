// Painted creatures: one transparent atlas for animals, monsters and bosses.
// Hitboxes and behaviour are untouched; a frame is anchored to the feet (or the
// centre for flyers and swimmers). Missing art falls back to the pixel sprites.
import url from './assets/creatures/atlas.png';
import meta from './assets/creatures/atlas.json';
import cyclesUrl from './assets/creatures/cycles.png';
import cycles from './assets/creatures/cycles.json';

import uniqueUrl from './assets/creatures/unique.png';
import unique from './assets/creatures/unique.json';

// height of the idle frame in world cells; fly: centred on the hitbox instead of standing on it
const LOOK = {
  crawler: { h: 7.5 }, spore: { h: 9 }, guardian: { h: 18 },
  fluffel: { h: 5.5 },
  fish: { h: 3.2, fly: true },
  bat: { h: 5.5, fly: true },
  monster: { h: 10.5 },
  spider: { h: 7.5 },
  slime: { h: 7.5 },
  golem: { h: 15.5 },
  queen: { h: 17, flash: [255, 240, 208] },
  iceking: { h: 18, flash: [255, 255, 255] },
  worm: { h: 11, fly: true },
};
// Fallback palettes if the optional unique-species atlas is unavailable.
const VARIANT = {
  crawler: ['spider', (r, g, b) => [r * 0.35 + 25, g * 0.75 + 70, b * 0.8 + 95]],
  spore: ['slime', (r, g, b) => [g * 0.6, r * 0.75, b * 0.8 + 20]],
  guardian: ['golem', (r, g, b) => [r * 0.75 + 30, g * 0.6 + 5, b * 0.9 + 55]],
};
// where a companion's red collar sits, as a fraction of each Fluffel frame
const COLLAR = { idle: [0.68, 0.56], move: [0.64, 0.53], attack: [0.61, 0.62], walk0: [0.72, 0.5], walk1: [0.72, 0.5], walk2: [0.72, 0.5], walk3: [0.72, 0.5] };
const HURT = [255, 106, 90];

let source = null,
  cycleSource = null, uniqueSource = null;
const cache = new Map();
const load = (src, m, set) =>
  new Promise(resolve => {
    const image = new Image();
    image.onload = () => {
      if (image.naturalWidth !== m.width || image.naturalHeight !== m.height) return resolve(false);
      set(image);
      resolve(true);
    };
    image.onerror = () => resolve(false);
    image.src = src;
  });
// the main atlas is required; the cycle atlas (walk0…walk3 of the common creatures) is a bonus
const creatureArtReady = Promise.all([load(url, meta, i => (source = i)), load(cyclesUrl, cycles, i => (cycleSource = i)), load(uniqueUrl, unique, i => { uniqueSource = i; cache.clear(); for (const key of Object.keys(iconCache)) delete iconCache[key]; })]).then(([ok]) => ok);
// a creature's frame by pose: [x, y, w, h, anchorX] and the picture it lies in
const rectOf = (base, pose) => {
  if (uniqueSource && unique.frames[base]?.[pose]) return [unique.frames[base][pose], uniqueSource];
  const own = meta.frames[base]?.[pose];
  if (own) return [own, source];
  const walk = cycleSource && cycles.frames[base]?.[pose];
  return walk ? [walk, cycleSource] : null;
};
// how many walking phases a creature has (0: it only has idle, move and attack)
const phasesOf = kind => uniqueSource && unique.frames[kind] ? 4 : (cycleSource && cycles.frames[baseOf(kind)] ? 4 : 0);
const baseOf = kind => uniqueSource && unique.frames[kind] ? kind : (VARIANT[kind] ? VARIANT[kind][0] : kind);
const hasCreatureArt = kind => !!LOOK[baseOf(kind)] && !!(uniqueSource && unique.frames[baseOf(kind)] || source && meta.frames[baseOf(kind)]);

function frameCanvas(kind, pose, mode) {
  const key = `${kind}|${pose}|${mode}`;
  let c = cache.get(key);
  if (c) return c;
  const base = baseOf(kind);
  const [[x, y, w, h], img] = rectOf(base, pose);
  c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  g.drawImage(img, x, y, w, h, 0, 0, w, h);
  const tint = uniqueSource && unique.frames[kind] ? null : VARIANT[kind]?.[1],
    flash = mode === 'hurt' ? LOOK[base].flash || HURT : null;
  if (tint || flash) {
    const img = g.getImageData(0, 0, w, h),
      d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      if (!d[i + 3]) continue;
      const dark = Math.max(d[i], d[i + 1], d[i + 2]) < 60; // (the outline stays)
      if (tint && !dark) {
        const t = tint(d[i], d[i + 1], d[i + 2]);
        for (let k = 0; k < 3; k++) d[i + k] = Math.max(0, Math.min(255, t[k]));
      }
      if (flash && !dark) for (let k = 0; k < 3; k++) d[i + k] = Math.round(d[i + k] * 0.25 + flash[k] * 0.75);
    }
    g.putImageData(img, 0, 0);
  }
  if (mode === 'pet' && COLLAR[pose]) {
    const [fx, fy] = COLLAR[pose];
    g.strokeStyle = '#d03838';
    g.lineWidth = w * 0.04;
    g.beginPath();
    g.ellipse(w * fx, h * fy, w * 0.03, h * 0.12, -0.5, 0, Math.PI * 2);
    g.stroke();
  }
  cache.set(key, c);
  return c;
}

// (x, y) is the hitbox's top-left corner in world cells, exactly as the pixel sprites took it.
// o: { hurt, pet, squash: [kx, ky], angle, dy (cells down), size (cells, overrides the kind's height) }
function drawCreature(g, kind, pose, x, y, w, h, face = 1, o = {}) {
  if (!hasCreatureArt(kind)) return false;
  const base = baseOf(kind),
    look = LOOK[base],
    idle = rectOf(base, 'idle')[0];
  if (!rectOf(base, pose)) pose = 'idle';
  const f = rectOf(base, pose)[0],
    k = (o.size || look.h) / idle[3]; // cells per source pixel, the same for every pose
  const c = frameCanvas(kind, pose, o.hurt ? 'hurt' : o.pet ? 'pet' : '');
  g.save();
  g.translate(x + w / 2, (look.fly ? y + h / 2 : y + h + 0.4) + (o.dy || 0));
  if (o.angle) g.rotate(o.angle);
  g.scale((face < 0 ? -1 : 1) * (o.squash?.[0] || 1), (o.flipY ? -1 : 1) * (o.squash?.[1] || 1));
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = 'high';
  g.drawImage(c, -f[4] * k, look.fly ? (-f[3] * k) / 2 : -f[3] * k, f[2] * k, f[3] * k);
  g.restore();
  return true;
}

// a square menu icon of a creature (null until the atlas is there)
const iconCache = {};
function creatureIcon(kind, size = 48) {
  if (!hasCreatureArt(kind)) return null;
  if (iconCache[kind + size]) return iconCache[kind + size];
  const c = document.createElement('canvas');
  c.width = c.height = size;
  c.painted = true;
  c.className = 'painted';
  const f = rectOf(baseOf(kind), 'idle')[0],
    cells = LOOK[baseOf(kind)].h * Math.max(1, f[2] / f[3]),
    g = c.getContext('2d');
  g.scale((size - 2) / cells, (size - 2) / cells);
  drawCreature(g, kind, 'idle', 0, 0, cells + 2 / size, LOOK[baseOf(kind)].h + (cells - LOOK[baseOf(kind)].h) / 2 - 0.4, 1);
  return (iconCache[kind + size] = c);
}

export { creatureArtReady, creatureIcon, drawCreature, hasCreatureArt, phasesOf };
