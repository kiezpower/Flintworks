// Gamepads (gamepad.js): a pad (here a pretend one) starts the game from the lobby, walks, jumps,
// opens the build menu and moves through it, and B goes back: npm test
import { expect, test } from '@playwright/test';

// a pretend gamepad in the standard layout; the test moves its stick and presses its buttons
// (id: the name the browser gives the pad; its rumble motor writes down what it was asked to do)
async function withPad(page, id = 'Xbox Wireless Controller (STANDARD GAMEPAD)') {
  await page.addInitScript(id => {
    const buttons = Array.from({ length: 17 }, () => ({ pressed: false, value: 0 }));
    window.__rumble = [];
    const vibrationActuator = {
      type: 'dual-rumble',
      playEffect: (t, o) => (window.__rumble.push(o), Promise.resolve('complete')),
    };
    window.__pad = { axes: [0, 0, 0, 0], buttons };
    navigator.getGamepads = () => [
      { index: 0, id, connected: true, mapping: 'standard', axes: window.__pad.axes, buttons, vibrationActuator },
    ];
  }, id);
}
const B = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, DOWN: 13 };
// hold a button for a few ticks, then let go
const press = async (page, b) => {
  await page.evaluate(k => (window.__pad.buttons[k].pressed = true), B[b]);
  await page.waitForTimeout(120);
  await page.evaluate(k => (window.__pad.buttons[k].pressed = false), B[b]);
  await page.waitForTimeout(120);
};

test('with a gamepad: start from the lobby, walk, jump, build menu, back', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await withPad(page);
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.setItem('flintworks-lang', 'de');
    localStorage.setItem('flintworks-profile', JSON.stringify({ tutorialDone: true, installAsked: 'done', games: 3 }));
  });
  await page.reload();
  await page.waitForFunction(() => window.__ww);
  // in the lobby: the focus on "Spielen", A starts the game
  await page.focus('#lbPlay');
  await press(page, 'A');
  await page.waitForFunction(() => window.__ww.state === 'play', null, { timeout: 8000 });
  await page.waitForTimeout(800);
  // the stick to the right: the Wühler walks right
  const x0 = await page.evaluate(() => window.__ww.crew.find(c => c.pid === window.__ww.G.myId).x);
  await page.evaluate(() => (window.__pad.axes[0] = 1));
  await page.waitForTimeout(700);
  await page.evaluate(() => (window.__pad.axes[0] = 0));
  const x1 = await page.evaluate(() => window.__ww.crew.find(c => c.pid === window.__ww.G.myId).x);
  expect(x1).toBeGreaterThan(x0 + 5);
  // A: a jump
  await page.evaluate(() => (window.__minY = 1e9));
  await page.evaluate(() => {
    const me = window.__ww.crew.find(c => c.pid === window.__ww.G.myId);
    window.__y0 = me.y;
    window.__watch = setInterval(() => (window.__minY = Math.min(window.__minY, me.y)), 16);
  });
  await press(page, 'A');
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => window.__y0 - window.__minY)).toBeGreaterThan(4);
  // RB: the build menu; the d-pad moves the focus to an option; B closes it
  await press(page, 'RB');
  await expect(page.locator('#panel')).toBeVisible();
  await page.waitForTimeout(500);
  await press(page, 'DOWN');
  expect(await page.evaluate(() => !!document.activeElement.closest('#panel'))).toBe(true);
  await press(page, 'B');
  await expect(page.locator('#panel')).toBeHidden();
  // and the arrow the pad sent did not leave a key held: the Wühler stands still
  const xa = await page.evaluate(() => window.__ww.crew.find(c => c.pid === window.__ww.G.myId).x);
  await page.waitForTimeout(500);
  const xb = await page.evaluate(() => window.__ww.crew.find(c => c.pid === window.__ww.G.myId).x);
  expect(Math.abs(xb - xa)).toBeLessThan(2);
  expect(errors).toEqual([]);
});

test('two at one device: the second player with the pad, the first with the keys, the camera keeps both', async ({
  page,
}) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await withPad(page);
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.setItem('flintworks-lang', 'de');
    localStorage.setItem('flintworks-profile', JSON.stringify({ tutorialDone: true, installAsked: 'done', games: 3 }));
  });
  await page.reload();
  await page.waitForFunction(() => window.__ww);
  // in the lobby: "Zusammen spielen" → "Zu zweit an diesem Gerät"
  await page.click('#lbSlot1');
  await expect(page.locator('#lbLocal')).toBeVisible();
  await page.waitForTimeout(500);
  await page.click('#lbLocal');
  await expect(page.locator('#lbLocal')).toContainText('✓');
  await page.keyboard.press('Escape');
  await expect(page.locator('#lbSlot1')).toContainText('Spieler 2');
  await page.click('#lbPlay');
  await page.waitForFunction(() => window.__ww.state === 'play', null, { timeout: 8000 });
  await page.waitForTimeout(800);
  const pos = () =>
    page.evaluate(() => {
      const w = window.__ww;
      return { p1: w.crew.find(c => c.pid === 0).x, p2: w.crew.find(c => c.pid === 1)?.x, np: w.G.mp.np };
    });
  const a = await pos();
  expect(a.p2).toBeDefined();
  expect(a.np).toBe(2);
  // the pad moves player 2 only
  await page.evaluate(() => (window.__pad.axes[0] = 1));
  await page.waitForTimeout(700);
  await page.evaluate(() => (window.__pad.axes[0] = 0));
  const b = await pos();
  expect(b.p2).toBeGreaterThan(a.p2 + 5);
  expect(Math.abs(b.p1 - a.p1)).toBeLessThan(3);
  // the keys move player 1
  await page.keyboard.down('ArrowLeft');
  await page.waitForTimeout(700);
  await page.keyboard.up('ArrowLeft');
  const c = await pos();
  expect(c.p1).toBeLessThan(b.p1 - 5);
  // the camera keeps both in view
  await page.waitForTimeout(800);
  const inView = await page.evaluate(async () => {
    const { cam } = await import('/src/render.js');
    const w = window.__ww;
    return w.crew.filter(q => q.pid != null).every(q => q.x > cam.x && q.x < cam.x + w.G.VW);
  });
  expect(inView).toBe(true);
  await page.screenshot({ path: test.info().outputPath('local.png') });
  expect(errors).toEqual([]);
});

test('two at one device: the second player opens the build menu with RB and builds where he stands', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await withPad(page);
  await page.goto('/?seed=7');
  await page.evaluate(() => {
    localStorage.setItem('flintworks-lang', 'de');
    localStorage.setItem(
      'flintworks-profile',
      JSON.stringify({ tutorialDone: true, installAsked: 'done', games: 3, local: true, mode: 'meadow' }),
    );
  });
  await page.reload();
  await page.waitForFunction(() => window.__ww);
  await page.click('#lbPlay');
  await page.waitForFunction(() => window.__ww.state === 'play' && window.__ww.crew.some(c => c.pid === 1), null, {
    timeout: 8000,
  });
  // player 2 on flat ground away from the castle, with what a hut costs
  const x = await page.evaluate(() => {
    const w = window.__ww,
      { surf } = w.world,
      p2 = w.crew.find(c => c.pid === 1);
    let x = w.G.base.x + 120;
    while (Math.abs(surf[x] - surf[x + 30]) > 1 && x < 900) x++;
    Object.assign(p2, { x: x + 10, y: surf[x + 13] - 10, vx: 0, vy: 0 });
    w.G.store = { ...w.G.store, wood: 6, rock: 4 };
    return x + 10;
  });
  await page.waitForTimeout(300);
  await press(page, 'RB');
  await expect(page.locator('#panel')).toBeVisible();
  expect(await page.evaluate(() => window.__ww.G.panelPid)).toBe(1);
  await page.waitForTimeout(500);
  await page.locator('#panel [data-tut="b_hut"]').click();
  const hut = await page.evaluate(() => window.__ww.builds.find(b => b.type === 'hut'));
  expect(hut).toBeTruthy();
  expect(Math.abs(hut.x + hut.w / 2 - (x + 3))).toBeLessThan(6);
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => window.__ww.G.panelPid)).toBe(null);
  expect(errors).toEqual([]);
});

test('with a gamepad: LT changes the weapon, the right stick aims the bow and Y shoots that way, the pad rumbles', async ({
  page,
}) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await withPad(page);
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.setItem('flintworks-lang', 'de');
    localStorage.setItem('flintworks-profile', JSON.stringify({ tutorialDone: true, installAsked: 'done', games: 3 }));
  });
  await page.reload();
  await page.waitForFunction(() => window.__ww);
  await page.focus('#lbPlay');
  await press(page, 'A');
  await page.waitForFunction(() => window.__ww.state === 'play', null, { timeout: 8000 });
  await page.waitForTimeout(500);
  // a bow and a sword (both researched and bought), the bow in hand (the money for them only for a
  // moment: so much would win the round's goal)
  await page.evaluate(() => {
    const w = window.__ww,
      m0 = w.G.money;
    w.G.money = 9999;
    w.G.store = { wood: 50, plank: 50, metal: 50, rock: 50, coal: 50 };
    const t = { ...(w.G.tools || {}) };
    for (const id of ['mech', 'metal', 'archery', 'rails', 'armor', 'flight']) t['r_' + id] = true;
    w.G.tools = t;
    if (w.G.base) w.G.base.lvl = 3;
    w.send('tool', { id: 'bow' });
    w.send('tool', { id: 'sword' });
    w.send('wield', { id: 'bow' });
    w.G.money = m0;
  });
  const me = () => page.evaluate(() => window.__ww.crew.find(c => c.pid === window.__ww.G.myId).wield);
  expect(await me()).toBe('bow');
  // LT: the next slot (the sword), and again: on round
  await press(page, 'LT');
  expect(await me()).toBe('sword');
  await press(page, 'LT');
  expect(await me()).not.toBe('sword');
  await page.evaluate(() => window.__ww.send('wield', { id: 'bow' }));
  // the right stick straight up: the dotted line of the bow
  await page.evaluate(() => (window.__pad.axes[3] = -1));
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => [window.__ww.G.aimKind, Math.round(window.__ww.G.aimDrag?.ay)])).toEqual(['bow', -1]);
  // Y shoots up
  const n0 = await page.evaluate(() => window.__ww.arrows().length);
  await page.evaluate(() => (window.__pad.buttons[3].pressed = true));
  await page.waitForTimeout(60);
  const shot = await page.evaluate(() => {
    const a = window.__ww.arrows();
    return a.length ? { n: a.length, vx: a[a.length - 1].vx, vy: a[a.length - 1].vy } : { n: 0 };
  });
  await page.evaluate(() => (window.__pad.buttons[3].pressed = false));
  expect(shot.n).toBeGreaterThan(n0);
  expect(shot.vy).toBeLessThan(-3);
  expect(Math.abs(shot.vx)).toBeLessThan(1);
  // the stick back in the middle: no line any more
  await page.evaluate(() => (window.__pad.axes[3] = 0));
  await page.waitForTimeout(150);
  expect(await page.evaluate(() => window.__ww.G.aimDrag || null)).toBeNull();
  // a shake goes to the pad that is played, not to the phone
  await page.evaluate(() => {
    window.__phone = 0;
    navigator.vibrate = () => (window.__phone++, true);
    window.__ww.G.vibe = true;
    window.__ww.buzz(60);
  });
  expect(await page.evaluate(() => [window.__rumble.length > 0, window.__phone])).toEqual([true, 0]);
  expect(errors).toEqual([]);
});

test('a Nintendo pad: the hints name its buttons (the bottom one is B there)', async ({ page }) => {
  await withPad(page, 'Pro Controller (STANDARD GAMEPAD Vendor: 057e Product: 2009)');
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('flintworks-lang', 'de'));
  await page.reload();
  await page.waitForFunction(() => window.__ww);
  const r = await page.evaluate(() => {
    const ev = new Event('gamepadconnected');
    ev.gamepad = navigator.getGamepads()[0];
    dispatchEvent(ev);
    return { toast: document.getElementById('toast').textContent, l: window.__ww.G.padLabels() };
  });
  expect(r.toast).toContain('B springen, Y graben, A Aktion, X werfen, ZL Waffe');
  expect([r.l.A, r.l.B, r.l.LB, r.l.START]).toEqual(['B', 'A', 'L', '+']);
  // and a PlayStation pad its symbols
  const ps = await page.evaluate(() => window.__ww.G.padLabels('DualSense Wireless Controller (Vendor: 054c)'));
  expect([ps.A, ps.B, ps.Y]).toEqual(['✕', '○', '△']);
});
