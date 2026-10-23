// World types: each new world is a meadow, a desert or a winter landscape.
import { G } from './state.js';
import { setGroundTop } from './world.js';

const BIOMES = {
  meadow: {
    name: 'Wiese',
    top: ['#5f9a3c', '#6fae4a', '#558a34', '#79b955'],
    hills: ['#b7cddc', '#8fb0a6'],
    rock: '#a9bed3',
    snowLine: 0.72,
    sky: [
      [111, 169, 222],
      [215, 234, 242],
    ],
    trees: 28,
    rain: 1,
  },
  desert: {
    name: 'Wüste',
    top: ['#c8b06a', '#d4bc78', '#bca360', '#dcc584'],
    hills: ['#e6cf9c', '#d6b57a'],
    rock: '#cf9f7a',
    snowLine: 2,
    sky: [
      [96, 160, 220],
      [244, 226, 186],
    ],
    trees: 12,
    rain: 0.25,
  },
  winter: {
    name: 'Winter',
    top: ['#e8eef4', '#f4f8fb', '#dde5ee', '#ffffff'],
    hills: ['#dfe8f0', '#bccbd9'],
    rock: '#b8c8da',
    snowLine: 0.4,
    sky: [
      [140, 176, 214],
      [228, 236, 244],
    ],
    trees: 24,
    rain: 1,
  },
};
const biome = () => BIOMES[G.biome] || BIOMES.meadow;
function setBiome(name) {
  G.biome = name;
  setGroundTop(biome().top);
}

export { BIOMES, biome, setBiome };
