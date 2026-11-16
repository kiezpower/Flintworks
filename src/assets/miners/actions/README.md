# Throw and grappling-hook actions

Six generated, reference-matched painted atlases (2172×724, 6 columns × 2 rows).
Top row: wind-up, raised wind-up, release, follow-through, recovery, neutral.
Bottom row: aim, launch, hold, pull, reach/pull, return. All hands are empty so
projectiles and rope stay separate live entities. `atlas.json` records measured
connected-body bounds, foot pivots, stable scale and approximate rope-hand points.
The ordinary character atlases and their metadata remain unchanged.

`mineractions.js` chooses cosmetic poses. An aimed toss shows the wind-up and held
item; an immediate throw starts at release and follows through for 24 ticks. No
projectile delay, new cooldown, inventory change or movement change is introduced.
Hook phases drive launch, hold, pull and return. Reduced motion holds one pose.
Death/tumbling/vehicles take priority. Aim may turn the drawn body without changing
simulation facing. Existing hats, cap colours and outfits remain supported.

Snapshots add optional throw age (`ta`) and optional hook phase/age after the two
existing hook coordinates. Older snapshots/clients still work; no absolute host
clock is sent. The rope renderer uses the displayed hand, while hook collision,
origin and pulling physics retain their existing values. Missing action PNGs use
the original illustrated idle frames, then the existing procedural fallback.
