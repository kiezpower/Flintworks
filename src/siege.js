// Siege (level rule rules.siege): waves of monsters come over land, from the edges of the map,
// and march on the castle. On their way they go for Wühler they notice; walls and a closed gate
// stop them and get struck (fort.js); at the castle they strike the castle. A wave counts as
// beaten once all of it has come and none of it is left. Checked every half second with the
// level (goals.js); the state lives in G.lvl.sg and is saved with the game.
//   "siege": { "first": 3, "every": 3, "waves": [{ "from": "left", "monster": 3 }, …] }
// first, every: minutes; from: left, right or both; then how many of each kind
import { announce, announceBanner } from './announce.js';
import { mkAnimal } from './entities.js';
import { tr } from './i18n.js';
import { sfx } from './sound.js';
import { G, animals } from './state.js';
import { sunAlt } from './weather.js';
import { W, surf } from './world.js';

const KINDS = ['monster', 'spider', 'golem'];
// more players, more monsters: half again for every further player (only the common ones)
const crowd = n => Math.round(n * (1 + 0.5 * ((G.mp && G.mp.np) || 1) - 0.5));
const SIDE = { left: 'links', right: 'rechts', both: 'beiden Seiten' };
const startOf = (cfg, k) => ((cfg.first ?? 3) + k * (cfg.every ?? 3)) * 3600;

function siegeTick(L, s) {
  const cfg = L.rules && L.rules.siege;
  if (!cfg) return;
  const sg = s.sg || (s.sg = { wave: 0, queue: [], warned: -1, spawned: [] }),
    waves = cfg.waves || [],
    t = G.playTicks || 0;
  // a warning half a minute before, then the wave sets off
  if (sg.wave < waves.length) {
    const at = startOf(cfg, sg.wave),
      from = waves[sg.wave].from || 'both';
    if (sg.warned < sg.wave && t >= at - 1800) {
      sg.warned = sg.wave;
      announce('Späher: Monster nähern sich von {side}!', { side: tr(SIDE[from]) });
    }
    if (t >= at) {
      const k = sg.wave++,
        list = [];
      for (const kind of KINDS)
        for (let n = 0; n < (kind === 'monster' ? crowd(waves[k][kind] || 0) : waves[k][kind] || 0); n++) list.push(kind);
      list.forEach((kind, n) => {
        const side = from === 'both' ? (n % 2 ? 'right' : 'left') : from;
        sg.queue.push([kind, side, k]);
      });
      sg.spawned[k] = 0;
      announceBanner(tr('Angriff! Welle {n} von {m}', { n: k + 1, m: waves.length }), tr('Sie kommen von {side}', { side: tr(SIDE[from]) }));
      sfx('growl', G.base ? G.base.x : W / 2, 0);
    }
  }
  spawnNext(sg);
}
// one creature every half second from the edge of the map, standing on the ground
function spawnNext(sg) {
  const q = sg.queue.shift();
  if (q) {
    const [kind, side, k] = q,
      a = mkAnimal(kind, 0, 0),
      x = side === 'left' ? 3 : W - 3 - a.w;
    a.x = x;
    a.y = surf[Math.round(x + a.w / 2)] - a.h - 1;
    a.siege = 1;
    a.wave = k;
    a.face = side === 'left' ? 1 : -1;
    animals.push(a);
    if (sg.spawned) sg.spawned[k]++;
  }
}

// free play "Festung" (modes.js): a wave every night from both sides, bigger each night; a night
// counts once the morning comes and the castle still stands
function nightTick() {
  const s = G.fort || (G.fort = { night: false, n: 0, held: 0, queue: [] }),
    sun = sunAlt();
  if (!s.night && sun < -0.05) {
    s.night = true;
    const list = [];
    for (let k = 0; k < crowd(3 + 2 * s.n); k++) list.push('monster');
    if (s.n >= 1) list.push('spider');
    if (s.n >= 2) list.push('golem');
    list.forEach((kind, k) => s.queue.push([kind, k % 2 ? 'right' : 'left', s.n]));
    s.n++;
    announceBanner(tr('Nacht {n}: Angriff!', { n: s.n }), 'Sie kommen von {side}', { side: tr('beiden Seiten') });
    sfx('growl', G.base ? G.base.x : W / 2, 0);
  } else if (s.night && sun > 0.05) {
    s.night = false;
    if (G.base && !(G.base.fhp <= 0)) {
      s.held++;
      announce('Die Nacht ist überstanden – die Burg steht!');
    }
  }
  spawnNext(s);
  if (G.base && G.base.fhp <= 0) G.onLevelEnd?.(false, 'Die Burg ist gefallen.');
}
// how many waves have come in full and are beaten
function wavesBeaten(s) {
  const sg = s && s.sg;
  if (!sg) return 0;
  let n = 0;
  for (let k = 0; k < sg.wave; k++) {
    if (sg.queue.some(q => q[2] === k)) continue;
    if (!animals.some(a => a.siege && a.wave === k && a.hp > 0)) n++;
  }
  return n;
}
// the march: a siege creature that sees no Wühler heads for the castle and strikes it there
// (objects.js asks this when it has no target); returns the speed to walk at
function siegeMarch(a, speed) {
  const b = G.base;
  if (!b) return 0;
  const mid = b.x + b.w / 2,
    d = mid - (a.x + a.w / 2);
  if (Math.abs(d) < b.w / 2 + 2 && a.y + a.h > b.gy - b.h) return 0;
  return Math.sign(d) * speed;
}
const atCastle = a => {
  const b = G.base;
  return !!b && a.x + a.w > b.x - 1 && a.x < b.x + b.w + 1 && a.y + a.h > b.gy - b.h && a.y < b.gy + 2;
};

export { atCastle, nightTick, siegeMarch, siegeTick, wavesBeaten };
