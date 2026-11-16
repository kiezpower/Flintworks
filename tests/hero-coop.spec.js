import { expect, test } from '@playwright/test';
import { startRelay } from './relayproc.js';

test('guest ability executes on the host and guest receives only its own mastery', async ({ browser }, worker) => {
  const port = 27300 + worker.workerIndex, relay = startRelay(port);
  await relay.ready;
  const host = await browser.newPage(), guest = await browser.newPage();
  const errors = [];
  try {
    for (const [page, name, hero] of [[host, 'Host', 'bruno'], [guest, 'Gast', 'anna']]) {
      page.on('pageerror', e => errors.push(e.message));
      await page.addInitScript(({ name, hero }) => {
        localStorage.setItem('flintworks-lang', 'de');
        localStorage.setItem('flintworks-profile', JSON.stringify({ tutorialDone: true, installAsked: 'done', name,
          playKind: 'coop', gmode: 'gold', games: 3, hero }));
      }, { name, hero });
      await page.goto(`/?mp=ws://localhost:${port}`);
      await page.waitForFunction(() => window.__ww);
      await page.click('#lbTogether');
    }
    await host.click('#lbCreate');
    await expect(host.locator('.lb-codetap b')).toHaveText(/^[A-Z0-9]{6}$/);
    await guest.fill('#lbCodeIn', await host.locator('.lb-codetap b').textContent());
    await guest.click('#lbJoinBtn');
    await expect(host.locator('.lb-players')).toContainText('Gast');
    await host.keyboard.press('Escape'); await host.click('#lbPlay');
    for (const page of [host, guest]) await page.waitForFunction(() => window.__ww.G.state === 'play' && window.__ww.crew.length >= 2);
    await expect(guest.locator('#heroAbility')).toBeVisible();
    await guest.keyboard.press('r');
    await expect.poll(() => host.evaluate(() => window.__ww.crew.find(c => c.name === 'Gast').heroActive || 0)).toBeGreaterThan(0);
    await expect(guest.locator('#heroAbility')).toBeDisabled();
    // Only the host issues productive actions; the network must deliver the reward to its owner.
    await host.evaluate(async () => {
      const { heroEvent } = await import('/src/heroskills.js');
      heroEvent(window.__ww.crew.find(c => c.name === 'Gast'), 'dig', 350);
    });
    await expect.poll(() => guest.evaluate(async () => {
      const { P } = await import('/src/profile.js'); return P.heroMastery?.anna?.rewarded || 0;
    })).toBe(1);
    expect(await host.evaluate(async () => (await import('/src/profile.js')).P.heroMastery?.anna || null)).toBeNull();
    expect(errors).toEqual([]);
  } finally { await host.close(); await guest.close(); relay.relay.kill(); }
});

test('live host migration continues a guest maintenance boost without counting the activation twice', async ({ browser }, worker) => {
  const port = 27500 + worker.workerIndex, relay = startRelay(port); await relay.ready;
  const host = await browser.newPage(), guest = await browser.newPage();
  try {
    for (const [page,name,hero] of [[host,'Host','anna'],[guest,'Gast','toni']]) {
      await page.addInitScript(({name,hero}) => localStorage.setItem('flintworks-profile',JSON.stringify({tutorialDone:true,installAsked:'done',name,hero,level:5,playKind:'coop',gmode:'gold',games:3})),{name,hero});
      await page.goto(`/?mp=ws://localhost:${port}`); await page.waitForFunction(()=>window.__ww);await page.click('#lbTogether');
    }
    await host.click('#lbCreate'); await expect(host.locator('.lb-codetap b')).toHaveText(/^[A-Z0-9]{6}$/);
    await guest.fill('#lbCodeIn',await host.locator('.lb-codetap b').textContent());await guest.click('#lbJoinBtn');
    await expect(host.locator('.lb-players')).toContainText('Gast');await host.keyboard.press('Escape');await host.click('#lbPlay');
    await guest.waitForFunction(()=>window.__ww.G.state==='play');
    await host.evaluate(()=>{
      const {G,crew,builds}=window.__ww,c=crew.find(c=>c.name==='Gast');
      builds.push({id:900001,type:'saw',x:c.x,gy:c.y+10,w:20,h:15,prog:1,done:true,busy:10000,out:'plank',n:3,team:0});G.netKey=true;
    });
    await expect(guest.locator('#heroAbility')).toBeEnabled();await guest.keyboard.press('r');
    await expect.poll(()=>host.evaluate(()=>window.__ww.crew.find(c=>c.name==='Gast').heroCounters?.toni?.feats||0)).toBe(1);
    await guest.waitForFunction(()=>window.__ww.builds.find(b=>b.id===900001)?.heroBoost>0);
    await host.close();
    await guest.waitForFunction(()=>window.__ww.G.netHost,true,{timeout:20000});
    const r=await guest.evaluate(()=>{
      const {G,crew,builds}=window.__ww,c=crew.find(c=>c.pid===G.myId),b=builds.find(b=>b.id===900001);
      return {worker:b.heroWorker===c.id,boost:b.heroBoost>0,busy:b.busy>1000,n:b.n,feats:c.heroCounters.toni.feats};
    });expect(r).toEqual({worker:true,boost:true,busy:true,n:3,feats:1});
  } finally { if(!host.isClosed())await host.close();await guest.close();relay.relay.kill(); }
});
