// The level selection: one screen for everything that can be started, scrolled from top to
// bottom; every section is a row of big cards swiped sideways. On top what is recommended (the
// next campaign level, the Tagesschacht), then each game mode with one card per world type,
// the two campaign chapters and the hand-built maps. Cards show a picture (levels/preview.js, or
// a small landscape of the world type), a tap opens the detail view with the story, goals,
// dangers, star times and the best time before the start. Opened from the lobby (mode button).
import { tr } from './i18n.js';
import { MAP_IDS } from './levels/index.js';
import { goalText } from './levels/goals.js';
import { previewOf } from './levels/preview.js';
import { BIOMES } from './biomes.js';
import { badge, dayInfo } from './daily.js';
import { GAME_MODES, MODE_IDS } from './modes.js';
import { P, saveProfile } from './profile.js';
import { ALL_IDS, CHAPTER1, CHAPTERS, bestTime, lockedBy, starsOf, unlocked } from './scenarios.js';
import { toolIcon } from './sprites.js';
import './levelselect.css';

// game modes without an icon of their own
const MODE_ICON = { gold: 'trophy', build: 'castle', treasure: 'chest' };
const WORLDS = ['meadow', 'desert', 'winter'];
// the jump chips in the header, each for a group of sections
const GROUPS = [
  { id: 'rec', name: 'Empfohlen' },
  { id: 'modes', name: 'Spielmodi' },
  { id: 'k1', name: 'Kapitel 1', ids: () => CHAPTER1 },
  { id: 'k2', name: 'Kapitel 2', ids: () => CHAPTERS[1].ids },
  { id: 'maps', name: 'Karten' },
];
const mmss = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

let root = null,
  opts = {},
  shown = null, // the card in the detail view: { id, biome }
  pinned = null; // the group of the chip tapped last, lit while its section is in view

// the first open level without a star: where the player goes on
const nextOf = ids => ids.find(id => unlocked(id) && !starsOf(id)) || null;

// what can go wrong in a level, from its rules, its map and its objects
function dangers(M) {
  const L = M.pkg,
    out = [];
  const ev = M.evKinds || (M.evRate ? ['quake', 'volcano'] : []);
  if (ev.includes('quake')) out.push('Erdbeben');
  if (ev.includes('volcano')) out.push('Vulkane');
  if (L) {
    if (L.rules && L.rules.meteors) out.push('Meteore');
    if (L.map.includes('%')) out.push('Lava');
    if (L.map.includes('A')) out.push('Säure');
    if (L.map.includes('~')) out.push('Wasser');
    const kinds = new Set((L.objects || []).map(o => (o.t === 'animal' ? o.kind : o.t)));
    if (kinds.has('monster')) out.push('Monster');
    if (kinds.has('gas')) out.push('Grubengas');
    if (L.lose && L.lose.time) out.push(tr('Zeitlimit {n} Min.', { n: L.lose.time }));
  } else if (M.campaign && M.diff !== 'relaxed') out.push('Monster', 'Grubengas');
  return [...new Set(out)];
}
// a small landscape of a world type for the cards of the game modes: sky, hills, the ground
// with its top layer and a few nuggets, drawn once per world type
const scapes = {};
function landscape(biome, copy = false) {
  if (scapes[biome]) return copy ? cloneOf(scapes[biome]) : scapes[biome];
  const B = BIOMES[biome],
    w = 96,
    h = 54,
    c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d'),
    [s0, s1] = B.sky;
  for (let y = 0; y < 30; y++) {
    const f = y / 29;
    g.fillStyle = `rgb(${s0.map((v, k) => Math.round(v + (s1[k] - v) * f)).join(',')})`;
    g.fillRect(0, y, w, 1);
  }
  const hill = (col, base, amp, per, ph) => {
    g.fillStyle = col;
    for (let x = 0; x < w; x++) {
      const top = Math.round(base - amp * (0.5 + 0.5 * Math.sin((x / per) * Math.PI * 2 + ph)));
      g.fillRect(x, top, 1, h - top);
    }
  };
  hill(B.hills[0], 26, 10, 60, 1);
  hill(B.hills[1], 30, 6, 34, 2.5);
  const ground = x => Math.round(33 + 2 * Math.sin(x / 9));
  for (let x = 0; x < w; x++) {
    const t = ground(x);
    g.fillStyle = B.top[x % B.top.length];
    g.fillRect(x, t, 1, 3);
    g.fillStyle = (x * 7) % 5 ? '#7d5230' : '#6e4728';
    g.fillRect(x, t + 3, 1, h - t - 3);
  }
  g.fillStyle = '#f2c230';
  for (const [x, y] of [
    [14, 44],
    [52, 48],
    [78, 41],
  ])
    g.fillRect(x, y, 3, 2);
  scapes[biome] = c;
  return copy ? cloneOf(c) : c;
}
// the picture of a card: the level's preview, or the landscape of the world type, and the icon
function picture(id, biome, big) {
  const M = GAME_MODES[id],
    box = document.createElement('div');
  box.className = 'ls-pv' + (big ? ' big' : '');
  box.style.background = `rgb(${BIOMES[biome || M.biome || 'meadow'].sky[0].join(',')})`;
  const p = biome
    ? landscape(biome, true)
    : !M.pkg && M.campaign
      ? previewOf(id)
      : M.pkg
        ? previewOf(id, M.pkg)
        : null;
  if (p) box.appendChild(p);
  if (biome) p.className = 'ls-scape';
  const ic = toolIcon(M.icon || MODE_ICON[id] || 'castle');
  ic.className = p && !biome ? 'ls-badge' : 'ls-icon';
  box.appendChild(ic);
  return box;
}
function cloneOf(src) {
  const c = document.createElement('canvas');
  c.width = src.width;
  c.height = src.height;
  c.getContext('2d').drawImage(src, 0, 0);
  return c;
}
const nameOf = (id, M, biome) =>
  M.campaign ? `${M.n} · ${tr(M.name)}` : biome ? `${tr(M.name)} · ${tr(BIOMES[biome].name)}` : tr(M.name);
const starRow = s => '★'.repeat(s) + '☆'.repeat(3 - s);
const versus = M => M.pkg && M.pkg.objects.some(o => o.t === 'base' && o.team === 1);
// is this card what the lobby has chosen? (a game mode: also the same world type)
const isCur = (id, biome) => id === opts.current && (!biome || biome === P.mode);

function card(id, { biome, next } = {}) {
  const M = GAME_MODES[id],
    open = !M.campaign || unlocked(id),
    b = document.createElement('button');
  b.className = 'ls-card' + (open ? '' : ' locked') + (id === next ? ' next' : '');
  if (isCur(id, biome)) b.classList.add('cur');
  b.dataset.id = id;
  if (biome) b.dataset.biome = biome;
  b.appendChild(picture(id, biome));
  const t = document.createElement('div');
  t.className = 'ls-t';
  t.innerHTML = `<b>${esc(biome ? tr(BIOMES[biome].name) : nameOf(id, M))}</b><span>${
    M.campaign ? (open ? starRow(starsOf(id)) : '🔒') : M.map ? esc(tr(versus(M) ? 'Versus' : 'Koop')) : ''
  }</span>`;
  b.appendChild(t);
  // maps: what they are about, in a line (game modes say it once above their row)
  if (M.map) {
    const d = document.createElement('small');
    d.className = 'ls-d';
    d.textContent = tr(M.desc, { goal: M.goal });
    b.appendChild(d);
  }
  if (id === next) ribbon(b, 'Weiter');
  b.onclick = () => (shown && shown.id === id && shown.biome === biome && open ? go(id, biome) : detail(id, biome));
  return b;
}
function ribbon(b, text) {
  const r = document.createElement('i');
  r.className = 'ls-ribbon';
  r.textContent = tr(text);
  b.appendChild(r);
}
// the card of the Tagesschacht: today's world, opened in its own panel in the lobby
function dailyCard() {
  const b = document.createElement('button'),
    D = dayInfo();
  b.className = 'ls-card ls-daily';
  b.dataset.id = 'daily';
  const box = document.createElement('div');
  box.className = 'ls-pv';
  const sc = landscape(D.biome, true);
  sc.className = 'ls-scape';
  box.appendChild(sc);
  const ic = toolIcon('dig');
  ic.className = 'ls-icon';
  box.appendChild(ic);
  b.appendChild(box);
  const t = document.createElement('div');
  t.className = 'ls-t';
  t.innerHTML = `<b>${esc(tr('Tagesschacht'))}</b>`;
  b.appendChild(t);
  const d = document.createElement('small');
  d.className = 'ls-d';
  d.textContent = badge();
  b.appendChild(d);
  ribbon(b, 'Heute');
  b.onclick = () => {
    close();
    opts.onDaily && opts.onDaily();
  };
  return b;
}

// a section: a title (with a line under it) and its row of cards
function section(list, key, group, title, sub, cards) {
  const s = document.createElement('section');
  s.className = 'ls-sec';
  s.dataset.s = key;
  s.dataset.g = group;
  s.innerHTML = `<h3 class="ls-h">${title}${sub ? ` <small>${esc(sub)}</small>` : ''}</h3>`;
  const row = document.createElement('div');
  row.className = 'ls-cards';
  for (const c of cards) row.appendChild(c);
  s.appendChild(row);
  list.appendChild(s);
}
const allowed = g => !opts.tabs || opts.tabs.includes(g);

function sections() {
  const list = root.querySelector('.ls-list');
  list.innerHTML = '';
  // recommended: the campaign level to go on with, and today's shaft (alone only)
  if (allowed('rec')) {
    const nx = nextOf(ALL_IDS),
      cards = [];
    if (nx) cards.push(card(nx, { next: nx }));
    if (opts.onDaily) cards.push(dailyCard());
    if (cards.length) section(list, 'rec', 'rec', esc(tr('Empfohlen')), '', cards);
  }
  if (allowed('modes'))
    for (const id of MODE_IDS) {
      const M = GAME_MODES[id];
      section(
        list,
        id,
        'modes',
        esc(tr(M.name)),
        tr(M.desc, { goal: M.goal }),
        WORLDS.map(biome => card(id, { biome })),
      );
    }
  for (const grp of GROUPS.filter(g => g.ids && allowed(g.id))) {
    const ids = grp.ids(),
      got = ids.reduce((s, id) => s + starsOf(id), 0),
      next = nextOf(ids);
    section(
      list,
      grp.id,
      grp.id,
      `${esc(tr(grp.name))} <b class="ls-stars">★${got}/${ids.length * 3}</b>`,
      '',
      ids.map(id => card(id, { next })),
    );
  }
  if (allowed('maps'))
    section(
      list,
      'maps',
      'maps',
      esc(tr('Karten')),
      tr('Koop und Versus'),
      MAP_IDS.map(id => card(id)),
    );
}
function chips() {
  const nav = root.querySelector('nav');
  nav.innerHTML = '';
  for (const grp of GROUPS) {
    const sec = root.querySelector(`.ls-sec[data-g="${grp.id}"]`);
    if (!sec) continue;
    const b = document.createElement('button');
    b.className = 'ls-tab';
    b.dataset.t = grp.id;
    b.textContent = tr(grp.name);
    b.onclick = () => {
      root.classList.remove('detail');
      shown = null;
      pinned = grp.id;
      sec.scrollIntoView({ block: 'start' });
      mark(grp.id);
    };
    nav.appendChild(b);
  }
}
// the chip of the section at the top of the list lights up
function mark(g) {
  for (const b of root.querySelectorAll('.ls-tab')) b.classList.toggle('on', b.dataset.t === g);
}
function onScroll() {
  const list = root.querySelector('.ls-list'),
    box = list.getBoundingClientRect(),
    top = box.top + 8;
  // (a section near the end cannot scroll up to the top: its chip stays lit while it is seen)
  if (pinned) {
    const r = list.querySelector(`.ls-sec[data-g="${pinned}"]`).getBoundingClientRect();
    if (r.bottom > box.top && r.top < box.bottom) return mark(pinned);
    pinned = null;
  }
  let g = null;
  for (const s of list.querySelectorAll('.ls-sec')) if (s.getBoundingClientRect().top <= top || !g) g = s.dataset.g;
  // (at the very end the last section counts even when it cannot reach the top)
  if (list.scrollTop + list.clientHeight >= list.scrollHeight - 2) g = list.lastElementChild?.dataset.g || g;
  mark(g);
}

function detail(id, biome) {
  shown = { id, biome };
  const M = GAME_MODES[id],
    L = M.pkg,
    open = !M.campaign || unlocked(id),
    d = root.querySelector('.ls-detail');
  d.innerHTML = '';
  d.appendChild(picture(id, biome, true));
  const info = document.createElement('div');
  info.className = 'ls-info';
  // one goal: the level's own sentence for it; several: each one
  const goals = L && L.goals.length > 1 ? L.goals.map(goalText) : [tr(M.desc, { goal: M.goal })];
  const dz = dangers(M);
  const size = L
    ? `${tr(BIOMES[L.biome || 'meadow'].name)} · ${L.size[0]} × ${L.size[1]}`
    : biome
      ? tr(BIOMES[biome].name)
      : '';
  // a line of the detail: a small label left, the content (already escaped) right
  const row = (label, body) => `<div class="ls-row"><small>${esc(tr(label))}</small>${body}</div>`;
  let html = `<h3>${esc(nameOf(id, M, biome))}</h3>`;
  if (M.intro) html += `<p class="ls-story">${esc(tr(M.intro))}</p>`;
  html += row('Ziel', `<ul>${goals.map(g => `<li>${esc(g)}</li>`).join('')}</ul>`);
  if (dz.length) html += row('Gefahr', `<p>${dz.map(x => `<span class="ls-chip">${esc(tr(x))}</span>`).join('')}</p>`);
  if (M.map) html += row('Spielart', `<p>${esc(tr(versus(M) ? 'Koop oder Versus' : 'Koop'))}</p>`);
  if (M.territory) html += row('Regel', `<p>${esc(tr('Bauen nur im eigenen Gebiet, Flaggen erweitern es'))}</p>`);
  if (size) html += row('Welt', `<p>${esc(size)}</p>`);
  if (M.campaign && M.stars) {
    const times = tr('3 Sterne unter {a} Min., 2 Sterne unter {b} Min.', { a: M.stars[0], b: M.stars[1] }),
      best = bestTime(id) ? ` · ${tr('Bestzeit {t}', { t: mmss(bestTime(id)) })}` : '';
    html += row('Sterne', `<p><b class="ls-stars">${starRow(starsOf(id))}</b> ${esc(times + best)}</p>`);
  }
  info.innerHTML = html;
  const go_ = document.createElement('button');
  go_.className = 'ls-go';
  if (open) {
    go_.textContent = tr(opts.pick ? 'Auswählen' : 'Spielen');
    go_.onclick = () => go(id, biome);
  } else {
    go_.disabled = true;
    go_.textContent = tr('Erst 1 Stern in {name}', { name: tr(GAME_MODES[lockedBy(id)].name) });
  }
  info.appendChild(go_);
  d.appendChild(info);
  root.classList.add('detail');
  (open ? go_ : root.querySelector('.ls-back')).focus({ preventScroll: true });
}
const cardOf = s =>
  root.querySelector(`.ls-card[data-id="${s.id}"]${s.biome ? `[data-biome="${s.biome}"]` : ':not([data-biome])'}`);
function back() {
  if (root.classList.contains('detail')) {
    root.classList.remove('detail');
    const c = cardOf(shown);
    shown = null;
    c && c.focus();
    return;
  }
  close();
}
function go(id, biome) {
  P.gmode = id;
  if (biome) P.mode = biome;
  saveProfile();
  close();
  opts.onPick && opts.onPick(id);
}
function close() {
  if (!root) return;
  root.hidden = true;
  root.classList.remove('detail');
  shown = null;
  opts.onClose && opts.onClose();
}

// arrows: left and right along a row, up and down to the nearest card of the row above or below
function arrow(e) {
  const rows = [...root.querySelectorAll('.ls-cards')].map(r => [...r.children]),
    el = document.activeElement,
    r = rows.findIndex(cs => cs.includes(el));
  if (r < 0 || root.classList.contains('detail')) return;
  const k = rows[r].indexOf(el);
  let n = null;
  if (e.key === 'ArrowRight') n = rows[r][k + 1];
  else if (e.key === 'ArrowLeft') n = rows[r][k - 1];
  else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    const to = rows[r + (e.key === 'ArrowDown' ? 1 : -1)];
    n = to && to[Math.min(k, to.length - 1)];
  } else return;
  e.preventDefault();
  e.stopImmediatePropagation();
  if (!n) return;
  n.focus({ preventScroll: true });
  n.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}
function build() {
  root = document.createElement('div');
  root.id = 'levelsel';
  root.hidden = true;
  root.innerHTML = `<header><button class="ls-back" aria-label="${esc(tr('Zurück'))}">‹</button><nav></nav></header>
    <div class="ls-list"></div><div class="ls-detail"></div>`;
  root.querySelector('.ls-back').onclick = back;
  root.querySelector('.ls-list').addEventListener('scroll', onScroll, { passive: true });
  document.getElementById('lobby').appendChild(root);
  // keys while the selection is open (on the window: the focus may be on nothing, e.g. after
  // a disabled button); handled keys do not reach the game or the lobby
  addEventListener(
    'keydown',
    e => {
      if (root.hidden) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopImmediatePropagation();
        back();
        return;
      }
      arrow(e);
    },
    true,
  );
}

// opts: tabs (allowed groups: rec, modes, k1, k2, maps), current (chosen id), pick (only choose,
// do not start: the host in a room), onPick(id), onDaily() (the Tagesschacht card), onClose()
function openSelect(o = {}) {
  if (!root) build();
  opts = o;
  root.hidden = false;
  root.classList.remove('detail');
  shown = null;
  pinned = null;
  sections();
  chips();
  // the chosen card (or the level to go on with) is in view and has the focus
  const list = root.querySelector('.ls-list');
  list.scrollTop = 0;
  const focus = list.querySelector('.ls-card.cur') || list.querySelector('.ls-card');
  if (focus) {
    focus.focus({ preventScroll: true });
    focus.scrollIntoView({ block: 'center', inline: 'nearest' });
  }
  onScroll();
}
const selectOpen = () => !!root && !root.hidden;

export { close as closeSelect, landscape, openSelect, selectOpen };
