import { GAME_MODES, mode } from './modes.js';
import { ALL_IDS, totalStars, unlocked } from './scenarios.js';
import { openSelect, selectOpen } from './levelselect.js';
import { previewOf } from './levels/preview.js';
import { lessonsPanel } from './lessons.js';
import { canInstall, offerInstall, openInstall } from './install.js';
import { LIVE, isNative, ownWeb } from './platform.js';
// Lobby between games: the player's Wühler on a stage, resources on top, menus left, play button right.
import { BIOMES } from './biomes.js';
import './lobby.css';
import { getLang, setLang, tr } from './i18n.js';
import { camp as campState, pending, vaultFull } from './camp.js';
import { openCamp } from './lobbycamp.js';
import { CAPS, HATS, P, QUESTS, claimQuest, saveProfile, unlockText, xpNeed } from './profile.js';
import { openInvite, refreshSlots } from './lobbyinvite.js';
import { badge, dailyFromLink, dayNo, openDaily } from './daily.js';
import { openName } from './lobbyname.js';
import { NET, inRoom, others, setGMode } from './net/room.js';
import { drawPortrait } from './portrait.js';
import { drawScene, friendDx, heroOrigin, heroScreen, sizeScene } from './lobbyscene.js';
import { audioInit, sfx } from './sound.js';
import { padIcon } from './sprites.js';
import { G } from './state.js';
import { $, closePanel, opt, openPanel, panelEl, sec, toast } from './ui.js';
import { settingsSections } from './settings.js';

const el = $('lobby');
$('lbVersion').textContent = 'v' + __APP_VERSION__;
// ask the live web version which version is current; offer the update if this copy is older
// (not on itch.io and other sites: they bring the new version themselves)
let updateChecked = false;
function checkUpdate() {
  if (updateChecked || import.meta.env.DEV || (!isNative() && !ownWeb())) return;
  updateChecked = true;
  fetch(LIVE + 'version.json?t=' + Date.now(), { cache: 'no-store' })
    .then(r => r.json())
    .then(({ version }) => {
      if (!version || version === __APP_VERSION__) return;
      const a = $('updateLink');
      a.textContent = tr('Neue Version v{v} verfügbar – tippen', { v: version });
      // the Android app gets a new APK, the web version simply reloads
      a.href = isNative()
        ? 'https://github.com/kiezpower/Flintworks/releases/latest'
        : location.pathname + '?v=' + version;
      a.hidden = false;
      // web: drop the offline copy completely so the new version really loads
      if (!isNative())
        a.onclick = async e => {
          e.preventDefault();
          try {
            for (const r of (await navigator.serviceWorker?.getRegistrations()) || []) await r.unregister();
            for (const k of await caches.keys()) await caches.delete(k);
          } catch {}
          location.replace(location.pathname + '?v=' + version);
        };
    })
    .catch(() => {});
}
const cv = $('lbCv'),
  g = cv.getContext('2d');
const MODES = ['random', 'meadow', 'desert', 'winter'];
const MODE_NAME = { random: 'Zufall', meadow: 'Wiese', desert: 'Wüste', winter: 'Winter' };
let hooks = {};
let t = 0,
  jumpV = 0,
  jumpY = 0,
  spin = 0;
const sparks = [];
// Lobby sky follows the chosen world type; random cycles through all three
function stageBiome() {
  if (hooks.hasRun?.()) return G.biome || 'meadow';
  return P.mode && P.mode !== 'random' ? P.mode : MODES[1 + (Math.floor(t / 600) % 3)];
}
// keep the invite slots and the name tag next to the hero in the painted scene
function placeOverlay() {
  const h = heroScreen(cv);
  const r = cv.getBoundingClientRect();
  const put = (id, dx, dy) => {
    const e = $(id);
    e.style.left = r.left - el.getBoundingClientRect().left + h.x + dx * h.k + 'px';
    e.style.top = h.y + dy * h.k + 'px';
  };
  const [d1, d2] = friendDx();
  put('lbSlot1', d1, 0);
  put('lbSlot2', d2, 0);
  el.style.setProperty('--k', h.k);
  put('lbHat', 0, 0);
  $('lbHat').parentElement.style.left = $('lbHat').style.left;
  $('lbHat').parentElement.style.top = $('lbHat').style.top;
}
function drawStage() {
  if (sizeScene(cv)) placeOverlay();
  drawScene(g, { t, biome: stageBiome(), cap: P.cap, hat: P.hat, outfit: P.outfit, jumpY, spin, sparks, friends: others() });
}
function burst(n, cols) {
  const o = heroOrigin();
  for (let k = 0; k < n; k++)
    sparks.push({
      x: o.x,
      y: o.y,
      vx: (Math.random() - 0.5) * 1.4,
      vy: -Math.random() * 1.4,
      l: 30 + Math.random() * 20,
      c: cols[k % cols.length],
    });
}

// ---- Top bar, side buttons, trophy road ----
const setTxt = (id, v) => {
  const e = $(id);
  if (e.textContent !== String(v)) e.textContent = v;
};
function refresh() {
  setTxt('lbLvl', P.level);
  $('lbXp').style.width = Math.round((P.xp / xpNeed()) * 100) + '%';
  setTxt('lbXpTxt', `${P.xp}/${xpNeed()}`);
  setTxt('lbTro', P.trophies);
  // Heimatbergwerk: crystals, and a dot while the home crew has something to collect
  setTxt('lbKri', campState().k);
  $('lbCamp').classList.toggle('alert', pending() > 0);
  // the Tagesschacht glows until today's shaft is played
  setTxt('lbDailyTxt', badge());
  $('lbDaily').classList.toggle('fresh', P.daily?.best?.[dayNo()] == null);
  const nm = P.name;
  setTxt('lbHat', P.hat === 'none' ? `${nm} · ${tr('Level')} ${P.level}` : `${nm} · ${tr(HATS[P.hat].name)}`);
  $('lbQuest').classList.toggle(
    'alert',
    P.quests.some(q => !q.done && q.have >= q.goal),
  );
  const road = Object.keys(HATS)
    .filter(id => HATS[id].t)
    .sort((a, b) => HATS[a].t - HATS[b].t);
  const next = road.find(id => P.trophies < HATS[id].t);
  const prev =
    road
      .filter(id => P.trophies >= HATS[id].t)
      .map(id => HATS[id].t)
      .pop() || 0;
  const r = next && HATS[next];
  $('lbRoadBar').style.width = r ? Math.min(100, ((P.trophies - prev) / (r.t - prev)) * 100) + '%' : '100%';
  setTxt('lbRoadTxt', r ? `${P.trophies}/${r.t} · ${tr(r.name)}` : tr('Alles freigeschaltet'));
  refreshSlots();
  const run = hooks.hasRun();
  // in a room only the host starts; the others wait
  const wait = inRoom() && !NET.host && !run;
  setTxt(
    'lbPlayTxt',
    tr(run ? 'Weiterspielen' : wait ? (NET.auto ? 'Startet gleich' : 'Warte auf Host') : inRoom() ? 'Spielen ({n})' : 'Spielen', {
      n: NET.players.length,
    }),
  );
  $('lbPlay').classList.toggle('wait', wait);
  $('lbNew').hidden = !run;
  $('lbMode').disabled = run;
  const gid = chosen();
  const camp = !run && gid === 'campaign';
  const GM = GAME_MODES[gid] || GAME_MODES.gold;
  // a guest in a room sees the host's choice and cannot change it
  $('lbGMode').disabled = run || (inRoom() && (!NET.host || !!NET.auto));
  const gm = run ? mode() : GM;
  const gmName = gm.map
    ? `${tr('Karte')} · ${tr(gm.name)}`
    : gm.campaign
      ? `${tr('Kampagne')} ${gm.chapter === 2 ? 2 : 1} · ${gm.n} · ${tr(gm.name)}`
      : tr(gm.name);
  setTxt('lbGModeTxt', camp ? tr('Kampagne') : gmName);
  // a small picture of the chosen level or map
  const pvId = run ? G.mode : gid,
    pvEl = $('lbGModePv');
  if (pvEl.dataset.id !== pvId) {
    pvEl.dataset.id = pvId;
    pvEl.innerHTML = '';
    const pm = GAME_MODES[pvId],
      pic = pm && (pm.pkg || pm.campaign) && previewOf(pvId, pm.pkg);
    if (pic) pvEl.appendChild(pic);
    pvEl.hidden = !pic;
  }
  setTxt(
    'lbGModeDesc',
    camp
      ? tr('{n} Level · Sterne {s}/{m}', { n: ALL_IDS.length, s: totalStars(), m: ALL_IDS.length * 3 })
      : tr(gm.desc, { goal: gm.goal }),
  );
  $('lbDiff').disabled = run;
  setTxt('lbDiffTxt', tr((run ? G.relaxed : P.diff === 'relaxed') ? 'Entspannt' : 'Abenteuer'));
  setTxt('lbModeTxt', tr(run ? BIOMES[G.biome].name : MODE_NAME[P.mode || 'random']));
}

function frame() {
  if (el.hidden) return;
  t++;
  if (jumpY < 0 || jumpV) {
    jumpY += jumpV;
    jumpV += 0.18;
    if (jumpY >= 0) {
      jumpY = 0;
      jumpV = 0;
    }
  }
  if (spin > 0) spin--;
  if (t % 420 === 0 && !jumpV) spin = 36;
  drawStage();
  if (t % 10 === 0) refresh();
}

// ---- Panels ----
function hatIcon(hat, cap = P.cap, outfit = P.outfit) {
  const c = document.createElement('canvas');
  c.width = 40;
  c.height = 56;
  const x = c.getContext('2d');
  x.scale(2, 2);
  drawPortrait(x, 2, 7, 1, cap, hat, false, outfit);
  return c;
}
function openWho() {
  const p = openPanel('Dein Wühler');
  // the name others see in a shared game
  opt(sec(p, 'Name'), {
    title: P.name,
    sub: tr('Tippen zum Ändern'),
    cost: '✎',
    short: true,
    onClick: () => openName(openWho),
  });
  const l = sec(p, 'Hut');
  for (const id in HATS) {
    const own = P.hats.includes(id);
    opt(l, {
      icon: hatIcon(id),
      title: tr(HATS[id].name),
      sub: HATS[id].sub && own ? tr(HATS[id].sub) : '',
      short: true,
      disabled: !own,
      cost: P.hat === id ? '✓' : own ? '' : '🔒 ' + unlockText(HATS[id]),
      onClick: () => {
        P.hat = id;
        saveProfile();
        openWho();
      },
    });
  }
  const c = sec(p, 'Mützenfarbe');
  for (const col of CAPS)
    opt(c, {
      icon: hatIcon('none', col),
      title: '',
      short: true,
      cost: P.cap === col ? '✓' : '',
      onClick: () => {
        P.cap = col;
        saveProfile();
        openWho();
      },
    });
}
function openQuests() {
  const p = openPanel('Tagesaufgaben');
  sec(p, 'Jeden Tag neu').remove();
  for (const q of P.quests) {
    const Q = QUESTS[q.id];
    const ready = !q.done && q.have >= q.goal;
    const row = document.createElement('div');
    row.className = 'lb-q' + (q.done ? ' done' : '');
    row.innerHTML = `<b>${tr(Q.text, { n: q.goal })}</b>
      <span class="lb-qbar"><i style="width:${(q.have / q.goal) * 100}%"></i><em>${q.have}/${q.goal}</em></span>`;
    const btn = document.createElement('button');
    btn.className = ready ? 'go' : 'ghost';
    btn.disabled = !ready;
    btn.textContent = q.done ? tr('Erledigt') : ready ? tr('Abholen +{n} XP', { n: Q.xp }) : `+${Q.xp} XP`;
    btn.onclick = () => {
      if (performance.now() - G.panelT < 450) return;
      if (claimQuest(q)) {
        sfx('done');
        burst(20, ['#7fe0ff', '#ffffff']);
      }
      openQuests();
    };
    row.appendChild(btn);
    p.appendChild(row);
  }
}
function openOptions() {
  const p = openPanel('Optionen');
  settingsSections(p, openOptions, { lobby: true });
  const l = sec(p, tr('Sonstiges') + ' · v' + __APP_VERSION__);
  opt(l, {
    title: getLang() === 'de' ? 'English' : 'Deutsch',
    sub: tr('Sprache'),
    onClick: () => {
      setLang(getLang() === 'de' ? 'en' : 'de');
      G.crewKey = G.invKey = '';
      closePanel();
      refresh();
    },
  });
  if (canInstall())
    opt(l, {
      title: tr('Als App installieren'),
      sub: tr('Startbildschirm, Vollbild, offline'),
      onClick: openInstall,
    });
  opt(l, {
    title: tr('Spielhilfe'),
    sub: tr('Alle entdeckten Tipps zum Nachlesen'),
    onClick: openHelp,
  });
  opt(l, {
    title: tr('Tutorial spielen'),
    sub: tr(hooks.hasRun() ? 'Ersetzt dein laufendes Spiel' : 'Eigene kleine Welt mit Anleitung'),
    onClick: () => {
      // a running game would be lost: ask with a second tap
      if (hooks.hasRun() && performance.now() - tutArmed > 3000) {
        tutArmed = performance.now();
        toast('Nochmal tippen: Tutorial starten, dein Spielstand geht verloren');
        return;
      }
      closePanel();
      hooks.play(true);
    },
  });
  opt(l, {
    title: tr('Datenschutz'),
    sub: tr('Was gespeichert und übertragen wird'),
    short: true,
    onClick: () => window.open(LIVE + 'privacy.html', '_blank'),
  });
  const k = document.createElement('div');
  k.innerHTML = hooks.keysHtml();
  p.appendChild(k);
}

function openHelp() {
  lessonsPanel(openPanel('Spielhilfe'), openHelp);
}

// ---- Wiring ----
function tap(id, fn) {
  $(id).addEventListener('click', () => {
    if (!panelEl.hidden) return;
    audioInit();
    if (G.AC && G.AC.state === 'suspended') G.AC.resume();
    fn();
  });
}
tap('lbWho', openWho);
tap('lbNameTag', () => openName());
tap('lbSlot1', openInvite);
tap('lbSlot2', openInvite);
tap('lbQuest', openQuests);
tap('lbCamp', () => openCamp({ burst }));
tap('lbRoad', openWho);
tap('lbOpt', openOptions);
tap('lbDaily', () => openDaily(hooks));
// what is chosen to play: the profile's choice; in a room the host's (no campaign there)
function chosen() {
  if (!inRoom()) return P.gmode || 'gold';
  if (NET.auto) return NET.auto.gmode;
  if (!NET.host) return NET.gmode || 'gold';
  const g = GAME_MODES[P.gmode] && !GAME_MODES[P.gmode].campaign ? P.gmode : 'gold';
  if (NET.gmode !== g) setGMode(g);
  return g;
}
// the level selection: in a room the host only chooses (modes and maps), alone a choice starts
function openSelection(tab) {
  const room = inRoom();
  openSelect({
    tab,
    current: chosen(),
    tabs: room ? ['modes', 'maps'] : null,
    pick: room,
    onClose: refresh,
    onPick: id => {
      if (room) return setGMode(id);
      hooks.play(false, GAME_MODES[id].campaign ? id : null);
    },
  });
}
tap('lbGMode', () => {
  if (inRoom() && NET.auto) return toast('Schnell spielen: der Modus der Stunde');
  if (inRoom() && !NET.host) return toast('Der Host wählt den Modus');
  openSelection();
});
tap('lbDiff', () => {
  P.diff = P.diff === 'relaxed' ? 'adventure' : 'relaxed';
  saveProfile();
  toast(
    P.diff === 'relaxed' ? 'Entspannt: keine Monster, kein Gas, keine Blitze und Meteore' : 'Abenteuer: alle Gefahren',
  );
  refresh();
});
tap('lbMode', () => {
  const m = P.mode || 'random';
  P.mode = MODES[(MODES.indexOf(m) + 1) % MODES.length];
  saveProfile();
  refresh();
});
tap('lbPlay', () => {
  if (selectOpen()) return;
  const g = P.gmode,
    M = GAME_MODES[g];
  if (hooks.hasRun() || inRoom()) return hooks.play(false);
  // a chosen campaign level starts as that level; "campaign" (older profiles) opens the choice
  if (M && M.campaign && unlocked(g)) return hooks.play(false, g);
  if (g === 'campaign' || (M && M.campaign)) return openSelection();
  hooks.play(false);
});
// (−Infinity: the first tap always asks, also right after the page opened)
let newArmed = -Infinity,
  tutArmed = -Infinity;
tap('lbNew', () => {
  if (performance.now() - newArmed > 3000) {
    newArmed = performance.now();
    toast('Nochmal tippen: neue Welt starten, Fortschritt geht verloren');
    return;
  }
  newArmed = -Infinity;
  hooks.discard();
  refresh();
});
cv.addEventListener('pointerdown', e => {
  const h = heroScreen(cv),
    r = cv.getBoundingClientRect();
  if (Math.abs(e.clientX - r.left - h.x) > 14 * h.k || Math.abs(e.clientY - r.top - h.y + 10 * h.k) > 14 * h.k) return;
  if (jumpY < 0) return;
  jumpV = -1.9;
  jumpY = -0.01;
  sfx('jump');
  burst(8, ['#f4ead2', '#f2c230']);
});
for (const e of el.querySelectorAll('[data-ico]')) e.style.backgroundImage = `url(${padIcon(e.dataset.ico)})`;

function showLobby(h) {
  if (h) hooks = h;
  checkUpdate();
  G.state = 'menu';
  el.hidden = false;
  $('game').classList.add('inlobby');
  requestAnimationFrame(() => {
    sizeScene(cv);
    placeOverlay();
  });
  refresh();
  offerInstall();
  dailyFromLink(hooks);
  // once per visit: the vault is full, the home crew waits
  if (vaultFull() && !campTold) {
    campTold = true;
    toast('Der Tresor im Heimatbergwerk ist voll – kassieren!');
  }
}
let campTold = false;
function hideLobby() {
  el.hidden = true;
  $('game').classList.remove('inlobby');
  closePanel();
}
const lobbyOpen = () => !el.hidden;
addEventListener('resize', () => {
  if (el.hidden) return;
  sizeScene(cv);
  placeOverlay();
});
G.nextBiome = null;
G.onRoomChange = () => !el.hidden && refresh();
G.onNameChange = () => !el.hidden && refresh();
G.onLeaveRoom = () => {
  if (G.net) hooks.discard?.();
  if (!el.hidden) refresh();
};
const chosenBiome = () => (P.mode && P.mode !== 'random' ? P.mode : null);

export { chosenBiome, frame as lobbyFrame, hideLobby, lobbyOpen, showLobby };
