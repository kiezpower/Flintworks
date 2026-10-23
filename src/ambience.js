// Background sounds: rain, wind, birds by day, crickets at night.
import { sel_ } from './entities.js';
import { tn } from './sound.js';
import { G } from './state.js';
import { darkness } from './weather.js';
import { W, clamp, rnd, surf } from './world.js';

let loops = null;
function noiseLoop(type, freq, q) {
  const s = G.AC.createBufferSource();
  s.buffer = G.NB;
  s.loop = true;
  const f = G.AC.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  const g = G.AC.createGain();
  g.gain.value = 0;
  s.connect(f).connect(g).connect(G.MG);
  s.start();
  return g;
}
const chirp = t => {
  const f = 2200 + rnd() * 900;
  for (let k = 0; k < 2 + Math.floor(rnd() * 3); k++) tn(t + k * 0.11, 'sine', f, f * 1.35, 0.07, 0.018);
};
const cricket = t => {
  for (let k = 0; k < 3; k++) tn(t + k * 0.05, 'square', 4300, 4250, 0.02, 0.006);
};

// called a few times per second
function updAmbience() {
  if (!G.AC || G.AC.state !== 'running') return;
  if (!loops) loops = { rain: noiseLoop('lowpass', 1400, 0.5), wind: noiseLoop('bandpass', 380, 0.8) };
  const c = sel_();
  const outside = !!c && c.y < surf[clamp(Math.floor(c.x), 0, W - 1)] + 12;
  const on = G.muted ? 0 : 1,
    t = G.AC.currentTime;
  loops.rain.gain.setTargetAtTime(
    on * (G.rainT > 0 && G.biome !== 'winter' ? (outside ? 0.12 : 0.035) : 0),
    t,
    0.8,
  );
  loops.wind.gain.setTargetAtTime(on * (outside ? 0.012 + G.wind * 0.03 : 0.004), t, 1.5);
  if (!on || !outside) return;
  const dark = darkness();
  if (dark < 0.2 && G.rainT === 0 && rnd() < 0.05) chirp(t);
  if (dark > 0.35 && rnd() < 0.1) cricket(t);
}

export { updAmbience };
