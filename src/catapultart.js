// The painted catapult: a wheeled frame and a throwing arm that turns about the frame's axle,
// so that aiming and throwing stay visible. The hitbox and the launch point are untouched
// (ground.js); until the atlas has loaded, or without it, the vector drawing is used.
import url from './assets/items/catapult.png';
import meta from './assets/items/catapult.json';

const FRAME_W = 18, // cells the frame's width covers (the vehicle is 16 wide)
  ARM_SCALE = 0.04; // cells per stored arm pixel
let atlas = null;
const catapultArtReady = new Promise(resolve => {
  const image = new Image();
  image.onload = () => {
    if (image.naturalWidth !== meta.width || image.naturalHeight !== meta.height) return resolve(false);
    atlas = image;
    resolve(true);
  };
  image.onerror = () => resolve(false);
  image.src = url;
});

// (x, y): the vehicle's top left, v.w × v.h its box; th: the arm's angle up from straight ahead
function drawPaintedCatapult(g, v, x, y, th) {
  if (!atlas) return false;
  const [bx, by, bw, bh] = meta.base,
    [rx, ry, rw, rh] = meta.arm,
    kb = FRAME_W / bw,
    f = v.face || 1;
  g.save();
  g.translate(x + v.w / 2, y + v.h + 0.5);
  g.scale(f, 1);
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = 'high';
  g.drawImage(atlas, bx, by, bw, bh, (-bw * kb) / 2, -bh * kb, bw * kb, bh * kb);
  // the arm swings about the axle at the top of the A-frame
  g.translate((meta.axle[0] - bw / 2) * kb, -bh * kb + meta.axle[1] * kb);
  g.rotate(-th);
  g.drawImage(atlas, rx, ry, rw, rh, -meta.pivot[0] * ARM_SCALE, -meta.pivot[1] * ARM_SCALE, rw * ARM_SCALE, rh * ARM_SCALE);
  g.restore();
  return true;
}

export { catapultArtReady, drawPaintedCatapult };
