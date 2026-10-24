// Shared store at the home base. Walking into the base sells gold and gems and drops raw
// materials into the store; production buildings work from the store on their own.
import { addFloat } from './floats.js';
import { sold } from './profile.js';
import { sfx } from './sound.js';
import { ITEM } from './sprites.js';
import { G, crew } from './state.js';

const SELL = ['nug', 'gem'];
const KEEP = ['flint', 'tnt', 'loam']; // tools stay in the hand
const stock = t => (G.store && G.store[t]) || 0;
function addStock(t, n = 1) {
  G.store = G.store || {};
  G.store[t] = stock(t) + n;
}
function takeStock(t, n = 1) {
  const k = Math.min(n, stock(t));
  if (k) G.store[t] -= k;
  return k;
}

// sell valuables, store the rest; returns true if anything happened
// (helpers hand in their tools too, your own Wühler keeps them)
function unload(list, x, y, all = false) {
  let money = 0,
    stored = 0;
  const sell = [];
  for (let k = list.length - 1; k >= 0; k--) {
    const t = list[k];
    if (SELL.includes(t)) {
      sell.push(t);
      list.splice(k, 1);
    } else if ((all || !KEEP.includes(t)) && ITEM[t]) {
      addStock(t);
      stored++;
      list.splice(k, 1);
    }
  }
  if (sell.length) {
    const lv = (G.base && G.base.lvl) || 1;
    money = Math.round(sell.reduce((s, t) => s + ITEM[t].val, 0) * [1, 1, 1.2, 1.4][lv]);
    G.money += money;
    sold(sell, money);
    addFloat(x, y, '+' + money, '#f2c230');
    sfx('coin');
  }
  if (stored) {
    addFloat(x, y - (money ? 9 : 0), `+${stored} ▣`, '#d9c9a8');
    if (!money) sfx('pick');
  }
  return !!(money || stored);
}
function arriveAtBase(c) {
  if (unload(c.inv, G.base.x + G.base.w / 2, G.base.gy - G.base.h - 4, c !== crew[0])) {
    c.isel = Math.min(c.isel, Math.max(0, c.inv.length - 1));
    G.invKey = '';
  }
}

// ---- automatic production ----
// keep: stock that is never used up, so building material stays available; max: stop when this many are stored
const AUTO = {
  saw: [{ out: 'plank', n: 3, need: { wood: 1 }, time: 90, keep: { wood: 1 }, max: 12 }],
  furnace: [{ out: 'metal', n: 1, need: { ore: 1, coal: 1 }, time: 160, max: 99 }],
  shop: [
    { out: 'flint', n: 1, need: { rock: 1, wood: 1 }, time: 80, keep: { wood: 2, rock: 2 }, max: 4 },
    { out: 'tnt', n: 1, need: { flint: 1, coal: 1 }, time: 140, max: 2 },
  ],
};
const canMake = r => Object.entries(r.need).every(([t, n]) => stock(t) - ((r.keep && r.keep[t]) || 0) >= n);
function updProduction(b) {
  const list = AUTO[b.type];
  if (!list) return;
  if (b.busy > 0) {
    if (--b.busy > 0) return;
    addStock(b.out, b.n);
    addFloat(b.x + b.w / 2, b.gy - b.h - 3, `+${b.n}`, '#ffffff', b.out);
    sfx('done', b.x, b.gy);
    b.busy = 0;
    return;
  }
  if (G.frame % 30) return;
  const r = list.find(r => stock(r.out) < r.max && canMake(r));
  if (!r) return;
  for (const [t, n] of Object.entries(r.need)) takeStock(t, n);
  b.busy = r.time;
  b.out = r.out;
  b.n = r.n;
}
const AUTO_INFO = {
  saw: 'Holz → 3 Bretter, ganz von selbst',
  furnace: 'Erz + Kohle → Metall, ganz von selbst',
  shop: 'Macht Feuersteine und Sprengladungen aus dem Lager',
};

// why a production building is idle: the first ingredient that is missing, or 'full'
function idleReason(b) {
  const list = AUTO[b.type];
  if (!list || b.busy > 0) return null;
  if (list.every(r => stock(r.out) >= r.max)) return { full: true, item: list[0].out };
  for (const r of list) {
    if (stock(r.out) >= r.max) continue;
    for (const [t, n] of Object.entries(r.need)) if (stock(t) - ((r.keep && r.keep[t]) || 0) < n) return { item: t };
  }
  return null;
}
export { idleReason, AUTO, AUTO_INFO, addStock, arriveAtBase, stock, takeStock, unload, updProduction };
