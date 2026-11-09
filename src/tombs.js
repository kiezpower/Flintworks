// Where a Wühler gave out (like the gravestones of Terraria and the dropped bag of SteamWorld Dig):
// what he carried falls out on the spot; a small gravestone stands there with his name, the map
// shows it, and its player gets a grey arrow at the screen edge pointing back. When nothing of it
// is left lying there (picked up again, by anybody), or after five minutes, the stone is gone.
// Only for players' Wühler; the host keeps them, everybody gets them with the game.
import { G, crew, items } from './state.js';

const LIFE = 5 * 3600;

// killDigger (digger.js) calls this before the bag falls out
function addTomb(c) {
  if (c.pid == null || c.bot || !c.inv.length) return 0;
  G.tombs = (G.tombs || []).filter(t => t.pid !== c.pid);
  const id = (G.tombN = (G.tombN || 0) + 1);
  G.tombs.push({ id, x: Math.round(c.x + 3), y: Math.round(c.y + 10), pid: c.pid, name: c.name, t: G.frame });
  return id;
}
// every half second (host): gone when none of the bag's things lie about any more, or after a while
function tombTick() {
  if (G.netClient || !G.tombs || !G.tombs.length) return;
  G.tombs = G.tombs.filter(
    t => G.frame - t.t < LIFE && items.some(it => it.tomb === t.id),
  );
}

function drawTombs(ctx, cx, cy) {
  for (const t of G.tombs || []) {
    const x = Math.round(t.x - cx),
      y = Math.round(t.y - cy);
    if (x < -10 || x > G.VW + 10 || y < -16 || y > G.VH + 4) continue;
    ctx.fillStyle = '#24160c';
    ctx.fillRect(x - 3, y - 9, 7, 9);
    ctx.fillRect(x - 2, y - 10, 5, 1);
    ctx.fillStyle = '#9a948c';
    ctx.fillRect(x - 2, y - 8, 5, 8);
    ctx.fillRect(x - 1, y - 9, 3, 1);
    ctx.fillStyle = '#6e6a64';
    ctx.fillRect(x, y - 7, 1, 4);
    ctx.fillRect(x - 1, y - 6, 3, 1);
  }
}
// the own stone, out of sight: a grey arrow at the screen edge
function drawTombArrow(ctx, cx, cy) {
  const me = crew.find(c => c.pid === G.myId);
  const t = me && !me.dead && (G.tombs || []).find(t => t.pid === G.myId);
  if (!t) return;
  const sx = t.x - cx,
    sy = t.y - 6 - cy,
    m = 10;
  if (sx > m && sx < G.VW - m && sy > m && sy < G.VH - m) return;
  const x = Math.min(G.VW - m, Math.max(m, sx)),
    y = Math.min(G.VH - m, Math.max(m, sy));
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  ctx.rotate(Math.atan2(sy - y, sx - x));
  ctx.fillStyle = '#1a120c';
  ctx.beginPath();
  ctx.moveTo(6, 0);
  ctx.lineTo(-4, -5);
  ctx.lineTo(-4, 5);
  ctx.fill();
  ctx.fillStyle = '#c8c2b8';
  ctx.beginPath();
  ctx.moveTo(4, 0);
  ctx.lineTo(-3, -3.5);
  ctx.lineTo(-3, 3.5);
  ctx.fill();
  ctx.restore();
}
// on the map: a small grey stone
function markTombs(mctx, MK) {
  for (const t of G.tombs || []) {
    const px = Math.floor(t.x / MK),
      py = Math.floor(t.y / MK);
    mctx.fillStyle = '#24160c';
    mctx.fillRect(px - 2, py - 4, 5, 5);
    mctx.fillStyle = '#c8c2b8';
    mctx.fillRect(px - 1, py - 3, 3, 3);
  }
}

export { addTomb, drawTombArrow, drawTombs, markTombs, tombTick };
