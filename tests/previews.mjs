// Preview pictures for the level selection: starts the dev server, makes every level and map of
// the campaign from its seed and saves the whole world as a small picture with 32 colours or
// fewer (public/previews/<id>.png), plus the checksum of each world (src/levels/previews.json).
// The level test fails when a world no longer matches its picture: then run this again.
//   npm run previews
import { createServer } from 'vite';
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const OUT = new URL('../public/previews/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

// a PNG with a colour palette (the browser only writes true colour, three times the size)
function crc32(buf) {
  let c,
    crc = -1;
  for (const b of buf) {
    c = (crc ^ b) & 255;
    for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ -1) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4),
    crc = Buffer.alloc(4),
    td = Buffer.concat([Buffer.from(type), data]);
  len.writeUInt32BE(data.length);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png8(w, h, pal, idx) {
  const head = Buffer.alloc(13);
  head.writeUInt32BE(w, 0);
  head.writeUInt32BE(h, 4);
  head.set([8, 3, 0, 0, 0], 8); // 8 bit, palette
  const raw = Buffer.alloc((w + 1) * h);
  for (let y = 0; y < h; y++) raw.set(idx.subarray(y * w, y * w + w), y * (w + 1) + 1);
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', head),
    chunk('PLTE', Buffer.from(pal.flat())),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const server = await createServer({ server: { port: 0 }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
await page.goto(server.resolvedUrls.local[0]);
await page.waitForFunction(() => window.__ww);
const ids = await page.evaluate(async () => {
  const { CHAPTER1 } = await import('/src/scenarios.js'),
    { CHAPTER2, MAP_IDS } = await import('/src/levels/index.js');
  return [...CHAPTER1, ...CHAPTER2, ...MAP_IDS];
});
const index = {};
for (const id of ids) {
  const r = await page.evaluate(async id => {
    const { GAME_MODES } = await import('/src/modes.js'),
      { worldPreview, worldHash } = await import('/src/levels/preview.js'),
      w = window.__ww,
      G = w.G,
      M = GAME_MODES[id];
    Object.assign(G, { nextMode: id, nextSeed: M.seed, nextBiome: M.biome, nextDiff: M.diff || 'adventure' });
    G.nextVersus = M.map && M.pkg.objects.some(o => o.t === 'base' && o.team === 1);
    G.nextSize = null;
    w.gen();
    G.nextSeed = null;
    G.nextVersus = false;
    const c = worldPreview(M.pkg, M.biome),
      d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    // the colours used become the palette
    const pal = new Map(),
      idx = new Uint8Array(c.width * c.height);
    for (let i = 0; i < idx.length; i++) {
      const key = (d[i * 4] << 16) | (d[i * 4 + 1] << 8) | d[i * 4 + 2];
      if (!pal.has(key)) pal.set(key, pal.size);
      idx[i] = pal.get(key);
    }
    return { w: c.width, h: c.height, hash: worldHash(), pal: [...pal.keys()], idx: [...idx] };
  }, id);
  if (r.pal.length > 256) throw new Error(`${id}: ${r.pal.length} colours`);
  const file = png8(r.w, r.h, r.pal.map(k => [k >> 16, (k >> 8) & 255, k & 255]), Uint8Array.from(r.idx));
  writeFileSync(OUT + id + '.png', file);
  index[id] = { hash: r.hash, w: r.w, h: r.h };
  console.log(`${id}: ${r.w}×${r.h}, ${r.pal.length} colours, ${file.length} bytes`);
}
writeFileSync(new URL('../src/levels/previews.json', import.meta.url), JSON.stringify(index, null, 1) + '\n');
await browser.close();
await server.close();
if (errors.length) {
  console.error(errors);
  process.exit(1);
}
