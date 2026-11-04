// Ground and water vehicles: drill wagon, raft, catapult and the riding fluffel.
import { digCell, spawnFromDig } from '../digger.js';
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
    // the exhaust puffs: dark and often while boring, now and then while driving
    if (v.drilling ? G.frame % 5 === 0 : Math.abs(v.vx) > 0.2 && G.frame % 14 === 0) {
      const ex = v.face > 0 ? v.x + 2 : v.x + v.w - 2;
      parts.push({ x: ex, y: v.y - 2, vx: -v.face * 0.15 + (rnd() - 0.5) * 0.2, vy: -0.45, l: v.drilling ? 34 : 22, c: v.drilling ? '#3e3a38' : '#8a8580' });
    }
  },
  draw(ctx, v, x, y) {
    drawDrill(ctx, v, x, y);
  },
});
// The drill wagon: a yellow mining machine on caterpillar tracks, with a little cab, hazard
// stripes at the back, an exhaust that puffs while it bores, a headlight, and in front a steel
// drill cone whose spiral grooves run while it turns. All at double resolution.
function drawDrill(ctx, v, x, y) {
  const f = v.face || 1,
    W2 = v.w;
  const X = dx => (f > 0 ? x + dx : x + W2 - dx); // dx from the back
  const L = (a, b) => Math.min(X(a), X(b)); // left edge of a span
  const turn = v.t || 0;
  ctx.save();
  ctx.lineCap = 'round';
  const rect = (a, b, y0, h, col) => {
    ctx.fillStyle = col;
    ctx.fillRect(L(a, b), y0, Math.abs(b - a), h);
  };
  // ---- tracks: a dark band, links running round, two road wheels ----
  rect(0.5, 13.5, y + 5.6, 3.6, '#24160c');
  rect(1, 13, y + 6, 2.8, '#3a3a42');
  ctx.fillStyle = '#7a7a84';
  const ph = (turn * 1.4) % 2;
  for (let k = 0; k < 7; k++) {
    const a = 1 + ((k * 2 + ph) % 12);
    ctx.fillRect(X(a) - 0.25, y + 6, 0.5, 0.5); // top run
    ctx.fillRect(X(13 - (a - 1)) - 0.25, y + 8.3, 0.5, 0.5); // bottom run, the other way
  }
  for (const a of [3, 7, 11]) {
    ctx.fillStyle = '#24160c';
    ctx.beginPath();
    ctx.arc(X(a), y + 7.4, 1.25, 0, 7);
    ctx.fill();
    ctx.fillStyle = '#8b8b95';
    ctx.beginPath();
    ctx.arc(X(a), y + 7.4, 0.8, 0, 7);
    ctx.fill();
    ctx.fillStyle = '#24160c';
    ctx.fillRect(X(a) - 0.25, y + 7.15, 0.5, 0.5);
  }
  // ---- hull: yellow with a dark edge, lit from above; hazard stripes at the back ----
  rect(0, 14, y + 1.6, 4.6, '#24160c');
  rect(0.5, 13.5, y + 2.1, 3.6, '#e0a92a');
  rect(0.5, 13.5, y + 2.1, 0.6, '#f6cf5a');
  rect(0.5, 13.5, y + 5.1, 0.6, '#a87818');
  ctx.save();
  ctx.beginPath();
  ctx.rect(L(0.5, 3.2), y + 2.1, 2.7, 3.6);
  ctx.clip();
  ctx.strokeStyle = '#24160c';
  ctx.lineWidth = 0.7;
  for (let k = -1; k < 4; k++) {
    ctx.beginPath();
    ctx.moveTo(X(0.5 + k * 1.4), y + 5.7);
    ctx.lineTo(X(0.5 + k * 1.4 + 2.2), y + 2.1);
    ctx.stroke();
  }
  ctx.restore();
  // rivets
  ctx.fillStyle = '#a87818';
  for (const a of [4.5, 7.5, 10.5]) ctx.fillRect(X(a) - 0.25, y + 3.6, 0.5, 0.5);
  // ---- exhaust pipe at the back ----
  rect(1.4, 2.6, y - 1.6, 3.4, '#24160c');
  rect(1.7, 2.3, y - 1.3, 3, '#5a5a62');
  rect(1.2, 2.8, y - 2, 0.7, '#24160c');
  // ---- the cab: an open seat with a slanted windscreen and a roof lamp ----
  rect(3.4, 9.2, y - 0.2, 2.1, '#24160c');
  rect(3.8, 8.8, y + 0.2, 1.5, '#c08a1e');
  ctx.strokeStyle = '#24160c';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(X(8.6), y + 1.6);
  ctx.lineTo(X(9.8), y - 2.4);
  ctx.stroke();
  ctx.strokeStyle = '#8fd0e8';
  ctx.lineWidth = 0.6;
  ctx.stroke();
  const low = !v.icon && v.fuel < 20;
  ctx.fillStyle = low && (G.frame >> 4) % 2 ? '#ff4a3a' : '#7a3a2a';
  ctx.fillRect(X(6.2) - 0.6, y - 1, 1.2, 0.9);
  // ---- headlight on the front ----
  const hx = X(12.6),
    hy = y + 3;
  if (!v.icon) {
    const g = ctx.createRadialGradient(hx, hy, 0.5, hx + f * 6, hy + 1, 7);
    g.addColorStop(0, 'rgba(255,242,168,0.45)');
    g.addColorStop(1, 'rgba(255,242,168,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(hx, hy - 0.6);
    ctx.lineTo(hx + f * 12, hy - 3);
    ctx.lineTo(hx + f * 12, hy + 5);
    ctx.lineTo(hx, hy + 0.6);
    ctx.fill();
  }
  ctx.fillStyle = '#24160c';
  ctx.fillRect(hx - 0.8, hy - 0.8, 1.6, 1.6);
  ctx.fillStyle = '#fff2a8';
  ctx.fillRect(hx - 0.4, hy - 0.4, 0.8, 0.8);
  // ---- drill: a collar, then the steel cone with running spiral grooves ----
  rect(13.5, 15, y + 1.2, 5.4, '#24160c');
  rect(13.8, 14.7, y + 1.6, 4.6, '#8b95a0');
  const b0 = 15,
    tip = 19.6,
    cy = y + 3.9,
    hh = 2.7;
  const cone = (grow, col) => {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(X(b0), cy - hh - grow);
    ctx.lineTo(X(tip + grow * 1.4), cy);
    ctx.lineTo(X(b0), cy + hh + grow);
    ctx.closePath();
    ctx.fill();
  };
  cone(0.5, '#1e1a18');
  cone(0, '#b8c0c8');
  // grooves: slanted lines across the cone, moving towards the tip while it turns
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(X(b0), cy - hh);
  ctx.lineTo(X(tip), cy);
  ctx.lineTo(X(b0), cy + hh);
  ctx.closePath();
  ctx.clip();
  ctx.strokeStyle = '#5d6670';
  ctx.lineWidth = 0.55;
  const gp = (turn * 2.2) % 1.5;
  for (let k = -1; k < 4; k++) {
    const a = b0 + k * 1.5 + gp;
    ctx.beginPath();
    ctx.moveTo(X(a), cy - hh);
    ctx.lineTo(X(a + 1.4), cy + hh);
    ctx.stroke();
  }
  ctx.restore();
  // a bright edge along the top of the cone
  ctx.strokeStyle = 'rgba(240,246,250,0.9)';
  ctx.lineWidth = 0.4;
  ctx.beginPath();
  ctx.moveTo(X(b0 + 0.3), cy - hh + 0.5);
  ctx.lineTo(X(tip - 0.6), cy - 0.2);
  ctx.stroke();
  ctx.restore();
}
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
  info: 'Schwimmt nur auf Wasser – über Teiche und Höhlenseen, am Ufer bauen',
  cost: { wood: 4 },
  w: 18,
  h: 4,
  seat: [0, -10],
  needsWater: true,
  upd(v, I) {
    unstuck(v);
    const wet = liquidAt(v.x + v.w / 2, v.y + v.h);
    const water = x => liquidAt(x, v.y + v.h) || liquidAt(x, v.y + v.h + 1) || liquidAt(x, v.y + v.h + 2);
    if (wet) {
      // buoyancy: rise until the deck sits on the surface
      v.vy += liquidAt(v.x + v.w / 2, v.y + 1) ? -0.15 : 0.05;
      v.vy *= 0.85;
      if (I && Math.abs(I.ax) > 0.3) {
        v.face = Math.sign(I.ax);
        v.vx += (v.face * 0.9 - v.vx) * 0.08;
      } else v.vx *= 0.97;
      // it only goes where there is water under its front edge: at the shore it stops
      const front = v.vx > 0 ? v.x + v.w + v.vx : v.x + v.vx;
      if (v.vx && !water(front)) v.vx = 0;
      const [bx] = moveBody(v, v.vx, v.vy, 0);
      if (bx) v.vx = 0;
    } else {
      // on land it does not move (it only sinks onto the ground or into water below)
      if (I && Math.abs(I.ax) > 0.3 && !(G.frame - (v.tipT ?? -1e9) < 180)) {
        v.tipT = G.frame;
        toast('Das Floß fährt nur auf Wasser');
      }
      v.vx = 0;
      fall(v, null);
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

// ---- archery target: a straw boss with rings on a wooden easel. Arrows that hit it score by
// the ring (combat.js) and stay in the straw until someone walks past and takes them back ----
defineVehicle('target', {
  name: 'Zielscheibe',
  info: 'Zum Üben mit dem Langbogen: Punkte je nach Ring, die Pfeile bleiben stecken',
  placed: 'Zielscheibe steht – schieß drauf!',
  cost: { wood: 2, plank: 1 },
  res: ['archery'],
  w: 10,
  h: 14,
  rideable: false,
  upd(v) {
    // stays put; falls if the ground is dug away
    if (!v.icon) moveBody(v, 0, 1, 0);
  },
  draw(ctx, v, x, y) {
    const cx = x + v.w / 2,
      cy = y + 5;
    ctx.save();
    ctx.lineCap = 'round';
    const leg = (x0, y0, x1, y1) => {
      ctx.strokeStyle = '#24160c';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
      ctx.strokeStyle = '#9a6a3a';
      ctx.lineWidth = 0.8;
      ctx.stroke();
    };
    leg(cx, cy, cx + 0.5, y + v.h); // the back leg
    leg(cx - 2, cy + 2, cx - 4, y + v.h);
    leg(cx + 2, cy + 2, cx + 4, y + v.h);
    // straw rim, then the rings: white, black, blue, red, gold
    const ring = (r, col) => {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, 7);
      ctx.fill();
    };
    ring(6.1, '#24160c');
    ring(5.6, '#d4b064');
    ring(5, '#f4efe2');
    ring(4, '#2a2a30');
    ring(3, '#3a7bd5');
    ring(2, '#d8433a');
    ring(1, '#f2c230');
    // a few straw strands on the rim
    ctx.fillStyle = '#b08a44';
    for (let k = 0; k < 8; k++) {
      const an = k * 0.785 + 0.3;
      ctx.fillRect(cx + Math.cos(an) * 5.3 - 0.25, cy + Math.sin(an) * 5.3 - 0.25, 0.5, 0.5);
    }
    ctx.restore();
  },
});

// ---- riding fluffel: fast and jumps high ----
defineVehicle('mount', {
  name: 'Reitfluffel',
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

// the water surface next to a Wühler, where a raft can be put (or null): the column of
// water closest to its feet within a few steps, and the top of that water
function waterNear(c) {
  const fx = Math.round(c.x + 3),
    fy = Math.round(c.y + 10);
  let best = null;
  for (let dx = 0; dx <= 24 && !best; dx++)
    for (const s of dx ? [c.face || 1, -(c.face || 1)] : [1]) {
      const x = fx + dx * s;
      for (let y = fy - 4; y <= fy + 16; y++)
        if (liquidAt(x, y)) {
          let top = y;
          while (top > 0 && liquidAt(x, top - 1)) top--;
          // how far the water reaches left and right just under its surface
          let l = x,
            r = x;
          while (l > 0 && liquidAt(l - 1, top + 1)) l--;
          while (r < W - 1 && liquidAt(r + 1, top + 1)) r++;
          best = { x, top, l, r };
          break;
        }
      if (best) break;
    }
  return best;
}

export { catapultAim, catapultPath, refuel, waterNear };
