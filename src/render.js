import { drawGoal } from './tapgo.js';
import { drawClonkHi } from './clonkhi.js';
import { drawBackdrop } from './backdrop.js';
import { hasTool } from './tools.js';
import { drawHazards } from './hazards.js';
import { drawChests } from './treasure.js';
import { drawBuildFx, drawWindowGlow } from './bfx.js';
import { drawBeams, drawBubbles, drawMark } from './mine.js';
import { drawFloats } from './floats.js';
import { drawDecor } from './decor.js';
import { biome } from './biomes.js';
import { drawGemSparkles, drawLavaGlow, drawWaterGlints, scanLava } from './effects.js';
import { drawTutorial } from './tutorial.js';
import { arrows, lvl, terrOK } from './buildings.js';
import { sel_ } from './entities.js';
import { isPlayer } from './players.js';
import { drawEmotes } from './net/emotes.js';
import { TEAM_COLS } from './teams.js';
import { topSolid } from './gen.js';
import { game, joyHome } from './input.js';
import { ICOL, SPR, drawHi, drawItemBig } from './sprites.js';
import { G, animals, birds, builds, clouds, crew, flashes, items, lorries, meteors, parts, trees } from './state.js';
import { darkness, skyCols } from './weather.js';
import { H, W, clamp, flush, rnd, wc } from './world.js';

// ---- Rendering ----
const cv = document.getElementById('cv'),
  ctx = cv.getContext('2d');
const lc = document.createElement('canvas'),
  lctx = lc.getContext('2d');
G.VW = 200;
G.VH = 120;
const cam = { x: 0, y: 0 };
const stars = [...Array(70)].map(() => ({ x: rnd(), y: rnd() * 0.6, b: rnd() }));
G.terrEdges = [];
function calcTerr() {
  const e = [];
  let prev = false;
  for (let x = 0; x < W; x += 2) {
    const ok = terrOK(x);
    if (ok !== prev && x > 0) e.push(ok ? x : x - 2);
    prev = ok;
  }
  G.terrEdges = e;
}
G.zoomAdj = 0;
try {
  G.zoomAdj = +(localStorage.getItem('wuehlwelt-zoom') || 0) || 0;
} catch {}
// canvas pixels per landscape pixel: 2 for the detailed look, 1 on slow devices
G.res = 2;
function resize() {
  const r = game.getBoundingClientRect();
  const s = Math.max(
    2,
    Math.min(8, Math.round(Math.sqrt((r.width * r.height) / (260 * 150))) + G.zoomAdj - (G.towerView ? 2 : 0)),
  );
  G.VW = Math.min(W, Math.ceil(r.width / s));
  G.VH = Math.min(H, Math.ceil(r.height / s));
  // the canvas has twice the landscape resolution; all drawing code keeps landscape units
  cv.width = G.VW * G.res;
  cv.height = G.VH * G.res;
  cv.style.width = G.VW * s + 'px';
  cv.style.height = G.VH * s + 'px';
  lc.width = G.VW;
  lc.height = G.VH;
  ctx.imageSmoothingEnabled = false;
  joyHome();
}
addEventListener('resize', resize);
// Hats from the lobby shop, drawn on top of the cap (pixel offsets relative to the head)
function drawHat(put, hat) {
  if (hat === 'helm' || hat === 'viking') {
    put(1, -1, 4, 1, '#9aa3ad');
    put(0, 0, 6, 2, '#7d8792');
    put(1, 0, 2, 1, '#c9d0d8');
    if (hat === 'viking') {
      put(-1, -2, 1, 2, '#f3ead8');
      put(6, -2, 1, 2, '#f3ead8');
    } else put(5, 0, 1, 1, '#ffe27a');
  } else if (hat === 'cowboy') {
    put(1, -2, 4, 2, '#8a5a2e');
    put(1, -1, 4, 1, '#5a3418');
    put(-1, 0, 8, 1, '#a06a38');
  } else if (hat === 'wizard') {
    put(2, -4, 1, 1, '#6a3fb0');
    put(2, -3, 2, 1, '#6a3fb0');
    put(1, -2, 3, 1, '#6a3fb0');
    put(1, -1, 4, 1, '#7d4fc8');
    put(0, 0, 6, 1, '#5a3296');
    put(3, -2, 1, 1, '#ffe27a');
  } else if (hat === 'crown') {
    put(1, -2, 1, 1, '#ffd84a');
    put(3, -2, 1, 1, '#ffd84a');
    put(5, -2, 1, 1, '#ffd84a');
    put(1, -1, 5, 2, '#f2b51e');
    put(3, -1, 1, 1, '#e8394a');
  } else if (hat === 'flower') {
    put(3, -1, 1, 1, '#ff7eb6');
    put(2, -2, 3, 1, '#ff7eb6');
    put(3, -2, 1, 1, '#ffe27a');
  }
}
// colour helpers for sprite shading, cached per input colour
const shadeCache = {};
function shade(hex, k) {
  const key = hex + k;
  if (shadeCache[key]) return shadeCache[key];
  const n = parseInt(hex.slice(1), 16);
  const ch = s => Math.max(0, Math.min(255, Math.round(((n >> s) & 255) * k)));
  return (shadeCache[key] = `rgb(${ch(16)},${ch(8)},${ch(0)})`);
}
// Animals: shaded pixel sprites with the same dark outline as the Wühler
function drawAnimal(a, sx, sy) {
  const f = a.face || 1,
    hurtF = a.hurt > 0 && a.hurt & 2;
  const ph = Math.sin(a.anim) > 0;
  const glow = a.kind === 'monster' && Math.sin(G.frame * 0.15) > 0;
  const key = `${a.kind}${ph}${hurtF}${glow}`;
  let spr = animalCache[key];
  if (!spr) {
    spr = animalCache[key] = animalSprite(a, ph, hurtF, glow);
  }
  if (f > 0) drawHi(ctx, spr, sx - 2, sy - 2);
  else {
    ctx.save();
    ctx.translate(sx - 2 + spr.width, 0);
    ctx.scale(-1, 1);
    drawHi(ctx, spr, 0, sy - 2);
    ctx.restore();
  }
}
// animal frames are painted once into small canvases (2px margin) and drawn smoothed at 2×
const animalCache = {};
function animalSprite(a, ph, hurtF, glowOn) {
  const c = document.createElement('canvas');
  c.width = a.w + 4;
  c.height = a.h + 4;
  const g = c.getContext('2d');
  const put = (x, y, w, h, col) => {
    g.fillStyle = hurtF ? '#ff6a5a' : col;
    g.fillRect(2 + x, 2 + y, w, h);
  };
  if (a.kind === 'bat') {
    const up = ph;
    put(2, 0, 1, 1, '#2a2235');
    put(1, 1, 3, 2, '#3a2f45');
    put(-1, up ? -1 : 2, 3, 1, '#4a3d58');
    put(3, up ? -1 : 2, 3, 1, '#4a3d58');
    put(0, up ? 0 : 1, 1, 1, '#3a2f45');
    put(4, up ? 0 : 1, 1, 1, '#3a2f45');
    put(3, 1, 1, 1, '#ff5050');
  } else if (a.kind === 'wipf') {
    // fluffy Wipf with a ginger stripe, pointy ear and bushy tail
    put(0, 1, 5, 2, '#f2e6d0');
    put(1, 0, 3, 1, '#fbf4e6');
    put(4, 0, 2, 2, '#f6ecd8');
    put(4, -1, 1, 1, '#d08a5a');
    put(1, 1, 2, 1, '#d08a5a');
    put(1, 2, 3, 1, '#e2d2b6');
    put(5, 0, 1, 1, '#1a120c');
    put(6, 1, 1, 1, '#e88a8a');
    put(-1, ph ? 0 : 1, 1, 2, '#d08a5a');
    put(ph ? 0 : 1, 3, 1, 1, '#b8a68c');
    put(ph ? 3 : 4, 3, 1, 1, '#b8a68c');
  } else if (a.kind === 'fish') {
    put(1, 0, 3, 2, '#e8a83c');
    put(1, 1, 3, 1, '#f6cf7a');
    put(2, -1, 1, 1, '#c47f22');
    put(-1, ph ? -1 : 0, 2, 1, '#c47f22');
    put(-1, ph ? 1 : 2, 1, 1, '#c47f22');
    put(3, 0, 1, 1, '#1a120c');
  } else {
    // cave monster: hunched back with spikes, glowing eye, teeth
    put(1, 2, 10, 6, '#3d3a6b');
    put(2, 1, 7, 1, '#3d3a6b');
    put(2, 6, 7, 2, '#5a56a0');
    put(1, 2, 2, 5, '#2e2b55');
    for (let k = 0; k < 4; k++) put(2 + k * 2, 0, 1, 1, '#2a2850');
    put(8, 3, 3, 2, '#f4ead2');
    put(10, 3, 1, 1, glowOn ? '#ff3a2a' : '#c8302c');
    put(7, 7, 4, 1, '#f4ead2');
    put(8, 7, 1, 1, '#3d3a6b');
    put(10, 7, 1, 1, '#3d3a6b');
    put(ph ? 2 : 3, 8, 2, 1, '#2a2850');
    put(ph ? 7 : 6, 8, 2, 1, '#2a2850');
  }
  return c;
}

function nameTag(text, x, y, col) {
  ctx.font = '5px monospace';
  const w = Math.ceil(ctx.measureText(text).width) + 3;
  ctx.fillStyle = 'rgba(36,22,12,0.75)';
  ctx.fillRect(Math.round(x - w / 2), y - 6, w, 6);
  ctx.fillStyle = col;
  ctx.fillRect(Math.round(x - w / 2), y - 6, 1, 6);
  ctx.fillStyle = '#fbf3dc';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(text, x + 0.5, y - 1.5);
}
function render() {
  flush();
  ctx.setTransform(G.res, 0, 0, G.res, 0, 0);
  ctx.imageSmoothingEnabled = false;
  const s = sel_() || crew[0];
  const mine = sel_();
  const fx = s ? s.x + 3 : W / 2,
    fy = s ? s.y + 5 : H / 2;
  const tx = clamp(fx - G.VW / 2, 0, W - G.VW),
    ty = clamp(fy - G.VH / 2, 0, H - G.VH);
  cam.x += (tx - cam.x) * 0.12;
  cam.y += (ty - cam.y) * 0.12;
  const sh = G.shake ? (rnd() - 0.5) * G.shake : 0;
  G.shake *= 0.85;
  if (G.shake < 0.3) G.shake = 0;
  const cx = clamp(Math.round(cam.x + sh), 0, W - G.VW),
    cy = clamp(Math.round(cam.y + sh * 0.6), 0, H - G.VH);
  const dark = darkness(),
    [st, sb] = skyCols();
  const g = ctx.createLinearGradient(0, -cy, 0, 170 - cy);
  g.addColorStop(0, st);
  g.addColorStop(1, sb);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, G.VW, G.VH);
  if (dark > 0.25) {
    ctx.fillStyle = `rgba(255,255,240,${(dark - 0.25) * 1.6})`;
    for (const st of stars) {
      if ((G.frame + st.b * 100) % 90 < 3 && st.b > 0.8) continue;
      ctx.fillRect(Math.floor(st.x * G.VW), Math.floor(st.y * 120 - cy * 0.2), 1, 1);
    }
  }
  // sun & moon
  {
    const ang = 2 * Math.PI * G.dayT,
      sx = G.VW / 2 + Math.cos(Math.PI - ang) * G.VW * 0.45,
      syy = 95 - Math.sin(ang) * 80 - cy * 0.3;
    if (Math.sin(ang) > -0.1) {
      ctx.fillStyle = '#fff3c4';
      ctx.fillRect(Math.round(sx) - 3, Math.round(syy) - 3, 7, 7);
      ctx.fillRect(Math.round(sx) - 4, Math.round(syy) - 2, 9, 5);
      ctx.fillRect(Math.round(sx) - 2, Math.round(syy) - 4, 5, 9);
    }
    const mx = G.VW / 2 + Math.cos(-ang) * G.VW * 0.45,
      my = 95 + Math.sin(ang) * 80 - cy * 0.3;
    if (Math.sin(ang) < 0.1) {
      ctx.fillStyle = '#e8ecf4';
      ctx.fillRect(Math.round(mx) - 2, Math.round(my) - 3, 5, 7);
      ctx.fillRect(Math.round(mx) - 3, Math.round(my) - 2, 7, 5);
      ctx.fillStyle = st;
      ctx.fillRect(Math.round(mx), Math.round(my) - 2, 3, 4);
    }
  }
  ctx.globalAlpha = G.rainT > 0 ? 0.95 : 0.9;
  for (const c of clouds) {
    const x = Math.round(c.x - cx * 0.7),
      y = c.y - Math.round(cy * 0.7);
    if (x > -c.w && x < G.VW) ctx.drawImage(c.spr, x, y);
  }
  ctx.globalAlpha = 1;
  if (G.rainT > 0) {
    ctx.fillStyle = 'rgba(80,90,100,.18)';
    ctx.fillRect(0, 0, G.VW, G.VH);
  }
  drawBackdrop(ctx, cx, cy);
  for (const b of birds) {
    const x = Math.round(b.x - cx * 0.9),
      y = Math.round(b.y - cy * 0.9);
    if (x < -3 || x > G.VW) continue;
    ctx.fillStyle = dark > 0.3 ? '#8890a8' : '#2a2a35';
    const up = Math.sin(b.ph) > 0;
    ctx.fillRect(x, y, 1, 1);
    ctx.fillRect(x - 1, up ? y - 1 : y + 1, 1, 1);
    ctx.fillRect(x + 1, up ? y - 1 : y + 1, 1, 1);
  }
  ctx.drawImage(wc, cx * 2, cy * 2, G.VW * 2, G.VH * 2, 0, 0, G.VW, G.VH);
  drawDecor(ctx, cx, cy);
  drawBeams(ctx, cx, cy);
  drawMark(ctx, cx, cy);
  const lava = scanLava(cx, cy);
  drawLavaGlow(ctx);
  drawWaterGlints(ctx);
  drawGemSparkles(ctx);
  // pump pipes
  for (const b of builds)
    if (b.type === 'pump' && b.done && b.pipe) {
      ctx.fillStyle = '#6f6a64';
      ctx.fillRect(b.x + 7 - cx, b.gy - cy, 2, b.pipe);
    }
  // buildings
  for (const b of builds) {
    const sx = b.x - cx,
      sy = b.gy - b.h - cy,
      spr = SPR[b.type];
    if (sx < G.VW && sx + b.w > 0 && sy < G.VH + 40 && sy + b.h > -20) {
      if (b.done && b.type !== 'flag' && b.type !== 'gate') drawHi(ctx, spr, sx, sy);
      else {
        const vh = Math.ceil(b.h * b.prog);
        ctx.globalAlpha = 0.3;
        ctx.drawImage(spr, sx, sy);
        ctx.globalAlpha = 1;
        if (vh > 0) ctx.drawImage(spr, 0, b.h - vh, b.w, vh, sx, sy + b.h - vh, b.w, vh);
        ctx.fillStyle = '#a8743f';
        ctx.fillRect(sx, sy, 1, b.h);
        ctx.fillRect(sx + b.w - 1, sy, 1, b.h);
        for (let yy = sy + b.h - 1; yy >= sy; yy -= 5) ctx.fillRect(sx, yy, b.w, 1);
      }
      drawBuildFx(ctx, b, sx, sy);
      if (b.type === 'base') {
        // (Versus: the team colour)
        drawFlag(sx + 4, sy - 10, 14, 7, TEAM_COLS[b.team || 0]);
      }
      if (b.type === 'shop' && b.busy) {
        ctx.fillStyle = (G.frame >> 3) & 1 ? '#ffe066' : '#ff9a3a';
        ctx.fillRect(sx + 15, sy + 9, 6, 3);
      }
      if (b.type === 'base' && lvl() >= 2) {
        for (const tx0 of [sx, sx + 27])
          for (let r = 0; r < 6; r++) {
            const w = 1 + r * 2 - (r > 3 ? 1 : 0);
            ctx.fillStyle = r % 2 ? '#2f5f9a' : '#3f6fb4';
            ctx.fillRect(tx0 + 4 - Math.floor(w / 2), sy - 2 + r - 4, w, 1);
          }
        if (lvl() >= 3) {
          ctx.fillStyle = '#f2c230';
          ctx.fillRect(sx + 4, sy - 7, 1, 2);
          ctx.fillRect(sx + 31, sy - 7, 1, 2);
          ctx.fillRect(sx + 16, sy + 7, 4, 2);
        }
      }
      if (b.done && b.type === 'wind') {
        const hx = sx + 7,
          hy = sy + 6;
        for (let k = 0; k < 4; k++) {
          const a = b.rot + (k * Math.PI) / 2,
            ca = Math.cos(a),
            sa = Math.sin(a);
          for (let r = 2; r <= 11; r++) {
            ctx.fillStyle = '#e8dcc6';
            ctx.fillRect(Math.round(hx + ca * r), Math.round(hy + sa * r), 1, 1);
            if (r > 4) {
              ctx.fillStyle = '#cdbb9a';
              ctx.fillRect(Math.round(hx + ca * r - sa * 1.4), Math.round(hy + sa * r + ca * 1.4), 1, 1);
            }
          }
        }
        ctx.fillStyle = '#4a3a2a';
        ctx.fillRect(hx - 1, hy - 1, 2, 2);
      }
      if (b.done && b.type === 'gate') {
        const o = Math.round((b.open || 0) * 12);
        ctx.drawImage(spr, 0, 0, 8, 2, sx, sy, 8, 2);
        ctx.fillStyle = '#4a3a2a';
        ctx.fillRect(sx + 2, sy + 2, 4, 14);
        ctx.drawImage(SPR.gate, 2, 2, 4, 14 - o, sx + 2, sy + 2, 4, 14 - o);
        ctx.fillStyle = '#a69e92';
        ctx.fillRect(sx, sy, 2, 16);
        ctx.fillRect(sx + 6, sy, 2, 16);
      }
      if (b.done && b.type === 'flag') {
        drawFlag(sx, sy, 18, 6);
      }
      if (b.done && b.type === 'furnace' && b.busy) {
        ctx.fillStyle = (G.frame >> 2) & 1 ? '#ffcf4a' : '#ff7a2a';
        ctx.fillRect(sx + 6, sy + 15, 6, 7);
      }
    }
    if (b.cs && b.done) {
      const c = b.cs,
        kx = c.x - cx,
        ky = Math.floor(c.y) - cy,
        top = b.gy - b.h + 3 - cy;
      ctx.fillStyle = '#3a2a1a';
      ctx.fillRect(b.x + 8 - cx, top, 1, Math.max(0, ky - 7 - top));
      if (b.moving && (G.frame >> 2) & 1) {
        ctx.fillStyle = '#e8e2d6';
        ctx.fillRect(b.x + 7 - cx, b.gy - b.h + 1 - cy, 1, 1);
      }
      ctx.fillStyle = '#5d3e22';
      ctx.fillRect(kx, ky - 7, 12, 1);
      ctx.fillRect(kx, ky - 7, 1, 7);
      ctx.fillRect(kx + 11, ky - 7, 1, 7);
      ctx.fillStyle = '#8b5e34';
      ctx.fillRect(kx, ky, 12, 1);
      ctx.fillStyle = '#5d3e22';
      ctx.fillRect(kx, ky + 1, 12, 1);
    }
  }
  // territory border posts
  for (const bx of G.terrEdges) {
    const x = bx - cx;
    if (x < -2 || x > G.VW) continue;
    const y = topSolid(bx) - cy;
    ctx.fillStyle = '#4a3a2a';
    ctx.fillRect(x, y - 7, 1, 7);
    ctx.fillStyle = (G.frame >> 4) & 1 ? '#c8402c' : '#d8553c';
    ctx.fillRect(x + 1, y - 7, 3, 2);
  }
  // trees
  for (const t of trees) {
    const w = t.spr.width,
      h = t.spr.height,
      sx = t.x - cx,
      sy = t.gy - cy;
    if (sx + h < 0 || sx - h > G.VW || sy < 0 || sy - h > G.VH) continue;
    if (!t.fall) {
      // trees sway gently with the wind
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(Math.sin(G.frame * 0.025 + t.x * 0.13) * 0.025 * (0.4 + G.wind));
      drawHi(ctx, t.spr, -Math.floor(w / 2), -h);
      if (t.char) {
        ctx.globalAlpha = clamp(1 - t.burn / 700, 0, 1);
        ctx.drawImage(t.char, -Math.floor(w / 2), -h);
        ctx.globalAlpha = 1;
      }
      ctx.restore();
    } else {
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(t.ang);
      drawHi(ctx, t.spr, -Math.floor(w / 2), -h);
      ctx.restore();
    }
  }
  // lorries
  for (const L of lorries) {
    const x = Math.floor(L.x - cx),
      y = Math.floor(L.y - cy);
    if (x < -14 || x > G.VW || y < -10 || y > G.VH) continue;
    ctx.fillStyle = '#6f6a64';
    ctx.fillRect(x, y + 1, 12, 4);
    ctx.fillStyle = '#8a847c';
    ctx.fillRect(x, y + 1, 12, 1);
    ctx.fillStyle = '#4a4540';
    ctx.fillRect(x + 1, y + 2, 1, 3);
    ctx.fillRect(x + 10, y + 2, 1, 3);
    if (L.items.length) {
      ctx.fillStyle = '#f2c230';
      for (let k = 0; k < Math.min(5, Math.ceil(L.items.length / 5)); k++) ctx.fillRect(x + 2 + k * 2, y, 2, 1);
    }
    const wr = Math.floor(L.x / 2) & 1;
    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(x + 1, y + 5, 3, 2);
    ctx.fillRect(x + 8, y + 5, 3, 2);
    ctx.fillStyle = '#9a948c';
    ctx.fillRect(x + 2 + wr, y + 5, 1, 1);
    ctx.fillRect(x + 9 + wr, y + 5, 1, 1);
  }
  drawChests(ctx, cx, cy);
  drawHazards(ctx, cx, cy);
  // items
  for (const it of items) {
    const x = Math.floor(it.x - cx),
      y = Math.floor(it.y - cy);
    if (x < -6 || y < -6 || x > G.VW || y > G.VH) continue;
    const shine = (it.t === 'nug' || it.t === 'gem') && (G.frame + it.x * 13) % 90 < 6;
    drawItemBig(ctx, it.t, x, y, it.w, it.h, shine);
    if (it.fuse > 0 && (G.frame >> 2) & 1) {
      ctx.fillStyle = '#ffe066';
      ctx.fillRect(x + 1, y - 1, 1, 1);
    }
  }
  for (const a of arrows) {
    const x = Math.floor(a.x - cx),
      y = Math.floor(a.y - cy),
      d = Math.hypot(a.vx, a.vy) || 1;
    ctx.fillStyle = '#d9b98a';
    ctx.fillRect(x, y, 1, 1);
    ctx.fillRect(Math.round(x - (a.vx / d) * 2), Math.round(y - (a.vy / d) * 2), 1, 1);
    ctx.fillStyle = '#4a4540';
    ctx.fillRect(Math.round(x + a.vx / d), Math.round(y + a.vy / d), 1, 1);
  }
  for (const m of meteors) {
    const x = Math.floor(m.x - cx),
      y = Math.floor(m.y - cy);
    ctx.fillStyle = '#ffe9a0';
    ctx.fillRect(x - 1, y - 1, 3, 3);
    ctx.fillStyle = '#ff7a2f';
    ctx.fillRect(x - 2, y - 2, 2, 2);
  }
  for (const a of animals) {
    const x = Math.floor(a.x - cx),
      y = Math.floor(a.y - cy);
    if (x < -14 || x > G.VW || y < -10 || y > G.VH) continue;
    drawAnimal(a, x, y);
  }
  // crew
  crew.forEach((c, n) => {
    const x = Math.floor(c.x - cx),
      y = Math.floor(c.y - cy);
    if (x < -10 || x > G.VW + 4 || y < -12 || y > G.VH) return;
    if (c.dead) {
      if (c.deadT > 600) return;
      ctx.globalAlpha = clamp(1 - (c.deadT - 400) / 200, 0, 1);
      ctx.save();
      ctx.translate(x + 3, y + 8);
      ctx.rotate((Math.PI / 2) * c.face);
      drawClonkHi(c, -3, -5, c.face, ctx);
      ctx.restore();
      ctx.globalAlpha = 1;
      return;
    }
    if (c.tumble) {
      ctx.save();
      ctx.translate(x + 3, y + 5);
      ctx.rotate(c.rot);
      drawClonkHi(c, -3, -5, c.face, ctx);
      ctx.restore();
    } else drawClonkHi(c, x, y, c.face, ctx);
    // other players carry their name over the head
    if (G.net && isPlayer(c) && c !== mine) nameTag(c.name, x + 3, y - (c.bub ? 15 : 4), c.cap);
    if (c === mine && (G.frame >> 4) % 3) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x + 2, y - 4, 3, 1);
      ctx.fillRect(x + 3, y - 3, 1, 1);
    }
  });
  for (const p of parts) {
    const x = Math.floor(p.x - cx),
      y = Math.floor(p.y - cy);
    if (x < 0 || y < 0 || x >= G.VW || y >= G.VH) continue;
    ctx.fillStyle = p.c;
    ctx.fillRect(x, y, p.s || 1, p.rain ? 2 : p.s || 1);
  }
  for (const f of flashes) {
    ctx.fillStyle = `rgba(255,${180 + f.l * 10},90,${f.l / 8})`;
    ctx.beginPath();
    ctx.arc(f.x - cx, f.y - cy, f.r * (1.2 - f.l / 14), 0, 7);
    ctx.fill();
  }
  if (G.bolt) {
    ctx.fillStyle = `rgba(255,255,255,${G.bolt.l / 40})`;
    ctx.fillRect(0, 0, G.VW, G.VH);
    ctx.strokeStyle = '#fffbe0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    G.bolt.pts.forEach(([x, y], k) => (k ? ctx.lineTo(x - cx + 0.5, y - cy) : ctx.moveTo(x - cx + 0.5, y - cy)));
    ctx.stroke();
    if (--G.bolt.l <= 0) G.bolt = null;
  }
  // night lighting
  if (dark > 0.02) {
    lctx.globalCompositeOperation = 'source-over';
    lctx.clearRect(0, 0, G.VW, G.VH);
    lctx.fillStyle = `rgba(6,10,30,${dark})`;
    lctx.fillRect(0, 0, G.VW, G.VH);
    lctx.globalCompositeOperation = 'destination-out';
    const light = (x, y, r, a = 1) => {
      if (x < -r || x > G.VW + r || y < -r || y > G.VH + r) return;
      const gg = lctx.createRadialGradient(x, y, 0, x, y, r);
      gg.addColorStop(0, `rgba(0,0,0,${a})`);
      gg.addColorStop(1, 'rgba(0,0,0,0)');
      lctx.fillStyle = gg;
      lctx.fillRect(x - r, y - r, r * 2, r * 2);
    };
    crew.forEach((c, n) => {
      if (!c.dead)
        light(
          c.x + 3 - cx,
          c.y + 4 - cy,
          (isPlayer(c) ? 44 : 22) * (c.hat === 'helm' ? 1.5 : 1) * (hasTool('lamp') ? 1.4 : 1),
          isPlayer(c) ? 0.95 : 0.7,
        );
    });
    for (const b of builds)
      if (b.done) light(b.x + b.w / 2 - cx, b.gy - b.h / 2 - cy, b.type === 'base' ? 40 : 24, 0.8);
    for (const f of flashes) light(f.x - cx, f.y - cy, 70, 1);
    for (const m of meteors) light(m.x - cx, m.y - cy, 30, 0.9);
    if (G.bolt) light(G.VW / 2, G.VH / 2, G.VW, Math.min(1, G.bolt.l / 6));
    for (const it of items) if (it.fuse > 0) light(it.x - cx, it.y - cy, 10, 0.6);
    for (const t of trees) if (t.burn > 0) light(t.x - cx, t.gy - t.spr.height / 2 - cy, 36, 0.9);
    for (const c of crew) if (c.burn > 0) light(c.x + 3 - cx, c.y + 4 - cy, 24, 0.9);
    for (let k = 0; k < lava.length; k += 8) light(lava[k], lava[k + 1], 16, 0.7);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(lc, 0, 0);
    ctx.imageSmoothingEnabled = false;
    drawWindowGlow(ctx, cx, cy, dark);
  }
  drawGoal(ctx, cx, cy);
  drawBubbles(ctx, cx, cy);
  drawEmotes(ctx, cx, cy);
  drawFloats(ctx, cx, cy);
  drawTutorial(ctx, cx, cy);
}
function drawFlag(x, y, pole, len, col = '#c8402c') {
  ctx.fillStyle = '#4a3a2a';
  ctx.fillRect(x, y, 1, pole);
  for (let k = 0; k < len; k++) {
    const o = Math.round(Math.sin(G.frame * 0.12 + k * 0.8));
    ctx.fillStyle = k % 2 ? col : shade(col, 1.12);
    ctx.fillRect(x + 1 + k, y + 1 + o, 1, 4);
  }
}

export { calcTerr, cam, ctx, cv, drawAnimal, drawHat, shade, drawFlag, lc, lctx, render, resize, stars };
