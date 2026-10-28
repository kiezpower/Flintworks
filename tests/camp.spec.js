// Heimatbergwerk (camp.js, lobbycamp.js): crystals mined while the game is closed up to the vault,
// upgrades and solo boosts, skins that travel with the player, and the production chain in the
// castle panel (store.js chainStatus): npm test
import { expect, test } from '@playwright/test';

const HOUR = 3600 * 1000;
async function lobby(page, profile = {}) {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/');
  await page.evaluate(p => {
    localStorage.clear();
    localStorage.setItem('flintworks-lang', 'de');
    localStorage.setItem('flintworks-profile', JSON.stringify({ tutorialDone: true, installAsked: 'done', ...p }));
  }, profile);
  await page.goto('/');
  await page.waitForFunction(() => window.__ww);
  return errors;
}
const play = async page => {
  await page.click('#lbPlay');
  await page.waitForFunction(() => window.__ww.state === 'play');
};

test('the home crew mines crystals while away, capped by the vault, collected in the lobby', async ({ page }) => {
  const errors = await lobby(page, { camp: { t: Date.now() - 3 * HOUR - 60000, k: 5, lv: {} } });
  await expect(page.locator('#lbKri')).toHaveText('5');
  await expect(page.locator('#lbCamp')).toHaveClass(/alert/);
  await page.click('#lbCamp');
  await expect(page.locator('#panel')).toContainText('Deine Crew hat 18 Kristalle geschürft');
  await page.waitForTimeout(500); // (a tap right after the panel opened is ignored)
  await page.locator('#panel .opt', { hasText: 'Kassieren' }).click();
  await expect(page.locator('#panel')).toContainText('Deine Kristalle: 23');
  const r = await page.evaluate(() =>
    import('/src/camp.js').then(c => {
      const C = c.camp();
      const now = Date.now();
      C.t = now - 30 * 3600 * 1000; // more than the vault holds: 4 hours
      const capped = c.pending(now);
      C.t = now + 3600 * 1000; // a clock set back
      const back = c.pending(now);
      return { capped, back, reset: C.t === now };
    }),
  );
  expect(r.capped).toBe(24);
  expect(r.back).toBe(0);
  expect(r.reset).toBe(true);
  expect(errors).toEqual([]);
});

test('upgrades cost crystals; the solo boosts work in free play but not in the Tagesschacht', async ({ page }) => {
  const errors = await lobby(page, { camp: { t: Date.now(), k: 200, lv: {} } });
  const r = await page.evaluate(() =>
    import('/src/camp.js').then(c => {
      const ok = [c.buyUpgrade('cash'), c.buyUpgrade('pick'), c.buyUpgrade('wood')];
      return { ok, k: c.camp().k, next: c.price('cash') };
    }),
  );
  expect(r.ok).toEqual([true, true, true]);
  expect(r.k).toBe(200 - 25 - 35 - 20);
  expect(r.next).toBe(40);
  await play(page);
  const g = await page.evaluate(() =>
    import('/src/state.js').then(({ G }) => ({ money: G.money, boost: G.digBoost, wood: G.store.wood || 0 })),
  );
  expect(g.money).toBe(60);
  expect(g.boost).toBeCloseTo(1.04);
  expect(g.wood).toBeGreaterThanOrEqual(2);

  // the Tagesschacht is the same for everybody, Versus is fair: no boosts there
  const off = await page.evaluate(() =>
    Promise.all([import('/src/state.js'), import('/src/camp.js')]).then(([{ G }, c]) => {
      const was = G.mode;
      G.mode = 'daily';
      c.setDigBoost();
      const daily = G.digBoost;
      G.mode = was;
      G.teams = [{}, {}];
      c.setDigBoost();
      const versus = G.digBoost;
      G.teams = null;
      return { daily, versus };
    }),
  );
  expect(off).toEqual({ daily: 1, versus: 1 });
  expect(errors).toEqual([]);
});

test('skins: bought with crystals, worn in game, sent with the player and given to new buildings', async ({ page }) => {
  const errors = await lobby(page, { camp: { t: Date.now(), k: 150, lv: {} } });
  const r = await page.evaluate(() =>
    Promise.all([import('/src/camp.js'), import('/src/profile.js'), import('/src/skins.js')]).then(([c, { P }, s]) => {
      const poor = c.buySkin('b:gold'); // 300: too dear
      const a = c.buySkin('o:green');
      const b = c.buySkin('b:stone');
      P.outfit = 'green';
      P.bstyle = 'stone';
      return { poor, a, b, k: c.camp().k, tag: s.skinTag(P.outfit, P.bstyle), back: s.parseSkin('x.y') };
    }),
  );
  expect(r).toEqual({ poor: false, a: true, b: true, k: 10, tag: 'green.stone', back: { outfit: 'blue', style: 'wood' } });
  await play(page);
  const g = await page.evaluate(() =>
    Promise.all([import('/src/entities.js'), import('/src/state.js'), import('/src/skins.js')]).then(([e, { G }, s]) => {
      const me = e.sel_();
      const b = { type: 'saw', skin: me.skin && s.parseSkin(me.skin).style };
      return {
        skin: me.skin,
        castle: G.base.skin,
        styled: s.buildSprite(b) !== s.buildSprite({ type: 'saw' }),
        cached: s.buildSprite(b) === s.buildSprite(b),
      };
    }),
  );
  expect(g).toEqual({ skin: 'green.stone', castle: 'stone', styled: true, cached: true });
  expect(errors).toEqual([]);
});

test('the castle panel shows what each production building waits for and sends a helper', async ({ page }) => {
  const errors = await lobby(page);
  await play(page);
  await page.evaluate(() =>
    Promise.all([import('/src/state.js'), import('/src/buildings.js')]).then(([{ G, builds }, { BT }]) => {
      const T = BT.saw;
      G.store.wood = 0;
      builds.push({ id: 9999, type: 'saw', x: G.base.x + 60, gy: G.base.gy, w: T.w, h: T.h, prog: 1, done: true, busy: 0 });
      for (const c of window.__ww.crew) c.focus = 'all';
    }),
  );
  const st = await page.evaluate(() =>
    import('/src/store.js').then(s => s.chainStatus().map(x => [x.b.type, x.busy, x.why && x.why.item])),
  );
  expect(st).toContainEqual(['saw', false, 'wood']);
  await page.evaluate(() => window.__ww.openBase());
  const row = page.locator('#panel .opt', { hasText: 'wartet auf Holz' });
  await expect(row).toBeVisible();
  await page.waitForTimeout(500);
  await row.click();
  await page.evaluate(() => window.__ww.step(2));
  const focus = await page.evaluate(() => window.__ww.crew.filter(c => c.focus === 'wood').length);
  expect(focus).toBe(1);
  expect(errors).toEqual([]);
});
