# Painted mobility and work animations

Six transparent 1024×1536 atlases, one per hero. Four columns are animation
phases; rows are jump, fall, climb, ceiling hang, hammer/build and woodcut.
Each frame is painted at native detail rather than enlarged from a pixel sprite.

`atlas.json` contains body bounds, red-cap positions and a fixed grounded pivot
per hero. All 24 phases share their hero's scale and pivot: tucked feet rise
during a jump instead of being artificially pinned to the ground. Hats follow
the animated head. Collision boxes and gameplay remain unchanged.

`mineractions.js` selects poses from existing movement/work state, respecting
throw/grapple priority and reduced motion. Missing atlases use the hero's painted
idle frame; the original pixel renderer remains the final fallback.
