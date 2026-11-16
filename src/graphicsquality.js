// Drawing density is independent of the world's logical grid. Even fast mode
// keeps a screen-sized picture on small displays, rather than stretching a
// single world pixel across several display pixels. Budgets bound GPU memory.
const drawingDensity = (width, height, fast, dpr = 1) =>
  Math.min(fast ? 1 : Math.min(2, dpr), Math.sqrt((fast ? 1_000_000 : 4_000_000) / Math.max(1, width * height)));
// A power-saving display or a throttled browser can deliver only 20–30 fps
// despite cheap frames. Lower detail only when the game itself is doing work.
const slowRendering = (frameMs, workMs) => frameMs > 25 && workMs > 14;
export { drawingDensity, slowRendering };
