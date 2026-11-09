// Friends without a login: the own code, a request that the other side accepts (mutual), online
// status, joining a friend's room, inviting a friend, adding a player from a room and today's
// Tagesschacht among friends. Runs a relay of its own (server/relay.js): npm test
import { expect, test } from '@playwright/test';
import { startRelay } from './relayproc.js';

const PORT = 8793;
let relay;
test.beforeAll(async () => {
  const r = startRelay(PORT);
  relay = r.relay;
  await r.ready;
});
test.afterAll(() => relay?.kill());

async function player(browser, name, extra = {}) {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(`/?mp=ws://localhost:${PORT}`);
  await page.evaluate(
    ([n, x]) => {
      localStorage.clear();
      localStorage.setItem('flintworks-lang', 'de');
      localStorage.setItem('flintworks-profile', JSON.stringify({ tutorialDone: true, installAsked: 'done', name: n, ...x }));
    },
    [name, extra],
  );
  await page.reload();
  await page.waitForFunction(() => window.__ww);
  await expect(page.locator('#lbFriends')).toBeVisible();
  return { page, errors };
}
// the friends panel; returns the own code
async function friendsPanel(page) {
  if (!(await page.locator('#frCodeIn').isVisible())) await page.locator('#lbFriends').click();
  await expect(page.locator('#frMyCode')).toHaveText(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/, { timeout: 8000 });
  return (await page.locator('#frMyCode').textContent()).trim();
}
async function closePanel(page) {
  await page.locator('#pClose').click();
}
async function befriend(a, b) {
  const code = await friendsPanel(a.page);
  await friendsPanel(b.page);
  await b.page.locator('#frCodeIn').fill(code.toLowerCase());
  await b.page.locator('#frAddBtn').click();
  // one-sided so far: b waits, a sees the request
  await expect(b.page.locator('#frList')).toContainText('wartet');
  await expect(a.page.locator('#frAsks')).toContainText(await b.page.evaluate(() => JSON.parse(localStorage.getItem('flintworks-profile')).name), { timeout: 8000 });
  await a.page.locator('#frAsks .fr-act.yes').first().click();
}

test.describe.configure({ mode: 'serial' });

test('a friend request, accepted, shows each other online and leads into the room', async ({ browser }) => {
  const anna = await player(browser, 'Anna');
  const dayNo = await anna.page.evaluate(async () => (await import('/src/daily.js')).dayNo());
  const bert = await player(browser, 'Bert', { daily: { best: { [dayNo]: 512 }, tries: {}, streak: 1, last: dayNo, top: 1 } });

  await befriend(anna, bert);
  await expect(anna.page.locator('#frList')).toContainText('Bert');
  await expect(anna.page.locator('#frList')).toContainText('online', { timeout: 8000 });
  await expect(bert.page.locator('#frList')).toContainText('Anna');
  await expect(bert.page.locator('#frList')).toContainText('online', { timeout: 8000 });
  // today's Tagesschacht: Bert played, Anna not yet
  await expect(anna.page.locator('#frDaily')).toContainText('512 Taler');
  await expect(anna.page.locator('#frDaily')).toContainText('noch nicht gespielt');
  // Bert's place among everybody who played today, without names (only Bert has a score)
  await expect(bert.page.locator('#frRank')).toContainText('Platz 1 von 1', { timeout: 8000 });
  await expect(anna.page.locator('#frRank')).toHaveCount(0);

  // the lobby chip counts the friend online
  await closePanel(anna.page);
  await expect(anna.page.locator('#lbFriendsN')).toHaveText('1');

  // Anna opens a room for friends: Bert sees it and joins with one tap
  await anna.page.locator('#lbSlot1').click();
  await anna.page.locator('#lbCreate').click();
  await expect(anna.page.locator('.lb-codetap b')).toHaveText(/^[A-Z0-9]{6}$/);
  const room = await anna.page.locator('.lb-codetap b').textContent();
  await expect(bert.page.locator('#frList')).toContainText('im Raum (1/8)', { timeout: 8000 });
  await bert.page.locator('#frList .fr-act.yes').click();
  await expect(bert.page.locator('.lb-codetap b')).toHaveText(room, { timeout: 8000 });
  await expect(anna.page.locator('.lb-players')).toContainText('Bert');

  // Cleo becomes Anna's friend; Anna invites her from the room
  const cleo = await player(browser, 'Cleo');
  await closePanel(anna.page);
  await befriend(cleo, anna);
  await expect(anna.page.locator('#frList [data-fid]').filter({ hasText: 'Cleo' })).toContainText('online', { timeout: 8000 });
  await closePanel(cleo.page);
  await anna.page.locator('#frList [data-fid]').filter({ hasText: 'Cleo' }).locator('.fr-act.yes').click();
  await expect(cleo.page.locator('#frInvite')).toContainText('Anna lädt dich ein', { timeout: 8000 });
  await cleo.page.locator('#frInvJoin').click();
  await expect(cleo.page.locator('.lb-codetap b')).toHaveText(room, { timeout: 8000 });

  // Bert and Cleo met in the room: Cleo adds Bert with the "+", Bert gets a request
  await expect(cleo.page.locator('.lb-players')).toContainText('Tippen: als Freund hinzufügen');
  await cleo.page.locator('.lb-players .opt', { hasText: 'Bert' }).click();
  await bert.page.locator('#lbToFriends').click();
  await expect(bert.page.locator('#frAsks')).toContainText('Cleo', { timeout: 8000 });

  for (const p of [anna, bert, cleo]) expect(p.errors).toEqual([]);
});

test('without friends the game does not connect, and a code alone shows nothing', async ({ browser }) => {
  const dora = await player(browser, 'Dora');
  await dora.page.waitForTimeout(3500);
  // nobody asked for the line: it stays closed
  expect(await dora.page.evaluate(async () => (await import('/src/net/transport.js')).transport.status)).toBe('off');
  // a code that belongs to nobody stays "waiting" (no status without the other side)
  await friendsPanel(dora.page);
  await dora.page.locator('#frCodeIn').fill('ABCD-EFGH');
  await dora.page.locator('#frAddBtn').click();
  await expect(dora.page.locator('#frList')).toContainText('wartet');
  await expect(dora.page.locator('#frList')).not.toContainText('online');
  // a wrong code
  await dora.page.locator('#frCodeIn').fill('XY');
  await dora.page.locator('#frAddBtn').click();
  await expect(dora.page.locator('#toast')).toContainText('8 Zeichen');
  expect(dora.errors).toEqual([]);
});
