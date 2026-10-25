import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { readFileSync } from 'node:fs';

// version shown in the lobby and menu: bump it in package.json with every change
const VERSION = JSON.parse(readFileSync(new URL('./package.json', import.meta.url))).version;

export default defineConfig({
  base: './',
  define: { __APP_VERSION__: JSON.stringify(VERSION) },
  build: { rollupOptions: {} },
  plugins: [
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
