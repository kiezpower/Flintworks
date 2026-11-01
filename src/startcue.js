// The first seconds of a real round: what the round is about (a banner with the goal) and where to
// begin (the yellow arrow of the tutorial points at the nearest gold close to the surface, and the
// signpost in the castle yard turns that way). The arrow goes once you dig or after 12 seconds.
// Only pictures; nothing here changes the game (docs/ART_RUBRIC.md, "Oberfläche zu Beginn").
import { ev } from './analytics.js';
import { sel_ } from './entities.js';
import { tr } from './i18n.js';
import { mode } from './modes.js';
import { banner } from './reward.js';
import { G } from './state.js';
import { drawArrow } from './arrow.js';
import { GOLD, H, W, mat, surf } from './world.js';

const SHOW = 12 * 60; // ticks the arrow stays at most
let cue = null; // { until, gold: { x, y } | null }

// the nearest gold within reach of the castle, at most 60 rows below the surface
function nearestGold(c) {
  let best = null,
    bd = Infinity;
  const x0 = Math.max(0, Math.floor(c.x) - 220),
    x1 = Math.min(W, Math.floor(c.x) + 220);
  for (let x = x0; x < x1; x += 2)
    for (let y = surf[x] + 2; y < Math.min(H - 1, surf[x] + 60); y += 2) {
      if (mat[y * W + x] !== GOLD) continue;
      const d = Math.abs(x - c.x) + (y - surf[x]) * 2;
      if (d < bd) {
        bd = d;
        best = { x, y };
      }
    }
  return best;
}
// a new real round begins (main.js startGame); not in the tutorial, not as a guest in a room
function startCue() {
  cue = null;
  G.signDir = 1;
  if (G.tut || G.netClient) return;
  const M = mode(),
    c = sel_();
  banner(tr(M.name), tr(M.desc, { goal: M.goal }));
  const gold = c ? nearestGold(c) : null;
  if (gold) G.signDir = gold.x < G.base.x + G.base.w / 2 ? -1 : 1;
  cue = { until: G.frame + SHOW, gold };
  ev('round_cue', { gold: !!gold });
}
// every tick of play: gone once you dig, after its time, or when the gold is gone (looked again)
function updCue() {
  if (!cue) return;
  const c = sel_();
  if (!c || G.frame > cue.until || c.digging) return (cue = null);
  if (G.frame % 60 === 0 && cue.gold && mat[cue.gold.y * W + cue.gold.x] !== GOLD) cue.gold = nearestGold(c);
}
function drawCue(ctx, cx, cy) {
  if (cue && cue.gold && G.state === 'play') drawArrow(ctx, cue.gold.x - cx, cue.gold.y - cy);
}
const cueOn = () => !!cue;

export { cueOn, drawCue, startCue, updCue };
