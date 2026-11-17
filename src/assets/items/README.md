# Painted items and interface icons

Generated for Flintworks in the approved storybook direction (variant A of
`docs/monster-varianten/`), November 2026. Bundled locally and precached.

- `atlas.png` / `atlas.json` (600×400): the 21 item types of `ITEM` in
  `sprites.js`, plus `chest`, `chestOpen` and `hoard`.
- `ui.png` / `ui.json` (600×500): 30 interface icons – the 25 kinds of
  `PAD_ICONS` (buttons, tools, research, modes) and `catapult`, `drill`,
  `train`, `raft`, `target` for the build menu.
- `props.png` / `props.json` (800×400, built with `CELL=200`): larger things of
  the world – the merchant (standing and two steps), gravestone, shrine,
  cable-car mast, gondola and drill wagon.
- Each JSON entry is `[x, y, width, height]` of a tightly cropped picture.
- `build.py` rebuilds an atlas from a sheet, for example:
  `python3 build.py ../../../docs/monster-varianten/A-zusatz-icons.png 6 5 ui dig jump …`
  (the names in reading order; the icon sheet's sixteenth name is `chest`).

`itemart.js` loads both atlases before the game's modules start, so icons
cached at start-up are the painted ones. Items in the world keep their size and
physics and are drawn standing on their box; menus and the HUD get square icons
marked `painted`, shown without pixel scaling. Buildings in the build menu use
the cut-outs of `objectart.js`, the riding Fluffel the creature atlas. Without
the atlases the pixel icons of `sprites.js` are drawn. Raft, riding Fluffel, airship, mine train, lorry, drill wagon, mast and gondola
are painted in the world too. Still procedural: the catapult (its arm aims) and
the archery target, fluids and effects.
