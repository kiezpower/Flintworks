// The guided first game, played through in the dev build: npm test
// A fresh player lands in the tutorial world behind the start screen (no lobby), plays three
// beats (walk and jump, dig to gold, sell it) and goes straight on into a real round.
import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

const BOT = readFileSync(new URL('./tutorial-bot.js', import.meta.url), 'utf8');

// a fresh player: empty storage, chosen language, waiting at the start screen
async function fresh(page, lang = 'de', profile = null) {
  await page.goto('/');
  await page.evaluate(
    ([l, p]) => {
      localStorage.clear();
      localStorage.setItem('flintworks-lang', l);
      if (p) localStorage.setItem('flintworks-profile', JSON.stringify(p));
    },
    [lang, profile],
  );
  await page.reload();
  await page.waitForFunction(() => window.__ww);
  await page.addScriptTag({ content: BOT });
}
const tut = page => page.evaluate(() => window.__ww.tut && window.__ww.tut.i);
const playStep = page => page.evaluate(() => window.bot.run(5400));
// the events of this session without the context fields
const events = page =>
  page.evaluate(() => window.__ww.analytics.sessionEvents().map(({ sid, v, plat, lang, t, input, ...f }) => f));

for (const lang of ['de', 'en'])
  test(`a new player goes from the start screen through the tutorial into a real round (${lang})`, async ({ page }) => {
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await fresh(page, lang);
    // no lobby: the world behind the start screen
    await expect(page.locator('#veil')).toBeVisible();
    await expect(page.locator('#lobby')).toBeHidden();
    await expect(page.locator('#veilGo b')).toHaveText(lang === 'de' ? 'Spielen' : 'Play');
    expect(await page.evaluate(() => [window.__ww.G.mode, window.__ww.state])).toEqual(['tut', 'veil']);
    // any key starts
    await page.keyboard.press('KeyD');
    await expect(page.locator('#veil')).toBeHidden();
    await expect(page.locator('#quest')).toBeVisible();
    await expect(page.locator('#questStep')).toHaveText('1/3');
    await page.evaluate(() => (window.__ww.G.inputKind = 'keys'));
    const order = await page.evaluate(() => window.__ww.tutLevel.steps());
    expect(order).toEqual(['walk', 'dig', 'sell']);
    const t0 = await page.evaluate(() => window.__ww.G.playTicks);
    for (const id of order) {
      const now = await page.evaluate(() => window.bot.run(0));
      expect(now).toBe(id);
      const next = await playStep(page);
      expect(next, `step "${id}" was not finished`).not.toBe(id);
    }
    // well under two minutes of play for a player who knows what to do
    expect((await page.evaluate(() => window.__ww.G.playTicks)) - t0).toBeLessThan(60 * 30);
    await expect(page.locator('#overlay')).toBeVisible({ timeout: 4000 });
    await expect(page.locator('#card h1')).toHaveText(lang === 'de' ? 'Erste Schicht geschafft!' : 'First shift done!');
    // the main button has the focus: Enter goes on
    await expect(page.locator('#goBtn')).toBeFocused();
    const prof = await page.evaluate(() => JSON.parse(localStorage.getItem('flintworks-profile')));
    expect(prof.tutorialDone).toBe(true);
    expect(prof.hats).toContain('helm');
    await page.keyboard.press('Enter');
    await expect(page.locator('#toast')).toContainText(lang === 'de' ? 'Startgeld' : 'Start money');
    expect(await page.evaluate(() => [window.__ww.G.mode, window.__ww.money, window.__ww.tut])).toEqual([
      'gold',
      90,
      null,
    ]);
    // the funnel in order, every event once
    const ev = (await events(page)).map(e => e.e + (e.step ? ':' + e.step : ''));
    expect(ev).toEqual([
      'app_open',
      'onb_first_input',
      'onb_start',
      'onb_step_start:walk',
      'onb_first_action',
      'onb_step_done:walk',
      'onb_step_start:dig',
      'onb_step_done:dig',
      'onb_step_start:sell',
      'onb_step_done:sell',
      'onb_first_success',
      'onb_complete',
      'onb_card',
      'core_round_start',
    ]);
    const all = await events(page);
    expect(all.find(e => e.e === 'core_round_start')).toMatchObject({ mode: 'gold', after_onb: true });
    expect(all.find(e => e.e === 'onb_card')).toMatchObject({ choice: 'play', result: 'done' });
    expect(all.map(e => e.seq)).toEqual(all.map((e, k) => k + 1));
    // the next visit opens the lobby
    await page.reload();
    await page.waitForFunction(() => window.__ww);
    await expect(page.locator('#lobby')).toBeVisible();
    await expect(page.locator('#veil')).toBeHidden();
    expect(errors).toEqual([]);
  });

test('texts name the touch buttons on a touch screen and the keys on a keyboard', async ({ page }) => {
  await fresh(page);
  await page.click('#veilGo');
  await page.evaluate(() => {
    window.__ww.G.inputKind = 'touch';
    window.__ww.step(1);
  });
  await expect(page.locator('#questText')).toHaveText('Lauf nach rechts');
  await page.evaluate(() => {
    window.__ww.G.inputKind = 'keys';
    window.__ww.step(1);
  });
  await expect(page.locator('#questText')).toHaveText('Lauf nach rechts: → oder D');
});

test('the tutorial world is quiet: no missions, no night, nobody gets exhausted', async ({ page }) => {
  await fresh(page);
  await page.click('#veilGo');
  const r = await page.evaluate(() => {
    const w = window.__ww,
      c = w.crew[0];
    const day = w.G.dayT;
    w.step(60 * 120);
    c.energy = 5;
    w.explode(c.x + 3, c.y + 5, 11);
    return { mis: w.G.mis, dayKept: w.G.dayT === day, energy: c.energy, dead: c.dead, crew: w.crew.length };
  });
  expect(r).toEqual({ mis: null, dayKept: true, energy: 20, dead: false, crew: 1 });
});

test('skipping asks first, is remembered and offers a real round', async ({ page }) => {
  await fresh(page);
  await page.click('#veilGo');
  await page.click('#questSkip');
  await expect(page.locator('#questSkip')).toHaveText('Wirklich?');
  expect(await tut(page)).toBe(0);
  await page.click('#questSkip');
  await expect(page.locator('#card h1')).toHaveText('Tutorial übersprungen');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('flintworks-profile')).tutorialDone)).toBe(true);
  await page.click('#goBtn');
  expect(await page.evaluate(() => [window.__ww.G.mode, window.__ww.tut])).toEqual(['gold', null]);
  const skip = (await events(page)).find(e => e.e === 'onb_skip');
  expect(skip).toMatchObject({ step: 'walk', via: 'button' });
});

test('a tutorial left in the middle goes on after a reload, straight from the start screen', async ({ page }) => {
  await fresh(page);
  await page.click('#veilGo');
  await page.evaluate(() => (window.__ww.G.inputKind = 'keys'));
  await playStep(page);
  // (the step change saved the game)
  await page.reload();
  await page.waitForFunction(() => window.__ww);
  await expect(page.locator('#veil')).toBeVisible();
  await expect(page.locator('#veilGo b')).toHaveText('Weiterspielen');
  await page.click('#veilGo');
  expect(await tut(page)).toBe(1);
  await expect(page.locator('#quest')).toBeVisible();
  await expect(page.locator('#questStep')).toHaveText('2/3');
  const ev = await page.evaluate(() => window.__ww.analytics.events().map(e => e.e));
  expect(ev).toContain('onb_exit');
  expect(ev.at(-1)).toBe('onb_resume');
});

test('after the tutorial, tips come one at a time and are kept in the profile', async ({ page }) => {
  await fresh(page, 'de', { tutorialDone: true });
  await page.click('#lbPlay');
  const shown = await page.evaluate(() => {
    const w = window.__ww,
      out = [];
    let last = '';
    for (let f = 0; f < 60 * 150; f++) {
      w.step(1);
      const t = document.getElementById('toast');
      if (!t.hidden && t.textContent !== last) out.push({ s: w.G.playTicks / 60, text: (last = t.textContent) });
    }
    return out;
  });
  // the first mission's tip comes first, then nothing for 45 s
  const tips = shown.filter(t => /Helfer|Gelände|Material|forschen/.test(t.text));
  expect(tips[0].text).toContain('Helfer');
  for (let k = 1; k < tips.length; k++) expect(tips[k].s - tips[k - 1].s).toBeGreaterThanOrEqual(44);
  const prof = await page.evaluate(() => JSON.parse(localStorage.getItem('flintworks-profile')));
  expect(prof.tips.length).toBe(tips.length);
});
