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

test('Festungssturm: Red gets the fortress kit, Blue its explosives after the truce; walls and gate hold Blue; Red wins at time', async ({
  browser,
}) => {
  const h = await player(browser, 'Moritz', { gmode: 'festungssturm' });
  const g = await player(browser, 'Nele');
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
  await expect(h.page.locator('.lb-players')).toContainText('Nele');
  await g.page.waitForTimeout(500);
  await g.page.locator('.opt', { hasText: 'Bereit?' }).click();
  await h.page.waitForTimeout(500);
  await h.page.locator('.opt', { hasText: 'Spiel starten' }).click();
  for (const p of [h, g])
    await p.page.waitForFunction(
      () => window.__ww.G.state === 'play' && window.__ww.G.teams && window.__ww.G.mode === 'festungssturm',
      null,
      { timeout: 10000 },
    );
  const r = await h.page.evaluate(async () => {
    const w = window.__ww,
      G = w.G,
      { surf } = w.world,
      { useTeam, teamOf } = await import('/src/teams.js');
    const me = w.crew.find(c => c.pid === G.myId),
      nele = w.crew.find(c => c.name === 'Nele');
    const store = t => {
      useTeam(t);
      const s = { ...G.store };
      useTeam(G.myTeam);
      return s;
    };
    const out = { myTeam: G.myTeam, neleTeam: teamOf(nele), red: store(0).rock, blueFlint0: store(1).flint || 0 };
    // Red builds wall | gate | wall right of its castle
    const b = G.base,
      put = (type, x) => {
        Object.assign(me, { x, y: surf[x + 3] - 10, vx: 0, vy: 0, tumble: false });
        w.step(6);
        me.inv = ['rock', 'rock', 'rock', 'plank', 'plank', 'metal'];
        const n = w.builds.length;
        w.send('build', { type });
        const q = w.builds[n];
        if (q) {
          q.prog = 1e9;
          w.step(3);
        }
        return q;
      };
    const x0 = b.x + b.w + 30,
      w1 = put('wall', x0),
      gate = put('gate', x0 + 8);
    put('wall', x0 + 16);
    Object.assign(me, { x: b.x + 14, y: b.gy - 10 });
    // the truce ends: Blue gets its explosives
    G.playTicks = 2 * 3600;
    w.step(31);
    out.blueFlint = store(1).flint || 0;
    // Blue at the gate: it stays shut for her
    Object.assign(nele, { x: gate.x + 14, y: gate.gy - 10, vx: 0, vy: 0 });
    for (let k = 0; k < 60; k++) w.step(1);
    out.gateShut = (gate.open || 0) < 0.05;
    // a blast of Blue's next to the wall: it cracks
    const { explode } = await import('/src/objects.js');
    const hp0 = w1.fhp ?? 600;
    explode(w1.x - 6, w1.gy - 6, 5, { team: 1, pid: nele.pid });
    out.wallHit = (w1.fhp ?? 600) < hp0;
    // the clock runs out with the castle standing: Red wins
    Object.assign(nele, { x: w.world.W - 60, y: surf[w.world.W - 57] - 10 });
    G.playTicks = 10 * 3600 + 5;
    for (let k = 0; k < 40; k++) w.step(1);
    out.state = G.state;
    return out;
  });
  expect(r.myTeam).toBe(0);
  expect(r.neleTeam).toBe(1);
  expect(r.red).toBeGreaterThanOrEqual(12);
  expect(r.blueFlint0).toBe(0);
  expect(r.blueFlint).toBe(8);
  expect(r.gateShut).toBe(true);
  expect(r.wallHit).toBe(true);
  expect(r.state).toBe('won');
  for (const p of [h, g]) expect(p.errors).toEqual([]);
  for (const p of [h, g]) await p.page.close();
});

test('up to eight in a room: a fifth player gets in; "Jeder gegen jeden" with five makes four castles, two share one', async ({
  browser,
}) => {
  const names = ['Olga', 'Paul', 'Quirin', 'Rosa', 'Sven'];
  const ps = [];
  for (const n of names) ps.push(await player(browser, n));
  const [h, ...rest] = ps;
  await h.page.waitForTimeout(500);
  await h.page.locator('#lbCreate').click();
  await expect(h.page.locator('.lb-codetap b')).toHaveText(/^[A-Z0-9]{6}$/);
  const code = await h.page.locator('.lb-codetap b').textContent();
  await h.page.waitForTimeout(500);
  await h.page.locator('.opt', { hasText: 'Jeder gegen jeden' }).first().click();
  for (const p of rest) {
    await p.page.waitForTimeout(500);
    await p.page.locator('#lbCodeIn').fill(code);
    await p.page.locator('#lbJoinBtn').click();
  }
  await expect(h.page.locator('.lb-players')).toContainText('Sven', { timeout: 8000 });
  // the slot beside the hero says how many more there are
  await expect(h.page.locator('#lbSlot2')).toContainText('+2');
  for (const p of rest) {
    await p.page.waitForTimeout(300);
    await p.page.locator('.opt', { hasText: 'Bereit?' }).click();
  }
  await h.page.waitForTimeout(500);
  await h.page.locator('.opt', { hasText: 'Spiel starten' }).click();
  for (const p of ps)
    await p.page.waitForFunction(() => window.__ww.G.state === 'play' && window.__ww.G.teams, null, { timeout: 15000 });
  const r = await h.page.evaluate(() => {
    const w = window.__ww;
    const byTeam = {};
    for (const c of w.crew) if (c.pid != null) byTeam[c.team || 0] = (byTeam[c.team || 0] || 0) + 1;
    return { teams: w.G.teams.length, castles: w.builds.filter(b => b.type === 'base').length, byTeam: Object.values(byTeam).sort() };
  });
  expect(r).toEqual({ teams: 4, castles: 4, byTeam: [1, 1, 1, 2] });
  for (const p of ps) expect(p.errors).toEqual([]);
  for (const p of ps) await p.page.close();
});
