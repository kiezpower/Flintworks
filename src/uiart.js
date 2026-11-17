// Art made at start-up: the Flintworks wordmark and the 9-slice frame for the remaining framed panels.
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

// The word in the display font as a painted gold wordmark: dark-brown contour, soft drop
// shadow, a gold gradient with a lit upper edge. Drawn at four times its layout size so it
// stays smooth on dense screens; lw/lh are the layout size callers scale from.
function drawLogo(text, size = 24) {
  const K = 4,
    font = `700 ${size}px "Bree Serif", Georgia, serif`;
  const out = document.createElement('canvas'),
    c = out.getContext('2d');
  c.font = font;
  const pad = Math.ceil(size * 0.28),
    lw = Math.ceil(c.measureText(text).width) + pad * 2,
    lh = Math.ceil(size * 1.25) + pad * 2;
  out.width = lw * K;
  out.height = lh * K;
  out.lw = lw;
  out.lh = lh;
  c.scale(K, K);
  c.font = font;
  c.textBaseline = 'alphabetic';
  c.lineJoin = 'round';
  const x = pad,
    y = pad + size;
  // drop shadow and contour
  c.fillStyle = c.strokeStyle = 'rgba(40,22,10,0.55)';
  c.lineWidth = size * 0.2;
  c.strokeText(text, x, y + size * 0.1);
  c.strokeStyle = INK;
  c.lineWidth = size * 0.2;
  c.strokeText(text, x, y);
  c.strokeStyle = '#6b3f17';
  c.lineWidth = size * 0.09;
  c.strokeText(text, x, y);
  // gold body
  const gold = c.createLinearGradient(0, y - size * 0.8, 0, y + size * 0.15);
  gold.addColorStop(0, '#fff3b0');
  gold.addColorStop(0.35, '#ffd95e');
  gold.addColorStop(0.7, '#f2b52a');
  gold.addColorStop(1, '#c97a16');
  c.fillStyle = gold;
  c.fillText(text, x, y);
  // a lit upper edge: the same letters, clipped to themselves, shifted down
  c.save();
  c.globalCompositeOperation = 'source-atop';
  c.strokeStyle = 'rgba(255,250,214,0.75)';
  c.lineWidth = size * 0.035;
  c.strokeText(text, x, y + size * 0.03);
  c.restore();
  return out;
}

function initUiArt() {
  document.documentElement.style.setProperty('--frame', `url(${frameUrl()})`);
  const title = document.getElementById('lbTitle');
  if (!title || !document.fonts) return;
  document.fonts.load('700 24px "Bree Serif"').then(() => {
    const cv = drawLogo(title.textContent);
    cv.className = 'lb-logo-art';
    cv.setAttribute('aria-hidden', 'true');
    title.before(cv);
    title.classList.add('sr');
    const fit = () => {
      const s = innerHeight >= 900 ? 3 : innerHeight <= 460 ? 1 : 2;
      cv.style.width = cv.lw * s + 'px';
      cv.style.height = cv.lh * s + 'px';
    };
    fit();
    addEventListener('resize', fit);
  });
}

export { drawLogo, initUiArt };
