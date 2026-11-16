import { expect, test } from '@playwright/test';

async function ready(page) {
  await page.goto('/'); await page.waitForFunction(() => window.__ww);
  await page.evaluate(async () => (await import('/src/minerart.js')).minerArtReady);
}

test('all six heroes have distinct throw and grapple frames on a stable foot baseline', async ({ page }) => {
  await ready(page);
  const results = await page.evaluate(async () => {
    const { drawMinerFrame } = await import('/src/minerart.js');
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const g = c.getContext('2d'); g.scale(4, 4);
    const out = [];
    for (const hero of ['anna','bruno','mika','juna','toni','nora']) for (const action of ['throw','hook']) {
      const hashes = [], feet = [];
      for (let n = 0; n < 6; n++) {
        g.clearRect(0, 0, 64, 64);
        if (!drawMinerFrame(g, 32, 50, 1, action, n, '#c8402c', 'blue', 1, '', hero)) throw new Error(hero);
        const d = g.getImageData(0, 0, 256, 256).data; let bottom = -1;
        for (let i = 3; i < d.length; i += 4) if (d[i] > 128) bottom = Math.max(bottom, Math.floor(i / 4 / 256));
        hashes.push(c.toDataURL()); feet.push(bottom);
      }
      out.push({ hero, action, distinct: new Set(hashes).size, feet });
    }
    return out;
  });
  for (const r of results) {
    expect(r.distinct, `${r.hero}/${r.action}`).toBeGreaterThanOrEqual(5);
    for (const foot of r.feet) { expect(foot).toBeGreaterThanOrEqual(195); expect(foot).toBeLessThanOrEqual(203); }
  }
});

test('a throw keeps its immediate projectile and inventory behaviour while follow-through persists', async ({ page }) => {
  await ready(page);
  const r = await page.evaluate(async () => {
    const { doThrow } = await import('/src/digger.js');
    const { minerAction } = await import('/src/mineractions.js');
    const { G, items } = window.__ww; G.netClient = false;
    const c = { x: 100, y: 100, face: 1, vx: 0, inv: ['wood'], isel: 0, ride: null };
    items.length = 0; doThrow(c, { throwP: true, ay: 0 }); const it = items[0];
    const poses = [0, 6, 12, 18, 24].map(n => minerAction(c, G.frame + n));
    const inv = c.inv.length; doThrow(c, { throwP: true, ay: 0 });
    return { inv, count: items.length, velocity: [it.vx, it.vy], origin: [it.x, it.y], poses };
  });
  expect(r.inv).toBe(0); expect(r.count).toBe(1); expect(r.velocity).toEqual([2.5,-2]); expect(r.origin).toEqual([105,101]);
  expect(r.poses.map(p => p?.frame ?? null)).toEqual([2,3,4,5,null]);
});

test('network snapshots preserve animation age, grapple phase and old two-coordinate hooks', async ({ page }) => {
  await ready(page);
  const r = await page.evaluate(async () => {
    const { KINDS } = await import('/src/net/sync.js');
    const { minerAction } = await import('/src/mineractions.js');
    const { G } = window.__ww;
    const c = { id: 999, pid: 1, name: 'Anna', cap: '#c8402c', x: 10, y: 10, face: 1, vx: 0, vy: 0, inv: [], isel: 0, energy: 100, digDir: [1,0], throwF: G.frame - 7, hook: { hx: 20, hy: 3, ph: 'pull', started: G.frame - 12 } };
    const d = KINDS.crew.pack(c), target = KINDS.crew.create(d); KINDS.crew.apply(target, d);
    const pose = minerAction(target, G.frame);
    const age = G.frame - target.throwF;
    KINDS.crew.apply(target, { ...d, ta: undefined, hk: [20,3] });
    return { age, pose, legacy: minerAction(target, G.frame), cleared: target.throwF === undefined };
  });
  expect(r.age).toBe(7); expect(r.pose.action).toBe('hook'); expect([3,4]).toContain(r.pose.frame);
  expect(r.legacy).toEqual({ action: 'hook', frame: 2 }); expect(r.cleared).toBe(true);
});

test('aiming and reduced-motion poses are cosmetic and dead/vehicle states take priority', async ({ page }) => {
  await ready(page);
  const r = await page.evaluate(async () => {
    const { minerAction } = await import('/src/mineractions.js');
    const c = { inv: ['wood'], face: 1 }, before = JSON.stringify(c);
    const aim = minerAction(c, 100, 'toss', { ax: 1, ay: -1 });
    const hookAim = minerAction(c, 100, 'hook', { ax: 1, ay: -1 });
    const reduced = [100,108,116].map(frame => minerAction({ ...c, hook: { ph: 'pull', started: 100 } }, frame, null, null, true));
    return { aim, hookAim, reduced, unchanged: before === JSON.stringify(c), dead: minerAction({ ...c, dead: true, throwF: 100 }, 100), riding: minerAction({ ...c, ride: 0, throwF: 100 }, 100) };
  });
  expect(r.aim).toEqual({ action: 'throw', frame: 1 }); expect(r.hookAim).toEqual({ action: 'hook', frame: 0 });
  expect(r.reduced.every(p => p.frame === 3)).toBe(true); expect(r.unchanged).toBe(true); expect(r.dead).toBeNull(); expect(r.riding).toBeNull();
});

test('missing action art falls back to the existing portrait without losing the hook hand', async ({ page }) => {
  await page.route('**/assets/miners/actions/*.png', route => route.abort());
  await ready(page);
  const r = await page.evaluate(async () => {
    const { drawMinerFrame, minerHand } = await import('/src/minerart.js');
    const g = document.createElement('canvas').getContext('2d');
    return { drawn: drawMinerFrame(g, 20, 30, 1, 'throw', 2, '#c8402c', 'blue', 1, '', 'anna'), hand: minerHand({ pid: 1, face: 1, hook: { ph: 'fly' } }, 100) };
  });
  expect(r).toEqual({ drawn: true, hand: { x: 5, y: 4 } });
});

test('every grapple grip stays on the upper body in both facing directions', async ({ page }) => {
  await ready(page);
  const hands = await page.evaluate(async () => {
    const { minerHand } = await import('/src/minerart.js');
    const out = [];
    for (let id = 1; id <= 6; id++) for (const face of [-1, 1]) for (const [ph, age] of [['fly',0],['fly',10],['pull',0],['pull',8],['back',10]]) {
      out.push({ face, ...minerHand({ pid:id, skin:'blue.wood.'+id, face, hook:{ ph, started:100-age } },100) });
    }
    return out;
  });
  for (const hand of hands) {
    expect(hand.y).toBeGreaterThan(-1); expect(hand.y).toBeLessThan(5.5);
    expect((hand.x - 3) * hand.face).toBeGreaterThan(0);
  }
});
