// The story intro before the tutorial (under 30 s, skippable at any moment): a parallax camera
// ride from the night sky over the dark village of Funkenhain down into the earth. The last spark
// of the hearth goes out (particles, a short shake, then silence), the title FLINTWORKS glows up,
// and four short story lines are typed out like on a typewriter.
// Everything is drawn on its own small canvas (320 × 180, scaled up without smoothing, so it keeps
// the game's pixel look); the sound is synthesized on the game's audio context.
// Played before a new tutorial (main.js): straight after the start screen on the first launch,
// and when the tutorial is asked for again in the lobby. Never when a saved tutorial goes on.
import '@fontsource/pixelify-sans/latin-400.css';
import '@fontsource/silkscreen/latin-700.css';
import './story.css';
import { ev } from './analytics.js';
import { tr } from './i18n.js';
import { G } from './state.js';

const VW = 320,
  VH = 180;
const END = 29; // seconds; the whole ride stays under 30
// the four story lines: when they start and end (seconds)
const LINES = [
  { t0: 0.9, t1: 6.6, text: 'Das Herdfeuer von Funkenhain ist erloschen.' },
  { t0: 7.4, t1: 12.6, text: 'Ohne Glut kein Werkzeug, ohne Werkzeug kein Winter.' },
  { t0: 13.6, t1: 19.6, text: 'Tief unter dem Dorf soll der Glutstein liegen.' },
  { t0: 23.4, t1: 28.6, text: 'Du nimmst deinen Feuerstein – und gräbst.' },
];
const CPS = 30; // typed characters per second
const SPARK_DIES = 11; // the last spark goes out here
const TITLE = 21; // the title glows up here
const GROUND = 430; // the village's ground in the camera's world (y grows downwards)

// ---- small helpers ----
let seed = 1;
const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const ease = t => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const seg = (t, a, b) => ease((t - a) / (b - a));
const lerp = (a, b, k) => a + (b - a) * k;
function rect(ctx, x, y, w, h, c) {
  ctx.fillStyle = c;
  ctx.fillRect(Math.round(x), Math.round(y), w, h);
}
// where the camera looks (top of the view in world y) at time t
function camAt(t) {
  if (t < 1.5) return 0;
  if (t < 7.5) return lerp(0, 300, seg(t, 1.5, 7.5));
  if (t < 13) return 300;
  return lerp(300, 820, seg(t, 13, 19.5));
}

// ---- the pictures that do not move by themselves, drawn once ----
let stars = [],
  layers = null;
function build() {
  seed = 4711;
  stars = [];
  for (let k = 0; k < 150; k++)
    stars.push({ x: rand() * VW, y: rand() * 330, b: 0.3 + rand() * 0.7, p: rand() * 6.3, big: rand() < 0.07 });
  layers = {
    far: ridge(150, '#1a1f3c', '#232a4d', 24, 0.035),
    hills: ridge(120, '#141a2c', '#1b2338', 14, 0.07),
    village: village(),
    earth: earth(),
  };
}
const canvas = (w, h) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
};
// a mountain ridge: a wavy top edge, a lighter rim on it
function ridge(h, col, rim, amp, freq) {
  const c = canvas(VW, h),
    x = c.getContext('2d');
  const ph = rand() * 10;
  for (let i = 0; i < VW; i++) {
    const top = Math.round(amp + Math.sin(i * freq + ph) * amp * 0.6 + Math.sin(i * freq * 2.7 + ph * 2) * amp * 0.3 + Math.sin(i * 0.4) * 1.2);
    rect(x, i, top, 1, h - top, col);
    rect(x, i, top, 1, 1, rim);
  }
  return c;
}
// the village: ground, huts with dark windows, a well, bare trees and the cold hearth
function village() {
  const c = canvas(VW, 90),
    x = c.getContext('2d'),
    g = 60; // ground line inside this picture
  // grassy ground, a little uneven
  for (let i = 0; i < VW; i++) {
    const top = g + Math.round(Math.sin(i * 0.05) * 1.5);
    rect(x, i, top, 1, g + 3 - top, '#0d130f');
    rect(x, i, top, 1, 1, '#1d2b1e');
    if (rand() < 0.3) rect(x, i, top - 1, 1, 1, '#16221a');
  }
  const hut = (hx, w, h, roof) => {
    rect(x, hx, g - h, w, h, '#17130f');
    for (let k = 0; k < Math.ceil(w / 2) + 2; k++) rect(x, hx - 2 + k, g - h - k, w + 4 - 2 * k, 1, roof);
    rect(x, hx + 3, g - h + 4, 3, 3, '#0a0806'); // a dark window: nobody has light
    rect(x, hx + w - 6, g - 9, 4, 9, '#0f0b08'); // the door
    rect(x, hx + w - 5, g - h - w / 2 + 1, 2, 5, '#1d1712'); // a chimney without smoke
  };
  hut(28, 20, 14, '#2a1f18');
  hut(62, 16, 11, '#261c16');
  hut(206, 22, 15, '#2a1f18');
  hut(252, 18, 12, '#241b15');
  hut(288, 14, 10, '#261c16');
  // bare trees
  const tree = (tx, h) => {
    rect(x, tx, g - h, 2, h, '#120f0c');
    for (let k = 0; k < 4; k++) {
      const y = g - h + 2 + k * 3,
        d = k % 2 ? 1 : -1;
      for (let s = 0; s < 4 - k / 2; s++) rect(x, tx + d * (s + 1), y - s, 1, 1, '#120f0c');
    }
  };
  tree(10, 22);
  tree(100, 26);
  tree(186, 18);
  tree(312, 20);
  // the well
  rect(x, 120, g - 6, 12, 6, '#2b2c2f');
  rect(x, 120, g - 6, 12, 1, '#44464b');
  rect(x, 121, g - 16, 1, 10, '#2a1d14');
  rect(x, 130, g - 16, 1, 10, '#2a1d14');
  rect(x, 119, g - 17, 14, 2, '#3a2a1e');
  // the hearth: a ring of stones around cold ashes
  for (let k = 0; k < 8; k++) rect(x, 152 + k * 2, g - 3 - (k === 0 || k === 7 ? 0 : 1), 2, 3, k % 2 ? '#3b3936' : '#4a4743');
  rect(x, 154, g - 2, 12, 2, '#211d1a');
  return c;
}
// the earth below: soil, clay and rock in layers, stones, roots near the top, bones and an old
// cart further down, and the glow of the Glutstein at the very bottom
function earth() {
  const h = 600,
    c = canvas(VW, h),
    x = c.getContext('2d');
  const bands = [
    [0, '#2a1a10'],
    [70, '#3a2516'],
    [160, '#33261f'],
    [250, '#3a2e2a'],
    [350, '#2e2830'],
    [450, '#262028'],
  ];
  for (let b = 0; b < bands.length; b++) {
    const y0 = bands[b][0],
      y1 = b + 1 < bands.length ? bands[b + 1][0] : h;
    for (let i = 0; i < VW; i++) {
      const wob = Math.round(Math.sin(i * 0.06 + b) * 4 + Math.sin(i * 0.17 + b * 3) * 2);
      rect(x, i, y0 + (b ? wob : 0), 1, y1 - y0 + 8, bands[b][1]);
    }
  }
  // speckles and stones
  for (let k = 0; k < 900; k++) {
    const sx = rand() * VW,
      sy = rand() * h;
    rect(x, sx, sy, 1, 1, rand() < 0.5 ? 'rgba(0,0,0,0.25)' : 'rgba(255,230,200,0.06)');
  }
  for (let k = 0; k < 45; k++) {
    const sx = rand() * VW,
      sy = 20 + rand() * (h - 60),
      w = 3 + ((rand() * 6) | 0);
    rect(x, sx, sy, w, 2 + ((rand() * 3) | 0), '#4e4a48');
    rect(x, sx, sy, w, 1, '#6d6864');
  }
  // roots hanging into the first layer
  for (let k = 0; k < 16; k++) {
    let rx = rand() * VW,
      ry = 0;
    const len = 12 + rand() * 30;
    for (let s = 0; s < len; s++) {
      rect(x, rx, ry, 1, 1, '#4a3322');
      ry++;
      rx += (rand() - 0.5) * 1.4;
    }
  }
  // flint nodules glint in the clay
  for (let k = 0; k < 10; k++) {
    const sx = rand() * VW,
      sy = 120 + rand() * 260;
    rect(x, sx, sy, 3, 2, '#8b2a12');
    rect(x, sx, sy, 2, 1, '#e0572f');
  }
  // an old mine cart and a ladder from those who dug before
  rect(x, 60, 230, 14, 6, '#3d2c1f');
  rect(x, 60, 230, 14, 1, '#5a4430');
  rect(x, 62, 236, 3, 3, '#1a1512');
  rect(x, 69, 236, 3, 3, '#1a1512');
  for (let k = 0; k < 10; k++) rect(x, 240, 180 + k * 5, 8, 1, '#4a3626');
  rect(x, 240, 180, 1, 50, '#4a3626');
  rect(x, 247, 180, 1, 50, '#4a3626');
  // a cave at the bottom where the Glutstein lies
  for (let i = 100; i < 220; i++) {
    const d = Math.abs(i - 160) / 60,
      top = Math.round(462 + d * d * 34),
      bot = 512 - Math.round(d * d * 8);
    rect(x, i, top, 1, bot - top, '#120d0c');
  }
  rect(x, 152, 507, 16, 6, '#3a302c');
  rect(x, 152, 507, 16, 1, '#5a4c44');
  return c;
}

// ---- the moving parts ----
const sparks = []; // embers (hearth, title)
const ash = [];
function emberAt(x, y, vy = -0.25) {
  sparks.push({ x, y, vx: (rand() - 0.5) * 0.3, vy, l: 40 + rand() * 50, l0: 90 });
}
let shake = 0;

function draw(ctx, t, dt) {
  const camY = camAt(t);
  const sx = shake > 0 && !G.reduceMotion ? Math.round((rand() - 0.5) * shake * 2) : 0,
    sy = shake > 0 && !G.reduceMotion ? Math.round((rand() - 0.5) * shake * 2) : 0;
  shake = Math.max(0, shake - dt * 5);
  ctx.save();
  ctx.translate(sx, sy);
  // the sky: deep night blue at the top, a little violet near the horizon
  const sk = ctx.createLinearGradient(0, -camY * 0.4, 0, 420 - camY);
  sk.addColorStop(0, '#05060f');
  sk.addColorStop(0.6, '#0d1130');
  sk.addColorStop(1, '#241a3a');
  ctx.fillStyle = sk;
  ctx.fillRect(-4, -4, VW + 8, VH + 8);
  // stars (they twinkle; the parallax is slow)
  for (const s of stars) {
    const y = s.y - camY * 0.35;
    if (y < -2 || y > VH) continue;
    const a = s.b * (0.6 + 0.4 * Math.sin(t * 2 + s.p));
    rect(ctx, s.x, y, 1, 1, `rgba(230,235,255,${a.toFixed(2)})`);
    if (s.big && a > 0.6) {
      rect(ctx, s.x - 1, y, 1, 1, `rgba(200,210,255,${(a * 0.4).toFixed(2)})`);
      rect(ctx, s.x + 1, y, 1, 1, `rgba(200,210,255,${(a * 0.4).toFixed(2)})`);
    }
  }
  // a shooting star early on
  if (t > 2.2 && t < 3.1) {
    const k = (t - 2.2) / 0.9,
      x = 60 + k * 120,
      y = 30 + k * 40 - camY * 0.35;
    for (let q = 0; q < 10; q++) rect(ctx, x - q * 2, y - q * 0.66, 1, 1, `rgba(255,255,230,${((1 - q / 10) * (1 - k)).toFixed(2)})`);
  }
  // the moon with a soft halo
  const my = 46 - camY * 0.3;
  if (my > -30) {
    ctx.fillStyle = 'rgba(200,210,255,0.06)';
    ctx.beginPath();
    ctx.arc(250, my, 22, 0, 7);
    ctx.fill();
    ctx.fillStyle = '#e8e6d6';
    ctx.beginPath();
    ctx.arc(250, my, 10, 0, 7);
    ctx.fill();
    rect(ctx, 246, my - 4, 3, 2, '#c9c6b2');
    rect(ctx, 252, my + 2, 2, 2, '#c9c6b2');
    rect(ctx, 248, my + 4, 2, 1, '#cfccb8');
  }
  // clouds drifting slowly
  for (let k = 0; k < 3; k++) {
    const cx = ((k * 130 + t * (3 + k)) % (VW + 120)) - 60,
      cy = 70 + k * 30 - camY * 0.25;
    if (cy < -20 || cy > VH) continue;
    rect(ctx, cx, cy, 46, 3, 'rgba(60,64,100,0.35)');
    rect(ctx, cx + 8, cy - 2, 26, 2, 'rgba(60,64,100,0.3)');
  }
  // the ridges come up as the camera goes down
  ctx.drawImage(layers.far, 0, 260 - camY * 0.5);
  ctx.drawImage(layers.hills, 0, 350 - camY * 0.75);
  // the village and the earth below it
  const vy = GROUND - 60 - camY;
  ctx.drawImage(layers.earth, 0, GROUND + 2 - camY);
  ctx.drawImage(layers.village, 0, vy);
  hearth(ctx, t, vy + 60);
  glutGlow(ctx, t, GROUND + 2 + 505 - camY);
  // pebbles in front, faster than the rest: depth while going down
  for (let k = 0; k < 7; k++) {
    const fx = (k * 53 + 11) % VW,
      fy = GROUND + 60 + k * 90 - camY * 1.35;
    if (fy < GROUND + 4 - camY || fy > VH + 10) continue;
    rect(ctx, fx, fy, 6, 3, '#120c08');
    rect(ctx, fx + 1, fy, 4, 1, '#2a2018');
  }
  // embers and ash
  for (let k = sparks.length - 1; k >= 0; k--) {
    const p = sparks[k];
    p.x += p.vx + Math.sin(t * 3 + k) * 0.08;
    p.y += p.vy;
    p.l -= dt * 60;
    if (p.l <= 0) {
      sparks.splice(k, 1);
      continue;
    }
    const a = Math.min(1, p.l / 30);
    rect(ctx, p.x, p.y - (p.title ? 0 : camY), 1, 1, `rgba(255,${(150 + 80 * a) | 0},60,${a.toFixed(2)})`);
  }
  for (let k = ash.length - 1; k >= 0; k--) {
    const p = ash[k];
    p.vy += 0.01;
    p.x += p.vx;
    p.y += p.vy;
    p.l -= dt * 60;
    if (p.l <= 0) {
      ash.splice(k, 1);
      continue;
    }
    rect(ctx, p.x, p.y - camY, 1, 1, `rgba(150,140,130,${Math.min(1, p.l / 40).toFixed(2)})`);
  }
  ctx.restore();
  // after the spark: the night grows darker; before the title: black
  let dark = 0;
  if (t > SPARK_DIES) dark = Math.min(0.25, (t - SPARK_DIES) * 0.3);
  if (t > 19.6) dark = lerp(0.25, 1, seg(t, 19.6, 20.8));
  if (dark > 0) {
    ctx.fillStyle = `rgba(2,2,6,${dark.toFixed(3)})`;
    ctx.fillRect(0, 0, VW, VH);
  }
  vignette(ctx);
  if (t > TITLE - 0.3) title(ctx, t);
}
// the cold hearth: a few embers that glow and die; then the last spark rises and goes out
let sparkShown = false;
function hearth(ctx, t, gy) {
  const hx = 160;
  if (t < SPARK_DIES) {
    const k = Math.max(0, 1 - Math.max(0, t - 7) / 4);
    for (let e = 0; e < 5; e++) {
      const a = k * (0.4 + 0.6 * Math.abs(Math.sin(t * (3 + e) + e)));
      if (a > 0.05) rect(ctx, hx - 4 + e * 2, gy - 2, 1, 1, `rgba(255,${(90 + e * 20) | 0},30,${a.toFixed(2)})`);
    }
    if (k > 0) {
      const glow = ctx.createRadialGradient(hx, gy - 2, 0, hx, gy - 2, 14);
      glow.addColorStop(0, `rgba(255,120,40,${(0.25 * k).toFixed(2)})`);
      glow.addColorStop(1, 'rgba(255,120,40,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(hx - 14, gy - 16, 28, 28);
    }
  }
  // the last spark: up from the ashes, flickering, until it is gone
  if (t > 8.6 && t < SPARK_DIES) {
    const k = (t - 8.6) / (SPARK_DIES - 8.6),
      x = hx + Math.sin(k * 9) * 4,
      y = gy - 3 - k * 34,
      on = Math.sin(t * 40) > -0.2 || k < 0.6;
    if (on) {
      rect(ctx, x, y, 1, 1, '#fff3c0');
      const g = ctx.createRadialGradient(x, y, 0, x, y, 6);
      g.addColorStop(0, `rgba(255,160,60,${(0.5 * (1 - k * 0.5)).toFixed(2)})`);
      g.addColorStop(1, 'rgba(255,160,60,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - 6, y - 6, 12, 12);
    }
    sparkShown = { x, y: y + camAt(t) };
  }
  if (t >= SPARK_DIES && sparkShown) {
    // it goes out: a puff of ash, a shake, silence
    for (let q = 0; q < 16; q++) ash.push({ x: sparkShown.x, y: sparkShown.y, vx: (rand() - 0.5) * 0.7, vy: (rand() - 0.8) * 0.5, l: 60 + rand() * 60 });
    shake = 2.2;
    sparkShown = false;
  }
}
// the Glutstein, deep down: a pulse of warm light like a heartbeat
function glutGlow(ctx, t, y) {
  if (y > VH + 40 || y < -40) return;
  const beat = 0.55 + 0.45 * Math.pow(Math.abs(Math.sin(t * 2.2)), 6),
    a = Math.min(1, Math.max(0, (t - 15) / 3)) * beat;
  if (a <= 0) return;
  const g = ctx.createRadialGradient(160, y, 0, 160, y, 40);
  g.addColorStop(0, `rgba(255,140,50,${(0.55 * a).toFixed(2)})`);
  g.addColorStop(1, 'rgba(255,90,20,0)');
  ctx.fillStyle = g;
  ctx.fillRect(120, y - 40, 80, 80);
  rect(ctx, 158, y - 2, 4, 3, `rgba(255,220,140,${a.toFixed(2)})`);
  rect(ctx, 157, y - 1, 6, 1, `rgba(255,120,40,${a.toFixed(2)})`);
}
let vig = null;
function vignette(ctx) {
  if (!vig) {
    vig = canvas(VW, VH);
    const x = vig.getContext('2d'),
      g = x.createRadialGradient(VW / 2, VH / 2, VH * 0.35, VW / 2, VH / 2, VW * 0.62);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.6)');
    x.fillStyle = g;
    x.fillRect(0, 0, VW, VH);
  }
  ctx.drawImage(vig, 0, 0);
}
// FLINTWORKS glows up like iron in a forge: dark red, orange, then a hot rim; embers rise
function title(ctx, t) {
  const k = seg(t, TITLE, TITLE + 1.6),
    flick = 0.9 + 0.1 * Math.sin(t * 13) * Math.sin(t * 7.3);
  if (Math.random() < 0.5) {
    emberAt(70 + Math.random() * 180, 118 + Math.random() * 6, -0.3 - Math.random() * 0.4);
    sparks[sparks.length - 1].title = true;
  }
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '700 24px Silkscreen, monospace';
  const y = 78;
  // the glow: several soft passes behind the letters
  ctx.shadowColor = `rgba(255,110,30,${(0.9 * k * flick).toFixed(2)})`;
  for (const b of [18, 9, 4]) {
    ctx.shadowBlur = b;
    ctx.fillStyle = `rgba(120,30,10,${(0.5 * k).toFixed(2)})`;
    ctx.fillText('FLINTWORKS', VW / 2, y);
  }
  ctx.shadowBlur = 0;
  const gr = ctx.createLinearGradient(0, y - 12, 0, y + 12);
  gr.addColorStop(0, `rgba(255,243,192,${k.toFixed(2)})`);
  gr.addColorStop(0.45, `rgba(255,176,60,${k.toFixed(2)})`);
  gr.addColorStop(1, `rgba(200,60,20,${k.toFixed(2)})`);
  ctx.fillStyle = gr;
  ctx.fillText('FLINTWORKS', VW / 2, y);
  // a line of embers under it
  const w = 180 * seg(t, TITLE + 0.4, TITLE + 1.8);
  rect(ctx, VW / 2 - w / 2, y + 17, w, 1, `rgba(255,120,40,${(0.7 * k * flick).toFixed(2)})`);
  ctx.restore();
}

// ---- sound ----
let au = null;
function noiseBuf(AC) {
  const b = AC.createBuffer(1, AC.sampleRate * 2, AC.sampleRate),
    d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return b;
}
function startAudio() {
  const AC = G.AC;
  if (!AC || G.muted || AC.state !== 'running') return null;
  const now = AC.currentTime,
    out = AC.createGain();
  out.gain.value = 0.9;
  out.connect(G.SFX || G.MG || AC.destination);
  const buf = noiseBuf(AC),
    nodes = [];
  const src = (gain, filt, f, q = 0.7) => {
    const s = AC.createBufferSource();
    s.buffer = buf;
    s.loop = true;
    const fl = AC.createBiquadFilter();
    fl.type = filt;
    fl.frequency.value = f;
    fl.Q.value = q;
    const g = AC.createGain();
    g.gain.value = 0;
    s.connect(fl).connect(g).connect(out);
    s.start(now);
    nodes.push(s);
    return { g: g.gain, f: fl.frequency };
  };
  const osc = (hz, type = 'sine') => {
    const o = AC.createOscillator();
    o.type = type;
    o.frequency.value = hz;
    const g = AC.createGain();
    g.gain.value = 0;
    o.connect(g).connect(out);
    o.start(now);
    nodes.push(o);
    return { g: g.gain, f: o.frequency };
  };
  // wind over the village and a low drone, cut off when the spark goes out
  const wind = src(0, 'bandpass', 420),
    d1 = osc(55),
    d2 = osc(82.4);
  wind.g.setValueAtTime(0, now);
  wind.g.linearRampToValueAtTime(0.16, now + 2);
  for (let k = 0; k < 10; k++) wind.f.linearRampToValueAtTime(300 + Math.random() * 400, now + 1 + k);
  d1.g.linearRampToValueAtTime(0.05, now + 3);
  d2.g.linearRampToValueAtTime(0.03, now + 5);
  for (const n of [wind, d1, d2]) {
    n.g.setValueAtTime(n === wind ? 0.16 : n === d1 ? 0.05 : 0.03, now + SPARK_DIES - 0.05);
    n.g.linearRampToValueAtTime(0, now + SPARK_DIES + 0.12);
  }
  // the crackle of the last embers, fewer and fewer
  for (let k = 0; k < 18; k++) {
    const at = now + 6.8 + Math.pow(k / 18, 0.7) * 4.1;
    pop(AC, out, at, 0.05 * (1 - k / 22), 2200 + Math.random() * 2000);
  }
  // the spark's last "tink"
  tone(AC, out, now + SPARK_DIES, 1760, 0.6, 0.05, 'sine');
  // underground: a deep rumble and a heartbeat that grows towards the Glutstein
  const rum = src(0, 'lowpass', 110);
  rum.g.setValueAtTime(0, now + 13);
  rum.g.linearRampToValueAtTime(0.22, now + 19.5);
  rum.g.linearRampToValueAtTime(0.0, now + TITLE);
  for (let k = 0; k < 9; k++) {
    const at = now + 14.2 + k * 0.72,
      a = 0.08 + k * 0.025;
    thump(AC, out, at, a);
    thump(AC, out, at + 0.22, a * 0.6);
  }
  // the title: a boom, then a warm chord that swells
  thump(AC, out, now + TITLE, 0.5, 38, 1.8);
  pop(AC, out, now + TITLE, 0.25, 700, 1.2);
  for (const [hz, a] of [
    [220, 0.035],
    [329.6, 0.025],
    [440, 0.018],
    [659.3, 0.008],
  ]) {
    const o = osc(hz, 'triangle');
    o.g.setValueAtTime(0, now + TITLE);
    o.g.linearRampToValueAtTime(a, now + TITLE + 2.2);
    o.g.setValueAtTime(a, now + END - 1);
    o.g.linearRampToValueAtTime(0, now + END);
  }
  return { out, nodes };
}
function tone(AC, out, at, hz, len, a, type = 'square') {
  const o = AC.createOscillator(),
    g = AC.createGain();
  o.type = type;
  o.frequency.value = hz;
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(a, at + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, at + len);
  o.connect(g).connect(out);
  o.start(at);
  o.stop(at + len + 0.05);
}
function pop(AC, out, at, a, hz, len = 0.03) {
  const s = AC.createBufferSource();
  s.buffer = noiseBuf.cache || (noiseBuf.cache = noiseBuf(AC));
  const f = AC.createBiquadFilter(),
    g = AC.createGain();
  f.type = len > 0.2 ? 'lowpass' : 'highpass';
  f.frequency.value = hz;
  g.gain.setValueAtTime(a, at);
  g.gain.exponentialRampToValueAtTime(0.0001, at + len);
  s.connect(f).connect(g).connect(out);
  s.start(at, Math.random());
  s.stop(at + len + 0.05);
}
function thump(AC, out, at, a, hz = 58, len = 0.35) {
  const o = AC.createOscillator(),
    g = AC.createGain();
  o.frequency.setValueAtTime(hz * 1.8, at);
  o.frequency.exponentialRampToValueAtTime(hz, at + 0.08);
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(a, at + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, at + len);
  o.connect(g).connect(out);
  o.start(at);
  o.stop(at + len + 0.05);
}
function stopAudio() {
  if (!au) return;
  const AC = G.AC,
    t = AC.currentTime;
  au.out.gain.cancelScheduledValues(t);
  au.out.gain.setValueAtTime(au.out.gain.value, t);
  au.out.gain.linearRampToValueAtTime(0, t + 0.25);
  const a = au;
  setTimeout(() => {
    for (const n of a.nodes) n.stop?.();
    a.out.disconnect();
  }, 400);
  au = null;
}
// a soft key click for each typed letter
function typeTick() {
  if (!au || !G.AC) return;
  tone(G.AC, au.out, G.AC.currentTime, 1900 + Math.random() * 500, 0.018, 0.012);
}

// ---- the overlay ----
let el = null,
  cv,
  ctx,
  textEl,
  skipBtn,
  running = false;
function makeDom() {
  el = document.createElement('div');
  el.id = 'intro';
  el.hidden = true;
  cv = canvas(VW, VH);
  cv.setAttribute('aria-hidden', 'true');
  ctx = cv.getContext('2d');
  textEl = document.createElement('p');
  textEl.className = 'introText';
  textEl.setAttribute('aria-live', 'polite');
  skipBtn = document.createElement('button');
  skipBtn.type = 'button';
  skipBtn.className = 'ghost introSkip';
  el.append(cv, textEl, skipBtn);
  document.getElementById('game').appendChild(el);
}
// plays the intro, then done() (also when skipped)
function playIntro(done) {
  if (running) return;
  if (!el) makeDom();
  if (!layers) build();
  running = true;
  G.introOn = true; // (the music waits, music.js)
  sparks.length = ash.length = 0;
  sparkShown = false;
  shake = 0;
  el.hidden = false;
  el.classList.remove('out');
  skipBtn.textContent = tr('Überspringen') + ' ›';
  textEl.textContent = '';
  au = startAudio();
  ev('onb_intro', { action: 'start' });
  const t0 = performance.now();
  let last = t0,
    typed = '',
    finished = false;
  const finish = skipped => {
    if (finished) return;
    finished = true;
    ev('onb_intro', { action: skipped ? 'skip' : 'done', sec: Math.round((performance.now() - t0) / 100) / 10 });
    stopAudio();
    removeEventListener('keydown', onKey, true);
    el.removeEventListener('pointerdown', onTap);
    const close = () => {
      el.hidden = true;
      running = false;
      G.introOn = false;
      done();
    };
    if (G.reduceMotion) close();
    else {
      el.classList.add('out');
      setTimeout(close, 450);
    }
  };
  // any key or a tap skips (not in the first moment: the tap that started the game)
  const ready = () => performance.now() - t0 > 500;
  const onKey = e => {
    if (!ready() || e.repeat) return;
    e.preventDefault();
    e.stopPropagation();
    finish(true);
  };
  const onTap = e => {
    e.stopPropagation();
    if (ready()) finish(true);
  };
  addEventListener('keydown', onKey, true);
  el.addEventListener('pointerdown', onTap);
  const frame = now => {
    if (finished) return;
    const t = (now - t0) / 1000,
      dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (t >= END) return finish(false);
    draw(ctx, t, dt);
    // the story line that is on now, typed out letter by letter
    const L = LINES.find(l => t >= l.t0 && t < l.t1);
    const full = L ? tr(L.text) : '';
    const n = L ? Math.min(full.length, Math.floor((t - L.t0) * CPS)) : 0;
    const s = full.slice(0, n);
    if (s !== typed) {
      if (s.length > typed.length && /\S/.test(s[s.length - 1])) typeTick();
      typed = s;
      textEl.textContent = s;
    }
    textEl.classList.toggle('fade', !!L && t > L.t1 - 0.6);
    textEl.classList.toggle('caret', !!L && n < full.length);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
const introRunning = () => running;

export { introRunning, playIntro };
