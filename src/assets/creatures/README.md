# Painted creatures

Generated for Flintworks in the approved storybook direction (variant A of
`docs/monster-varianten/`), November 2026. Bundled locally and precached.

- `atlas.png` (1536×811, transparent) with `atlas.json`: 27 cut-out frames.
  Each entry is `[x, y, width, height, anchorX]`; `anchorX` is the figure's
  centre of mass, so poses of different width do not jump sideways.
  - `fluffel`, `bat`, `monster`, `spider`, `slime`, `golem`: `idle`, `move`, `attack`
  - `fish`: `idle`, `move`
  - `queen`, `iceking`: `idle`, `attack`
  - `worm`: `idle` (the head) and `body` (one plate)
- `build.py` rebuilds both files from the two source sheets (needs Pillow and NumPy):
  `python3 build.py ../../../docs/monster-varianten/A-bilderbuch.png ../../../docs/monster-varianten/A-zusatz-bosse.png . 0.75`

`creatureart.js` draws a frame over the unchanged hitbox: standing creatures on
their feet, flyers, fish and the worm centred. The crystal beetle, spore
toadstool and shrine guardian recolour the spider, slime and golem. A hurt
flash and the companion's red collar are cached frame variants. If the atlas is
missing, the earlier pixel sprites are drawn. This is a rendering layer: sizes,
hit points, behaviour, saves and networking are unchanged.

## Walk cycles

`cycles.png` / `cycles.json` (1536×488): four phases (`walk0`…`walk3`) of the monster,
bat, spider, slime, golem and Fluffel, cut from `docs/monster-varianten/A-zusatz-laufzyklen.png`
by `build_cycles.py` and scaled to the idle picture's body size. Ground creatures step
through the phases with their distance (`a.anim`), the bat flaps with time, the slime
stretches in the air (`walk1` rising, `walk2` falling). Without the cycle atlas the two-phase
sway of the main atlas is used.
