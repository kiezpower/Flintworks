import { expect, test } from '@playwright/test';

async function open(page) {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.setItem('flintworks-lang', 'de');
    localStorage.setItem('flintworks-profile', JSON.stringify({ tutorialDone: true, installAsked: 'done', name: 'Anna', gmode: 'settlement', diff: 'relaxed' }));
  });
  await page.reload(); await page.waitForFunction(() => window.__ww);
}

test('a solo world can be saved, closed, reopened after reload and deliberately deleted', async ({ page }) => {
  await open(page);
  await page.evaluate(() => window.__ww.G.createWorld({ name: 'Feierabend', biome: 'meadow' }));
  await page.click('#menuBtn');
  const id = await page.evaluate(() => { window.__ww.G.money = 1001; return window.__ww.G.worldId; });
  await page.locator('#pBody').getByText('Meine Welten', { exact: true }).click();
  await page.locator('#pBody').getByText('Feierabend', { exact: true }).click();
  await page.getByText('Welt schließen', { exact: true }).click();
  await expect(page.locator('#lobby')).toBeVisible();
  expect(await page.evaluate(() => [window.__ww.G.inRun, window.__ww.hasSave()])).toEqual([false, false]);
  expect(await page.evaluate(async id => (await (await import('/src/worldstore.js')).readWorld(id)).save.data.money, id)).toBe(1001);
  await page.reload(); await page.waitForFunction(() => window.__ww);
  await page.click('#lbWorlds');
  await page.locator('#pBody').getByText('Feierabend', { exact: true }).click();
  await page.locator('#pBody').getByText('Welt fortsetzen', { exact: true }).click();
  await page.waitForFunction(() => window.__ww.G.inRun && window.__ww.G.worldName === 'Feierabend');
  await page.click('#menuBtn');
  await page.locator('#pBody').getByText('Meine Welten', { exact: true }).click();
  await page.locator('#pBody').getByText('Feierabend', { exact: true }).click();
  await page.getByText('Welt schließen', { exact: true }).click();
  await page.locator('#pBody').getByText('Feierabend', { exact: true }).click();
  await page.locator('#pBody').getByText('Welt löschen', { exact: true }).click();
  await page.getByText('Abbrechen', { exact: true }).click();
  expect(await page.evaluate(async id => !!await (await import('/src/worldstore.js')).readWorld(id), id)).toBe(true);
  await page.locator('#pBody').getByText('Welt löschen', { exact: true }).click();
  await page.getByText('Endgültig löschen', { exact: true }).click();
  await expect(page.getByText('Noch keine Welt gespeichert', { exact: true })).toBeVisible();
});

test('a failed archive write keeps the running world open', async ({ page }) => {
  await open(page);
  await page.evaluate(() => window.__ww.G.createWorld({ name: 'Nicht verlieren', biome: 'meadow' }));
  await page.click('#menuBtn');
  await page.locator('#pBody').getByText('Meine Welten', { exact: true }).click();
  await page.locator('#pBody').getByText('Nicht verlieren', { exact: true }).click();
  await page.evaluate(() => {
    window.__originalWorldTransaction = IDBDatabase.prototype.transaction;
    IDBDatabase.prototype.transaction = function (...args) {
      if (args[1] === 'readwrite') throw new DOMException('Full', 'QuotaExceededError');
      return window.__originalWorldTransaction.apply(this, args);
    };
  });
  await page.getByText('Welt schließen', { exact: true }).click();
  await expect(page.locator('#toast')).toContainText('bisherige Welt bleibt gespeichert');
  expect(await page.evaluate(() => [window.__ww.G.inRun, window.__ww.G.worldName])).toEqual([true, 'Nicht verlieren']);
  await page.evaluate(() => { IDBDatabase.prototype.transaction = window.__originalWorldTransaction; });
});

test('an old world-list request cannot add controls to another panel', async ({ page }) => {
  await open(page);
  await page.evaluate(async () => {
    const w = window.__ww;
    const { openWorlds } = await import('/src/worldui.js');
    const { openPanel } = await import('/src/ui.js');
    w.G.worldSavePending = new Promise(resolve => window.__releaseWorldSave = resolve);
    const pending = openWorlds();
    openPanel('Optionen');
    window.__releaseWorldSave();
    await pending;
  });
  await expect(page.locator('#pTitle')).toHaveText('Optionen');
  await expect(page.locator('#worldImport')).toHaveCount(0);
  await expect(page.locator('#pBody .opt')).toHaveCount(0);
});
