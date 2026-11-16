# Painted adventure artwork

Generated for Flintworks from the approved storybook lobby concept, November 2026.
These are local game assets, bundled and precached for web/PWA and Android; there
is no runtime image-generation service or external font/image dependency.

- `valley.png`, `desert.png`, `winter.png`: scenery plates without baked controls
  or characters. Used by `sceneart.js` in both lobby and game. Autumn reuses the
  golden valley plate; seasonal foreground trees still change independently.
- `objects.png`: transparent 4×2 atlas (1774×887). Castle, hut, sawmill, shop;
  furnace, lift tower, pine, oak. Tight frame bounds live in `objectart.js`.

The eight cutouts are rendered into the existing sprite footprints: placement,
collision, growth stages and building interactions keep their existing geometry.
Building styles recolour the high-resolution wood while retaining warm lights.
Spring/autumn oaks use the high-resolution seasonal palette. Snow pines, bare
winter trees, cacti, seedlings and buildings absent from this atlas retain the
procedural artwork. Missing images also fall back to the procedural renderer.

The editable ore/tunnel map and working lobby miners remain live. The lobby's
soil and podium use native-resolution vector shading over that same map. In-game
diggable terrain and some smaller effects/UI pictograms still use the existing
material renderer; this release does not replace every game asset.
