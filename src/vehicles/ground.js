// Ground and water vehicles: drill wagon, raft, catapult and the riding wipf.
import { digCell, spawnFromDig } from '../clonk.js';
import { moveBody, spawnItem, unstuck } from '../entities.js';
import { onDig } from '../hazards.js';
import { sfx } from '../sound.js';
import { G, parts } from '../state.js';
import { stock, takeStock } from '../store.js';
import { toast } from '../ui.js';
import { GRANITE, H, LIQ, ROCK, W, bg, free, mat, paint, rnd } from '../world.js';
import { box, defineVehicle, vehicleOf, wheel } from './core.js';
import { register } from '../commands.js';

const liquidAt = (x, y) => x >= 0 && y >= 0 && x < W && y < H && LIQ[mat[Math.floor(y) * W + Math.floor(x)]];
const grounded = v => !free(v.x, v.y + 1, v.w, v.h);
// coal from the store keeps engines running
function refuel(v) {
  if (v.fuel < 40 && stock('coal') > 0) {
    takeStock('coal', 1);
    v.fuel += 60;
  }
}
function fall(v, I) {
  v.vy = Math.min(v.vy + 0.17, 4);
  if (liquidAt(v.x + v.w / 2, v.y + v.h - 1)) v.vy *= 0.85;
  const [bx, by] = moveBody(v, v.vx, v.vy, grounded(v) ? 3 : 0);
  if (bx) v.vx = 0;
  if (by) v.vy = 0;
  if (!I) v.vx *= grounded(v) ? 0.8 : 0.98;
}

// ---- drill wagon: drives through earth and rock, burns coal ----
defineVehicle('drill', {
  name: 'Bohrwagen',
  info: 'Bohrt schnell durch Erde und Fels – Stick schräg für schräge Tunnel, braucht Kohle',
  cost: { metal: 2, plank: 3 },
  res: ['metal', 'mech'],
  w: 16,
  h: 9,
  seat: [-2, -8],
  upd(v, I) {
    unstuck(v);
    if (I && Math.abs(I.ax) > 0.3) {
      v.face = Math.sign(I.ax);
      v.vx += (v.face * 0.7 - v.vx) * 0.3;
    } else if (grounded(v)) v.vx *= 0.7;
    const dir = v.face,
      slope = I ? (I.ay > 0.5 ? 0.5 : I.ay < -0.5 ? -0.38 : 0) : 0;
    const blocked = I && Math.abs(I.ax) > 0.3 && (!free(v.x + dir, v.y, v.w, v.h) || slope > 0);
    v.drilling = false;
    if (blocked) {
      refuel(v);
      if (v.fuel <= 0) {
        if (G.frame % 120 === 0) toast('Der Bohrwagen braucht Kohle im Lager');
      } else {
        v.drilling = true;
        v.fuel -= 0.04;
        drillAhead(v, dir, slope);
        moveBody(v, dir * 0.6, slope * 0.6, 3);
        v.vx = 0;
        if (G.frame % 9 === 0) sfx('digRock', v.x, v.y);
      }
    }
    if (!v.drilling) fall(v, I);
    v.t += v.drilling ? 0.5 : Math.abs(v.vx) * 0.3;
  },
  draw(ctx, v, x, y) {
    const f = v.face,
      fx = f > 0 ? x + v.w : x - 1;
    box(ctx, x, y + 2, v.w, v.h - 4, '#d9a52a');
    box(ctx, x + (f > 0 ? 2 : v.w - 8), y - 1, 6, 4, '#8fd0e8');
    // the drill bit: a cone with turning teeth
    ctx.fillStyle = '#24160c';
    for (let k = 0; k < 5; k++) ctx.fillRect(fx + f * k - (f < 0 ? 0 : 0), y + 1 + k * 0.6, 1, v.h - 3 - k * 1.2);
    ctx.fillStyle = (v.t | 0) % 2 ? '#c8c8d0' : '#9a9aa6';
    for (let k = 0; k < 4; k++) ctx.fillRect(fx + f * k, y + 2 + k * 0.6, 1, v.h - 5 - k * 1.2);
    // wheels
    for (const wx of [x + 3, x + v.w - 4]) wheel(ctx, wx + 0.5, y + v.h - 1.5, 1.6, (v.x || 0) / 1.6);
    if (!v.icon && v.fuel < 20 && (G.frame >> 4) % 2) {
      ctx.fillStyle = '#ff6a5a';
      ctx.fillRect(x + v.w / 2 - 1, y - 4, 2, 2);
    }
  },
});
function drillAhead(v, dir, slope) {
  const x0 = Math.floor(dir > 0 ? v.x + v.w : v.x - 4),
    y0 = Math.floor(v.y + slope * 4) - 1;
  for (let y = y0; y < y0 + v.h + 2; y++)
    for (let x = x0; x < x0 + 4; x++) {
      if (x < 0 || y < 0 || x >= W || y >= H - 2) continue;
      const i = y * W + x,
        m = mat[i];
      if (m === ROCK || m === GRANITE) {
        mat[i] = 0;
        bg[i] = 1;
        paint(i);
        onDig(x, y);
        if (rnd() < 0.05) parts.push({ x, y, vx: (rnd() - 0.5) * 1.2, vy: -rnd(), l: 18, c: '#8a847c' });
      } else digCell(x, y, false, v);
    }
  spawnFromDig(dir > 0 ? v.x + v.w + 2 : v.x - 4, v.y + 3, v);
}

// ---- raft: floats on water ----
defineVehicle('raft', {
  name: 'Floß',
  info: 'Schwimmt auf Wasser – über Teiche und Höhlenseen',
  cost: { wood: 4 },
  w: 18,
  h: 4,
  seat: [0, -10],
  upd(v, I) {
    unstuck(v);
    const wet = liquidAt(v.x + v.w / 2, v.y + v.h);
    if (wet) {
      // buoyancy: rise until the deck sits on the surface
      v.vy += liquidAt(v.x + v.w / 2, v.y + 1) ? -0.15 : 0.05;
      v.vy *= 0.85;
      if (I && Math.abs(I.ax) > 0.3) {
        v.face = Math.sign(I.ax);
        v.vx += (v.face * 0.9 - v.vx) * 0.08;
      } else v.vx *= 0.97;
      const [bx] = moveBody(v, v.vx, v.vy, 1);
      if (bx) v.vx = 0;
    } else {
      // on land it can only be shoved along slowly (into the water)
      if (I && Math.abs(I.ax) > 0.3) {
        v.face = Math.sign(I.ax);
        v.vx = v.face * 0.3;
      }
      fall(v, I);
    }
    v.t += 0.05;
  },
  draw(ctx, v, x, y) {
    for (let k = 0; k < 4; k++) box(ctx, x + k * 4.5, y, 4, v.h, k % 2 ? '#9a6a3a' : '#b07a45');
    box(ctx, x + 2, y + 1, v.w - 4, 1, '#6e4420');
  },
});

// ---- catapult: throws what the rider holds (or a stone from the store) far away ----
// Aimed like the bow: the "Schleudern" button is its own aiming stick (input.js). A tap throws
// at the current angle, dragging sets direction and angle (a dotted flight path, render.js),
// letting go throws. The walking stick drives it.
const CAT_P = 4.6,
  ANG_MIN = 0.25,
  ANG_MAX = 1.35;
// direction and angle from a drag of the button (ax, ay: a unit vector, screen up is -y)
function catapultAim(v, { ax, ay }) {
  const face = Math.abs(ax) > 0.2 ? Math.sign(ax) : v.face;
  const ang = Math.max(ANG_MIN, Math.min(ANG_MAX, Math.atan2(-ay, Math.abs(ax) || 0.001)));
  return { face, ang };
}
const launchAt = v => [v.x + v.w / 2, v.y - 6];
// where a throw at this direction and angle would fly (items fall by 0.15 per frame, objects.js)
function catapultPath(v, face, ang) {
  let [x, y] = launchAt(v),
    vx = Math.cos(ang) * CAT_P * face,
    vy = -Math.sin(ang) * CAT_P;
  const pts = [];
  for (let t = 0; t < 140; t++) {
    vy += 0.15;
    x += vx;
    y += vy;
    if (y > H || x < 0 || x >= W || !free(x, y, 1, 1)) break;
    if (t % 3 === 2) pts.push([x, y]);
  }
  return pts;
}
defineVehicle('catapult', {
  name: 'Katapult',
  info: 'Schleudert Steine, Feuersteine und Sprengladungen weit – „Schleudern“ tippen wirft, Knopf ziehen zielt',
  cost: { wood: 4, plank: 2 },
  res: ['mech'],
  w: 16,
  h: 10,
  // (the operator stands on the ground behind it, a hand at the cup, out of the arm's way)
  seat: [-12, 0],
  make(v) {
    v.ang = 0.8;
    v.cd = 0; // reload time after a shot (ticks)
  },
  upd(v, I, r) {
    if (I) {
      if (Math.abs(I.ax) > 0.3) {
        v.face = Math.sign(I.ax);
        v.vx += (v.face * 0.35 - v.vx) * 0.2;
      } else {
        // (straight up or down on the stick or the keys, not while driving: the angle)
        if (I.ay < -0.4) v.ang = Math.min(ANG_MAX, v.ang + 0.02);
        if (I.ay > 0.4) v.ang = Math.max(ANG_MIN, v.ang - 0.02);
      }
      // (!(cd > 0): also catapults from saves made before cd existed)
      if (I.throwP && !(v.cd > 0)) fire(v, r);
    }
    if (v.cd > 0) v.cd--;
    else v.cd = 0;
    fall(v, I);
  },
  draw(ctx, v, x, y) {
    drawCatapult(ctx, v, x, y);
  },
});
// The catapult: a wheeled wooden frame with an A-shaped stand, a throwing arm with a sling cup
// and an iron counterweight on the short end, rope lashings and a pennant. The arm rests low
// at the back with a stone in the cup; a throw whips it over the top to the aim angle, it
// stays there a moment and is wound back down.
function drawCatapult(ctx, v, x, y) {
  const f = v.face || 1,
    cx = x + v.w / 2,
    W2 = v.w / 2;
  const X = dx => cx + dx * f; // mirrored by the facing
  // the arm angle: up from straight ahead (+ is up); resting it points back and a bit down
  const rest = Math.PI + 0.5,
    aim = v.ang ?? 0.8,
    cd = v.cd || 0;
  let th;
  if (cd > 37) th = rest + (aim - rest) * Math.min(1, (45 - cd) / 8) ** 0.6;
  else if (cd > 14) th = aim;
  else th = aim + (rest - aim) * (1 - cd / 14);
  if (v.icon) th = 2.2;
  ctx.save();
  ctx.lineCap = 'round';
  const line = (x0, y0, x1, y1, w, col) => {
    ctx.strokeStyle = col;
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  };
  const beam = (x0, y0, x1, y1, w = 1.6) => {
    line(x0, y0, x1, y1, w + 0.8, '#24160c');
    line(x0, y0, x1, y1, w, '#9a6a3a');
    line(x0, y0 - w * 0.25, x1, y1 - w * 0.25, w * 0.3, '#c4925a');
  };
  // base frame and wheels
  beam(X(-W2 + 0.5), y + 7, X(W2 - 0.5), y + 7, 1.8);
  for (const wx of [-W2 + 3, W2 - 3]) wheel(ctx, X(wx), y + 8.5, 1.8, (v.x || 0) / 1.8, '#5a3a1a');
  // the A-frame stand up to the axle
  const px = X(-1),
    py = y + 1.5;
  beam(X(-5), y + 6.5, px, py, 1.2);
  beam(X(3), y + 6.5, px, py, 1.2);
  beam(X(-4), y + 4.5, X(2.2), y + 4.5, 0.8);
  // the arm
  const cs = Math.cos(th) * f,
    sn = -Math.sin(th),
    Lb = 10.5,
    Lc = 3.6;
  const bx = px + cs * Lb,
    by = py + sn * Lb,
    kx = px - cs * Lc,
    ky = py - sn * Lc;
  beam(kx, ky, bx, by, 1.3);
  // iron counterweight on the short end
  ctx.fillStyle = '#24160c';
  ctx.fillRect(kx - 1.9, ky - 1.2, 3.8, 3.4);
  ctx.fillStyle = '#5d6670';
  ctx.fillRect(kx - 1.4, ky - 0.7, 2.8, 2.4);
  ctx.fillStyle = '#8b95a0';
  ctx.fillRect(kx - 1.4, ky - 0.7, 2.8, 0.5);
  // the cup at the long end, with a stone in it while it is ready
  ctx.fillStyle = '#24160c';
  ctx.beginPath();
  ctx.arc(bx, by, 1.9, 0, 7);
  ctx.fill();
  ctx.fillStyle = '#6e4420';
  ctx.beginPath();
  ctx.arc(bx, by, 1.3, 0, 7);
  ctx.fill();
  if (!(cd > 0) || v.icon) {
    ctx.fillStyle = '#8a847c';
    ctx.beginPath();
    ctx.arc(bx, by - 0.6, 1.1, 0, 7);
    ctx.fill();
    ctx.fillStyle = '#b5afa6';
    ctx.fillRect(bx - 0.6, by - 1.3, 0.6, 0.5);
  }
  // axle with rope lashing
  ctx.fillStyle = '#24160c';
  ctx.beginPath();
  ctx.arc(px, py, 1.2, 0, 7);
  ctx.fill();
  ctx.fillStyle = '#d9c08a';
  ctx.beginPath();
  ctx.arc(px, py, 0.7, 0, 7);
  ctx.fill();
  // pennant on a little pole at the back
  const fx = X(-W2 + 1.5);
  line(fx, y + 6.5, fx, y - 2, 0.6, '#24160c');
  const wave = Math.sin((v.t || 0) * 0.5 + (G.frame || 0) * 0.12) * 0.6;
  ctx.fillStyle = '#c0392b';
  ctx.beginPath();
  ctx.moveTo(fx, y - 2);
  ctx.lineTo(fx - f * 3.2, y - 1.2 + wave);
  ctx.lineTo(fx, y + 0.2);
  ctx.fill();
  ctx.restore();
}
function fire(v, r) {
  let t = r && r.inv.length ? r.inv.splice(Math.min(r.isel, r.inv.length - 1), 1)[0] : null;
  if (!t && takeStock('rock', 1)) t = 'rock';
  if (!t) return toast('Nichts zum Schleudern – Steine ins Lager oder etwas in die Hand');
  if (r && r.isel >= r.inv.length) r.isel = Math.max(0, r.inv.length - 1);
  const [lx, ly] = launchAt(v),
    it = spawnItem(t, lx, ly, Math.cos(v.ang) * CAT_P * v.face, -Math.sin(v.ang) * CAT_P, 30, r);
  if (t === 'flint') it.armed = true;
  if (t === 'tnt') it.fuse = 140;
  v.cd = 45;
  sfx('throw', v.x, v.y);
}
// the "Schleudern" button let go: dx/dy is where it was dragged (0, 0: a plain tap)
register('catapult', (c, { dx = 0, dy = 0 } = {}) => {
  const v = vehicleOf(c);
  if (!v || v.kind !== 'catapult' || c.dead) return;
  if (Math.hypot(dx, dy) > 0.3) Object.assign(v, catapultAim(v, { ax: dx, ay: dy }));
  if (!(v.cd > 0)) fire(v, c);
});

// ---- riding wipf: fast and jumps high ----
defineVehicle('mount', {
  name: 'Reitwipf',
  info: 'Schnelles Reittier für die Oberfläche, springt hoch',
  cost: { wood: 2, rock: 2 },
  w: 10,
  h: 7,
  seat: [0, -9],
  upd(v, I) {
    unstuck(v);
    const g = grounded(v);
    if (I) {
      if (Math.abs(I.ax) > 0.25) v.face = Math.sign(I.ax);
      v.vx += ((Math.abs(I.ax) > 0.25 ? I.ax * 2.1 : 0) - v.vx) * (g ? 0.25 : 0.06);
      if (I.jumpP && g) {
        v.vy = -3.3;
        sfx('jump', v.x, v.y);
      }
    } else if (g) {
      // waits, nibbling grass now and then
      v.vx *= 0.7;
      if (rnd() < 0.003) v.face = -v.face;
    }
    fall(v, I);
    v.t += Math.abs(v.vx) * 0.4;
  },
  draw(ctx, v, x, y) {
    const f = v.face,
      leg = Math.sin(v.t) > 0 ? 1 : 0;
    box(ctx, x + 1, y + 1, 8, 4, '#f2e6d0');
    box(ctx, f > 0 ? x + 7 : x - 1, y - 1, 4, 4, '#f2e6d0');
    ctx.fillStyle = '#24160c';
    ctx.fillRect(f > 0 ? x + 9 : x, y, 1, 1);
    ctx.fillStyle = '#c0392b';
    ctx.fillRect(x + 3, y, 4, 1);
    ctx.fillStyle = '#6e5a44';
    for (const lx of [x + 2, x + 7]) ctx.fillRect(lx + (leg ? 0 : 1), y + 5, 1, 2);
  },
});

export { catapultAim, catapultPath, refuel };
