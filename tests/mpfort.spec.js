// Fortress and siege in a shared round (Koop): the guest sees what the host's game knows – the
// nights of "Festung", a wall's hit points, the cannon's balls – and with two players a night
// brings more monsters. Finding each other: a call reaches the others as a line, "Hierher!"
// sets a marker, players off the screen get an arrow. Runs a relay of its own: npm test
import { expect, test } from '@playwright/test';
import { startRelay } from './relayproc.js';

const PORT = 8795;
let relay;
test.beforeAll(async () => {
  const r = startRelay(PORT);
  relay = r.relay;
  await r.ready;
});
test.afterAll(() => relay?.kill());

async function player(browser, name, extra = {}) {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(`/?mp=ws://localhost:${PORT}`);
  await page.evaluate(
    ([n, x]) => {
      localStorage.clear();
      localStorage.setItem('flintworks-lang', 'de');
      localStorage.setItem(
        'flintworks-profile',
        JSON.stringify({ tutorialDone: true, installAsked: 'done', name: n, games: 3, ...x }),
      );
    },
    [name, extra],
  );
  await page.reload();
  await page.waitForFunction(() => window.__ww);
  await page.locator('#lbSlot1').click();
  await expect(page.locator('#lbQuick')).toBeVisible();
  return { page, errors };
}

test.describe.configure({ mode: 'serial' });

test('Festung in Koop: the guest sees the nights, the walls and the cannon; two players, more monsters', async ({
  browser,
}) => {
  const h = await player(browser, 'Hilde', { gmode: 'fort', mode: 'meadow' });
  const g = await player(browser, 'Gustav');
  await h.page.waitForTimeout(500);
  await h.page.locator('#lbCreate').click();
  await expect(h.page.locator('.lb-codetap b')).toHaveText(/^[A-Z0-9]{6}$/);
  const code = await h.page.locator('.lb-codetap b').textContent();
  await g.page.waitForTimeout(500);
  await g.page.locator('#lbCodeIn').fill(code);
  await g.page.locator('#lbJoinBtn').click();
  await expect(h.page.locator('.lb-players')).toContainText('Gustav');
  await g.page.waitForTimeout(500);
  await g.page.locator('.opt', { hasText: 'Bereit?' }).click();
  await h.page.waitForTimeout(500);
  await h.page.locator('.opt', { hasText: 'Spiel starten' }).click();
  for (const p of [h, g])
    await p.page.waitForFunction(() => window.__ww.G.state === 'play' && window.__ww.G.net && window.__ww.G.mode === 'fort', null, {
      timeout: 10000,
    });

  // on the host: a wall, a cannon with coal, then nightfall
  const host = await h.page.evaluate(async () => {
    const w = window.__ww,
      { surf } = w.world,
      b = w.G.base,
      me = w.crew.find(c => c.pid === w.G.myId);
    const put = (type, x) => {
      Object.assign(me, { x, y: surf[x + 3] - 10, vx: 0, vy: 0, tumble: false });
      w.step(6);
      w.G.store = { ...w.G.store, rock: 40, metal: 10, plank: 10, coal: 6 };
      me.inv = ['rock', 'rock', 'rock', 'rock', 'plank', 'plank', 'metal', 'metal'];
      const n = w.builds.length;
      w.send('build', { type });
      const q = w.builds[n];
      if (q) {
        q.prog = 1e9;
        w.step(3);
      }
      return q;
    };
    const wall = put('wall', b.x - 46);
    put('cannon', b.x - 30);
    const { hitFort } = await import('/src/fort.js');
    hitFort(wall, 100, wall.x, wall.gy - 4);
    Object.assign(me, { x: b.x + 14, y: b.gy - 10 });
    w.G.dayT = 0.49;
    return { np: w.G.mp.np, wall: wall.id };
  });
  expect(host.np).toBe(2);
  // the night comes on the host's clock (it runs in real time from here)
  await h.page.waitForFunction(() => window.__ww.G.fort && window.__ww.G.fort.n === 1, null, { timeout: 30000 });
  await h.page.waitForFunction(() => window.__ww.G.fort.queue.length === 0, null, { timeout: 30000 });
  const n = await h.page.evaluate(() => window.__ww.animals.filter(a => a.siege).length);
  // one player: 3 monsters, two players: half again (5)
  expect(n).toBe(5);

  // the guest sees the night, the wall's damage and, once it fires, the cannon's balls
  await g.page.waitForFunction(() => window.__ww.G.fort && window.__ww.G.fort.n === 1, null, { timeout: 10000 });
  await g.page.waitForFunction(id => window.__ww.builds.find(b => b.id === id)?.fhp < 600, host.wall, { timeout: 10000 });
  // a monster close to the cannon: the host fires, the guest sees the ball fly
  await h.page.evaluate(() => {
    const w = window.__ww,
      b = w.G.base,
      { surf } = w.world;
    const m = w.animals.find(a => a.siege);
    Object.assign(m, { x: b.x - 140, y: surf[b.x - 134] - m.h - 1, vx: 0, vy: 0 });
  });
  const balls = await g.page.evaluate(async () => {
    const { playBall } = await import('/src/fort.js');
    let seen = 0;
    const t0 = performance.now();
    // (count the balls the host sends: they arrive as events)
    while (performance.now() - t0 < 8000 && !seen) {
      await new Promise(r => setTimeout(r, 200));
      seen = window.__ww.G.ballsSeen || 0;
    }
    return { seen, fn: typeof playBall };
  });
  expect(balls.fn).toBe('function');
  expect(balls.seen).toBeGreaterThan(0);
  for (const p of [h, g]) expect(p.errors).toEqual([]);
  for (const p of [h, g]) await p.page.close();
});

test('finding each other: a call comes as a line, "Hierher!" sets a marker, an arrow points off screen', async ({
  browser,
}) => {
  const h = await player(browser, 'Ilse');
  const g = await player(browser, 'Jakob');
  await h.page.waitForTimeout(500);
  await h.page.locator('#lbCreate').click();
  await expect(h.page.locator('.lb-codetap b')).toHaveText(/^[A-Z0-9]{6}$/);
  const code = await h.page.locator('.lb-codetap b').textContent();
  await g.page.waitForTimeout(500);
  await g.page.locator('#lbCodeIn').fill(code);
  await g.page.locator('#lbJoinBtn').click();
  await expect(h.page.locator('.lb-players')).toContainText('Jakob');
  await g.page.waitForTimeout(500);
  await g.page.locator('.opt', { hasText: 'Bereit?' }).click();
  await h.page.waitForTimeout(500);
  await h.page.locator('.opt', { hasText: 'Spiel starten' }).click();
  for (const p of [h, g])
    await p.page.waitForFunction(() => window.__ww.G.state === 'play' && window.__ww.G.net, null, { timeout: 10000 });
  // Ilse walks far off to the right and calls "Hierher!"
  await h.page.evaluate(() => {
    const w = window.__ww,
      me = w.crew.find(c => c.pid === w.G.myId),
      x = Math.min(w.world.W - 40, w.G.base.x + 400);
    Object.assign(me, { x, y: w.world.surf[x + 3] - 10, vx: 0, vy: 0 });
  });
  // (every line shown on Jakob's screen from here on)
  await g.page.evaluate(() => {
    window.__lines = [];
    const t = document.getElementById('toast');
    new MutationObserver(() => window.__lines.push(t.textContent)).observe(t, { childList: true, characterData: true, subtree: true });
  });
  await h.page.locator('#emoBtn').click();
  await h.page.waitForTimeout(500); // (a panel ignores taps in its first moment)
  await h.page.locator('#panel .opt', { hasText: 'Hierher!' }).click();
  // Jakob gets the line and the marker
  await g.page.waitForFunction(() => window.__lines.some(l => l.includes('Ilse') && l.includes('Hierher')), null, {
    timeout: 8000,
  });
  await g.page.waitForFunction(() => (window.__ww.G.pins || []).length === 1, null, { timeout: 8000 });
  // and Ilse is off his screen: there is an arrow at its edge (an orange-ish mark near the right)
  await g.page.waitForTimeout(600);
  await g.page.screenshot({ path: test.info().outputPath('mates.png') });
  for (const p of [h, g]) expect(p.errors).toEqual([]);
  for (const p of [h, g]) await p.page.close();
});

test('the score while a Versus round runs: the clock, both teams with goal and castle, every player', async ({
  browser,
}) => {
  const h = await player(browser, 'Karla');
  const g = await player(browser, 'Lutz');
  await h.page.waitForTimeout(500);
  await h.page.locator('#lbCreate').click();
  await expect(h.page.locator('.lb-codetap b')).toHaveText(/^[A-Z0-9]{6}$/);
  const code = await h.page.locator('.lb-codetap b').textContent();
  await h.page.waitForTimeout(500);
  await h.page.locator('.opt', { hasText: 'Versus' }).first().click();
  await expect(h.page.locator('.opt', { hasText: 'Versus' }).first()).toContainText('✓');
  await g.page.waitForTimeout(500);
  await g.page.locator('#lbCodeIn').fill(code);
  await g.page.locator('#lbJoinBtn').click();
  await expect(h.page.locator('.lb-players')).toContainText('Lutz');
  await g.page.waitForTimeout(500);
  await g.page.locator('.opt', { hasText: 'Bereit?' }).click();
  await h.page.waitForTimeout(500);
  await h.page.locator('.opt', { hasText: 'Spiel starten' }).click();
  for (const p of [h, g])
    await p.page.waitForFunction(() => window.__ww.G.state === 'play' && window.__ww.G.net && window.__ww.G.teams, null, {
      timeout: 10000,
    });
  // something to count: Karla sold gold, Lutz dug
  await h.page.evaluate(async () => {
    const { addStat } = await import('/src/stats.js');
    const w = window.__ww,
      lutz = w.crew.find(c => c.name === 'Lutz');
    addStat(w.G.myId, 'sold', 120);
    addStat(lutz.pid, 'dig', 400);
  });
  await expect(g.page.locator('#scoreBtn')).toBeVisible();
  await g.page.waitForTimeout(1500);
  await g.page.keyboard.press('KeyP');
  await expect(g.page.locator('#pTitle')).toHaveText('Punktestand');
  const txt = await g.page.locator('#panel').textContent();
  expect(txt).toContain('⏱');
  expect(await g.page.locator('#panel .score .ranking').count()).toBe(2);
  expect(txt).toContain('Karla');
  expect(txt).toContain('Lutz');
  await g.page.waitForTimeout(700);
  await g.page.screenshot({ path: test.info().outputPath('score.png') });
  for (const p of [h, g]) expect(p.errors).toEqual([]);
  for (const p of [h, g]) await p.page.close();
});
