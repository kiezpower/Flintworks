// Whether the 2.5D look is on, and the solid / liquid checks the ground's depth pass needs for any
// cell map (the world, the lobby's work yard, the crystal tunnel, level previews, the blasting
// range). Small on purpose: those screens import it without the game's drawing code.
import { G } from './state.js';
import { LIQ, SOLID } from './world.js';

// (G.depth follows the option from the start of the game on: settings.js applyDepth, main.js)
const depthOn = () => G.depth !== false;
const solidOf = cells => i => SOLID[cells[i]] === 1;
const liquidOf = cells => i => LIQ[cells[i]] === 1;
// the extra fields for drawTerrainArt / paintTerrainOnce
const depthOf = cells => ({ depth: depthOn(), solid: solidOf(cells), liquid: liquidOf(cells) });

export { depthOf, depthOn, liquidOf, solidOf };
