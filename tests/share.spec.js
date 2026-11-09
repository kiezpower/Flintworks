// Levels as a link (levels/share.js, levels/draft.js): every level of the game passes the check
// unchanged; a link with markup, tricks or unknown kinds is cleaned or refused; a link opens the
// level in the game (without touching a round in progress unasked, and without saving it); the
// editor makes such a link: npm test
import { expect, test } from '@playwright/test';

async function fresh(page, url = '/', profile = {}) {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/');
  await page.evaluate(p => {
    localStorage.clear();
    localStorage.setItem('flintworks-lang', 'de');
    localStorage.setItem('flintworks-profile', JSON.stringify({ tutorialDone: true, installAsked: 'done', games: 3, ...p }));
  }, profile);
  await page.goto(url);
  await page.waitForFunction(() => window.__ww);
  return errors;
}
// a link to a level of the game, with changes
const linkOf = (page, id, change = '') =>
  page.evaluate(
    async ([id, change]) => {
      const { packLevel } = await import('/src/levels/share.js'),
        { GAME_MODES } = await import('/src/modes.js');
      const L = JSON.parse(JSON.stringify(GAME_MODES[id].pkg));
      // eslint-disable-next-line no-new-func
      if (change) new Function('L', change)(L);
      return packLevel(L);
    },
    [id, change],
  );

test('every level of the game passes the check unchanged', async ({ page }) => {
  const errors = await fresh(page);
  const r = await page.evaluate(async () => {
    const { cleanLevel } = await import('/src/levels/share.js'),
      { GAME_MODES } = await import('/src/modes.js'),
      { CHAPTER2, MAP_IDS } = await import('/src/levels/index.js');
    const norm = v =>
      Array.isArray(v)
        ? v.map(norm)
        : v && typeof v === 'object'
          ? Object.fromEntries(Object.keys(v).sort().map(k => [k, norm(v[k])]))
          : v;
    const out = [];
    for (const id of [...CHAPTER2, ...MAP_IDS]) {
      const L = GAME_MODES[id].pkg;
      try {
        const c = cleanLevel(JSON.parse(JSON.stringify(L)));
        for (const k of Object.keys(L))
          if (k !== 'id' && k !== 'map' && JSON.stringify(norm(L[k])) !== JSON.stringify(norm(c[k]))) out.push(`${id}.${k}`);
        if (L.map.replace(/\r/g, '').split('\n').filter(r => r).join('\n') !== c.map) out.push(`${id}.map`);
      } catch (e) {
        out.push(`${id}: ${e.message}`);
      }
    }
    return { out, n: CHAPTER2.length + MAP_IDS.length };
  });
  expect(r.n).toBeGreaterThan(10);
  expect(r.out).toEqual([]);
  expect(errors).toEqual([]);
});

test('markup is taken out of texts; tricks, unknown kinds and oversize links are refused', async ({ page }) => {
  const errors = await fresh(page);
  const r = await page.evaluate(async () => {
    const { cleanLevel, packLevel, unpackLevel } = await import('/src/levels/share.js'),
      { GAME_MODES } = await import('/src/modes.js');
    const base = () => JSON.parse(JSON.stringify(GAME_MODES.fluffelrettung.pkg));
    const refused = f => {
      const L = base();
      f(L);
      try {
        cleanLevel(L);
        return false;
      } catch (e) {
        return !!e.badLevel;
      }
    };
    const out = {};
    // texts: no markup characters survive, length capped
    const L = base();
    L.name = '<img src=x onerror=alert(1)>Höhle';
    L.intro = '"><script>alert(1)</script>' + 'x'.repeat(2000);
    L.triggers[0].do[0].text = '<b onclick="x()">Hallo</b> & tschüss';
    const c = cleanLevel(L);
    out.name = c.name;
    out.introLen = c.intro.length;
    out.noMarkup = ![c.name, c.intro, c.triggers[0].do[0].text].some(t => /[<>&"']/.test(t));
    out.id = c.id;
    // a key named __proto__ does not reach any prototype
    const P = JSON.parse(JSON.stringify(base()).replace('"rules":{', '"rules":{"__proto__":{"polluted":1},'));
    try {
      cleanLevel(P);
    } catch {}
    out.polluted = ({}).polluted === 1 || Object.prototype.polluted === 1;
    out.refused = {
      object: refused(L => L.objects.push({ t: 'script', x: 1 })),
      animal: refused(L => L.objects.push({ t: 'animal', kind: 'dragon', x: 1 })),
      action: refused(L => L.triggers.push({ when: { t: 'after', min: 1 }, do: [{ t: 'eval', text: 'x' }] })),
      goalRef: refused(L => L.triggers.push({ when: { t: 'goal', n: 99 }, do: [] })),
      goal: refused(L => (L.goals = [{ t: 'hack', n: 1 }])),
      mapChar: refused(L => (L.map = L.map.replace('#', 'Z'))),
      mapSize: refused(L => (L.size = [L.size[0] + 4, L.size[1]])),
      size: refused(L => (L.size = [99999, 300])),
      money: refused(L => (L.start.money = 1e12)),
      nan: refused(L => (L.seed = 'abc')),
    };
    // a small link that unfolds into something huge, and a link that is no level at all
    const huge = await packLevel({ ...base(), intro: 'a'.repeat(900000) });
    out.hugeRefused = await unpackLevel(huge).then(() => false, e => !!e.badLevel);
    out.junkRefused = await unpackLevel('nichts<>').then(() => false, e => !!e.badLevel);
    // a fair link comes back as the level
    const back = await unpackLevel(await packLevel(base()));
    out.roundTrip = back.name === 'Fluffelrettung' && back.map === base().map.replace(/\r/g, '').split('\n').filter(r => r).join('\n');
    return out;
  });
  expect(r).toMatchObject({ name: 'img src=x onerror=alert(1)Höhle', noMarkup: true, id: 'geteilt', polluted: false });
  expect(r.introLen).toBeLessThanOrEqual(400);
  expect(r.refused).toEqual({
    object: true,
    animal: true,
    action: true,
    goalRef: true,
    goal: true,
    mapChar: true,
    mapSize: true,
    size: true,
    money: true,
    nan: true,
  });
  expect(r).toMatchObject({ hugeRefused: true, junkRefused: true, roundTrip: true });
  expect(errors).toEqual([]);
});

test('a level link opens the level; it is not saved; a round in progress is only ended when asked', async ({ page }) => {
  let errors = await fresh(page);
  const code = await linkOf(page, 'fluffelrettung', "L.name = 'Meine Fluffel'; L.objects = L.objects.filter(o => !o.lost || o.x < 300);");
  // no round in progress: straight into the level
  await page.goto('/?lvl=' + code);
  await page.waitForFunction(() => window.__ww && window.__ww.state === 'play');
  const g = await page.evaluate(async () => {
    const w = window.__ww,
      { GAME_MODES } = await import('/src/modes.js'),
      { saveGame } = await import('/src/save.js');
    saveGame();
    return { mode: w.G.mode, name: GAME_MODES[w.G.mode].name, saved: !!localStorage.getItem('wuehlwelt-save-v1') };
  });
  expect(g).toEqual({ mode: 'geteilt', name: 'Meine Fluffel', saved: false });
  // a round of free play in progress (saved): the link asks first, "Später" keeps it
  errors = errors.concat(await fresh(page));
  await page.click('#lbPlay');
  await page.waitForFunction(() => window.__ww.state === 'play');
  await page.evaluate(async () => (await import('/src/save.js')).saveGame());
  await page.goto('/?lvl=' + code);
  await page.waitForFunction(() => window.__ww);
  await expect(page.locator('#pTitle')).toHaveText('Geteiltes Level');
  await expect(page.locator('#panel')).toContainText('Meine Fluffel');
  await page.locator('#panel .opt', { hasText: 'Später' }).click();
  expect(await page.evaluate(() => !!localStorage.getItem('wuehlwelt-save-v1'))).toBe(true);
  // a broken link: a note, nothing else
  await page.goto('/?lvl=AAAA');
  await page.waitForFunction(() => window.__ww);
  await expect(page.locator('#toast')).toContainText('Dieser Level-Link ist ungültig');
  expect(errors).toEqual([]);
});

test('the editor makes a link that plays its level', async ({ page }) => {
  const errors = await fresh(page);
  await page.goto('/editor.html?level=fluffelrettung');
  await page.waitForFunction(() => window.__editor && window.__editor.grid);
  // (no share sheet in the test browser: the link goes to the clipboard, and is kept for the test)
  await page.evaluate(() => {
    delete navigator.share;
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: async () => {} } });
  });
  await page.click('#shareBtn');
  await expect(page.locator('#msg')).toContainText('Link kopiert');
  const link = await page.evaluate(() => window.__shared);
  expect(link).toMatch(/\?lvl=[A-Za-z0-9_-]+$/);
  await page.goto(link);
  await page.waitForFunction(() => window.__ww && window.__ww.state === 'play');
  expect(await page.evaluate(() => window.__ww.G.mode)).toBe('geteilt');
  // the level selection leads to the editor
  expect(errors).toEqual([]);
});
