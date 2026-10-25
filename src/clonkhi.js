// In-game Wühler at double resolution: the lobby portrait art (16×20 texels = 8×10 landscape
// pixels) with animated legs, arms for climbing and hanging, tools and the held item.
import { ART, FIXED, hatRects } from './portrait.js';
import { shade } from './render.js';
import { ICOL } from './sprites.js';
import { G } from './state.js';
import { GEM, GRANITE, ORE, ROCK, SAND, rnd } from './world.js';

// leg rows for stand / stride / stand / passing (built on first use: portrait.js and this
// module import each other indirectly, so ART may not exist yet at load time)
let BODY, LEGS;
function init() {
  BODY = ART.slice(0, 16);
  LEGS = [
    ART.slice(16),
    ['...oPpppppppo...', '..oPpo....oppo..', '..oBBxo...oBBxo.', '..ooooo...ooooo.'],
    ART.slice(16),
    ['...oPpppppppo...', '....oPppppo.....', '....oBBxBBxo....', '....oooooooo....'],
  ];
}
const CLIMB = [
  ['...oPpppppppo...', '...oPpo..oppo...', '...oBBxo.opo....', '...ooooo.ooo....'],
  ['...oPpppppppo...', '...opo...oPpo...', '...ooo...oBBxo..', '.........ooooo..'],
];
const GREY = { s: '#9a8f84', d: '#7a7068', n: '#aaa094', T: '#6a6a72', t: '#55555c', L: '#7a7a82', g: '#8a8a8a' };

// where in the swing of the pick a digging Wühler is (0…1, the strike at 0.6); the host
// knows the beat, other players and the lobby workers just follow the animation
function digPhase(c) {
  if (c.digPh !== undefined && c.digging) return c.digPh;
  return ((c.anim || G.frame * 0.3) * 0.11) % 1;
}
// the angle of the pick against the dig direction (negative: raised over the shoulder)
function pickAngle(c, ph) {
  if (ph < 0.45) {
    const k = Math.min(1, ph / 0.4);
    return 0.15 - 2.05 * (1 - (1 - k) * (1 - k));
  }
  if (ph < 0.6) return -1.9 + 1.9 * ((ph - 0.45) / 0.15) ** 2;
  // after the strike the pick bounces back off hard ground and sinks a little into soft ground
  const bounce = c.digM === ROCK || c.digM === GRANITE ? 0.5 : c.digM === ORE || c.digM === GEM ? 0.3 : c.digM === SAND ? -0.12 : 0.15;
  if (ph < 0.75) return -bounce * Math.sin(((ph - 0.6) / 0.15) * Math.PI);
  return 0.15 * ((ph - 0.75) / 0.25);
}
// pickaxe: handle from the hand, swung round the shoulder (see pickAngle), a curved steel
// head across the end of the handle; drawn on the half-pixel grid so it stays crisp
const q = v => Math.round(v * 2) / 2;
const HEAD = [-1.5, -1, -0.5, 0, 0.5, 1, 1.5];
const HEADC = ['#7a828a', '#8a929a', '#aab0b6', '#aab0b6', '#c0c6cc', '#d4d9de', '#eef1f4'];
function drawPick(c, ox, oy, f, g, dph, lean, skin) {
  const a = pickAngle(c, dph) * f,
    [dx0, dy0] = c.digDir,
    dx = dx0 * Math.cos(a) - dy0 * Math.sin(a),
    dy = dx0 * Math.sin(a) + dy0 * Math.cos(a);
  const hx = ox + 3 + lean * f * 0.5 + dx * 1.5,
    hy = oy + 6 + (lean > 0 ? 0.5 : 0) + dy * 1.5;
  g.fillStyle = '#24160c';
  for (let k = 1; k <= 9; k++) g.fillRect(q(hx + dx * k * 0.5) - 0.5, q(hy + dy * k * 0.5) - 0.5, 1.5, 1.5);
  g.fillStyle = '#8b5e34';
  for (let k = 1; k <= 9; k++) g.fillRect(q(hx + dx * k * 0.5), q(hy + dy * k * 0.5), 0.5, 0.5);
  // the head bends back towards the hand at both tips
  const ex = hx + dx * 4.8,
    ey = hy + dy * 4.8;
  const at = k => [q(ex - dy * k * f - dx * 0.25 * k * k), q(ey + dx * k * f - dy * 0.25 * k * k)];
  g.fillStyle = '#24160c';
  for (const k of HEAD) {
    const [tx, ty] = at(k);
    g.fillRect(tx - 0.5, ty - 0.5, 1.5, 1.5);
  }
  HEAD.forEach((k, n) => {
    const [tx, ty] = at(k);
    g.fillStyle = HEADC[n];
    g.fillRect(tx, ty, 0.5, 0.5);
  });
  // the fist round the handle
  if (skin) {
    g.fillStyle = '#24160c';
    g.fillRect(q(hx) - 0.5, q(hy) - 0.5, 1.5, 1.5);
    g.fillStyle = skin;
    g.fillRect(q(hx), q(hy), 0.5, 0.5);
  }
}
function drawClonkHi(c, ox, oy, f, g) {
  if (!BODY) init();
  const hurt = c.hurt > 0 && c.hurt & 2;
  const cap = c.dead ? '#77777f' : c.cap;
  const pal = { ...FIXED, C: cap, c: shade(cap, 0.72), h: shade(cap, 1.35) };
  if (c.dead) Object.assign(pal, GREY);
  // digging: lean back while raising the pick, forward and down into the strike
  const dph = c.digging || c.picking > 0 ? digPhase(c) : -1,
    lean = dph < 0 ? 0 : dph >= 0.3 && dph < 0.45 ? -1 : dph >= 0.58 && dph < 0.72 ? 1 : 0;
  const X = ox * 2 - 2 + lean * f,
    Y = oy * 2 + (lean > 0 ? 1 : 0);
  const blink = !c.dead && (G.frame + c.x * 7) % 240 < 6;
  // one texel = half a landscape pixel
  const px = (x, y, w, h, col) => {
    g.fillStyle = hurt && col !== FIXED.o ? '#ff6a5a' : col;
    g.fillRect((f > 0 ? X + x : X + 16 - x - w) / 2, (Y + y) / 2, w / 2, h / 2);
  };
  const rows = (list, y0) => {
    for (let y = 0; y < list.length; y++) {
      const row = list[y];
      for (let x = 0; x < row.length; x++) {
        let ch = row[x];
        if (ch === '.') continue;
        if (blink && (ch === 'e' || ch === 'w')) ch = y0 + y === 6 ? 's' : 'e';
        px(x, y0 + y, 1, 1, pal[ch]);
      }
    }
  };
  const walking = Math.abs(c.vx || 0) > 0.15;
  const ph = Math.floor(((c.anim % (Math.PI * 2)) + Math.PI * 2) / (Math.PI / 2)) % 4;
  // a pick raised over the shoulder is behind the head
  const pickBehind = dph >= 0 && pickAngle(c, dph) < -0.7;
  if (pickBehind) drawPick(c, ox, oy, f, g, dph, lean, null);
  rows(BODY, 0);
  if (c.climb) rows(CLIMB[ph < 2 ? 0 : 1], 16);
  else if (c.hangle) rows(CLIMB[ph % 2], 16);
  else rows(LEGS[walking ? ph : 0], 16);
  if (c.hat && c.hat !== 'none') {
    const rs = hatRects(c.hat);
    for (const [x, y, w, h] of rs) px(x - 1, y - 1, w + 2, h + 2, FIXED.o);
    for (const [x, y, w, h, col] of rs) px(x, y, w, h, col);
  }
  const skin = pal.s,
    sleeve = pal.t;
  if (c.hangle) {
    // both arms up to the ceiling
    px(3, -4, 2, 6, FIXED.o);
    px(11, -4, 2, 6, FIXED.o);
    px(3, -4, 2, 2, skin);
    px(11, -4, 2, 2, skin);
  } else if (c.climb) {
    const up = ph < 2;
    px(13, up ? 2 : 6, 3, 5, FIXED.o);
    px(13, up ? 2 : 6, 2, 2, skin);
  } else if (c.digging || c.picking > 0) {
    if (!pickBehind) drawPick(c, ox, oy, f, g, dph, lean, skin);
  } else if (c.hammer || c.chop || c.bridge) {
    const up = Math.sin(c.anim * 2) > 0;
    px(12, up ? 6 : 10, 3, 4, sleeve);
    px(14, up ? 4 : 11, 2, 2, skin);
    px(14, up ? 1 : 12, 4, 2, '#8b5e34');
    px(17, up ? -1 : 9, 2, 4, c.chop ? '#c0c6cc' : '#9a948c');
  } else {
    // arm swings with the step and holds the selected item
    const sw = walking ? [0, 2, 0, -2][ph] : 0;
    px(12 + Math.max(0, sw), 13, 2, 2, skin);
    const t = c.inv[c.isel];
    if (t && !c.dead) {
      px(12 + Math.max(0, sw), 13, 5, 5, FIXED.o);
      px(13 + Math.max(0, sw), 14, 3, 3, ICOL[t]);
    }
  }
  if (c.burn > 0)
    for (let k = 0; k < 3; k++) {
      g.fillStyle = rnd() < 0.5 ? '#ffcf4a' : '#ff7a2f';
      g.fillRect(ox + Math.floor(rnd() * 12) / 2, oy - 1 + Math.floor(rnd() * 16) / 2, 0.5, 0.5);
    }
}

export { drawClonkHi };
