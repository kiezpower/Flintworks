// Every tool, piece of equipment and vehicle does what its description promises: catapult,
// bow, sword, shield, helmet, steel pick, lamp, drill wagon, raft, riding wipf, mine train,
// cable car and airship. Each test builds a flat field, buys or builds the thing and uses it: npm test
import { expect, test } from '@playwright/test';

// a fresh game in the quiet tutorial world, with a flat test field and only your Wühler
async function setup(page) {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('flintworks-lang', 'de');
  });
  await page.reload();
  await page.waitForFunction(() => window.__ww);
  await page.click('#veilGo');
  await page.evaluate(() => {
    const w = window.__ww,
      { mat, W, AIR, EARTH, paint } = w.world;
    w.endTutorial();
    // flat field x 300..700, ground at y 200
    for (let x = 300; x < 700; x++)
      for (let y = 0; y < 230; y++) {
        mat[y * W + x] = y < 200 ? AIR : EARTH;
        paint(y * W + x);
      }
    w.crew.splice(1);
    w.animals.length = 0;
    w.trees.length = 0; // (falling trees would drop wood into the empty hand)
    w.vehicles.length = 0;
    w.items.length = 0;
    const c = w.crew[0];
    Object.assign(c, { x: 400, y: 190, vx: 0, vy: 0, face: 1, inv: [], isel: 0, energy: 100 });
    w.G.money = 9999;
    w.G.store = { wood: 50, plank: 50, metal: 50, rock: 50, coal: 50 };
    // everything researched
    const t = { ...(w.G.tools || {}) };
    for (const id of ['mech', 'metal', 'archery', 'rails', 'armor', 'flight']) t['r_' + id] = true;
    w.G.tools = t;
    if (w.G.base) w.G.base.lvl = 3;
    w.step(5);
  });
  return errors;
}

test('catapult throws a stone from the store, then reloads', async ({ page }) => {
  const errors = await setup(page);
  const r = await page.evaluate(() => {
    const w = window.__ww,
      c = w.crew[0];
    w.send('vehicle', { kind: 'catapult' });
    const v = w.vehicles.find(o => o.kind === 'catapult');
    if (!v) return { built: false };
    w.step(10);
    w.context(c).fn(); // Einsteigen
    w.step(2);
    const rocks0 = w.G.store.rock,
      n0 = w.items.length;
    w.edge.throw = true;
    w.step(1);
    const shot = w.items.slice(n0)[0];
    const out = {
      built: true,
      riding: c.ride === v.id,
      shot: !!shot && shot.t === 'rock' && Math.abs(shot.vx) > 2,
      rockUsed: w.G.store.rock === rocks0 - 1,
    };
    // right away again: still reloading
    w.edge.throw = true;
    w.step(1);
    out.reloading = w.G.store.rock === rocks0 - 1;
    w.step(60);
    w.edge.throw = true;
    w.step(1);
    out.again = w.G.store.rock === rocks0 - 2;
    // something in the hand goes first
    c.inv = ['flint'];
    w.step(60);
    w.edge.throw = true;
    w.step(1);
    out.flint = w.items.some(i => i.t === 'flint' && i.armed) && c.inv.length === 0;
    return out;
  });
  expect(r).toEqual({ built: true, riding: true, shot: true, rockUsed: true, reloading: true, again: true, flint: true });
  expect(errors).toEqual([]);
});

test('bow comes with arrows, shoots them at a monster, and says when the quiver is empty', async ({ page }) => {
  const errors = await setup(page);
  const r = await page.evaluate(() => {
    const w = window.__ww,
      c = w.crew[0];
    w.send('tool', { id: 'bow' });
    const out = { bought: !!w.G.tools.bow, quiver: w.G.tools.q_arrow };
    w.hud();
    out.throwBtn = !document.getElementById('btns').classList.contains('noitem');
    const m = w.mkAnimal('monster', c.x + 50, 191);
    w.animals.push(m);
    const hp0 = m.hp;
    w.edge.throw = true;
    w.step(1);
    out.flying = w.arrows().length > 0;
    out.used = w.G.tools.q_arrow === 9;
    w.step(40);
    out.hit = m.hp < hp0;
    // empty quiver: a hint instead of nothing
    w.animals.length = 0;
    w.G.tools = { ...w.G.tools, q_arrow: 0, q_farrow: 0 };
    w.step(70);
    w.edge.throw = true;
    w.step(1);
    out.hint = document.getElementById('toast').textContent.includes('Köcher leer');
    // more arrows from the castle
    w.send('arrows', { id: 'arrow' });
    out.made = w.G.tools.q_arrow === 5;
    return out;
  });
  expect(r).toEqual({ bought: true, quiver: 10, throwBtn: true, flying: true, used: true, hit: true, hint: true, made: true });
  expect(errors).toEqual([]);
});

test('sword strikes a monster; shield and helmet halve damage', async ({ page }) => {
  const errors = await setup(page);
  const r = await page.evaluate(() => {
    const w = window.__ww,
      c = w.crew[0];
    const out = { shield0: w.combat.guard(c, 'monster'), helm0: w.combat.guard(c, 'hit') };
    w.send('tool', { id: 'sword' });
    w.send('tool', { id: 'shield' });
    w.send('tool', { id: 'helm' });
    out.shield = w.combat.guard(c, 'monster');
    out.helm = w.combat.guard(c, 'hit');
    const m = w.mkAnimal('monster', c.x + 7, 191);
    w.animals.push(m);
    const cx = w.context(c);
    out.label = cx.label;
    const hp0 = m.hp;
    cx.fn();
    out.dmg = hp0 - m.hp;
    return out;
  });
  expect(r).toEqual({ shield0: 1, helm0: 1, shield: 0.5, helm: 0.5, label: 'Zuschlagen', dmg: 30 });
  expect(errors).toEqual([]);
});

test('steel pick digs through rock; the lamp is bought', async ({ page }) => {
  const errors = await setup(page);
  const r = await page.evaluate(() => {
    const w = window.__ww,
      c = w.crew[0],
      { mat, W, ROCK, paint } = w.world;
    // a rock wall right in front
    for (let x = 410; x < 420; x++)
      for (let y = 170; y < 200; y++) {
        mat[y * W + x] = ROCK;
        paint(y * W + x);
      }
    const rockCount = () => {
      let n = 0;
      for (let x = 410; x < 420; x++) for (let y = 170; y < 200; y++) n += mat[y * W + x] === ROCK;
      return n;
    };
    c.x = 403;
    c.face = 1;
    const dig = () => {
      w.keys.dig = 1;
      w.keys.r = 1;
      w.step(200);
      w.keys.dig = 0;
      w.keys.r = 0;
    };
    const n0 = rockCount();
    dig();
    const without = n0 - rockCount();
    w.send('tool', { id: 'pick' });
    const n1 = rockCount();
    dig();
    w.send('tool', { id: 'lamp' });
    return { without, withPick: n1 - rockCount(), lamp: !!w.G.tools.lamp };
  });
  expect(r.without).toBe(0);
  expect(r.withPick).toBeGreaterThan(20);
  expect(r.lamp).toBe(true);
  expect(errors).toEqual([]);
});

test('drill wagon bores through rock, raft floats, riding wipf runs and jumps', async ({ page }) => {
  const errors = await setup(page);
  const r = await page.evaluate(() => {
    const w = window.__ww,
      c = w.crew[0],
      { mat, W, ROCK, WATER, AIR, EARTH, paint } = w.world;
    const set = (x0, x1, y0, y1, m) => {
      for (let x = x0; x < x1; x++)
        for (let y = y0; y < y1; y++) {
          mat[y * W + x] = m;
          paint(y * W + x);
        }
    };
    const ride = kind => {
      w.send('vehicle', { kind });
      const v = w.vehicles.find(o => o.kind === kind);
      w.step(5);
      w.context(c).fn();
      w.step(2);
      return v;
    };
    const out = {};
    // drill: a rock wall to the right
    set(430, 460, 160, 200, ROCK);
    c.x = 405;
    const d = ride('drill');
    const x0 = d.x;
    w.keys.r = 1;
    w.step(200);
    w.keys.r = 0;
    out.drill = d.x - x0 > 25;
    w.context(c).fn(); // Aussteigen
    w.vehicles.length = 0;
    w.step(5);
    // raft: a pond
    set(300, 700, 160, 200, AIR);
    set(300, 700, 200, 230, EARTH);
    set(500, 640, 200, 215, WATER);
    Object.assign(c, { x: 500, y: 185, vx: 0, vy: 0 });
    w.step(10);
    const f = ride('raft');
    w.step(60);
    const fx = f.x;
    w.keys.r = 1;
    w.step(80);
    w.keys.r = 0;
    out.raft = f.x - fx > 20 && f.y < 202 && c.ride === f.id;
    w.context(c).fn();
    w.vehicles.length = 0;
    // riding wipf on flat ground
    set(300, 700, 160, 230, AIR);
    set(300, 700, 200, 230, EARTH);
    Object.assign(c, { x: 350, y: 185, vx: 0, vy: 0 });
    w.step(20);
    const m = ride('mount');
    const mx = m.x;
    w.keys.r = 1;
    w.step(40);
    w.keys.r = 0;
    out.mountRuns = m.x - mx > 40;
    w.step(30);
    const my = m.y;
    w.edge.jump = true;
    w.step(8);
    out.mountJumps = my - m.y > 6;
    return out;
  });
  expect(r).toEqual({ drill: true, raft: true, mountRuns: true, mountJumps: true });
  expect(errors).toEqual([]);
});

test('mine train runs on its rails; cable car shuttles; airship flies and drops', async ({ page }) => {
  const errors = await setup(page);
  const r = await page.evaluate(() => {
    const w = window.__ww,
      c = w.crew[0];
    const out = {};
    // a too short track that is thrown away, then a real one: the train keeps the right one
    w.send('rails');
    w.send('rails');
    out.shortGone = w.G.rails.length === 0;
    Object.assign(c, { x: 350, y: 190 });
    w.step(3);
    w.send('rails');
    w.keys.r = 1;
    w.step(150);
    w.keys.r = 0;
    w.send('rails');
    const track = w.G.rails[w.G.rails.length - 1];
    out.laid = track.p.length > 30;
    w.send('vehicle', { kind: 'train' });
    const t = w.vehicles.find(v => v.kind === 'train');
    out.onTrack = !!t && w.G.rails[t.track] === track;
    const tx = t.x;
    w.step(200);
    out.trainMoves = Math.abs(t.x - tx) > 20 && w.G.rails[t.track] === track;
    // a train that lost its track falls and gets onto the track below it again
    t.track = -1;
    t.y -= 20;
    w.step(60);
    out.backOnTrack = w.G.rails[t.track] === track;
    w.vehicles.length = 0;
    // cable car: two masts
    Object.assign(c, { x: 340, y: 190 });
    w.step(3);
    w.send('vehicle', { kind: 'mast' });
    Object.assign(c, { x: 560, y: 190 });
    w.step(3);
    w.send('vehicle', { kind: 'mast' });
    const g = w.vehicles.find(v => v.kind === 'gondola');
    out.gondola = !!g;
    if (g) {
      const gx = g.x;
      w.step(400);
      out.shuttles = Math.abs(g.x - gx) > 40;
    }
    w.vehicles.length = 0;
    // airship: up with the stick, Wurf drops what you hold
    Object.assign(c, { x: 450, y: 190 });
    w.step(3);
    w.send('vehicle', { kind: 'airship' });
    const a = w.vehicles.find(v => v.kind === 'airship');
    out.airship = !!a;
    if (a) {
      w.step(5);
      w.context(c).fn();
      const ay = a.y;
      w.keys.u = 1;
      w.step(120);
      w.keys.u = 0;
      out.rises = ay - a.y > 20;
      c.inv = ['rock'];
      const n0 = w.items.length;
      w.edge.throw = true;
      w.step(1);
      out.drops = w.items.length === n0 + 1 && c.inv.length === 0;
    }
    return out;
  });
  expect(r).toEqual({
    shortGone: true,
    laid: true,
    onTrack: true,
    trainMoves: true,
    backOnTrack: true,
    gondola: true,
    shuttles: true,
    airship: true,
    rises: true,
    drops: true,
  });
  expect(errors).toEqual([]);
});
