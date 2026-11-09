// Seasons for Versus (and "Jeder gegen jeden"): every calendar month is a season. A round brings
// season points – a win 25, a draw 10, a lost round 5 for taking part – and the points make a rank:
// Bronze, Silber (100), Gold (250), Diamant (500). When a new month begins, the rank reached in the
// last one pays crystals for the Heimatbergwerk (camp.js) and the points start again from nought.
// Kept on this device in the profile (P.season); the relay keeps nothing, so there is no list of
// all players – only the own rank, like a personal ladder.
import { addCrystals } from './camp.js';
import { tr } from './i18n.js';
import { P, saveProfile } from './profile.js';

const RANKS = [
  { name: 'Bronze', at: 0, kri: 0 },
  { name: 'Silber', at: 100, kri: 30 },
  { name: 'Gold', at: 250, kri: 80 },
  { name: 'Diamant', at: 500, kri: 150 },
];
const POINTS = { win: 25, draw: 10, loss: 5 };
// this month as a season id, e.g. "2026-11" (a date can be given, for the tests)
const seasonId = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
const rankOf = pts => {
  let r = 0;
  for (let k = 0; k < RANKS.length; k++) if (pts >= RANKS[k].at) r = k;
  return r;
};

// a new month: the last season's rank pays, the points start again; returns what it paid
function seasonRoll(now = new Date()) {
  const id = seasonId(now),
    S = P.season;
  if (!S || typeof S !== 'object') {
    P.season = { id, pts: 0 };
    saveProfile();
    return null;
  }
  if (S.id === id) return null;
  const r = rankOf(S.pts || 0),
    kri = RANKS[r].kri;
  if (kri) addCrystals(kri);
  P.season = { id, pts: 0, last: { id: S.id, rank: r, kri } };
  saveProfile();
  return kri ? { rank: RANKS[r].name, kri } : null;
}
// the end of a Versus round: 'win' | 'draw' | 'loss'; returns the line for the end card
function seasonResult(result, now = new Date()) {
  seasonRoll(now);
  const S = P.season,
    before = rankOf(S.pts);
  S.pts += POINTS[result] || 0;
  saveProfile();
  const r = rankOf(S.pts),
    next = RANKS[r + 1];
  return {
    pts: S.pts,
    gain: POINTS[result] || 0,
    rank: RANKS[r].name,
    up: r > before,
    toNext: next ? next.at - S.pts : 0,
    nextName: next ? next.name : null,
  };
}
// the line on the end card: "Saison: +25 · 135 Punkte · Silber (Gold in 115)"
function seasonLine(s) {
  const head = tr('Saison: +{gain} · {pts} Punkte · {rank}', { gain: s.gain, pts: s.pts, rank: tr(s.rank) });
  const next = s.nextName ? ' ' + tr('({name} in {n})', { name: tr(s.nextName), n: s.toNext }) : '';
  const up = s.up ? ' ' + tr('– aufgestiegen!') : '';
  return head + next + up;
}

export { RANKS, rankOf, seasonId, seasonLine, seasonResult, seasonRoll };
