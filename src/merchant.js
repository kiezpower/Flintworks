// The wandering trader (like Terraria's travelling merchant and the traders of Clonk): once a hut
// stands, now and then a trader comes over land from the edge of the map to the castle, waits
// there for a while and goes again. At him the action button opens his stall: three offers that
// change each visit (explosives, metal, coal, planks, a lucky bag, a tool for less). Only the host
// moves him and sells (the "trade" command); the others get him with the game values (sync).
import { announce, announceBanner } from './announce.js';
import { register } from './commands.js';
import { addFloat } from './floats.js';
import { tr } from './i18n.js';
import { GAME_MODES } from './modes.js';
import { sfx } from './sound.js';
import { G, builds } from './state.js';
import { hasTool } from './tools.js';
import { W, ri, rnd, surf } from './world.js';

const STAY = 150 * 60, // ticks at the castle
  FIRST = 4 * 3600; // not before minute four
// what he can have: price in coins, what you get (into the store, or a tool), a name and a line
const WARES = {
  tnt: { m: 45, store: { tnt: 3 }, name: '3 Sprengladungen', sub: 'Für Fels, Monster und Mauern' },
  metal: { m: 50, store: { metal: 3 }, name: '3 Metall', sub: 'Ohne Hochofen' },
  coal: { m: 20, store: { coal: 6 }, name: '6 Kohle', sub: 'Für Hochofen und Kanone' },
  plank: { m: 20, store: { plank: 6 }, name: '6 Bretter', sub: 'Für Treppen, Brücken und Bauten' },
  luck: { m: 30, luck: true, name: 'Glücksbeutel', sub: 'Mal Taler, mal ein Edelstein – mal fast nichts' },
  rod: { m: 12, tool: 'rod', name: 'Angelrute (günstig)', sub: 'Sonst 25 Taler in der Burg' },
  hook: { m: 18, tool: 'hook', name: 'Enterhaken (günstig)', sub: 'Sonst 30 Taler in der Burg' },
};
const merchant = () => G.merchant || null;

// the trader's coming and going (every half second, host)
function merchantTick() {
  if (G.netClient || G.state !== 'play' || G.tut || G.teams) return;
  const M = GAME_MODES[G.mode];
  if (M && M.pkg && !M.map) return; // (hand-built levels keep to themselves)
  const t = G.playTicks || 0,
    m = merchant();
  if (!m) {
    if (G.merchNext == null) G.merchNext = FIRST + ri(0, 2 * 3600);
    if (t < G.merchNext || !G.base || !builds.some(b => b.type === 'hut' && b.done)) return;
    G.merchNext = t + ri(6 * 3600, 9 * 3600);
    // from the edge further from the castle, over land
    const mid = G.base.x + G.base.w / 2,
      from = mid < W / 2 ? W - 8 : 8;
    G.merchant = { x: from, dir: Math.sign(mid - from), at: null, until: 0, offers: pick(), sold: [] };
    announceBanner('Ein Händler kommt!', 'Er wartet gleich an der Burg – die Aktion bei ihm öffnet seinen Stand');
    sfx('fanfare');
  }
}
// three different wares, tools only if you do not have them yet
function pick() {
  const ids = Object.keys(WARES).filter(id => !WARES[id].tool || !hasTool(WARES[id].tool));
  const out = [];
  while (out.length < 3 && ids.length) out.push(ids.splice(Math.floor(rnd() * ids.length), 1)[0]);
  return out;
}
// every tick: he walks to his spot beside the castle, waits, and walks off again
function merchantMove() {
  const m = merchant();
  if (!m || G.netClient) return;
  const spot = G.base ? G.base.x + (m.dir > 0 ? -14 : G.base.w + 8) : W / 2;
  if (m.at == null) {
    m.x += m.dir * 0.45;
    if ((m.dir > 0 && m.x >= spot) || (m.dir < 0 && m.x <= spot)) {
      m.x = spot;
      m.at = G.playTicks || 0;
      announce('Der Händler ist an der Burg.');
    }
  } else if ((G.playTicks || 0) - m.at > STAY) {
    // time to go: back the way he came
    m.x -= m.dir * 0.45;
    if (m.x < -10 || m.x > W + 10) G.merchant = null;
  }
}
const atStall = m => m && m.at != null && (G.playTicks || 0) - m.at <= STAY;
const near = (c, m) => Math.abs(c.x + 3 - m.x) < 12 && Math.abs(c.y + 10 - surf[Math.max(0, Math.min(W - 1, Math.round(m.x)))]) < 14;
// the action button next to him
function merchantContext(c) {
  const m = merchant();
  if (!atStall(m) || !near(c, m)) return null;
  return { label: 'Händler', ui: 'merchant' };
}
// buying (a command: the host sells)
register('trade', (c, { id }) => {
  const m = merchant(),
    w = WARES[id];
  if (!w || !atStall(m) || !m.offers.includes(id) || m.sold.includes(id) || G.money < w.m) return;
  G.money -= w.m;
  m.sold.push(id);
  if (w.store) for (const [k, n] of Object.entries(w.store)) G.store[k] = (G.store[k] || 0) + n;
  if (w.tool) G.tools = { ...(G.tools || {}), [w.tool]: true };
  if (w.luck) {
    const r = rnd();
    if (r < 0.15) G.store.gem = (G.store.gem || 0) + 1;
    const coins = r < 0.15 ? 0 : r < 0.55 ? ri(10, 25) : r < 0.9 ? ri(30, 60) : ri(80, 120);
    G.money += coins;
    addFloat(c.x + 3, c.y - 6, r < 0.15 ? tr('Ein Edelstein!') : `+${coins} ${tr('Taler')}`, '#ffe066');
  }
  sfx('coin', c.x, c.y);
});
// the stall (opened by ui.js openMerchant)
function merchantStall(p, { opt, sec, send, reopen }) {
  const m = merchant();
  const l = sec(p, tr('Heute im Angebot'));
  if (!atStall(m)) {
    const e = document.createElement('p');
    e.textContent = tr('Der Händler ist weitergezogen.');
    l.appendChild(e);
    return;
  }
  for (const id of m.offers) {
    const w = WARES[id],
      sold = m.sold.includes(id);
    opt(l, {
      title: tr(w.name),
      sub: tr(w.sub),
      cost: sold ? tr('verkauft') : `${w.m} ${tr('Taler')}`,
      state: sold || G.money < w.m ? 'poor' : 'ok',
      onClick: () => {
        if (sold || G.money < w.m) return;
        send('trade', { id });
        reopen();
      },
    });
  }
  const left = Math.max(0, Math.ceil((STAY - ((G.playTicks || 0) - m.at)) / 60));
  const f = document.createElement('p');
  f.className = 'hint';
  f.textContent = tr('Er zieht in {s} s weiter', { s: left });
  p.appendChild(f);
}
// the picture: a Wühler-sized trader with a big pack and a wide hat, a sign while he waits
function drawMerchant(ctx, cx, cy) {
  const m = merchant();
  if (!m) return;
  const x = Math.round(m.x - cx),
    gy = surf[Math.max(0, Math.min(W - 1, Math.round(m.x)))],
    y = Math.round(gy - cy);
  if (x < -20 || x > G.VW + 20) return;
  const step = m.at == null || !atStall(m) ? Math.floor(G.frame / 8) % 2 : 0,
    f = atStall(m) ? 1 : m.at == null ? m.dir : -m.dir;
  // each part with a dark outline of its own (like the Wühler), then its colours
  const part = (px, py, w, h, col) => {
    ctx.fillStyle = '#24160c';
    ctx.fillRect(px - 1, py - 1, w + 2, h + 2);
    ctx.fillStyle = col;
    ctx.fillRect(px, py, w, h);
  };
  part(x - f * 3 - 2, y - 11, 4, 7, '#8b5e34'); // the pack on the back
  part(x - 1, y - 2, 1, 2 - step, '#3a2a1e'); // legs
  part(x + 2, y - 2, 1, 1 + step, '#3a2a1e');
  part(x - 2, y - 7, 5, 5, '#5a7a3a'); // coat
  part(x - 1, y - 10, 4, 3, '#f0c49a'); // face
  part(x - 3, y - 12, 7, 1, '#6a4526'); // wide hat
  part(x - 1, y - 14, 4, 2, '#6a4526');
  ctx.fillStyle = '#a0703f';
  ctx.fillRect(x - f * 3 - 2, y - 11, 4, 1);
  ctx.fillStyle = '#3f5a28';
  ctx.fillRect(x - 2, y - 3, 5, 1);
  ctx.fillStyle = '#1a120c';
  ctx.fillRect(x + (f > 0 ? 2 : -1), y - 9, 1, 1);
  if (atStall(m) && (G.frame >> 5) % 2) {
    ctx.fillStyle = '#ffe066';
    ctx.fillRect(x, y - 19, 1, 3);
    ctx.fillRect(x, y - 15, 1, 1);
  }
}

export { drawMerchant, merchant, merchantContext, merchantMove, merchantStall, merchantTick };
