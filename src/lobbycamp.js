// The Kristallstollen panel in the lobby: collect what the tunnel crew mined, upgrades bought with
// crystals and the skins (outfits and building styles). The rules live in camp.js and skins.js.
import { projectStatus } from './heroprojects.js';
import { TITLES } from './heromissions.js';
import { ROLES, chapterCount, progressOf } from './heroskills.js';
import { HEROES } from './heroes.js';
import { G } from './state.js';
import { GEAR, UPGRADES, buyGear, buySkin, hasGearForGood, buyUpgrade, camp, collect, level, owns, pending, price, rate, vaultHours } from './camp.js';
import { tr } from './i18n.js';
import { drawPortrait } from './portrait.js';
import { P, saveProfile } from './profile.js';
import { BSTYLES, OUTFITS, restyle } from './skins.js';
import { drawMinerFrame } from './minerart.js';
import { paintedObject } from './objectart.js';
import bannerUrl from './assets/scenes/stollen.jpg';
import './camp.css';
import { sfx } from './sound.js';
import { SPR, itemIcon, toolIcon } from './sprites.js';
import { openPanel, opt, sec, toast } from './ui.js';

// a little crystal, 7×9 texels
const GEMART = ['...o...', '..oLo..', '.oLlko.', 'oLllkko', 'oLlkkko', 'oLlkkdo', '.olkdo.', '..odo..', '...o...'];
const GEMCOL = { o: '#24160c', L: '#e8f4ff', l: '#9ad0ff', k: '#5a8fe0', d: '#3a5aa8' };
function crystalIcon() {
  const art = toolIcon('crystal');
  if (art.painted) return art;
  const c = document.createElement('canvas');
  c.width = 7;
  c.height = 9;
  const g = c.getContext('2d');
  GEMART.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      if (ch === '.') return;
      g.fillStyle = GEMCOL[ch];
      g.fillRect(x, y, 1, 1);
    }),
  );
  return c;
}
function outfitIcon(id) {
  const c = document.createElement('canvas');
  c.width = 160;
  c.height = 224;
  const x = c.getContext('2d');
  x.scale(8, 8);
  drawPortrait(x, 2, 7, 1, P.cap, P.hat, false, id, P.hero);
  return c;
}
function styleIcon(id) {
  const spr = id === 'wood' ? SPR.hut : restyle(SPR.hut, id);
  const c = document.createElement('canvas');
  c.width = spr.width;
  c.height = spr.height;
  c.getContext('2d').drawImage(spr, 0, 0);
  return c;
}
const UP_ICON = {
  crew: () => (toolIcon('crew').painted ? toolIcon('crew') : SPR.diggerIcon),
  vault: crystalIcon,
  cash: () => itemIcon('nug'),
  pick: () => itemIcon('rock'),
  wood: () => itemIcon('wood'),
};
const kTxt = n => tr('{n} Kristalle', { n });

// a Wühler in an outfit, painted from the hero's sheet (minerart.js), as a canvas of w×h layout
// pixels: scale sizes the figure, foot is where its feet stand (below h: the picture cuts off)
function minerCanvas(outfit, { w = 150, h = 150, scale = 6, foot = 255, mode = '' } = {}) {
  const c = document.createElement('canvas');
  c.width = w * 2;
  c.height = h * 2;
  c.style.width = w + 'px';
  c.style.height = h + 'px';
  c.className = 'painted';
  const g = c.getContext('2d');
  g.scale(2, 2);
  if (!drawMinerFrame(g, w * 0.44, foot, 1, 'idle', 0, P.cap || '#c8402c', outfit, scale, mode, P.hero || 'anna')) {
    // (the pixel portrait while the sheets are missing)
    g.imageSmoothingEnabled = false;
    drawPortrait(g, Math.round(w / 2 - 8 * (scale / 6) * 1.5), Math.max(0, h - 20 * (scale / 6) * 1.5), 1, P.cap, P.hat, false, outfit, P.hero);
  }
  return c;
}
// a building in a style: the painted hut with the style's colours (skins.js restyle)
function styleCanvas(id) {
  const c = document.createElement('canvas');
  c.width = 300;
  c.height = 200;
  c.className = 'painted';
  const g = c.getContext('2d'),
    frame = paintedObject(SPR.hut),
    pic = frame ? (id === 'wood' ? frame : restyle(frame, id)) : id === 'wood' ? SPR.hut : restyle(SPR.hut, id),
    k = Math.min(280 / pic.width, 184 / pic.height);
  g.imageSmoothingEnabled = !!frame;
  g.imageSmoothingQuality = 'high';
  g.drawImage(pic, (300 - pic.width * k) / 2, 196 - pic.height * k, pic.width * k, pic.height * k);
  return c;
}

function openCamp(hooks = {}) {
  const panelEl = document.getElementById('panel'),
    top = panelEl ? panelEl.scrollTop : 0;
  const reopen = () => {
    const y = panelEl ? panelEl.scrollTop : 0;
    openCamp(hooks);
    if (panelEl) panelEl.scrollTop = y;
  };
  const C = camp(),
    n = pending();
  const body = openPanel('Kristallstollen'),
    p = document.createElement('div');
  p.className = 'camp';
  body.appendChild(p);
  // the banner: the crystals in the vault of the purse, the crew's yield, and your own Wühler
  const hero = document.createElement('div');
  hero.className = 'camp-hero';
  hero.style.backgroundImage = `url(${bannerUrl})`;
  const chip = document.createElement('div');
  chip.className = 'camp-k';
  const gem = crystalIcon();
  gem.classList.add('camp-gem');
  const count = document.createElement('b');
  count.textContent = C.k;
  count.title = kTxt(C.k);
  chip.append(gem, count);
  const head = document.createElement('p');
  head.className = 'hint camp-head';
  head.textContent = tr('Deine Kristalle: {n} · Die Stollen-Crew schürft {r} pro Stunde, der Tresor fasst {h} Stunden.', {
    n: C.k,
    r: rate(),
    h: vaultHours(),
  });
  const me = minerCanvas(P.outfit, { w: 110, h: 150, scale: 3.7, foot: 148 });
  me.classList.add('camp-me');
  hero.append(chip, head, me);
  p.appendChild(hero);
  // 1. collect
  const hours = Math.min(vaultHours(), (Date.now() - C.t) / 3600000),
    full = Math.round((hours / vaultHours()) * 100);
  const take = opt(sec(p, 'Kassieren'), {
    icon: crystalIcon(),
    title: n ? tr('Deine Crew hat {n} Kristalle geschürft', { n }) : tr('Die Crew schürft gerade'),
    sub: tr('Tresor {p} % voll', { p: full }),
    cost: n ? tr('Kassieren') : '',
    disabled: !n,
    onClick: () => {
      const got = collect();
      if (got) {
        sfx('coin');
        hooks.burst?.(24, ['#9ad0ff', '#e8f4ff', '#5a8fe0']);
      }
      reopen();
    },
  });
  take.classList.add('camp-collect');
  if (n) take.classList.add('ready');
  if (full >= 100) take.classList.add('brim');
  take.insertAdjacentHTML('beforeend', `<span class="camp-vault" aria-hidden="true"><i style="width:${Math.min(100, full)}%"></i></span>`);
  // 2. upgrades, with a dot for every level
  const up = sec(p, 'Ausbau');
  for (const id in UPGRADES) {
    const U = UPGRADES[id],
      cost = price(id);
    const b = opt(up, {
      icon: UP_ICON[id](),
      title: `${tr(U.name)} · ${tr('Stufe {n}/{m}', { n: level(id), m: U.max })}`,
      sub: tr(U.sub) + (U.home ? '' : ' · ' + tr('Nur im Solo-Spiel')),
      cost: cost == null ? '✓' : kTxt(cost),
      disabled: cost == null || C.k < cost,
      onClick: () => {
        if (buyUpgrade(id)) sfx('done');
        reopen();
      },
    });
    const pips = document.createElement('span');
    pips.className = 'camp-pips';
    pips.setAttribute('aria-hidden', 'true');
    for (let k = 0; k < U.max; k++) pips.insertAdjacentHTML('beforeend', `<i class="${k < level(id) ? 'on' : ''}"></i>`);
    b.appendChild(pips);
  }
  // 3. gear for good: bought once, there in every game (no need to buy it at the castle)
  const gl = sec(p, 'Ausrüstung · Einmal kaufen, in jedem Spiel dabei');
  for (const id in GEAR) {
    const g = GEAR[id],
      own = hasGearForGood(id);
    opt(gl, {
      icon: toolIcon(id),
      title: tr(g.name),
      sub: tr(g.sub),
      cost: own ? '✓' : kTxt(g.k),
      state: own ? 'done' : C.k >= g.k ? 'ok' : 'poor',
      why: own || C.k >= g.k ? '' : tr('Fehlt: {list}', { list: kTxt(g.k - C.k) }),
      onClick: () => {
        if (own) return;
        if (!buyGear(id)) return toast('Zu wenig Kristalle');
        sfx('done');
        toast('{name} ist ab jetzt in jedem Spiel dabei', { name: tr(g.name) });
        reopen();
      },
    }).dataset.gear = id;
  }
  const badges = HEROES.filter(h => chapterCount(progressOf(P, h.id), h.id) === 3);
  if (badges.length) {
    const showcase = sec(p, 'Meisterschaftsabzeichen');
    for (const hero of badges) {
      const badge = document.createElement('p');
      badge.textContent = '★ ' + hero.name + ' · ' + tr(TITLES[hero.id]);
      showcase.appendChild(badge);
    }
  }
  if (G.mode === 'settlement') {
    const project = sec(p, 'Gemeinsames Projekt');
    const text = document.createElement('p');
    const status = projectStatus();
    text.textContent = tr(status.title);
    for (const [key, goal, label] of status.tasks) {
      const row = document.createElement('p'); row.textContent = tr(label) + ` · ${Math.min(goal, status.values[key] || 0)}/${goal}`; project.append(row);
    }
    project.appendChild(text);
  }
  // 4. skins: outfits and building styles (seen by everybody, also in multiplayer), as large cards
  const choose = (kind, id, set) => {
    const key = `${kind}:${id}`;
    if (!owns(key)) {
      if (!buySkin(key)) return toast('Zu wenig Kristalle');
      sfx('done');
    }
    set(id);
    saveProfile();
    reopen();
  };
  const card = (grid, { art, name, swatch, worn, own, cost, locked, poor, wornText, ownText, lockText, onPick }) => {
    const b = document.createElement('button');
    b.className = 'skin-card' + (worn ? ' worn' : '') + (locked ? ' locked' : '') + (!own && !locked && poor ? ' poor' : '') + (own ? ' own' : '');
    b.setAttribute('aria-label', `${name} · ${worn ? wornText : own ? ownText : locked ? lockText : kTxt(cost)}`);
    b.setAttribute('aria-pressed', worn ? 'true' : 'false');
    art.classList.add('skin-art');
    b.appendChild(art);
    const t = document.createElement('b');
    t.className = 'skin-name';
    if (swatch) t.insertAdjacentHTML('beforeend', `<i class="skin-dot" style="background:${swatch}"></i>`);
    t.append(name);
    const st = document.createElement('span');
    st.className = 'skin-state';
    st.textContent = worn ? '✓ ' + wornText : own ? ownText : locked ? '🔒 ' + lockText : kTxt(cost);
    b.append(t, st);
    b.addEventListener('click', () => {
      if (locked) return toast('Wird mit der Meisterschaft des Wühlers freigeschaltet');
      onPick();
    });
    grid.appendChild(b);
    return b;
  };
  const ol = sec(p, 'Outfit');
  ol.className = 'skin-grid';
  for (const id in OUTFITS) {
    const O = OUTFITS[id],
      own = owns('o:' + id);
    card(ol, {
      art: minerCanvas(id, { w: 200, h: 150, scale: 6, foot: 255 }),
      name: tr(O.name),
      swatch: O.pal.T || '#4f7fc0',
      worn: P.outfit === id,
      own,
      cost: O.k,
      locked: !own && !!O.master,
      poor: C.k < O.k,
      wornText: tr('Angezogen'),
      ownText: tr('Anziehen'),
      lockText: tr('Meisterschaft'),
      onPick: () => choose('o', id, v => (P.outfit = v)),
    });
  }
  const bl = sec(p, 'Baustil');
  bl.className = 'skin-grid style-grid';
  for (const id in BSTYLES) {
    const S = BSTYLES[id],
      own = owns('b:' + id);
    card(bl, {
      art: styleCanvas(id),
      name: tr(S.name),
      worn: P.bstyle === id,
      own,
      cost: S.k,
      poor: C.k < S.k,
      wornText: tr('Aktiv'),
      ownText: tr('Verwenden'),
      onPick: () => choose('b', id, v => (P.bstyle = v)),
    });
  }
  if (panelEl) panelEl.scrollTop = top;
}

export { crystalIcon, openCamp };
