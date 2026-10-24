// Airship and cable car: getting over valleys, lakes and long distances.
import { moveBody, spawnItem } from '../entities.js';
import { sfx } from '../sound.js';
import { G, vehicles } from '../state.js';
import { toast } from '../ui.js';
import { box, defineVehicle, mkVehicle } from './core.js';
import { refuel } from './ground.js';

// ---- airship: flies wherever you steer it, burns coal; "throw" drops what you hold ----
defineVehicle('airship', {
  name: 'Luftschiff',
  info: 'Fliegt frei mit dem Stick, Wurf lässt Dinge fallen – ab Burgstufe 2, braucht Kohle',
  cost: { metal: 4, plank: 6, wood: 4 },
  lvl: 2,
  w: 22,
  h: 24,
  seat: [0, 11],
  upd(v, I, r) {
    // drop what the pilot holds
    if (I && I.throwP && r && r.inv.length) {
      const t = r.inv.splice(Math.min(r.isel, r.inv.length - 1), 1)[0];
      const it = spawnItem(t, v.x + v.w / 2, v.y + v.h + 2, v.vx, 0.5, 20, r);
      if (t === 'flint') it.armed = true;
      if (t === 'tnt') it.fuse = 140;
      if (r.isel >= r.inv.length) r.isel = Math.max(0, r.inv.length - 1);
      sfx('throw', v.x, v.y);
    }
    const flying = I && v.fuel > 0;
    if (flying) {
      refuel(v);
      v.fuel -= 0.008;
      if (Math.abs(I.ax) > 0.25) v.face = Math.sign(I.ax);
      v.vx += I.ax * 0.04;
      v.vy += I.ay * 0.04 - 0.002;
      if (v.fuel <= 0 && G.frame % 120 === 0) toast('Das Luftschiff braucht Kohle im Lager');
    } else v.vy += 0.02; // sinks slowly without a pilot or coal
    v.vx *= 0.97;
    v.vy *= 0.96;
    v.vx = Math.max(-1.3, Math.min(1.3, v.vx));
    v.vy = Math.max(-1, Math.min(1.5, v.vy));
    const [bx, by] = moveBody(v, v.vx, v.vy, 0);
    if (bx) v.vx *= -0.3;
    if (by) v.vy = 0;
    if (v.y < 2) {
      v.y = 2;
      v.vy = 0;
    }
    v.t += 0.1 + Math.abs(v.vx) * 0.3;
  },
  draw(ctx, v, x, y) {
    // balloon
    ctx.fillStyle = '#24160c';
    ctx.beginPath();
    ctx.ellipse(x + v.w / 2, y + 5, v.w / 2 + 1, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#c8402c';
    ctx.beginPath();
    ctx.ellipse(x + v.w / 2, y + 5, v.w / 2, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e8d8b0';
    for (let k = 2; k < v.w - 1; k += 5) ctx.fillRect(x + k, y + 1, 1, 8);
    // ropes and basket
    ctx.fillStyle = '#5a3a1a';
    ctx.fillRect(x + 6, y + 10, 1, 11);
    ctx.fillRect(x + v.w - 7, y + 10, 1, 11);
    box(ctx, x + 5, y + 20, v.w - 10, 4, '#9a6a3a');
    // propeller
    const px = v.face > 0 ? x - 2 : x + v.w + 1;
    ctx.fillStyle = (v.t | 0) % 2 ? '#e4e8ec' : '#8a8a92';
    ctx.fillRect(px, y + ((v.t | 0) % 2 ? 18 : 20), 1, 3);
  },
});

// ---- cable car: two masts; the gondola shuttles between them by itself ----
defineVehicle('mast', {
  name: 'Seilbahnmast',
  info: 'Zwei Masten (bis 400 Pixel auseinander) bilden eine Seilbahn – die Gondel fährt von allein',
  cost: { plank: 3, metal: 1 },
  w: 6,
  h: 26,
  rideable: false,
  make(v) {
    // the second mast of a team links up with the nearest free one
    const other = vehicles.find(
      o => o.kind === 'mast' && o !== v && o.team === v.team && !o.link && Math.abs(o.x - v.x) < 400,
    );
    if (!other) return toast('Seilbahnmast steht – stelle einen zweiten auf (bis 400 Pixel entfernt)');
    other.link = v.id;
    v.link = other.id;
    const g = mkVehicle('gondola', other.x - 4, other.y + 6, v.team);
    g.a = other.id;
    g.b = v.id;
    toast('Seilbahn fertig – die Gondel pendelt zwischen den Masten');
  },
  upd(v) {
    // stays put; falls if the ground is dug away
    if (!v.icon) moveBody(v, 0, 1, 0);
  },
  draw(ctx, v, x, y) {
    box(ctx, x + 2, y, 2, v.h, '#8a5a2b');
    box(ctx, x, y, 6, 2, '#6e4420');
    box(ctx, x - 1, y + v.h - 2, 8, 2, '#6e4420');
    // the rope to the other mast
    const o = v.link != null && vehicles.find(q => q.id === v.link);
    if (o && o.x > v.x) {
      ctx.strokeStyle = '#2a2a2a';
      ctx.beginPath();
      ctx.moveTo(x + 3, y + 1);
      ctx.lineTo(x + 3 + (o.x - v.x), y + 1 + (o.y - v.y));
      ctx.stroke();
    }
  },
});
defineVehicle('gondola', {
  name: 'Gondel',
  hidden: true,
  w: 10,
  h: 8,
  seat: [0, -1],
  canEnter: v => v.wait > 0, // only at a station
  make(v) {
    v.t = 0;
    v.dir = 1;
    v.wait = 120;
  },
  upd(v) {
    const A = vehicles.find(o => o.id === v.a),
      B = vehicles.find(o => o.id === v.b);
    if (!A || !B) return (v.gone = true);
    if (v.wait > 0) v.wait--;
    else {
      const len = Math.hypot(B.x - A.x, B.y - A.y) || 1;
      v.t += (v.dir * 0.7) / len;
      if (v.t >= 1 || v.t <= 0) {
        v.t = Math.max(0, Math.min(1, v.t));
        v.dir = -v.dir;
        v.wait = 150;
        sfx('clack', v.x, v.y);
      }
    }
    const px = A.x + 3 + (B.x - A.x) * v.t,
      py = A.y + 1 + (B.y - A.y) * v.t;
    v.vx = px - v.w / 2 - v.x || 0;
    v.x = px - v.w / 2;
    v.y = py + 6;
  },
  draw(ctx, v, x, y) {
    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(x + v.w / 2, y - 6, 1, 6);
    box(ctx, x, y, v.w, v.h, '#3f7fb0');
    box(ctx, x + 2, y + 1, v.w - 4, 3, '#a8d8ee');
  },
});
