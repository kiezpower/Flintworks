// Vehicles: building them, getting in and out, laying rails. See core.js for how a vehicle works.
import { costTxt, hasRes, payRes } from '../buildings.js';
import { register } from '../commands.js';
import { sfx } from '../sound.js';
import { G } from '../state.js';
import { tr } from '../i18n.js';
import { toast } from '../ui.js';
import { free } from '../world.js';
import './air.js';
import { VK, enter, leave, mkVehicle, nearVehicle, vehicleOf } from './core.js';
import './ground.js';
import { layTick, startLaying, stopLaying } from './rails.js';

// the vehicles that can be built, in menu order
const BUILDABLE = ['drill', 'train', 'raft', 'catapult', 'mount', 'mast', 'airship'];

// what the action button does around vehicles (null: nothing to do with vehicles here)
function vehicleContext(c) {
  if (c.ride != null) return { label: 'Aussteigen', fn: () => leave(c) };
  if (c.laying) return { label: 'Fertig', fn: () => stopLaying(c) };
  const v = nearVehicle(c);
  if (v) return { label: 'Einsteigen', fn: () => enter(c, v) };
  return null;
}
// why a vehicle cannot be built right now (or null)
function cannotBuild(c, kind) {
  const K = VK[kind];
  if (K.lvl && ((G.base && G.base.lvl) || 1) < K.lvl) return 'Erst ab Burgstufe {n}';
  if (!hasRes(c, K.cost)) return '{name} braucht {cost}';
  if (K.needsRails && !nearRail(c)) return 'Die Grubenbahn muss auf Schienen stehen';
  return null;
}
function nearRail(c) {
  for (const tr of G.rails)
    if (
      (tr.team || 0) === (c.team || 0) &&
      tr.p.some(q => Math.abs(q[0] - c.x - 3) < 10 && Math.abs(q[1] - c.y - 10) < 8)
    )
      return true;
  return false;
}

register('vehicle', (c, { kind }) => {
  const K = VK[kind];
  if (!K || !BUILDABLE.includes(kind) || c.dead || c.ride != null) return;
  const why = cannotBuild(c, kind);
  if (why) return toast(why, { n: K.lvl, name: tr(K.name), cost: costTxt(K.cost) });
  payRes(c, K.cost);
  // it appears where the Wühler stands, resting on the ground
  let x = c.x + 3 - K.w / 2,
    y = c.y + 10 - K.h;
  for (let u = 0; u < 20 && !free(x, y, K.w, K.h); u++) y--;
  const v = mkVehicle(kind, x, y, c.team || 0);
  v.face = c.face;
  sfx('done', c.x, c.y);
  if (K.rideable) toast('{name} steht bereit – Aktion zum Einsteigen', { name: tr(K.name) });
});
register('rails', c => {
  if (c.laying) return stopLaying(c);
  if (c.ride != null || c.dead) return;
  if (!hasRes(c, { plank: 1 }) && !hasRes(c, { wood: 1 })) return toast('Schienen brauchen Bretter oder Holz');
  startLaying(c);
  toast('Lauf los: hinter dir entstehen Schienen – Aktion „Fertig“ zum Aufhören');
});

// per tick for every player (laying track)
function playerVehicleTick(c) {
  if (c.laying) layTick(c);
}

export { BUILDABLE, VK, cannotBuild, playerVehicleTick, vehicleContext, vehicleOf };
