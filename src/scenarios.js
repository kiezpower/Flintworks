// Campaign: fixed worlds with their own goal and start, played one after the other. Every level
// is a game mode (campaign: true) in GAME_MODES, so goal, stars and the end screen just work.
// Stars per level are kept in the profile (P.campaign); a level opens with one star on the last.
import { announce } from './announce.js';
import { addClonk, mkAnimal, sel_ } from './entities.js';
import { tr } from './i18n.js';
import { CHAPTER2 } from './levels/index.js';
import { rescueTick } from './levels/goals.js';
import { GAME_MODES } from './modes.js';
import { P, saveProfile } from './profile.js';
import { G, animals, crew, vehicles } from './state.js';
import { AIR, H, W, bg, mat, paint, surf } from './world.js';

const baseX = () => (G.base ? G.base.x + G.base.w / 2 : 90);
const depthOf = c => (c ? Math.round((c.y + 10 - surf[Math.max(0, Math.min(W - 1, Math.floor(c.x + 3)))]) / 4) : 0);
// a hollow in the ground (cave background), w × h pixels around x, y
function pocket(x, y, w, h) {
  for (let yy = y - h / 2; yy < y + h / 2; yy++)
    for (let xx = x - w / 2; xx < x + w / 2; xx++) {
      const dx = (xx - x) / (w / 2),
        dy = (yy - y) / (h / 2);
      if (dx * dx + dy * dy > 1 || xx < 1 || yy < 1 || xx >= W - 1 || yy >= H - 4) continue;
      const i = Math.floor(yy) * W + Math.floor(xx);
      mat[i] = AIR;
      bg[i] = 1;
      paint(i);
    }
}

const LEVELS = {
  c1: {
    name: 'Erste Schritte',
    icon: 'castle',
    desc: 'Verdiene {goal} Taler',
    biome: 'meadow',
    seed: 1101,
    diff: 'relaxed',
    goal: 300,
    stars: [5, 8],
    evRate: 0,
    prog: () => G.money,
  },
  c2: {
    name: 'Goldader',
    icon: 'trophy',
    desc: 'Verkaufe {goal} Goldklumpen',
    biome: 'desert',
    seed: 2202,
    goal: 12,
    stars: [7, 11],
    prog: () => G.goldSold || 0,
  },
  c3: {
    name: 'Verschüttet',
    icon: 'crew',
    desc: 'Rette {goal} verschüttete Wühler',
    biome: 'winter',
    seed: 3303,
    goal: 2,
    stars: [7, 12],
    research: ['mech', 'metal'],
    store: { coal: 6, metal: 2, plank: 3 },
    evKinds: ['quake'],
    prog: () => G.rescued || 0,
    setup() {
      for (const [dx, dd] of [
        [230, 70],
        [430, 105],
      ]) {
        const x = Math.round(baseX() + dx),
          y = surf[x] + dd;
        pocket(x, y, 16, 14);
        const c = addClonk(x - 3, y - 3);
        c.trapped = true;
        c.focus = 'stay';
      }
    },
    tick: rescueTick,
    intro:
      'Zwei Wühler sind rechts von der Burg tief verschüttet – grab dich zu ihnen durch. Der Bohrwagen ist schon erforscht.',
  },
  c4: {
    name: 'Monsterjagd',
    icon: 'sword',
    desc: 'Besiege {goal} Monster',
    biome: 'meadow',
    seed: 4404,
    goal: 5,
    stars: [8, 13],
    research: ['metal', 'archery'],
    money: 160,
    store: { metal: 4, wood: 8, rock: 6, plank: 2 },
    prog: () => G.kills || 0,
    setup() {
      for (let k = 0; k < 6; k++) {
        const x = Math.round(baseX() + 170 + k * 150),
          y = surf[Math.min(W - 1, x)] + 42 + (k % 3) * 16;
        if (x > W - 30) break;
        pocket(x, y, 34, 16);
        animals.push(mkAnimal('monster', x - 6, y - 2));
      }
    },
    intro: 'Unter der Wiese hausen Monster. Schwert und Langbogen kannst du an der Burg kaufen.',
  },
  c5: {
    name: 'Feuerberg',
    icon: 'farrow',
    desc: 'Verdiene {goal} Taler',
    biome: 'desert',
    seed: 5505,
    goal: 600,
    stars: [10, 15],
    evRate: 3,
    evKinds: ['volcano'],
    prog: () => G.money,
    setup() {
      G.evNext = 2400;
    },
    intro: 'Hier brechen oft Vulkane aus. Sie sind gefährlich – und spucken Gold und Edelsteine.',
  },
  c6: {
    name: 'Tiefbohrung',
    icon: 'dig',
    desc: 'Erreiche {goal} m Tiefe',
    biome: 'winter',
    seed: 6606,
    goal: 50,
    stars: [5, 9],
    research: ['metal', 'mech'],
    store: { coal: 10, metal: 2, plank: 3 },
    evRate: 2,
    evKinds: ['quake'],
    prog: () => Math.max(0, depthOf(sel_())),
    intro: 'Bau dir einen Bohrwagen (schon erforscht) und bohr so tief du kannst. Vorsicht, Erdbeben!',
  },
  c7: {
    name: 'Luftbrücke',
    icon: 'balloon',
    desc: 'Baue ein Luftschiff',
    biome: 'meadow',
    seed: 7707,
    goal: 1,
    stars: [9, 14],
    research: ['mech', 'metal'],
    money: 120,
    store: { metal: 2, plank: 4, wood: 4, coal: 4 },
    prog: () => (vehicles.some(v => v.kind === 'airship') ? 1 : 0),
    setup() {
      G.base.lvl = 2;
    },
    intro: 'Erforsche die Luftfahrt und baue ein Luftschiff. Die Burg ist schon ausgebaut.',
  },
};
const LEVEL_IDS = Object.keys(LEVELS);
LEVEL_IDS.forEach((id, n) => {
  GAME_MODES[id] = { ...LEVELS[id], campaign: true, n: n + 1 };
});

// every half second on the host / in a single game
function updScenario() {
  const M = GAME_MODES[G.mode];
  if (!M || !(M.campaign || M.pkg)) return;
  if (M.intro && !G.introDone && G.frame > 90) {
    G.introDone = true;
    announce(M.intro);
  }
  M.tick?.();
}

// ---- progress in the profile ----
// chapter 1: the levels above (generated worlds), chapter 2: the hand-built levels (levels/)
const CHAPTERS = [
  { name: 'Kapitel 1 · Erste Welten', ids: LEVEL_IDS },
  { name: 'Kapitel 2 · Klassiker', ids: CHAPTER2 },
];
const ALL_IDS = CHAPTERS.flatMap(c => c.ids);
P.campaign = P.campaign || {};
const starsOf = id => P.campaign[id] || 0;
// the first level of each chapter is open, the next one after a star on the one before
const unlocked = id => {
  const ids = CHAPTERS.find(c => c.ids.includes(id)).ids,
    n = ids.indexOf(id);
  return n <= 0 || starsOf(ids[n - 1]) > 0;
};
const totalStars = () => ALL_IDS.reduce((s, id) => s + starsOf(id), 0);
// stars and the best time (seconds) of a level that was won
P.campaignTime = P.campaignTime || {};
const bestTime = id => P.campaignTime[id] || 0;
function recordCampaign(stars, sec) {
  if (!ALL_IDS.includes(G.mode)) return;
  P.campaign[G.mode] = Math.max(starsOf(G.mode), stars);
  if (sec && (!bestTime(G.mode) || sec < bestTime(G.mode))) P.campaignTime[G.mode] = sec;
  saveProfile();
}
// the level after this one in its chapter, if there is one and it is open
function nextLevel(id) {
  const ch = CHAPTERS.find(c => c.ids.includes(id)),
    n = ch ? ch.ids.indexOf(id) : -1;
  const nx = n >= 0 && ch.ids[n + 1];
  return nx && unlocked(nx) ? nx : null;
}
// what keeps a level locked: the level before it in the chapter
const lockedBy = id => {
  const ids = CHAPTERS.find(c => c.ids.includes(id)).ids;
  return unlocked(id) ? null : ids[ids.indexOf(id) - 1];
};

export { ALL_IDS, CHAPTERS, LEVEL_IDS as CHAPTER1, LEVELS, bestTime, lockedBy, nextLevel, recordCampaign, starsOf, totalStars, unlocked, updScenario };
