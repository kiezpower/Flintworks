// The night is dangerous (like the zombies of Terraria): in free play, from the second night on, a few
// monsters come out on the surface, off the screen near a Wühler, and roam; at dawn the ones nobody is
// fighting dig themselves in and are gone. Not in the relaxed setting, not in the tutorial, campaign
// levels, the Tagesschacht, Versus or "Festung" (which has its own waves, siege.js). Only the host.
import { announce } from './announce.js';
import { mkAnimal } from './entities.js';
import { GAME_MODES } from './modes.js';
import { G, animals, crew, parts } from './state.js';
import { sunAlt } from './weather.js';
import { W, ri, rnd, surf } from './world.js';

function freePlay() {
  const M = GAME_MODES[G.mode];
  return !!M && !M.campaign && !M.pkg && !M.daily && !M.kit && !G.relaxed && !G.tut && !G.teams;
}
// every half second
function roamTick() {
  if (G.netClient || G.state !== 'play' || !freePlay()) return;
  const s = G.nights || (G.nights = { n: 0, dark: false }),
    sun = sunAlt();
  // a minute before dark (from the second night on, when monsters come): a warning
  if (!s.dark && !s.warned && s.n >= 1 && G.dayT > 0.4 && G.dayT < 0.5) {
    s.warned = true;
    announce('Bald wird es dunkel – nachts kommen Monster an die Oberfläche.');
  }
  if (!s.dark && sun < -0.05) {
    s.dark = true;
    s.n++;
    if (s.n < 2) return; // (the first night is quiet)
    const np = (G.mp && G.mp.np) || 1,
      n = Math.min(3, s.n - 1) + Math.floor((np - 1) / 2);
    let made = 0;
    for (let k = 0; k < n; k++) if (roamer()) made++;
    if (made) announce('Die Nacht bricht herein – Monster streifen umher.');
  } else if (s.dark && sun > 0.05) {
    s.dark = false;
    s.warned = false;
    // dawn: the roamers nobody is near dig themselves in
    for (let k = animals.length - 1; k >= 0; k--) {
      const a = animals[k];
      if (!a.night || crew.some(c => !c.dead && Math.abs(c.x - a.x) < 140 && Math.abs(c.y - a.y) < 60)) continue;
      for (let q = 0; q < 10; q++)
        parts.push({ x: a.x + a.w / 2, y: a.y + a.h, vx: (rnd() - 0.5) * 1.6, vy: -rnd() * 1.2, l: 30, c: '#7d5230', b: 1 });
      animals.splice(k, 1);
    }
  }
}
// one monster on the surface, out of sight of a Wühler but not far off
function roamer() {
  const alive = crew.filter(c => !c.dead && c.pid != null);
  const c = alive[ri(0, Math.max(0, alive.length - 1))];
  if (!c) return false;
  const side = rnd() < 0.5 ? -1 : 1,
    x = Math.round(Math.max(10, Math.min(W - 20, c.x + side * (G.VW * 0.6 + rnd() * G.VW * 0.4))));
  // (not right next to the castle)
  if (G.base && Math.abs(x - (G.base.x + G.base.w / 2)) < 60) return false;
  const a = mkAnimal('monster', x, 0);
  a.y = surf[x + 6] - a.h - 1;
  a.night = 1;
  animals.push(a);
  return true;
}

export { roamTick };
