// The Wühler you are not controlling work on their own: they pick up loose items nearby,
// carry them home to the base (where they are sold or stored) and then wait there.
import { NOIN } from './clonk.js';
import { midMat } from './entities.js';
import { G, INV_MAX, crew, items } from './state.js';
import { LIQ, free } from './world.js';

const TOOLS = ['flint', 'tnt', 'loam'];
const cargo = c => c.inv.filter(t => !TOOLS.includes(t)).length;

function pickTarget(c) {
  let best = null,
    bd = 150;
  for (const it of items) {
    if (it.pd > 0 || it.fuse >= 0 || TOOLS.includes(it.t)) continue;
    const dx = Math.abs(it.x - c.x),
      dy = it.y - c.y;
    if (dx > bd || dy < -14 || dy > 24) continue;
    if (crew.some(o => o !== c && o.target === it)) continue;
    bd = dx;
    best = it;
  }
  return best;
}

function helperAI(c, n) {
  if (c.chop || c.digging) return NOIN;
  // drop a target that vanished or could not be reached in time
  if (c.target && (!items.includes(c.target) || G.frame - c.targetT > 600)) c.target = null;
  const full = c.inv.length >= INV_MAX || cargo(c) >= 4;
  if (!full && !c.target && G.frame % 20 === n) {
    c.target = pickTarget(c);
    c.targetT = G.frame;
  }
  let tx;
  if (!full && c.target) tx = c.target.x + 1;
  else if (cargo(c) > 0) tx = G.base.x + G.base.w / 2;
  else tx = G.base.x + 8 + ((n * 9) % (G.base.w - 10));
  const dx = tx - (c.x + 3);
  if (Math.abs(dx) < 3) return NOIN;
  const I = { ...NOIN };
  I.ax = Math.sign(dx) * (Math.abs(dx) > 10 ? 1 : 0.6);
  // hop over small steps
  if (!c.climb && !free(c.x + Math.sign(dx) * 2, c.y - 2, 6, 10) && G.frame % 30 === (n * 7) % 30) I.jumpP = true;
  if (c.climb) I.ay = -1;
  if (LIQ[midMat(c, 0.1)]) I.ay = -1;
  return I;
}

export { helperAI };
