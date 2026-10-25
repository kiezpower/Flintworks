// Store pictures: starts the dev server, stages five scenes in German and English and saves them
// as screenshots (1280×720), plus the itch.io cover (630×500) and the Play Store feature graphic
// (1024×500) with the title over a scene. Run again after the look of the game changed.
//   npm run store-shots            (writes to docs/itch/ and docs/play/)
import { createServer } from 'vite';
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const ITCH = new URL('../docs/itch/', import.meta.url).pathname,
  PLAY = new URL('../docs/play/', import.meta.url).pathname;
mkdirSync(ITCH, { recursive: true });
mkdirSync(PLAY, { recursive: true });
const server = await createServer({ server: { port: 0 }, logLevel: 'error' });
await server.listen();
const base = server.resolvedUrls.local[0];
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || process.env.CHROMIUM_PATH || undefined });
const errors = [];

async function start(lang, viewport) {
  const page = await browser.newPage({ viewport });
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(l => {
    localStorage.setItem('flintworks-lang', l);
    localStorage.setItem('flintworks-profile', JSON.stringify({ installAsked: 'done', tutorialDone: true, mode: 'meadow' }));
  }, lang);
  await page.goto(`${base}?seed=7`);
  await page.waitForFunction(() => window.__ww);
  await page.click('#lbPlay');
  await page.waitForTimeout(1200);
  await page.evaluate(() => {
    const w = window.__ww;
    w.setDay(0.3);
    w.animals.length = 0;
  });
  return page;
}
// no hints, no leftover texts from setting up the scene
async function quiet(page) {
  await page.evaluate(async () => {
    const { clearFloats } = await import('/src/floats.js');
    window.__ww.items.length = 0;
    clearFloats();
    document.getElementById('toast').hidden = true;
    window.__ww.G.toastT = 0;
  });
  await page.waitForTimeout(60);
}
// the scenes, run inside the page; each leaves the camera where the picture is taken
const SCENES = {
  // the castle with a row of working buildings and the crew
  settlement: async () => {
    const w = window.__ww,
      { mat, W, AIR, EARTH, paint, surf } = w.world,
      c = w.crew[0],
      b0 = w.base;
    const X0 = b0.x + b0.w + 6,
      gy = b0.gy,
      { shade, bg } = w.world;
    // level ground for the buildings, sloping back to the hills behind them
    for (let x = X0 - 4; x < X0 + 250; x++) {
      const t = Math.min(1, Math.max(0, (x - X0 - 180) / 70)),
        top = Math.round(gy + (surf[x] - gy) * t * t * (3 - 2 * t));
      for (let y = gy - 80; y < Math.max(top, surf[x]) + 3; y++) {
        const i = y * W + x;
        if (y < top) {
          mat[i] = AIR;
          bg[i] = 0;
        }
        else if (y < Math.max(top, surf[x]) + 3) {
          mat[i] = EARTH;
          shade[i] = (shade[i] & 3) | (y < top + 2 ? 4 : 0);
        }
      }
      surf[x] = top;
    }
    w.world.paintAll();
    let x = X0 + 6;
    for (const t of ['saw', 'wind', 'furnace', 'hut', 'shop']) {
      c.inv = ['wood', 'wood', 'wood', 'wood', 'rock', 'rock', 'rock', 'plank', 'plank'];
      Object.assign(c, { x, y: gy - 10, vx: 0, vy: 0 });
      w.step(2);
      w.tryBuild(t, c);
      const b = w.builds[w.builds.length - 1];
      if (b && b.type === t) Object.assign(b, { prog: t === 'hut' ? 0.6 : 1, done: t !== 'hut', busy: 99999, on: true });
      x += 34;
    }
    c.inv = [];
    w.items.length = 0;
    w.crew.forEach((h, k) => Object.assign(h, { x: X0 + 40 + k * 46, y: gy - 10, vx: 0, vy: 0 }));
    Object.assign(c, { x: X0 + 60, y: gy - 10 });
  },
  // a mine: a slanted way down, a long gallery with gold and the Wühler digging on
  mine: async () => {
    const w = window.__ww,
      { mat, bg, W, AIR, GOLD, paint, surf } = w.world,
      c = w.crew[0];
    const X = w.base.x + 150,
      Y = surf[X] + 34;
    const carve = (x0, x1, yf, slope = 0) => {
      for (let x = x0; x < x1; x++) {
        const y1 = Math.round(yf + (x - x0) * slope);
        for (let y = y1 - 11; y <= y1; y++) {
          mat[y * W + x] = AIR;
          bg[y * W + x] = 1;
        }
      }
    };
    carve(X - 120, X - 40, surf[X - 120] + 4, (Y - surf[X - 120] - 4) / 80);
    carve(X - 40, X + 60, Y);
    for (const [gx, gy] of [
      [X + 10, Y + 8],
      [X + 40, Y - 18],
      [X - 20, Y + 14],
      [X + 75, Y - 4],
    ])
      for (let y = gy - 3; y < gy + 3; y++) for (let x = gx - 4; x < gx + 4; x++) if (mat[y * W + x]) mat[y * W + x] = GOLD;
    w.world.paintAll();
    Object.assign(c, { x: X + 52, y: Y - 10, vx: 0, vy: 0, face: 1 });
    const h = w.crew[1];
    if (h) Object.assign(h, { x: X - 10, y: Y - 10, vx: 0, vy: 0 });
    w.keys.r = w.keys.dig = 1;
  },
  // deep down: rock, crystals, a gem vein and glowing lava below
  deep: async () => {
    const w = window.__ww,
      { mat, bg, W, AIR, GEM, LAVA, ROCK, paint, surf } = w.world,
      c = w.crew[0];
    const X = w.base.x + 260,
      Y = surf[X] + 170;
    w.G.tools = { ...w.G.tools, pick: true };
    for (let x = X - 60; x < X + 40; x++)
      for (let y = Y - 13; y <= Y; y++) {
        mat[y * W + x] = AIR;
        bg[y * W + x] = 1;
      }
    for (let y = Y + 8; y < Y + 16; y++) for (let x = X - 40; x < X + 10; x++) mat[y * W + x] = y < Y + 10 ? AIR : LAVA;
    for (let y = Y + 6; y < Y + 18; y++) for (let x = X - 44; x < X + 14; x++) if (mat[y * W + x] && mat[y * W + x] !== LAVA && (y > Y + 15 || x < X - 40 || x >= X + 10)) mat[y * W + x] = ROCK;
    for (let y = Y - 24; y < Y - 18; y++) for (let x = X + 20; x < X + 27; x++) mat[y * W + x] = GEM;
    w.world.paintAll();
    Object.assign(c, { x: X + 30, y: Y - 10, vx: 0, vy: 0, face: 1 });
    w.keys.r = w.keys.dig = 1;
  },
  // vehicles: the drill wagon in its tunnel, an airship over the hills
  vehicles: async () => {
    const w = window.__ww,
      { mat, bg, W, AIR, paint, surf } = w.world,
      c = w.crew[0];
    const { mkVehicle } = await import('/src/vehicles/core.js');
    const X = w.base.x + 120,
      Y = surf[X] + 16;
    for (let x = X - 30; x < X + 40; x++)
      for (let y = Y - 9; y <= Y; y++) {
        mat[y * W + x] = AIR;
        bg[y * W + x] = 1;
      }
    w.world.paintAll();
    mkVehicle('drill', X + 10, Y - 9);
    // the airship floats above the hills with a helper on board
    const ship = mkVehicle('airship', X - 80, surf[X - 80] - 70),
      h = w.crew[1];
    if (h) {
      const { enter } = await import('/src/vehicles/core.js');
      Object.assign(h, { x: ship.x + 8, y: ship.y + 10 });
      enter(h, ship);
    }
    Object.assign(c, { x: X - 14, y: Y - 10, vx: 0, vy: 0, face: 1 });
  },
};
// night over the settlement: windows glow, smoke rises
SCENES.night = SCENES.settlement;

const NAMES = ['settlement', 'mine', 'deep', 'vehicles', 'night'];
for (const lang of ['de', 'en']) {
  for (let k = 0; k < NAMES.length; k++) {
    const page = await start(lang, { width: 1280, height: 720 });
    await page.evaluate(`(${SCENES[NAMES[k]]})()`);
    if (NAMES[k] === 'night') await page.evaluate(() => window.__ww.setDay(0.8));
    await page.waitForTimeout(1800);
    await quiet(page);
    await page.screenshot({ path: `${ITCH}screenshot-${k + 1}-${lang}.png` });
    await page.close();
  }
}
// the title over the settlement scene
const TAG = { de: 'GRABEN · BAUEN · SPRENGEN · ZUSAMMEN', en: 'DIG · BUILD · BLAST · TOGETHER' };
async function titled(path, viewport, lang) {
  const page = await start(lang, viewport);
  await page.evaluate(`(${SCENES.settlement})()`);
  await page.waitForTimeout(1800);
  await quiet(page);
  await page.evaluate(tag => {
    for (const id of ['hud', 'btns', 'toast', 'quest']) {
      const e = document.getElementById(id);
      if (e) e.style.visibility = 'hidden';
    }
    const d = document.createElement('div');
    d.style.cssText =
      'position:fixed;left:0;right:0;bottom:0;height:42%;display:grid;place-content:end center;padding-bottom:7%;text-align:center;' +
      'background:linear-gradient(transparent,rgba(20,12,6,.88) 55%);font-family:var(--font-display);z-index:99';
    d.innerHTML = `<b style="font-size:min(15vw,96px);color:#f2c230;text-shadow:0 5px 0 #24160c,0 0 24px rgba(255,200,80,.35)">Flintworks</b><small style="font-size:min(3.2vw,20px);letter-spacing:.18em;color:#f4ead2">${tag}</small>`;
    document.body.appendChild(d);
  }, TAG[lang]);
  await quiet(page);
  await page.screenshot({ path });
  await page.close();
}
await titled(`${ITCH}cover.png`, { width: 630, height: 500 }, 'en');
await titled(`${PLAY}feature-de.png`, { width: 1024, height: 500 }, 'de');
await titled(`${PLAY}feature-en.png`, { width: 1024, height: 500 }, 'en');

await browser.close();
await server.close();
if (errors.length) {
  console.log('page errors:', errors.join(' | '));
  process.exit(1);
}
console.log('store pictures written to docs/itch/ and docs/play/');
