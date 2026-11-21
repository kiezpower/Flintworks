import { test, expect } from '@playwright/test';

async function ready(page) {
  await page.goto('/'); await page.waitForFunction(() => window.__ww);
}

test('six heroes have six readable mobility actions with four distinct phases', async ({ page }) => {
  await ready(page);
  const frames = await page.evaluate(async () => {
    const { minerArtReady, drawMinerFrame } = await import('/src/minerart.js'); await minerArtReady;
    const out = [];
    for (const hero of ['anna','bruno','mika','juna','toni','nora']) for (const action of ['jump','fall','climb','hang','hammer','chop']) {
      const images = [], counts = [];
      for (let f = 0; f < 4; f++) {
        const c = document.createElement('canvas'); c.width = c.height = 256;
        const g = c.getContext('2d'); g.scale(4,4);
        const drawn = drawMinerFrame(g,32,50,1,action,f,'#c8402c','blue',1,'',hero);
        const d = g.getImageData(0,0,256,256).data;
        counts.push(drawn && d.filter((v,i)=> i % 4 === 3 && v > 128).length);
        images.push(c.toDataURL());
      }
      out.push({hero,action,distinct:new Set(images).size,counts});
    }
    return out;
  });
  for (const r of frames) {
    expect(r.distinct, `${r.hero}/${r.action}`).toBe(4);
    for (const n of r.counts) expect(n).toBeGreaterThan(150);
  }
});

test('mobility priority and reduced motion preserve tool and vehicle states', async ({page}) => {
  await ready(page);
  const r = await page.evaluate(async()=>{
    const {mobilityAction:a} = await import('/src/mineractions.js');
    return {actions:[{airT:5,vy:-2},{airT:5,vy:2},{climb:true},{hangle:true},{hammer:true},{chop:true}].map(c=>a(c,19)?.action),
      blocked:[{dead:true},{tumble:true},{ride:0},{digging:true},{picking:2}].map(c=>a({...c,climb:true},19)), reduced:a({chop:true},19,true)};
  });
  expect(r.actions).toEqual(['jump','fall','climb','hang','hammer','chop']);
  expect(r.blocked).toEqual([null,null,null,null,null]); expect(r.reduced).toEqual({action:'chop',frame:0});
});

test('storage feedback coalesces while damage and item rewards remain separate', async({page})=>{
  await ready(page);
  const r = await page.evaluate(async()=>{
    const {addFloat,drawFloats,clearFloats,updFloats}=await import('/src/floats.js');
    const {G}=window.__ww; G.netHost=false; G.reduceMotion=true; clearFloats();
    addFloat(50,50,'+1 ▣');addFloat(51,50,'+2 ▣');addFloat(50,50,'-3');addFloat(50,50,'+1','#fff','wood');
    const c=document.createElement('canvas'),g=c.getContext('2d'),texts=[];
    g.fillText=(text,x,y)=>texts.push([text,y]);drawFloats(g,0,0);const first=texts.slice();texts.length=0;
    updFloats();drawFloats(g,0,0);const still=texts.slice();texts.length=0;
    for(let i=0;i<75;i++)updFloats();drawFloats(g,0,0);clearFloats();
    return {first,still,expired:texts};
  });
  expect(r.first.map(x=>x[0])).toEqual(['+3','-3','+1']); expect(r.still).toEqual(r.first); expect(r.expired).toEqual([]);
});

test('icons already displayed upgrade after artwork arrives beyond startup timeout', async({page})=>{
  let release; const gate=new Promise(r=>release=r);
  await page.route('**/assets/items/*.png',async route=>{await gate;await route.continue();});
  await page.goto('/',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__ww);
  const before=await page.evaluate(async()=>{
    const {bindPaintedIcon}=await import('/src/itemart.js');
    const c=document.createElement('canvas');c.id='late-art-test';c.width=24;c.height=24;document.body.append(c);bindPaintedIcon(c,'ui:dig');return c.width;
  });
  expect(before).toBe(24);release();
  await expect.poll(()=>page.locator('#late-art-test').evaluate(c=>c.width)).toBe(48);
  await expect(page.locator('#late-art-test')).toHaveClass(/painted/);
});

test('remote work and airborne state select the same cosmetic poses', async({page})=>{
  await ready(page);
  const r=await page.evaluate(async()=>{
    const {KINDS}=await import('/src/net/sync.js');const {mobilityAction}=await import('/src/mineractions.js');
    return [{airT:12,vy:-1},{chop:true},{bridge:{}}].map(extra=>{
      const c={id:999,pid:1,name:'Anna',cap:'#c8402c',x:10,y:10,face:1,vx:0,vy:0,inv:[],isel:0,energy:100,digDir:[1,0],...extra};
      const d=KINDS.crew.pack(c),target=KINDS.crew.create(d);KINDS.crew.apply(target,d);return mobilityAction(target,20)?.action;
    });
  });expect(r).toEqual(['jump','chop','hammer']);
});

test('unavailable mobility and unique creature sheets preserve painted fallbacks',async({page})=>{
  await page.route('**/assets/miners/mobility/*.png',r=>r.abort());
  await page.route('**/assets/creatures/unique.png',r=>r.abort());
  await ready(page);
  const r=await page.evaluate(async()=>{
    const m=await import('/src/minerart.js'),c=await import('/src/creatureart.js');await Promise.all([m.minerArtReady,c.creatureArtReady]);
    const cv=document.createElement('canvas');cv.width=cv.height=160;const g=cv.getContext('2d');
    return {hero:m.drawMinerFrame(g,60,80,1,'climb',2,'#c8402c','blue',1,'','anna'),creatures:['crawler','spore','guardian'].map(k=>c.drawCreature(g,k,'idle',60,60,16,14))};
  });expect(r.hero).toBe(true);expect(r.creatures).toEqual([true,true,true]);
});

test('castle shop shows painted helper and cart icons at native resolution',async({page})=>{
  await ready(page);
  await page.evaluate(async()=>{await (await import('/src/minerart.js')).minerArtReady;window.__ww.openBase();});
  for(const label of ['Wühler','Lore']) {
    const row=page.locator('.opt').filter({has:page.locator('b',{hasText:label})}).first();
    await expect(row).toBeVisible();await expect(row.locator('canvas')).toHaveClass(/painted/);
    expect(await row.locator('canvas').evaluate(c=>c.width)).toBeGreaterThanOrEqual(48);
  }
});
