import { arriveAtBase, stock, takeStock, unload, updProduction } from './store.js';
import { track } from './profile.js';
import { tr } from './i18n.js';
import { digCell, lorryNear, onCase, spawnFromDig } from './clonk.js';
import { insideB, midMat, moveBody, overlap, sel_, spawnItem, unstuck } from './entities.js';
import { clearFoot } from './gen.js';
import { inp } from './input.js';
import { calcTerr } from './render.js';
import { sfx } from './sound.js';
import { ITEM } from './sprites.js';
import { G, animals, builds, crew, items, lorries, parts, trees } from './state.js';
import { closePanel, toast } from './ui.js';
import {
  AIR,
  GRANITE,
  H,
  LIQ,
  PLANK,
  ROCK,
  SOLID,
  W,
  boxFree,
  clamp,
  free,
  mat,
  matAt,
  paint,
  rnd,
  solid,
} from './world.js';

// ---- Buildings & economy ----
const BT = {
  hut: {
    name: 'Hütte',
    w: 22,
    h: 16,
    cost: { wood: 2, rock: 1 },
    info: 'Heilt die Crew',
  },
  flag: {
    name: 'Flagge',
    w: 6,
    h: 18,
    cost: { wood: 2 },
    info: 'Erweitert dein Baugebiet',
    terrOnly: true,
  },
  shop: {
    name: 'Werkstatt',
    w: 26,
    h: 17,
    cost: { wood: 2, rock: 2 },
    info: 'Macht Feuersteine und Sprengladungen aus dem Lager',
  },
  saw: {
    name: 'Sägewerk',
    w: 24,
    h: 14,
    cost: { wood: 3, rock: 1 },
    info: 'Holz → 3 Bretter, ganz von selbst',
  },
  wind: {
    name: 'Windrad',
    w: 14,
    h: 28,
    cost: { plank: 2, wood: 1, rock: 1 },
    info: 'Erzeugt Strom aus Wind',
    hidden: true,
  },
  lift: {
    name: 'Fahrstuhl',
    w: 16,
    h: 22,
    cost: { wood: 3, rock: 1 },
    info: 'Kabine gräbt einen Schacht nach unten',
  },
  pump: {
    name: 'Pumpe',
    w: 16,
    h: 16,
    cost: { wood: 2, rock: 3 },
    info: 'Pumpt Flüssigkeit · Strom',
    hidden: true,
  },
  furnace: {
    name: 'Hochofen',
    w: 18,
    h: 22,
    cost: { rock: 3, plank: 2 },
    info: 'Erz + Kohle → Metall, ganz von selbst',
  },
  chem: {
    name: 'Chemiefabrik',
    w: 22,
    h: 18,
    cost: { metal: 1, plank: 2, rock: 1 },
    info: 'Sprengstoff aus Kohle · Strom',
    hidden: true,
  },
  tower: {
    name: 'Wachturm',
    w: 12,
    h: 32,
    cost: { plank: 2, rock: 2, metal: 1 },
    info: 'Schießt auf Monster, weite Sicht',
  },
  gate: {
    name: 'Tor',
    w: 8,
    h: 16,
    cost: { plank: 2, metal: 1 },
    info: 'Öffnet nur für deine Crew',
  },
};
const PROD = {
  shop: [
    { out: 'flint', n: 1, need: { rock: 1, wood: 1 }, time: 80 },
    { out: 'tnt', n: 1, need: { flint: 1, wood: 2 }, time: 140 },
    { out: 'lorry', n: 1, need: { wood: 3, rock: 2 }, time: 200 },
  ],
  saw: [{ out: 'plank', n: 3, need: { wood: 1 }, time: 90 }],
  furnace: [{ out: 'metal', n: 1, need: { ore: 1, coal: 1 }, time: 160 }],
  chem: [
    { out: 'tnt', n: 1, need: { coal: 1, flint: 1 }, time: 100 },
    { out: 'flint', n: 2, need: { coal: 1, rock: 1 }, time: 80 },
  ],
};
const PWR = { saw: 0.5, furnace: 1, chem: 0.5, lift: 1, pump: 1 };
const BUY = [
  { t: 'flint', price: 10 },
  { t: 'loam', price: 8 },
  { t: 'wood', price: 7 },
  { t: 'plank', price: 9 },
  { t: 'coal', price: 8 },
  { t: 'tnt', price: 25 },
  { t: 'lorry', price: 30 },
  { t: 'clonk', price: 60 },
];
const BASELV = [
  null,
  { sell: 1, crew: 5, power: 1, terr: 240 },
  { sell: 1.2, crew: 7, power: 1.5, terr: 330 },
  { sell: 1.4, crew: 9, power: 2.5, terr: 430 },
];
const UPG = [null, null, { money: 80, need: { plank: 3, metal: 2 } }, { money: 160, need: { plank: 4, metal: 4 } }];
G.wind = 0.6;
G.windT = 0.6;
G.power = { sup: 1, dem: 0, ratio: 1 };
G.towerView = false;
const arrows = [];
const lvl = () => (G.base && G.base.lvl) || 1;
const sellVal = items_ => Math.round(items_.reduce((s, t) => s + ITEM[t].val, 0) * BASELV[lvl()].sell);
// building areas are optional (lobby options); off by default
const terrOn = () => !!G.territory;
function terrOK(x, extra = 0) {
  if (!terrOn()) return true;
  if (Math.abs(x - (G.base.x + G.base.w / 2)) < BASELV[lvl()].terr + extra) return true;
  for (const b of builds) if (b.type === 'flag' && b.done && Math.abs(x - (b.x + 3)) < 150 + extra) return true;
  return false;
}
const resName = t => tr(t === 'lorry' ? 'Lore' : t === 'clonk' ? 'Wühler' : ITEM[t].name);
function resSources(c) {
  const src = [c.inv];
  const L = lorryNear(c);
  if (L) src.push(L.items);
  for (const o of crew) if (o !== c && !o.dead && Math.abs(o.x - c.x) < 26 && Math.abs(o.y - c.y) < 14) src.push(o.inv);
  return src;
}
function countRes(c, t) {
  return resSources(c).reduce((n, a) => n + a.filter(x => x === t).length, 0) + stock(t);
}
function hasRes(c, need) {
  for (const t in need) if (countRes(c, t) < need[t]) return false;
  return true;
}
function payRes(c, need) {
  const src = resSources(c);
  for (const t in need) {
    let n = need[t];
    n -= takeStock(t, n);
    for (const a of src)
      while (n > 0) {
        const i = a.lastIndexOf(t);
        if (i < 0) break;
        a.splice(i, 1);
        n--;
      }
  }
  for (const o of crew) if (o.isel >= o.inv.length) o.isel = Math.max(0, o.inv.length - 1);
}
const costTxt = need =>
  Object.entries(need)
    .map(([t, n]) => `${n}× ${resName(t)}`)
    .join(' + ');
function tryBuild(type) {
  const T = BT[type],
    c = sel_();
  closePanel();
  if (!c || c.dead || G.state !== 'play') return;
  if (c.climb || c.hangle || c.tumble || free(c.x, c.y + 1, 6, 10)) {
    toast('Erst auf festen Boden stellen');
    return;
  }
  if (!hasRes(c, T.cost)) {
    toast('{name} braucht {cost}', { name: tr(T.name), cost: costTxt(T.cost) });
    return;
  }
  const gy = Math.floor(c.y) + 10,
    bx = Math.round(c.x + 3 - T.w / 2);
  if (terrOn() && !terrOK(bx + T.w / 2, type === 'flag' ? 110 : 0)) {
    toast(
      type === 'flag' ? 'Zu weit weg von deinem Gebiet' : 'Außerhalb deines Gebiets – stell zuerst eine Flagge auf',
    );
    return;
  }
  if (bx < 2 || bx + T.w > W - 2 || gy - T.h < 2) {
    toast('Kein Platz am Rand');
    return;
  }
  for (const b of builds)
    if (bx < b.x + b.w + 2 && bx + T.w > b.x - 2 && gy - T.h < b.gy && gy > b.gy - b.h) {
      toast('Zu nah an einem Gebäude');
      return;
    }
  let ground = 0,
    liq = 0;
  for (let x = bx; x < bx + T.w; x++) {
    for (let y = gy; y <= gy + 4; y++)
      if (solid(x, y)) {
        ground++;
        break;
      }
    for (let y = gy - T.h; y < gy; y++) if (LIQ[matAt(x, y)]) liq++;
  }
  if (ground < T.w * 0.7) {
    toast('Hier ist es zu uneben');
    return;
  }
  if (liq > T.w * 2) {
    toast('Nicht in Flüssigkeit bauen');
    return;
  }
  payRes(c, T.cost);
  clearFoot(bx, gy, T.w, T.h);
  for (const t of trees)
    if (!t.fall && t.x >= bx - 2 && t.x <= bx + T.w + 2) {
      t.fall = 1;
    }
  const b = {
    type,
    x: bx,
    gy,
    w: T.w,
    h: T.h,
    prog: 0,
    done: false,
    busy: 0,
    moving: 0,
    on: false,
    pipe: 0,
    rot: 0,
    cd: 0,
    open: 0,
  };
  if (type === 'lift') b.cs = { x: bx + 2, y: gy - 2, home: gy - 2 };
  builds.push(b);
  toast('{name}: Wühler drin stehen lassen zum Bauen', { name: tr(T.name) });
}
function liftUpd(b) {
  const c = b.cs,
    s = sel_();
  let dir = 0;
  if (s && !s.dead && onCase(s, c) && !inp.dig) {
    if (inp.ay > 0.4) dir = 1;
    else if (inp.ay < -0.4) dir = -1;
  }
  b.moving = 0;
  b.want = !!dir;
  if (!dir) return;
  const spd = 0.6;
  const riders = [...crew.filter(e => !e.dead), ...lorries, ...items, ...animals].filter(e => onCase(e, c));
  if (dir > 0) {
    if (c.y + 2 >= H - 10) return;
    const ny = c.y + spd;
    for (let y = Math.floor(c.y) + 2; y <= Math.floor(ny) + 1; y++)
      for (let x = c.x; x < c.x + 12; x++) {
        const m = matAt(x, y);
        if (m === ROCK || m === GRANITE) {
          if (!G.toastT) toast('Fels blockiert – sprengen!');
          return;
        }
      }
    for (let y = Math.floor(c.y) + 2; y <= Math.floor(ny) + 1; y++) for (let x = c.x; x < c.x + 12; x++) digCell(x, y);
    spawnFromDig(c.x + 6, c.y - 4);
    c.y = ny;
    for (const e of riders) e.y = c.y - e.h;
  } else {
    if (c.y <= c.home) return;
    const ny = Math.max(c.home, c.y - spd);
    for (const e of riders) if (!boxFree(e.x, ny - e.h, e.w, e.h)) return;
    c.y = ny;
    for (const e of riders) e.y = c.y - e.h;
  }
  b.moving = dir;
  if (G.frame % 12 === 0) sfx('lift', b.x, c.y);
}
function pumpUpd(b) {
  if (!b.on) return;
  const px0 = b.x + 8;
  let found = -1,
    fx = 0,
    fy = 0;
  for (let y = b.gy + 1; y < b.gy + 100 && y < H; y++) {
    for (const dx of [0, -1, 1, -2, 2, -3, 3]) {
      const m = matAt(px0 + dx, y);
      if (LIQ[m]) {
        found = m;
        fx = px0 + dx;
        fy = y;
        break;
      }
    }
    if (found >= 0) break;
  }
  if (found < 0) {
    b.pipe = Math.min(b.pipe + 1, 100);
    return;
  }
  b.pipe = fy - b.gy;
  for (let k = 0; k < 2; k++) {
    if (rnd() > G.power.ratio) continue;
    let x = fx,
      y = fy;
    for (let up = 0; up < 6; up++)
      if (LIQ[matAt(x, y - 1)] && up < 5) y--;
      else break;
    if (!LIQ[matAt(x, y)]) break;
    const m = mat[y * W + x];
    mat[y * W + x] = AIR;
    paint(y * W + x);
    parts.push({ x: b.x + 16, y: b.gy - 6, vx: 0.9 + rnd() * 0.4, vy: -0.3, l: 400, c: '#5a9ad8', m });
  }
  if (G.frame % 10 === 0) sfx('pump', b.x, b.gy);
}
function updBuilds() {
  for (const c of crew) c.hammer = false;
  // no power system any more: everything always runs
  G.power = { sup: 1, dem: 0, ratio: 1 };
  // floors blown away by explosions grow back
  if (G.frame % 120 === 0) for (const b of builds) if (b.done && b.type !== 'base') foundation(b);
  // the castle grows by itself with what you earned
  const grow = [0, 0, 150, 350];
  if (lvl() < 3 && (G.earned || 0) >= grow[lvl() + 1]) {
    G.base.lvl = lvl() + 1;
    calcTerr();
    sfx('fanfare');
    toast('Deine Burg wächst: Stufe {n} – bessere Preise, mehr Wühler', { n: G.base.lvl });
  }
  for (const b of builds) {
    if (!b.done) {
      const helpers = crew.filter(
        c =>
          !c.dead &&
          insideB(c, b) &&
          !c.digging &&
          !c.climb &&
          !c.tumble &&
          !c.chop &&
          Math.abs(c.vx) < 0.3 &&
          !free(c.x, c.y + 1, 6, 10),
      );
      if (helpers.length) {
        b.prog += helpers.length / 260;
        for (const c of helpers) {
          c.hammer = true;
          c.anim += 0.2;
        }
        if (G.frame % 16 === 0) sfx('hammer', b.x, b.gy);
        if (rnd() < 0.15)
          parts.push({
            x: b.x + rnd() * b.w,
            y: b.gy - b.h * b.prog,
            vx: rnd() - 0.5,
            vy: -rnd(),
            l: 15,
            c: '#ffd77a',
          });
        if (b.prog >= 1) {
          b.prog = 1;
          b.done = true;
          foundation(b);
          track('build');
          toast('{name} fertig', { name: tr(BT[b.type].name) });
          sfx('done', b.x, b.gy);
          if (b.type === 'flag') calcTerr();
          if (b.type === 'tower') toast('Wachturm fertig: drin stehen für weite Sicht');
          if (b.type === 'lift') toast('Fahrstuhl fertig: draufstellen, Stick runter oder hoch');
          if (b.type === 'saw') toast('Sägewerk fertig: macht Bretter, sobald Holz im Lager ist');
          if (b.type === 'furnace') toast('Hochofen fertig: macht Metall aus Erz und Kohle im Lager');
          if (b.type === 'shop') toast('Werkstatt fertig: macht Feuersteine und Sprengladungen aus dem Lager');
        }
      }
      continue;
    }
    if (b.type === 'hut' || b.type === 'base') {
      for (const c of crew) if (!c.dead && insideB(c, b)) c.energy = Math.min(100, c.energy + 0.3);
      if (b.type === 'hut' && G.frame % 22 === 0) smoke(b.x + 15, b.gy - b.h - 1);
    }
    updProduction(b);
    if (b.type === 'base' && G.frame % 12 === 0) for (const c of crew) if (!c.dead && insideB(c, b)) arriveAtBase(c);
    if (b.type === 'wind') {
      b.rot = (b.rot || 0) + G.wind * 0.07;
    }
    if (b.type === 'tower') {
      if (b.cd > 0) b.cd--;
      else {
        const ox = b.x + 6,
          oy = b.gy - b.h + 2;
        let tgt = null,
          bd = 120;
        for (const a of animals) {
          if (a.kind !== 'monster') continue;
          const d = Math.hypot(a.x + 6 - ox, a.y + 4 - oy);
          if (d < bd) {
            bd = d;
            tgt = a;
          }
        }
        if (tgt) {
          const dx = tgt.x + 6 - ox,
            dy = tgt.y + 4 - oy,
            d = Math.hypot(dx, dy),
            sp = 4.2,
            t = d / sp;
          arrows.push({ x: ox, y: oy, vx: dx / t, vy: dy / t - 0.03 * t, l: 120 });
          b.cd = 50;
          sfx('bow', ox, oy);
        }
      }
    }
    if (b.type === 'gate') {
      const near = crew.some(
        c => !c.dead && Math.abs(c.x + 3 - (b.x + 4)) < 13 && c.y + 10 > b.gy - b.h - 4 && c.y < b.gy + 2,
      );
      const o = b.open || 0;
      b.open = clamp(o + (near ? 0.08 : -0.05), 0, 1);
      if (o < 0.05 !== b.open < 0.05) sfx('lift', b.x, b.gy);
    }
    if (b.type === 'lift') liftUpd(b);
  }
}
// Every building stands on a wooden floor that hand digging cannot remove. If the ground
// below is dug away, the floor stays as a platform you can jump onto or reach by stairs.
function foundation(b) {
  for (let x = b.x; x < b.x + b.w; x++) {
    // the lift needs its shaft free
    if (b.type === 'lift' && x >= b.x + 2 && x < b.x + 14) continue;
    for (let y = b.gy; y < b.gy + 2 && y < H; y++) {
      const i = y * W + x;
      if (!SOLID[mat[i]] || LIQ[mat[i]]) {
        mat[i] = PLANK;
        paint(i);
      }
    }
  }
}
function smoke(x, y) {
  parts.push({
    x: x + rnd() * 2,
    y,
    vx: (rnd() - 0.5) * 0.2,
    vy: -0.25 - rnd() * 0.15,
    l: 55,
    c: '#d8d2c8',
    g: -0.001,
  });
}
function mkLorry(x, y) {
  return { x, y, w: 12, h: 7, vx: 0, vy: 0, items: [] };
}
function gdist(x, y) {
  for (let d = 0; d < 5; d++) if (!free(x, y + d, 1, 1)) return d;
  return 5;
}
function updLorry(L) {
  unstuck(L);
  const inLiq = LIQ[midMat(L, 0.5)];
  L.vy = Math.min(L.vy + (inLiq ? 0.03 : 0.15), 4);
  const onG = !free(L.x, L.y + 1, L.w, L.h);
  if (onG) {
    const gl = gdist(Math.floor(L.x) + 1, Math.floor(L.y) + L.h),
      gr = gdist(Math.floor(L.x) + L.w - 2, Math.floor(L.y) + L.h);
    L.vx += (gr - gl) * 0.025;
    L.vx *= 0.985;
    if (Math.abs(L.vx) < 0.02) L.vx = 0;
  }
  if (inLiq) {
    L.vx *= 0.9;
    L.vy *= 0.9;
  }
  for (const c of crew) {
    if (c.dead || c.tumble || c.climb || !overlap(c, L, 0) || Math.abs(c.vx) < 0.3) continue;
    const lc = L.x + L.w / 2,
      cc = c.x + 3;
    if (Math.sign(c.vx) === Math.sign(lc - cc)) {
      L.vx = c.vx;
      if (c.vx > 0) c.x = Math.min(c.x, L.x - 3);
      else c.x = Math.max(c.x, L.x + L.w - 3);
    }
  }
  const [bx, by] = moveBody(L, L.vx, L.vy, 2);
  if (bx) L.vx = 0;
  if (by) L.vy = 0;
  if (
    L.items.length &&
    overlap(L, { x: G.base.x, y: G.base.gy - G.base.h, w: G.base.w, h: G.base.h }) &&
    G.frame % 20 === 0
  ) {
    unload(L.items, G.base.x + G.base.w / 2, G.base.gy - G.base.h - 4);
  }
}

export {
  BASELV,
  BT,
  BUY,
  PROD,
  PWR,
  UPG,
  arrows,
  costTxt,
  countRes,
  gdist,
  hasRes,
  liftUpd,
  lvl,
  mkLorry,
  payRes,
  pumpUpd,
  resName,
  resSources,
  sellVal,
  smoke,
  terrOK,
  terrOn,
  tryBuild,
  updBuilds,
  updLorry,
  foundation,
};
