// In-game Wühler at double resolution: the lobby portrait art (16×20 texels = 8×10 landscape
// pixels) with animated legs, arms for climbing and hanging, tools and the held item.
import { ART, FIXED, hatRects } from './portrait.js';
import { shade } from './render.js';
import { ICOL } from './sprites.js';
import { G } from './state.js';
import { rnd } from './world.js';

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

function drawClonkHi(c, ox, oy, f, g) {
  if (!BODY) init();
  const hurt = c.hurt > 0 && c.hurt & 2;
  const cap = c.dead ? '#77777f' : c.cap;
  const pal = { ...FIXED, C: cap, c: shade(cap, 0.72), h: shade(cap, 1.35) };
  if (c.dead) Object.assign(pal, GREY);
  const X = ox * 2 - 2,
    Y = oy * 2;
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
  } else if (c.digging) {
    const [dx, dy] = c.digDir;
    const wob = Math.sin(c.anim * 2) * 0.7;
    // pickaxe: handle from the hand towards the dig direction, steel head at the end
    const hx = ox + 3 + dx * 1.5,
      hy = oy + 6 + dy * 1.5;
    g.fillStyle = '#8b5e34';
    for (let k = 1; k <= 5; k++) g.fillRect(hx + dx * k * 0.8 + wob * 0.3, hy + dy * k * 0.8, 1, 1);
    g.fillStyle = '#24160c';
    g.fillRect(hx + dx * 5 + wob - 1, hy + dy * 5 - 1.5, 3, 3);
    g.fillStyle = '#aab0b6';
    g.fillRect(hx + dx * 5 + wob - 0.5, hy + dy * 5 - 1, 2, 2);
    g.fillStyle = '#e4e8ec';
    g.fillRect(hx + dx * 5 + wob - 0.5, hy + dy * 5 - 1, 1, 0.5);
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
