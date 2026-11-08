// The score while a shared round runs (like the score table in Clonk): the button 🏆 or the key P.
// Versus: the clock, how far every team is and its castle's hit points; Koop: the shared goal.
// Below that every player's numbers (the same ranking as on the end screen, stats.js).
import { tr } from './i18n.js';
import { mode } from './modes.js';
import { G } from './state.js';
import { statsHtml } from './stats.js';
import { TEAM_COLS, useMine, useTeam } from './teams.js';
import { openPanel, sec } from './ui.js';
import { TEAM, castleOf, clockText } from './versus.js';

const esc = s => String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]);
const pct = v => Math.max(0, Math.min(100, Math.round(v * 100)));
// how far every team is (0..1): from the host's numbers on a guest, worked out on the host
function teamRatios() {
  const goal = mode().goal || 1;
  if (G.vs) return G.vs.map(v => v / goal);
  if (!G.teams) return null;
  const r = G.teams.map((t, k) => (useTeam(k), mode().prog() / goal));
  useMine();
  return r;
}
function openScore() {
  if (!G.net || G.state !== 'play') return;
  const p = openPanel('Punktestand');
  const box = document.createElement('div');
  box.className = 'score';
  let html = '';
  const clock = clockText();
  if (G.teams) {
    const r = teamRatios() || [];
    html += `<table class="ranking teams"><tr><th></th><th>${tr('Team')}</th><th>${tr('Ziel')}</th><th>🏰</th></tr>`;
    G.teams.forEach((t, k) => {
      const b = castleOf(k),
        hp = b && b.hp != null ? Math.max(0, Math.round(b.hp)) : '–',
        out = b && b.hp <= 0;
      html += `<tr${out ? ' class="out"' : ''}><td style="color:${TEAM_COLS[k]}">■</td><td>${esc(tr(TEAM[k]))}</td><td>${pct(r[k] || 0)} %</td><td>${hp}</td></tr>`;
    });
    html += '</table>';
  } else {
    const M = mode(),
      st = M.status ? M.status() : null;
    html += `<p class="sgoal">${esc(st ? st.text : `${tr(M.name)}: ${Math.min(M.goal, M.prog())} / ${M.goal}`)}</p>`;
  }
  if (clock) html = `<p class="sclock">${clock}</p>` + html;
  box.innerHTML = html;
  p.appendChild(box);
  const players = statsHtml(G.mp && G.mp.stats, G.teams ? TEAM_COLS : null);
  const l = sec(p, 'Spieler');
  const pl = document.createElement('div');
  pl.className = 'score';
  pl.innerHTML = players || `<p class="sgoal">${tr('Noch keine Punkte – grabt los!')}</p>`;
  l.appendChild(pl);
}
G.openScore = openScore;
const btn = document.getElementById('scoreBtn');
btn.addEventListener('click', () => openScore());
// the button only in a shared round
function updScoreBtn() {
  if (btn.hidden === !!G.net) btn.hidden = !G.net;
}

export { openScore, updScoreBtn };
