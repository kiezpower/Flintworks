// Vehicles: things a Wühler can get into and steer (drill wagon, raft, catapult, airship,
// riding wipf, cable car gondola) or that run by themselves (the mine train on rails).
// Every kind registers itself in VK with its size, cost and three functions:
//   make(v)            set up a new one
//   upd(v, I)          one tick; I is the rider's input (or null without rider)
//   draw(ctx, v, x, y) paint it at screen position x, y
// A rider sits in the vehicle (c.ride = vehicle id); the "Aussteigen" action gets out again.
import { newId } from '../entities.js';
import { inputOf } from '../players.js';
import { G, crew, vehicles } from '../state.js';
import { teamOf, useMine, useTeam } from '../teams.js';
import { free } from '../world.js';

const VK = {};
function defineVehicle(kind, def) {
  VK[kind] = { rideable: true, seat: [0, -9], ...def };
}
function mkVehicle(kind, x, y, team = 0) {
  const K = VK[kind];
  const v = {
    id: newId(),
    kind,
    x,
    y,
    w: K.w,
    h: K.h,
    vx: 0,
    vy: 0,
    face: 1,
    rider: null,
    team,
    fuel: 100,
    ang: 0,
    t: 0,
  };
  K.make?.(v);
  vehicles.push(v);
  return v;
}
const vehicleOf = c => (c && c.ride != null ? vehicles.find(v => v.id === c.ride) : null);
const riderOf = v => (v.rider != null ? crew.find(c => c.id === v.rider) : null);

// a vehicle next to the Wühler that it could get into
function nearVehicle(c) {
  let best = null,
    bd = 1e9;
  for (const v of vehicles) {
    const K = VK[v.kind];
    if (!K.rideable || v.rider != null || (K.canEnter && !K.canEnter(v))) continue;
    if (!(c.x + 6 > v.x - 4 && c.x < v.x + v.w + 4 && c.y + 10 > v.y - 6 && c.y < v.y + v.h + 4)) continue;
    const d = Math.abs(v.x + v.w / 2 - c.x - 3) + Math.abs(v.y + v.h / 2 - c.y - 5);
    if (d < bd) {
      bd = d;
      best = v;
    }
  }
  return best;
}
function enter(c, v) {
  if (v.rider != null || c.ride != null) return;
  c.ride = v.id;
  v.rider = c.id;
  c.vx = c.vy = 0;
  c.digging = false;
}
function leave(c) {
  const v = vehicleOf(c);
  c.ride = null;
  if (!v) return;
  v.rider = null;
  // step out beside it, standing on the ground
  c.x = v.x + v.w / 2 - 3;
  c.y = v.y + v.h - 10;
  for (let u = 0; u < 20 && !free(c.x, c.y, 6, 10); u++) c.y--;
  c.vx = c.vy = 0;
}
function seatRider(v, c) {
  const [sx, sy] = VK[v.kind].seat;
  c.x = v.x + v.w / 2 - 3 + sx * v.face;
  c.y = v.y + sy;
  c.vx = v.vx;
  c.vy = 0;
  c.face = v.face;
  c.anim += Math.abs(v.vx) * 0.2;
}

// every tick (host / single game)
function updVehicles() {
  for (let k = vehicles.length - 1; k >= 0; k--) {
    const v = vehicles[k],
      K = VK[v.kind],
      c = riderOf(v);
    if (c && (c.dead || c.ride !== v.id)) {
      v.rider = null;
      if (c.ride === v.id) c.ride = null;
    }
    const r = riderOf(v);
    useTeam(teamOf(v));
    K.upd(v, r ? inputOf(r.pid) : null, r);
    if (r) seatRider(v, r);
    if (v.gone) {
      if (r) leave(r);
      vehicles.splice(k, 1);
    }
  }
  useMine();
}
function drawVehicles(ctx, cx, cy) {
  for (const v of vehicles) {
    const x = Math.round(v.x - cx),
      y = Math.round(v.y - cy);
    if (x < -60 || x > G.VW + 60 || y < -60 || y > G.VH + 60) continue;
    VK[v.kind].draw(ctx, v, x, y);
  }
}
// small picture for the build menu
const iconCache = {};
function vehicleIcon(kind) {
  if (iconCache[kind]) return iconCache[kind];
  const K = VK[kind],
    cv = document.createElement('canvas');
  cv.width = Math.max(10, K.w + 4);
  cv.height = Math.max(10, K.h + 6);
  const g = cv.getContext('2d');
  K.draw(g, { kind, w: K.w, h: K.h, face: 1, t: 0, ang: 0.8, vx: 0, fuel: 100, icon: true }, 2, 4);
  return (iconCache[kind] = cv);
}
// outlined box helper for the drawings
function box(ctx, x, y, w, h, col, line = '#24160c') {
  ctx.fillStyle = line;
  ctx.fillRect(x - 0.5, y - 0.5, w + 1, h + 1);
  ctx.fillStyle = col;
  ctx.fillRect(x, y, w, h);
}

export {
  VK,
  box,
  defineVehicle,
  drawVehicles,
  enter,
  leave,
  mkVehicle,
  nearVehicle,
  riderOf,
  updVehicles,
  vehicleIcon,
  vehicleOf,
};
