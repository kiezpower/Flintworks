// Tagesschacht: one world a day, the same for everybody (seed, world type and a twist come from the
// date). Eight minutes to earn as much as possible; the best result of the day, medals and the
// streak of days in a row are kept in the profile, and the result can be shared like a Wordle grid
// with a link that leads straight back to today's shaft (?daily).
import { announce } from './announce.js';
import { BIOMES } from './biomes.js';
import { tr } from './i18n.js';
import { GAME_MODES } from './modes.js';
import { LIVE, isNative, ownWeb } from './platform.js';
import { P, saveProfile } from './profile.js';
import { G } from './state.js';
import { copyText, inRoom } from './net/room.js';
import { openPanel, opt, sec, toast } from './ui.js';
import { Share } from '@capacitor/share';

const LEN = 8 * 60 * 60; // play ticks (60 a second; a slower tempo does not cost time)
const MEDALS = [200, 450, 800]; // Taler earned for bronze, silver, gold
const MEDAL_ICON = ['🪨', '🥉', '🥈', '🥇'];
const BIOME_ICON = { meadow: '🌳', desert: '🏜️', winter: '❄️' };
// the twist of the day: events, research or money at the start
const TWISTS = [
  { id: 'gold', name: 'Goldrausch', intro: 'Ein ganz normaler Schacht: grab, verkauf, werd reich!' },
  {
    id: 'volcano',
    name: 'Vulkantag',
    intro: 'Heute brechen oft Vulkane aus. Sie spucken Gold und Edelsteine – und Lava.',
    evRate: 3,
    evKinds: ['volcano'],
    evNext: 2400,
  },
  {
    id: 'quake',
    name: 'Bebentag',
    intro: 'Die Erde bebt heute oft. Stütz deine Stollen ab!',
    evRate: 2.5,
    evKinds: ['quake'],
    evNext: 2000,
  },
  {
    id: 'drill',
    name: 'Bohrtag',
    intro: 'Der Bohrwagen ist schon erforscht, Kohle und Metall liegen im Lager.',
    research: ['mech', 'metal'],
    store: { coal: 8, metal: 2, plank: 3 },
  },
  { id: 'rich', name: 'Startkapital', intro: 'Heute startest du mit 200 Talern extra.', money: 240 },
];

// ---- the day ----
const FIRST = Date.UTC(2026, 9, 26); // Tagesschacht #1
// number of the day in the player's own time zone: everybody gets a new shaft at midnight
const dayNo = (d = new Date()) =>
  Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - FIRST) / 864e5) + 1;
function hash(n) {
  let t = (n * 0x9e3779b1) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return (t ^ (t >>> 14)) >>> 0;
}
// everything about day n: always the same for the same day
function dayInfo(n = dayNo()) {
  const h = hash(n);
  return {
    n,
    seed: h,
    biome: ['meadow', 'desert', 'winter'][h % 3],
    // (steps of 3 through 5 twists: two days in a row never have the same one)
    twist: TWISTS[(((n * 3) % TWISTS.length) + TWISTS.length) % TWISTS.length],
  };
}
// the day of the shaft being played (fixed when it started, also over midnight)
const cur = () => dayInfo(G.daily?.n ?? dayNo());
const medalOf = score => MEDALS.filter(m => score >= m).length;
const left = () => Math.max(0, LEN - (G.playTicks || 0));
const clock = () => {
  const s = Math.ceil(left() / 60);
  return `⏱ ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

// ---- the game mode ----
GAME_MODES.daily = {
  name: 'Tagesschacht',
  desc: 'Verdiene in 8 Minuten so viel du kannst',
  daily: true,
  icon: 'dig',
  diff: 'adventure',
  goal: Infinity, // the clock ends the round
  stars: [99, 99],
  prog: () => G.earned || 0,
  get seed() {
    return cur().seed;
  },
  get biome() {
    return cur().biome;
  },
  get intro() {
    return cur().twist.intro;
  },
  get evRate() {
    return cur().twist.evRate;
  },
  get evKinds() {
    return cur().twist.evKinds;
  },
  get research() {
    return cur().twist.research;
  },
  get store() {
    return cur().twist.store;
  },
  get money() {
    return cur().twist.money;
  },
  setup() {
    G.daily = { n: dayNo() };
    const T = cur().twist;
    if (T.evNext) G.evNext = T.evNext;
  },
  // every half second: the last minute, then the end
  tick() {
    const l = left();
    if (l <= 3600 && !G.daily.f1) {
      G.daily.f1 = true;
      announce('Noch eine Minute!');
    }
    if (l <= 0) G.onLevelEnd?.(true, 'Die Zeit ist um.');
  },
  // the HUD: time left, earned so far and the next medal
  status() {
    const e = G.earned || 0,
      m = medalOf(e),
      next = MEDALS[m];
    return {
      text: next ? `${clock()} · ${e} → ${MEDAL_ICON[m + 1]} ${next}` : `${clock()} · ${e} ${MEDAL_ICON[3]}`,
      p: next ? e - (MEDALS[m - 1] || 0) : 1,
      of: next ? next - (MEDALS[m - 1] || 0) : 1,
    };
  },
};

// ---- results in the profile ----
// P.daily: best score per day (last 30 days), tries per day, the streak of days in a row
function store_() {
  P.daily = P.daily || { best: {}, tries: {}, streak: 0, last: 0, top: 0 };
  return P.daily;
}
// the streak still counts if the last shaft was today or yesterday
const streak = () => {
  const D = store_();
  return D.last >= dayNo() - 1 ? D.streak : 0;
};
const bestOf = n => store_().best[n];
// a finished shaft: returns whether it is a new best for that day
function record(n, score) {
  const D = store_();
  if (D.last !== n) {
    D.streak = D.last === n - 1 ? D.streak + 1 : 1;
    D.last = Math.max(D.last, n);
  }
  D.top = Math.max(D.top || 0, D.streak);
  D.tries[n] = (D.tries[n] || 0) + 1;
  const best = !(D.best[n] >= score);
  if (best) D.best[n] = score;
  for (const k of Object.keys(D.best)) if (k < n - 30) delete D.best[k];
  for (const k of Object.keys(D.tries)) if (k < n - 30) delete D.tries[k];
  saveProfile();
  return best;
}

// ---- sharing ----
const link = () =>
  `${ownWeb() && location.hostname !== 'localhost' ? location.origin + location.pathname : LIVE}?daily`;
// ⛏ Flintworks · Tagesschacht #12 / 🏜️ Vulkantag / a bar of gold, the score, medal and streak
function shareText(n = dayNo()) {
  const D = dayInfo(n),
    s = bestOf(n) || 0,
    cells = Math.min(8, Math.round(s / 100));
  return [
    `⛏ Flintworks · ${tr('Tagesschacht')} #${n}`,
    `${BIOME_ICON[D.biome]} ${tr(D.twist.name)}`,
    `${'🟨'.repeat(cells)}${'⬛'.repeat(8 - cells)} ${tr('{n} Taler', { n: s })}`,
    `${MEDAL_ICON[medalOf(s)]}${streak() > 1 ? ' · 🔥 ' + tr('{n} Tage in Folge', { n: streak() }) : ''}`,
    '',
    tr('Schaffst du mehr?'),
  ].join('\n');
}
// share sheet in the app and on phones, clipboard elsewhere; 'shared' | 'copied' | 'failed'
async function shareDaily(n) {
  const text = shareText(n),
    url = link();
  try {
    if (isNative()) {
      await Share.share({ title: 'Flintworks', text, url, dialogTitle: tr('Ergebnis teilen') });
      return 'shared';
    }
    if (navigator.share && matchMedia('(pointer: coarse)').matches) {
      await navigator.share({ title: 'Flintworks', text, url });
      return 'shared';
    }
    return (await copyText(`${text}\n${url}`)) ? 'copied' : 'failed';
  } catch (e) {
    return /cancel|abort/i.test(String(e?.message || e?.name)) ? 'shared' : 'failed';
  }
}
async function shareAndTell(n) {
  const r = await shareDaily(n);
  if (r === 'copied') toast('Ergebnis kopiert – füg es in den Chat ein');
  else if (r === 'failed') toast('Teilen nicht möglich');
}

// ---- texts for the lobby, the panel and the end screen ----
// hours and minutes until the next shaft
function nextIn() {
  const d = new Date(),
    m = Math.ceil((new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1) - d) / 60000);
  return tr('Neuer Schacht in {h} h {m} min', { h: Math.floor(m / 60), m: m % 60 });
}
// the button in the lobby: "#12 · 🔥 3 · 🥈 540"
function badge() {
  const n = dayNo(),
    s = bestOf(n),
    st = streak();
  return [`#${n}`, st ? `🔥 ${st}` : '', s != null ? `${MEDAL_ICON[medalOf(s)]} ${s}` : tr('Neu!')]
    .filter(Boolean)
    .join(' · ');
}
// the last 7 days as medals (· for a day without a shaft)
function week() {
  const n = dayNo(),
    out = [];
  for (let k = n - 6; k <= n; k++) {
    if (k < 1) continue;
    const s = bestOf(k);
    out.push(s == null ? '·' : MEDAL_ICON[medalOf(s)]);
  }
  return out.join(' ');
}
const esc = s => String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]);

// the panel in the lobby: today's world, best, streak, play and share
function openDaily(hooks) {
  const n = dayNo(),
    D = dayInfo(n),
    best = bestOf(n),
    p = openPanel(tr('Tagesschacht #{n}', { n }));
  const box = document.createElement('div');
  box.className = 'dl-box';
  box.innerHTML = `<p class="dl-world">${BIOME_ICON[D.biome]} <b>${tr(BIOMES[D.biome].name)}</b> · <b>${tr(D.twist.name)}</b></p>
    <p>${tr(D.twist.intro)}</p>
    <p class="hint">${tr('Jeden Tag eine neue Welt – für alle gleich. 8 Minuten: verdiene so viel du kannst.')}</p>
    <p class="dl-medals">${MEDALS.map((m, k) => `${MEDAL_ICON[k + 1]} ${m}`).join('  ')}</p>
    <div class="dl-stats">
      <span><small>${tr('Heute')}</small><b>${best != null ? `${MEDAL_ICON[medalOf(best)]} ${best}` : '–'}</b></span>
      <span><small>${tr('Serie')}</small><b>🔥 ${streak()}</b></span>
      <span><small>${tr('Beste Serie')}</small><b>${store_().top || 0}</b></span>
    </div>
    ${week().replace(/[· ]/g, '') ? `<p class="dl-week">${esc(week())}</p>` : ''}
    <p class="hint">${nextIn()}</p>`;
  p.appendChild(box);
  const running = hooks.hasRun() && G.mode === 'daily' && G.daily?.n === n;
  const go = document.createElement('button');
  go.className = 'go dl-go';
  go.id = 'dlGo';
  go.textContent = tr(running ? 'Weiterspielen' : best != null ? 'Nochmal versuchen' : 'Los geht’s!');
  box.appendChild(go);
  box.insertAdjacentHTML(
    'beforeend',
    `<p class="hint">${tr(best != null ? 'Dein bestes Ergebnis zählt' : 'Die Uhr läuft ab dem Start')}</p>`,
  );
  go.addEventListener('click', () => {
    if (performance.now() - G.panelT < 450) return;
    if (inRoom()) return toast('Den Tagesschacht spielst du allein – verlass erst den Raum');
    if (running) return hooks.play(false);
    // a game in progress would be lost: ask with a second tap
    if (hooks.hasRun() && performance.now() - armed > 3000) {
      armed = performance.now();
      return toast('Nochmal tippen: Tagesschacht starten, dein Spielstand geht verloren');
    }
    armed = -Infinity;
    if (hooks.hasRun()) hooks.discard();
    G.daily = null; // (today's shaft, not the one played last)
    hooks.play(false, 'daily');
  });
  if (best != null)
    opt(sec(p, ''), {
      title: tr('Ergebnis teilen'),
      sub: tr('Fordere deine Freunde heraus'),
      onClick: () => shareAndTell(n),
    });
}
let armed = -Infinity;

// the end of a shaft: record it and show the result (HTML for the end card)
function endCard() {
  const n = G.daily?.n ?? dayNo(),
    s = G.earned || 0,
    m = medalOf(s),
    isBest = record(n, s),
    best = bestOf(n);
  return {
    stars: m,
    html: `<h1>${tr('Tagesschacht #{n}', { n })}</h1>
      <p class="dl-big">${MEDAL_ICON[m]} ${tr('{n} Taler', { n: s })}</p>
      <p>${isBest ? tr('Neuer Tagesrekord!') : tr('Dein Bestes heute: {n} Taler', { n: best })}${streak() > 1 ? ' · 🔥 ' + tr('{n} Tage in Folge', { n: streak() }) : ''}</p>
      <p class="hint">${MEDAL_ICON[m + 1] ? tr('Nächste Medaille: {m} ab {n} Taler', { m: MEDAL_ICON[m + 1], n: MEDALS[m] }) : tr('Gold! Besser geht’s nicht.')} · ${nextIn()}</p>`,
  };
}

// opened with ?daily (a shared result): show today's shaft once the lobby is up
let fromLink = new URLSearchParams(location.search).has('daily');
function dailyFromLink(hooks) {
  if (!fromLink) return;
  fromLink = false;
  try {
    const u = new URL(location.href);
    u.searchParams.delete('daily');
    history.replaceState(null, '', u);
  } catch {}
  openDaily(hooks);
}

export {
  LEN,
  MEDALS,
  TWISTS,
  badge,
  dailyFromLink,
  dayInfo,
  dayNo,
  endCard,
  medalOf,
  openDaily,
  record,
  shareAndTell,
  shareText,
  streak,
};
