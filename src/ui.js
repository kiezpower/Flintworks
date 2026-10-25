import { stock, takeStock } from './store.js';
import { toolSection } from './tools.js';
import { knowsAll, needText, researchSection } from './research.js';
const depthEl = document.getElementById('depthTxt');
const misEl = document.getElementById('misTxt');
import { GAME_MODES, mode } from './modes.js';
const goalWrap = document.getElementById('goalWrap'),
  goalTxt = document.getElementById('goalTxt'),
  goalBar = document.getElementById('goalBar');
import { BASELV, BT, BUY, UPG, costTxt, hasRes, lvl, mkLorry, payRes, resName, terrOn, tryBuild } from './buildings.js';
import { context } from './clonk.js';
import { addClonk, sel_, spawnItem } from './entities.js';
import { held, joy, keys } from './input.js';
import { calcTerr, cam } from './render.js';
import { sfx } from './sound.js';
import { ITEM, SPR, detailed, itemIcon, padIcon, toolIcon } from './sprites.js';
import { tr } from './i18n.js';
import { focusBadge, openCrew } from './crewui.js';
import { register, send } from './commands.js';
import { BUILDABLE, VK, cannotBuild } from './vehicles/index.js';
import { vehicleIcon, vehicleOf } from './vehicles/core.js';
import { canShoot } from './combat.js';
import { isPlayer } from './players.js';
import { missionText } from './missions.js';
import { G, INV_MAX, animals, builds, crew, lorries } from './state.js';
import { PLANK, AIR, GOLD, MINI, W, bg, hex, mat, surf } from './world.js';

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
for (const el of document.querySelectorAll('[data-ico]')) el.style.backgroundImage = `url(${padIcon(el.dataset.ico)})`;
mapView.addEventListener('pointerdown', e => {
  e.stopPropagation();
  toggleMap();
});
G.invKey = '';
G.crewKey = '';
function hud() {
  const c = sel_();
  const M = mode();
  const goldMode = M === GAME_MODES.gold;
  moneyTxt.textContent = goldMode
    ? tr('{money} / {goal} Taler', { money: G.money, goal: M.goal })
    : tr('{money} Taler', { money: G.money });
  goalWrap.hidden = goldMode || !!M.tutorial;
  if (!goalWrap.hidden) {
    const p = Math.min(M.goal, M.prog());
    goalTxt.textContent = `${tr(M.name)} ${p}/${M.goal}`;
    goalBar.style.width = (p / M.goal) * 100 + '%';
  }
  pwrTxt.hidden = true;
  // store contents as small icons with counts
  const sk = G.store ? Object.entries(G.store).filter(([, n]) => n > 0) : [];
  const key = sk.map(([t, n]) => t + n).join();
  if (key !== G.storeKey) {
    G.storeKey = key;
    storeRow.hidden = !sk.length;
    storeRow.innerHTML = sk
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([t, n]) => `<span title="${resName(t)}"><img src="${iconUrl(t)}" alt="">${n}</span>`)
      .join('');
  }
  if (c) {
    // depth below the surface, 1 pixel ≈ 0.25 m
    const d = Math.round((c.y + 10 - surf[Math.max(0, Math.min(W - 1, Math.floor(c.x + 3)))]) / 4);
    depthEl.hidden = d < 3;
    if (d >= 3) depthEl.textContent = tr('Tiefe {d} m', { d });
    depthEl.classList.toggle('deep', d > 11);
  }
  const mt = missionText();
  if (mt !== G.misKey) {
    G.misKey = mt;
    misEl.hidden = !mt;
    misEl.textContent = mt ? '➜ ' + mt : '';
  }
  if (c) whoTxt.textContent = c.inv[c.isel] ? `${c.name} · ${resName(c.inv[c.isel])}` : c.name;
  if (c) {
    hpBar.style.width = Math.max(0, c.energy) + '%';
    hpBar.style.background = c.energy < 30 ? '#e0572f' : '';
    airWrap.hidden = c.breath >= 100;
    airBar.style.width = c.breath + '%';
  }
  const cx = context(c);
  actBtn.textContent = tr(cx.label);
  // the action button shows what it will do
  if (cx.label !== G.actKey) {
    G.actKey = cx.label;
    actIco.style.backgroundImage = `url(${actIcon(cx.label)})`;
  }
  // automatic digging hides the dig and jump buttons; throw only shows with something in hand
  btnsEl.classList.toggle('auto', !!G.autoDig);
  btnsEl.classList.toggle('jumpon', !!G.jumpBtn);
  // (also with the bow and arrows, and in a catapult or airship)
  const thr = c && !c.dead && (c.ride != null ? THROWERS[vehicleOf(c)?.kind] : c.inv[c.isel] || canShoot(c));
  btnsEl.classList.toggle('noitem', !thr);
  const ck = crew.map(o => `${o === c}${o.dead}${Math.round(o.energy / 10)}${o.focus}`).join();
  if (ck !== G.crewKey) {
    G.crewKey = ck;
    crewEl.innerHTML = '';
    crew.forEach((o, n) => {
      if ((o.team || 0) !== G.myTeam) return; // Versus: only your team
      const b = document.createElement('button');
      b.className = 'cbtn' + (o === c ? ' sel' : '') + (o.dead ? ' dead' : '');
      b.setAttribute('aria-label', o.name);
      b.title = o.name;
      b.innerHTML = `<span class="cap" style="background:${o.cap}"></span><span class="face"></span><span class="hp"><b style="width:${Math.max(0, o.energy)}%"></b></span>${isPlayer(o) ? '' : focusBadge(o)}`;
      // tap a Wühler: give out jobs (your own one: for everybody)
      b.addEventListener('click', () => openCrew(n));
      crewEl.appendChild(b);
    });
  }
  const k = c ? c.inv.join() + '|' + c.isel : '';
  if (k !== G.invKey) {
    G.invKey = k;
    invEl.innerHTML = '';
    // three slots are shown; the bag holds up to INV_MAX, the rest is behind the "+" slot
    const shown = c && c.isel >= 3 ? [0, 1, c.isel] : [0, 1, 2];
    for (const s of shown) {
      const b = document.createElement('button');
      const t = c && c.inv[s];
      b.className = 'slot' + (t && s === c.isel ? ' sel' : '');
      b.setAttribute('aria-label', t ? resName(t) : tr('Leer'));
      b.title = t ? resName(t) : '';
      if (t) {
        const cvs = document.createElement('canvas');
        cvs.width = cvs.height = 10;
        cvs.getContext('2d').drawImage(itemIcon(t), 0, 0);
        b.appendChild(cvs);
      }
      b.addEventListener('pointerdown', e => {
        e.stopPropagation();
        if (t) send('isel', { i: s });
      });
      invEl.appendChild(b);
    }
    if (c && c.inv.length > 3) {
      const more = document.createElement('button');
      more.className = 'slot more';
      more.textContent = '+' + (c.inv.length - 3);
      more.setAttribute('aria-label', tr('Tasche'));
      more.addEventListener('pointerdown', e => {
        e.stopPropagation();
        openBag();
      });
      invEl.appendChild(more);
    }
  }
}
// the whole bag: pick what goes into the hand
function openBag() {
  const c = sel_();
  if (!c || c.dead) return;
  const p = openPanel('Tasche');
  const l = sec(p, tr('{n} von {max} Plätzen', { n: c.inv.length, max: INV_MAX }));
  c.inv.forEach((t, k) =>
    opt(l, {
      icon: itemIcon(t),
      title: resName(t),
      cost: k === c.isel ? '✓' : '',
      short: true,
      onClick: () => {
        send('isel', { i: k });
        closePanel();
      },
    }),
  );
}
const THROWERS = { catapult: 1, airship: 1 }; // vehicles that use Wurf
const ACT_ICONS = { Fällen: 'act', Basis: 'castle', Öffnen: 'chest', Bauen: 'hammer', Zuschlagen: 'sword' };
const actIconCache = {};
function actIcon(label) {
  if (actIconCache[label]) return actIconCache[label];
  let url;
  if (ACT_ICONS[label]) url = padIcon(ACT_ICONS[label]);
  else if (label === 'Brücke') url = itemIcon('plank').toDataURL();
  else if (label === 'Zünden') url = itemIcon('tnt').toDataURL();
  else if (label === 'Lore') url = SPR.lorryIcon.toDataURL();
  else url = padIcon('act');
  return (actIconCache[label] = url);
}
const actIco = document.querySelector('.pad.act .ico'),
  btnsEl = $('btns');
const storeRow = $('storeRow');
const iconUrls = {};
const iconUrl = t => (iconUrls[t] ||= itemIcon(t).toDataURL());
const thumb = $('miniThumb'),
  tctx = thumb.getContext('2d');
function drawMini(full) {
  if (G.state !== 'play') return;
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
  mctx.strokeRect(Math.floor(cam.x / K) + 0.5, Math.floor(cam.y / K) + 0.5, Math.ceil(G.VW / K), Math.ceil(G.VH / K));
  for (const b of builds) {
    mctx.fillStyle = '#c9b89a';
    mctx.fillRect(Math.floor(b.x / K), Math.floor((b.gy - b.h) / K), Math.ceil(b.w / K), Math.ceil(b.h / K));
  }
  for (const a of animals)
    if (a.kind === 'monster') {
      mctx.fillStyle = '#ff4040';
      mctx.fillRect(Math.floor(a.x / K) - 1, Math.floor(a.y / K) - 1, 4, 4);
    }
  // treasure hunt: closed chests are marked on the map
  if (G.mode === 'treasure' && G.chests)
    for (const ch of G.chests)
      if (!ch.open) {
        mctx.fillStyle = (G.tick >> 4) & 1 ? '#ffe066' : '#b8860b';
        mctx.fillRect(Math.floor(ch.x / K) - 1, Math.floor(ch.y / K) - 1, 5, 4);
      }
  crew.forEach((c, n) => {
    if (c.dead) return;
    const px = Math.floor(c.x / K),
      py = Math.floor(c.y / K);
    // players (you in white) a bit bigger than helpers
    if (isPlayer(c)) {
      mctx.fillStyle = '#24160c';
      mctx.fillRect(px - 2, py - 2, 6, 6);
    }
    mctx.fillStyle = c === sel_() ? '#ffffff' : c.cap;
    mctx.fillRect(px - 1, py - 1, 4, 4);
  });
  // the small always-visible map in the corner
  tctx.imageSmoothingEnabled = true;
  tctx.drawImage(mini, 0, 0, thumb.width, thumb.height);
}
function toggleMap() {
  mapView.hidden = !mapView.hidden;
  drawMini(true);
}
const toastEl = $('toast');
G.toastT = 0;
function toast(key, params) {
  // multiplayer host: a message caused by another player's order goes to that player
  if (G.toastHook && G.toastHook(key, params)) return;
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
  sfx('open');
  joy.x = joy.y = 0;
  held.dig = false;
  G.digLatch = false;
  document.querySelector('.pad.big').classList.remove('on');
  for (const k in keys) keys[k] = 0;
  return pBody;
}
function closePanel() {
  if (!panelEl.hidden) sfx('close');
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
    // shown through its double-resolution copy (lit from above, outlined) at a whole multiple
    // of its size; small icons on screens without fine pixels keep the simple version
    const w = icon.hi ? icon.width / 2 : icon.width,
      h = icon.hi ? icon.height / 2 : icon.height,
      k = Math.max(1, Math.min(Math.floor(48 / w), Math.floor(40 / h))) || 1,
      hi = icon.hi ? icon : k > 1 || devicePixelRatio >= 2 ? detailed(icon) : icon,
      f0 = hi === icon && !icon.hi ? k : k / 2,
      // (whole device pixels per texel, so no pixel comes out wider than its neighbours)
      f = (f0 * devicePixelRatio) % 1 ? Math.max(1, Math.floor(f0)) : f0;
    const c = document.createElement('canvas');
    c.width = hi.width;
    c.height = hi.height;
    c.getContext('2d').drawImage(hi, 0, 0);
    c.style.width = hi.width * f + 'px';
    c.style.height = hi.height * f + 'px';
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
    tr('Bezahlt aus dem Lager und dem Gepäck. Der Bau entsteht dort, wo {name} steht.', {
      name: c.name,
    }),
  );
  // stairs: one plank, or plain wood if there are no planks
  const stairCost = hasRes(c, { plank: 1 }) ? { plank: 1 } : { wood: 1 };
  opt(l, {
    icon: toolIcon('stairs'),
    title: tr('Treppe'),
    sub: tr('Holztreppe schräg nach oben in Blickrichtung – auch zu Gebäuden, unter denen gegraben wurde'),
    cost: tr('1 Brett oder 1 Holz'),
    short: !hasRes(c, stairCost),
    onClick: () => {
      closePanel();
      send('stairs');
    },
  });
  // vehicles and rails
  const lv = sec(p, 'Fahrzeuge');
  opt(lv, {
    icon: itemIcon('plank'),
    title: tr(c.laying ? 'Schienen: fertig' : 'Schienen legen'),
    sub: knowsAll(['rails'])
      ? tr('Beim Laufen entstehen Schienen hinter dir – 1 Brett oder Holz pro 10 Stück')
      : needText(['rails']),
    short: true,
    onClick: () => {
      closePanel();
      send('rails');
    },
  });
  for (const k of BUILDABLE) {
    const K = VK[k],
      why = cannotBuild(c, k);
    opt(lv, {
      icon: vehicleIcon(k),
      title: tr(K.name),
      sub: knowsAll(K.res) ? tr(K.info) : needText(K.res),
      cost: K.lvl && why === 'Erst ab Burgstufe {n}' ? tr(why, { n: K.lvl }) : costTxt(K.cost),
      short: !!why,
      onClick: () => {
        closePanel();
        send('vehicle', { kind: k });
      },
    });
  }
  const lb = sec(p, 'Gebäude');
  for (const t in BT) {
    const T = BT[t];
    if (T.hidden || (T.terrOnly && !terrOn())) continue;
    opt(lb, {
      icon: SPR[t],
      title: tr(T.name),
      sub: tr(T.info),
      cost: costTxt(T.cost),
      short: !hasRes(c, T.cost),
      onClick: () => {
        closePanel();
        send('build', { type: t });
      },
    }).dataset.tut = 'b_' + t;
  }
}
function openBase() {
  const c = sel_();
  const p = openPanel('Heimatbasis');
  // the store: gold is sold and materials are stored automatically when walking in
  const ls = sec(p, tr('Lager · Gold und Edelsteine werden beim Betreten verkauft'));
  const kinds = Object.keys(ITEM).filter(t => stock(t) > 0);
  if (!kinds.length) {
    const e = document.createElement('p');
    e.className = 'hint';
    e.textContent = tr('Noch leer. Bring Holz, Steine, Erz und Kohle zur Basis.');
    ls.appendChild(e);
  }
  for (const t of kinds)
    opt(ls, {
      icon: itemIcon(t),
      title: resName(t),
      sub: tr('{n} im Lager', { n: stock(t) }),
      cost: tr('Nehmen'),
      short: true,
      disabled: c.inv.length >= INV_MAX,
      onClick: () => {
        send('take', { t });
        openBase();
      },
    });
  researchSection(p, { opt, sec, reopen: openBase });
  toolSection(p, c, { opt, sec, toast, reopen: openBase });
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
        send('buy', { t: o.t });
        openBase();
      },
    });
  }
}

// ---- Commands from the panels above (run for the player who sent them) ----
register('isel', (c, { i }) => {
  if (c.inv[i] !== undefined) c.isel = i;
  G.invKey = '';
});
register('stairs', c => {
  const cost = hasRes(c, { plank: 1 }) ? { plank: 1 } : { wood: 1 };
  if (!hasRes(c, cost)) return toast('Treppe braucht 1 Brett oder 1 Holz');
  if (c.climb || c.hangle || c.tumble || c.bridge) return;
  payRes(c, cost);
  c.bridge = { n: 0, x0: c.x + 3 + c.face * 4, y0: c.y + 10, dy: -0.62, m: PLANK, len: 70, th: 2 };
  sfx('hammer');
});
register('take', (c, { t }) => {
  if (c.inv.length >= INV_MAX || !takeStock(t)) return;
  c.inv.push(t);
  c.isel = c.inv.length - 1;
  G.invKey = '';
  sfx('pick');
});
register('buy', (c, { t }) => {
  const o = BUY.find(b => b.t === t);
  if (!o || G.money < o.price) return;
  if (t === 'clonk' && crew.filter(x => !x.dead).length >= BASELV[lvl()].crew) return;
  G.money -= o.price;
  sfx('coin');
  if (t === 'clonk') {
    const n = addClonk(G.base.x + 15, G.base.gy - 10);
    toast('{name} ist da', { name: n.name });
  } else if (t === 'lorry') {
    lorries.push(mkLorry(G.base.x + 12, G.base.gy - 8));
    toast('Lore steht bereit');
  } else if (c.inv.length < INV_MAX) c.inv.push(t);
  else spawnItem(t, G.base.x + 16, G.base.gy - 6, 0, 0, 20);
});

export {
  $,
  actBtn,
  airBar,
  airWrap,
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
