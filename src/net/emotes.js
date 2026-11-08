// Quick calls between players: a bubble with a symbol over your Wühler that everybody sees, and
// a short line at the top for the others ("Anna: Hilfe!"). "Hierher!" also sets a marker on the
// spot, in the world and on the map. Your fellow players off the screen get an arrow at its edge
// (in their cap's colour, with how far they are and their latest call), like the map in Terraria.
import { tr } from '../i18n.js';
import { diggerOf, isPlayer } from '../players.js';
import { G, crew } from '../state.js';
import { teamOf } from '../teams.js';
import { closePanel, openPanel, opt, sec, toast } from '../ui.js';
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
  ['📍', 'Hierher!'],
];
const HERE = EMOTES.length - 1;
// markers set with "Hierher!": where, whose colour, how long they stay (about 15 s)
const pins = [];
G.pins = pins;
function show(pid, k) {
  const c = diggerOf(pid);
  if (!c || !EMOTES[k]) return;
  c.emo = { e: EMOTES[k][0], l: 150 };
  if (k === HERE) {
    for (let q = pins.length - 1; q >= 0; q--) if (pins[q].pid === pid) pins.splice(q, 1);
    pins.push({ pid, x: c.x + 3, y: c.y + 10, col: c.cap, l: 900 });
  }
  if (pid !== G.myId) toast(`${c.name}: ${EMOTES[k][0]} ${tr(EMOTES[k][1])}`);
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
// an arrow at the edge of the screen towards something off it: a small triangle in its colour,
// a symbol or letter beside it and the distance in metres
function edgeArrow(ctx, wx, wy, cx, cy, col, label, near) {
  const sx = wx - cx,
    sy = wy - cy,
    m = 7;
  if (sx > -2 && sx < G.VW + 2 && sy > -2 && sy < G.VH + 2) return false;
  const mx = G.VW / 2,
    my = G.VH / 2,
    dx = sx - mx,
    dy = sy - my,
    k = Math.min((mx - m) / Math.abs(dx || 1e-6), (my - m) / Math.abs(dy || 1e-6)),
    ax = Math.round(mx + dx * k),
    ay = Math.round(my + dy * k),
    a = Math.atan2(dy, dx);
  ctx.save();
  ctx.translate(ax, ay);
  ctx.rotate(a);
  ctx.fillStyle = '#24160c';
  ctx.beginPath();
  ctx.moveTo(6, 0);
  ctx.lineTo(-4, -5);
  ctx.lineTo(-4, 5);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.moveTo(4.5, 0);
  ctx.lineTo(-3, -3.6);
  ctx.lineTo(-3, 3.6);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  // the label inside the screen, next to the arrow
  const lx = Math.round(ax - Math.cos(a) * 12),
    ly = Math.round(ay - Math.sin(a) * 9);
  ctx.font = '7px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(36,22,12,0.75)';
  const w = Math.max(14, ctx.measureText(label).width + 4);
  ctx.fillRect(lx - w / 2, ly - 4.5, w, 9);
  ctx.fillStyle = '#fbf3dc';
  ctx.fillText(label, lx, ly);
  if (near) {
    ctx.font = '6px sans-serif';
    ctx.fillStyle = 'rgba(251,243,220,0.85)';
    ctx.fillText(near, lx, ly + 8);
  }
  return true;
}
// fellow players (your team) and markers off the screen: arrows at the edge; markers on it: a pin
function drawMates(ctx, cx, cy) {
  // (also two at one device, local.js: then both get an arrow when off the screen)
  if (!G.net && !G.local) return;
  const me = diggerOf(G.myId);
  for (const c of crew) {
    if (!isPlayer(c) || c.dead || (c === me && !G.local) || (G.teams && me && teamOf(c) !== teamOf(me))) continue;
    const d = me ? Math.round(Math.hypot(c.x - me.x, c.y - me.y) / 4) : 0;
    edgeArrow(ctx, c.x + 3, c.y + 5, cx, cy, c.cap, c.emo ? c.emo.e : (c.name || '?').slice(0, 1), d + ' m');
  }
  for (let q = pins.length - 1; q >= 0; q--) {
    const p = pins[q];
    if (--p.l <= 0) {
      pins.splice(q, 1);
      continue;
    }
    if (edgeArrow(ctx, p.x, p.y, cx, cy, p.col, '📍', '')) continue;
    // on the screen: a pin that bobs, and a ring on the ground that widens and fades
    const x = Math.round(p.x - cx),
      y = Math.round(p.y - cy),
      r = 3 + ((900 - p.l) % 40) / 4;
    ctx.globalAlpha = Math.min(1, p.l / 60);
    ctx.strokeStyle = p.col;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(x, y, r * 1.6, r * 0.5, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText('📍', x, y - 2 - Math.abs(Math.sin(p.l * 0.08)) * 3);
    ctx.globalAlpha = 1;
  }
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

export { drawEmotes, drawMates, pins, updEmoBtn };
