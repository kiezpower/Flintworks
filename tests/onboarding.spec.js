// First launch and the tutorial beyond the straight path: touch and classic controls, players
// who know the game, players who ignore every hint, the HUD that shows only what is useful,
// the teaching path's collision, failure-safe analytics and layouts at many sizes: npm test
import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

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
  expect(await page.evaluate(() => [window.__ww.state, window.__ww.tut?.i])).toEqual(['play', 0]);
  // the first beat: no crew bar, no build button, no map, no money, no pack yet
  await page.evaluate(() => window.__ww.step(10));
  for (const sel of ['#crew', '#buildBtn', '#miniThumb', '.purse', '#inv'])
    expect(await visible(page, sel), sel).toBe(false);
  expect(await visible(page, '#menuBtn')).toBe(true);
});

test('no install offer and no lobby before the first real round', async ({ page }) => {
  await fresh(page);
  await page.waitForTimeout(2200);
  await expect(page.locator('#panel')).toBeHidden();
});

test('links to the Tagesschacht or a room still open the lobby for a new player', async ({ page }) => {
  await fresh(page, { url: '/?daily' });
  await expect(page.locator('#veil')).toBeHidden();
});

test('the HUD turns up when it becomes useful: the pack with the gold, the money at the castle', async ({ page }) => {
  await fresh(page);
  await page.click('#veilGo');
  await page.evaluate(() => (window.__ww.G.inputKind = 'keys'));
  await page.evaluate(() => window.bot.run(5400)); // walk
  await page.evaluate(() => window.bot.run(5400)); // dig: a nugget in the pack
  await page.evaluate(() => window.__ww.step(5));
  await page.waitForTimeout(150);
  expect(await visible(page, '#inv')).toBe(true);
  expect(await visible(page, '.purse')).toBe(false);
  await page.evaluate(() => window.bot.run(5400)); // sell
  await page.waitForTimeout(150);
  expect(await visible(page, '.purse')).toBe(true);
});

test('touch: texts and the stick hand, the jump hint at the bump with the jump button', async ({ page }) => {
  await fresh(page);
  await page.click('#veilGo');
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

test('classic controls: the dig button is asked for and the pit can be climbed out of', async ({ page }) => {
  await fresh(page, { profile: { autodig: false } });
  await page.click('#veilGo');
  await page.evaluate(() => (window.__ww.G.inputKind = 'keys'));
  expect(await page.evaluate(() => window.__ww.G.autoDig)).toBe(false);
  await page.evaluate(() => window.bot.run(5400));
  await page.evaluate(() => {
    window.__ww.tut.s.shown = true;
    window.__ww.step(1);
  });
  await expect(page.locator('#questText')).toHaveText('Grab dich zum Gold: Shift halten, ↓ lenkt');
  for (const id of ['dig', 'sell']) expect(await page.evaluate(() => window.bot.run(5400))).not.toBe(id);
});

test('a player who knows the game never sees a prompt after the first one', async ({ page }) => {
  await fresh(page);
  await page.click('#veilGo');
  await page.evaluate(() => (window.__ww.G.inputKind = 'keys'));
  const texts = new Set();
  for (let k = 0; k < 3; k++) {
    await page.evaluate(() => window.bot.run(5400));
    if (await page.evaluate(() => !!window.__ww.tut))
      texts.add(await page.evaluate(() => document.getElementById('questText').textContent));
  }
  expect([...texts]).toEqual(['']);
  const done = await page.evaluate(() =>
    window.__ww.analytics.sessionEvents().filter(e => e.e === 'onb_step_done' || e.e === 'onb_complete'),
  );
  expect(done.map(e => e.prompted)).toEqual([true, false, false, undefined]);
  expect(done.at(-1).skilled).toBe(true);
  // the card comes at once, without the confetti pause
  await expect(page.locator('#overlay')).toBeVisible({ timeout: 500 });
});

test('out of order: a nugget already in the pack and the bump tunnelled under still work', async ({ page }) => {
  await fresh(page);
  await page.click('#veilGo');
  const r = await page.evaluate(() => {
    const w = window.__ww,
      c = w.crew[0],
      T = w.tutLevel.TUT;
    c.inv.push('nug');
    c.x = T.bump.x1 + 4; // past the bump some other way
    w.step(2);
    const a = w.tut.i;
    w.step(2);
    return [a, w.tut.i];
  });
  // walk done, dig done at once (the gold is already there), now selling
  expect(r).toEqual([2, 2]);
});

test('ignoring every hint: the rescues lift over the bump, hand out gold and bring you home', async ({ page }) => {
  await fresh(page);
  await page.click('#veilGo');
  const r = await page.evaluate(() => {
    const w = window.__ww,
      c = w.crew[0],
      B = w.tutLevel.TUT.bump,
      out = [];
    c.x = B.x0 - 8;
    w.step(60 * 32); // stands at the bump doing nothing
    out.push(w.tut.i);
    w.step(60 * 32); // does not dig
    out.push(w.tut.i, c.inv.includes('nug'));
    w.step(60 * 42); // does not walk home
    out.push(w.tut ? w.tut.i : 'end');
    return out;
  });
  expect(r).toEqual([1, 2, true, 'end']);
  const ev = await page.evaluate(() =>
    window.__ww.analytics
      .sessionEvents()
      .filter(e => e.e === 'onb_rescue')
      .map(e => e.step + ':' + e.kind),
  );
  // (the hint to stand on the sparkle comes first, then the gift)
  expect(ev).toEqual(['walk:lift', 'dig:dig', 'dig:gift', 'sell:home']);
});

test('stuck in the pit: the action button turns up with a hint', async ({ page }) => {
  await fresh(page);
  await page.click('#veilGo');
  await page.evaluate(() => (window.__ww.G.inputKind = 'keys'));
  await page.evaluate(() => window.bot.run(5400));
  await page.evaluate(() => window.bot.run(5400));
  // dig deep down by the gold and stand still there
  const r = await page.evaluate(() => {
    const w = window.__ww,
      c = w.crew[0],
      { mat, W, AIR, paint } = w.world,
      x0 = Math.round(c.x) - 2,
      y0 = Math.round(c.y) + 10;
    for (let y = y0; y < y0 + 30; y++) for (let x = x0; x < x0 + 11; x++) ((mat[y * W + x] = AIR), paint(y * W + x));
    w.step(60 * 22);
    return document.getElementById('questText').textContent;
  });
  expect(r).toBe('Steckst du fest? Drück F');
  // (the HUD follows on the next drawn frames)
  await expect(page.locator('#game')).toHaveClass(/onb-act/);
  await expect(page.locator('.pad.act')).toHaveClass(/tut-hl/);
});

test('the teaching path: start free of the castle, the bump needs a jump both ways, it cannot be dug', async ({
  page,
}) => {
  await fresh(page);
  await page.click('#veilGo');
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

test('gold is sold once: the money goes up by the nugget value and the step ends once', async ({ page }) => {
  await fresh(page);
  await page.click('#veilGo');
  await page.evaluate(() => (window.__ww.G.inputKind = 'keys'));
  await page.evaluate(() => window.bot.run(5400));
  await page.evaluate(() => window.bot.run(5400));
  const before = await page.evaluate(() => [
    window.__ww.money,
    window.__ww.crew[0].inv.filter(t => t === 'nug').length,
  ]);
  await page.evaluate(() => window.bot.run(5400));
  await page.evaluate(() => window.__ww.step(120));
  const after = await page.evaluate(() => window.__ww.money);
  expect(after - before[0]).toBe(25 * before[1]);
  const n = await page.evaluate(
    () => window.__ww.analytics.sessionEvents().filter(e => e.e === 'onb_first_success').length,
  );
  expect(n).toBe(1);
});

test('the same path works at any frame pacing (single ticks or bursts of four)', async ({ page }) => {
  await fresh(page);
  await page.click('#veilGo');
  const done = await page.evaluate(() => {
    const w = window.__ww,
      orig = w.step;
    // bursts: the loop catches up four ticks at a time on a slow device
    w.step = n => {
      for (let k = 0; k < n; k += 4) orig(Math.min(4, n - k));
    };
    w.G.inputKind = 'keys';
    for (let k = 0; k < 3 && w.tut; k++) window.bot.run(5400);
    w.step = orig;
    return !w.tut;
  });
  expect(done).toBe(true);
});

test('skipping with the keyboard: Esc opens the menu with "Tutorial überspringen"', async ({ page }) => {
  await fresh(page);
  await page.click('#veilGo');
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
  await page.click('#veilGo');
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
    await page.click('#veilGo');
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
  await page.click('#veilGo');
  await expect(page.locator('#veil')).toBeHidden({ timeout: 50 });
});

test('a hesitant newcomer (reads first, waits for the jump hint, walks out of the pit) is done in under two minutes', async ({
  page,
}) => {
  await fresh(page);
  await page.click('#veilGo');
  const r = await page.evaluate(() => {
    const w = window.__ww,
      L = w.tutLevel,
      c = w.crew[0],
      q = document.getElementById('questText'),
      out = {};
    w.G.inputKind = 'keys';
    const t0 = w.G.playTicks;
    let seen = -1,
      step = -1;
    for (let k = 0; k < 60 * 180 && w.tut; k++) {
      for (const key in w.keys) w.keys[key] = 0;
      if (w.tut.i !== step) {
        step = w.tut.i;
        seen = -1;
        out[w.tutLevel.steps()[step]] = Math.round((w.G.playTicks - t0) / 6) / 10;
      }
      // reads the prompt, then needs a second and a half to act on it
      if (q.textContent && seen < 0) seen = k;
      const go = seen >= 0 && k - seen > 90;
      const id = w.tutLevel.steps()[w.tut.i];
      if (id === 'walk' && go) {
        w.keys.r = 1;
        if (/Spring|Jump/.test(q.textContent) && k % 40 === 0) w.edge.jump = true;
      } else if (id === 'dig') {
        const nug = w.items.find(i => i.t === 'nug');
        const tx = nug ? nug.x + 1 : L.TUT.gold.x;
        if (go || nug) {
          if (c.x + 3 < tx - 2) w.keys.r = 1;
          else if (c.x + 3 > tx + 2) w.keys.l = 1;
          else if (!nug) w.keys.d = 1;
        }
      } else if (id === 'sell') {
        // never jumps in the pit: walks into its wall until the ramp is dug
        w.keys.l = 1;
        if (c.y + 10 <= L.ground() + 3 && Math.abs(c.vx) < 0.05 && k % 40 === 0) w.edge.jump = true;
      }
      w.step(1);
    }
    out.total = Math.round((w.G.playTicks - t0) / 6) / 10;
    out.done = !w.tut;
    out.help = w.analytics
      .sessionEvents()
      .filter(e => /rescue|recover|hint/.test(e.e))
      .map(e => e.e + ':' + (e.kind || e.level));
    return out;
  });
  console.log('hesitant newcomer, seconds at the start of each beat:', JSON.stringify(r));
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
  await page.click('#veilGo');
  expect(await page.evaluate(() => [window.__ww.G.mode, window.__ww.tut.i])).toEqual(['tut', 0]);
});
