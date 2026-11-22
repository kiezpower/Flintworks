import { expect, test } from '@playwright/test';

async function lobby(page, lang = 'de') {
  await page.goto('/');
  await page.evaluate(lang => {
    localStorage.clear();
    localStorage.setItem('flintworks-lang', lang);
    localStorage.setItem('flintworks-profile', JSON.stringify({ tutorialDone: true, installAsked: 'done', name: 'Kurt', playKind: 'solo', gmode: 'settlement' }));
  }, lang);
  await page.reload();
  await page.waitForFunction(() => window.__ww);
}
for (const viewport of [{ width: 1280, height: 800 }, { width: 844, height: 390 }, { width: 390, height: 844 }, { width: 320, height: 568 }]) {
  test(`work yard controls remain reachable at ${viewport.width}×${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await lobby(page);
    await expect(page.locator('#lbHeading')).toHaveText('Willkommen im Werkhof');
    await expect(page.locator('#lbCrewState')).toContainText('Dein Wühler');
    const play = await page.locator('#lbPlay').boundingBox();
    expect(play.y + play.height).toBeLessThanOrEqual(viewport.height);
    const controls = ['#lbOpt', '#lbFriends', '#lbLvlBtn', '#lbPlay', '#lbScenarios', '#lbTogether', '#lbWorlds', '#lbSlot1', '#lbSlot2', '#lbNameTag'];
    for (const id of controls) {
      await page.locator(id).scrollIntoViewIfNeeded();
      const b = await page.locator(id).boundingBox();
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.x + b.width).toBeLessThanOrEqual(viewport.width);
      expect(b.y).toBeGreaterThanOrEqual(0);
      expect(b.y + b.height).toBeLessThanOrEqual(viewport.height);
      // Trial clicks exercise hit testing as well as visibility and scrolling.
      await page.locator(id).click({ trial: true });
    }
    await page.screenshot({ path: `test-results/werkhof-${viewport.width}.png` });
    await page.click('#lbScenarios');
    await expect(page.locator('#levelsel')).toBeVisible();
    expect(errors).toEqual([]);
  });
}

test('new lobby shortcuts and crew labels translate into English', async ({ page }) => {
  await lobby(page, 'en');
  await expect(page.locator('#lbHeading')).toHaveText('Welcome to the work yard');
  await expect(page.locator('#lbTogether')).toHaveText('Play with friends');
  await page.click('#lbTogether');
  await expect(page.locator('#lbCodeIn')).toBeVisible();
  await expect(page.locator('#lbCreate')).toBeVisible();
});

async function archivedWorld(page) {
  return page.evaluate(async () => {
    const w = window.__ww;
    await w.G.createWorld({ name: 'Abendberg', biome: 'winter' });
    w.G.money = 987; w.save(); await w.G.worldSavePending;
    const id = w.G.worldId;
    w.G.closeWorld();
    return id;
  });
}

test('the last closed world resumes from the main button after a browser restart', async ({ page }) => {
  await lobby(page);
  const id = await archivedWorld(page);
  await expect(page.locator('#lbResumeName')).toHaveText('Abendberg');
  await expect(page.locator('#lbEyebrow')).toHaveText('Zuletzt gespielt');
  await page.reload();
  await expect(page.locator('#lbResumeName')).toHaveText('Abendberg');
  await expect(page.locator('#lbGModeTxt')).toContainText('Winter');
  await page.click('#lbPlay');
  await page.waitForFunction(() => window.__ww.state === 'play');
  expect(await page.evaluate(() => [window.__ww.G.worldId, window.__ww.G.worldName, window.__ww.G.money])).toEqual([id, 'Abendberg', 987]);
  await page.reload();
  await expect(page.locator('#lbResumeName')).toHaveText('Abendberg');
  await expect(page.locator('#lbPlay')).toHaveText('Welt fortsetzen');
});

test('choosing a scenario takes precedence over the suggested archived world', async ({ page }) => {
  await lobby(page);
  await archivedWorld(page);
  await expect(page.locator('#lbResumeName')).toHaveText('Abendberg');
  await page.click('#lbScenarios');
  await page.locator('.ls-card[data-id="gold"]').first().click();
  await page.click('.ls-go');
  await expect(page.locator('#lbResumeName')).toBeHidden();
  await expect(page.locator('#lbPlay')).toHaveText('Alleine starten');
  await page.click('#lbPlay');
  await page.waitForFunction(() => window.__ww.state === 'play');
  expect(await page.evaluate(() => window.__ww.G.mode)).toBe('gold');
  expect(await page.evaluate(async () => (await (await import('/src/worldstore.js')).listWorlds()).map(w => w.name))).toContain('Abendberg');
});

test('renaming and deleting the suggested world updates the launch board', async ({ page }) => {
  await lobby(page);
  await archivedWorld(page);
  await expect(page.locator('#lbResumeName')).toHaveText('Abendberg');
  await page.click('#lbWorlds');
  await page.locator('#pBody').getByText('Abendberg', { exact: true }).click();
  await page.fill('#worldName', 'Morgenberg');
  await page.getByText('Umbenennen', { exact: true }).click();
  await expect(page.locator('#worldName')).toHaveValue('Morgenberg');
  await page.click('#pClose');
  await expect(page.locator('#lbResumeName')).toHaveText('Morgenberg');
  await page.click('#lbWorlds');
  await page.locator('#pBody').getByText('Morgenberg', { exact: true }).click();
  await page.getByText('Welt löschen', { exact: true }).click();
  await page.getByText('Endgültig löschen', { exact: true }).click();
  await expect(page.getByText('Noch keine Welt gespeichert', { exact: true })).toBeVisible();
  await page.click('#pClose');
  await expect(page.locator('#lbResumeName')).toBeHidden();
  await expect(page.locator('#lbPlay')).toHaveText('Alleine starten');
});

test('the crew uses live room members, readiness and additional player counts', async ({ browser }) => {
  const { startRelay } = await import('./relayproc.js');
  const r = startRelay(8806); await r.ready;
  const pages = [];
  try {
    for (const name of ['Anna', 'Bert', 'Cleo', 'Dora']) {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } }); pages.push(page);
      await lobby(page);
      await page.evaluate(name => {
        const profile = JSON.parse(localStorage.getItem('flintworks-profile'));
        profile.name = name;
        localStorage.setItem('flintworks-profile', JSON.stringify(profile));
      }, name);
      await page.goto('/?mp=ws://localhost:8806');
      await page.waitForFunction(() => window.__ww);
    }
    const [host, ...guests] = pages;
    await host.click('#lbTogether');
    await host.click('#lbCreate');
    await expect(host.locator('.lb-codetap b')).toHaveText(/^[A-Z0-9]{5}$/);
    const code = await host.locator('.lb-codetap b').textContent();
    for (const guest of guests) {
      await guest.click('#lbTogether');
      await guest.fill('#lbCodeIn', code); await guest.click('#lbJoinBtn');
      await expect(guest.locator('.pt-grid')).toContainText('Anna');
    }
    await guests[0].locator('.pt-go', { hasText: 'Bereit!' }).click();
    await expect(host.locator('.pt-grid')).toContainText('Dora');
    await host.click('#pClose');
    await expect(host.locator('#lbCrewState')).toHaveText('Spieler im Raum: 4');
    await expect(host.locator('#lbSlot1')).toContainText('Bert ✓');
    await expect(host.locator('#lbSlot1')).toHaveAttribute('aria-label', /Bert · bereit/);
    await expect(host.locator('#lbSlot2')).toContainText('Cleo +1');
    await host.locator('#lbSlot1').click({ trial: true });
    await host.locator('#lbSlot2').click({ trial: true });
    await host.screenshot({ path: 'test-results/werkhof-crew.png' });
    await host.setViewportSize({ width: 844, height: 390 });
    await host.locator('#lbSlot1').click({ trial: true });
    const heading = await host.locator('.lb-crew-heading').boundingBox();
    for (const slot of ['#lbSlot1', '#lbSlot2']) {
      const name = await host.locator(`${slot} .nm`).boundingBox();
      expect(heading.y + heading.height).toBeLessThanOrEqual(name.y);
    }
    await host.screenshot({ path: 'test-results/werkhof-crew-landscape.png' });
    await host.click('#lbSlot2');
    await expect(host.locator('.pt-grid')).toContainText('Dora');
  } finally { await Promise.all(pages.map(p => p.close())); r.relay.kill(); }
});

test('reduced motion keeps the lobby scene still', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await lobby(page);
  await page.evaluate(async () => Promise.all([
    (await import('/src/minerart.js')).preloadMinerArt(),
    (await import('/src/sceneart.js')).preloadSceneArt(),
    (await import('/src/objectart.js')).objectArtReady,
    (await import('/src/terrainart.js')).terrainArtReady,
  ]));
  // Wait for the first paint and overlay placement before comparing the canvas.
  await page.waitForFunction(() => {
    const c = document.querySelector('#lbCv');
    return document.querySelector('#lbSlot1').style.left && c.getContext('2d').getImageData(0, 0, 1, 1).data[3] === 255;
  });
  const hash = () => page.locator('#lbCv').evaluate(async c => {
    const pixels = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    const digest = await crypto.subtle.digest('SHA-256', pixels);
    return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
  });
  const first = await hash();
  await page.waitForTimeout(700);
  expect(await hash()).toBe(first);
});

for (const viewport of [{ width: 1280, height: 800 }, { width: 844, height: 390 }, { width: 390, height: 844 }]) {
  test(`hero podium stays central and clear of launch controls at ${viewport.width}×${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await lobby(page);
    await page.waitForFunction(() => {
      const cv = document.querySelector('#lbCv');
      const width = Math.round(cv.getBoundingClientRect().width * Math.min(2, devicePixelRatio));
      return cv.width === width && cv.getContext('2d').getImageData(0, 0, 1, 1).data[3] === 255;
    });
    const hero = await page.evaluate(async () => {
      const { heroScreen } = await import('/src/lobbyscene.js');
      const cv = document.querySelector('#lbCv');
      const h = heroScreen(cv), r = cv.getBoundingClientRect();
      return { x: r.left + h.x, top: r.top + h.y - h.height, bottom: r.top + h.y, height: h.height, canvasHeight: r.height };
    });
    expect(Math.abs(hero.x - viewport.width / 2)).toBeLessThan(6);
    expect(hero.height).toBeGreaterThan(hero.canvasHeight * .28);
    expect(hero.top).toBeGreaterThan(54);
    const play = await page.locator('#lbPlay').boundingBox();
    expect(hero.bottom).toBeLessThan(play.y);
    await page.locator('#lbFriendsSide').click();
    await expect(page.locator('#panel')).toBeVisible();
  });
}
