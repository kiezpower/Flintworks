// The guided first game, played through in the dev build: npm test
import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

const BOT = readFileSync(new URL('./tutorial-bot.js', import.meta.url), 'utf8');

// a fresh player: empty storage, chosen language, then "Spielen" starts the tutorial
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

for (const lang of ['de', 'en'])
  test(`the whole tutorial can be played with the keyboard (${lang})`, async ({ page }) => {
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await fresh(page, lang);
    await page.click('#lbPlay');
    await expect(page.locator('#quest')).toBeVisible();
    expect(await page.evaluate(() => window.__ww.G.mode)).toBe('tut');
    await page.evaluate(() => (window.__ww.G.inputKind = 'keys'));
    const order = await page.evaluate(() => window.__ww.tutLevel.steps());
    for (const id of order) {
      const now = await page.evaluate(() => window.bot.run(0));
      expect(now).toBe(id);
      const next = await playStep(page);
      expect(next, `step "${id}" was not finished`).not.toBe(id);
    }
    // confetti first, then the closing card
    await expect(page.locator('#overlay')).toBeVisible({ timeout: 4000 });
    await expect(page.locator('#card h1')).toHaveText(lang === 'de' ? 'Erste Schicht geschafft!' : 'First shift done!');
    const prof = await page.evaluate(() => JSON.parse(localStorage.getItem('flintworks-profile')));
    expect(prof.tutorialDone).toBe(true);
    expect(prof.hats).toContain('helm');
    expect(prof.tutStats.done).toBe(1);
    // the first real round gets the start money
    await page.click('#goBtn');
    await expect(page.locator('#toast')).toContainText(lang === 'de' ? 'Startgeld' : 'Start money');
    expect(await page.evaluate(() => [window.__ww.G.mode, window.__ww.money, window.__ww.tut])).toEqual([
      'gold',
      90,
      null,
    ]);
    expect(errors).toEqual([]);
  });

test('texts name the touch buttons on a touch screen and the keys on a keyboard', async ({ page }) => {
  await fresh(page);
  await page.click('#lbPlay');
  await page.evaluate(() => {
    window.__ww.G.inputKind = 'touch';
    window.__ww.step(1);
  });
  await expect(page.locator('#questText')).toHaveText('Lauf nach rechts zu den Bäumen');
  await page.evaluate(() => {
    window.__ww.G.inputKind = 'keys';
    window.__ww.step(1);
  });
  await expect(page.locator('#questText')).toHaveText('Lauf nach rechts zu den Bäumen: Pfeil → oder D');
});

test('the tutorial world is quiet: no missions, no night, nobody gets exhausted', async ({ page }) => {
  await fresh(page);
  await page.click('#lbPlay');
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
  await page.click('#lbPlay');
  await page.click('#questSkip');
  await expect(page.locator('#questSkip')).toHaveText('Wirklich?');
  expect(await tut(page)).toBe(0);
  await page.click('#questSkip');
  await expect(page.locator('#card h1')).toHaveText('Tutorial übersprungen');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('flintworks-profile')).tutorialDone)).toBe(true);
  await page.click('#goBtn');
  expect(await page.evaluate(() => [window.__ww.G.mode, window.__ww.tut])).toEqual(['gold', null]);
});

test('a tutorial left for the lobby goes on after a reload', async ({ page }) => {
  await fresh(page);
  await page.click('#lbPlay');
  await page.evaluate(() => (window.__ww.G.inputKind = 'keys'));
  await playStep(page);
  await playStep(page);
  await page.evaluate(() => document.getElementById('newBtn').click());
  await page.reload();
  await page.waitForFunction(() => window.__ww);
  await page.click('#lbPlay');
  expect(await tut(page)).toBe(2);
  await expect(page.locator('#quest')).toBeVisible();
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
