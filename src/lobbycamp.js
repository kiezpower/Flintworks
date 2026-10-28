// The Heimatbergwerk panel in the lobby: collect what the home crew mined, upgrades bought with
// crystals and the skins (outfits and building styles). The rules live in camp.js and skins.js.
import { UPGRADES, buySkin, buyUpgrade, camp, collect, level, owns, pending, price, rate, vaultHours } from './camp.js';
import { tr } from './i18n.js';
import { drawPortrait } from './portrait.js';
import { P, saveProfile } from './profile.js';
import { BSTYLES, OUTFITS, restyle } from './skins.js';
import { sfx } from './sound.js';
import { SPR, itemIcon } from './sprites.js';
import { openPanel, opt, sec, toast } from './ui.js';

// a little crystal, 7×9 texels
const GEMART = ['...o...', '..oLo..', '.oLlko.', 'oLllkko', 'oLlkkko', 'oLlkkdo', '.olkdo.', '..odo..', '...o...'];
const GEMCOL = { o: '#24160c', L: '#e8f4ff', l: '#9ad0ff', k: '#5a8fe0', d: '#3a5aa8' };
function crystalIcon() {
  const c = document.createElement('canvas');
  c.width = 7;
  c.height = 9;
  const g = c.getContext('2d');
  GEMART.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      if (ch === '.') return;
      g.fillStyle = GEMCOL[ch];
      g.fillRect(x, y, 1, 1);
    }),
  );
  return c;
}
function outfitIcon(id) {
  const c = document.createElement('canvas');
  c.width = 40;
  c.height = 56;
  const x = c.getContext('2d');
  x.scale(2, 2);
  drawPortrait(x, 2, 7, 1, P.cap, P.hat, false, id);
  return c;
}
function styleIcon(id) {
  const spr = id === 'wood' ? SPR.hut : restyle(SPR.hut, id);
  const c = document.createElement('canvas');
  c.width = spr.width;
  c.height = spr.height;
  c.getContext('2d').drawImage(spr, 0, 0);
  return c;
}
const UP_ICON = {
  crew: () => SPR.clonkIcon,
  vault: crystalIcon,
  cash: () => itemIcon('nug'),
  pick: () => itemIcon('rock'),
  wood: () => itemIcon('wood'),
};
const kTxt = n => tr('{n} Kristalle', { n });

function openCamp(hooks = {}) {
  const reopen = () => openCamp(hooks);
  const C = camp(),
    n = pending();
  const p = openPanel('Heimatbergwerk');
  const head = document.createElement('p');
  head.className = 'hint camp-head';
  head.textContent = tr('Deine Kristalle: {n} · Die Heim-Crew schürft {r} pro Stunde, der Tresor fasst {h} Stunden.', {
    n: C.k,
    r: rate(),
    h: vaultHours(),
  });
  p.appendChild(head);
  // 1. collect
  const hours = Math.min(vaultHours(), (Date.now() - C.t) / 3600000);
  opt(sec(p, 'Kassieren'), {
    icon: crystalIcon(),
    title: n ? tr('Deine Crew hat {n} Kristalle geschürft', { n }) : tr('Die Crew schürft gerade'),
    sub: tr('Tresor {p} % voll', { p: Math.round((hours / vaultHours()) * 100) }),
    cost: n ? tr('Kassieren') : '',
    disabled: !n,
    onClick: () => {
      const got = collect();
      if (got) {
        sfx('coin');
        hooks.burst?.(24, ['#9ad0ff', '#e8f4ff', '#5a8fe0']);
      }
      reopen();
    },
  });
  // 2. upgrades
  const up = sec(p, 'Ausbau');
  for (const id in UPGRADES) {
    const U = UPGRADES[id],
      cost = price(id);
    opt(up, {
      icon: UP_ICON[id](),
      title: `${tr(U.name)} · ${tr('Stufe {n}/{m}', { n: level(id), m: U.max })}`,
      sub: tr(U.sub) + (U.home ? '' : ' · ' + tr('Nur im Solo-Spiel')),
      cost: cost == null ? '✓' : kTxt(cost),
      disabled: cost == null || C.k < cost,
      onClick: () => {
        if (buyUpgrade(id)) sfx('done');
        reopen();
      },
    });
  }
  // 3. skins: outfits and building styles (seen by everybody, also in multiplayer)
  const choose = (kind, id, set) => {
    const key = `${kind}:${id}`;
    if (!owns(key)) {
      if (!buySkin(key)) return toast('Zu wenig Kristalle');
      sfx('done');
    }
    set(id);
    saveProfile();
    reopen();
  };
  const ol = sec(p, 'Outfit');
  for (const id in OUTFITS) {
    const O = OUTFITS[id],
      own = owns('o:' + id);
    opt(ol, {
      icon: outfitIcon(id),
      title: tr(O.name),
      short: true,
      cost: P.outfit === id ? '✓' : own ? '' : kTxt(O.k),
      disabled: !own && C.k < O.k,
      onClick: () => choose('o', id, v => (P.outfit = v)),
    });
  }
  const bl = sec(p, 'Baustil');
  for (const id in BSTYLES) {
    const S = BSTYLES[id],
      own = owns('b:' + id);
    opt(bl, {
      icon: styleIcon(id),
      title: tr(S.name),
      short: true,
      cost: P.bstyle === id ? '✓' : own ? '' : kTxt(S.k),
      disabled: !own && C.k < S.k,
      onClick: () => choose('b', id, v => (P.bstyle = v)),
    });
  }
}

export { crystalIcon, openCamp };
