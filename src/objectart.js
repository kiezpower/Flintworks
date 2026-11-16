// Isolated painted objects retain each original sprite's gameplay footprint.
const frames = {};
const rects = {
  base: [13, 21, 414, 379], hut: [451, 11, 418, 388],
  saw: [900, 80, 417, 318], shop: [1345, 42, 414, 358],
  furnace: [19, 449, 415, 411], lift: [454, 446, 420, 418],
  pine: [960, 453, 299, 409], oak: [1341, 461, 421, 399],
};
const detailRects = {
  pump: [64, 50, 220, 252], wind: [389, 40, 190, 266], chem: [675, 40, 245, 265], tower: [1030, 40, 180, 270],
  gate: [40, 355, 260, 235], field: [350, 470, 260, 117], mill: [700, 340, 200, 250], crate: [995, 413, 235, 165],
  brew: [60, 630, 225, 220], wall: [350, 660, 260, 185], lintel: [675, 665, 240, 155], cannon: [975, 690, 270, 155],
  flag: [80, 910, 205, 255], bareoak: [350, 920, 270, 245], snowpine: [700, 900, 220, 265], cactus: [1010, 915, 210, 255],
};
function loadAtlas(url, bounds) {
  return new Promise(resolve => {
    const image = new Image();
    image.onload = () => {
      for (const [name, [x, y, w, h]] of Object.entries(bounds)) {
        const c = document.createElement('canvas'); c.width = w; c.height = h;
        c.getContext('2d').drawImage(image, x, y, w, h, 0, 0, w, h);
        frames[name] = c;
      }
      resolve(true);
    };
    image.onerror = () => resolve(false); image.src = url;
  });
}
const objectArtReady = Promise.all([
  loadAtlas(new URL('./assets/scenes/objects.png', import.meta.url).href, rects),
  loadAtlas(new URL('./assets/scenes/details.png', import.meta.url).href, detailRects),
]);
function paintedObject(spr) { return spr?.artFrame || frames[spr?.artType]; }
function drawPaintedObject(g, spr, x, y, recolor) {
  let frame = paintedObject(spr);
  if (!frame) return false;
  if (spr.artStyle && recolor) frame = recolor(frame, spr.artStyle);
  g.save();
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = 'high';
  g.drawImage(frame, x, y, spr.width, spr.height);
  g.restore();
  return true;
}
export { drawPaintedObject, objectArtReady, paintedObject };
