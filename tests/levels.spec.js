// Hand-built levels (src/levels/): every level loads without errors in its own size, stands on
// firm ground, can reach all its goals, comes out the same every time, and can be won, lost,
// saved and loaded: npm test
import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

// one star on every level of chapter 2, so all of them are open in the campaign list
const ORDER = JSON.parse(readFileSync(new URL('../src/levels/order.json', import.meta.url), 'utf8'));
const OPEN = Object.fromEntries(ORDER.map(id => [id, 1]));

async function lobby(page) {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/');
  await page.evaluate(open => {
    localStorage.clear();
    localStorage.setItem('flintworks-lang', 'de');
    localStorage.setItem(
      'flintworks-profile',
      JSON.stringify({ tutorialDone: true, installAsked: 'done', gmode: 'campaign', campaign: open }),
    );
  }, OPEN);
  await page.reload();
  await page.waitForFunction(() => window.__ww);
  return errors;
}
// chapter 2 and the maps for free play, Koop and Versus
const levelIds = page => page.evaluate(() => import('/src/levels/index.js').then(m => [...m.CHAPTER2, ...m.MAP_IDS]));
// a level started like a player does: campaign list in the lobby, click on the level; a map is
// chosen as the game mode and played
async function start(page, id) {
  const map = await page.evaluate(id => import('/src/modes.js').then(m => m.GAME_MODES[id].map), id);
  if (map) {
    await page.evaluate(id => {
      const p = JSON.parse(localStorage.getItem('flintworks-profile'));
      localStorage.setItem('flintworks-profile', JSON.stringify({ ...p, gmode: id }));
    }, id);
    await page.reload();
    await page.waitForFunction(() => window.__ww);
    await page.click('#lbPlay');
    await page.waitForFunction(() => window.__ww.state === 'play');
    return;
  }
  await page.click('#lbPlay');
  // (taps right after a panel opens are ignored)
  await page.waitForTimeout(500);
  const name = await page.evaluate(id => import('/src/modes.js').then(m => m.GAME_MODES[id].name), id);
  await page.locator('button.opt').filter({ hasText: name }).first().click();
  await page.waitForFunction(() => window.__ww.state === 'play');
}

test('every level loads in its size, on firm ground, with every goal within reach', async ({ page }) => {
  const errors = await lobby(page);
  const ids = await levelIds(page);
  expect(ids.length).toBeGreaterThan(0);

  for (const id of ids) {
    // a fresh profile for each level (otherwise "play" goes on with the round before)
    errors.push(...(await lobby(page)));
    await start(page, id);
    await page.waitForFunction(() => document.getElementById('goalTxt').textContent !== '');
    const r = await page.evaluate(() => {
      const w = window.__ww,
        { W, H, mat, SOLID, GRANITE, AIR } = w.world,
        b = w.base;
      const solidAt = (x, y) => SOLID[mat[Math.floor(y) * W + Math.floor(x)]] === 1;
      // a way from the castle to every place a goal is: anything but granite can be dug or swum
      const S = 2,
        GW = Math.ceil(W / S),
        GH = Math.ceil(H / S),
        seen = new Uint8Array(GW * GH),
        open = (gx, gy) => mat[gy * S * W + gx * S] !== GRANITE;
      const q = [Math.floor((b.x + 18) / S) + Math.floor((b.gy - 5) / S) * GW];
      seen[q[0]] = 1;
      while (q.length) {
        const c = q.pop(),
          x = c % GW,
          y = (c / GW) | 0;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx,
            ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= GW || ny >= GH || seen[ny * GW + nx] || !open(nx, ny)) continue;
          seen[ny * GW + nx] = 1;
          q.push(ny * GW + nx);
        }
      }
      const reach = (x, y) => !!seen[Math.floor(y / S) * GW + Math.floor(x / S)];
      const targets = [
        ...w.animals.filter(a => a.lost).map(a => ['animal', a.x, a.y]),
        ...w.crew.filter(c => c.trapped).map(c => ['trapped', c.x + 3, c.y + 5]),
        ...(w.G.chests || []).map(c => ['chest', c.x + 4, c.y + 3]),
      ];
      return {
        mode: w.G.mode,
        size: [W, H],
        baseOnGround: solidAt(b.x + 18, b.gy + 1),
        crewFree: w.crew.filter(c => !c.trapped).every(c => !solidAt(c.x + 3, c.y + 5)),
        lostInAir: w.animals.filter(a => a.lost).every(a => mat[Math.floor(a.y + 2) * W + Math.floor(a.x + 2)] === AIR),
        unreached: targets.filter(([, x, y]) => !reach(x, y)),
        goalText: document.getElementById('goalTxt').textContent,
      };
    });
    const want = await page.evaluate(id => import('/src/modes.js').then(m => m.GAME_MODES[id].size), id);
    expect(r.mode, id).toBe(id);
    expect(r.size, id).toEqual(want);
    expect(r.baseOnGround, id).toBe(true);
    expect(r.crewFree, id).toBe(true);
    expect(r.lostInAir, id).toBe(true);
    expect(r.unreached, id).toEqual([]);
    expect(r.goalText, id).not.toBe('');
  }
  expect(errors).toEqual([]);
});

test('a level comes out the same every time, whatever ran before', async ({ page }) => {
  const errors = await lobby(page);
  const ids = await levelIds(page);
  for (const id of ids) {
    const hashes = await page.evaluate(async id => {
      const w = window.__ww,
        G = w.G,
        M = (await import('/src/modes.js')).GAME_MODES[id];
      const once = extra => {
        G.frame += extra;
        Object.assign(G, { nextMode: id, nextSeed: M.seed, nextBiome: M.biome, nextDiff: M.diff || 'adventure' });
        w.gen();
        G.nextSeed = null;
        const { mat, bg, W, H } = w.world;
        let h = 0;
        for (let i = 0; i < W * H; i++) h = (Math.imul(h, 31) + (mat[i] | (bg[i] << 4))) >>> 0;
        return h;
      };
      return [once(0), once(1), once(14)];
    }, id);
    expect(new Set(hashes).size, id).toBe(1);
  }
  expect(errors).toEqual([]);
});

test('Wipfrettung: reaching the wipfs frees them, the hints come, the level is won', async ({ page }) => {
  const errors = await lobby(page);
  await start(page, 'wipfrettung');
  const r = await page.evaluate(() => {
    const w = window.__ww,
      c = w.crew[0],
      toasts = [];
    const tEl = document.getElementById('toast');
    const seen = () => tEl.textContent && !toasts.includes(tEl.textContent) && toasts.push(tEl.textContent);
    // walk into the rock area: the hint about the flint
    c.x = 380;
    c.y = 100;
    w.step(35);
    seen();
    const lost = w.animals.filter(a => a.lost);
    const counts = [];
    for (const a of lost) {
      c.x = a.x;
      c.y = a.y - 6;
      c.vx = c.vy = 0;
      w.step(35);
      seen();
      counts.push(w.G.rescued);
      if (w.state !== 'play') break;
    }
    w.step(5);
    return { counts, state: w.state, toasts, stars: JSON.parse(localStorage.getItem('flintworks-profile')).campaign };
  });
  expect(r.counts).toEqual([1, 2, 3, 4]);
  expect(r.state).toBe('won');
  expect(r.toasts.some(t => t.includes('Feuerstein'))).toBe(true);
  expect(r.stars.wipfrettung).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test('a level is lost when the crew is gone, and saved and loaded with its progress', async ({ page }) => {
  const errors = await lobby(page);
  await start(page, 'wipfrettung');
  const saved = await page.evaluate(() => {
    const w = window.__ww,
      c = w.crew[0],
      a = w.animals.find(a => a.lost);
    c.x = a.x;
    c.y = a.y - 6;
    w.step(35);
    w.save();
    const before = { rescued: w.G.rescued, lost: w.animals.filter(a => a.lost).length, size: [w.world.W, w.world.H] };
    // another world in between
    Object.assign(w.G, { nextMode: 'gold', nextSize: [1400, 400] });
    w.gen();
    w.G.nextSize = null;
    w.load();
    const after = {
      rescued: w.G.rescued,
      lost: w.animals.filter(a => a.lost).length,
      size: [w.world.W, w.world.H],
      mode: w.G.mode,
    };
    return { before, after };
  });
  expect(saved.after).toEqual({ ...saved.before, mode: 'wipfrettung' });
  expect(saved.before).toEqual({ rescued: 1, lost: 3, size: [800, 300] });
  const lost = await page.evaluate(() => {
    const w = window.__ww;
    for (const c of w.crew) c.dead = true;
    w.step(35);
    return { state: w.state, text: document.getElementById('overlay').textContent };
  });
  expect(lost.state).toBe('lost');
  expect(lost.text).toContain('Alle Wühler sind verloren');
  expect(errors).toEqual([]);
});

test('every text of every level has an English version', async ({ page }) => {
  await lobby(page);
  const missing = await page.evaluate(async () => {
    const { CHAPTER2, MAP_IDS } = await import('/src/levels/index.js'),
      { GAME_MODES } = await import('/src/modes.js'),
      { hasEnglish } = await import('/src/i18n.js');
    const out = [];
    for (const id of [...CHAPTER2, ...MAP_IDS]) {
      const L = GAME_MODES[id].pkg,
        texts = [L.name, L.desc, L.intro];
      for (const t of L.triggers || []) for (const d of t.do) texts.push(d.text, d.title);
      for (const g of L.goals) texts.push(g.label);
      for (const s of texts) if (s && !hasEnglish(s)) out.push(`${id}: ${s}`);
    }
    return out;
  });
  expect(missing).toEqual([]);
});

// Chapter 1 is made by the generator from fixed seeds. These checksums freeze its seven worlds:
// when this test fails, the generator has changed – play the levels, check their star times,
// then take the new checksums.
test('the seven levels of chapter 1 stay exactly as they are', async ({ page }) => {
  const errors = await lobby(page);
  const want = {
    c1: 509105164,
    c2: 2346584643,
    c3: 3226257325,
    c4: 4017410677,
    c5: 3041344851,
    c6: 2303378087,
    c7: 1057119582,
  };
  const got = await page.evaluate(async ids => {
    const { GAME_MODES } = await import('/src/modes.js');
    const w = window.__ww,
      G = w.G,
      out = {};
    for (const id of ids) {
      const M = GAME_MODES[id];
      Object.assign(G, { nextSeed: M.seed, nextBiome: M.biome, nextMode: id, nextDiff: M.diff || 'adventure' });
      G.nextVersus = false;
      G.nextSize = null;
      G.frame = 1;
      w.world.stamp.fill(0);
      w.gen();
      G.nextSeed = null;
      const { mat, bg, shade, surf, W, H } = w.world;
      let h = 2166136261;
      const add = v => {
        h ^= v;
        h = Math.imul(h, 16777619) >>> 0;
      };
      for (let i = 0; i < W * H; i++) add(mat[i] | (bg[i] << 4) | (shade[i] << 5));
      for (let x = 0; x < W; x++) add(surf[x] & 0xffff);
      out[id] = h;
    }
    return out;
  }, Object.keys(want));
  expect(got).toEqual(want);
  expect(errors).toEqual([]);
});

test('a Versus map gets two castles, two teams and a winner', async ({ page }) => {
  const errors = await lobby(page);
  const r = await page.evaluate(async () => {
    const { MAP_IDS } = await import('/src/levels/index.js'),
      { GAME_MODES } = await import('/src/modes.js'),
      w = window.__ww,
      G = w.G,
      out = {};
    for (const id of MAP_IDS) {
      const M = GAME_MODES[id];
      if (!M.pkg.objects.some(o => o.t === 'base' && o.team === 1)) continue;
      Object.assign(G, { nextMode: id, nextSeed: 5, nextBiome: M.biome, nextDiff: 'adventure', nextVersus: true });
      w.gen();
      G.nextSeed = null;
      G.nextVersus = false;
      const bases = w.builds.filter(b => b.type === 'base');
      out[id] = {
        bases: bases.length,
        teams: G.teams ? G.teams.length : 0,
        apart: bases.length === 2 && Math.abs(bases[0].x - bases[1].x) > w.world.W / 2,
        team1: w.crew.filter(c => c.team === 1).length,
      };
    }
    return out;
  });
  expect(Object.keys(r).length).toBeGreaterThan(0);
  for (const id in r) expect(r[id], id).toEqual({ bases: 2, teams: 2, apart: true, team1: 2 });
  expect(errors).toEqual([]);
});
