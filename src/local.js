// Two players at one device (Clonk's shared screen): the lobby's "Zu zweit an diesem Gerät" adds a
// second Wühler (pid 1) to a game alone. The second player steers with a gamepad: the second pad
// when two are plugged in, else the only one (the first player then plays with keys or touch).
// The camera keeps both in view (the middle between them, render.js); whoever is still off the
// screen gets an arrow at its edge (net/emotes.js). Goals grow as for two in Koop.
import { addDigger } from './entities.js';
import { pad, padCount } from './gamepad.js';
import { tr } from './i18n.js';
import { consumeEdges, diggerOf, setInput } from './players.js';
import { P, saveProfile } from './profile.js';
import { G, crew } from './state.js';

const P2 = 1;
// (read from the profile when asked: the profile may not be loaded yet when this module is)
Object.defineProperty(G, 'local', { get: () => !!(P && P.local), configurable: true });
function setLocal(on) {
  P.local = !!on;
  saveProfile();
}
// the second Wühler next to the castle (after a new world, or a saved game without one); without
// the shared screen a saved second player's Wühler becomes a helper
function localSetup() {
  if (G.net || G.tut) return;
  if (!G.local) {
    const c = diggerOf(P2);
    if (c) delete c.pid;
    return;
  }
  if (diggerOf(P2) || !G.base) return;
  const b = G.base,
    c = addDigger(b.x + b.w + 6, b.gy - 10);
  Object.assign(c, { pid: P2, name: tr('Spieler 2'), cap: '#2f7fd0', hat: 'none', inv: [] });
}
// which pad steers the second player (the first player keeps pad 0 only with two pads)
const p2Pad = () => (padCount() >= 2 ? 1 : 0);
const p1HasPad = () => !G.local || G.net || padCount() >= 2;
// every tick: the second player's input from the pad
function localTick() {
  if (!G.local || G.net || !diggerOf(P2)) return;
  const Q = G.state === 'play' ? pad(p2Pad()) : null;
  consumeEdges();
  setInput(P2, {
    ax: Q ? Q.ax : 0,
    ay: Q ? Q.ay : 0,
    dig: !!(Q && Q.dig),
    auto: !!G.autoDig,
    jumpP: !!(Q && Q.jumpP),
    jumpUp: false,
    throwP: !!(Q && Q.throwP),
    actP: !!(Q && Q.actP),
  });
}
// the camera's focus with two at one screen: the middle between both (null otherwise)
function localFocus() {
  if (!G.local || G.net) return null;
  const a = crew.find(c => c.pid === G.myId && !c.dead),
    b = diggerOf(P2);
  if (!a || !b || b.dead) return null;
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, vx: (a.vx + b.vx) / 2, vy: Math.max(a.vy, b.vy) };
}

export { localFocus, localSetup, localTick, p1HasPad, setLocal };
