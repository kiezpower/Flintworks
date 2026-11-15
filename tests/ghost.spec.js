// Friends in the Tagesschicht (ghost.js): a friend's best run of the day runs along as a ghost,
// passing it is told during the shift and on the end card, and the friend hears "… hat dich
// überholt". Runs a relay of its own (server/relay.js): npm test
import { expect, test } from '@playwright/test';
import { startRelay } from './relayproc.js';

const PORT = 8789;
let relay;
test.beforeAll(async () => {
  const r = startRelay(PORT);
  relay = r.relay;
  await r.ready;
});
test.afterAll(() => relay?.kill());

async function player(browser, name, extra = {}, ghosts = null) {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(`/?mp=ws://localhost:${PORT}`);
  await page.evaluate(
    ([n, x, g]) => {
      localStorage.clear();
      localStorage.setItem('flintworks-lang', 'de');
      localStorage.setItem('flintworks-profile', JSON.stringify({ tutorialDone: true, installAsked: 'done', name: n, ...x }));
      if (g) localStorage.setItem('flintworks-ghosts', JSON.stringify(g));
    },
    [name, extra, ghosts],
  );
  await page.reload();
  await page.waitForFunction(() => window.__ww);
  await expect(page.locator('#lbFriends')).toBeVisible();
  return { page, errors };
}
async function friendsPanel(page) {
  if (!(await page.locator('#frCodeIn').isVisible())) await page.locator('#lbFriends').click();
  await expect(page.locator('#frMyCode')).toHaveText(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/, { timeout: 8000 });
  return (await page.locator('#frMyCode').textContent()).trim();
}
async function befriend(a, b) {
  const code = await friendsPanel(a.page);
  await friendsPanel(b.page);
  await b.page.locator('#frCodeIn').fill(code);
  await b.page.locator('#frAddBtn').click();
  await expect(a.page.locator('#frAsks .fr-act.yes')).toHaveCount(1, { timeout: 8000 });
  await a.page.locator('#frAsks .fr-act.yes').first().click();
}
// a run of a whole shift: walking to the right, earning steadily up to the score
function run(score) {
  const n = 960,
    b = Buffer.alloc(n * 6);
  for (let k = 0; k < n; k++) {
    b.writeUInt16BE(1600 + k * 2, k * 6);
    b.writeUInt16BE(400, k * 6 + 2);
    b.writeUInt16BE(Math.round((score * k) / (n - 1)), k * 6 + 4);
  }
  return b.toString('base64');
}
const ghostsOf = page => page.evaluate(() => JSON.parse(localStorage.getItem('flintworks-ghosts') || '{}'));

test('a friend’s best run is a ghost in my shift, and passing it is told on both sides', async ({ browser }) => {
  const anna = await player(browser, 'Anna');
  const day = await anna.page.evaluate(async () => (await import('/src/daily.js')).dayNo());
  const bert = await player(
    browser,
    'Bert',
    { daily: { best: { [day]: 512 }, tries: { [day]: 1 }, streak: 1, last: day, top: 1 } },
    { mine: { day, score: 512, d: run(512) }, list: [] },
  );
  await befriend(anna, bert);

  // Bert's ghost arrives at Anna's, and the lobby names him as today's leader
  await expect.poll(async () => (await ghostsOf(anna.page)).list?.map(g => `${g.name} ${g.score}`), { timeout: 10000 }).toEqual(['Bert 512']);
  await anna.page.locator('#pClose').click();
  await expect(anna.page.locator('#lbDailyTxt')).toContainText('👑 Bert 512');
  await anna.page.locator('#lbDaily').click();
  await expect(anna.page.locator('#dlLead')).toContainText('Bert hat heute 512 Taler geschafft');
  await expect(anna.page.locator('#dlGhosts')).toContainText('Bert 512');

  // the shift: the ghost runs along and shows in the HUD
  await anna.page.locator('#dlGo').click();
  await anna.page.waitForFunction(() => window.__ww.state === 'play');
  await expect(anna.page.locator('#goalTxt')).toContainText('👻 Bert', { timeout: 10000 });
  const rival = await anna.page.evaluate(async () => (await import('/src/ghost.js')).ghostRival());
  expect(rival.name).toBe('Bert');
  expect(rival.score).toBe(512);

  // Anna earns more than Bert had in the end: told at once, and on the end card
  await anna.page.evaluate(async () => {
    const { G } = await import('/src/state.js');
    // (other hints share the one toast line: write down what was said)
    G.toastHook = (key, params) => void (window.__said ||= []).push(key.replace('{name}', params?.name));
    G.earned = 600;
  });
  await expect.poll(() => anna.page.evaluate(() => window.__said || []), { timeout: 5000 }).toContain('Du hast Bert überholt!');
  await anna.page.evaluate(async () => ((await import('/src/state.js')).G.toastHook = null));
  await anna.page.evaluate(async () => {
    const { G } = await import('/src/state.js');
    G.onLevelEnd(true, 'Die Zeit ist um.');
  });
  await expect(anna.page.locator('#dlGhostEnd')).toContainText('Geschlagen: Bert');

  // Bert hears about it (he played before her), sees the dot on the sign and gets her ghost
  await expect(bert.page.locator('#toast')).toContainText('Anna hat dich in der Tagesschicht überholt: 600 Taler', { timeout: 10000 });
  await bert.page.locator('#pClose').click();
  await expect(bert.page.locator('#lbDaily')).toHaveClass(/alert/);
  await expect(bert.page.locator('#lbDailyTxt')).toContainText('👑 Anna 600');
  await expect.poll(async () => (await ghostsOf(bert.page)).list?.map(g => `${g.name} ${g.score}`), { timeout: 10000 }).toEqual(['Anna 600']);
  // the panel shows it and takes the dot away; it is told only once
  await bert.page.locator('#lbDaily').click();
  await expect(bert.page.locator('#dlLead')).toContainText('Anna liegt vor dir: 600 Taler');
  await bert.page.locator('#pClose').click();
  await expect(bert.page.locator('#lbDaily')).not.toHaveClass(/alert/);

  expect(anna.errors).toEqual([]);
  expect(bert.errors).toEqual([]);
});

test('a friend who was already ahead when I played is no news, and the relay keeps ghosts among mutual friends', async ({ browser }) => {
  const cleo = await player(browser, 'Cleo');
  const day = await cleo.page.evaluate(async () => (await import('/src/daily.js')).dayNo());
  const dora = await player(
    browser,
    'Dora',
    { daily: { best: { [day]: 700 }, tries: { [day]: 1 }, streak: 1, last: day, top: 1 } },
    { mine: { day, score: 700, d: run(700) }, list: [] },
  );
  // a stranger asks for Dora's ghost by her code: nothing comes
  const doraCode = (await friendsPanel(dora.page)).replace('-', '');
  const got = await cleo.page.evaluate(async fid => {
    const { on, send } = await import('/src/net/transport.js');
    let hit = false;
    on('ghost', () => (hit = true));
    send({ t: 'ghostget', fid });
    await new Promise(r => setTimeout(r, 1500));
    return hit;
  }, doraCode);
  expect(got).toBe(false);

  await befriend(cleo, dora);
  await expect.poll(async () => (await ghostsOf(cleo.page)).list?.length, { timeout: 10000 }).toBe(1);
  // Cleo records a result below Dora's: Dora was ahead before, so nothing is told
  await cleo.page.evaluate(async () => (await import('/src/daily.js')).record((await import('/src/daily.js')).dayNo(), 300));
  await cleo.page.waitForTimeout(2500);
  const pass = await cleo.page.evaluate(async () => (await import('/src/profile.js')).P.dailyPass);
  expect(pass.news).toBeUndefined();
  expect(Object.values(pass.told)).toEqual([700]);
  await expect(cleo.page.locator('#toast')).not.toContainText('überholt');
  expect(cleo.errors).toEqual([]);
  expect(dora.errors).toEqual([]);
});
