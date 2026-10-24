import { GAME_MODES, MODE_IDS, mode } from './modes.js';
// Lobby between games: the player's Wühler on a stage, resources on top, menus left, play button right.
import { BIOMES } from './biomes.js';
import './lobby.css';
import { getLang, setLang, tr } from './i18n.js';
import { CAPS, HATS, P, QUESTS, claimQuest, saveProfile, unlockText, xpNeed } from './profile.js';
import { NET, ensureRoom, inviteLink, shareInvite } from './net.js';
import { drawPortrait } from './portrait.js';
import { audioInit, sfx } from './sound.js';
import { padIcon, treeSprite } from './sprites.js';
import { G } from './state.js';
import { $, closePanel, opt, openPanel, panelEl, sec, toast } from './ui.js';

const el = $('lobby');
$('lbVersion').textContent = 'v' + __APP_VERSION__;
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
const treeCache = {};
function stageTrees(b) {
  const type = b === BIOMES.desert ? 'cactus' : b === BIOMES.winter ? 'snowpine' : 'oak';
  return (treeCache[type] ||= [treeSprite(type, 1), treeSprite(type === 'oak' ? 'pine' : type, 0)]);
}
const look = () => ({
  cap: P.cap,
  hat: P.hat,
  hurt: 0,
  dead: false,
  x: 3,
  anim: jumpY < 0 ? t * 0.4 : 0,
  inv: [],
  isel: 0,
});

// Lobby sky follows the chosen world type; random cycles through all three
function stageSky() {
  if (hooks.hasRun?.()) return BIOMES[G.biome] || BIOMES.meadow;
  const m = P.mode && P.mode !== 'random' ? P.mode : MODES[1 + (Math.floor(t / 300) % 3)];
  return BIOMES[m];
}
function drawStage() {
  const W = cv.width / 2,
    H = cv.height / 2;
  g.setTransform(2, 0, 0, 2, 0, 0);
  g.imageSmoothingEnabled = false;
  const b = stageSky();
  const sk = g.createLinearGradient(0, 0, 0, H);
  sk.addColorStop(0, `rgb(${b.sky[0]})`);
  sk.addColorStop(1, `rgb(${b.sky[1]})`);
  g.fillStyle = sk;
  g.fillRect(0, 0, W, H);
  // hills and ground
  for (let x = 0; x < W; x++) {
    const h1 = Math.round(14 + Math.sin(x * 0.18 + 1) * 3 + Math.sin(x * 0.07) * 2);
    g.fillStyle = b.hills[0];
    g.fillRect(x, H - h1, 1, h1);
    const h2 = Math.round(9 + Math.sin(x * 0.27 + 3) * 2);
    g.fillStyle = b.hills[1];
    g.fillRect(x, H - h2, 1, h2);
  }
  g.fillStyle = b.top[1];
  g.fillRect(0, H - 6, W, 1);
  g.fillStyle = b.top[0];
  g.fillRect(0, H - 5, W, 1);
  g.fillStyle = '#7a5232';
  g.fillRect(0, H - 4, W, 4);
  // clouds and trees around the stage
  g.fillStyle = 'rgba(255,255,255,0.85)';
  for (let k = 0; k < 3; k++) {
    const cx = ((t * (0.04 + k * 0.015) + k * 19) % (W + 16)) - 8,
      cy = 3 + k * 4;
    g.fillRect(Math.round(cx), cy, 8, 2);
    g.fillRect(Math.round(cx) + 2, cy - 1, 4, 1);
  }
  const tr0 = stageTrees(b);
  g.drawImage(tr0[0], 4, H - 5 - tr0[0].height);
  g.drawImage(tr0[1], W - 4 - tr0[1].width, H - 5 - tr0[1].height);
  // stone podium
  const px = (W >> 1) - 7;
  g.fillStyle = '#5b5f68';
  g.fillRect(px, H - 9, 14, 4);
  g.fillStyle = '#8a909a';
  g.fillRect(px, H - 9, 14, 1);
  g.fillStyle = '#f2c230';
  g.fillRect(px + 6, H - 7, 2, 1);
  // shadow, then the Wühler
  g.fillStyle = 'rgba(0,0,0,0.25)';
  g.fillRect((W >> 1) - 3 + Math.round(jumpY / 6), H - 10, 6 - Math.round(-jumpY / 4), 1);
  const bob = jumpY < 0 ? 0 : Math.floor(t / 30) % 2;
  const f = spin > 0 ? (Math.floor(spin / 6) % 2 ? 1 : -1) : 1;
  g.setTransform(1, 0, 0, 1, 0, 0);
  drawPortrait(g, W - 8, H * 2 - 38 + bob + Math.round(jumpY * 2), f, P.cap, P.hat, (G.frame + 21) % 240 < 6);
  g.setTransform(2, 0, 0, 2, 0, 0);
  for (let k = sparks.length - 1; k >= 0; k--) {
    const s = sparks[k];
    s.x += s.vx;
    s.y += s.vy;
    s.vy += 0.03;
    if (--s.l <= 0) sparks.splice(k, 1);
    g.fillStyle = s.c;
    g.fillRect(Math.round(s.x), Math.round(s.y), 1, 1);
  }
}
function burst(n, cols) {
  for (let k = 0; k < n; k++)
    sparks.push({
      x: cv.width / 4,
      y: cv.height / 2 - 16,
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
  setTxt('lbHat', P.hat === 'none' ? `Kurt · ${tr('Level')} ${P.level}` : `Kurt · ${tr(HATS[P.hat].name)}`);
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
  for (const id of ['lbSlot1', 'lbSlot2']) $(id).classList.toggle('waiting', NET.status === 'waiting');
  const run = hooks.hasRun();
  setTxt('lbPlayTxt', tr(run ? 'Weiterspielen' : 'Spielen'));
  $('lbNew').hidden = !run;
  $('lbMode').disabled = run;
  const GM = GAME_MODES[P.gmode || 'gold'];
  $('lbGMode').disabled = run;
  setTxt('lbGModeTxt', tr(run ? mode().name : GM.name));
  const gm = run ? mode() : GM;
  setTxt('lbGModeDesc', tr(gm.desc, { goal: gm.goal }));
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
  opt(l, {
    title: tr('Tutorial spielen'),
    sub: tr('Neue Welt mit Anleitung'),
    onClick: () => {
      closePanel();
      hooks.play(true);
    },
  });
  const k = document.createElement('div');
  k.innerHTML = hooks.keysHtml();
  p.appendChild(k);
}

function openInvite() {
  const p = openPanel('Mitspieler einladen');
  const box = document.createElement('div');
  box.className = 'lb-invite';
  box.innerHTML = `<p>${tr('Grabt bald zu dritt in einer Welt. Der Multiplayer ist in Arbeit – dein Raum ist schon reserviert.')}</p>
    <div class="lb-code"><small>${tr('Raum-Code')}</small><b>${ensureRoom()}</b></div>`;
  p.appendChild(box);
  const l = sec(p, 'Einladen');
  opt(l, {
    title: tr('Link teilen'),
    sub: tr('Schicke deinen Freunden den Einladungslink'),
    onClick: async () => {
      const r = await shareInvite(tr('Grab mit mir in Flintworks!'));
      if (r === 'copied') toast('Link kopiert');
      else if (r === 'failed') toast('Teilen nicht möglich');
      openInvite();
    },
  });
  if (NET.room) {
    const link = document.createElement('p');
    link.className = 'hint lb-link';
    link.textContent = inviteLink();
    p.appendChild(link);
  }
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
  const m = P.gmode || 'gold';
  P.gmode = MODE_IDS[(MODE_IDS.indexOf(m) + 1) % MODE_IDS.length];
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
tap('lbPlay', () => hooks.play(false));
let newArmed = 0;
tap('lbNew', () => {
  if (performance.now() - newArmed > 3000) {
    newArmed = performance.now();
    toast('Nochmal tippen: neue Welt starten, Fortschritt geht verloren');
    return;
  }
  newArmed = 0;
  hooks.discard();
  refresh();
});
cv.addEventListener('pointerdown', () => {
  if (jumpY < 0) return;
  jumpV = -1.9;
  jumpY = -0.01;
  sfx('jump');
  burst(8, ['#f4ead2', '#f2c230']);
});
for (const e of el.querySelectorAll('[data-ico]')) e.style.backgroundImage = `url(${padIcon(e.dataset.ico)})`;

function showLobby(h) {
  if (h) hooks = h;
  G.state = 'menu';
  el.hidden = false;
  $('game').classList.add('inlobby');
  refresh();
}
function hideLobby() {
  el.hidden = true;
  $('game').classList.remove('inlobby');
  closePanel();
}
const lobbyOpen = () => !el.hidden;
G.nextBiome = null;
const chosenBiome = () => (P.mode && P.mode !== 'random' ? P.mode : null);

export { chosenBiome, frame as lobbyFrame, hideLobby, lobbyOpen, showLobby };
