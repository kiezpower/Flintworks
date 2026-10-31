// Offer to install the web version as an app (home screen icon, full screen, offline). Browsers
// with an install prompt (Chrome, Edge, Samsung) get a button; iPhone/iPad get the share-menu
// steps, everything else a short hint. Not in the Android app and not when already installed.
import { ownWeb } from './platform.js';
import { tr } from './i18n.js';
import { P, saveProfile } from './profile.js';
import { sfx } from './sound.js';
import { G } from './state.js';
import { closePanel, opt, openPanel, panelEl, sec, toast } from './ui.js';

let deferred = null; // the browser's install prompt, kept for our own button
addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferred = e;
});
addEventListener('appinstalled', () => {
  deferred = null;
  P.installAsked = 'done';
  saveProfile();
  toast('Flintworks ist jetzt als App installiert');
});

// (only the own web version: not the app, not inside itch.io or another site)
const installed = () =>
  !ownWeb() ||
  navigator.standalone === true ||
  ['standalone', 'fullscreen', 'minimal-ui'].some(m => matchMedia(`(display-mode: ${m})`).matches);
const ua = navigator.userAgent;
const isIOS = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
const isAndroid = /Android/.test(ua);
const canInstall = () => !installed() && P.installAsked !== 'done';

// the steps for browsers without an install button
function steps() {
  if (isIOS)
    return [
      'Tippe in Safari auf „Teilen“ (Quadrat mit Pfeil nach oben)',
      'Wähle „Zum Home-Bildschirm“',
      'Tippe auf „Hinzufügen“ – Flintworks liegt jetzt als App auf deinem Home-Bildschirm',
    ];
  if (isAndroid)
    return ['Öffne das Browsermenü (⋮ oben rechts)', 'Wähle „App installieren“ oder „Zum Startbildschirm hinzufügen“'];
  return ['Klicke in der Adressleiste auf das Installieren-Symbol oder im Browsermenü auf „App installieren“'];
}
async function promptNow() {
  if (!deferred) return;
  const e = deferred;
  deferred = null;
  e.prompt();
  const { outcome } = await e.userChoice.catch(() => ({ outcome: 'dismissed' }));
  if (outcome === 'accepted') {
    P.installAsked = 'done';
    saveProfile();
    sfx('done');
  }
}
function openInstall() {
  const p = openPanel('Als App installieren');
  const info = document.createElement('p');
  info.className = 'hint';
  info.textContent = tr('Mit Symbol auf dem Startbildschirm, im Vollbild und auch ohne Internet spielbar.');
  p.appendChild(info);
  const l = sec(p, deferred ? 'Ein Tipp genügt' : 'So geht es');
  if (deferred)
    opt(l, {
      icon: appIcon(),
      title: tr('Jetzt installieren'),
      sub: tr('Kostenlos, ohne App-Store'),
      onClick: () => {
        closePanel();
        promptNow();
      },
    });
  else {
    const ol = document.createElement('ol');
    ol.className = 'hint install-steps';
    for (const s of steps()) ol.insertAdjacentHTML('beforeend', `<li>${tr(s)}</li>`);
    l.replaceWith(ol);
  }
  const l2 = sec(p, '');
  opt(l2, {
    title: tr('Später'),
    short: true,
    onClick: () => {
      P.installAsked = (P.games || 0) + 3; // ask once more after three rounds
      saveProfile();
      closePanel();
    },
  });
  opt(l2, {
    title: tr('Nicht mehr fragen'),
    short: true,
    onClick: () => {
      P.installAsked = 'done';
      saveProfile();
      closePanel();
    },
  });
}
// the app icon, loaded right away so it is ready when the panel opens
const icon = document.createElement('canvas');
icon.width = icon.height = 24;
const iconSrc = new Image();
iconSrc.onload = () => icon.getContext('2d').drawImage(iconSrc, 0, 0, 24, 24);
iconSrc.src = 'icons/icon-192.png';
const appIcon = () => icon;

// in the lobby: ask on the first visit, after "later" once more a few rounds on
function offerInstall() {
  if (!canInstall() || G.net || !panelEl.hidden) return;
  // not before the player has had the fun: after the tutorial and a first real round
  if (!P.tutorialDone || !(P.games >= 1)) return;
  const a = P.installAsked;
  if (a === undefined || (typeof a === 'number' && (P.games || 0) >= a)) {
    // first visit: wait a moment so the lobby is seen first (and the browser offered its prompt)
    setTimeout(() => {
      if (!panelEl.hidden || G.state !== 'menu' || !canInstall()) return;
      P.installAsked = (P.games || 0) + 3; // closing the panel counts as "later"
      saveProfile();
      openInstall();
    }, 1500);
  }
}

export { canInstall, offerInstall, openInstall };
