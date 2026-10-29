// Detailed 16×20 Wühler for the lobby and shop (the in-game sprite is 7×10).
import { outfitPal } from './skins.js';
import { drawHat, shade } from './render.js';

const ART = [
  '.....oooooo.....',
  '....ohhCCCCo....',
  '...ohCCCCCCCo...',
  '..oCCCCCCCCCCo..',
  '..occcccccccccco',
  '..orrssssssssoo.',
  '..orsssssswesso.',
  '..orsksssssessoo',
  '..ordssssssssnno',
  '...odssssmmssoo.',
  '....oddsssssoo..',
  '...otLLLLLLto...',
  '..ottTTTTTTTso..',
  '..ottTTTTTTTso..',
  '..otbbbbgbbbto..',
  '..otTTTTTTTTto..',
  '...oPpppppppo...',
  '...oPpo..oppo...',
  '...oBBxo.oBBxo..',
  '...ooooo.ooooo..',
];
const FIXED = {
  o: '#24160c',
  s: '#f0c49a',
  d: '#d49a72',
  n: '#ffdcb8',
  e: '#1a120c',
  w: '#ffffff',
  r: '#6a4022',
  k: '#f2a084',
  m: '#a8604a',
  T: '#3f5f9a',
  t: '#2c4677',
  L: '#6a8cd0',
  b: '#3a2616',
  g: '#e0b844',
  p: '#5a3a22',
  P: '#46301c',
  B: '#2e1d12',
  x: '#4a3222',
};

// Hats at portrait scale: same shapes as in game, doubled
function hatRects(hat) {
  const r = [];
  const put = (x, y, w, h, col) => r.push([x * 2 + 2, y * 2 + 1, w * 2, h * 2, col]);
  drawHat(put, hat);
  return r;
}

// outfit: a skin from skins.js (jacket, belt and trousers)
function drawPortrait(g, X, Y, f, cap, hat, blink, outfit) {
  const pal = { ...FIXED, ...outfitPal(outfit), C: cap, c: shade(cap, 0.72), h: shade(cap, 1.35) };
  const px = (x, y, w, h, col) => {
    g.fillStyle = col;
    g.fillRect(f > 0 ? X + x : X + 16 - x - w, Y + y, w, h);
  };
  for (let y = 0; y < ART.length; y++) {
    const row = ART[y];
    for (let x = 0; x < row.length; x++) {
      let ch = row[x];
      if (ch === '.') continue;
      if (blink && (ch === 'e' || ch === 'w')) ch = y === 6 ? 's' : 'e';
      px(x, y, 1, 1, pal[ch]);
    }
  }
  if (hat && hat !== 'none') {
    const rs = hatRects(hat);
    for (const [x, y, w, h] of rs) px(x - 1, y - 1, w + 2, h + 2, FIXED.o);
    for (const [x, y, w, h, col] of rs) px(x, y, w, h, col);
  }
}

export { ART, FIXED, drawPortrait, hatRects };
