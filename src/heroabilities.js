// Host-authoritative activations, useful-action rewards and local progress persistence.
import './heroabilities.css';
import { VARIANTS } from './herovariants.js';
import { OUTFIT_REWARDS } from './heromissions.js';
import { projectEvent } from './heroprojects.js';
import { register, send } from './commands.js';
import { sel_ } from './entities.js';
import { G, builds, crew, onNewWorld, parts } from './state.js';
import { ROLES, roleOf, heroId, activeSkill, heroEvent, chapterCount, progressOf, competitive, variantUnlocked, unlockMask } from './heroskills.js';
import { P, addXp, dayNumber, saveProfile } from './profile.js';
import { GOLD, GEM, ORE, COAL, W, H, mat, surf } from './world.js';
import { tr } from './i18n.js';
import { ev } from './analytics.js';
import { hasGear } from './tools.js';
import { toast } from './ui.js';

register('heroAbility', (c, args) => {
  const id = roleOf(c);
  if (id && chapterCount(c.heroCounters?.[id] || {}, id) >= 2) c.heroUnlocks = (c.heroUnlocks || 0) | (1 << Object.keys(ROLES).indexOf(id));
  if (!id || G.state !== 'play' || c.dead || c.tumble || c.ride != null || c.heroCooldown > 0) return;
  if (id === 'juna' && !hasGear(c, 'hook')) return;
  const quick = G.daily || G.mode === 'daily' ? !!((G.daily?.n || 0) % 2) : args.variant === 'quick';
  if (quick && !variantUnlocked(c)) return;
  const machine = id === 'toni' && builds.find(b => (quick ? !b.done : b.done && b.busy > 0) && (b.team || 0) === (c.team || 0) &&
    Math.hypot(b.x + b.w / 2 - c.x, b.gy - c.y) < 50);
  if (id === 'toni' && !machine) return;
  // Variants exchange duration for frequency; no progression-derived stat multiplier.
  c.heroQuick = quick;
  c.heroActive = quick ? VARIANTS[id].duration : 480;
  c.heroCooldown = quick ? VARIANTS[id].cooldown : 2400;
  c.heroUseful = false;
  if (id === 'nora' && quick && (c.poison > 0 || c.burn > 0)) {
    c.poison = c.burn = 0; heroEvent(c, 'recover');
  }
  if (machine && !quick) { machine.heroBoost = c.heroActive; machine.heroWorker = c.id; }
  if (!G.replaying) { c.heroCasts ||= {}; c.heroCasts[id] = Math.min(1e6, (c.heroCasts[id] || 0) + 1); }
});
function heroTick(c) {
  if (G.netClient) return;
  if (c.pid === G.myId) collectMastery(c);
  c.heroDepth = Math.max(0, (c.y + 10 - (surf[Math.max(0, Math.min(W - 1, Math.floor(c.x + 3)))] || 0)) / 4);
  if (c.inv?.length >= 16) c.heroTripDepth = Math.max(c.heroTripDepth || 0, c.heroDepth);
  projectEvent('depth', c.heroDepth);
  if (c.heroHadStatus && !(c.poison > 0 || c.burn > 0) && !c.dead) heroEvent(c, 'recover');
  c.heroHadStatus = c.poison > 0 || c.burn > 0;
  if (c.dead) { c.heroTripDepth = 0; c.heroGuardRun = 0; }
  if (c.bot && competitive() && !c.dead && !c.heroCooldown && G.frame % 300 === 0) G.execCmd(c.pid, 'heroAbility', {});
  if (c.heroActive > 0) c.heroActive--;
  if (c.heroCooldown > 0) c.heroCooldown--;
  if (!roleOf(c) || c.dead) { c.heroActive = 0; return; }
  if (roleOf(c) === 'mika' && G.frame % 30 === 0) {
    const radius = activeSkill(c) ? c.heroQuick ? 55 : 90 : 15;
    c.heroScan = [];
    let shown = 0;
    for (let y = Math.max(0, (c.y - radius) | 0); y < Math.min(H, c.y + radius); y += 3)
      for (let x = Math.max(0, (c.x - radius) | 0); x < Math.min(W, c.x + radius); x += 3) {
        if (shown >= 24) break;
        if (!(activeSkill(c) && c.heroQuick ? [GOLD, GEM] : [GOLD, GEM, ORE, COAL]).includes(mat[y * W + x])) continue;
        // Scan results are relayed as compact positions, then drawn locally on each device.
        (c.heroScan ||= []).push([x, y]); shown++;
      }
    c.heroScan = (c.heroScan || []).sort((a, b) => Math.hypot(a[0] - c.x, a[1] - c.y) - Math.hypot(b[0] - c.x, b[1] - c.y)).slice(0, activeSkill(c) && c.heroQuick ? 4 : 24);
  }
}
let dirty = false, lastSave = 0;
function persistMastery(force = false) {
  if (dirty && (force || performance.now() - lastSave > 2000)) {
    saveProfile(); dirty = false; lastSave = performance.now();
  }
}
let activity = new WeakMap();
function observeActivity(c) {
  const now = { casts: c.heroCasts || {}, uses: c.heroUses || {} }, old = activity.get(c);
  if (old) for (const id of Object.keys(ROLES)) {
    const casts = Math.max(0, (now.casts[id] || 0) - (old.casts[id] || 0));
    const uses = Math.max(0, (now.uses[id] || 0) - (old.uses[id] || 0));
    if (casts) ev('hero_ability', { hero: id, variant: c.heroQuick ? 'quick' : 'steady', amount: casts });
    if (uses) ev('hero_useful', { hero: id, amount: uses });
  }
  activity.set(c, structuredClone(now));
}
let observed = new WeakMap();
let careers = new WeakMap();
onNewWorld.push(() => { observed = new WeakMap(); careers = new WeakMap(); activity = new WeakMap(); });
function collectMastery(c) {
  if (!c || c.pid !== G.myId || G.tut || G.replayHook?.playing()) return;
  observeActivity(c);
  if (competitive()) return;
  for (const [id, p] of Object.entries(P.heroMastery || {})) if (OUTFIT_REWARDS[id] && (p.rewarded || 0) >= 3) {
    P.owned ||= []; const reward = 'o:' + OUTFIT_REWARDS[id];
    if (!P.owned.includes(reward)) { P.owned.push(reward); dirty = true; }
  }
  const career = c.heroCareer || {};
  const previous = careers.get(c);
  let careerChanged = false;
  if (previous) for (const key of ['build', 'find']) {
    const delta = Math.max(0, (career[key] || 0) - (previous[key] || 0));
    if (delta) {
      P.heroCareer ||= {};
      P.heroCareer[key] = (P.heroCareer[key] || 0) + delta; careerChanged = true;
    }
  }
  careers.set(c, { ...career });
  if (careerChanged) dirty = true;
  const counters = c.heroCounters || {};
  let last = observed.get(c);
  if (!last) { observed.set(c, structuredClone(counters)); return; }
  let changed = false;
  for (const [id, value] of Object.entries(counters)) {
    if (!ROLES[id]) continue;
    const delta = {};
    for (const key of ['work', 'feats']) delta[key] = Math.max(0, (value[key] || 0) - (last[id]?.[key] || 0));
    last[id] = { ...value };
    const objectiveKeys = ['depth','deepDig','fullLoad','deepDelivery','findTypes','findMask','survey','ledges','ascent','buildTypes','workshops','recover','safeReturn'];
    const objectiveMoved = objectiveKeys.some(key => Number.isFinite(value[key]) && value[key] > (P.heroMastery?.[id]?.[key] || 0));
    if (!delta.work && !delta.feats && !objectiveMoved) continue;
    P.heroMastery ||= {};
    const p = P.heroMastery[id] ||= { work: 0, feats: 0, rewarded: 0 };
    for (const key of objectiveKeys) if (Number.isFinite(value[key])) p[key] = Math.max(p[key] || 0, value[key]);
    p.work = Math.min(1e6, (p.work || 0) + delta.work);
    p.feats = Math.min(1e6, (p.feats || 0) + delta.feats);

    if (delta.feats && P.heroDaily !== dayNumber()) {
      P.heroDaily = dayNumber(); addXp(30);
    }
    const count = chapterCount(p, id);
    while ((p.rewarded || 0) < count) {
      p.rewarded = (p.rewarded || 0) + 1;
      addXp([60, 120, 200][p.rewarded - 1]);
      // The final chapter awards an existing wearable cosmetic; never replaces current outfit.
      if (p.rewarded === 3) {
        P.owned ||= [];
        for (const reward of ['o:royal', 'o:' + OUTFIT_REWARDS[id]]) if (!P.owned.includes(reward)) P.owned.push(reward);
      }
      if (p.rewarded >= 2) { c.heroUnlocks = (c.heroUnlocks || 0) | unlockMask(P); G.shareHeroProgress?.(); }
      dirty = true; persistMastery(true);
      ev('hero_chapter', { hero: id, chapter: p.rewarded });
      toast('Wühler-Meisterschaft: Kapitel {n} geschafft!', { n: p.rewarded });
    }
    changed = true;
  }
  if (changed) dirty = true;
  persistMastery();
}
let button, scanFrame = -1;
function heroHud() {
  const c = sel_();
  collectMastery(c);
  if (!button) {
    button = document.createElement('button'); button.id = 'heroAbility';
    button.addEventListener('click', () => useAbility());
    document.getElementById('hud').appendChild(button);
  }
  const id = roleOf(c);
  button.hidden = G.state !== 'play' || G.replaying || !id;
  if (!id) return;
  const cooldown = Math.ceil((c.heroCooldown || 0) / 60);
  const chosenQuick = G.daily || G.mode === 'daily' ? !!((G.daily?.n || 0) % 2) : competitive() ? P.matchVariant === 'quick' : P.heroVariants?.[id] === 'quick' && variantUnlocked(c);
  const needsHook = id === 'juna' && !hasGear(c, 'hook');
  const needsMachine = id === 'toni' && !builds.some(b => (chosenQuick ? !b.done : b.done && b.busy > 0) && (b.team || 0) === (c.team || 0) &&
    Math.hypot(b.x + b.w / 2 - c.x, b.gy - c.y) < 50);
  button.textContent = tr(chosenQuick ? VARIANTS[id].name : ROLES[id].skill) + (cooldown ? ` · ${cooldown}s` : needsHook ? ' · 🔒' : needsMachine ? ' · 🔧' : '');
  button.style.setProperty('--ready', `${100 * (1 - (c.heroCooldown || 0) / (c.heroQuick ? VARIANTS[id].cooldown : 2400))}%`);
  button.setAttribute('aria-label', tr(ROLES[id].skill) + (needsHook ? ': ' + tr('Erst einen Enterhaken kaufen') :
    needsMachine ? ': ' + tr('Keine laufende Produktion in der Nähe') : cooldown ? ` · ${cooldown}s` : ''));
  button.disabled = !!cooldown || c.dead || c.tumble || c.ride != null || needsHook || needsMachine;
  button.title = tr(chosenQuick ? VARIANTS[id].desc : ROLES[id].active) + ' · ' + tr('Taste R · Linken Stick drücken');
  if (id === 'mika' && G.state === 'play' && scanFrame !== G.frame && G.frame % 10 === 0) {
    scanFrame = G.frame;
    for (const [x, y] of c.heroScan || []) parts.push({ x, y, vx: 0, vy: 0, l: 35, c: '#ffe67c', g: 0 });
  }
}
function useAbility() {
  if (G.state !== 'play') return;
  const id = roleOf(sel_());
  const variant = competitive() ? P.matchVariant || 'steady' : chapterCount(progressOf(P, id), id) >= 2 ? P.heroVariants?.[id] : 'steady';
  send('heroAbility', { variant });
}
G.useHeroAbility = useAbility;
addEventListener('pagehide', () => { collectMastery(sel_()); persistMastery(true); });
export { heroTick, heroHud, collectMastery, useAbility };
