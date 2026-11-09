// The lift (buildings.js liftUpd): digging sideways out of the cab, and calling it with the action
// button from the top of the shaft or from a tunnel that meets it: npm test
import { expect, test } from '@playwright/test';

test('dig out of the lift sideways, then call it up from below and down from the top', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/?seed=7');
  await page.evaluate(() => {
    localStorage.setItem('flintworks-lang', 'de');
    localStorage.setItem(
      'flintworks-profile',
      JSON.stringify({ tutorialDone: true, installAsked: 'done', games: 3, mode: 'meadow', diff: 'relaxed' }),
    );
  });
  await page.reload();
  await page.waitForFunction(() => window.__ww);
  await page.click('#lbPlay');
  await page.waitForFunction(() => window.__ww.state === 'play');
  const r = await page.evaluate(async () => {
    const w = window.__ww,
      G = w.G,
      K = w.keys;
    const { mat, W, AIR, EARTH, surf } = await import('/src/world.js');
    const me = w.crew.find(c => c.pid === G.myId);
    for (const c of [...w.crew]) if (c !== me) w.crew.splice(w.crew.indexOf(c), 1);
    // flat earth, a finished lift on it
    const bx = G.base.x + 200,
      gy = surf[bx];
    for (let x = bx - 40; x < bx + 60; x++) {
      for (let y = gy - 40; y < gy; y++) mat[y * W + x] = AIR;
      for (let y = gy; y < gy + 90; y++) mat[y * W + x] = EARTH;
      surf[x] = gy;
    }
    w.world.paintAll?.();
    const b = { id: 9981, type: 'lift', x: bx, gy, w: 16, h: 22, prog: 1, done: true, busy: 0, moving: 0, team: 0 };
    b.cs = { x: bx + 2, y: gy - 2, home: gy - 2 };
    w.builds.push(b);
    w.foundation(b);
    const out = {};
    // on the cab, stick down: it digs the shaft 40 rows down
    Object.assign(me, { x: bx + 5, y: b.cs.y - me.h, vx: 0, vy: 0 });
    w.step(5);
    K.d = 1;
    for (let n = 0; n < 400 && b.cs.y < gy + 40; n++) w.step(1);
    K.d = K.u = 0;
    w.step(5);
    out.down = Math.round(b.cs.y - gy);
    out.riding = Math.abs(me.y + me.h - b.cs.y) < 1.5;
    // push right into the shaft wall: the Wühler digs a tunnel out of the cab (the cab stays put)
    const cabY = b.cs.y;
    K.r = 1;
    for (let n = 0; n < 240; n++) w.step(1);
    K.r = K.l = 0;
    w.step(20);
    out.dugOut = Math.round(me.x - (b.cs.x + 12));
    out.cabStill = b.cs.y === cabY;
    // in the tunnel, ride the cab up without him; then call it back down to his feet
    b.cs.y = b.cs.home;
    Object.assign(me, { x: b.cs.x + 14, vx: 0 });
    w.step(10);
    out.feet = Math.round(me.y + me.h - gy);
    out.label = w.context(me).label;
    w.edge.act = true;
    w.step(1);
    for (let n = 0; n < 200 && b.call != null; n++) w.step(1);
    // (to the foot of the tunnel, or as deep as the shaft goes)
    out.cabAtFeet = Math.abs(b.cs.y - (me.y + me.h)) < 2 && b.cs.y > gy + 30;
    // step on, ride up
    K.l = 1;
    w.step(25);
    K.r = K.l = 0;
    w.step(5);
    out.onAgain = Math.abs(me.y + me.h - b.cs.y) < 1.5;
    K.u = 1;
    for (let n = 0; n < 300 && b.cs.y > b.cs.home; n++) w.step(1);
    K.d = K.u = 0;
    out.top = b.cs.y === b.cs.home;
    // the cab down below, the player at the top beside the shaft: call it up
    b.cs.y = b.deep;
    Object.assign(me, { x: bx - 8, y: gy - me.h - 1, vx: 0, vy: 0 });
    w.step(10);
    out.topLabel = w.context(me).label;
    w.edge.act = true;
    w.step(1);
    for (let n = 0; n < 200 && b.call != null; n++) w.step(1);
    out.home = b.cs.y === b.cs.home;
    return out;
  });
  expect(r.down).toBeGreaterThanOrEqual(38);
  expect(r.riding).toBe(true);
  expect(r.dugOut).toBeGreaterThan(4);
  expect(r.cabStill).toBe(true);
  expect(r.label, JSON.stringify(r)).toBe("Rufen");
  expect(r.cabAtFeet, JSON.stringify(r)).toBe(true);
  expect(r.onAgain, JSON.stringify(r)).toBe(true);
  expect(r.top).toBe(true);
  expect(r.topLabel).toBe('Rufen');
  expect(r.home, JSON.stringify(r)).toBe(true);
  expect(errors).toEqual([]);
});
