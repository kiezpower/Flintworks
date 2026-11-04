// Every tool, piece of equipment and vehicle does what its description promises: catapult,
// bow, sword, shield, helmet, steel pick, lamp, drill wagon, raft, riding fluffel, mine train,
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
    // aimed like the bow (what the "Schleudern" button sends when let go): up and to the right
    // at 45°, then back to the left and flat (the angle stops at its lowest)
    w.step(60);
    let n1 = w.items.length;
    w.send('catapult', { dx: Math.SQRT1_2, dy: -Math.SQRT1_2 });
    let it = w.items[n1];
    out.aimed45 = !!it && Math.abs(v.ang - Math.PI / 4) < 0.01 && it.vx > 3 && it.vy < -3;
    w.step(60);
    n1 = w.items.length;
    w.send('catapult', { dx: -1, dy: 0 });
    it = w.items[n1];
    out.aimedLeft = !!it && v.face === -1 && v.ang === 0.25 && it.vx < -4;
    return out;
  });
  expect(r).toEqual({
    built: true,
    riding: true,
    shot: true,
    rockUsed: true,
    reloading: true,
    again: true,
    flint: true,
    aimed45: true,
    aimedLeft: true,
  });
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

test('weapons sit in the hotbar: tap the bow, "Schießen" shoots even with things in the bag, the stick aims', async ({
  page,
}) => {
  const errors = await setup(page);
  const r = await page.evaluate(() => {
    const w = window.__ww,
      c = w.crew[0];
    const btn = () => document.querySelector('.pad.throw span').textContent;
    const slot = id => document.querySelector(`#inv .slot.weapon[data-w="${id}"]`);
    c.inv = ['wood', 'rock'];
    w.send('tool', { id: 'bow' });
    w.hud();
    const out = {
      slot: !!slot('bow'),
      chosen: c.wield === 'bow' && slot('bow').classList.contains('sel'),
      ammo: slot('bow').querySelector('.ammo').textContent,
      label: btn(),
    };
    // shoots although wood is in the bag; the wood stays
    w.edge.throw = true;
    w.step(1);
    out.shotWithBag = w.arrows().length === 1 && c.inv.length === 2;
    // aimed by dragging the button straight up (what the button sends when let go)
    w.step(30);
    w.send('shoot', { dx: 0, dy: -1 });
    let a = w.arrows()[w.arrows().length - 1];
    out.aimedUp = !!a && a.vy < -3 && Math.abs(a.vx) < 1;
    // walking left with the stick held up and to the left, a tap shoots the way you walk:
    // to the left and flat, the stick does not aim
    w.joy.x = -1;
    w.joy.y = -0.6;
    w.step(10);
    w.send('shoot', {});
    w.joy.x = w.joy.y = 0;
    a = w.arrows()[w.arrows().length - 1];
    out.walkDir = !!a && a.vx < -3 && Math.abs(a.vy) < 1;
    // an arrow into a wall stays stuck there for a while (drawn, not in the flying list)
    w.step(200);
    out.flownOut = w.arrows().length === 0;
    // a thing from the bag: the button throws again
    w.send('isel', { i: 0 });
    w.hud();
    out.backToThrow = btn() === 'Wurf' && c.wield === null;
    // the sword: its own slot, "Schlagen" hits a monster in front
    w.send('tool', { id: 'sword' });
    w.hud();
    out.swordSlot = !!slot('sword') && btn() === 'Schlagen';
    c.face = 1; // (looking right again, at the monster)
    const m = w.mkAnimal('monster', c.x + 7, 191);
    m.atk = 999; // (it does not hit back during the test)
    w.animals.push(m);
    const hp0 = m.hp;
    w.edge.throw = true;
    w.step(1);
    out.struck = m.hp < hp0 && c.inv.length === 2;
    // tapping the bow slot chooses it
    slot('bow').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    w.hud();
    out.tapped = c.wield === 'bow' && btn() === 'Schießen';
    return out;
  });
  expect(r).toEqual({
    slot: true,
    chosen: true,
    ammo: '10',
    label: 'Schießen',
    shotWithBag: true,
    aimedUp: true,
    walkDir: true,
    flownOut: true,
    backToThrow: true,
    swordSlot: true,
    struck: true,
    tapped: true,
  });
  expect(errors).toEqual([]);
});

test('arrows stuck in a wall or the ground are picked up again by walking over them', async ({ page }) => {
  const errors = await setup(page);
  const r = await page.evaluate(() => {
    const w = window.__ww,
      c = w.crew[0],
      { mat, W, ROCK, paint } = w.world;
    // rock walls to the right and to the left
    for (const x0 of [440, 340])
      for (let x = x0; x < x0 + 20; x++)
        for (let y = 150; y < 200; y++) {
          mat[y * W + x] = ROCK;
          paint(y * W + x);
        }
    w.send('tool', { id: 'bow' });
    const out = {};
    // a flat shot into each wall
    w.send('shoot', {});
    w.step(1);
    w.send('shoot', { dx: -1, dy: 0 });
    w.step(120);
    const stuck = w.combat.stuckArrows;
    out.afterShots = w.G.tools.q_arrow;
    out.stuck = stuck.filter(s => s.pick).length;
    // walk to the wall and back over the ground
    w.keys.r = 1;
    w.step(60);
    w.keys.r = 0;
    out.oneBack = w.G.tools.q_arrow;
    w.keys.l = 1;
    w.step(200);
    w.keys.l = 0;
    out.allBack = w.G.tools.q_arrow;
    out.left = stuck.filter(s => s.pick).length;
    return out;
  });
  expect(r).toEqual({ afterShots: 8, stuck: 2, oneBack: 9, allBack: 10, left: 0 });
  expect(errors).toEqual([]);
});

test('an arrow startles a fluffel (a reward, no harm) and scores on the archery target', async ({ page }) => {
  const errors = await setup(page);
  const r = await page.evaluate(() => {
    const w = window.__ww,
      c = w.crew[0];
    w.send('tool', { id: 'bow' });
    const out = {};
    // a fluffel standing still in front, aimed at
    const m = w.mkAnimal('fluffel', 440, 196);
    m.t = 9999;
    w.animals.push(m);
    const money0 = w.G.money,
      hp0 = m.hp;
    w.send('shoot', { dx: 35, dy: 3 });
    w.step(25);
    out.scared = m.scared > 0;
    out.unhurt = m.hp === hp0;
    out.paid = w.G.money === money0 + 2;
    out.dropped = w.combat.stuckArrows.some(s => s.pick);
    // a lost fluffel (a rescue level) is never hit: the arrow flies on
    w.animals.length = 0;
    const lost = w.mkAnimal('fluffel', 440, 196);
    Object.assign(lost, { t: 9999, lost: true });
    w.animals.push(lost);
    w.step(30);
    w.send('shoot', { dx: 35, dy: 3 });
    w.step(25);
    out.lostLeftAlone = !(lost.scared > 0);
    w.animals.length = 0;
    // the archery target: built, hit in the middle, points, the arrow stays in it
    w.send('vehicle', { kind: 'target' });
    const v = w.vehicles.find(o => o.kind === 'target');
    out.built = !!v;
    Object.assign(v, { x: 440, y: 186 });
    w.step(5);
    w.combat.stuckArrows.length = 0;
    w.send('shoot', {});
    w.step(20);
    out.score = v.score;
    const inIt = w.combat.stuckArrows.find(s => s.pick && Math.abs(s.x - 445) < 6);
    out.inTarget = !!inIt;
    // walk through the target: the arrow comes back into the quiver
    const q = w.G.tools.q_arrow;
    w.keys.r = 1;
    w.step(60);
    w.keys.r = 0;
    out.pickedUp = w.G.tools.q_arrow === q + 1;
    return out;
  });
  expect(r.score).toBeGreaterThanOrEqual(2);
  delete r.score;
  expect(r).toEqual({
    scared: true,
    unhurt: true,
    paid: true,
    dropped: true,
    lostLeftAlone: true,
    built: true,
    inTarget: true,
    pickedUp: true,
  });
  expect(errors).toEqual([]);
});

test('stronger monsters: each kind hits as hard as it should, the shield halves it', async ({ page }) => {
  const errors = await setup(page);
  const r = await page.evaluate(() => {
    const w = window.__ww,
      c = w.crew[0];
    // one strike of each kind, the monster standing right on the Wühler
    const strike = kind => {
      w.animals.length = 0;
      Object.assign(c, { x: 450, y: 190, vx: 0, vy: 0, energy: 100, poison: 0, burn: 0, tumble: false, dead: false });
      const m = w.mkAnimal(kind, 0, 0);
      Object.assign(m, { x: c.x + 3 - m.w / 2, y: 200 - m.h });
      w.animals.push(m);
      w.step(2);
      const hit = 100 - c.energy;
      // what comes after the hit: poison and fire
      const after = { poison: c.poison > 0, burn: c.burn > 0 };
      w.animals.length = 0;
      w.step(150);
      return { hit: Math.round(hit), later: Math.round(100 - hit - c.energy), ...after };
    };
    const out = {};
    for (const k of ['monster', 'spider', 'slime', 'golem']) out[k] = strike(k);
    w.G.tools = { ...w.G.tools, shield: true };
    out.golemShield = strike('golem').hit;
    return out;
  });
  // the hit itself (plus a little contact damage)
  expect(r.monster.hit).toBeGreaterThanOrEqual(10);
  expect(r.monster.hit).toBeLessThanOrEqual(12);
  expect(r.spider.hit).toBeGreaterThanOrEqual(6);
  expect(r.spider.hit).toBeLessThanOrEqual(8);
  expect(r.slime.hit).toBeGreaterThanOrEqual(12);
  expect(r.slime.hit).toBeLessThanOrEqual(14);
  expect(r.golem.hit).toBeGreaterThanOrEqual(20);
  expect(r.golem.hit).toBeLessThanOrEqual(22);
  expect(r.golemShield).toBeGreaterThanOrEqual(10);
  expect(r.golemShield).toBeLessThanOrEqual(11);
  // the spider poisons (about eight more over the next seconds), the slime sets you alight
  expect(r.spider.poison).toBe(true);
  expect(r.spider.later).toBeGreaterThanOrEqual(6);
  expect(r.slime.burn).toBe(true);
  expect(r.slime.later).toBeGreaterThanOrEqual(6);
  expect(r.monster.poison || r.monster.burn).toBe(false);
  expect(errors).toEqual([]);
});

test('the new monsters: the spider leaps, the slime lives in lava, arrows glance off the golem, all fall to the sword', async ({
  page,
}) => {
  const errors = await setup(page);
  const r = await page.evaluate(() => {
    const w = window.__ww,
      c = w.crew[0],
      { mat, W, LAVA, paint } = w.world;
    const out = {};
    // a spider 40 px off leaps at you
    const sp = w.mkAnimal('spider', c.x + 40, 194);
    w.animals.push(sp);
    let leapt = false;
    for (let k = 0; k < 40; k++) {
      w.step(1);
      if (sp.vy < -1 && Math.abs(sp.vx) > 1.5) leapt = true;
    }
    out.spiderLeaps = leapt;
    // a slime in a lava pool does not burn up
    w.animals.length = 0;
    for (let x = 600; x < 630; x++)
      for (let y = 190; y < 200; y++) {
        mat[y * W + x] = LAVA;
        paint(y * W + x);
      }
    const sl = w.mkAnimal('slime', 610, 191);
    w.animals.push(sl);
    w.step(120);
    out.slimeInLava = w.animals.includes(sl) && sl.hp === sl.maxHp;
    // arrows do half to the golem
    w.animals.length = 0;
    const g = w.mkAnimal('golem', c.x + 60, 186);
    Object.assign(g, { t: 9999 });
    w.animals.push(g);
    w.send('tool', { id: 'bow' });
    w.send('shoot', { dx: 1, dy: -0.05 });
    w.step(20);
    out.golemArrow = g.maxHp - g.hp;
    // each kind falls to the sword and leaves its loot
    w.send('tool', { id: 'sword' });
    out.loot = {};
    for (const k of ['monster', 'spider', 'slime', 'golem']) {
      w.animals.length = 0;
      w.items.length = 0;
      const m = w.mkAnimal(k, 0, 0);
      Object.assign(m, { x: c.x + 8, y: 200 - m.h, atk: 9999, t: 9999 });
      c.face = 1;
      w.animals.push(m);
      for (let n = 0; n < 12 && w.animals.includes(m); n++) {
        c.swingCd = 0;
        Object.assign(m, { x: c.x + 8, y: 200 - m.h, vx: 0, vy: 0 });
        w.send('wield', { id: 'sword' });
        w.edge.throw = true;
        w.step(2);
      }
      const t = {};
      for (const it of w.items) t[it.t] = (t[it.t] || 0) + 1;
      out.loot[k] = { gone: !w.animals.includes(m), nug: t.nug || 0, coal: t.coal || 0, ore: t.ore || 0 };
    }
    // the watchtower aims at the new kinds as well (isFoe)
    out.kills = w.G.kills;
    return out;
  });
  expect(r.spiderLeaps).toBe(true);
  expect(r.slimeInLava).toBe(true);
  expect(r.golemArrow).toBe(14);
  expect(r.loot).toEqual({
    monster: { gone: true, nug: 2, coal: 0, ore: 0 },
    spider: { gone: true, nug: 1, coal: 0, ore: 0 },
    slime: { gone: true, nug: 2, coal: 1, ore: 0 },
    golem: { gone: true, nug: 4, coal: 0, ore: 2 },
  });
  expect(r.kills).toBeGreaterThanOrEqual(4);
  expect(errors).toEqual([]);
});

test('generated worlds get golem, spiders, slimes and cave monsters; relaxed worlds and the campaign do not', async ({
  page,
}) => {
  const errors = await setup(page);
  const r = await page.evaluate(() => {
    const w = window.__ww,
      G = w.G,
      out = {};
    for (const [mode, diff] of [
      ['gold', 'adventure'],
      ['gold', 'relaxed'],
      ['c4', 'adventure'],
    ]) {
      Object.assign(G, { nextSeed: 99, nextBiome: 'desert', nextMode: mode, nextDiff: diff, nextVersus: false });
      w.gen();
      G.nextSeed = null;
      const n = {};
      for (const a of w.animals) if (['monster', 'spider', 'slime', 'golem'].includes(a.kind)) n[a.kind] = (n[a.kind] || 0) + 1;
      out[mode + ' ' + diff] = n;
    }
    return out;
  });
  expect(r['gold adventure']).toEqual({ golem: 1, monster: 2, spider: 2, slime: 2 });
  expect(r['gold relaxed']).toEqual({});
  expect(Object.keys(r['c4 adventure'])).toEqual(['monster']);
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

test('the raft only moves on water: built at the shore, stops at the bank, stuck on land', async ({ page }) => {
  const errors = await setup(page);
  const r = await page.evaluate(() => {
    const w = window.__ww,
      c = w.crew[0],
      { mat, W, WATER, AIR, EARTH, paint } = w.world;
    const set = (x0, x1, y0, y1, m) => {
      for (let x = x0; x < x1; x++)
        for (let y = y0; y < y1; y++) {
          mat[y * W + x] = m;
          paint(y * W + x);
        }
    };
    const out = {};
    // far from water: no raft
    Object.assign(c, { x: 400, y: 190 });
    w.step(3);
    w.send('vehicle', { kind: 'raft' });
    out.refusedOnLand = !w.vehicles.some(v => v.kind === 'raft');
    out.why = document.getElementById('toast').textContent;
    // a pond from 500 to 560 (banks at the same height on both sides)
    set(500, 560, 200, 214, WATER);
    Object.assign(c, { x: 488, y: 190, face: 1 });
    w.step(3);
    w.send('vehicle', { kind: 'raft' });
    const f = w.vehicles.find(v => v.kind === 'raft');
    out.built = !!f;
    out.overWater = !!f && f.x >= 500 && f.x + f.w <= 560;
    w.step(40);
    Object.assign(c, { x: f.x + 6, y: f.y - 10, vx: 0, vy: 0 });
    w.context(c).fn(); // Einsteigen
    w.keys.r = 1;
    w.step(300);
    w.keys.r = 0;
    out.stopsAtRightBank = f.x + f.w <= 561 && c.ride === f.id;
    w.keys.l = 1;
    w.step(300);
    w.keys.l = 0;
    out.stopsAtLeftBank = f.x >= 499;
    // the pond drained: the raft sits on the ground and does not move any more
    set(500, 560, 200, 214, EARTH);
    w.step(40);
    const x0 = f.x;
    w.keys.r = 1;
    w.step(120);
    w.keys.r = 0;
    out.stuckOnLand = Math.abs(f.x - x0) < 0.5;
    return out;
  });
  expect(r.why).toContain('am Wasser');
  delete r.why;
  expect(r).toEqual({
    refusedOnLand: true,
    built: true,
    overWater: true,
    stopsAtRightBank: true,
    stopsAtLeftBank: true,
    stuckOnLand: true,
  });
  expect(errors).toEqual([]);
});

test('digging coal gives a lump every 30 pixels (45 in the campaign)', async ({ page }) => {
  const errors = await setup(page);
  const r = await page.evaluate(async () => {
    const w = window.__ww,
      { digCell, spawnFromDig } = await import('/src/digger.js'),
      { mat, W, COAL, paint } = w.world;
    // dig coal cell by cell (as a Wühler or the drill does) and count the lumps
    const lumps = n => {
      w.items.length = 0;
      w.G.coalDug = 0;
      for (let k = 0; k < n; k++) {
        const x = 420 + (k % 20),
          y = 205 + Math.floor(k / 20);
        mat[y * W + x] = COAL;
        paint(y * W + x);
        digCell(x, y, false, w.G);
        spawnFromDig(x, y, w.G);
      }
      return w.items.filter(i => i.t === 'coal').length;
    };
    w.G.coalStep = 30;
    const free = { in60: lumps(60) };
    w.G.coalStep = 45;
    const campaign = { in60: lumps(60) };
    // what the generator sets: free play 30, a campaign level 45
    const stepOf = mode => {
      Object.assign(w.G, { nextSeed: 5, nextBiome: 'meadow', nextMode: mode, nextDiff: 'adventure', nextVersus: false });
      w.gen();
      w.G.nextSeed = null;
      return w.G.coalStep;
    };
    free.step = stepOf('gold');
    campaign.step = stepOf('c1');
    return { free, campaign };
  });
  expect(r).toEqual({ free: { step: 30, in60: 2 }, campaign: { step: 45, in60: 1 } });
  expect(errors).toEqual([]);
});

test('drill wagon bores through rock, raft floats, riding fluffel runs and jumps', async ({ page }) => {
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
    // riding fluffel on flat ground
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

// On a phone the "Schießen" (bow chosen) and "Haken" buttons are aiming sticks: a tap uses the
// default, dragging aims, letting go shoots or throws; the walking stick stays free
test.describe('aiming buttons on a touch screen', () => {
  test.use({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });

  test('drag "Haken" and "Schießen" to aim, let go to throw and shoot', async ({ page }) => {
    const errors = await setup(page);
    await page.evaluate(() => {
      const w = window.__ww;
      w.G.tools = { ...w.G.tools, hook: true };
      w.send('tool', { id: 'bow' });
      w.hud();
    });
    const drag = async (sel, dx, dy) => {
      const b = await page.locator(sel).boundingBox();
      const x = b.x + b.width / 2,
        y = b.y + b.height / 2;
      await page.mouse.move(x, y);
      await page.mouse.down();
      if (dx || dy) await page.mouse.move(x + dx, y + dy, { steps: 5 });
      const during = await page.evaluate(() => ({ kind: window.__ww.G.aimKind, drag: !!window.__ww.G.aimDrag }));
      await page.waitForTimeout(100); // (a few frames draw the dotted line)
      await page.mouse.up();
      return during;
    };
    // the hook, dragged straight up
    const h = await drag('.pad.hook', 0, -40);
    const hook = await page.evaluate(() => {
      const k = window.__ww.crew[0].hook;
      return k && { dx: k.dx, dy: k.dy };
    });
    // the bow: dragged up and right, then a plain tap the way you walk
    await page.evaluate(() => {
      const c = window.__ww.crew[0];
      c.hook = null;
      c.face = 1;
    });
    const b = await drag('.pad.throw', 30, -30);
    const up = await page.evaluate(() => {
      const l = window.__ww.arrows();
      return l.length && { vx: l[l.length - 1].vx, vy: l[l.length - 1].vy };
    });
    await page.evaluate(() => window.__ww.step(200));
    await drag('.pad.throw', 0, 0);
    const tap = await page.evaluate(() => {
      const l = window.__ww.arrows();
      return l.length && { vx: l[l.length - 1].vx, vy: l[l.length - 1].vy };
    });
    expect(h).toEqual({ kind: 'hook', drag: true });
    expect(hook && Math.abs(hook.dx) < 0.2 && hook.dy < -0.9).toBe(true);
    expect(b).toEqual({ kind: 'bow', drag: true });
    expect(up && up.vx > 2 && up.vy < -2).toBe(true);
    expect(tap && tap.vx > 3 && Math.abs(tap.vy) < 1).toBe(true);
    expect(errors).toEqual([]);
  });

  test('in a catapult the same button aims and hurls: drag, see the path, let go', async ({ page }) => {
    const errors = await setup(page);
    await page.evaluate(() => {
      const w = window.__ww,
        c = w.crew[0];
      w.send('vehicle', { kind: 'catapult' });
      w.step(5);
      w.context(c).fn(); // Einsteigen
      w.step(2);
      w.hud();
    });
    const label = await page.locator('.pad.throw span').textContent();
    const b = await page.locator('.pad.throw').boundingBox();
    const x = b.x + b.width / 2,
      y = b.y + b.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x - 30, y - 30, { steps: 5 });
    const kind = await page.evaluate(() => window.__ww.G.aimKind);
    await page.waitForTimeout(100);
    const n0 = await page.evaluate(() => window.__ww.items.length);
    await page.mouse.up();
    const r = await page.evaluate(n0 => {
      const w = window.__ww,
        v = w.vehicles.find(o => o.kind === 'catapult'),
        it = w.items[n0];
      return { face: v.face, ang: Math.round(v.ang * 100) / 100, flies: !!it && it.vx < -2 && it.vy < -2 };
    }, n0);
    expect(label).toBe('Schleudern');
    expect(kind).toBe('catapult');
    expect(r).toEqual({ face: -1, ang: 0.79, flies: true });
    expect(errors).toEqual([]);
  });
});
