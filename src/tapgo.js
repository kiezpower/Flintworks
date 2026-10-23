// Tap into the world to send your Wühler there. With automatic digging it digs its way down.
// Touching the stick or the arrow keys cancels the trip.
import { inp, joy, keys } from './input.js';
import { cam, cv } from './render.js';
import { G } from './state.js';

let goal = null;
function setGoal(clx, cly) {
  const r = cv.getBoundingClientRect(),
    k = r.width / G.VW;
  goal = { x: (clx - r.left) / k + Math.round(cam.x), y: (cly - r.top) / k + Math.round(cam.y), t: G.frame };
}
function tapGotoInput(c) {
  if (!goal || !c || c.dead) return;
  if (Math.abs(joy.x) > 0.2 || Math.abs(joy.y) > 0.2 || keys.l || keys.r || keys.u || keys.d) {
    goal = null;
    return;
  }
  const dx = goal.x - (c.x + 3),
    dy = goal.y - (c.y + 5);
  if ((Math.abs(dx) < 3 && Math.abs(dy) < 10) || G.frame - goal.t > 1200) {
    goal = null;
    return;
  }
  inp.ax = Math.abs(dx) > 2 ? Math.sign(dx) : 0;
  if (dy > 10 && Math.abs(dx) < 8 && G.autoDig) {
    inp.ay = 1;
    inp.ax = 0;
  } else if (dy < -12 && G.frame % 30 === 0) inp.jumpP = true;
}
// small flag where the Wühler is heading
function drawGoal(ctx, cx, cy) {
  if (!goal) return;
  const x = Math.round(goal.x - cx),
    y = Math.round(goal.y - cy);
  if ((G.frame >> 3) % 4 === 0) return;
  ctx.fillStyle = '#24160c';
  ctx.fillRect(x - 0.5, y - 6, 2, 7);
  ctx.fillStyle = '#ffe066';
  ctx.fillRect(x, y - 6, 1, 6);
  ctx.fillRect(x + 1, y - 6, 3, 2);
}

export { drawGoal, setGoal, tapGotoInput };
