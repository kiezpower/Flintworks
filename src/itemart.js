// Painted items, chests, hoards and interface icons from two transparent atlases
// (assets/items). Sizes, physics and values are untouched. The module waits for
// its pictures (a few hundred kB, precached) so that every icon cached at
// start-up is already the painted one; if they are missing or slow, the pixel
// icons are used instead.
import itemsUrl from './assets/items/atlas.png';
import itemsMeta from './assets/items/atlas.json';
import uiUrl from './assets/items/ui.png';
import uiMeta from './assets/items/ui.json';
import propsUrl from './assets/items/props.png';
import propsMeta from './assets/items/props.json';

const frames = {};
const load = (url, meta, prefix) =>
  new Promise(resolve => {
    const image = new Image();
    image.onload = () => {
      if (image.naturalWidth !== meta.width || image.naturalHeight !== meta.height) return resolve(false);
      for (const [name, [x, y, w, h]] of Object.entries(meta.frames)) {
        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        c.getContext('2d').drawImage(image, x, y, w, h, 0, 0, w, h);
        frames[prefix + name] = c;
      }
      resolve(true);
    };
    image.onerror = () => resolve(false);
    image.src = url;
  });
// items by their type ('nug', 'chest', …), interface icons as 'ui:dig', 'ui:castle', …,
// larger things of the world as 'prop:tomb', 'prop:shrine', 'prop:merchant', …
const itemArtReady = Promise.all([load(itemsUrl, itemsMeta, ''), load(uiUrl, uiMeta, 'ui:'), load(propsUrl, propsMeta, 'prop:')]).then(r => r.every(Boolean));
await Promise.race([itemArtReady, new Promise(resolve => setTimeout(resolve, 4000))]);

const paintedItem = t => frames[t] || null;

// the picture stands on the bottom edge of the box (x, y, w, h), centred, `grow` times the
// box's larger side (items in the world are only a few cells: the picture may overhang a little)
// o: { flip: mirrored, dy: shifted down (cells), cropTop: this share of the picture's top is left out }
function drawPainted(g, t, x, y, w, h, grow = 1, shine = false, o = null) {
  const f = frames[t];
  if (!f) return false;
  const k = (Math.max(w, h) * grow) / Math.max(f.width, f.height),
    dw = f.width * k,
    dh = f.height * k,
    top = o?.cropTop ? Math.round(f.height * o.cropTop) : 0;
  g.save();
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = 'high';
  g.translate(x + w / 2, y + h + (o?.dy || 0));
  if (o?.flip) g.scale(-1, 1);
  const put = () => g.drawImage(f, 0, top, f.width, f.height - top, -dw / 2, -dh + top * k, dw, dh - top * k);
  put();
  if (shine) {
    // (gold and gems glint: the same picture once more, added as light)
    g.globalCompositeOperation = 'lighter';
    g.globalAlpha = 0.45;
    put();
  }
  g.restore();
  return true;
}
// a square icon for menus and the HUD, marked so that it is shown smoothly
function squareIcon(source, size = 48) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  c.painted = true;
  c.className = 'painted';
  const g = c.getContext('2d'),
    k = (size - 2) / Math.max(source.width, source.height);
  g.imageSmoothingQuality = 'high';
  g.drawImage(source, (size - source.width * k) / 2, (size - source.height * k) / 2, source.width * k, source.height * k);
  return c;
}
const icons = {};
const paintedIcon = (t, size = 48) => (frames[t] ? (icons[t + size] ||= squareIcon(frames[t], size)) : null);

export { drawPainted, itemArtReady, paintedIcon, paintedItem, squareIcon };
