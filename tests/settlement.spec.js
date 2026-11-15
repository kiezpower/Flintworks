import { expect, test } from '@playwright/test';

test('a settlement has lasting milestones, survives loading, and never ends at a round goal', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('flintworks-lang', 'de');
    localStorage.setItem('flintworks-profile', JSON.stringify({ tutorialDone: true, installAsked: 'done', gmode: 'settlement', name: 'Anna' }));
  });
  await page.reload();
  await page.waitForFunction(() => window.__ww);
  await page.click('#lbPlay');
  await page.waitForFunction(() => window.__ww.G.state === 'play');
  const result = await page.evaluate(async () => {
    const w = window.__ww;
    const { MILESTONES, settlementTick, settlementStatus } = await import('/src/settlement.js');
    const { goalReached, GAME_MODES } = await import('/src/modes.js');
    const { supportsKind } = await import('/src/playkind.js');
    w.G.frame = 30;
    w.G.store.plank = 6;
    w.builds.push({ id: w.G.nextId++, type: 'saw', done: true, x: 300, gy: 100, w: 24, h: 14 });
    settlementTick();
    // Spending the planks never revokes an achieved milestone.
    w.G.store.plank = 0;
    const next = settlementStatus().id;
    w.save();
    w.G.settlement = null;
    const loaded = w.load();
    const completed = [...w.G.settlement.done];
    w.G.settlement.done = MILESTONES.map(m => m.id);
    const ends = goalReached();
    w.step(60);
    return { next, loaded, completed, ends, state: w.G.state,
      versus: supportsKind(GAME_MODES.settlement, 'versus'), coop: supportsKind(GAME_MODES.settlement, 'coop') };
  });
  expect(result).toEqual({ next: 'metal', loaded: true, completed: ['lumber'], ends: false, state: 'play', versus: false, coop: true });
  expect(errors).toEqual([]);
});
