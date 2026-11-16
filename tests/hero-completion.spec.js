import { expect, test } from '@playwright/test';
async function start(page, extra = {}) {
  await page.addInitScript(extra => {
    localStorage.setItem('flintworks-lang','de');
    localStorage.setItem('flintworks-profile',JSON.stringify({tutorialDone:true,installAsked:'done',playKind:'solo',gmode:'gold',games:3,hero:'anna',...extra}));
  },extra);
  await page.goto('/'); await page.waitForFunction(()=>window.__ww); await page.click('#lbPlay');
  await page.waitForFunction(()=>window.__ww.G.state==='play');
}
test('locked variants are rejected by the host command, even with forged command fields',async({page})=>{
  await start(page);
  const r=await page.evaluate(async()=>{
    const {G,crew}=window.__ww,c=crew.find(c=>c.pid===G.myId);
    const {exec}=await import('/src/commands.js');
    exec(G.myId,'heroAbility',{variant:'quick',mastery:63,unlocked:true}); const denied=!c.heroCooldown;
    c.heroUnlocks=1; exec(G.myId,'heroAbility',{variant:'quick'});
    return {denied,accepted:c.heroQuick,cooldown:c.heroCooldown};
  });expect(r).toEqual({denied:true,accepted:true,cooldown:1800});
});
test('a host handover preserves productive-use marker, mission state and running production',async({page})=>{
  await start(page);
  const r=await page.evaluate(async()=>{
    const {G,crew}=window.__ww,c=crew.find(c=>c.pid===G.myId);
    const {KINDS}=await import('/src/net/sync.js');const {heroEvent}=await import('/src/heroskills.js');
    c.heroActive=300;c.heroUseful=true;c.heroCounters={anna:{work:300,feats:1}};c.heroMission={anna:{deepDig:350}};
    const d=KINDS.crew.pack(c),copy=KINDS.crew.create(d);KINDS.crew.apply(copy,d);heroEvent(copy,'dig',1);
    const b={id:999,type:'saw',x:20,gy:70,w:20,h:15,done:true,prog:1,busy:80,n:3,out:'plank',heroBoost:300,heroWorker:c.id};
    const bd=KINDS.builds.pack(b),bc=KINDS.builds.create(bd);KINDS.builds.apply(bc,bd);
    return {feats:copy.heroCounters.anna.feats,mission:copy.heroMission.anna.deepDig,marker:copy.heroUseful,busy:bc.busy,n:bc.n,boost:bc.heroBoost,worker:bc.heroWorker===c.id};
  });expect(r).toEqual({feats:1,mission:350,marker:true,busy:80,n:3,boost:300,worker:true});
});
test('work counters alone cannot finish later chapters; legacy awards keep their access',async({page})=>{
  await start(page);
  const r=await page.evaluate(async()=>{
    const {chapterCount}=await import('/src/heroskills.js');
    const p={work:10000,feats:8};const before=chapterCount(p,'anna');p.depth=20;const middle=chapterCount(p,'anna');p.deepDig=1200;
    return {before,middle,after:chapterCount(p,'anna'),legacy:chapterCount({rewarded:3},'anna')};
  });expect(r).toEqual({before:1,middle:2,after:3,legacy:3});
});
test('role-specific alternative changes digging, transport, scanning, climbing, building and recovery',async({page})=>{
  await start(page);
  const r=await page.evaluate(async()=>{
    const {G,crew,builds}=window.__ww,c=crew.find(c=>c.pid===G.myId);
    const {exec}=await import('/src/commands.js');const {digFactor,hookFactor,buildFactor}=await import('/src/heroskills.js');
    c.heroUnlocks=63;c.heroActive=300;c.heroQuick=true;
    const hard=digFactor(c,false),soft=digFactor(c,true);
    c.skin='blue.wood.4';const hook=hookFactor(c);
    c.skin='blue.wood.5';const building=buildFactor(c);
    c.skin='blue.wood.6';c.heroCooldown=0;c.poison=100;c.burn=100;exec(G.myId,'heroAbility',{variant:'quick'});
    return {hard,soft,hook,building,poison:c.poison,burn:c.burn,quick:c.heroQuick};
  });expect(r).toEqual({hard:1.8,soft:1.1,hook:1,building:1.6,poison:0,burn:0,quick:true});
});
test('all settlement projects require materials, construction, production and exploration; rewards pay once',async({page})=>{
  await start(page);
  const r=await page.evaluate(async()=>{
    const {G}=window.__ww;G.mode='settlement';G.heroProject=null;
    const {projectEvent,projectStatus}=await import('/src/heroprojects.js');const before=G.money;
    projectEvent('deliver',24,{items:[...Array(12).fill('wood'),...Array(12).fill('rock')]});
    const notYet=G.heroProject.done.length;projectEvent('build',1,{type:'saw'});
    projectEvent('build',1,{type:'hut'});projectEvent('build',1,{type:'furnace'});
    projectEvent('made',18,{item:'plank'});projectEvent('made',6,{item:'metal'});
    projectEvent('deliver',28,{items:[...Array(24).fill('nug'),...Array(4).fill('gem')]});projectEvent('depth',25);
    for(let i=0;i<3;i++)projectEvent('hook');const gain=G.money-before;projectEvent('hook');
    return {notYet,done:projectStatus().done,gain,stable:G.money-before===gain,projects:G.heroProject.done};
  });expect(r).toEqual({notYet:0,done:true,gain:380,stable:true,projects:['supply','works','expedition']});
});
test('master outfits are personal, cannot be purchased, and existing masters receive them without changing outfit',async({page})=>{
  await start(page,{heroMastery:{anna:{rewarded:3}}});
  const r=await page.evaluate(async()=>{
    const {P}=await import('/src/profile.js');const {buySkin}=await import('/src/camp.js');
    const {OUTFIT_REWARDS}=await import('/src/heromissions.js');
    return {owned:P.owned.includes('o:amber'),outfit:P.outfit,denied:!buySkin('o:violet'),unique:new Set(Object.values(OUTFIT_REWARDS)).size};
  });expect(r).toEqual({owned:true,outfit:'blue',denied:true,unique:6});
});
test('daily uses the same role and variant for every profile; versus unlocks all roles and excludes persistent gear',async({page})=>{
  await start(page);
  const r=await page.evaluate(async()=>{
    const {G,crew}=window.__ww;const {roleOf,variantUnlocked}=await import('/src/heroskills.js');
    const {hasGear}=await import('/src/tools.js');const {exec}=await import('/src/commands.js');
    const c=crew.find(c=>c.pid===G.myId);G.mode='daily';G.daily={n:7};
    const a=roleOf(c),b=roleOf({pid:99,skin:'blue.wood.6',heroUnlocks:63});
    exec(G.myId,'heroAbility',{variant:'steady'});const fixed=c.heroQuick;
    G.mode='gold';G.daily=null;G.mp={vs:true};c.matchRole='nora';c.skin='blue.wood.h6';
    G.tools.hook=false;return {a,b,fixed,role:roleOf(c),unlocked:variantUnlocked(c),hasHook:hasGear(c,'hook')};
  });expect(r).toEqual({a:'bruno',b:'bruno',fixed:true,role:'nora',unlocked:true,hasHook:false});
});
test('tutorial completion offers a first hero and the chosen role reaches the first real round',async({page})=>{
  await page.goto('/');await page.waitForFunction(()=>window.__ww);await page.click('#veilGo');
  await page.evaluate(async()=> (await import('/src/tutorial.js')).endTutorial('skip'));
  await expect(page.locator('#firstHeroChoice')).toBeVisible();
  await page.locator('#firstHeroChoice [data-hero="mika"]').click();await page.click('#goBtn');
  await expect(page.locator('#heroAbility')).toBeVisible();
  expect(await page.evaluate(async()=> (await import('/src/profile.js')).P.hero)).toBe('mika');
});
test('retention report distinguishes days not yet observed and retains actual D1/D7 return flags',async({page})=>{
  await start(page);
  const r=await page.evaluate(async()=>{
    const {insights,recordVisit}=await import('/src/heroinsights.js');
    const fresh=insights();const d=new Date(),day=Math.floor(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate())/864e5);
    localStorage.setItem('flintworks-hero-visits',JSON.stringify({first:day-7,days:[day-7,day-6],d1:true}));recordVisit();
    const returned=insights();return {fresh1:fresh.d1,fresh7:fresh.d7,day1:returned.d1,day7:returned.d7};
  });expect(r).toEqual({fresh1:null,fresh7:null,day1:true,day7:true});
});
for (const viewport of [{width:320,height:568},{width:844,height:390}]) test(`first hero choice and continue remain reachable at ${viewport.width}x${viewport.height}`,async({page})=>{
  await page.setViewportSize(viewport);await page.goto('/');await page.waitForFunction(()=>window.__ww);await page.click('#veilGo');
  await page.evaluate(async()=> (await import('/src/tutorial.js')).endTutorial('skip'));
  await page.locator('#firstHeroChoice [data-hero="juna"]').click();await page.locator('#goBtn').scrollIntoViewIfNeeded();
  const box=await page.locator('#goBtn').boundingBox();expect(box.x).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(viewport.width);expect(box.y+box.height).toBeLessThanOrEqual(viewport.height);
  await page.screenshot({path:`test-results/hero-intro-${viewport.width}.png`});await page.click('#goBtn');await expect(page.locator('#heroAbility')).toBeVisible();
});
test('completed master title is visible on the podium without browser rendering errors',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{ localStorage.setItem('flintworks-lang','de'); localStorage.setItem('flintworks-profile',JSON.stringify({tutorialDone:true,installAsked:'done',playKind:'solo',gmode:'gold',games:3,hero:'anna',heroMastery:{anna:{rewarded:3}}})); });
  await page.goto('/');await page.waitForFunction(()=>window.__ww);await expect(page.locator('#heroReminder')).toContainText('Stollenmeisterin');
  await page.screenshot({path:'test-results/hero-master-podium.png'});expect(errors).toEqual([]);
});
test('unfinished hero selection survives closing the tutorial card and reloading',async({page})=>{
  await page.goto('/');await page.waitForFunction(()=>window.__ww);await page.click('#veilGo');
  await page.evaluate(async()=> (await import('/src/tutorial.js')).endTutorial('skip'));
  await page.reload();await page.waitForFunction(()=>window.__ww);await page.click('#lbPlay');
  await expect(page.locator('#firstHeroChoice')).toBeVisible();await page.locator('#firstHeroChoice [data-hero="bruno"]').click();await page.click('#confirmHeroChoice');
  await expect(page.locator('#heroAbility')).toBeVisible();expect(await page.evaluate(async()=> (await import('/src/profile.js')).P.hero)).toBe('bruno');
});
test('Mika keeps gold and gem discoveries across worlds and precision picks the actual nearest find',async({page})=>{
  await start(page,{hero:'mika'});
  const r=await page.evaluate(async()=>{
    const {G,crew}=window.__ww,c=crew.find(c=>c.pid===G.myId);
    const {heroEvent}=await import('/src/heroskills.js');const {collectMastery,heroTick}=await import('/src/heroabilities.js');const {P}=await import('/src/profile.js');
    collectMastery(c);heroEvent(c,'find',1,{item:'nug'});collectMastery(c);
    const next={...c,heroCounters:{},heroMission:{}};collectMastery(next);heroEvent(next,'find',1,{item:'gem'});collectMastery(next);
    const found=P.heroMastery.mika.findTypes;
    const {W,mat,AIR,GOLD}=await import('/src/world.js');c.x=200;c.y=100;G.frame=30;c.heroActive=300;c.heroQuick=true;
    for(let y=45;y<155;y++)for(let x=145;x<255;x++)mat[y*W+x]=AIR;
    for(let x=145;x<255;x+=3)mat[45*W+x]=GOLD;mat[99*W+199]=GOLD;heroTick(c);
    return {found,nearest:c.heroScan[0],count:c.heroScan.length};
  });expect(r).toEqual({found:2,nearest:[199,99],count:4});
});
