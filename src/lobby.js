import { GAME_MODES, MODE_IDS, mode } from './modes.js';
import { campaignPanel, totalStars } from './scenarios.js';
import { lessonsPanel } from './lessons.js';
import { canInstall, offerInstall, openInstall } from './install.js';
import { LIVE, isNative, ownWeb } from './platform.js';
// Lobby between games: the player's Wühler on a stage, resources on top, menus left, play button right.
import { BIOMES } from './biomes.js';
import './lobby.css';
import { getLang, setLang, tr } from './i18n.js';
import { CAPS, HATS, P, QUESTS, claimQuest, saveProfile, unlockText, xpNeed } from './profile.js';
import { openInvite, refreshSlots } from './lobbyinvite.js';
import { NET, inRoom, others } from './net/room.js';
import { drawPortrait } from './portrait.js';
import { drawScene, friendDx, heroOrigin, heroScreen, sizeScene } from './lobbyscene.js';
import { audioInit, sfx } from './sound.js';
import { padIcon } from './sprites.js';
import { G } from './state.js';
import { $, closePanel, opt, openPanel, panelEl, sec, toast } from './ui.js';

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
  drawScene(g, { t, biome: stageBiome(), cap: P.cap, hat: P.hat, jumpY, spin, sparks, friends: others() });
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
  const nm = P.name || 'Kurt';
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
    tr(run ? 'Weiterspielen' : wait ? 'Warte auf Host' : inRoom() ? 'Spielen ({n})' : 'Spielen', {
      n: NET.players.length,
    }),
  );
  $('lbPlay').classList.toggle('wait', wait);
  $('lbNew').hidden = !run;
  $('lbMode').disabled = run;
  const camp = !run && P.gmode === 'campaign';
  const GM = GAME_MODES[P.gmode] || GAME_MODES.gold;
  $('lbGMode').disabled = run;
  const gm = run ? mode() : GM;
  setTxt('lbGModeTxt', camp ? tr('Kampagne') : gm.n ? `${gm.n} · ${tr(gm.name)}` : tr(gm.name));
  setTxt(
    'lbGModeDesc',
    camp ? tr('{n} Level · Sterne {s}/{m}', { n: 7, s: totalStars(), m: 21 }) : tr(gm.desc, { goal: gm.goal }),
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
function hatIcon(hat, cap = P.cap) {
  const c = document.createElement('canvas');
  c.width = 40;
  c.height = 56;
  const x = c.getContext('2d');
  x.scale(2, 2);
  drawPortrait(x, 2, 7, 1, cap, hat, false);
  return c;
}
function openWho() {
  const p = openPanel('Dein Wühler');
  // the name others see in a shared game
  opt(sec(p, 'Name'), {
    title: P.name || 'Kurt',
    sub: tr('Tippen zum Ändern'),
    short: true,
    onClick: () => {
      const n = (prompt(tr('Wie heißt dein Wühler?'), P.name || 'Kurt') || '').trim().slice(0, 12);
      if (n) {
        P.name = n.replace(/[<>&"]/g, '');
        saveProfile();
        refresh();
      }
      openWho();
    },
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
  const l = sec(p, 'Spiel');
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
  opt(l, {
    title: tr(G.muted ? 'Ton aus' : 'Ton an'),
    sub: tr('Ton'),
    onClick: () => {
      G.muted = !G.muted;
      $('sndBtn').classList.toggle('off', G.muted);
      openOptions();
    },
  });
  opt(l, {
    title: tr(P.music === false ? 'Musik aus' : 'Musik an'),
    sub: tr('Musik'),
    onClick: () => {
      P.music = P.music === false;
      saveProfile();
      openOptions();
    },
  });
  opt(l, {
    title: tr(P.autodig === false ? 'Automatisch graben aus' : 'Automatisch graben an'),
    sub: tr('Gegen Erde laufen gräbt. Aus: Graben- und Sprung-Knopf wie früher'),
    onClick: () => {
      P.autodig = P.autodig === false;
      G.autoDig = P.autodig;
      saveProfile();
      openOptions();
    },
  });
  {
    const names = { calm: 'Gemütlich', normal: 'Normal', fast: 'Schnell' };
    opt(l, {
      title: tr('Spieltempo: {t}', { t: tr(names[P.tempo || 'normal']) }),
      sub: tr('Gemütlich, Normal oder Schnell'),
      onClick: () => {
        const ks = Object.keys(names);
        P.tempo = ks[(ks.indexOf(P.tempo || 'normal') + 1) % ks.length];
        saveProfile();
        openOptions();
      },
    });
  }
  opt(l, {
    title: tr(P.jumpbtn === false ? 'Sprung-Knopf aus' : 'Sprung-Knopf an'),
    sub: tr('Eigener Knopf zum Springen, auch beim automatischen Graben'),
    onClick: () => {
      P.jumpbtn = P.jumpbtn === false;
      G.jumpBtn = P.jumpbtn;
      saveProfile();
      openOptions();
    },
  });
  opt(l, {
    title: tr(P.climbing ? 'Klettern an' : 'Klettern aus'),
    sub: tr('An Wänden hochklettern und an Decken hängen'),
    onClick: () => {
      P.climbing = !P.climbing;
      G.climbOn = P.climbing;
      saveProfile();
      openOptions();
    },
  });
  opt(l, {
    title: tr(P.territory ? 'Baugebiete an' : 'Baugebiete aus'),
    sub: tr('Bauen nur im eigenen Gebiet, Flaggen erweitern es'),
    onClick: () => {
      P.territory = !P.territory;
      saveProfile();
      openOptions();
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
tap('lbSlot1', openInvite);
tap('lbSlot2', openInvite);
tap('lbQuest', openQuests);
tap('lbRoad', openWho);
tap('lbOpt', openOptions);
tap('lbGMode', () => {
  const ids = [...MODE_IDS, 'campaign'];
  const m = P.gmode || 'gold';
  P.gmode = ids[(ids.indexOf(m) + 1) % ids.length];
  saveProfile();
  refresh();
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
tap('lbPlay', () => (P.gmode === 'campaign' && !hooks.hasRun() && !inRoom() ? openCampaign() : hooks.play(false)));
function openCampaign() {
  const p = openPanel('Kampagne');
  campaignPanel(p, {
    opt,
    sec,
    start: id => {
      closePanel();
      hooks.play(false, id);
    },
  });
}
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
}
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
G.onLeaveRoom = () => {
  if (G.net) hooks.discard?.();
  if (!el.hidden) refresh();
};
const chosenBiome = () => (P.mode && P.mode !== 'random' ? P.mode : null);

export { chosenBiome, frame as lobbyFrame, hideLobby, lobbyOpen, showLobby };
