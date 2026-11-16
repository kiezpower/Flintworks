// Host-authoritative activations, useful-action rewards and local progress persistence.
import './heroabilities.css';
import { register, send } from './commands.js';
import { sel_ } from './entities.js';
import { G, builds, crew, onNewWorld, parts } from './state.js';
import { ROLES, roleOf, heroId, activeSkill, heroEvent, chapterCount, progressOf } from './heroskills.js';
import { P, addXp, dayNumber, saveProfile } from './profile.js';
import { GOLD, GEM, ORE, COAL, W, H, mat } from './world.js';
import { tr } from './i18n.js';
import { ev } from './analytics.js';
import { hasGear } from './tools.js';
import { toast } from './ui.js';

register('heroAbility', (c, args) => {
  const id = roleOf(c);
  if (!id || G.state !== 'play' || c.dead || c.tumble || c.ride != null || c.heroCooldown > 0) return;
  if (id === 'juna' && !hasGear(c, 'hook')) return;
  const machine = id === 'toni' && builds.find(b => b.done && b.busy > 0 && (b.team || 0) === (c.team || 0) &&
    Math.hypot(b.x + b.w / 2 - c.x, b.gy - c.y) < 50);
  if (id === 'toni' && !machine) return;
  // Variants exchange duration for frequency; no progression-derived stat multiplier.
  const quick = args.variant === 'quick';
  c.heroQuick = quick;
  c.heroActive = quick ? 300 : 480;
  c.heroCooldown = quick ? 1500 : 2400;
  c.heroUseful = false;
  if (machine) { machine.heroBoost = c.heroActive; machine.heroWorker = c.id; }
  if (c.pid === G.myId) ev('hero_ability', { hero: id, variant: quick ? 'quick' : 'steady' });
});
function heroTick(c) {
  if (G.netClient) return;
  if (c.pid === G.myId) collectMastery(c);
  if (c.heroActive > 0) c.heroActive--;
  if (c.heroCooldown > 0) c.heroCooldown--;
  if (!roleOf(c) || c.dead) { c.heroActive = 0; return; }
  if (roleOf(c) === 'mika' && G.frame % 30 === 0) {
    const radius = activeSkill(c) ? 90 : 15;
    c.heroScan = [];
    let shown = 0;
    for (let y = Math.max(0, (c.y - radius) | 0); y < Math.min(H, c.y + radius); y += 3)
      for (let x = Math.max(0, (c.x - radius) | 0); x < Math.min(W, c.x + radius); x += 3) {
        if (shown >= 24) break;
        if (![GOLD, GEM, ORE, COAL].includes(mat[y * W + x])) continue;
        // Scan results are relayed as compact positions, then drawn locally on each device.
        (c.heroScan ||= []).push([x, y]); shown++;
      }
    c.heroScan = (c.heroScan || []).slice(-24);
  }
}
let dirty = false, lastSave = 0;
function persistMastery(force = false) {
  if (dirty && (force || performance.now() - lastSave > 2000)) {
    saveProfile(); dirty = false; lastSave = performance.now();
  }
}
let observed = new WeakMap();
let careers = new WeakMap();
onNewWorld.push(() => { observed = new WeakMap(); careers = new WeakMap(); });
function collectMastery(c) {
  if (!c || c.pid !== G.myId || G.tut || G.replayHook?.playing()) return;
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
    if (!delta.work && !delta.feats) continue;
    P.heroMastery ||= {};
    const p = P.heroMastery[id] ||= { work: 0, feats: 0, rewarded: 0 };
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
        if (!P.owned.includes('o:royal')) P.owned.push('o:royal');
      }
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
  button.hidden = G.state !== 'play' || !id;
  if (!id) return;
  const cooldown = Math.ceil((c.heroCooldown || 0) / 60);
  const needsHook = id === 'juna' && !hasGear(c, 'hook');
  const needsMachine = id === 'toni' && !builds.some(b => b.done && b.busy > 0 && (b.team || 0) === (c.team || 0) &&
    Math.hypot(b.x + b.w / 2 - c.x, b.gy - c.y) < 50);
  button.textContent = tr(ROLES[id].skill) + (cooldown ? ` · ${cooldown}s` : needsHook ? ' · 🔒' : needsMachine ? ' · 🔧' : '');
  button.style.setProperty('--ready', `${100 * (1 - (c.heroCooldown || 0) / (c.heroQuick ? 1500 : 2400))}%`);
  button.setAttribute('aria-label', tr(ROLES[id].skill) + (needsHook ? ': ' + tr('Erst einen Enterhaken kaufen') :
    needsMachine ? ': ' + tr('Keine laufende Produktion in der Nähe') : cooldown ? ` · ${cooldown}s` : ''));
  button.disabled = !!cooldown || c.dead || c.tumble || c.ride != null || needsHook || needsMachine;
  button.title = tr(ROLES[id].active) + ' · ' + tr('Taste R · Linken Stick drücken');
  if (id === 'mika' && G.state === 'play' && scanFrame !== G.frame && G.frame % 10 === 0) {
    scanFrame = G.frame;
    for (const [x, y] of c.heroScan || []) parts.push({ x, y, vx: 0, vy: 0, l: 35, c: '#ffe67c', g: 0 });
  }
}
function useAbility() {
  if (G.state !== 'play') return;
  const id = heroId(sel_());
  const variant = chapterCount(progressOf(P, id), id) >= 2 ? P.heroVariants?.[id] : 'steady';
  send('heroAbility', { variant });
}
G.useHeroAbility = useAbility;
addEventListener('pagehide', () => { collectMastery(sel_()); persistMastery(true); });
export { heroTick, heroHud, collectMastery, useAbility };
