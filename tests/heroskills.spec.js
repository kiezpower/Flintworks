import { expect, test } from '@playwright/test';

async function start(page, hero = 'anna', extra = {}) {
  await page.addInitScript(({ hero, extra }) => {
    localStorage.setItem('flintworks-lang', 'de');
    localStorage.setItem('flintworks-profile', JSON.stringify({ tutorialDone: true, installAsked: 'done',
      name: 'Test', playKind: 'solo', gmode: 'gold', games: 3, hero, level: 5, wins: 10, ...extra }));
  }, { hero, extra });
  await page.goto('/');
  await page.waitForFunction(() => window.__ww);
  await page.click('#lbPlay');
  await page.waitForFunction(() => window.__ww.state === 'play');
}

test('all six roles have distinct rules; every restricted mode disables all bonuses', async ({ page }) => {
  await start(page);
  const result = await page.evaluate(async () => {
    const { G } = window.__ww;
    const s = await import('/src/heroskills.js');
    const c = id => ({ pid: 0, skin: `blue.wood.${id}`, heroActive: 300 });
    const free = [s.digFactor(c('1'), true), s.capacity(c('2')), s.hookFactor(c('4')), s.buildFactor(c('5'))];
    const blocked = [];
    for (const change of [{ tut: true }, { daily: {} }, { teams: [{}] }, { mode: 'daily' }, { mode: 'camp1' }, { mode: 'custom' }]) {
      Object.assign(G, { tut: false, daily: null, teams: null, mode: 'gold' }, change);
      blocked.push([s.digFactor(c('1'), true), s.capacity(c('2')), s.hookFactor(c('4')), s.buildFactor(c('5'))]);
    }
    return { free, blocked, legacy: s.roleOf({ pid: 0, skin: 'blue.wood' }), helper: s.roleOf(c('1') && { skin: 'blue.wood.1' }) };
  });
  expect(result.free[0]).toBeCloseTo(1.54);
  expect(result.free.slice(1)).toEqual([20, 1.4, 1.15]);
  for (const blocked of result.blocked) expect(blocked).toEqual([1, 16, 1, 1]);
  expect(result.legacy).toBeNull(); expect(result.helper).toBeNull();
});

test('ability input, cooldown and empty activations do not grant mastery', async ({ page }) => {
  await start(page);
  await expect(page.locator('#heroAbility')).toBeVisible();
  await page.keyboard.press('r');
  await expect(page.locator('#heroAbility')).toBeDisabled();
  const state = await page.evaluate(async () => {
    const { crew, G } = window.__ww, c = crew.find(c => c.pid === G.myId);
    const { exec } = await import('/src/commands.js');
    const before = c.heroCooldown; exec(G.myId, 'heroAbility', {});
    return { before, after: c.heroCooldown, active: c.heroActive, progress: c.heroCounters };
  });
  expect(state.active).toBeGreaterThan(0); expect(state.after).toBe(state.before);
  expect(state.progress?.anna?.feats || 0).toBe(0);
});

test('productive actions advance chapters once, unlock a variant and preserve cosmetics', async ({ page }) => {
  await start(page);
  const result = await page.evaluate(async () => {
    const { crew, G } = window.__ww, c = crew.find(c => c.pid === G.myId);
    const { heroEvent } = await import('/src/heroskills.js');
    const { collectMastery } = await import('/src/heroabilities.js');
    const { P } = await import('/src/profile.js');
    collectMastery(c);
    c.heroActive = 480; c.heroUseful = false;
    heroEvent(c, 'dig', 2500); heroEvent(c, 'dig', 10);
    collectMastery(c);
    const once = P.heroMastery.anna.feats;
    c.heroUseful = false; heroEvent(c, 'dig', 1); collectMastery(c);
    const twice = structuredClone(P.heroMastery.anna);
    const xp = P.xp, level = P.level;
    collectMastery(c); collectMastery(c);
    return { once, twice, stable: xp === P.xp && level === P.level, outfit: P.outfit };
  });
  expect(result.once).toBe(1); expect(result.twice.rewarded).toBe(2);
  expect(result.stable).toBe(true); expect(result.outfit).toBe('blue');
});

test('world snapshots carry cooldown, scan and owner-only progress without replaying old rewards', async ({ page }) => {
  await start(page, 'mika');
  const result = await page.evaluate(async () => {
    const { G, crew } = window.__ww, c = crew.find(c => c.pid === G.myId);
    const { KINDS } = await import('/src/net/sync.js');
    const { collectMastery } = await import('/src/heroabilities.js');
    const { P } = await import('/src/profile.js');
    c.heroActive = 300; c.heroCooldown = 1200; c.heroScan = [[20, 30]];
    c.heroCounters = { mika: { work: 20, feats: 1 } };
    const data = KINDS.crew.pack(c), copy = KINDS.crew.create(data); KINDS.crew.apply(copy, data);
    collectMastery(copy); // restored/imported counters are a baseline, not new actions
    const before = P.heroMastery?.mika?.work || 0;
    copy.heroCounters.mika = { work: 21, feats: 1 }; collectMastery(copy);
    const after = P.heroMastery.mika.work;
    copy.pid = 99; copy.heroCounters.mika.work = 100; collectMastery(copy);
    return { active: copy.heroActive, cooldown: copy.heroCooldown, scan: copy.heroScan, before, after, other: P.heroMastery.mika.work };
  });
  expect(result).toEqual({ active: 300, cooldown: 1200, scan: [[20, 30]], before: 0, after: 1, other: 1 });
});

test('Bruno collects beyond sixteen and exports a valid world', async ({ page }) => {
  await start(page, 'bruno');
  const result = await page.evaluate(async () => {
    const { G, crew } = window.__ww, c = crew.find(c => c.pid === G.myId);
    const { capacity } = await import('/src/heroskills.js');
    const { serialize } = await import('/src/save.js');
    const { validWorldObjects } = await import('/src/worldstore.js');
    c.x = G.base.x + G.base.w + 50;
    c.inv = Array(20).fill('rock');
    return { capacity: capacity(c), valid: await validWorldObjects({ data: serialize() }) };
  });
  expect(result).toEqual({ capacity: 20, valid: true });
  await expect(page.locator('.bag')).toContainText('20/20');
});

test('Toni requires a working machine and consumes existing resources normally', async ({ page }) => {
  await start(page, 'toni');
  const result = await page.evaluate(async () => {
    const { G, crew, builds } = window.__ww, c = crew.find(c => c.pid === G.myId);
    const { exec } = await import('/src/commands.js');
    const { updProduction } = await import('/src/store.js');
    exec(G.myId, 'heroAbility', {}); const empty = c.heroCooldown || 0;
    const b = { id: 999, type: 'saw', x: c.x, gy: c.y, w: 20, h: 15, done: true, busy: 3, out: 'plank', n: 3 };
    builds.push(b); G.store.wood = 0;
    exec(G.myId, 'heroAbility', {});
    updProduction(b); const half = b.busy;
    const old = G.store.plank || 0; updProduction(b);
    return { empty, half, output: G.store.plank - old, wood: G.store.wood, feats: c.heroCounters.toni.feats };
  });
  expect(result).toEqual({ empty: 0, half: 1.5, output: 3, wood: 0, feats: 1 });
});

test('alternative unlocks and English mastery descriptions work without wins', async ({ page }) => {
  await start(page, 'anna', { wins: 0, level: 1, heroCareer: { build: 12, find: 60 } });
  const available = await page.evaluate(async () => {
    const { HEROES, heroAvailable } = await import('/src/heroes.js');
    const { P } = await import('/src/profile.js');
    return HEROES.every(h => heroAvailable(h, P));
  });
  expect(available).toBe(true);
  await page.evaluate(async () => {
    (await import('/src/i18n.js')).setLang('en');
    (await import('/src/heroalbum.js')).openHeroAlbum();
  });
  await expect(page.locator('#heroSkills')).toContainText('Tunnel building');
  await expect(page.locator('#heroSkills')).toContainText('Quick: 5 s duration');
  await expect(page.locator('#heroSkills')).toContainText('Optional today: use an ability productively');
});

test('new snapshots do not alias mutable progress and settlement projects survive saves', async ({ page }) => {
  await start(page);
  const result = await page.evaluate(async () => {
    const { G, crew } = window.__ww, c = crew.find(c => c.pid === G.myId);
    const { heroEvent } = await import('/src/heroskills.js');
    const { KINDS } = await import('/src/net/sync.js');
    const { serialize, deserialize } = await import('/src/save.js');
    G.mode = 'settlement'; c.heroActive = 300; c.heroUseful = false;
    heroEvent(c, 'dig', 1);
    const old = KINDS.crew.pack(c);
    heroEvent(c, 'dig', 1);
    const fresh = KINDS.crew.pack(c);
    const before = [...G.heroProject.roles];
    const save = serialize(); G.heroProject = null; deserialize(save);
    return { old: old.hp.anna.work, fresh: fresh.hp.anna.work, before, restored: G.heroProject.roles };
  });
  expect(result).toEqual({ old: 1, fresh: 2, before: ['anna'], restored: ['anna'] });
});

test('mastery variant, optional daily goal and cosmetic reward persist without duplicate payouts', async ({ page }) => {
  await start(page);
  const result = await page.evaluate(async () => {
    const { G, crew } = window.__ww, c = crew.find(c => c.pid === G.myId);
    const { heroEvent } = await import('/src/heroskills.js');
    const { collectMastery } = await import('/src/heroabilities.js');
    const { P, dayNumber } = await import('/src/profile.js');
    collectMastery(c);
    for (let i = 0; i < 8; i++) {
      c.heroActive = 300; c.heroUseful = false; heroEvent(c, 'dig', 1250); collectMastery(c);
    }
    const level = P.level, xp = P.xp;
    c.heroUseful = false; heroEvent(c, 'dig', 1); collectMastery(c);
    dispatchEvent(new Event('pagehide'));
    const saved = JSON.parse(localStorage.getItem('flintworks-profile'));
    return { chapters: saved.heroMastery.anna.rewarded, daily: saved.heroDaily === dayNumber(),
      royal: saved.owned.includes('o:royal'), outfit: saved.outfit, duplicate: level !== P.level || xp !== P.xp };
  });
  expect(result).toEqual({ chapters: 3, daily: true, royal: true, outfit: 'blue', duplicate: false });
});

test('Nora mitigates real damage only while active; Mika scan range changes without granting progress', async ({ page }) => {
  await start(page, 'nora');
  const result = await page.evaluate(async () => {
    const { G, crew } = window.__ww, c = crew.find(c => c.pid === G.myId);
    const { hurt } = await import('/src/digger.js');
    const { heroTick } = await import('/src/heroabilities.js');
    const { mat, W, H, AIR, GOLD } = await import('/src/world.js');
    c.energy = 100; c.heroActive = 300; c.heroUseful = false;
    hurt(c, 10, true); const active = c.energy;
    c.heroActive = 0; hurt(c, 10, true); const passive = c.energy;
    const guard = c.heroCounters.nora.work;
    c.skin = 'blue.wood.3'; c.x = 200; c.y = 100; G.frame = 30;
    for (let y = 10; y < Math.min(H, 195); y++) for (let x = 110; x < Math.min(W, 295); x++) mat[y * W + x] = AIR;
    mat[100 * W + 251] = GOLD;
    heroTick(c); const nearby = c.heroScan.length;
    c.heroActive = 300; heroTick(c);
    return { active, passive, guard, nearby, distant: c.heroScan.length, feats: c.heroCounters.mika?.feats || 0 };
  });
  expect(result.active).toBe(93); expect(result.passive).toBe(83); expect(result.guard).toBeCloseTo(3);
  expect(result.nearby).toBe(0); expect(result.distant).toBeGreaterThan(0); expect(result.feats).toBe(0);
});

test('mobile ability button stays below the top HUD and inside the viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await start(page);
  await expect(page.locator('#heroAbility')).toBeVisible();
  const ability = await page.locator('#heroAbility').boundingBox();
  const crew = await page.locator('#crew').boundingBox();
  const inventory = await page.locator('#inv').boundingBox();
  expect(ability.y).toBeGreaterThan(Math.max(crew.y + crew.height, inventory.y + inventory.height) + 8);
  expect(ability.y + ability.height).toBeLessThanOrEqual(844);
  expect(ability.x).toBeGreaterThanOrEqual(0);
  expect(ability.x + ability.width).toBeLessThanOrEqual(390);
});

test('world import rejects malformed role counters, scan results and project contributions', async ({ page }) => {
  await start(page, 'bruno');
  const result = await page.evaluate(async () => {
    const { serialize } = await import('/src/save.js');
    const { validWorldObjects } = await import('/src/worldstore.js');
    const data = serialize();
    const valid = await validWorldObjects({ data });
    const checks = [];
    for (const fields of [
      { heroCounters: { anna: null } }, { heroCounters: [] },
      { heroCounters: { anna: { work: 'broken', feats: 0 } } },
      { heroCareer: { find: -1 } }, { heroScan: {} }, { heroScan: [[-10, 0]] },
    ]) {
      const copy = structuredClone(data); Object.assign(copy.crew[0], fields);
      checks.push(await validWorldObjects({ data: copy }));
    }
    for (const roles of ['anna', ['unknown'], ['anna', 'anna']]) {
      const copy = structuredClone(data); copy.heroProject = { roles };
      checks.push(await validWorldObjects({ data: copy }));
    }
    return { valid, checks };
  });
  expect(result.valid).toBe(true);
  expect(result.checks).toEqual(Array(9).fill(false));
});
