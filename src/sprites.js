// ---- Sprites ----
function sp(w, h, fn) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  fn((x, y, ww, hh, col) => {
    g.fillStyle = col;
    g.fillRect(x, y, ww, hh);
  }, g);
  return c;
}
const SPR = {
  base: sp(36, 30, R => {
    const stone = '#a69e92',
      stone2 = '#b8b0a4',
      mort = '#80796f';
    R(0, 7, 9, 23, stone);
    R(27, 7, 9, 23, stone);
    for (let x = 0; x < 9; x += 3) {
      R(x, 4, 2, 3, stone);
      R(27 + x, 4, 2, 3, stone);
    }
    R(9, 12, 18, 18, stone2);
    for (let x = 9; x < 27; x += 3) R(x, 9, 2, 3, stone2);
    for (let y = 9; y < 30; y += 3)
      for (let x = y % 2 ? 0 : 2; x < 9; x += 4) {
        R(x, y, 1, 1, mort);
        R(27 + x, y, 1, 1, mort);
      }
    for (let y = 14; y < 30; y += 3) for (let x = 9 + (y % 2 ? 0 : 2); x < 27; x += 4) R(x, y, 1, 1, mort);
    R(13, 18, 10, 12, '#2a1a10');
    R(14, 17, 8, 1, '#2a1a10');
    R(15, 16, 6, 1, '#2a1a10');
    for (let x = 14; x < 22; x += 2) R(x, 17, 1, 13, '#4a3a2a');
    R(3, 12, 3, 4, '#ffd77a');
    R(30, 12, 3, 4, '#ffd77a');
    R(3, 21, 3, 4, '#ffd77a');
    R(30, 21, 3, 4, '#ffd77a');
    R(4, 12, 1, 4, mort);
    R(31, 12, 1, 4, mort);
  }),
  hut: sp(22, 16, R => {
    R(15, 0, 3, 6, '#6f6a64');
    R(15, 0, 3, 1, '#5a554f');
    for (let r = 0; r < 7; r++) {
      const w = Math.min(22, 4 + r * 3),
        x = Math.floor((22 - w) / 2);
      R(x, r, w, 1, r === 6 ? '#6e2c18' : r % 2 ? '#8e3b22' : '#9c4428');
    }
    R(2, 7, 18, 9, '#b9a98f');
    for (let y = 8; y < 16; y += 2)
      for (let x = 2 + (y % 4 ? 0 : 2); x < 20; x += 4) R(x, y, 1, 1, '#9d8d74');
    R(9, 10, 4, 6, '#2a1a10');
    R(10, 9, 2, 1, '#2a1a10');
    R(4, 9, 3, 3, '#ffd77a');
    R(5, 9, 1, 3, '#9d8d74');
    R(15, 9, 3, 3, '#ffd77a');
    R(16, 9, 1, 3, '#9d8d74');
  }),
  shop: sp(26, 17, R => {
    R(19, 0, 3, 6, '#6f6a64');
    R(19, 0, 3, 1, '#5a554f');
    for (let r = 0; r < 6; r++) {
      const w = Math.min(26, 8 + r * 4),
        x = Math.floor((26 - w) / 2);
      R(x, r, w, 1, r === 5 ? '#3c434d' : r % 2 ? '#55606e' : '#606b79');
    }
    for (let x = 1; x < 25; x++) R(x, 6, 1, 11, x % 3 === 0 ? '#6a4526' : x % 2 ? '#8b5e34' : '#7a5230');
    R(3, 9, 7, 8, '#2a1a10');
    R(6, 9, 1, 8, '#3d2817');
    R(15, 9, 6, 3, '#ffb347');
    R(17, 9, 1, 3, '#6a4526');
    R(13, 7, 4, 1, '#9a948c');
    R(14, 6, 2, 1, '#9a948c');
  }),
  lift: sp(16, 22, R => {
    R(0, 3, 16, 2, '#5d3e22');
    R(1, 5, 2, 17, '#7a5230');
    R(13, 5, 2, 17, '#7a5230');
    for (let k = 0; k < 4; k++)
      for (let t = 0; t < 2; t++) {
        R(3 + t, 7 + k * 4 + t, 1, 1, '#6a4526');
        R(12 - t, 7 + k * 4 + t, 1, 1, '#6a4526');
      }
    R(6, 0, 4, 4, '#9a948c');
    R(7, 1, 2, 2, '#4a4540');
  }),
  pump: sp(16, 16, R => {
    R(1, 6, 14, 10, '#7a5230');
    for (let x = 1; x < 15; x += 3) R(x, 6, 1, 10, '#6a4526');
    R(0, 4, 16, 2, '#55606e');
    R(3, 0, 3, 4, '#6f6a64');
    R(6, 9, 4, 4, '#9a948c');
    R(7, 10, 2, 2, '#4a4540');
    R(15, 9, 1, 3, '#9a948c');
  }),
  saw: sp(24, 14, R => {
    for (let r = 0; r < 4; r++) R(r, r, 24 - r * 2, 1, r % 2 ? '#7a5230' : '#8b5e34');
    R(1, 4, 2, 10, '#6a4526');
    R(21, 4, 2, 10, '#6a4526');
    R(3, 11, 18, 3, '#5d3e22');
    R(4, 9, 9, 2, '#a0703f');
    R(4, 9, 1, 2, '#d9b98a');
    for (let y = -3; y <= 3; y++)
      for (let x = -3; x <= 3; x++)
        if (x * x + y * y <= 9) R(16 + x, 8 + y, 1, 1, x * x + y * y >= 6 ? '#c0c6cc' : '#8a929a');
    R(16, 8, 1, 1, '#4a4540');
  }),
  wind: sp(14, 28, R => {
    for (let y = 8; y < 28; y++) {
      const w = 4 + Math.floor((y - 8) / 3);
      R(7 - Math.ceil(w / 2), y, w, 1, y % 3 ? '#b8b0a4' : '#9d958a');
    }
    R(5, 22, 4, 6, '#2a1a10');
    R(5, 4, 4, 4, '#5d3e22');
    R(6, 8, 2, 2, '#ffd77a');
  }),
  furnace: sp(18, 22, R => {
    R(12, 0, 4, 10, '#6f6a64');
    R(12, 0, 4, 1, '#5a554f');
    R(1, 8, 16, 14, '#8a847c');
    for (let y = 9; y < 22; y += 3)
      for (let x = 1 + (y % 2 ? 0 : 2); x < 17; x += 4) R(x, y, 1, 1, '#6f6a64');
    R(0, 7, 18, 2, '#5d5852');
    R(5, 14, 8, 8, '#2a1a10');
    R(6, 15, 6, 7, '#c8501a');
    R(7, 17, 4, 5, '#ff9a3a');
  }),
  chem: sp(22, 18, R => {
    R(0, 4, 22, 2, '#3c4a5a');
    R(1, 6, 20, 12, '#7f93a6');
    for (let x = 1; x < 21; x += 4) R(x, 6, 1, 12, '#6a7d90');
    R(3, 0, 3, 4, '#6f6a64');
    R(13, 0, 6, 6, '#5fb83c');
    R(13, 0, 6, 1, '#8fe066');
    R(14, 6, 1, 1, '#4a4540');
    R(17, 6, 1, 1, '#4a4540');
    R(4, 11, 5, 7, '#2a1a10');
    R(13, 10, 5, 3, '#b6f28f');
    R(15, 10, 1, 3, '#6a7d90');
  }),
  tower: sp(12, 32, R => {
    for (let x = 0; x < 12; x += 3) R(x, 0, 2, 3, '#a69e92');
    R(0, 3, 12, 3, '#a69e92');
    R(0, 5, 12, 1, '#80796f');
    R(1, 6, 10, 26, '#b8b0a4');
    for (let y = 7; y < 32; y += 3)
      for (let x = 1 + (y % 2 ? 0 : 2); x < 11; x += 4) R(x, y, 1, 1, '#80796f');
    R(5, 9, 2, 4, '#2a1a10');
    R(5, 17, 2, 4, '#2a1a10');
    R(4, 26, 4, 6, '#2a1a10');
  }),
  gate: sp(8, 16, R => {
    R(0, 0, 8, 2, '#80796f');
    R(0, 0, 2, 16, '#a69e92');
    R(6, 0, 2, 16, '#a69e92');
    R(2, 2, 4, 14, '#8b5e34');
    R(2, 8, 4, 1, '#9aa4ae');
    R(3, 2, 1, 14, '#7a5230');
  }),
  flag: sp(6, 18, R => {
    R(0, 0, 1, 18, '#4a3a2a');
    R(1, 1, 5, 4, '#c8402c');
    R(1, 3, 5, 1, '#a8302a');
  }),
};
SPR.lorryIcon = sp(12, 8, R => {
  R(0, 1, 12, 4, '#6f6a64');
  R(0, 1, 12, 1, '#8a847c');
  R(1, 5, 3, 2, '#2a2a2a');
  R(8, 5, 3, 2, '#2a2a2a');
  R(2, 0, 6, 1, '#f2c230');
});
SPR.clonkIcon = sp(6, 10, R => {
  R(1, 0, 4, 1, '#c8402c');
  R(0, 1, 5, 1, '#c8402c');
  R(1, 2, 4, 2, '#f0c49a');
  R(4, 2, 1, 1, '#1a120c');
  R(1, 4, 4, 4, '#3f5f9a');
  R(1, 8, 2, 2, '#4a2f1c');
  R(3, 8, 2, 2, '#4a2f1c');
});
const ICOL = {
  rock: '#8a847c',
  flint: '#e0572f',
  nug: '#f2c230',
  wood: '#8b5e34',
  loam: '#b07a45',
  tnt: '#c8302c',
  plank: '#c08a50',
  ore: '#9a5a46',
  coal: '#262222',
  metal: '#b0b8c0',
};
const ITEM = {
  rock: { name: 'Stein', s: [3, 3], val: 2 },
  flint: { name: 'Feuerstein', s: [3, 3], val: 5 },
  nug: { name: 'Gold', s: [3, 2], val: 25 },
  wood: { name: 'Holz', s: [6, 2], val: 4 },
  loam: { name: 'Lehm', s: [4, 3], val: 4 },
  tnt: { name: 'Sprengladung', s: [3, 4], val: 12 },
  plank: { name: 'Brett', s: [6, 2], val: 5 },
  ore: { name: 'Erz', s: [3, 3], val: 6 },
  coal: { name: 'Kohle', s: [3, 3], val: 4 },
  metal: { name: 'Metall', s: [4, 2], val: 15 },
};
function drawItemPx(g, t, x, y, blink) {
  const R = (a, b, w, h, c) => {
    g.fillStyle = c;
    g.fillRect(x + a, y + b, w, h);
  };
  if (t === 'rock') {
    R(0, 0, 3, 3, '#8a847c');
    R(0, 0, 2, 1, '#aaa39a');
    R(2, 2, 1, 1, '#5d5852');
  } else if (t === 'flint') {
    R(0, 0, 3, 3, '#e0572f');
    R(0, 0, 1, 1, '#ff9a6a');
    R(2, 2, 1, 1, '#9b2f16');
  } else if (t === 'nug') {
    R(0, 0, 3, 2, blink ? '#ffe066' : '#f2c230');
    R(0, 0, 1, 1, '#fff2a8');
    R(2, 1, 1, 1, '#b8860b');
  } else if (t === 'wood') {
    R(0, 0, 6, 2, '#8b5e34');
    R(0, 0, 6, 1, '#a0703f');
    R(0, 0, 1, 2, '#d9b98a');
  } else if (t === 'loam') {
    R(0, 0, 4, 3, '#b07a45');
    R(0, 0, 3, 1, '#c99260');
    R(3, 2, 1, 1, '#8a5a32');
  } else if (t === 'tnt') {
    R(0, 1, 3, 3, '#c8302c');
    R(0, 2, 3, 1, '#f4ead2');
    R(1, 0, 1, 1, '#2a1a10');
  } else if (t === 'plank') {
    R(0, 0, 6, 2, '#c08a50');
    R(0, 0, 6, 1, '#d9a46a');
    R(5, 0, 1, 2, '#8b5e34');
  } else if (t === 'ore') {
    R(0, 0, 3, 3, '#7a3e30');
    R(1, 1, 1, 1, '#e08a60');
    R(0, 0, 1, 1, '#a86a52');
  } else if (t === 'coal') {
    R(0, 0, 3, 3, '#262222');
    R(0, 0, 1, 1, '#5a5550');
    R(2, 1, 1, 1, '#3b3735');
  } else if (t === 'metal') {
    R(0, 0, 4, 2, '#8a949e');
    R(0, 0, 4, 1, '#d4dbe2');
    R(3, 1, 1, 1, '#5f6870');
  }
}
const iconCache = {};
function itemIcon(t) {
  if (iconCache[t]) return iconCache[t];
  const c = document.createElement('canvas');
  c.width = 8;
  c.height = 8;
  const g = c.getContext('2d');
  const [w, h] = ITEM[t].s;
  drawItemPx(g, t, Math.floor((8 - w) / 2), Math.floor((8 - h) / 2), false);
  return (iconCache[t] = c);
}
function cactusSprite(stage) {
  const h = 8 + stage * 4,
    w = 9;
  return sp(w, h, R => {
    R(3, 0, 3, h, '#4f8a3c');
    R(4, 0, 1, h, '#6fae4a');
    R(3, 0, 3, 1, '#79b955');
    if (stage > 1) {
      R(0, Math.floor(h * 0.35), 2, Math.floor(h * 0.25), '#4f8a3c');
      R(1, Math.floor(h * 0.55), 2, 2, '#4f8a3c');
    }
    if (stage > 2) {
      R(7, Math.floor(h * 0.2), 2, Math.floor(h * 0.25), '#4f8a3c');
      R(6, Math.floor(h * 0.42), 2, 2, '#4f8a3c');
    }
    if (stage > 3) R(4, 0, 1, 1, '#e86fa0');
  });
}
function treeSprite(type, stage) {
  if (type === 'cactus') return cactusSprite(stage);
  const snowy = type === 'snowpine';
  const pine = type === 'pine' || snowy;
  const h = pine ? 12 + stage * 6 : 11 + stage * 5,
    w = pine ? 5 + stage * 3 : 7 + stage * 3;
  return sp(w, h, R => {
    const tx = Math.floor(w / 2);
    if (pine) {
      R(tx - 1, h - 6, 2, 6, '#6a4526');
      const ch = h - 4;
      for (let r = 0; r < ch; r++) {
        const t = r / ch,
          lw = Math.max(1, Math.round(w * (((r % 5) / 5) * 0.3 + t * 0.7)));
        R(tx - Math.floor(lw / 2), r, lw, 1, r % 5 === 4 ? '#245230' : r % 2 ? '#2f6b3a' : '#3a7d44');
        // snow lies on the upper edge of every branch layer
        if (snowy && r % 5 < 2) R(tx - Math.floor(lw / 2), r, lw, 1, r % 5 ? '#e8eef4' : '#ffffff');
      }
    } else {
      R(tx - 1, h - 8, 3, 8, '#6a4526');
      R(tx - 2, h - 6, 1, 1, '#6a4526');
      R(tx + 2, h - 7, 1, 1, '#6a4526');
      const ch = h - 5,
        cyc = ch / 2,
        rx = w / 2,
        ry = ch / 2;
      for (let y = 0; y < ch; y++)
        for (let x = 0; x < w; x++) {
          const dx = (x + 0.5 - rx) / rx,
            dy = (y + 0.5 - cyc) / ry,
            n = ((x * 7 + y * 13) % 5) * 0.04;
          if (dx * dx + dy * dy + n < 1) {
            const lit = dx + dy < -0.5;
            R(x, y, 1, 1, lit ? '#5daf47' : (x + y) % 3 === 0 ? '#367a2b' : '#4f9a3c');
          }
        }
    }
  });
}

// 12×12 pixel icons for the touch buttons
const PAD_ICONS = {
  dig: R => {
    R(2, 9, 1, 1, '#6a4526');
    R(3, 8, 1, 1, '#8b5e34');
    R(4, 7, 1, 1, '#8b5e34');
    R(5, 6, 1, 1, '#8b5e34');
    R(6, 3, 4, 4, '#c0c6cc');
    R(7, 2, 3, 1, '#e4e8ec');
    R(9, 6, 1, 1, '#8a929a');
  },
  jump: R => {
    R(5, 1, 2, 1, '#f4ead2');
    R(4, 2, 4, 1, '#f4ead2');
    R(3, 3, 6, 1, '#f4ead2');
    R(5, 4, 2, 4, '#f4ead2');
    R(2, 10, 8, 1, '#8b5e34');
  },
  throw: R => {
    R(1, 9, 1, 1, '#ffb08f');
    R(2, 6, 1, 1, '#ffb08f');
    R(4, 4, 1, 1, '#ffb08f');
    R(6, 3, 1, 1, '#ffb08f');
    R(8, 4, 3, 3, '#e0572f');
    R(8, 4, 1, 1, '#ff9a6a');
  },
  act: R => {
    R(2, 2, 6, 3, '#9aa4ae');
    R(2, 2, 6, 1, '#d4dbe2');
    R(5, 5, 2, 6, '#8b5e34');
    R(5, 5, 1, 6, '#a0703f');
  },
};
const padIcon = kind => sp(12, 12, PAD_ICONS[kind]).toDataURL();

export { ICOL, ITEM, SPR, drawItemPx, iconCache, itemIcon, padIcon, sp, treeSprite };
