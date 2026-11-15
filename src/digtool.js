// Soft ground always uses the starting shovel, even after buying a better pick.
// Only rock uses the steel/diamond pick. This is a visual choice: diggable()
// continues to enforce research, purchased tools and the deep-rock gate.
import { ROCK, GRANITE } from './world.js';
const digTool = material => material === ROCK || material === GRANITE ? 'pick' : 'shovel';
export { digTool };
