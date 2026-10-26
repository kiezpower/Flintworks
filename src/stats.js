// What every player did in a multiplayer round (dug, sold, fought, stormed, found), counted on
// the host and shown as a ranking with awards on the end screen.
import { tr } from './i18n.js';
import { G, crew } from './state.js';

const esc = s => String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]);

// the record of a player (pid), made on first use
function stat(pid) {
  if (pid == null || !G.mp || !G.net) return null;
  const S = (G.mp.stats ||= {});
  if (!S[pid]) {
    const c = crew.find(o => o.pid === pid);
    S[pid] = { name: c ? c.name : '?', team: (c && c.team) || 0, dig: 0, sold: 0, kills: 0, siege: 0, chests: 0, hill: 0 };
  }
  return S[pid];
}
function addStat(pid, key, n = 1) {
  const s = stat(pid);
  if (s) s[key] += n;
}

// one number for the order: gold sold counts most, the rest about as much as it is worth
const score = s => s.sold + s.siege + s.kills * 40 + s.chests * 60 + Math.round(s.dig / 25) + s.hill;
const AWARDS = [
  ['sold', 'Goldgräber', '💰'],
  ['dig', 'Maulwurf', '⛏️'],
  ['siege', 'Sprengmeister', '💣'],
  ['kills', 'Kämpfer', '⚔️'],
  ['chests', 'Schatzjäger', '🗝️'],
  ['hill', 'Hügelkönig', '🚩'],
];
// the ranking and the awards as HTML for the end screen (empty in a single game)
function statsHtml(S, teamCols) {
  const list = Object.values(S || {});
  if (list.length < 2) return '';
  list.sort((a, b) => score(b) - score(a));
  const rows = list
    .map(
      (s, k) => `<tr><td>${k + 1}.</td><td style="color:${teamCols ? teamCols[s.team] : 'inherit'}">${esc(s.name)}</td>
        <td>${s.sold}</td><td>${Math.round(s.dig / 10)}</td><td>${s.kills}</td><td>${s.siege}</td><td>${s.chests}</td></tr>`,
    )
    .join('');
  const awards = AWARDS.map(([key, title, ico]) => {
    const best = list.reduce((a, b) => (b[key] > a[key] ? b : a));
    return best[key] > 0 ? `<li>${ico} <b>${tr(title)}</b> ${esc(best.name)}</li>` : '';
  }).join('');
  return `<table class="ranking"><tr><th></th><th>${tr('Spieler')}</th><th>💰</th><th>⛏️</th><th>⚔️</th><th>🏰</th><th>🗝️</th></tr>${rows}</table>
    ${awards ? `<ul class="awards">${awards}</ul>` : ''}`;
}

export { addStat, stat, statsHtml };
