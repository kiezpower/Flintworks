# Painted adventure artwork

Generated for Flintworks from the approved storybook art direction, November 2026.
All images and fonts are bundled locally and precached for web/PWA and Android.

- `valley.png`, `desert.png`, `winter.png`: scenery without baked controls or
  characters. Autumn reuses the golden valley; foreground trees change seasonally.
- `objects.png`: transparent 4×2 atlas (1774×887): castle, hut, sawmill, shop,
  furnace, lift, pine and oak.
- `details.png`: transparent 4×4 atlas (1278×1230): pump, windmill body, chemistry
  workshop, tower; gate, field, grain-mill body, chest; cauldron, wall, lintel,
  cannon carriage; flag, bare winter oak, snow pine and cactus. Measured cutouts
  live in `objectart.js`. Gate/field/flag/carriage frames are reserved: their live
  variants retain procedural geometry so opening, growth and aiming remain clear.
- `materials.png`: opaque 4×3 atlas (1448×1086): earth, rock, gold, sand; granite,
  loam, copper ore, coal; timber, cyan crystal, cave back wall, moss/turf.

`terrainart.js` projects textures through the real material masks. A mirrored
pattern removes seams at swatch edges. Only visible 32-cell chunks are painted at
4 samples per cell, with a 192-chunk LRU (at most 12 MiB of chunk pixel storage).
Digging, drying and flowing materials invalidate the same affected chunks as the
existing renderer; palette changes, world switches and resizing clear the cache.
The old tiled buffer remains for liquids/glass and missing-file fallback. Existing
lighting, vein rims, wetness and depth shading transfer onto the painted materials;
optional accessibility marks distinguish the four find types. This is a rendering
layer: it does not alter physics, maps, seeds, saves, networking or tool rules.

Building and tree cutouts keep the original footprints and growth-stage sizes.
Wood styles preserve lights/fire. Seasonal oaks, snow pines and grown cacti now
use the painted art; seedlings keep the procedural fallback. NPC helpers use the
existing illustrated character sheets without changing saved identities or roles.
Native canvas curves draw small plants, cave decor, props, wires, flags, gate
leaves and rotating sails. The game still includes procedural item/HUD icons,
creatures, fluids and effects; this release does not replace every visual asset.
