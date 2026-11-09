// Shrines deep down (like the Holy Mountain of Noita): in the free modes a few old shrines lie in
// small halls far below the surface, each with its own gift. Coming close, its gift is named; the
// action button takes it, and the shrine goes dark. A gift lasts for the whole world (it is kept with
// the Wühler when saved): it rewards digging deep. Different shrines give different gifts, so it is
// worth looking for a second one. Made with the world (on every device, from the seed, with its own
// random numbers); which are taken goes with the game, the gifts with the Wühler.
import { announce } from './announce.js';
import { addFloat } from './floats.js';
import { tr } from './i18n.js';
import { GAME_MODES } from './modes.js';
import { sfx } from './sound.js';
import { G, crew, parts } from './state.js';
import { toast } from './ui.js';
import { AIR, GRANITE, H, W, bg, mat, surf } from './world.js';

// id: name, what it does, colour of its crystal
const GIFTS = {
  dig: { name: 'Flinke Hacke', sub: 'Gräbt 40 % schneller', col: '#ffb347' },
  feather: { name: 'Federleicht', sub: 'Kein Schaden mehr durch Stürze', col: '#bfe3ff' },
  magnet: { name: 'Goldmagnet', sub: 'Zieht Gold und Fundstücke von weiter her an', col: '#ffe066' },
  lung: { name: 'Große Lunge', sub: 'Hält unter Wasser dreimal so lange die Luft an', col: '#6fd0ff' },
  tough: { name: 'Zähigkeit', sub: 'Nimmt ein Drittel weniger Schaden', col: '#ff6a5a' },
  regen: { name: 'Lebenskraft', sub: 'Erholt sich langsam von selbst', col: '#9be37a' },
};
const IDS = Object.keys(GIFTS);
const SW = 26, // the hall: width and height
  SH = 15;

const hasGift = (c, id) => !!(c && c.gifts && c.gifts.includes(id));
function allowed() {
  const M = GAME_MODES[G.mode];
  return !!M && !M.campaign && !M.pkg && !M.daily && !G.tut;
}

// called by gen() after the chests: halls with a granite floor, spread along the world
function placeShrines(n) {
  G.shrines = [];
  if (!allowed() || H < 220) return;
  let s = (G.seed * 2246822519 + 0x9e3779b9) >>> 0;
  const r = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const gifts = [...IDS];
  for (let k = 0; k < n && gifts.length; k++) {
    const x = Math.floor(200 + (k + 0.25 + r() * 0.5) * ((W - 260) / n)),
      top = Math.max(surf[x] + 120, Math.floor(H * 0.55)),
      y = Math.min(H - 12, Math.floor(top + r() * Math.max(1, H - 14 - top)));
    // the hall: an arch over a flat floor
    for (let yy = y - SH; yy < y; yy++)
      for (let xx = x - SW / 2; xx <= x + SW / 2; xx++) {
        const dx = (xx - x) / (SW / 2 + 0.5),
          dy = (y - yy) / SH;
        if (dy > 0.55 && dx * dx + ((dy - 0.55) / 0.45) ** 2 > 1) continue;
        const i = yy * W + xx;
        mat[i] = AIR;
        bg[i] = 1;
      }
    for (let yy = y; yy < y + 3; yy++) for (let xx = x - SW / 2 - 1; xx <= x + SW / 2 + 1; xx++) mat[yy * W + xx] = GRANITE;
    const gift = gifts.splice(Math.floor(r() * gifts.length), 1)[0];
    G.shrines.push({ x, y, gift, used: false });
  }
}

const shrineNear = c =>
  (G.shrines || []).find(s => !s.used && Math.abs(c.x + 3 - s.x) < 12 && Math.abs(c.y + 10 - s.y) < 8) || null;
// the action button at a shrine
function shrineContext(c) {
  if (c.pid == null) return null;
  const s = shrineNear(c);
  if (!s) return null;
  if (hasGift(c, s.gift)) return null;
  return { label: 'Gabe nehmen', fn: () => takeGift(c, s) };
}
function takeGift(c, s) {
  if (s.used || hasGift(c, s.gift)) return;
  s.used = true;
  c.gifts = [...(c.gifts || []), s.gift];
  const g = GIFTS[s.gift];
  for (let q = 0; q < 24; q++)
    parts.push({ x: s.x, y: s.y - 9, vx: (Math.random() - 0.5) * 2, vy: -Math.random() * 2, l: 40, c: g.col });
  addFloat(c.x + 3, c.y - 6, '✦ ' + g.name, g.col);
  sfx('fanfare', c.x, c.y);
  announce('{name} erhält am Schrein die Gabe „{gift}“: {sub}.', { name: c.name, gift: g.name, sub: g.sub });
}

// every tick (host): "Lebenskraft" heals slowly; on every device: the name of a shrine close by
const seen = new Set();
function shrineTick() {
  if (!G.netClient)
    for (const c of crew) if (!c.dead && hasGift(c, 'regen') && c.energy < 100) c.energy = Math.min(100, c.energy + 0.02);
  if (G.frame % 20) return;
  const me = crew.find(c => c.pid === G.myId && !c.dead);
  const s = me && shrineNear(me);
  if (!s || seen.has(s)) return;
  seen.add(s);
  const g = GIFTS[s.gift];
  toast(hasGift(me, s.gift) ? 'Schrein: {gift} – die Gabe hast du schon' : 'Schrein: {gift} – {sub}', {
    gift: tr(g.name),
    sub: tr(g.sub),
  });
}

// the picture: two pillars, an altar, a crystal in the gift's colour that glows while unused
function drawShrines(ctx, cx, cy) {
  for (const s of G.shrines || []) {
    const x = Math.round(s.x - cx),
      y = Math.round(s.y - cy);
    if (x < -20 || x > G.VW + 20 || y < -30 || y > G.VH + 20) continue;
    const g = GIFTS[s.gift],
      R = (px, py, w, h, col) => {
        ctx.fillStyle = col;
        ctx.fillRect(x + px, y + py, w, h);
      };
    for (const side of [-1, 1]) {
      R(side * 9 - 2, -14, 4, 14, '#24160c');
      R(side * 9 - 1, -13, 2, 13, '#8f8a84');
      R(side * 9 - 2, -15, 4, 2, '#a8a29a');
    }
    R(-5, -6, 10, 6, '#24160c');
    R(-4, -5, 8, 5, '#9a948c');
    R(-4, -5, 8, 1, '#b8b2a8');
    R(-3, -3, 6, 1, '#6e6a64');
    const pulse = s.used ? 0 : 0.5 + 0.5 * Math.sin(G.frame / 15 + s.x);
    R(-2, -11, 4, 5, '#24160c');
    R(-1, -10, 2, 4, s.used ? '#4a4844' : g.col);
    if (!s.used) {
      ctx.globalAlpha = 0.35 + 0.4 * pulse;
      R(-1, -12, 2, 1, '#ffffff');
      ctx.globalAlpha = 1;
    }
  }
}

export { GIFTS, drawShrines, hasGift, placeShrines, shrineContext, shrineTick };
