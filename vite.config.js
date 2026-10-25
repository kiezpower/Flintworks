import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

// version shown in the lobby and menu: bump it in package.json with every change
const VERSION = JSON.parse(readFileSync(new URL('./package.json', import.meta.url))).version;

// level.json written by the level editor: one key per line, objects and triggers one per line
function levelJson(L) {
  const val = (v, ind) =>
    Array.isArray(v) && v.some(o => o && typeof o === 'object')
      ? `[\n${v.map(o => `${ind}  ${JSON.stringify(o)}`).join(',\n')}\n${ind}]`
      : JSON.stringify(v);
  const keys = Object.keys(L).filter(k => k !== 'map');
  return `{\n${keys.map(k => `  ${JSON.stringify(k)}: ${val(L[k], '  ')}`).join(',\n')}\n}\n`;
}
// level maps (src/levels/*/map.txt) go into the bundle run-length encoded, unpacked by
// unpackMap() in src/levels/palette.js: a fifth of the size in the offline cache and the app
const levelMaps = {
  name: 'level-maps-rle',
  transform(code, id) {
    if (!/\/src\/levels\/[^/]+\/map\.txt\?raw$/.test(id)) return null;
    const text = JSON.parse(code.replace(/^export default /, '').replace(/;?\s*$/, ''));
    const rows = text.replace(/\r/g, '').split('\n');
    const rle = rows.map(r => r.replace(/(.)\1*/g, m => (m.length > 1 ? m.length : '') + m[0])).join('\n');
    return { code: `export default ${JSON.stringify('RLE1:' + rle)};`, map: null };
  },
};
// dev server only: the level editor (editor.html) saves to src/levels/<id>/
const levelEditor = {
  name: 'level-editor-save',
  apply: 'serve',
  configureServer(server) {
    server.middlewares.use('/__levels/save', (req, res) => {
      if (req.method !== 'POST') return res.writeHead(405).end();
      let body = '';
      req.on('data', c => (body += c));
      req.on('end', () => {
        try {
          const { level, map } = JSON.parse(body);
          if (!/^[a-z0-9-]{2,40}$/.test(level.id)) throw new Error('bad id');
          const dir = new URL(`./src/levels/${level.id}/`, import.meta.url);
          mkdirSync(dir, { recursive: true });
          writeFileSync(new URL('level.json', dir), levelJson(level));
          writeFileSync(new URL('map.txt', dir), map);
          const orderFile = new URL('./src/levels/order.json', import.meta.url),
            order = JSON.parse(readFileSync(orderFile, 'utf8'));
          if (!order.includes(level.id)) writeFileSync(orderFile, JSON.stringify([...order, level.id]) + '\n');
          res.writeHead(200, { 'content-type': 'application/json' }).end('{"ok":true}');
        } catch (e) {
          res.writeHead(400, { 'content-type': 'application/json' }).end(JSON.stringify({ error: e.message }));
        }
      });
    });
  },
};

export default defineConfig({
  base: './',
  define: { __APP_VERSION__: JSON.stringify(VERSION) },
  build: { rollupOptions: {} },
  plugins: [
    levelMaps,
    levelEditor,
    // version.json lets installed apps and cached pages find out that a newer version exists
    {
      name: 'version-json',
      generateBundle() {
        this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ version: VERSION }) });
      },
    },
    VitePWA({
      injectRegister: null,
      registerType: 'prompt',
      includeAssets: ['icons/favicon.png', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'Flintworks',
        short_name: 'Flintworks',
        description: 'Grabe, baue und sprenge dich durch eine Pixelwelt.',
        lang: 'de',
        display: 'fullscreen',
        display_override: ['fullscreen', 'standalone'],
        orientation: 'landscape',
        background_color: '#1a120c',
        theme_color: '#1a120c',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,woff2}'],
      },
    }),
  ],
});
