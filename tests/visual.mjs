// Visual smoke test: starts the dev server, plays a round, saves screenshots to tests/out/ and
// checks that nothing throws and that the world gets darker with depth.
//   npm run test:visual
import { createServer } from 'vite';
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const OUT = new URL('./out/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const server = await createServer({ server: { port: 0 }, logLevel: 'error' });
await server.listen();
const base = server.resolvedUrls.local[0];
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || process.env.CHROMIUM_PATH || undefined });
const failures = [];
const check = (ok, msg) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${msg}`);
  if (!ok) failures.push(msg);
};

async function run(name, viewport, query = '') {
  const page = await browser.newPage({ viewport });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => localStorage.setItem('flintworks-profile', JSON.stringify({ installAsked: 'done' })));
  await page.goto(`${base}?seed=7${query}`);
  await page.waitForTimeout(1200);
  // a new player starts at the start screen over the tutorial world (no lobby)
  await page.screenshot({ path: `${OUT}${name}-start.png` });
  await page.click('#veilGo');
  await page.evaluate(() => window.__ww.endTutorial()); // the world only, without the tutorial's help
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${OUT}${name}-surface.png` });
  // night
  await page.evaluate(() => window.__ww.setDay(0.78));
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${OUT}${name}-night.png` });
  await page.evaluate(() => window.__ww.setDay(0.3));
  // a cave well below the surface; the first Wühler walks in
  await page.evaluate(() => {
    const w = window.__ww,
      c = w.crew[0],
      W = w.world;
    const x0 = Math.floor(c.x) - 10,
      y0 = Math.floor(c.y) + 70;
    for (let y = y0; y < y0 + 14; y++)
      for (let x = x0; x < x0 + 40; x++) {
        W.mat[y * W.W + x] = 0;
        W.bg[y * W.W + x] = 1;
      }
    for (let y = y0 - 3; y < y0 + 18; y++) for (let x = x0 - 3; x < x0 + 44; x++) W.paint(y * W.W + x);
    c.x = x0 + 12;
    c.y = y0 + 12;
    c.vy = 0;
  });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${OUT}${name}-cave.png` });
  const luma = await page.evaluate(() => {
    const cv = document.getElementById('cv'),
      g = cv.getContext('2d');
    const row = f => {
      const y = Math.floor(cv.height * f),
        d = g.getImageData(0, y, cv.width, 1).data;
      let s = 0;
      for (let i = 0; i < d.length; i += 4) s += (d[i] + d[i + 1] + d[i + 2]) / 3;
      return s / (d.length / 4);
    };
    return [row(0.3), row(0.95)];
  });
  // sparks for a finished building, a chest and a glint must not throw
  await page.evaluate(() => {
    const w = window.__ww,
      c = w.crew[0];
    w.effects.celebrate(c.x, c.y, 30);
    w.effects.glint(c.x, c.y);
    w.step(30);
  });
  await page.screenshot({ path: `${OUT}${name}-sparks.png` });
  await page.keyboard.press('b');
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}${name}-build.png` });
  check(errors.length === 0, `${name}: no page errors ${errors.join(' | ')}`);
  check(luma[1] < luma[0] * 0.85, `${name}: deep rows are darker than shallow ones (${luma.map(Math.round)})`);
  await page.close();
}

// the level selection: chapter 2 and the detail of a level, everything inside the screen
async function selection(name, viewport, lang) {
  const page = await browser.newPage({ viewport });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(l => {
    localStorage.setItem('flintworks-lang', l);
    const camp = { wipfrettung: 3, altemine: 1 };
    localStorage.setItem('flintworks-profile', JSON.stringify({ installAsked: 'done', tutorialDone: true, campaign: camp }));
  }, lang);
  await page.goto(base);
  await page.waitForFunction(() => window.__ww);
  await page.click('#lbGMode');
  await page.click('.ls-tab[data-t="k2"]');
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}${name}-select.png` });
  await page.click('.ls-card[data-id="altemine"]');
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}${name}-select-detail.png` });
  const fit = await page.evaluate(() => {
    const go = document.querySelector('.ls-go').getBoundingClientRect(),
      el = document.scrollingElement;
    return go.bottom <= innerHeight && go.right <= innerWidth && el.scrollWidth <= innerWidth;
  });
  check(errors.length === 0, `${name}: level selection without page errors ${errors.join(' | ')}`);
  check(fit, `${name}: level selection fits the screen, the play button is visible`);
  await page.close();
}

await selection('select-desktop', { width: 1280, height: 720 }, 'de');
await selection('select-phone', { width: 740, height: 360 }, 'en');
await run('desktop', { width: 1280, height: 720 });
await run('phone', { width: 844, height: 390 });
await run('fast', { width: 1280, height: 720 }, '&res=1');
await browser.close();
await server.close();
if (failures.length) {
  console.error(`${failures.length} check(s) failed`);
  process.exit(1);
}
