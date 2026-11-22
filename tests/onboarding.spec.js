// First launch and the tutorial beyond the straight path: touch and classic controls, players
// who know the game, players who ignore every hint, the HUD that shows only what is useful,
// the teaching path's collision, failure-safe analytics and layouts at many sizes: npm test
import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { playPastIntro } from './skipintro.js';

const BOT = readFileSync(new URL('./tutorial-bot.js', import.meta.url), 'utf8');

async function fresh(page, { lang = 'de', profile = null, url = '/' } = {}) {
  await page.goto('/');
  await page.evaluate(
    ([l, p]) => {
      localStorage.clear();
      localStorage.setItem('flintworks-lang', l);
      if (p) localStorage.setItem('flintworks-profile', JSON.stringify(p));
    },
    [lang, profile],
  );
  await page.goto(url);
  await page.waitForFunction(() => window.__ww);
  await page.addScriptTag({ content: BOT });
}
const visible = (page, sel) => page.evaluate(s => !!document.querySelector(s)?.offsetParent, sel);

test('the start screen: language switch does not start, a tap does; the HUD stays hidden', async ({ page }) => {
  await fresh(page);
  expect(await visible(page, '#menuBtn')).toBe(false);
  await page.click('#veilLang');
  await expect(page.locator('#veilLang')).toHaveText('Deutsch');
  await expect(page.locator('#veilGo b')).toHaveText('Play');
  expect(await page.evaluate(() => window.__ww.state)).toBe('veil');
  await page.click('#veilLang');
  await page.mouse.click(100, 400); // anywhere on the screen
  await expect(page.locator('#veil')).toBeHidden();
  // the story intro comes first; any key skips it
  await expect(page.locator('.introSkip')).toBeVisible();
  expect(await visible(page, '#menuBtn')).toBe(false);
  await page.waitForTimeout(600);
  await page.keyboard.press('Space');
  await page.waitForFunction(() => window.__ww.state === 'play');
  expect(await page.evaluate(() => [window.__ww.state, window.__ww.tut?.i])).toEqual(['play', 0]);
  // the first beat: no crew bar, no build button, no map, no money, no pack yet
  await page.evaluate(() => window.__ww.step(10));
  for (const sel of ['#crew', '#buildBtn', '#miniThumb', '.purse', '#inv'])
    expect(await visible(page, sel), sel).toBe(false);
  // (the HUD follows on the next drawn frames)
  await expect(page.locator('#menuBtn')).toBeVisible();
});

test('no install offer and no lobby before the first real round', async ({ page }) => {
  await fresh(page);
  await page.waitForTimeout(2200);
  await expect(page.locator('#panel')).toBeHidden();
});

test('links to the Tagesschicht or a room still open the lobby for a new player', async ({ page }) => {
  await fresh(page, { url: '/?daily' });
  await expect(page.locator('#veil')).toBeHidden();
});

test('the HUD turns up when it becomes useful: the pack with the first find, the action button with the beam', async ({ page }) => {
  await fresh(page);
  await playPastIntro(page);
  await page.evaluate(() => (window.__ww.G.inputKind = 'keys'));
  await page.evaluate(() => window.bot.run(5400)); // walk
  await page.waitForTimeout(150);
  expect(await visible(page, '#inv')).toBe(false);
  await page.evaluate(() => window.bot.run(5400)); // dig: earth in the pack
  await page.evaluate(() => window.bot.run(5400)); // mine: flint and ore
  await page.waitForTimeout(150);
  expect(await visible(page, '#inv')).toBe(true);
  // the action button comes with the old beam at the abyss
  await expect(page.locator('#game')).not.toHaveClass(/onb-act/);
  await page.evaluate(() => {
    const w = window.__ww;
    for (let k = 0; k < 600 && !w.crew[0].inv.includes('wood'); k++) {
      window.bot.release();
      window.bot.act(k);
      w.step(1);
    }
    window.bot.release();
  });
  await expect(page.locator('#game')).toHaveClass(/onb-act/);
  // no money in the tutorial
  expect(await visible(page, '.purse')).toBe(false);
});

test('touch: texts and the stick hand, the jump hint at the bump with the jump button', async ({ page }) => {
  await fresh(page);
  await playPastIntro(page);
  const r = await page.evaluate(() => {
    const w = window.__ww,
      c = w.crew[0],
      B = w.tutLevel.TUT.bump;
    w.G.inputKind = 'touch';
    // stand right in front of the bump and wait
    c.x = B.x0 - 8;
    w.step(80);
    return document.getElementById('questText').textContent;
  });
  expect(r).toBe('Spring drüber: Sprung');
  await page.waitForTimeout(150);
  await expect(page.locator('.pad.jump')).toHaveClass(/tut-hl/);
  expect(await page.evaluate(() => window.__ww.analytics.sessionEvents().find(e => e.e === 'onb_hint'))).toMatchObject({
    step: 'walk',
    level: 'jump',
  });
});

test('classic controls: the dig button is asked for, shaft and walls are dug with it', async ({ page }) => {
  await fresh(page, { profile: { autodig: false } });
  await playPastIntro(page);
  await page.evaluate(() => (window.__ww.G.inputKind = 'keys'));
  expect(await page.evaluate(() => window.__ww.G.autoDig)).toBe(false);
  await page.evaluate(() => window.bot.run(5400));
  await page.evaluate(() => {
    window.__ww.tut.s.shown = true;
    window.__ww.step(1);
  });
  await expect(page.locator('#questText')).toHaveText('Grab neben dem Brunnen nach unten: Shift halten, ↓ lenkt');
  for (const id of ['dig', 'mine']) expect(await page.evaluate(() => window.bot.run(5400))).not.toBe(id);
});

test('a player who knows the game never sees a prompt after the first one', async ({ page }) => {
  await fresh(page);
  await playPastIntro(page);
  await page.evaluate(() => (window.__ww.G.inputKind = 'keys'));
  const texts = new Set();
  for (let k = 0; k < 6; k++) {
    await page.evaluate(() => window.bot.run(5400));
    if (await page.evaluate(() => !!window.__ww.tut))
      texts.add(await page.evaluate(() => document.getElementById('questText').textContent));
  }
  expect([...texts]).toEqual(['']);
  const done = await page.evaluate(() =>
    window.__ww.analytics.sessionEvents().filter(e => e.e === 'onb_step_done' || e.e === 'onb_complete'),
  );
  expect(done.map(e => e.prompted)).toEqual([true, false, false, false, false, false, undefined]);
  expect(done.at(-1).skilled).toBe(true);
  // the card comes at once, without the confetti pause
  await expect(page.locator('#overlay')).toBeVisible({ timeout: 500 });
});

test('out of order: the bump tunnelled under and flint and ore already in the pack still work', async ({ page }) => {
  await fresh(page);
  await playPastIntro(page);
  const r = await page.evaluate(() => {
    const w = window.__ww,
      c = w.crew[0],
      T = w.tutLevel.TUT,
      floor = w.tutLevel.ground() + T.cave.floor;
    c.inv.push('flint', 'ore');
    c.x = T.well.x; // past the bump some other way
    w.step(4);
    const a = w.tut.i;
    // and down into the cave some other way
    Object.assign(c, { x: T.cave.x0 + 30, y: floor - 10, vx: 0, vy: 0 });
    w.step(4);
    const b = w.tut.i;
    w.step(4);
    return [a, b, w.tut.i];
  });
  // walk done, dig done, mine done at once (both are already there), now the bridge
  expect(r).toEqual([1, 3, 3]);
});

test('ignoring every hint: each step has a rescue that gets you through', async ({ page }) => {
  test.setTimeout(240_000);
  await fresh(page);
  await playPastIntro(page);
  const r = await page.evaluate(() => {
    const w = window.__ww,
      c = w.crew[0],
      T = w.tutLevel.TUT,
      ids = w.tutLevel.steps(),
      out = [];
    const id = () => (w.tut ? ids[w.tut.i] : 'end');
    // walks right but never jumps: lifted over the bump
    for (let k = 0; k < 60 * 60 && id() === 'walk'; k++) {
      w.keys.r = 1;
      w.step(1);
    }
    w.keys.r = 0;
    out.push(id());
    // stands by the shaft and does not dig, does not mine, does not build: the next step comes anyway
    for (const want of ['dig', 'mine', 'bridge', 'danger']) {
      for (let k = 0; k < 60 * 120 && id() === want; k++) {
        // (once the bridge stands, walking over it is all that is left)
        if (want === 'bridge' && (w.tut.s.built || c.bridge)) w.keys.r = 1;
        w.step(1);
      }
      w.keys.r = 0;
      out.push(id());
    }
    return out;
  });
  expect(r).toEqual(['dig', 'mine', 'bridge', 'danger', 'glut']);
  const ev = await page.evaluate(() =>
    window.__ww.analytics
      .sessionEvents()
      .filter(e => e.e === 'onb_rescue')
      .map(e => e.step + ':' + e.kind),
  );
  for (const k of ['walk:lift', 'dig:drop', 'mine:gift', 'bridge:auto', 'danger:push']) expect(ev).toContain(k);
});

test('at the abyss with a beam: the action button turns into "Brücke" with a hint', async ({ page }) => {
  await fresh(page);
  await playPastIntro(page);
  await page.evaluate(() => (window.__ww.G.inputKind = 'keys'));
  for (let k = 0; k < 3; k++) await page.evaluate(() => window.bot.run(5400));
  const r = await page.evaluate(() => {
    const w = window.__ww,
      c = w.crew[0],
      T = w.tutLevel.TUT,
      floor = w.tutLevel.ground() + T.cave.floor;
    if (!c.inv.includes('wood')) c.inv.push('wood');
    Object.assign(c, { x: T.gap.x0 - 9, y: floor - 10, vx: 0, vy: 0 });
    // (the prompt shows once the player hesitates)
    w.tut.s.shown = true;
    w.step(10);
    return [w.tutLevel.steps()[w.tut.i], document.getElementById('questText').textContent];
  });
  expect(r).toEqual(['bridge', 'Balken + Erz: drück F für die Brücke']);
  await expect(page.locator('#game')).toHaveClass(/onb-act/);
  await expect(page.locator('.pad.act')).toHaveClass(/tut-hl/);
});

test('the teaching path: start free of the castle, the bump needs a jump both ways, it cannot be dug', async ({
  page,
}) => {
  await fresh(page);
  await playPastIntro(page);
  const r = await page.evaluate(() => {
    const w = window.__ww,
      c = w.crew[0],
      B = w.tutLevel.TUT.bump,
      gy = w.tutLevel.ground(),
      { ROCK } = w.world;
    const res = { startFree: w.world.free(c.x, c.y, 6, 10) };
    const walkInto = dir => {
      w.keys.l = dir < 0 ? 1 : 0;
      w.keys.r = dir > 0 ? 1 : 0;
      w.step(240);
      w.keys.l = w.keys.r = 0;
      return c.x;
    };
    c.x = B.x0 - 12;
    const x1 = walkInto(1);
    res.blockedRight = x1 + 3 < B.x0 + 1;
    res.rockLeft = w.matAt(B.x0 + 2, gy - 3) === ROCK;
    // a jump while walking gets over
    w.keys.r = 1;
    w.edge.jump = true;
    w.step(60);
    w.keys.r = 0;
    res.overRight = c.x > B.x1;
    // and back: blocked, then over with a jump
    c.x = B.x1 + 6;
    w.step(30);
    const x2 = walkInto(-1);
    res.blockedLeft = x2 > B.x1 - 4;
    w.keys.l = 1;
    w.edge.jump = true;
    w.step(60);
    w.keys.l = 0;
    res.overLeft = c.x + 6 < B.x0;
    return res;
  });
  expect(r).toEqual({
    startFree: true,
    blockedRight: true,
    rockLeft: true,
    overRight: true,
    blockedLeft: true,
    overLeft: true,
  });
});

test('the walls give flint and ore, and the first success is counted once', async ({ page }) => {
  await fresh(page);
  await playPastIntro(page);
  await page.evaluate(() => (window.__ww.G.inputKind = 'keys'));
  await page.evaluate(() => window.bot.run(5400));
  await page.evaluate(() => window.bot.run(5400));
  expect(await page.evaluate(() => window.bot.run(5400))).toBe('bridge');
  const inv = await page.evaluate(() => window.__ww.crew[0].inv);
  expect(inv).toContain('flint');
  expect(inv).toContain('ore');
  await page.evaluate(() => window.bot.run(5400));
  const n = await page.evaluate(
    () => window.__ww.analytics.sessionEvents().filter(e => e.e === 'onb_first_success').length,
  );
  expect(n).toBe(1);
});

test('the same path works at any frame pacing (single ticks or bursts of four)', async ({ page }) => {
  await fresh(page);
  await playPastIntro(page);
  const done = await page.evaluate(() => {
    const w = window.__ww,
      orig = w.step;
    // bursts: the loop catches up four ticks at a time on a slow device
    w.step = n => {
      for (let k = 0; k < n; k += 4) orig(Math.min(4, n - k));
    };
    w.G.inputKind = 'keys';
    for (let k = 0; k < 6 && w.tut; k++) window.bot.run(5400);
    w.step = orig;
    return !w.tut;
  });
  expect(done).toBe(true);
});

test('skipping with the keyboard: Esc opens the menu with "Tutorial überspringen"', async ({ page }) => {
  await fresh(page);
  await playPastIntro(page);
  await page.keyboard.press('Escape');
  await expect(page.locator('#panel')).toBeVisible();
  await page.waitForTimeout(400); // (a panel ignores clicks right after it opened)
  await page.locator('#panel .opt', { hasText: 'Tutorial überspringen' }).click();
  await expect(page.locator('#card h1')).toHaveText('Tutorial übersprungen');
  const ev = await page.evaluate(() => window.__ww.analytics.sessionEvents().filter(e => /onb_(menu|skip)/.test(e.e)));
  expect(ev.map(e => e.e + ':' + (e.action || e.via))).toEqual(['onb_menu:open', 'onb_menu:skip', 'onb_skip:menu']);
});

test('analytics never breaks the game: blocked storage, a broken provider, bad events', async ({ page }) => {
  await fresh(page);
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  const r = await page.evaluate(() => {
    const a = window.__ww.analytics;
    a.setSink(() => {
      throw new Error('provider down');
    });
    const set = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw new Error('quota');
    };
    const bad = [a.ev('no_such_event'), a.ev('onb_hint', { step: 1 }), a.ev('onb_hint', { who: 'x' })];
    const good = a.ev('onb_hint', { step: 'walk', level: 'test' });
    Storage.prototype.setItem = set;
    return { bad, good: !!good };
  });
  await playPastIntro(page);
  await page.evaluate(() => window.__ww.step(30));
  await page.waitForTimeout(100);
  expect(r).toEqual({ bad: [null, null, null], good: true });
  expect(errors).toEqual([]);
  expect(await page.evaluate(() => window.__ww.state)).toBe('play');
});

for (const [w, h] of [
  [640, 360],
  [360, 740],
  [1920, 1080],
])
  test(`readable at ${w}×${h} with long texts and large text: nothing cut off`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await fresh(page, { lang: 'en', profile: { bigtext: true }, url: '/?lang=pseudo' });
    const fits = sel =>
      page.evaluate(s => {
        const e = document.querySelector(s);
        const r = e.getBoundingClientRect();
        return e.scrollWidth <= e.clientWidth + 1 && r.left >= 0 && r.right <= innerWidth + 1;
      }, sel);
    expect(await fits('#veilGo')).toBe(true);
    await expect(page.locator('#veilGo small')).toContainText('[');
    await playPastIntro(page);
    await page.evaluate(() => {
      window.__ww.G.inputKind = 'touch';
      window.__ww.step(5);
    });
    await expect(page.locator('#questText')).toContainText('[');
    expect(await fits('#quest')).toBe(true);
    // at most two lines
    const lines = await page.evaluate(() => {
      const e = document.getElementById('questText');
      return Math.round(e.getBoundingClientRect().height / parseFloat(getComputedStyle(e).lineHeight));
    });
    expect(lines).toBeLessThanOrEqual(2);
    await page.click('#questSkip');
    await page.click('#questSkip');
    expect(await fits('#card')).toBe(true);
    // no raw keys or "undefined" anywhere the player can see
    const text = await page.evaluate(() => document.getElementById('game').innerText);
    expect(text).not.toMatch(/undefined|\{\w+\}/);
  });

test('reduced motion: the arrow stands still and the start screen just goes', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await fresh(page);
  expect(await page.evaluate(() => window.__ww.G.reduceMotion)).toBe(true);
  await playPastIntro(page);
  await expect(page.locator('#veil')).toBeHidden({ timeout: 50 });
});

test('a hesitant newcomer (reads every prompt first, then needs a moment) is done in under two minutes', async ({
  page,
}) => {
  await fresh(page);
  await playPastIntro(page);
  const r = await page.evaluate(() => {
    const w = window.__ww,
      q = document.getElementById('questText'),
      out = {};
    w.G.inputKind = 'keys';
    const t0 = w.G.playTicks;
    let seen = -1,
      step = -1;
    for (let k = 0; k < 60 * 180 && w.tut; k++) {
      window.bot.release();
      if (w.tut.i !== step) {
        step = w.tut.i;
        seen = -1;
        out[w.tutLevel.steps()[step]] = Math.round((w.G.playTicks - t0) / 6) / 10;
      }
      // the first prompt of a step is read first: a second and a half before acting on it
      if (seen < 0 && q.textContent) seen = k;
      if (seen >= 0 ? k - seen > 90 : w.tut.i > 0) window.bot.act(k);
      w.step(1);
    }
    out.total = Math.round((w.G.playTicks - t0) / 6) / 10;
    out.done = !w.tut;
    return out;
  });
  console.log('hesitant newcomer, seconds at the start of each step:', JSON.stringify(r));
  expect(r.done).toBe(true);
  expect(r.total).toBeLessThan(120);
});

test('a tutorial saved by an older version starts afresh in the new world', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('flintworks-lang', 'de');
    localStorage.setItem('wuehlwelt-save-v1', JSON.stringify({ v: 1, mode: 'tut', tut: { i: 6, s: { t: 5 } } }));
  });
  await page.reload();
  await page.waitForFunction(() => window.__ww);
  await expect(page.locator('#veilGo b')).toHaveText('Spielen');
  await playPastIntro(page);
  expect(await page.evaluate(() => [window.__ww.G.mode, window.__ww.tut.i])).toEqual(['tut', 0]);
});

test('a real round opens with its goal and an arrow to the nearest gold, gone once you dig', async ({ page }) => {
  await fresh(page, { profile: { tutorialDone: true, installAsked: 'done', games: 2 } });
  await page.click('#lbPlay');
  await expect(page.locator('.banner')).toContainText('Goldrausch');
  const r = await page.evaluate(async () => {
    const { cueOn } = await import('/src/startcue.js');
    const w = window.__ww,
      c = w.crew[0];
    const on = cueOn();
    w.G.inputKind = 'keys';
    w.keys.d = 1; // dig down where you stand
    w.step(40);
    w.keys.d = 0;
    return { on, after: cueOn(), dug: true };
  });
  expect(r.on).toBe(true);
  expect(r.after).toBe(false);
  const ev = await page.evaluate(() => window.__ww.analytics.sessionEvents().filter(e => e.e === 'round_cue'));
  expect(ev).toHaveLength(1);
});
