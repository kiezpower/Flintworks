import {
  BASELV,
  BT,
  BUY,
  PROD,
  PWR,
  UPG,
  costTxt,
  countRes,
  hasRes,
  lvl,
  mkLorry,
  payRes,
  resName,
  sellVal,
  terrOK,
  tryBuild,
} from './buildings.js';
import { context, nearTree } from './clonk.js';
import { addClonk, sel_, spawnItem } from './entities.js';
import { held, joy, keys, selectCrew } from './input.js';
import { calcTerr, cam } from './render.js';
import { sfx } from './sound.js';
import { ITEM, SPR, itemIcon, padIcon } from './sprites.js';
import { tr } from './i18n.js';
import { G, animals, builds, crew, lorries } from './state.js';
import { darkness } from './weather.js';
import { AIR, GOAL, GOLD, H, MINI, ROCK, W, bg, hex, mat, matAt } from './world.js';

// ---- HUD, panels, minimap ----
const $ = id => document.getElementById(id);
const pwrTxt = $('pwrTxt'),
  whoTxt = $('whoTxt'),
  moneyTxt = $('moneyTxt'),
  hpBar = $('hpBar'),
  airWrap = $('airWrap'),
  airBar = $('airBar'),
  invEl = $('inv'),
  crewEl = $('crew'),
  actBtn = $('actBtn');
const panelEl = $('panel'),
  pTitle = $('pTitle'),
  pBody = $('pBody');
const mapView = $('mapView'),
  mini = $('mini'),
  mctx = mini.getContext('2d'),
  mimg = mctx.createImageData(350, 100);
for (const el of document.querySelectorAll('[data-ico]'))
  el.style.backgroundImage = `url(${padIcon(el.dataset.ico)})`;
mapView.addEventListener('pointerdown', e => {
  e.stopPropagation();
  toggleMap();
});
G.invKey = '';
G.crewKey = '';
function hud() {
  const c = sel_();
  moneyTxt.textContent = tr('{money} / {goal} Taler', { money: G.money, goal: GOAL });
  const hasPwr = builds.some(b => b.done && (b.type === 'wind' || PWR[b.type]));
  pwrTxt.hidden = !hasPwr;
  if (hasPwr) {
    pwrTxt.textContent = tr('Strom {s} / {d} · Wind {w}%', {
      s: G.power.sup.toFixed(1),
      d: G.power.dem.toFixed(1),
      w: Math.round(G.wind * 100),
    });
    pwrTxt.classList.toggle('low', G.power.ratio < 1);
  }
  if (c) whoTxt.textContent = c.inv[c.isel] ? `${c.name} · ${resName(c.inv[c.isel])}` : c.name;
  if (c) {
    hpBar.style.width = Math.max(0, c.energy) + '%';
    hpBar.style.background = c.energy < 30 ? '#e0572f' : '';
    airWrap.hidden = c.breath >= 100;
    airBar.style.width = c.breath + '%';
  }
  actBtn.textContent = tr(context(c).label);
  const ck = crew.map((o, n) => `${n === G.sel}${o.dead}${Math.round(o.energy / 10)}`).join();
  if (ck !== G.crewKey) {
    G.crewKey = ck;
    crewEl.innerHTML = '';
    crew.forEach((o, n) => {
      const b = document.createElement('button');
      b.className = 'cbtn' + (n === G.sel ? ' sel' : '') + (o.dead ? ' dead' : '');
      b.setAttribute('aria-label', o.name);
      b.title = o.name;
      b.innerHTML = `<span class="cap" style="background:${o.cap}"></span><span class="face"></span><span class="hp"><b style="width:${Math.max(0, o.energy)}%"></b></span>`;
      b.addEventListener('click', () => selectCrew(n));
      crewEl.appendChild(b);
    });
  }
  const k = c ? c.inv.join() + '|' + c.isel : '';
  if (k !== G.invKey) {
    G.invKey = k;
    invEl.innerHTML = '';
    for (let s = 0; s < 5; s++) {
      const b = document.createElement('button');
      const t = c && c.inv[s];
      b.className = 'slot' + (t && s === c.isel ? ' sel' : '');
      b.setAttribute('aria-label', t ? resName(t) : tr('Leer'));
      b.title = t ? resName(t) : '';
      if (t) {
        const cvs = document.createElement('canvas');
        cvs.width = 8;
        cvs.height = 8;
        cvs.getContext('2d').drawImage(itemIcon(t), 0, 0);
        b.appendChild(cvs);
      }
      b.addEventListener('pointerdown', e => {
        e.stopPropagation();
        if (t) c.isel = s;
      });
      invEl.appendChild(b);
    }
  }
}
function drawMini(full) {
  if (mapView.hidden) return;
  const K = 4;
  if (full) {
    const d = new Uint32Array(mimg.data.buffer);
    for (let my = 0; my < 100; my++)
      for (let mx = 0; mx < 350; mx++) {
        let gold = false,
          best = -1;
        for (let q = 0; q < 4; q++) {
          const i = (my * K + (q >> 1) * 2) * W + mx * K + (q & 1) * 2;
          const m = mat[i];
          if (m === GOLD) gold = true;
          if (best < 0 || m !== AIR) best = i;
        }
        const m = mat[best];
        d[my * 350 + mx] = gold
          ? hex('#f2c230')
          : m === AIR
            ? bg[best]
              ? hex('#3a2416')
              : hex('#8fc3ea')
            : hex(MINI[m]);
      }
  }
  mctx.putImageData(mimg, 0, 0);
  mctx.strokeStyle = 'rgba(255,255,255,.8)';
  mctx.lineWidth = 1;
  mctx.strokeRect(
    Math.floor(cam.x / K) + 0.5,
    Math.floor(cam.y / K) + 0.5,
    Math.ceil(G.VW / K),
    Math.ceil(G.VH / K),
  );
  for (const b of builds) {
    mctx.fillStyle = '#c9b89a';
    mctx.fillRect(Math.floor(b.x / K), Math.floor((b.gy - b.h) / K), Math.ceil(b.w / K), Math.ceil(b.h / K));
  }
  for (const a of animals)
    if (a.kind === 'monster') {
      mctx.fillStyle = '#ff4040';
      mctx.fillRect(Math.floor(a.x / K) - 1, Math.floor(a.y / K) - 1, 4, 4);
    }
  crew.forEach((c, n) => {
    if (c.dead) return;
    mctx.fillStyle = n === G.sel ? '#ffffff' : c.cap;
    mctx.fillRect(Math.floor(c.x / K) - 1, Math.floor(c.y / K) - 1, 4, 4);
  });
}
function toggleMap() {
  mapView.hidden = !mapView.hidden;
  drawMini(true);
}
const toastEl = $('toast');
G.toastT = 0;
function toast(key, params) {
  toastEl.textContent = tr(key, params);
  toastEl.hidden = false;
  G.toastT = 170;
}
G.panelT = 0;
function openPanel(title) {
  G.panelT = performance.now();
  pTitle.textContent = tr(title);
  pBody.innerHTML = '';
  panelEl.hidden = false;
  joy.x = joy.y = 0;
  held.dig = false;
  G.digLatch = false;
  document.querySelector('.pad.big').classList.remove('on');
  for (const k in keys) keys[k] = 0;
  return pBody;
}
function closePanel() {
  panelEl.hidden = true;
}
$('pClose').addEventListener('click', () => {
  if (performance.now() - G.panelT < 450) return;
  closePanel();
});
panelEl.addEventListener('pointerdown', e => e.stopPropagation());
function opt(parent, { icon, title, sub, cost, short, disabled, onClick }) {
  const b = document.createElement('button');
  b.className = 'opt' + (short ? ' short' : '');
  if (disabled) b.disabled = true;
  if (icon) {
    const c = document.createElement('canvas');
    c.width = icon.width;
    c.height = icon.height;
    c.getContext('2d').drawImage(icon, 0, 0);
    const k = Math.max(1, Math.min(Math.floor(40 / icon.width), Math.floor(30 / icon.height))) || 1;
    c.style.width = icon.width * k + 'px';
    c.style.height = icon.height * k + 'px';
    c.style.justifySelf = 'center';
    b.appendChild(c);
  }
  b.insertAdjacentHTML(
    'beforeend',
    `<b>${title}</b><small>${sub || ''}</small><span class="cost">${cost || ''}</span>`,
  );
  b.addEventListener('click', e => {
    if (performance.now() - G.panelT < 450) return;
    onClick(e);
  });
  parent.appendChild(b);
  return b;
}
function sec(parent, t) {
  const d = document.createElement('div');
  d.className = 'psec';
  d.textContent = tr(t);
  parent.appendChild(d);
  const l = document.createElement('div');
  l.className = 'plist';
  parent.appendChild(l);
  return l;
}
function openBuild() {
  const c = sel_();
  if (!c || c.dead || G.state !== 'play') return;
  const p = openPanel('Bauen');
  const l = sec(
    p,
    tr(
      'Bezahlt aus dem Gepäck, einer Lore und von Wühlern daneben. Der Bau entsteht dort, wo {name} steht.',
      {
        name: c.name,
      },
    ),
  );
  for (const t in BT) {
    const T = BT[t];
    opt(l, {
      icon: SPR[t],
      title: tr(T.name),
      sub: tr(T.info),
      cost: costTxt(T.cost),
      short: !hasRes(c, T.cost),
      onClick: () => tryBuild(t),
    });
  }
}
function openProd(b) {
  const c = sel_();
  const p = openPanel(BT[b.type].name);
  const note = b.busy
    ? 'Arbeitet gerade.'
    : PWR[b.type] && G.power.sup < PWR[b.type]
      ? 'Wenig Strom: arbeitet langsamer. Bau ein Windrad.'
      : 'Rezepte';
  const l = sec(p, note);
  for (const r of PROD[b.type]) {
    const icon = r.out === 'lorry' ? SPR.lorryIcon : itemIcon(r.out);
    const name = resName(r.out) + (r.n > 1 ? ` ×${r.n}` : '');
    opt(l, {
      icon,
      title: name,
      sub: '',
      cost: costTxt(r.need),
      short: !hasRes(c, r.need),
      disabled: !!b.busy,
      onClick: () => {
        if (!hasRes(c, r.need)) {
          toast('{name} braucht {cost}', { name, cost: costTxt(r.need) });
          return;
        }
        payRes(c, r.need);
        b.busy = r.time;
        b.out = r.out;
        b.n = r.n;
        closePanel();
        toast('{name} wird hergestellt', { name });
      },
    });
  }
}
function openBase() {
  const c = sel_();
  const p = openPanel('Heimatbasis');
  const val = sellVal(c.inv);
  const row = document.createElement('div');
  row.className = 'sellrow';
  row.innerHTML = `<span>${tr('{name} trägt {items}', { name: c.name, items: c.inv.length ? c.inv.map(resName).join(', ') : tr('nichts') })}</span>`;
  const sb = document.createElement('button');
  sb.className = 'go';
  sb.textContent = tr('Verkaufen +{v}', { v: val });
  sb.disabled = !val;
  sb.onclick = () => {
    if (performance.now() - G.panelT < 450) return;
    G.money += val;
    c.inv = [];
    c.isel = 0;
    sfx('coin');
    toast('+{v} Taler', { v: val });
    openBase();
  };
  row.appendChild(sb);
  p.appendChild(row);
  if (lvl() < 3) {
    const nx = lvl() + 1,
      u = UPG[nx],
      L2 = BASELV[nx];
    const ul = sec(p, 'Ausbau');
    const ok = G.money >= u.money && hasRes(c, u.need);
    opt(ul, {
      icon: SPR.base,
      title: tr('Burg Stufe {n}', { n: nx }),
      sub: tr('Preise +{p}%, {c} Wühler, Strom {pw}, größeres Gebiet', {
        p: Math.round((L2.sell - 1) * 100),
        c: L2.crew,
        pw: L2.power,
      }),
      cost: tr('{m} Taler + {cost}', { m: u.money, cost: costTxt(u.need) }),
      short: !ok,
      onClick: () => {
        if (!ok) {
          toast('Ausbau braucht {m} Taler + {cost}', { m: u.money, cost: costTxt(u.need) });
          return;
        }
        G.money -= u.money;
        payRes(c, u.need);
        G.base.lvl = nx;
        calcTerr();
        sfx('done');
        toast('Burg auf Stufe {n} ausgebaut', { n: nx });
        openBase();
      },
    });
  }
  const l = sec(p, tr('Kaufen · Kasse: {m} Taler', { m: G.money }));
  for (const o of BUY) {
    const icon = ITEM[o.t] ? itemIcon(o.t) : o.t === 'lorry' ? SPR.lorryIcon : SPR.clonkIcon;
    const alive = crew.filter(x => !x.dead).length;
    const dis = G.money < o.price || (o.t === 'clonk' && alive >= BASELV[lvl()].crew);
    opt(l, {
      icon,
      title: resName(o.t),
      sub: tr(o.t === 'clonk' ? 'Neues Crewmitglied' : o.t === 'lorry' ? 'Transportiert 25 Sachen' : ''),
      cost: tr('{p} Taler', { p: o.price }),
      disabled: dis,
      onClick: () => {
        if (G.money < o.price) return;
        G.money -= o.price;
        sfx('coin');
        if (o.t === 'clonk') {
          const n = addClonk(G.base.x + 15, G.base.gy - 10);
          toast('{name} ist da', { name: n.name });
        } else if (o.t === 'lorry') {
          lorries.push(mkLorry(G.base.x + 12, G.base.gy - 8));
          toast('Lore steht bereit');
        } else if (c.inv.length < 5) c.inv.push(o.t);
        else spawnItem(o.t, G.base.x + 16, G.base.gy - 6, 0, 0, 20);
        openBase();
      },
    });
  }
}

// ---- Hints ----
G.hintsSeen = new Set();
const HINTS = [
  { id: 'crew', test: () => G.frame > 600, text: 'Oben links wechselst du zwischen deinen Wühlern' },
  { id: 'tree', test: c => nearTree(c), text: 'Aktion fällt den Baum. Holz brauchst du zum Bauen' },
  { id: 'gold', test: c => c.inv.includes('nug'), text: 'Gold zur Heimatbasis bringen und dort verkaufen' },
  {
    id: 'build',
    test: c => countRes(c, 'wood') >= 2 && countRes(c, 'rock') >= 1,
    text: 'Genug Material für eine Hütte: Bauen',
  },
  {
    id: 'rock',
    test: c =>
      c.digging &&
      matAt(Math.floor(c.x + 3 + c.digDir[0] * 9), Math.floor(c.y + 5 + c.digDir[1] * 10)) === ROCK,
    text: 'Fels ist zu hart. Wirf einen Feuerstein darauf',
  },
  { id: 'loam', test: c => c.inv[c.isel] === 'loam', text: 'Lehm in der Hand: Aktion baut eine Brücke' },
  {
    id: 'ore',
    test: c => c.inv.includes('ore') || c.inv.includes('coal'),
    text: 'Erz und Kohle schmilzt der Hochofen zu Metall',
  },
  {
    id: 'plank',
    test: c => c.inv.includes('plank'),
    text: 'Bretter: für Gebäude oder als Holzbrücke (Aktion)',
  },
  { id: 'power', test: () => G.power.ratio < 1, text: 'Zu wenig Strom – bau ein Windrad' },
  { id: 'terr', test: c => !terrOK(c.x), text: 'Du bist außerhalb deines Gebiets. Flaggen erweitern es' },
  { id: 'hang', test: c => c.hangle, text: 'Du hängst an der Decke. Runter lässt los' },
  { id: 'night', test: () => darkness() > 0.35, text: 'Es wird Nacht. Bleib in der Nähe der Basis' },
  {
    id: 'lava',
    test: c => Math.abs(c.y - H + 60) < 40 && G.frame % 60 === 0,
    text: 'Vorsicht: In der Tiefe gibt es Lava und Säure',
  },
];
function checkHints() {
  const c = sel_();
  if (!c || c.dead || G.toastT > 0 || G.tut) return;
  for (const h of HINTS) {
    if (G.hintsSeen.has(h.id)) continue;
    if (h.test(c)) {
      G.hintsSeen.add(h.id);
      toast(h.text);
      return;
    }
  }
}

export {
  $,
  HINTS,
  actBtn,
  airBar,
  airWrap,
  checkHints,
  closePanel,
  crewEl,
  drawMini,
  hpBar,
  hud,
  invEl,
  mapView,
  mctx,
  mimg,
  mini,
  moneyTxt,
  openBase,
  openBuild,
  openPanel,
  openProd,
  opt,
  pBody,
  pTitle,
  panelEl,
  pwrTxt,
  sec,
  toast,
  toastEl,
  toggleMap,
  whoTxt,
};
