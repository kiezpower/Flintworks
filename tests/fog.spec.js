// The map knows only what has been seen (fog.js) in free play, and a full bag says so (objects.js):
// npm test
import { expect, test } from '@playwright/test';

async function start(page, prof) {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/?seed=7');
  await page.evaluate(p => {
    localStorage.setItem('flintworks-lang', 'de');
    localStorage.setItem(
      'flintworks-profile',
      JSON.stringify({ tutorialDone: true, installAsked: 'done', games: 3, mode: 'meadow', diff: 'relaxed', ...p }),
    );
  }, prof);
  await page.reload();
  await page.waitForFunction(() => window.__ww);
  await page.click('#lbPlay');
  await page.waitForFunction(() => window.__ww.state === 'play');
  return errors;
}

test('the map shows the sky and what the Wühler have seen; the rest is found by going there', async ({ page }) => {
  const errors = await start(page, {});
  const r = await page.evaluate(async () => {
    const w = window.__ww,
      G = w.G;
    const F = await import('/src/fog.js');
    const { surf, H } = await import('/src/world.js');
    const { serialize } = await import('/src/save.js');
    const me = w.crew.find(c => c.pid === G.myId);
    const x = G.base.x + 700,
      deepY = Math.min(H - 20, surf[x] + 150);
    const out = {
      on: F.fogOn(),
      sky: F.knownAt(x, 10),
      deep: F.knownAt(x, deepY),
    };
    // the Wühler goes down there: it is seen
    Object.assign(me, { x, y: deepY - 5, vx: 0, vy: 0 });
    F.fogTick();
    out.after = F.knownAt(x, deepY);
    out.saved = typeof serialize().fog === 'string';
    return out;
  });
  expect(r).toEqual({ on: true, sky: true, deep: false, after: true, saved: true });
  expect(errors).toEqual([]);
});

test('a full bag: the find stays, a hint says so, the bag shakes', async ({ page }) => {
  const errors = await start(page, {});
  const r = await page.evaluate(async () => {
    const w = window.__ww,
      G = w.G;
    const { spawnItem } = await import('/src/entities.js');
    const { surf } = await import('/src/world.js');
    const { INV_MAX } = await import('/src/state.js');
    const me = w.crew.find(c => c.pid === G.myId);
    for (const c of [...w.crew]) if (c !== me) w.crew.splice(w.crew.indexOf(c), 1);
    const x = G.base.x + 300;
    Object.assign(me, { x, y: surf[x + 3] - 10, vx: 0, vy: 0 });
    me.inv = Array(INV_MAX).fill('rock');
    w.step(5);
    spawnItem('nug', me.x + 1, me.y + 4, 0, 0, 0);
    let shook = false;
    for (let q = 0; q < 30; q++) {
      w.step(1);
      await new Promise(r => requestAnimationFrame(r));
      if (document.querySelector('#bagBtn.nope')) shook = true;
    }
    return { kept: me.inv.length, left: w.items.some(i => i.t === 'nug'), shook, hint: document.body.textContent.includes('Tasche voll') };
  });
  expect(r).toEqual({ kept: 16, left: true, shook: true, hint: true });
  expect(errors).toEqual([]);
});
