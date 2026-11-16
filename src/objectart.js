// Isolated painted objects retain each original sprite's gameplay footprint.
const image = new Image();
const frames = {};
const rects = {
  base: [13, 21, 414, 379], hut: [451, 11, 418, 388],
  saw: [900, 80, 417, 318], shop: [1345, 42, 414, 358],
  furnace: [19, 449, 415, 411], lift: [454, 446, 420, 418],
  pine: [960, 453, 299, 409], oak: [1341, 461, 421, 399],
};
const objectArtReady = new Promise(resolve => {
  image.onload = () => {
    for (const [name, [x, y, w, h]] of Object.entries(rects)) {
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      c.getContext('2d').drawImage(image, x, y, w, h, 0, 0, w, h);
      frames[name] = c;
    }
    resolve(true);
  };
  image.onerror = () => resolve(false);
  image.src = new URL('./assets/scenes/objects.png', import.meta.url).href;
});
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
