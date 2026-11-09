// Storms (like Terraria's sandstorm and blizzard): now and then, in the desert a sandstorm, where it
// is cold (the winter world, or winter in a green one: seasons.js) a snowstorm. For a minute or so
// the wind blows hard: it pushes the Wühler on the surface, sand or snow drives across the picture
// and the view goes hazy. Underground nothing of it is felt. Not in relaxed worlds or the tutorial.
// The host starts and ends it (G.storm goes with the game); every device draws it.
import { announce } from './announce.js';
import { cold } from './seasons.js';
import { G, crew, parts } from './state.js';
import { W, free, rnd, surf } from './world.js';

const SURF = 16; // within this many pixels of the surface the storm is felt
const depthOf = c => c.y + 10 - surf[Math.max(0, Math.min(W - 1, Math.round(c.x + 3)))];
const kindHere = () => (G.biome === 'desert' ? 'sand' : cold() ? 'snow' : null);

// every tick
function stormTick(cam) {
  const s = G.storm;
  if (!G.netClient) {
    if (!s) {
      if (G.relaxed || G.tut || !kindHere()) return;
      if (G.stormNext == null) G.stormNext = 54000 + Math.floor(rnd() * 36000);
      if (--G.stormNext > 0) return;
      const kind = kindHere();
      G.storm = { kind, t: 3600 + Math.floor(rnd() * 1800), dir: rnd() < 0.5 ? -1 : 1 };
      announce(kind === 'sand' ? 'Ein Sandsturm zieht auf!' : 'Ein Schneesturm zieht auf!');
      return;
    }
    if (--s.t <= 0) {
      G.storm = null;
      G.stormNext = 54000 + Math.floor(rnd() * 36000);
      announce(s.kind === 'sand' ? 'Der Sandsturm legt sich.' : 'Der Schneesturm legt sich.');
      return;
    }
    // the wind pushes the Wühler on the surface
    // (over small steps too, like walking)
    for (const c of crew) {
      if (c.dead || c.ride != null || c.climb || depthOf(c) >= SURF) continue;
      const nx = c.x + s.dir * 0.15;
      for (let up = 0; up <= 3; up++)
        if (free(nx, c.y - up, 6, 10)) {
          c.x = nx;
          c.y -= up;
          break;
        }
    }
  }
  if (!s || !cam || parts.length > 1700) return;
  // sand or snow driving across the picture (only where the surface is in view)
  for (let k = 0; k < 6; k++) {
    const x = cam.x + (s.dir > 0 ? -10 : G.VW + 10),
      y = cam.y + rnd() * G.VH;
    const sx = Math.max(0, Math.min(W - 1, Math.round(cam.x + G.VW / 2)));
    if (y > surf[sx] + SURF) continue;
    parts.push({
      x,
      y,
      vx: s.dir * (2.6 + rnd() * 1.6),
      vy: (rnd() - 0.4) * 0.4,
      g: 0,
      l: 160,
      c: s.kind === 'sand' ? (rnd() < 0.5 ? '#d8b47c' : '#c89a5a') : rnd() < 0.5 ? '#ffffff' : '#dfe8f2',
    });
  }
}
// the haze over the picture, stronger near the surface
function drawStorm(ctx, cam) {
  const s = G.storm;
  if (!s) return;
  const sx = Math.max(0, Math.min(W - 1, Math.round(cam.x + G.VW / 2)));
  const below = cam.y + G.VH / 2 - surf[sx];
  const a = Math.max(0, Math.min(1, 1 - below / 120)) * 0.32;
  if (a <= 0.01) return;
  ctx.fillStyle = s.kind === 'sand' ? `rgba(214,176,118,${a})` : `rgba(232,238,246,${a})`;
  ctx.fillRect(0, 0, G.VW, G.VH);
}

export { drawStorm, stormTick };
