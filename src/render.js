import { drawGoal } from './tapgo.js';
import { buildSprite } from './skins.js';
import { drawClonkHi } from './clonkhi.js';
import { drawArrow, drawGear } from './combat.js';
import { drawEvents } from './events.js';
import { drawBackdrop } from './backdrop.js';
import { hasTool } from './tools.js';
import { drawHazards } from './hazards.js';
import { drawChests } from './treasure.js';
import { drawCastleHp, drawHill } from './versus.js';
import { drawCoop } from './coop.js';
import { drawBuildFx, drawWindowGlow } from './bfx.js';
import { drawBeams, drawBubbles, drawMark } from './mine.js';
import { drawFloats } from './floats.js';
import { drawDecor } from './decor.js';
import { biome } from './biomes.js';
import {
  beginGlow,
  lightHole,
  depthAt,
  depthShade,
  drawVignette,
  duskGrade,
  endGlow,
  skyGlow,
  warmGlow,
} from './light.js';
import {
  drawFireflies,
  drawGemSparkles,
  drawLavaGlow,
  drawPart,
  drawWaterGlints,
  flicker,
  oreSpots,
  pixelDisc,
  scanLava,
} from './effects.js';
import { drawBolt, drawRainFar, drawRainHaze, drawRainNear, drawRoofWeather, drawWet } from './rainfx.js';
import { drawTutorial } from './tutorial.js';
import { arrows, lvl, terrOK } from './buildings.js';
import { sel_ } from './entities.js';
import { isPlayer } from './players.js';
import { drawEmotes } from './net/emotes.js';
import { TEAM_COLS } from './teams.js';
import { box, drawVehicles, wheel } from './vehicles/core.js';
import { drawRails } from './vehicles/rails.js';
import { topSolid } from './gen.js';
import { game, joyHome } from './input.js';
import { ICOL, SPR, drawDetailed, drawHi, drawItemBig } from './sprites.js';
import { G, animals, birds, builds, clouds, crew, flashes, items, lorries, meteors, parts, trees } from './state.js';
import { darkness, skyCols, sunAlt } from './weather.js';
import { H, W, clamp, drawWorld, flush, onResize, rnd } from './world.js';

// ---- Rendering ----
const cv = document.getElementById('cv'),
  ctx = cv.getContext('2d');
const lc = document.createElement('canvas'),
  lctx = lc.getContext('2d');
G.VW = 200;
G.VH = 120;
const cam = { x: 0, y: 0, lx: 0, ly: 0 };
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
// the view can be no bigger than the world
onResize(() => resize());
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
// a building site: the outline of the finished building, the walls rising from the ground and a
// wooden scaffold that grows with them
function drawSite(ctx, b, spr, sx, sy) {
  const vh = Math.ceil(b.h * b.prog),
    top = sy + b.h - vh;
  ctx.globalAlpha = 0.22;
  drawDetailed(ctx, spr, sx, sy);
  ctx.globalAlpha = 1;
  if (vh > 0) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(sx - 1, top, b.w + 2, vh + 1);
    ctx.clip();
    drawDetailed(ctx, spr, sx, sy);
    ctx.restore();
  }
  // posts on both sides, a little above the walls, with planks every five pixels
  const st = Math.max(sy, top - 3);
  for (const px of [sx - 1, sx + b.w]) {
    ctx.fillStyle = '#24160c';
    ctx.fillRect(px - 0.5, st - 0.5, 1.5, sy + b.h - st + 0.5);
    ctx.fillStyle = '#a8743f';
    ctx.fillRect(px, st, 0.5, sy + b.h - st);
  }
  for (let yy = sy + b.h - 4; yy >= st; yy -= 5) {
    ctx.fillStyle = '#24160c';
    ctx.fillRect(sx - 1.5, yy - 0.5, b.w + 3, 1.5);
    ctx.fillStyle = '#c08a50';
    ctx.fillRect(sx - 1, yy, b.w + 2, 0.5);
  }
  // a diagonal brace across the lower part
  ctx.fillStyle = '#8b5e34';
  const bh = Math.min(vh, 10);
  for (let k = 0; k < bh; k++) ctx.fillRect(sx + (k / bh) * Math.min(b.w, 10), sy + b.h - 1 - k, 0.5, 0.5);
}
// moving parts of working buildings: the saw blade, the lift wheel, the pump wheel
function drawMoving(ctx, b, sx, sy) {
  const spin = (cx, cy, r, a, col) => {
    ctx.fillStyle = col;
    for (let k = 0; k < 4; k++) {
      const t = a + (k * Math.PI) / 2;
      for (let q = 1; q <= r; q++)
        ctx.fillRect(Math.round((cx + Math.cos(t) * q * 0.5) * 2) / 2, Math.round((cy + Math.sin(t) * q * 0.5) * 2) / 2, 0.5, 0.5);
    }
  };
  if (b.type === 'saw' && b.busy > 0) spin(sx + 16.25, sy + 8.25, 5, G.frame * 0.45, '#eef1f4');
  if (b.type === 'lift') spin(sx + 8, sy + 2, 3, (b.cs ? b.cs.y : 0) * 0.6, '#c0c6cc');
  if (b.type === 'pump' && b.on) spin(sx + 8, sy + 11, 3, G.frame * 0.2, '#c0c6cc');
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
  // look a little ahead in the walking direction and down while falling
  const lx = s ? clamp(s.vx * 9, -14, 14) : 0,
    ly = s ? clamp(s.vy, 0, 4.5) * 4 : 0;
  cam.lx += (lx - cam.lx) * 0.04;
  cam.ly += (ly - cam.ly) * 0.08;
  cam.x += (clamp(tx + cam.lx, 0, W - G.VW) - cam.x) * 0.12;
  cam.y += (clamp(ty + cam.ly, 0, H - G.VH) - cam.y) * 0.12;
  const sh = G.shake ? (rnd() - 0.5) * G.shake : 0;
  G.shake *= 0.85;
  if (G.shake < 0.3) G.shake = 0;
  const cx = clamp(Math.round(cam.x + sh), 0, W - G.VW),
    cy = clamp(Math.round(cam.y + sh * 0.6), 0, H - G.VH);
  const dark = darkness(),
    [st, sb] = skyCols();
  // sky, sun, clouds, birds and hills are made for ground around row 120; in a world with its
  // ground lower down they move down with it (scy is the camera as the sky sees it)
  const scy = cy - (Math.round(H * 0.3) - 120);
  const g = ctx.createLinearGradient(0, -scy, 0, 170 - scy);
  g.addColorStop(0, st);
  g.addColorStop(1, sb);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, G.VW, G.VH);
  if (dark > 0.25) {
    ctx.fillStyle = `rgba(255,255,240,${(dark - 0.25) * 1.6})`;
    for (const st of stars) {
      if ((G.frame + st.b * 100) % 90 < 3 && st.b > 0.8) continue;
      ctx.fillRect(Math.floor(st.x * G.VW), Math.floor(st.y * 120 - scy * 0.2), 1, 1);
    }
  }
  // sun & moon
  {
    const ang = 2 * Math.PI * G.dayT,
      sx = G.VW / 2 + Math.cos(Math.PI - ang) * G.VW * 0.45,
      syy = 95 - Math.sin(ang) * 80 - scy * 0.3;
    if (Math.sin(ang) > -0.1) {
      ctx.fillStyle = '#fff3c4';
      ctx.fillRect(Math.round(sx) - 3, Math.round(syy) - 3, 7, 7);
      ctx.fillRect(Math.round(sx) - 4, Math.round(syy) - 2, 9, 5);
      ctx.fillRect(Math.round(sx) - 2, Math.round(syy) - 4, 5, 9);
      if (G.lightFx) skyGlow(ctx, sx, syy, 'sun', 0.7 * Math.min(1, Math.sin(ang) + 0.2));
    }
    const mx = G.VW / 2 + Math.cos(-ang) * G.VW * 0.45,
      my = 95 + Math.sin(ang) * 80 - scy * 0.3;
    if (Math.sin(ang) < 0.1) {
      ctx.fillStyle = '#e8ecf4';
      ctx.fillRect(Math.round(mx) - 2, Math.round(my) - 3, 5, 7);
      ctx.fillRect(Math.round(mx) - 3, Math.round(my) - 2, 7, 5);
      ctx.fillStyle = st;
      ctx.fillRect(Math.round(mx), Math.round(my) - 2, 3, 4);
      if (G.lightFx) skyGlow(ctx, mx, my, 'moon', 0.5);
    }
  }
  ctx.globalAlpha = G.rainT > 0 ? 0.95 : 0.9;
  for (const c of clouds) {
    const x = Math.round(c.x - cx * 0.7),
      y = c.y - Math.round(scy * 0.7);
    if (x > -c.w && x < G.VW) ctx.drawImage(c.spr, x, y);
  }
  ctx.globalAlpha = 1;
  if (G.rainT > 0) {
    // cold haze in hard bands, and the far layer of rain behind the hills
    drawRainHaze(ctx);
    if (G.biome !== 'winter') drawRainFar(ctx);
  }
  drawBackdrop(ctx, cx, scy);
  for (const b of birds) {
    const x = Math.round(b.x - cx * 0.9),
      y = Math.round(b.y - scy * 0.9);
    if (x < -3 || x > G.VW) continue;
    ctx.fillStyle = dark > 0.3 ? '#8890a8' : '#2a2a35';
    const up = Math.sin(b.ph) > 0;
    ctx.fillRect(x, y, 1, 1);
    ctx.fillRect(x - 1, up ? y - 1 : y + 1, 1, 1);
    ctx.fillRect(x + 1, up ? y - 1 : y + 1, 1, 1);
  }
  drawWorld(ctx, cx, cy, G.VW, G.VH);
  drawDecor(ctx, cx, cy);
  drawWet(ctx, cx, cy);
  drawBeams(ctx, cx, cy);
  drawRails(ctx, cx, cy);
  drawMark(ctx, cx, cy);
  const lava = scanLava(cx, cy);
  drawLavaGlow(ctx);
  drawWaterGlints(ctx);
  drawGemSparkles(ctx);
  if (G.res === 2 && G.lightFx) drawFireflies(ctx, cx, cy, dark);
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
      spr = buildSprite(b); // (in its builder's style, skins.js)
    if (sx < G.VW && sx + b.w > 0 && sy < G.VH + 40 && sy + b.h > -20) {
      // a shadow where the building stands on the ground: one solid darker row, a dithered one below
      ctx.fillStyle = 'rgba(20,12,6,0.3)';
      ctx.fillRect(sx - 1, sy + b.h, b.w + 2, 1);
      for (let x = -2; x < b.w + 2; x += 2) ctx.fillRect(sx + x, sy + b.h + 1, 1, 1);
      if (b.done && b.type !== 'flag' && b.type !== 'gate') {
        drawDetailed(ctx, spr, sx, sy);
        drawRoofWeather(ctx, b, sx, sy);
      }
      else if (!b.done) drawSite(ctx, b, spr, sx, sy);
      drawBuildFx(ctx, b, sx, sy);
      if (b.type === 'base') {
        // (Versus: the team colour, and the castle's hit points)
        if (!(b.hp <= 0)) drawFlag(sx + 4, sy - 10, 14, 7, TEAM_COLS[b.team || 0]);
        drawCastleHp(ctx, b, sx, sy);
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
      if (b.done) drawMoving(ctx, b, sx, sy);
      if (b.done && b.type === 'furnace' && b.busy) {
        // the fire flickers in steps: a dark red bed, orange flames and a yellow core
        const f = flicker(b.x + 3);
        ctx.fillStyle = '#b8361e';
        ctx.fillRect(sx + 6, sy + 15, 6, 7);
        ctx.fillStyle = '#ff7a2a';
        ctx.fillRect(sx + 6, sy + (f < 0.9 ? 17 : 16), 6, f < 0.9 ? 5 : 6);
        ctx.fillStyle = f > 0.95 ? '#fff6c0' : '#ffcf4a';
        ctx.fillRect(sx + 7.5, sy + 18, 3, 3.5);
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
  drawVehicles(ctx, cx, cy);
  // lorries
  for (const L of lorries) {
    const x = Math.floor(L.x - cx),
      y = Math.floor(L.y - cy);
    if (x < -14 || x > G.VW || y < -10 || y > G.VH) continue;
    // the load heaps up over the rim, in the colours of what is in it
    for (let k = 0; k < Math.min(10, L.items.length); k++) {
      ctx.fillStyle = ICOL[L.items[k]] || '#f2c230';
      ctx.fillRect(x + 1.5 + (k % 5) * 1.8, y - (k >= 5 ? 1 : 0), 1.5, 1.5);
    }
    box(ctx, x, y + 1, 12, 4, '#6f6a64');
    ctx.fillStyle = '#4a4540';
    ctx.fillRect(x + 3.5, y + 2, 0.5, 2.5);
    ctx.fillRect(x + 8, y + 2, 0.5, 2.5);
    for (const wx of [x + 2.5, x + 9.5]) wheel(ctx, wx, y + 5.5, 1.5, L.x / 1.5, '#2a2a2a');
  }
  drawChests(ctx, cx, cy);
  drawHill(ctx, cx, cy);
  drawCoop(ctx, cx, cy);
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
  for (const a of arrows) drawArrow(ctx, a, Math.floor(a.x - cx), Math.floor(a.y - cy));
  drawEvents(ctx, cx, cy);
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
    } else {
      // squash on landing, a little stretch while jumping or falling fast (anchored at the feet)
      const age = G.frame - (c.sqT ?? -99),
        p = age >= 0 && age < 6 ? 1 - age / 6 : 0,
        air = c.vy < -1.4 || c.vy > 2.6 ? 1 : 0,
        ky = 1 - 0.2 * p + 0.1 * air,
        kx = 1 + 0.14 * p - 0.06 * air;
      if (p || air) {
        ctx.save();
        ctx.translate(x + 3, y + 10);
        ctx.scale(kx, ky);
        drawClonkHi(c, -3, -10, c.face, ctx);
        ctx.restore();
      } else drawClonkHi(c, x, y, c.face, ctx);
    }
    drawGear(ctx, c, x, y);
    // other players carry their name over the head
    if (G.net && isPlayer(c) && c !== mine) nameTag(c.name, x + 3, y - (c.bub ? 15 : 4), c.cap);
    if (c === mine && (G.frame >> 4) % 3) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x + 2, y - 4, 3, 1);
      ctx.fillRect(x + 3, y - 3, 1, 1);
    }
    // on a touch screen, three dots in the face show which way the tunnel is going
    if (c === mine && c.digging && G.inputKind === 'touch') {
      const [dx, dy] = c.digDir;
      for (let k = 0; k < 3; k++) {
        ctx.fillStyle = `rgba(255,244,214,${0.25 + 0.2 * Math.sin(G.frame * 0.15 - k)})`;
        ctx.fillRect(Math.round(x + 3 + dx * (9 + k * 3)), Math.round(y + 5 + dy * (9 + k * 3)), 1, 1);
      }
    }
  });
  for (const p of parts) {
    const x = Math.floor(p.x - cx),
      y = Math.floor(p.y - cy);
    if (x < -2 || y < 0 || x >= G.VW + 2 || y >= G.VH + 2) continue;
    drawPart(ctx, p, x, y);
  }
  // explosions: a pixel disc with a brighter core instead of a smooth circle
  for (const f of flashes) {
    const r = f.r * (1.2 - f.l / 14);
    ctx.fillStyle = `rgba(255,${180 + f.l * 10},90,${f.l / 8})`;
    pixelDisc(ctx, f.x - cx, f.y - cy, r);
    ctx.fillStyle = `rgba(255,246,192,${f.l / 10})`;
    pixelDisc(ctx, f.x - cx, f.y - cy, r * 0.5);
  }
  // near layer of rain, right in front
  if (G.rainT > 0 && G.biome !== 'winter' && G.lightFx) drawRainNear(ctx, cx, cy);
  if (G.bolt) {
    drawBolt(ctx, cx, cy);
    if (--G.bolt.l <= 0) G.bolt = null;
  }
  if (G.lightFx) duskGrade(ctx, sunAlt());
  // lighting: night plus a dimming that deepens below the surface; lamps, lava and buildings cut holes
  lctx.globalCompositeOperation = 'source-over';
  lctx.clearRect(0, 0, G.VW, G.VH);
  if (dark > 0.02) {
    lctx.fillStyle = G.rainT > 0 ? `rgba(8,14,42,${dark})` : `rgba(6,10,30,${dark})`;
    lctx.fillRect(0, 0, G.VW, G.VH);
  }
  const under = G.lightFx && depthShade(lctx, cx, cy);
  if (dark > 0.02 || under) {
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
    if (under)
      for (let k = 0; k < oreSpots.length; k += 3) lightHole(lctx, oreSpots[k], oreSpots[k + 1], 6, oreSpots[k + 2]);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(lc, 0, 0);
    ctx.imageSmoothingEnabled = false;
    if (dark > 0.02) drawWindowGlow(ctx, cx, cy, dark);
  }
  // warm light on top: lamps below ground, lava and working furnaces
  if (G.res === 2 && G.lightFx) {
    beginGlow(ctx);
    for (const c of crew) {
      const d = c.dead ? 0 : Math.max(dark, depthAt(c.x, c.y));
      if (d > 0.05)
        warmGlow(
          ctx,
          c.x + 3 - cx,
          c.y + 4 - cy,
          isPlayer(c) ? 26 : 14,
          d * 0.32 * flicker(n0(c)),
        );
    }
    for (let k = 0; k < lava.length; k += 6) warmGlow(ctx, lava[k], lava[k + 1], 12, 0.22);
    for (const b of builds)
      if (b.done && b.busy && (b.type === 'furnace' || b.type === 'shop'))
        warmGlow(ctx, b.x + b.w / 2 - cx, b.gy - b.h / 2 - cy, 18, 0.34 * flicker(b.x));
    endGlow(ctx);
  }
  if (G.lightFx) drawVignette(ctx);
  drawGoal(ctx, cx, cy);
  drawBubbles(ctx, cx, cy);
  drawEmotes(ctx, cx, cy);
  drawFloats(ctx, cx, cy);
  drawTutorial(ctx, cx, cy);
}
// a stable per-wühler phase so lamp flicker is not in lockstep
const n0 = c => (c.x * 0 + (c.name ? c.name.length : 0)) * 1.7;
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
