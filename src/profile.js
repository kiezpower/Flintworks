// Player profile across games: level, trophies, hats and daily quests (stored locally).
import { achCheck, achTrack } from './achievements.js';
import { sfx } from './sound.js';
import { G } from './state.js';
import { toast } from './ui.js';
import { tr } from './i18n.js';

const KEY = 'flintworks-profile';
const HATS = {
  none: { name: 'Keiner' },
  flower: { name: 'Blume', t: 10 },
  helm: { name: 'Grubenhelm', lvl: 3, tut: true, sub: 'Leuchtet nachts weiter' }, // or for the tutorial
  cowboy: { name: 'Cowboyhut', lvl: 5 },
  viking: { name: 'Wikingerhelm', t: 60 },
  wizard: { name: 'Zauberhut', lvl: 8 },
  crown: { name: 'Krone', t: 150 },
};
const CAPS = ['#c8402c', '#2f7fd0', '#3f9e4a', '#9a4fc4', '#e08a1f', '#d04f8a', '#3fb3a8', '#f2f2f2'];
const QUESTS = {
  sell: { text: 'Verkaufe Waren für {n} Taler', n: [120, 200, 300], xp: 60 },
  build: { text: 'Baue {n} Gebäude', n: [2, 3, 4], xp: 60 },
  chop: { text: 'Fälle {n} Bäume', n: [4, 6, 8], xp: 40 },
  monster: { text: 'Besiege {n} Monster', n: [1, 2], xp: 80 },
  gem: { text: 'Finde {n} Edelsteine', n: [1, 2, 3], xp: 80 },
  chest: { text: 'Öffne {n} Schatztruhen', n: [1, 2], xp: 80 },
  gold: { text: 'Verkaufe {n} Goldnuggets', n: [4, 6, 10], xp: 60 },
  fish: { text: 'Fange {n} Fische', n: [2, 3, 4], xp: 70 },
  // (a depth is a record, not a count: it counts when reached, see track())
  deep: { text: 'Erreiche {n} m Tiefe', n: [30, 50, 70], xp: 80 },
};
// The daily tasks: three of nine kinds a day, the same for everybody on a day (like the
// Tagesschicht), changing at midnight in the player's own time zone. The kinds go round in steps of
// four through the list, so two days in a row never share a kind, and each kind is back every
// three days at most; the amount of a kind is rolled from the day, so a returning kind may ask for
// more or less.
const QUEST_ORDER = ['sell', 'chop', 'monster', 'gold', 'build', 'gem', 'fish', 'chest', 'deep'];
const dayNumber = (d = new Date()) => Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 864e5);
const dayHash = (n, i) => {
  let h = Math.imul(n * 2654435761 + i * 40503, 2246822519);
  h ^= h >>> 15;
  h = Math.imul(h, 3266489917);
  return (h ^ (h >>> 13)) >>> 0;
};
function questsFor(n) {
  const k = (((n * 4) % QUEST_ORDER.length) + QUEST_ORDER.length) % QUEST_ORDER.length;
  return [0, 1, 2].map(i => {
    const id = QUEST_ORDER[(k + i) % QUEST_ORDER.length],
      Q = QUESTS[id];
    return { id, goal: Q.n[dayHash(n, i) % Q.n.length] };
  });
}
// hats unlock by level or trophies
const unlockText = h => (h.lvl ? `${h.tut ? 'Tutorial · ' : ''}Level ${h.lvl}` : h.t ? `${h.t} 🏆` : '');
const XP = { sell: 0.2, build: 25, chop: 8, monster: 40, gem: 20, gold: 0, tutorial: 60, chest: 30 };

// the calendar day here (not in UTC: the tasks change at midnight where the player is)
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const P = {
  xp: 0,
  level: 1,
  trophies: 0,
  hats: ['none'],
  hat: 'none',
  cap: CAPS[0],
  questDay: '',
  quests: [],
  tutorialDone: false,
  mode: 'random',
  games: 0,
  wins: 0,
  // Heimatbergwerk (camp.js) and skins (skins.js); old crystals (P.crystals) are not these
  camp: null,
  owned: [],
  outfit: 'blue',
  bstyle: 'wood',
  // gear bought for good in the Heimatbergwerk (camp.js GEAR)
  gear: [],
};
try {
  Object.assign(P, JSON.parse(localStorage.getItem(KEY) || '{}'));
} catch {}
// a fresh digger gets a made-up name instead of everybody being "Kurt"; it can be changed any time
const NAME_A = ['Flink', 'Kies', 'Erz', 'Moos', 'Stein', 'Funken', 'Kohlen', 'Gold', 'Lehm', 'Fels', 'Rost', 'Kupfer', 'Silber', 'Torf', 'Quarz', 'Ruß'];
const NAME_B = ['bart', 'hacke', 'zahn', 'nase', 'faust', 'bein', 'kopf', 'hand', 'ohr', 'beule'];
const pick = a => a[Math.floor(Math.random() * a.length)];
function randomName() {
  let n;
  do n = pick(NAME_A) + pick(NAME_B);
  while (n.length > 12 || n === P.name);
  return n;
}
const cleanName = s => String(s).replace(/[<>&"]/g, '').trim().slice(0, 12);
if (!P.name) {
  P.name = randomName();
  saveProfile();
}
// the Fluffel had another name before v1.69.0 (level id "wipfrettung"): carry over campaign stars, times and the chosen mode
const oldIds = P.campaign?.wipfrettung != null || P.campaignTime?.wipfrettung != null || P.gmode === 'wipfrettung';
if (P.campaign?.wipfrettung) P.campaign.fluffelrettung = Math.max(P.campaign.fluffelrettung || 0, P.campaign.wipfrettung);
if (P.campaignTime?.wipfrettung) {
  const t = P.campaignTime.fluffelrettung;
  P.campaignTime.fluffelrettung = t ? Math.min(t, P.campaignTime.wipfrettung) : P.campaignTime.wipfrettung;
}
delete P.campaign?.wipfrettung;
delete P.campaignTime?.wipfrettung;
if (P.gmode === 'wipfrettung') P.gmode = 'fluffelrettung';
if (oldIds) saveProfile();
delete P.crystals;
delete P.tutStats; // (tutorial numbers are analytics events now, analytics.js)
delete P.chestDay;
delete P.road;
function saveProfile() {
  try {
    localStorage.setItem(KEY, JSON.stringify(P));
  } catch {}
}
const xpNeed = () => 80 + P.level * 40;
function rollQuests() {
  const t = today();
  if (P.questDay === t) return;
  // (not the very first day: then nothing is "new")
  P.questNew = !!P.questDay;
  P.questDay = t;
  P.quests = questsFor(dayNumber()).map(q => ({ ...q, have: 0, done: false }));
  saveProfile();
}
function addXp(n) {
  P.xp += n;
  let up = false;
  while (P.xp >= xpNeed()) {
    P.xp -= xpNeed();
    P.level++;
    up = true;
  }
  if (up) {
    sfx('done');
    toast('Level {n} erreicht!', { n: P.level });
    unlockHats();
  }
}
// Progress event from the game: XP plus daily quest progress
let saveT = 0;
// (max: a counter that keeps its highest value, like the depth, achievements.js)
function track(id, amount = 1, max = false) {
  rollQuests();
  if (!max) addXp(Math.round((XP[id] ?? 0) * amount));
  if (achTrack(P, id, amount, addXp, max)) saveProfile();
  let moved = false;
  for (const q of P.quests)
    if (q.id === id && q.have < q.goal) {
      // (a record like the depth counts as far as it was reached, a count adds up)
      const to = Math.min(q.goal, max ? Math.max(q.have, amount) : q.have + amount);
      if (to === q.have) continue;
      q.have = to;
      moved = true;
      // (G.questQuiet: the browser tests do not want today's tasks to talk over what they check, debug.js)
      if (q.have >= q.goal && !G.questQuiet) toast('Aufgabe erfüllt! Belohnung unter Menü → Aufgaben');
    }
  // (a record is reported all the time: saved only when a task moved)
  if (max) {
    if (moved) saveProfile();
    return;
  }
  if (performance.now() - saveT > 2000) {
    saveT = performance.now();
    saveProfile();
  }
}
function claimQuest(q) {
  if (q.done || q.have < q.goal) return false;
  q.done = true;
  addXp(QUESTS[q.id].xp);
  saveProfile();
  return true;
}
// New hats when a level or trophy goal is reached
function unlockHats() {
  for (const id in HATS) {
    const h = HATS[id];
    if (P.hats.includes(id)) continue;
    if ((h.lvl && P.level >= h.lvl) || (h.t && P.trophies >= h.t)) {
      P.hats.push(id);
      toast('Neuer Hut: {name}', { name: tr(h.name) });
    }
  }
  saveProfile();
}
// Sale at the base or by lorry
function sold(list, v) {
  G.earned = (G.earned || 0) + v;
  track('sell', v);
  const n = list.filter(t => t === 'nug').length;
  if (n) track('gold', n);
  G.goldSold = (G.goldSold || 0) + n;
  // every kind counted, for level goals ("sell 15 ore")
  G.sold = G.sold || {};
  for (const t of list) G.sold[t] = (G.sold[t] || 0) + 1;
}
// End of a run: trophies for wins, a few for every 50 Taler earned
function finishGame(won, earned, stars = 1) {
  P.games++;
  let t = Math.floor(earned / 50);
  if (won) {
    P.wins++;
    t += 10 + stars * 10;
    addXp(100 + stars * 50);
  } else t -= 3;
  P.trophies = Math.max(0, P.trophies + t);
  unlockHats();
  achCheck(P, addXp); // (games won count for an achievement)
  return t;
}

rollQuests();
for (const id in HATS) {
  const h = HATS[id];
  if (!P.hats.includes(id) && ((h.lvl && P.level >= h.lvl) || (h.t && P.trophies >= h.t))) P.hats.push(id);
}
export {
  CAPS,
  HATS,
  P,
  QUESTS,
  addXp,
  claimQuest,
  cleanName,
  dayNumber,
  finishGame,
  questsFor,
  randomName,
  rollQuests,
  saveProfile,
  sold,
  track,
  unlockHats,
  unlockText,
  xpNeed,
};
