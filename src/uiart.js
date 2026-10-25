// Pixel art made at start-up: the Flintworks logo and the 9-slice frame for all panels.
const INK = '#24160c';

function px(c, x, y, col) {
  c.fillStyle = col;
  c.fillRect(x, y, 1, 1);
}

// 8×8 frame: dark outline, lit top/left rim, shaded bottom/right rim, gold rivets in the corners.
// The middle stays transparent so the panel background shows through.
function frameUrl() {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 8;
  const c = cv.getContext('2d');
  for (let i = 0; i < 8; i++) {
    px(c, i, 0, INK);
    px(c, i, 7, INK);
    px(c, 0, i, INK);
    px(c, 7, i, INK);
  }
  for (let i = 1; i < 7; i++) {
    px(c, i, 1, '#9a6a3c');
    px(c, 1, i, '#8a5a34');
    px(c, i, 6, '#3a2210');
    px(c, 6, i, '#3a2210');
  }
  for (let i = 2; i < 6; i++) {
    px(c, i, 2, '#5a3a22');
    px(c, 2, i, '#5a3a22');
  }
  for (const [x, y] of [
    [1, 1],
    [6, 1],
    [1, 6],
    [6, 6],
  ]) {
    px(c, x, y, '#f2c230');
    px(c, x + (x < 4 ? 1 : -1), y + (y < 4 ? 1 : -1), '#7a5a10');
  }
  return cv.toDataURL();
}

// The word in the display font, thresholded to crisp pixels, then outlined, shaded and sparkled.
function drawLogo(text, size = 20) {
  const src = document.createElement('canvas'),
    sc = src.getContext('2d', { willReadFrequently: true });
  src.width = 20 * size;
  src.height = Math.round(size * 1.6);
  sc.font = `700 ${size}px "Pixelify Sans", monospace`;
  sc.textBaseline = 'top';
  sc.fillText(text, 0, 2);
  const d = sc.getImageData(0, 0, src.width, src.height);
  const on = (x, y) => x >= 0 && y >= 0 && x < src.width && y < src.height && d.data[(y * src.width + x) * 4 + 3] > 110;
  let x1 = 0,
    y0 = 99,
    y1 = 0;
  for (let y = 0; y < src.height; y++)
    for (let x = 0; x < src.width; x++)
      if (on(x, y)) {
        x1 = Math.max(x1, x);
        y0 = Math.min(y0, y);
        y1 = Math.max(y1, y);
      }
  const w = x1 + 1 + 6,
    h = y1 - y0 + 1 + 6;
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const c = out.getContext('2d');
  const ox = 3,
    oy = 3 - y0;
  // outline and drop shadow first
  for (let y = y0 - 2; y <= y1 + 2; y++)
    for (let x = -2; x <= x1 + 2; x++) {
      let near = false,
        shadow = false;
      for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) if (on(x + i, y + j)) near = true;
      if (!near) shadow = on(x, y - 1) || on(x - 1, y - 1) || on(x, y - 2);
      if (near) px(c, x + ox, y + oy, INK);
      else if (shadow) px(c, x + ox, y + oy, '#4e3018');
    }
  // fill: gold gradient by row, bright rim where the pixel above is empty, darker under-edge
  const rows = y1 - y0 + 1;
  for (let y = y0; y <= y1; y++)
    for (let x = 0; x <= x1; x++) {
      if (!on(x, y)) continue;
      const t = (y - y0) / Math.max(1, rows - 1);
      let col = t < 0.35 ? '#ffe27a' : t < 0.7 ? '#f2c230' : '#d98a1c';
      if (!on(x, y - 1)) col = '#fff3b0';
      else if (!on(x, y + 1)) col = '#a85f10';
      px(c, x + ox, y + oy, col);
    }
  // two little sparks
  for (const [sx, sy] of [
    [x1 + 2, y0 - 1],
    [1, y1 + 1],
  ]) {
    for (const [dx, dy, col] of [
      [0, 0, '#ffffff'],
      [-1, 0, '#ffe27a'],
      [1, 0, '#ffe27a'],
      [0, -1, '#ffe27a'],
      [0, 1, '#ffe27a'],
    ])
      px(c, sx + dx + ox, sy + dy + oy, col);
  }
  return out;
}

function initUiArt() {
  document.documentElement.style.setProperty('--frame', `url(${frameUrl()})`);
  const title = document.getElementById('lbTitle');
  if (!title || !document.fonts) return;
  document.fonts.load('700 20px "Pixelify Sans"').then(() => {
    const cv = drawLogo(title.textContent);
    cv.className = 'lb-logo-art';
    cv.setAttribute('aria-hidden', 'true');
    title.before(cv);
    title.classList.add('sr');
    const fit = () => {
      const s = innerHeight >= 900 ? 3 : 2;
      cv.style.width = cv.width * s + 'px';
      cv.style.height = cv.height * s + 'px';
    };
    fit();
    addEventListener('resize', fit);
  });
}

export { drawLogo, initUiArt };
