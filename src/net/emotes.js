// Quick calls between players: a bubble with a symbol over your Wühler that everybody sees.
import { tr } from '../i18n.js';
import { clonkOf } from '../players.js';
import { G, crew } from '../state.js';
import { closePanel, openPanel, opt, sec } from '../ui.js';
import { onGameMsg, sendTo } from './room.js';
import { transport } from './transport.js';

const EMOTES = [
  ['👋', 'Hallo!'],
  ['⛏️', 'Hier graben!'],
  ['💰', 'Gold gefunden!'],
  ['🆘', 'Hilfe!'],
  ['👍', 'Gut gemacht!'],
  ['🏰', 'Zur Basis!'],
  ['⚔️', 'Angriff!'],
  ['🛡️', 'Verteidigen!'],
  ['🚩', 'Zum Hügel!'],
  ['💣', 'Gleich knallt es!'],
  ['😈', 'Na warte!'],
  ['😂', 'Haha!'],
];
function show(pid, k) {
  const c = clonkOf(pid);
  if (c && EMOTES[k]) c.emo = { e: EMOTES[k][0], l: 150 };
}
onGameMsg('emo', (d, from) => show(from, d.e));

function openEmotes() {
  const p = openPanel('Zuruf');
  const l = sec(p, 'Alle sehen es über deinem Wühler');
  EMOTES.forEach(([e, t], k) =>
    opt(l, {
      title: `${e} ${tr(t)}`,
      short: true,
      onClick: () => {
        show(G.myId, k);
        sendTo('all', { k: 'emo', e: k });
        closePanel();
      },
    }),
  );
}
const btn = document.getElementById('emoBtn');
btn.addEventListener('click', () => openEmotes());
// the button shows only in a shared game
// the button and the connection line show only in a shared game
const netTxt = document.getElementById('netTxt');
function updEmoBtn() {
  if (btn.hidden === !!G.net) btn.hidden = !G.net;
  netTxt.hidden = !G.net;
  if (!G.net) return;
  const ms = transport.rtt;
  const q = transport.status !== 'open' ? tr('getrennt …') : ms < 120 ? '▮▮▮' : ms < 250 ? '▮▮▯' : '▮▯▯';
  const t = `${G.netHost ? tr('Host') : tr('Verbindung')} ${q}${transport.status === 'open' ? ' ' + ms + ' ms' : ''}`;
  if (netTxt.textContent !== t) netTxt.textContent = t;
}
// bubbles over the heads (in the render pass)
function drawEmotes(ctx, cx, cy) {
  for (const c of crew) {
    const m = c.emo;
    if (!m) continue;
    if (--m.l <= 0) {
      c.emo = null;
      continue;
    }
    const x = Math.round(c.x - cx) + 3,
      y = Math.round(c.y - cy) - 21 - (m.l > 140 ? (m.l - 140) * 0.5 : 0);
    ctx.globalAlpha = Math.min(1, m.l / 25);
    ctx.fillStyle = '#24160c';
    ctx.fillRect(x - 6, y - 7, 12, 11);
    ctx.fillStyle = '#fbf3dc';
    ctx.fillRect(x - 5.5, y - 6.5, 11, 10);
    ctx.fillRect(x - 1, y + 3.5, 2, 1.5);
    ctx.font = '8px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(m.e, x, y - 1.5);
    ctx.globalAlpha = 1;
  }
}

export { drawEmotes, updEmoBtn };
