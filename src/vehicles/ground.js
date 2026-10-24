// Ground and water vehicles: drill wagon, raft, catapult and the riding wipf.
import { digCell, spawnFromDig } from '../clonk.js';
import { moveBody, spawnItem, unstuck } from '../entities.js';
import { onDig } from '../hazards.js';
import { sfx } from '../sound.js';
import { G, parts } from '../state.js';
import { stock, takeStock } from '../store.js';
import { toast } from '../ui.js';
import { GRANITE, H, LIQ, ROCK, W, bg, free, mat, paint, rnd } from '../world.js';
import { box, defineVehicle } from './core.js';

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
    for (const wx of [x + 3, x + v.w - 4]) box(ctx, wx - 1, y + v.h - 3, 3, 3, (v.t | 0) % 2 ? '#3a3a40' : '#55555c');
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
      } else digCell(x, y);
    }
  spawnFromDig(dir > 0 ? v.x + v.w + 2 : v.x - 4, v.y + 3);
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
defineVehicle('catapult', {
  name: 'Katapult',
  info: 'Schleudert Steine, Feuersteine und Sprengladungen weit – Stick hoch/runter zielt, Wurf schießt',
  cost: { wood: 4, plank: 2 },
  res: ['mech'],
  w: 16,
  h: 10,
  seat: [-5, -8],
  make(v) {
    v.ang = 0.8;
  },
  upd(v, I, r) {
    if (I) {
      if (Math.abs(I.ax) > 0.3) {
        v.face = Math.sign(I.ax);
        v.vx += (v.face * 0.35 - v.vx) * 0.2;
      }
      if (I.ay < -0.4) v.ang = Math.min(1.35, v.ang + 0.02);
      if (I.ay > 0.4) v.ang = Math.max(0.25, v.ang - 0.02);
      if (I.throwP && v.cd <= 0) fire(v, r);
    }
    if (v.cd > 0) v.cd--;
    fall(v, I);
  },
  draw(ctx, v, x, y) {
    box(ctx, x, y + 5, v.w, 3, '#8a5a2b');
    for (const wx of [x + 2, x + v.w - 5]) box(ctx, wx, y + 7, 3, 3, '#5a3a1a');
    // the arm: pulled back after a shot, otherwise at the aim angle
    const a = v.cd > 20 ? 0.2 : v.ang,
      ax = x + v.w / 2,
      ay = y + 5,
      L = 11;
    ctx.strokeStyle = '#24160c';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(ax - Math.cos(a) * L * v.face, ay - Math.sin(a) * L);
    ctx.stroke();
    ctx.strokeStyle = '#b07a45';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.lineWidth = 1;
  },
});
function fire(v, r) {
  let t = r && r.inv.length ? r.inv.splice(Math.min(r.isel, r.inv.length - 1), 1)[0] : null;
  if (!t && takeStock('rock', 1)) t = 'rock';
  if (!t) return toast('Nichts zum Schleudern – Steine ins Lager oder etwas in die Hand');
  if (r && r.isel >= r.inv.length) r.isel = Math.max(0, r.inv.length - 1);
  const p = 4.6,
    it = spawnItem(t, v.x + v.w / 2, v.y - 6, Math.cos(v.ang) * p * v.face, -Math.sin(v.ang) * p, 30, r);
  if (t === 'flint') it.armed = true;
  if (t === 'tnt') it.fuse = 140;
  v.cd = 45;
  sfx('throw', v.x, v.y);
}

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

export { refuel };
