// Rails and the mine train. A Wühler lays track while walking ("Schienen legen"): every couple
// of pixels a point, one plank (or wood) per 10 points. The train runs along its track by
// itself, waits at both ends, takes the helpers' load at the far end and sells/stores it when
// it reaches the castle.
import { payRes, hasRes } from '../buildings.js';
import { sfx } from '../sound.js';
import { G, crew, vehicles } from '../state.js';
import { unload } from '../store.js';
import { toast } from '../ui.js';
import { free } from '../world.js';
import { box, defineVehicle } from './core.js';

G.rails = []; // tracks: [{ team, p: [[x, y], …] }]
const SPACING = 3;

// ---- laying ----
function startLaying(c) {
  c.laying = true;
  const fx = c.x + 3,
    fy = c.y + 10;
  // carry on from the end of a track close by, otherwise start a new one
  for (const tr of G.rails) {
    const first = tr.p[0],
      last = tr.p[tr.p.length - 1];
    if (Math.hypot(last[0] - fx, last[1] - fy) < 10) return (c.layTrack = tr);
    if (Math.hypot(first[0] - fx, first[1] - fy) < 10) {
      tr.p.reverse();
      return (c.layTrack = tr);
    }
  }
  const tr = { team: c.team || 0, p: [[Math.round(fx), Math.round(fy)]] };
  G.rails.push(tr);
  c.layTrack = tr;
  c.layN = 0;
}
function stopLaying(c) {
  c.laying = false;
  if (c.layTrack && c.layTrack.p.length < 2) G.rails.splice(G.rails.indexOf(c.layTrack), 1);
  c.layTrack = null;
}
// each tick for a Wühler that lays track
function layTick(c) {
  const tr = c.layTrack;
  if (!tr || c.dead) return stopLaying(c);
  if (free(c.x, c.y + 1, 6, 10)) return; // only on the ground
  const fx = Math.round(c.x + 3),
    fy = Math.round(c.y + 10),
    last = tr.p[tr.p.length - 1];
  if (Math.hypot(fx - last[0], fy - last[1]) < SPACING) return;
  if (++c.layN % 10 === 1) {
    const cost = hasRes(c, { plank: 1 }) ? { plank: 1 } : { wood: 1 };
    if (!hasRes(c, cost)) {
      toast('Keine Bretter oder Holz mehr für Schienen');
      return stopLaying(c);
    }
    payRes(c, cost);
    sfx('hammer', c.x, c.y);
  }
  tr.p.push([fx, fy]);
  if (tr.p.length > 2000) stopLaying(c);
}
function drawRails(ctx, cx, cy) {
  for (const tr of G.rails) {
    const p = tr.p;
    for (let k = 0; k < p.length; k++) {
      const x = p[k][0] - cx,
        y = p[k][1] - cy;
      if (x < -4 || x > G.VW + 4 || y < -4 || y > G.VH + 4) continue;
      if (k % 2 === 0) {
        ctx.fillStyle = '#6e4420';
        ctx.fillRect(x - 1, y - 1, 3, 2);
      }
      if (k) {
        // two rails between this point and the previous one
        const q = p[k - 1];
        ctx.fillStyle = '#9a9aa6';
        ctx.fillRect(Math.min(x, q[0] - cx), y - 2, Math.abs(x - q[0] + cx) + 1, 1);
      }
    }
  }
}

// ---- the train ----
const trackOf = v => G.rails[v.track];
function nearestPoint(x, y, team) {
  let best = null,
    bd = 1e9;
  G.rails.forEach((tr, ti) => {
    if ((tr.team || 0) !== (team || 0)) return;
    tr.p.forEach((q, k) => {
      const d = Math.abs(q[0] - x) + Math.abs(q[1] - y);
      if (d < bd) {
        bd = d;
        best = { ti, k, d };
      }
    });
  });
  return best;
}
const atBase = (q, base) => base && q[0] > base.x - 6 && q[0] < base.x + base.w + 6 && Math.abs(q[1] - base.gy) < 16;
defineVehicle('train', {
  name: 'Grubenbahn',
  info: 'Fährt auf deinen Schienen hin und her und bringt die Ladung der Helfer zur Burg',
  cost: { metal: 2, plank: 4 },
  w: 14,
  h: 8,
  seat: [-3, -6],
  needsRails: true,
  make(v) {
    const n = nearestPoint(v.x + 7, v.y + 8, v.team);
    v.track = n ? n.ti : -1;
    v.pos = n ? n.k : 0;
    v.dir = 1;
    v.wait = 60;
    v.cargo = [];
  },
  upd(v) {
    const tr = trackOf(v);
    if (!tr || tr.p.length < 2) {
      v.vy = Math.min((v.vy || 0) + 0.17, 4);
      return;
    }
    const last = tr.p.length - 1;
    if (v.wait > 0) {
      v.wait--;
      const q = tr.p[Math.round(v.pos)];
      // at the castle: sell and store everything
      if (v.cargo.length && atBase(q, G.base) && G.frame % 15 === 0) unload(v.cargo, v.x + 7, v.y - 6);
    } else {
      v.pos += v.dir * 0.4;
      if (v.pos >= last || v.pos <= 0) {
        v.pos = Math.max(0, Math.min(last, v.pos));
        v.dir = -v.dir;
        v.wait = 120;
        sfx('clack', v.x, v.y);
      }
    }
    const k = Math.floor(v.pos),
      a = tr.p[k],
      b = tr.p[Math.min(last, k + 1)],
      f = v.pos - k;
    const nx = a[0] + (b[0] - a[0]) * f - v.w / 2,
      ny = a[1] + (b[1] - a[1]) * f - v.h - 1;
    v.vx = nx - v.x;
    v.face = v.dir;
    v.x = nx;
    v.y = ny;
    v.t += Math.abs(v.vx) * 0.5;
    // helpers standing next to it hand over their load
    if (G.frame % 10 === 0)
      for (const c of crew) {
        if (c.pid != null || c.dead || (c.team || 0) !== (v.team || 0) || v.cargo.length >= 40) continue;
        if (Math.abs(c.x + 3 - (v.x + 7)) < 10 && Math.abs(c.y + 10 - (v.y + v.h)) < 8 && c.inv.length) {
          v.cargo.push(...c.inv.splice(0, 40 - v.cargo.length));
          c.isel = 0;
          sfx('pick', c.x, c.y);
        }
      }
  },
  draw(ctx, v, x, y) {
    box(ctx, x, y + 1, v.w, v.h - 3, '#5d6a78');
    box(ctx, x + (v.face > 0 ? v.w - 4 : 0), y - 3, 4, 4, '#3a3a40');
    if (v.cargo && v.cargo.length) {
      ctx.fillStyle = v.cargo.includes('nug') ? '#f2c230' : '#8a847c';
      ctx.fillRect(x + 2, y, v.w - 6, 2);
    }
    for (const wx of [x + 2, x + v.w - 5]) box(ctx, wx, y + v.h - 3, 3, 3, (v.t | 0) % 2 ? '#24160c' : '#3a3a40');
  },
});
// where a helper with a load can meet the train: the nearest point of its team's track, if
// a train runs there and it is clearly closer than walking home
function trainStop(c) {
  const team = c.team || 0;
  if (!vehicles.some(v => v.kind === 'train' && (v.team || 0) === team && trackOf(v))) return null;
  const n = nearestPoint(c.x + 3, c.y + 10, team);
  if (!n || atBase(G.rails[n.ti].p[n.k], G.base)) return null;
  const q = G.rails[n.ti].p[n.k];
  return Math.abs(q[0] - (G.base.x + G.base.w / 2)) > Math.abs(q[0] - c.x) + 80 && n.d < 120 ? q : null;
}

export { drawRails, layTick, startLaying, stopLaying, trainStop };
