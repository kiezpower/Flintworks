// Wooden stairs are platforms: you walk under them from the side, jump up through them and
// drop down through them, but walk up on them from above: npm test
import { expect, test } from '@playwright/test';

test('wooden stairs can be passed from the side and walked on from above', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('flintworks-lang', 'de');
  });
  await page.reload();
  await page.waitForFunction(() => window.__ww);
  await page.click('#lbPlay');
  const r = await page.evaluate(() => {
    const w = window.__ww,
      { mat, W, AIR, EARTH, PLANK, paint } = w.world,
      c = w.crew[0];
    // a flat test field right of the teaching path, nobody else around
    const X0 = 400,
      X1 = 600,
      gy = 200;
    for (let x = X0; x < X1; x++)
      for (let y = 0; y < gy + 20; y++) {
        mat[y * W + x] = y < gy ? AIR : EARTH;
        paint(y * W + x);
      }
    w.crew.splice(1);
    w.animals.length = 0;
    const hold = (k, n) => {
      w.keys[k] = 1;
      w.step(n);
      w.keys[k] = 0;
    };
    const place = x => {
      c.x = x;
      c.y = gy - 10;
      c.vx = c.vy = 0;
      c.face = 1;
      w.step(5);
    };
    const onStair = () => {
      const y = Math.floor(c.y) + 10;
      for (let dx = 0; dx < 6; dx++) if (mat[y * W + Math.floor(c.x) + dx] === PLANK) return true;
      return false;
    };
    const out = {};
    // build stairs going up to the right
    place(430);
    c.inv = ['plank'];
    w.send('stairs');
    w.step(160);
    let x1 = 0;
    for (let x = X0; x < X1; x++) for (let y = 0; y < gy; y++) if (mat[y * W + x] === PLANK) x1 = Math.max(x1, x);
    out.built = x1 > 450;
    out.top = gy - Math.min(...[...Array(gy).keys()].filter(y => mat[y * W + x1] === PLANK));
    // from the right: walk under the high end to the left until the stair is under the feet
    place(x1 + 20);
    let stepped = false;
    w.keys.l = 1;
    for (let i = 0; i < 300 && !stepped; i++) {
      w.step(1);
      stepped = onStair();
    }
    w.keys.l = 0;
    out.passedUnder = c.x < x1 - 15;
    out.steppedOn = stepped;
    // turning round there walks up the stair to its top (and on to a bridge built from there)
    const high = () => onStair() && gy - (c.y + 10) >= out.top - 3;
    w.keys.r = 1;
    for (let i = 0; i < 200 && !high(); i++) w.step(1);
    w.keys.r = 0;
    out.atTop = high();
    w.step(20);
    // down drops through the stair to the ground
    hold('d', 4);
    w.step(40);
    out.dropped = !onStair() && Math.abs(c.y - (gy - 10)) < 1.5;
    // under the middle of the stair a jump goes up through it and lands on it
    place(x1 - 15);
    w.edge.jump = true;
    w.step(60);
    out.jumpedOn = onStair();
    return out;
  });
  expect(r).toEqual({
    built: true,
    top: r.top,
    passedUnder: true,
    steppedOn: true,
    dropped: true,
    jumpedOn: true,
    atTop: true,
  });
  expect(r.top).toBeGreaterThan(14);
  expect(errors).toEqual([]);
});
