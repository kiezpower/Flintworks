import { expect, test } from '@playwright/test';
import { startRelay } from './relayproc.js';

async function lobby(page, extra = {}, lang = 'de', url = '/') {
  await page.addInitScript(({ extra, lang }) => {
    localStorage.setItem('flintworks-lang', lang);
    localStorage.setItem('flintworks-profile', JSON.stringify({
      tutorialDone: true, installAsked: 'done', name: 'Kurt', playKind: 'solo', gmode: 'gold', games: 3, ...extra,
    }));
  }, { extra, lang });
  await page.goto(url);
  await page.waitForFunction(() => window.__ww);
}
const profile = page => page.evaluate(() => JSON.parse(localStorage.getItem('flintworks-profile')));

for (const viewport of [{ width: 1280, height: 800 }, { width: 844, height: 390 }, { width: 390, height: 844 }, { width: 320, height: 568 }]) {
  test(`album browsing, locked previews and selection work at ${viewport.width}×${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await lobby(page);
    await page.click('#lbWho');
    await expect(page.locator('.ha-card')).toHaveCount(6);
    await expect(page.locator('#heroProgressText')).toHaveText('4 von 6 entdeckt');
    await page.click('[data-hero="bruno"]');
    await expect(page.locator('#heroPreviewName')).toHaveText('Bruno');
    expect((await profile(page)).hero).toBeNull();
    await page.click('[data-hero="toni"]');
    await expect(page.locator('#heroSelect')).toBeDisabled();
    await expect(page.locator('#heroStatus')).toHaveText('Level 1/5');
    await page.click('[data-hero="nora"]');
    await expect(page.locator('#heroStatus')).toHaveText('Siege 0/10');
    await expect(page.locator('#heroSelect')).toBeDisabled();
    await page.click('[data-hero="mika"]');
    await page.locator('#heroSelect').scrollIntoViewIfNeeded();
    const bounds = await page.locator('#heroSelect').boundingBox();
    expect(bounds.width).toBeGreaterThanOrEqual(44);
    expect(bounds.height).toBeGreaterThanOrEqual(44);
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width);
    await page.screenshot({ path: `test-results/hero-album-${viewport.width}.png` });
    await page.click('#heroSelect');
    await expect(page.locator('#panel')).toBeHidden();
    expect((await profile(page)).hero).toBe('mika');
    await page.click('#lbWho');
    await expect(page.locator('[data-hero="mika"]')).toHaveClass(/selected/);
    await expect(page.locator('#heroSelect')).toHaveText('Ausgewählt');
    expect(errors).toEqual([]);
  });
}

test('cancel preserves legacy appearance; selecting preserves cosmetics and survives reload into game', async ({ page }) => {
  // Set up storage once, rather than resetting it again on reload.
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.setItem('flintworks-lang', 'de');
    localStorage.setItem('flintworks-profile', JSON.stringify({
      tutorialDone: true, installAsked: 'done', playKind: 'solo', gmode: 'gold', name: 'MeineCrew', games: 3,
      cap: '#d04f8a', hat: 'flower', hats: ['none', 'flower'], trophies: 12,
      outfit: 'green', bstyle: 'stone', owned: ['o:green', 'b:stone'], gear: ['hook'],
    }));
  });
  await page.reload();
  await page.waitForFunction(() => window.__ww);
  const before = await profile(page);
  await page.click('#lbWho');
  await page.click('[data-hero="bruno"]');
  await page.keyboard.press('Escape');
  expect((await profile(page)).cap).toBe(before.cap);
  expect((await profile(page)).hero).toBeNull();
  await page.click('#lbWho');
  await page.click('[data-hero="mika"]');
  await page.click('#heroSelect');
  const after = await profile(page);
  for (const key of ['name', 'hat', 'hats', 'outfit', 'bstyle', 'owned', 'gear', 'level', 'wins']) expect(after[key]).toEqual(before[key]);
  await page.reload();
  await page.waitForFunction(() => window.__ww);
  await page.click('#lbWho');
  await expect(page.locator('[data-hero="mika"]')).toHaveClass(/selected/);
  await page.keyboard.press('Escape');
  await page.click('#lbPlay');
  await page.waitForFunction(() => window.__ww.state === 'play');
  expect(await page.evaluate(() => {
    const { crew, G } = window.__ww;
    const me = crew.find(c => c.pid === G.myId);
    return { skin: me.skin, cap: me.cap, hat: me.hat };
  })).toEqual({ skin: 'green.stone.h3', cap: '#e0ad28', hat: 'flower' });
});

test('level and wins unlock independently; locked selection cannot mutate a profile', async ({ page }) => {
  await lobby(page, { level: 5, wins: 9 });
  await page.click('#lbWho');
  await expect(page.locator('#heroProgressText')).toHaveText('5 von 6 entdeckt');
  await page.click('[data-hero="toni"]');
  await expect(page.locator('#heroSelect')).toBeEnabled();
  await page.click('#heroSelect');
  expect((await profile(page)).hero).toBe('toni');
  const result = await page.evaluate(async () => {
    const { selectHero } = await import('/src/heroes.js');
    const { P } = await import('/src/profile.js');
    const before = JSON.stringify(P);
    const denied = selectHero(P, 'nora');
    const unchanged = before === JSON.stringify(P);
    P.wins = 10;
    return { denied, unchanged, allowed: selectHero(P, 'nora') };
  });
  expect(result).toEqual({ denied: false, unchanged: true, allowed: true });
  await page.click('#lbWho');
  await expect(page.locator('#heroProgressText')).toHaveText('6 von 6 entdeckt');
});

test('appearance, outfits and achievements remain available and album texts translate', async ({ page }) => {
  await lobby(page, {}, 'en');
  await page.click('#lbWho');
  await expect(page.locator('#pTitle')).toHaveText('Hero album');
  await expect(page.locator('#heroProgressText')).toHaveText('4 of 6 discovered');
  await page.getByRole('button', { name: 'Hats & colours', exact: true }).click();
  await expect(page.locator('#pTitle')).toHaveText('Your digger');
  await page.getByText('Back to album', { exact: true }).click();
  await expect(page.locator('#heroAlbum')).toBeVisible();
  await page.getByRole('button', { name: 'Outfits', exact: true }).click();
  await expect(page.locator('#pTitle')).toHaveText('Home mine');
  await page.keyboard.press('Escape');
  await page.click('#lbWho');
  await page.getByRole('button', { name: 'Achievements', exact: true }).click();
  await expect(page.locator('#achList')).toBeVisible();
});

test('hero tags preserve legacy skins and gear within the relay limit', async ({ page }) => {
  await lobby(page);
  const result = await page.evaluate(async () => {
    const { skinTag, parseSkin, brought } = await import('/src/skins.js');
    const { HEROES } = await import('/src/heroes.js');
    return {
      legacy: parseSkin(skinTag('green', 'stone', ['hook', 'lamp'])),
      invalid: parseSkin('x.y'),
      heroes: HEROES.map(hero => {
        const skin = skinTag('leather', 'winter', ['hook', 'lamp'], hero.id);
        return { length: skin.length, decoded: parseSkin(skin).hero, id: hero.id,
          hook: brought({ skin }, 'hook'), lamp: brought({ skin }, 'lamp') };
      }),
    };
  });
  expect(result.legacy).toEqual({ outfit: 'green', style: 'stone', gear: 'hl' });
  expect(result.invalid).toEqual({ outfit: 'blue', style: 'wood', gear: '' });
  for (const hero of result.heroes) {
    expect(hero.length).toBeLessThanOrEqual(20);
    expect(hero.decoded).toBe(hero.id);
    expect(hero.hook && hero.lamp).toBe(true);
  }
});

test('changing a hero in a waiting room updates the other player', async ({ browser }, worker) => {
  const port = 23000 + worker.workerIndex;
  const relay = startRelay(port);
  await relay.ready;
  const host = await browser.newPage(), guest = await browser.newPage();
  try {
    await lobby(host, { name: 'Host' }, 'de', `/?mp=ws://localhost:${port}`);
    await lobby(guest, { name: 'Gast' }, 'de', `/?mp=ws://localhost:${port}`);
    await host.click('#lbTogether');
    await host.click('#lbCreate');
    await expect(host.locator('.lb-codetap b')).toHaveText(/^[A-Z0-9]{6}$/);
    const code = await host.locator('.lb-codetap b').textContent();
    await guest.click('#lbTogether');
    await guest.fill('#lbCodeIn', code);
    await guest.click('#lbJoinBtn');
    await expect(guest.locator('.lb-players')).toContainText('Host');
    await host.keyboard.press('Escape');
    await host.click('#lbWho');
    await host.click('[data-hero="mika"]');
    await host.click('#heroSelect');
    await expect.poll(() => guest.evaluate(async () => {
      const { NET } = await import('/src/net/room.js');
      return NET.players.find(p => p.name === 'Host')?.skin;
    })).toBe('blue.wood.3');
  } finally {
    await host.close(); await guest.close(); relay.relay.kill();
  }
});
