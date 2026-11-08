// Villagers (like Terraria's town folk and a Clonk settlement): every finished hut draws a settler
// who moves in, now and then. By day they stroll between their hut and the castle, at night they
// are at home. Each one pays 2 coins every half minute. Every morning each eats a loaf of bread from
// the store (farm.js: field and mill); without bread a settler goes hungry, and after a second hungry
// morning moves out again. Only the host keeps them; the others get them with the game values.
import { announce } from './announce.js';
import { addFloat } from './floats.js';
import { tr } from './i18n.js';
import { GAME_MODES } from './modes.js';
import { track } from './profile.js';
import { G, builds } from './state.js';
import { stock, takeStock } from './store.js';
import { sunAlt } from './weather.js';
import { W, ri, rnd, surf } from './world.js';

const FOLK = ['Anni', 'Bertl', 'Clara', 'Ede', 'Fine', 'Gustl', 'Hanne', 'Ilse', 'Jakob', 'Liese', 'Moritz', 'Nele'];
const CLOTH = ['#b0503a', '#3f6fb4', '#5a8a3a', '#a07a2a', '#7a4a8a', '#3a8a8a'];
const list = () => G.villagers || (G.villagers = []);
function allowed() {
  const M = GAME_MODES[G.mode];
  return !!M && !(M.pkg && !M.map) && !G.tut && !G.teams;
}
const huts = () => builds.filter(b => b.type === 'hut' && b.done);
const at = x => surf[Math.max(0, Math.min(W - 1, Math.round(x)))];

// every half second (host): moving in and out, rent, breakfast
function villageTick() {
  if (G.netClient || G.state !== 'play' || !allowed()) return;
  const V = list(),
    H = huts();
  // a settler whose hut is gone leaves
  for (let k = V.length - 1; k >= 0; k--) if (!H.some(b => b.id === V[k].home)) V.splice(k, 1);
  // a free hut: now and then somebody moves in (by day)
  const free = H.find(b => !V.some(v => v.home === b.id));
  if (free && sunAlt() > 0 && rnd() < 0.02) {
    const v = {
      name: FOLK[ri(0, FOLK.length - 1)],
      col: CLOTH[ri(0, CLOTH.length - 1)],
      home: free.id,
      x: free.x + free.w / 2,
      tx: null,
      hungry: 0,
      wait: 0,
    };
    V.push(v);
    announce('{name} zieht in eine Hütte ein.', { name: v.name });
    track('villagers', V.length, true); // (the size of the village, for an achievement)
  }
  // rent every half minute
  if (G.frame % 1800 < 30 && V.length) {
    const n = V.length * 2;
    G.money += n;
    G.earned = (G.earned || 0) + n;
    if (G.base) addFloat(G.base.x + G.base.w / 2, G.base.gy - G.base.h - 8, `+${n} ${tr('Taler')} · ${tr('Dorf')}`, '#ffe066');
  }
  // breakfast at dawn
  const day = sunAlt() > 0;
  if (day && G.villageNight) {
    let hungry = 0;
    for (let k = V.length - 1; k >= 0; k--) {
      const v = V[k];
      if (stock('bread') > 0) {
        takeStock('bread', 1);
        v.hungry = 0;
      } else if (++v.hungry >= 2) {
        announce('{name} hatte kein Brot und zieht wieder aus.', { name: v.name });
        V.splice(k, 1);
      } else hungry++;
    }
    if (hungry) announce('Die Siedler hungern – baut Feld und Mühle für Brot.');
  }
  G.villageNight = !day;
}
// every tick (host): by day stroll between the hut and the castle, at night go home
function villageMove() {
  if (G.netClient) return;
  const day = sunAlt() > 0;
  for (const v of list()) {
    const home = builds.find(b => b.id === v.home);
    if (!home) continue;
    const hx = home.x + home.w / 2;
    if (!day) v.tx = hx;
    else if (v.tx == null || (Math.abs(v.x - v.tx) < 1 && --v.wait <= 0)) {
      // somewhere between the hut and the castle, then a short rest
      const cx = G.base ? G.base.x + G.base.w / 2 : hx;
      v.tx = Math.min(hx, cx) - 10 + rnd() * (Math.abs(hx - cx) + 20);
      v.wait = ri(60, 240);
    }
    const d = v.tx - v.x;
    v.vx = Math.abs(d) < 1 ? 0 : Math.sign(d) * 0.3;
    v.x += v.vx;
  }
}
// the picture: a small figure in its clothes; at night nobody is outside
function drawVillagers(ctx, cx, cy) {
  if (sunAlt() <= 0 && !G.netClient) return;
  for (const v of list()) {
    const home = builds.find(b => b.id === v.home);
    if (home && sunAlt() <= 0 && Math.abs(v.x - (home.x + home.w / 2)) < 2) continue;
    const x = Math.round(v.x - cx),
      y = Math.round(at(v.x) - cy);
    if (x < -8 || x > G.VW + 8) continue;
    const step = v.vx ? Math.floor(G.frame / 9) % 2 : 0,
      f = v.vx < 0 ? -1 : 1;
    const part = (px, py, w, h, col) => {
      ctx.fillStyle = '#24160c';
      ctx.fillRect(px - 1, py - 1, w + 2, h + 2);
      ctx.fillStyle = col;
      ctx.fillRect(px, py, w, h);
    };
    part(x - 1, y - 2, 1, 2 - step, '#3a2a1e');
    part(x + 1, y - 2, 1, 1 + step, '#3a2a1e');
    part(x - 2, y - 6, 4, 4, v.col);
    part(x - 1, y - 9, 3, 3, '#f0c49a');
    ctx.fillStyle = '#5a3a22';
    ctx.fillRect(x - 1, y - 9, 3, 1);
    ctx.fillStyle = '#1a120c';
    ctx.fillRect(x + (f > 0 ? 1 : -1), y - 8, 1, 1);
  }
}

export { drawVillagers, villageMove, villageTick };
