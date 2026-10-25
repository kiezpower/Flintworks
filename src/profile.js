// Player profile across games: level, trophies, hats and daily quests (stored locally).
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
};
// hats unlock by level or trophies
const unlockText = h => (h.lvl ? `${h.tut ? 'Tutorial · ' : ''}Level ${h.lvl}` : h.t ? `${h.t} 🏆` : '');
const XP = { sell: 0.2, build: 25, chop: 8, monster: 40, gem: 20, gold: 0, tutorial: 60, chest: 30 };

const today = () => new Date().toISOString().slice(0, 10);
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
};
try {
  Object.assign(P, JSON.parse(localStorage.getItem(KEY) || '{}'));
} catch {}
delete P.crystals;
delete P.chestDay;
delete P.road;
function saveProfile() {
  try {
    localStorage.setItem(KEY, JSON.stringify(P));
  } catch {}
}
const xpNeed = () => 80 + P.level * 40;
function rollQuests() {
  if (P.questDay === today()) return;
  P.questDay = today();
  const ids = Object.keys(QUESTS).sort(() => Math.random() - 0.5);
  P.quests = ids.slice(0, 3).map(id => {
    const q = QUESTS[id];
    return { id, goal: q.n[Math.floor(Math.random() * q.n.length)], have: 0, done: false };
  });
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
function track(id, amount = 1) {
  rollQuests();
  addXp(Math.round((XP[id] ?? 0) * amount));
  for (const q of P.quests)
    if (q.id === id && q.have < q.goal) {
      q.have = Math.min(q.goal, q.have + amount);
      if (q.have >= q.goal) toast('Aufgabe erfüllt! Hol dir die Belohnung in der Lobby');
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
  finishGame,
  rollQuests,
  saveProfile,
  sold,
  track,
  unlockHats,
  unlockText,
  xpNeed,
};
