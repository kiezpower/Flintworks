// Forgiving jumps (digger.js): a player can still jump a few frames after running off an edge
// ("coyote time"), and a jump pressed just before landing is done on landing; later than that
// nothing happens, as before: npm test
import { expect, test } from '@playwright/test';

test('coyote time and a jump buffer for the player', async ({ page }) => {
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
      G = w.G;
    const { edge, keys } = await import('/src/input.js');
    const { mat, W, AIR, ROCK, free } = await import('/src/world.js');
    const me = w.crew.find(c => c.pid === G.myId);
    for (const c of [...w.crew]) if (c !== me) w.crew.splice(w.crew.indexOf(c), 1);
    // a room in the air: a ledge on the left, a floor far below
    const x0 = G.base.x + 320,
      top = 40;
    const fill = (x1, y1, x2, y2, m) => {
      for (let y = y1; y < y2; y++) for (let x = x1; x < x2; x++) mat[y * W + x] = m;
    };
    const run = () => {
      fill(x0 - 60, top, x0 + 100, top + 120, AIR);
      fill(x0 - 60, top + 60, x0 + 4, top + 63, ROCK); // the ledge, its edge at x0+4
      fill(x0 - 60, top + 110, x0 + 100, top + 113, ROCK); // the floor
      Object.assign(me, { x: x0 - 20, y: top + 50, vx: 0, vy: 0, climb: false, hangle: false, tumble: false });
      w.step(5);
    };
    const onG = () => !free(me.x, me.y + 1, 6, 10);
    // runs off the ledge to the right, and presses jump `late` frames after leaving it
    const offEdge = late => {
      run();
      keys.r = 1;
      let k = 0;
      while (onG() && k++ < 200) w.step(1);
      for (let q = 0; q < late; q++) w.step(1);
      edge.jump = true;
      w.step(1);
      keys.r = 0;
      return me.vy < -1.5;
    };
    const coyote = offEdge(3),
      tooLate = offEdge(14);
    // falls to the floor, and presses jump `before` frames before landing
    const landing = before => {
      run();
      Object.assign(me, { x: x0 + 40, y: top + 70, vx: 0, vy: 0 });
      // (first: when does it land without a jump)
      let k = 0;
      while (!onG() && k++ < 200) {
        w.step(1);
      }
      const landAt = k;
      Object.assign(me, { x: x0 + 40, y: top + 70, vx: 0, vy: 0 });
      for (let q = 0; q < landAt - before; q++) w.step(1);
      edge.jump = true;
      let jumped = false;
      for (let q = 0; q < before + 6; q++) {
        w.step(1);
        if (me.vy < -1.5) jumped = true;
      }
      return jumped;
    };
    return { coyote, tooLate, buffered: landing(4), early: landing(16) };
  });
  expect(r).toEqual({ coyote: true, tooLate: false, buffered: true, early: false });
  expect(errors).toEqual([]);
});
