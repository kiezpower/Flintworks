// Where the game runs: the Android app, the own web version (GitHub Pages, can be installed as
// an app), or embedded on another site like itch.io (in a frame: no service worker, no install
// offer, no update link – the site brings the new version itself).
const LIVE = 'https://kiezpower.github.io/Flintworks/';
// (window.Capacitor exists on the web too, since the core is bundled: ask for the platform)
const isNative = () => !!window.Capacitor?.isNativePlatform?.();
const embedded = (() => {
  try {
    return window.top !== window.self;
  } catch {
    return true; // a foreign frame does not even let us look
  }
})();
const onItch = /(^|\.)itch\.(zone|io)$/.test(location.hostname);
// the own web version (not the app, not inside someone else's page)
const ownWeb = () => !isNative() && !embedded && !onItch;

export { LIVE, embedded, isNative, onItch, ownWeb };
