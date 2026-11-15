import { expect, test } from '@playwright/test';

test('saving a settlement preserves terrain, machinery, research, fire lifetimes and the random sequence', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.setItem('flintworks-profile', JSON.stringify({ tutorialDone: true, installAsked: 'done', gmode: 'settlement', diff: 'relaxed' }));
  });
  await page.reload(); await page.waitForFunction(() => window.__ww);
  await page.click('#lbPlay'); await page.waitForFunction(() => window.__ww.G.state === 'play');
  const result = await page.evaluate(async () => {
    const [{ serialize, deserialize }, world, { mkVehicle }, fire, { MILESTONES }] = await Promise.all([
      import('/src/save.js'), import('/src/world.js'), import('/src/vehicles/core.js'), import('/src/fire.js'), import('/src/settlement.js'),
    ]);
    const w = window.__ww, G = w.G;
    G.tools.r_metal = true; G.tools.dpick = true; G.store.metal = 17; G.sold.gem = 4;
    const drill = mkVehicle('drill', G.base.x + 70, G.base.gy - 20); drill.fuel = 42;
    const index = (world.H - 8) * world.W + 200;
    world.mat[index] = world.OIL; fire.igniteCell(index);
    const flames = fire.saveFire(), seed = world.getSeed(), frame = G.frame;
    const saved = serialize(); const next = world.rnd();
    G.store = {}; G.tools = {}; G.frame += 1000; world.mat[index] = world.AIR; fire.clearFire(); w.vehicles.length = 0;
    const loaded = deserialize(saved);
    return { loaded, terrain: world.mat[index] === world.OIL, metal: G.store.metal, research: G.tools.r_metal,
      machine: w.vehicles.find(v => v.id === drill.id)?.fuel, flames: JSON.stringify(fire.saveFire()) === JSON.stringify(flames),
      frame: G.frame === frame, seed: world.getSeed() === seed, random: world.rnd() === next,
      deep: MILESTONES.find(m => m.id === 'deep').value() };
  });
  expect(result).toEqual({ loaded: true, terrain: true, metal: 17, research: true, machine: 42, flames: true, frame: true, seed: true, random: true, deep: 4 });
});
