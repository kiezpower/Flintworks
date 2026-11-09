// A simpler UI: one settings list in groups for the lobby and the game menu (settings.js), one
// difficulty for dangers and pace, modern or classic controls, building areas as a rule of the
// mode, and a lobby with three signposts: npm test
import { expect, test } from '@playwright/test';

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

test('the lobby has three signposts, the level opens the daily quests', async ({ page }) => {
  const errors = await lobby(page);
  await expect(page.locator('.lb-side .lb-b')).toHaveCount(3);
  await expect(page.locator('#lbKri')).toHaveText('0');
  await expect(page.locator('#lbRoadTxt')).toContainText('0/');
  await page.click('#lbLvlBtn');
  await expect(page.locator('#pTitle')).toHaveText('Tagesaufgaben');
  expect(errors).toEqual([]);
});

test('the difficulty is set in the options and sets dangers and pace', async ({ page }) => {
  const errors = await lobby(page);
  await page.click('#lbOpt');
  const tile = page.locator('#pBody .opt', { hasText: 'Schwierigkeit' });
  await expect(tile).toContainText('Schwierigkeit: Abenteuer');
  // (a panel ignores taps for a moment after it opens, against double taps)
  await page.waitForTimeout(500);
  await tile.click();
  await expect(tile).toContainText('Schwierigkeit: Hart');
  await page.waitForTimeout(500);
  await page.click('#pClose');
  await play(page);
  expect(await page.evaluate(() => [window.__ww.G.relaxed, window.__ww.G.speed])).toEqual([false, 1]);
  // in the game menu the difficulty is not offered: the world is already made
  await page.click('#menuBtn');
  await expect(page.locator('#pBody .opt', { hasText: 'Schwierigkeit' })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('a relaxed round has no dangers and a calm pace', async ({ page }) => {
  await lobby(page, { diff: 'relaxed' });
  await play(page);
  expect(await page.evaluate(() => [window.__ww.G.relaxed, window.__ww.G.speed])).toEqual([true, 0.7]);
});

test('the lobby names mode and world of the chosen card, there is no second choice', async ({ page }) => {
  await lobby(page, { gmode: 'treasure', mode: 'desert' });
  await expect(page.locator('#lbGModeTxt')).toHaveText('Schatzsucher · Wüste');
  await expect(page.locator('#lbGModePv canvas')).toHaveCount(1);
  await expect(page.locator('.lb-play .lb-sel')).toHaveCount(1);
});

test('a tap next to a panel closes it, in the lobby and in the game, without walking there', async ({ page }) => {
  const errors = await lobby(page);
  await page.click('#lbOpt');
  await page.waitForTimeout(500);
  await page.mouse.click(890, 440);
  await expect(page.locator('#panel')).toBeHidden();
  await play(page);
  await page.click('#menuBtn');
  await page.waitForTimeout(500);
  const before = await page.evaluate(() => window.__ww.crew[0].x);
  await page.mouse.click(860, 420);
  await expect(page.locator('#panel')).toBeHidden();
  await page.waitForTimeout(600);
  expect(Math.abs((await page.evaluate(() => window.__ww.crew[0].x)) - before)).toBeLessThan(2);
  expect(errors).toEqual([]);
});

test('building areas belong to the Siedler mode, not to the options', async ({ page }) => {
  await lobby(page, { gmode: 'build', territory: false });
  await play(page);
  expect(await page.evaluate(() => window.__ww.G.territory)).toBe(true);
  await lobby(page, { gmode: 'gold', territory: true });
  await play(page);
  expect(await page.evaluate(() => window.__ww.G.territory)).toBe(false);
});

test('the game menu shows the same grouped settings; classic controls climb, modern ones dig', async ({ page }) => {
  const errors = await lobby(page);
  await play(page);
  await page.click('#menuBtn');
  await expect(page.locator('#panel .psec')).toHaveText([/Spiel · v/, 'Aufgaben', 'Ton', 'Steuerung', 'Tasten', 'Anzeige', 'Grafik']);
  // (no setting for the map any more; the key that opens it is in the keys section)
  await expect(page.locator('#pBody .opt', { hasText: /Karte(?! öffnen)/ })).toHaveCount(0);
  expect(await page.evaluate(() => [window.__ww.G.autoDig, window.__ww.G.climbOn, window.__ww.G.jumpBtn])).toEqual([
    true,
    false,
    true,
  ]);
  await page.waitForTimeout(500);
  await page.locator('#pBody .opt', { hasText: 'Steuerung: Modern' }).click();
  await expect(page.locator('#pBody .opt', { hasText: 'Steuerung: Klassisch' })).toHaveCount(1);
  expect(await page.evaluate(() => [window.__ww.G.autoDig, window.__ww.G.climbOn])).toEqual([false, true]);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('flintworks-profile')).autodig)).toBe(false);
  expect(errors).toEqual([]);
});

test('option tiles without an icon put the title above its explanation', async ({ page }) => {
  await lobby(page);
  await page.click('#lbOpt');
  const tile = page.locator('#pBody .opt', { hasText: 'Steuerung' });
  const [t, s] = await Promise.all([tile.locator('b').boundingBox(), tile.locator('small').boundingBox()]);
  expect(s.y).toBeGreaterThanOrEqual(t.y + t.height - 1);
});

test('castle tiles show their state at a glance: too dear, locked, done, running, each with its reason', async ({
  page,
}) => {
  const errors = await lobby(page);
  await play(page);
  await page.evaluate(() => {
    const w = window.__ww;
    w.money = 50;
    w.G.tools = { ...w.G.tools, r_mech: true };
    w.openBase();
  });
  const tile = name => page.locator('#pBody .opt', { hasText: name }).first();
  await expect(tile('Mechanik')).toHaveClass(/st-done/);
  await expect(tile('Metallurgie')).toHaveClass(/st-poor/);
  await expect(tile('Metallurgie').locator('.why')).toHaveText('Fehlt: 10 Taler');
  await expect(tile('Luftfahrt')).toHaveClass(/st-locked/);
  await expect(tile('Luftfahrt').locator('.why')).toContainText('Erst erforschen: Metallurgie');
  // jump chips to the sections
  await expect(page.locator('#pBody .pchips button').first()).toBeVisible();
  // a running research: the others say why they wait, the running one shows its progress
  await page.evaluate(() => {
    const w = window.__ww;
    w.G.tools = { ...w.G.tools, _rq: { id: 'archery', left: 600 } };
    w.money = 500;
    w.openBase();
  });
  await expect(tile('Bogenbau')).toHaveClass(/st-busy/);
  await expect(tile('Bogenbau').locator('.pbar')).toHaveCount(1);
  await expect(tile('Metallurgie').locator('.why')).toHaveText('Es läuft schon eine Forschung');
  // a tap on a locked tile: a shake and the reason
  await page.waitForTimeout(500);
  await tile('Luftfahrt').click();
  await expect(tile('Luftfahrt')).toHaveClass(/nope/);
  await expect(page.locator('#toast')).toContainText('Erst erforschen');
  expect(errors).toEqual([]);
});

test('a won free round offers a new round as the main button, and Enter takes it', async ({ page }) => {
  const errors = await lobby(page);
  await play(page);
  await page.evaluate(() => (window.__ww.money = 900));
  await expect(page.locator('#card h1')).toHaveText('Geschafft');
  await expect(page.locator('#soloBtn')).toBeFocused();
  await expect(page.locator('#goBtn')).toHaveClass(/alt/);
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__ww.state === 'play');
  expect(await page.evaluate(() => [window.__ww.G.mode, window.__ww.money < 900])).toEqual(['gold', true]);
  expect(errors).toEqual([]);
});

test('castle tabs show one section at a time, a second tap shows all again, the choice stays', async ({ page }) => {
  const errors = await lobby(page);
  await play(page);
  await page.evaluate(() => window.__ww.openBase());
  await page.waitForTimeout(500);
  const research = page.locator('#pBody .psec', { hasText: 'Forschung' });
  const tools = page.locator('#pBody .psec', { hasText: 'Werkzeug' });
  await page.locator('.pchips button', { hasText: 'Forschung' }).click();
  await expect(page.locator('.pchips button', { hasText: 'Forschung' })).toHaveClass(/sel/);
  await expect(research).toBeVisible();
  await expect(tools).toBeHidden();
  // reopened (as after buying something): still the same tab
  await page.evaluate(() => window.__ww.openBase());
  await expect(tools).toBeHidden();
  await page.waitForTimeout(500);
  await page.locator('.pchips button', { hasText: 'Forschung' }).click();
  await expect(tools).toBeVisible();
  expect(errors).toEqual([]);
});

test('the 2x building art keeps every building at exactly double its size (collision is unchanged)', async ({ page }) => {
  const errors = await lobby(page);
  const bad = await page.evaluate(async () => {
    const { SPR } = await import('/src/sprites.js');
    const { crafted, material } = await import('/src/bldart.js');
    const out = [];
    for (const t of ['base', 'hut', 'shop', 'lift', 'pump', 'saw', 'wind', 'furnace', 'chem', 'tower', 'gate', 'flag']) {
      const o = crafted(SPR[t], 1);
      // (2× plus a one-texel outline on every side)
      if (o.width !== SPR[t].width * 2 + 2 || o.height !== SPR[t].height * 2 + 2) out.push(t);
    }
    // the materials are read from colours
    if (material(0xa6, 0x9e, 0x92) !== 'stone' || material(0x8b, 0x5e, 0x34) !== 'wood') out.push('material');
    if (material(0x9c, 0x44, 0x28) !== 'roof' || material(0xff, 0xd7, 0x7a) !== 'glass') out.push('material2');
    return out;
  });
  expect(bad).toEqual([]);
  expect(errors).toEqual([]);
});

test('a bigger bag with five slots and its own button, and the castle shows itself as the shop', async ({ page }) => {
  const errors = await lobby(page);
  await play(page);
  await page.evaluate(() => window.__ww.step(2));
  // five slots (empty ones too) and the bag button with how full it is
  await expect(page.locator('#inv .slot:not(.bag)')).toHaveCount(5);
  // (the button follows what is in the bag; standing in the castle, stones in it go to the store
  // at any moment, so compare with the bag as it is now)
  await expect
    .poll(() =>
      page.evaluate(
        () => document.getElementById('bagBtn').textContent === `${window.__ww.crew.find(c => c.pid === window.__ww.G.myId).inv.length}/16`,
      ),
    )
    .toBe(true);
  // a full bag of loam: the castle leaves loam in the hand (store.js KEEP)
  await page.evaluate(() => {
    const me = window.__ww.crew.find(c => c.pid === window.__ww.G.myId);
    while (me.inv.length < 16) me.inv.push('loam');
    window.__ww.step(1);
  });
  await expect(page.locator('#bagBtn')).toHaveClass(/full/);
  await page.keyboard.press('KeyI');
  await expect(page.locator('#pTitle')).toHaveText('Tasche');
  await expect(page.locator('#panel .opt')).toHaveCount(16);
  await page.keyboard.press('Escape');
  // at the start you stand in the castle: the action button says so and glows, no hint yet
  await expect(page.locator('#actBtn')).toHaveText('Burg');
  await expect(page.locator('.pad.act')).toHaveClass(/shop/);
  // out and back in: the hint how to shop
  const x0 = await page.evaluate(() => {
    const w = window.__ww,
      me = w.crew.find(c => c.pid === w.G.myId),
      x = me.x;
    me.x = w.G.base.x + w.G.base.w + 60;
    return x;
  });
  // (the HUD follows on the next drawn frame)
  await expect(page.locator('.pad.act')).not.toHaveClass(/shop/);
  await page.evaluate(x => {
    const w = window.__ww,
      me = w.crew.find(c => c.pid === w.G.myId);
    me.x = x;
    me.y = w.G.base.gy - 10;
  }, x0);
  await expect(page.locator('#toast')).toContainText('In der Burg');
  expect(errors).toEqual([]);
});

test('bots can be switched off in the settings: quick play then fills no castles with them', async ({ page }) => {
  const errors = await lobby(page);
  await page.click('#lbOpt');
  const tile = page.locator('#pBody .opt', { hasText: 'Bots: an' });
  await expect(tile).toHaveCount(1);
  await page.waitForTimeout(500);
  await tile.click();
  await expect(page.locator('#pBody .opt', { hasText: 'Bots: aus' })).toHaveCount(1);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('flintworks-profile')).bots)).toBe(false);
  // a quick play Versus room, alone: no bot castle (on: one bot for the blue castle)
  const msg = await page.evaluate(() =>
    Promise.all([import('/src/net/room.js'), import('/src/net/session.js'), import('/src/profile.js')]).then(
      ([{ NET }, s, { P }]) => {
        Object.assign(NET, { auto: { versus: true }, versus: true, ffa: false, pid: 1 });
        NET.players = [{ pid: 1, name: 'A', online: true }];
        const off = s.startMessage('gold');
        P.bots = true;
        const on = s.startMessage('gold');
        Object.assign(NET, { auto: null, versus: false, players: [] });
        return { off: [off.bots, off.versus], on: [on.bots, on.versus] };
      },
    ),
  );
  expect(msg).toEqual({ off: [[], false], on: [[1], true] });
  // the game menu has it too, in its first section
  await page.keyboard.press('Escape');
  await play(page);
  await page.click('#menuBtn');
  await expect(page.locator('#pBody .opt', { hasText: /Bots: (an|aus)/ })).toHaveCount(1);
  expect(errors).toEqual([]);
});

test('helpers can be switched off: you dig alone, no helper tasks, no hiring', async ({ page }) => {
  const errors = await lobby(page, { helpers: false });
  await play(page);
  await page.evaluate(() => window.__ww.step(40));
  const r = await page.evaluate(() => {
    const w = window.__ww;
    return { crew: w.crew.length, mine: w.crew[0].pid === w.G.myId, off: w.G.noHelpers };
  });
  expect(r).toEqual({ crew: 1, mine: true, off: true });
  await expect(page.locator('#misTxt')).not.toContainText('Helfer');
  await page.evaluate(() => window.__ww.openBase());
  await expect(page.locator('#panel')).not.toContainText('Neues Crewmitglied');
  // switched on again in the game menu: hiring is back
  await page.keyboard.press('Escape');
  await page.click('#menuBtn');
  await page.waitForTimeout(500);
  await page.locator('#pBody .opt', { hasText: 'Helfer: aus' }).click();
  await expect(page.locator('#pBody .opt', { hasText: 'Helfer: an' })).toHaveCount(1);
  expect(await page.evaluate(() => window.__ww.G.noHelpers)).toBe(false);
  expect(errors).toEqual([]);
});

test('an invitation opened in a browser on Android offers to open it in the app', async ({ browser }) => {
  const ctx = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36',
  });
  const page = await ctx.newPage();
  await page.goto('/?friend=ABCD2345&n=Kim');
  const a = page.locator('#appBar a');
  await expect(a).toHaveText(/In der App öffnen|Open in the app/);
  const href = await a.getAttribute('href');
  expect(href).toMatch(/^intent:\/\/friend\/ABCD2345#Intent;scheme=flintworks;package=de\.kiezpower\.flintworks;/);
  expect(decodeURIComponent(href)).toContain('web=1');
  // back from there (no app): no bar again
  await page.goto('/?friend=ABCD2345&web=1');
  await page.waitForTimeout(500);
  await expect(page.locator('#appBar')).toHaveCount(0);
  await ctx.close();
});

test('the tasks stay in view: a tracker under the money, the board in the menu and in the lobby', async ({ page }) => {
  const day = new Date().toISOString().slice(0, 10);
  const errors = await lobby(page, {
    questDay: day,
    quests: [
      { id: 'chop', goal: 6, have: 4, done: false },
      { id: 'gold', goal: 6, have: 6, done: false },
      { id: 'sell', goal: 300, have: 120, done: false },
    ],
  });
  // lobby: one note per quest, the finished one can be claimed
  await page.click('#lbLvlBtn');
  await expect(page.locator('#pBody .qnote')).toHaveCount(3);
  await expect(page.locator('#pBody .qnote.ready button')).toHaveText('Abholen +60 XP');
  await page.waitForTimeout(500);
  await page.click('#pClose');
  await play(page);
  // in the round: at most three rows (the round's task first), icon and bar only, none at the top
  await expect(page.locator('#qTrack .qt-row')).toHaveCount(3);
  await expect(page.locator('#qTrack .qt-row').first()).toHaveAttribute('title', /Gib einem Helfer eine Aufgabe/);
  await expect(page.locator('#qTrack .qt-row[title*="Goldnuggets"]')).toHaveClass(/full/);
  await expect(page.locator('#misTxt')).toBeHidden();
  expect((await page.locator('#qTrack').boundingBox()).width).toBeLessThan(110);
  // a tap opens the menu at the tab "Aufgaben", where the reward is claimed
  await page.waitForTimeout(500);
  await page.click('#qTrack');
  await expect(page.locator('#pTitle')).toHaveText('Menü');
  await expect(page.locator('.pchips button.sel')).toHaveText('Aufgaben');
  await expect(page.locator('#pBody .qnote.qmis')).toContainText('Auftrag der Runde');
  await page.waitForTimeout(500);
  await page.click('#pBody .qnote.ready button');
  await expect(page.locator('#pBody .qnote.done .stamp')).toHaveText('Erledigt');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('flintworks-profile')).quests[1].done)).toBe(true);
  await page.waitForTimeout(500);
  await page.click('#pClose');
  await expect(page.locator('#panel')).toBeHidden();
  // the claimed quest leaves the tracker, the next one moves up
  await expect(page.locator('#qTrack .qt-row[title*="Goldnuggets"]')).toHaveCount(0);
  await expect(page.locator('#qTrack .qt-row').nth(2)).toHaveAttribute('title', /300 Taler/);
  expect(errors).toEqual([]);
});

test('find patterns mark gold, ore, coal and gems apart from their colour', async ({ page }) => {
  const errors = await lobby(page);
  await play(page);
  // all texels of a 2 × 2 block of cells of each find (the patterns repeat every 4 texels)
  const looks = () =>
    page.evaluate(async () => {
      const w = await import('/src/world.js');
      const out = {};
      for (const [name, m] of [
        ['gold', w.GOLD],
        ['ore', w.ORE],
        ['coal', w.COAL],
      ]) {
        let i = 0;
        while (i < w.W * w.H && !(w.mat[i] === m && w.mat[i + 1] === m && w.mat[i + w.W] === m && w.mat[i + w.W + 1] === m)) i++;
        const t = [];
        for (const j of [i, i + 1, i + w.W, i + w.W + 1]) for (const [sx, sy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) t.push(w.texel(j, sx, sy));
        out[name] = t.join();
      }
      return out;
    });
  const plain = await looks();
  await page.click('#menuBtn');
  const tile = page.locator('#pBody .opt', { hasText: 'Fundmuster' });
  await expect(tile).toContainText('Fundmuster: aus');
  await page.waitForTimeout(500);
  await tile.click();
  await expect(page.locator('#pBody .opt', { hasText: 'Fundmuster' })).toContainText('Fundmuster: an');
  const marked = await looks();
  for (const k of ['gold', 'ore', 'coal']) expect(marked[k], k).not.toBe(plain[k]);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('flintworks-profile')).cbpat)).toBe(true);
  expect(errors).toEqual([]);
});
