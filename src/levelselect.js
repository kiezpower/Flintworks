// The level selection: one full-screen place for everything that can be started. Tabs for the
// game modes, the two campaign chapters and the hand-built maps; cards with a preview picture
// (levels/preview.js), and a detail view with the story, goals, dangers, star times and the best
// time before the start. Opened from the lobby (mode button, "play" on the campaign).
import { tr } from './i18n.js';
import { MAP_IDS } from './levels/index.js';
import { goalText } from './levels/goals.js';
import { previewOf } from './levels/preview.js';
import { BIOMES } from './biomes.js';
import { GAME_MODES, MODE_IDS } from './modes.js';
import { P, saveProfile } from './profile.js';
import { CHAPTER1, CHAPTERS, bestTime, lockedBy, starsOf, unlocked } from './scenarios.js';
import { toolIcon } from './sprites.js';
import './levelselect.css';

// game modes without an icon of their own
const MODE_ICON = { gold: 'trophy', build: 'castle', treasure: 'chest' };
const TABS = [
  { id: 'modes', name: 'Spielmodi', ids: () => MODE_IDS },
  { id: 'k1', name: 'Kapitel 1', ids: () => CHAPTER1, stars: true },
  { id: 'k2', name: 'Kapitel 2', ids: () => CHAPTERS[1].ids, stars: true },
  { id: 'maps', name: 'Karten', ids: () => MAP_IDS },
];
const tabOf = id => (TABS.find(t => t.ids().includes(id)) || TABS[0]).id;
const mmss = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

let root = null,
  opts = {},
  tab = 'k2',
  shown = null; // the level in the detail view

// the first open level of a chapter without a star: where the player goes on
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
// the picture of a card: the preview, or the big icon of a game mode
function picture(id, big) {
  const M = GAME_MODES[id],
    box = document.createElement('div');
  box.className = 'ls-pv' + (big ? ' big' : '');
  box.style.background = `rgb(${BIOMES[M.biome || 'meadow'].sky[0].join(',')})`;
  const p = !M.pkg && M.campaign ? previewOf(id) : M.pkg ? previewOf(id, M.pkg) : null;
  if (p) box.appendChild(p);
  const ic = toolIcon(M.icon || MODE_ICON[id] || 'castle');
  ic.className = p ? 'ls-badge' : 'ls-icon';
  box.appendChild(ic);
  return box;
}
const nameOf = (id, M) => (M.campaign ? `${M.n} · ${tr(M.name)}` : tr(M.name));
const starRow = s => '★'.repeat(s) + '☆'.repeat(3 - s);

function card(id, next) {
  const M = GAME_MODES[id],
    open = !M.campaign || unlocked(id),
    b = document.createElement('button');
  b.className = 'ls-card' + (open ? '' : ' locked') + (id === next ? ' next' : '');
  if (id === opts.current) b.classList.add('cur');
  b.dataset.id = id;
  b.appendChild(picture(id));
  const t = document.createElement('div');
  t.className = 'ls-t';
  t.innerHTML = `<b>${esc(nameOf(id, M))}</b><span>${
    M.campaign ? (open ? starRow(starsOf(id)) : '🔒') : M.map ? esc(tr(versus(M) ? 'Versus' : 'Koop')) : ''
  }</span>`;
  b.appendChild(t);
  // game modes and maps: what they are about, in a line
  if (!M.campaign) {
    const d = document.createElement('small');
    d.className = 'ls-d';
    d.textContent = tr(M.desc, { goal: M.goal });
    b.appendChild(d);
  }
  if (id === next) {
    const r = document.createElement('i');
    r.className = 'ls-ribbon';
    r.textContent = tr('Weiter');
    b.appendChild(r);
  }
  b.onclick = () => (shown === id && open ? go(id) : detail(id));
  return b;
}
const versus = M => M.pkg && M.pkg.objects.some(o => o.t === 'base' && o.team === 1);

function grid() {
  const T = TABS.find(t => t.id === tab),
    ids = T.ids(),
    next = T.stars ? nextOf(ids) : null;
  const g = root.querySelector('.ls-grid');
  g.innerHTML = '';
  for (const id of ids) g.appendChild(card(id, next));
  for (const b of root.querySelectorAll('.ls-tab')) b.classList.toggle('on', b.dataset.t === tab);
  // the level to go on with (or the chosen one) is in view and has the focus
  const focus = g.querySelector('.cur') || g.querySelector('.next') || g.firstChild;
  focus && focus.focus({ preventScroll: true });
  focus && focus.scrollIntoView({ block: 'nearest' });
}

function detail(id) {
  shown = id;
  const M = GAME_MODES[id],
    L = M.pkg,
    open = !M.campaign || unlocked(id),
    d = root.querySelector('.ls-detail');
  d.innerHTML = '';
  d.appendChild(picture(id, true));
  const info = document.createElement('div');
  info.className = 'ls-info';
  // one goal: the level's own sentence for it; several: each one
  const goals = L && L.goals.length > 1 ? L.goals.map(goalText) : [tr(M.desc, { goal: M.goal })];
  const dz = dangers(M);
  const size = L ? `${tr(BIOMES[L.biome || 'meadow'].name)} · ${L.size[0]} × ${L.size[1]}` : '';
  // a line of the detail: a small label left, the content (already escaped) right
  const row = (label, body) => `<div class="ls-row"><small>${esc(tr(label))}</small>${body}</div>`;
  let html = `<h3>${esc(nameOf(id, M))}</h3>`;
  if (M.intro) html += `<p class="ls-story">${esc(tr(M.intro))}</p>`;
  html += row('Ziel', `<ul>${goals.map(g => `<li>${esc(g)}</li>`).join('')}</ul>`);
  if (dz.length) html += row('Gefahr', `<p>${dz.map(x => `<span class="ls-chip">${esc(tr(x))}</span>`).join('')}</p>`);
  if (M.map) html += row('Spielart', `<p>${esc(tr(versus(M) ? 'Koop oder Versus' : 'Koop'))}</p>`);
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
    go_.onclick = () => go(id);
  } else {
    go_.disabled = true;
    go_.textContent = tr('Erst 1 Stern in {name}', { name: tr(GAME_MODES[lockedBy(id)].name) });
  }
  info.appendChild(go_);
  d.appendChild(info);
  root.classList.add('detail');
  (open ? go_ : root.querySelector('.ls-back')).focus({ preventScroll: true });
}
function back() {
  if (root.classList.contains('detail')) {
    root.classList.remove('detail');
    const c = root.querySelector(`.ls-card[data-id="${shown}"]`);
    shown = null;
    c && c.focus();
    return;
  }
  close();
}
function go(id) {
  P.gmode = id;
  P.selTab = tabOf(id);
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

function build() {
  root = document.createElement('div');
  root.id = 'levelsel';
  root.hidden = true;
  root.innerHTML = `<header><button class="ls-back" aria-label="${esc(tr('Zurück'))}">‹</button><nav></nav></header>
    <div class="ls-grid"></div><div class="ls-detail"></div>`;
  root.querySelector('.ls-back').onclick = back;
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
      // arrows move between the cards (rows as the grid lays them out)
      const cards = [...root.querySelectorAll('.ls-card')],
        k = cards.indexOf(document.activeElement);
      if (k < 0 || root.classList.contains('detail')) return;
      const cols = Math.max(1, Math.round(root.querySelector('.ls-grid').clientWidth / cards[0].offsetWidth));
      const step = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: cols, ArrowUp: -cols }[e.key];
      if (!step) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      const n = cards[Math.max(0, Math.min(cards.length - 1, k + step))];
      n.focus();
      n.scrollIntoView({ block: 'nearest' });
    },
    true,
  );
}
function tabs() {
  const nav = root.querySelector('nav');
  nav.innerHTML = '';
  for (const T of TABS) {
    if (opts.tabs && !opts.tabs.includes(T.id)) continue;
    const b = document.createElement('button');
    b.className = 'ls-tab';
    b.dataset.t = T.id;
    const ids = T.ids(),
      got = ids.reduce((s, id) => s + starsOf(id), 0);
    b.innerHTML = esc(tr(T.name)) + (T.stars ? ` <small>★${got}/${ids.length * 3}</small>` : '');
    b.onclick = () => {
      tab = T.id;
      P.selTab = tab;
      saveProfile();
      root.classList.remove('detail');
      shown = null;
      grid();
    };
    nav.appendChild(b);
  }
}

// opts: tabs (allowed tab ids), tab (to open), current (chosen id), pick (only choose, do not
// start: the host in a room), onPick(id), onClose()
function openSelect(o = {}) {
  if (!root) build();
  opts = o;
  const allowed = TABS.filter(t => !o.tabs || o.tabs.includes(t.id)).map(t => t.id);
  // the tab to open: asked for, the chosen thing's, the last one, or where the campaign goes on
  const want = o.tab || (o.current && GAME_MODES[o.current] && tabOf(o.current)) || P.selTab;
  tab = allowed.includes(want) ? want : allowed.includes('k2') && nextOf(CHAPTERS[1].ids) ? 'k2' : allowed[0];
  root.hidden = false;
  root.classList.remove('detail');
  shown = null;
  tabs();
  grid();
}
const selectOpen = () => !!root && !root.hidden;

export { close as closeSelect, openSelect, selectOpen };
