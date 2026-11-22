// "Zuletzt gespielt mit": the last players of shared rounds, kept on this device (P.recent), so
// a good teammate can be added as a friend later. And the connection badge (ping bars) the
// room panel shows.
import { tr } from '../i18n.js';
import { P, saveProfile } from '../profile.js';
import { NET } from './room.js';

const MAX_RECENT = 10;
if (!Array.isArray(P.recent)) P.recent = [];

// everybody of a round who is not me and has a friend code: newest first, each once
let round = []; // the players of the last round (not me), for the end card
const lastRound = () => round;
function remember(players) {
  const now = Date.now();
  round = (players || []).filter(pl => pl && pl.fid && pl.fid !== P.fid && pl.pid !== NET.pid).map(pl => ({ fid: String(pl.fid), name: String(pl.name || '').slice(0, 16) }));
  for (const pl of players || []) {
    if (!pl || !pl.fid || pl.fid === P.fid || pl.pid === NET.pid) continue;
    P.recent = P.recent.filter(r => r.fid !== pl.fid);
    P.recent.unshift({ fid: String(pl.fid), name: String(pl.name || '').slice(0, 16), at: now });
  }
  P.recent = P.recent.slice(0, MAX_RECENT);
  saveProfile();
}
// (called with the start message of every shared round, main.js playNet)
const recentPlayers = () => P.recent.slice();

// "vor 5 Min." / "gestern"
function ago(t) {
  const m = Math.round((Date.now() - t) / 60000);
  if (m < 1) return tr('gerade eben');
  if (m < 60) return tr('vor {n} Min.', { n: m });
  const h = Math.round(m / 60);
  if (h < 24) return tr('vor {n} Std.', { n: h });
  const d = Math.round(h / 24);
  return d === 1 ? tr('gestern') : tr('vor {n} Tagen', { n: d });
}

// three bars and the round trip in ms; red while the line is down
function pingHtml(T) {
  if (T.status !== 'open') return `<span class="pt-ping bad" title="${tr('Keine Verbindung')}"><i></i><i></i><i></i>–</span>`;
  const ms = T.rtt || 0,
    q = ms < 120 ? 'good' : ms < 250 ? 'mid' : 'bad';
  return `<span class="pt-ping ${q}" title="${tr('Ping')}"><i></i><i></i><i></i>${ms} ms</span>`;
}

export { ago, lastRound, pingHtml, recentPlayers, remember };
