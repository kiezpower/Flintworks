// Full-resolution scenery, shared by the menu and the playable world. The old
// procedural backdrop stays available while loading or when an image is missing.
const sources = {
  meadow: new URL('./assets/scenes/valley.png', import.meta.url).href,
  desert: new URL('./assets/scenes/desert.png', import.meta.url).href,
  winter: new URL('./assets/scenes/winter.png', import.meta.url).href,
};
const images = {};
const loads = {};
function loadScene(name) {
  return loads[name] ??= new Promise(resolve => {
    const im = new Image();
    im.onload = () => { images[name] = im; resolve(true); };
    im.onerror = () => resolve(false);
    im.src = sources[name];
  });
}
const preloadSceneArt = () => Promise.all(Object.keys(sources).map(loadScene));
function drawSceneArt(g, biome, width, height, offset = 0, top = 0) {
  const name = biome === 'autumn' ? 'meadow' : biome;
  if (Object.hasOwn(sources, name)) loadScene(name);
  const im = images[name];
  if (!im) return false;
  g.save();
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = 'high';
  const scale = Math.max(width / im.width, height / im.height);
  const w = im.width * scale, h = im.height * scale;
  // Bounded parallax pans inside a single painting; no repeating tile seams.
  const x = -(w - width) * (0.5 + Math.sin(offset * 0.001) * 0.35);
  g.drawImage(im, x, top, w, h);
  g.restore();
  return true;
}
export { drawSceneArt, preloadSceneArt };
