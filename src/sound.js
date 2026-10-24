import { cam } from './render.js';
import { G } from './state.js';
import { clamp, rnd } from './world.js';

// ---- Sound (WebAudio, synthesized) ----
G.AC = null;
G.MG = null;
G.NB = null;
function audioInit() {
  if (G.AC) return;
  try {
    G.AC = new (window.AudioContext || window.webkitAudioContext)();
    G.MG = G.AC.createGain();
    G.MG.gain.value = 0.5;
    G.MG.connect(G.AC.destination);
    G.NB = G.AC.createBuffer(1, G.AC.sampleRate, G.AC.sampleRate);
    const d = G.NB.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = rnd() * 2 - 1;
  } catch {
    G.AC = null;
  }
}
function nz(t0, dur, f0, f1, vol, type = 'lowpass') {
  const s = G.AC.createBufferSource();
  s.buffer = G.NB;
  const f = G.AC.createBiquadFilter();
  f.type = type;
  f.frequency.setValueAtTime(f0, t0);
  f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t0 + dur);
  const g = G.AC.createGain();
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  s.connect(f).connect(g).connect(G.MG);
  s.start(t0, rnd() * 0.5);
  s.stop(t0 + dur + 0.02);
}
function tn(t0, type, f0, f1, dur, vol) {
  const o = G.AC.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f0, t0);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
  const g = G.AC.createGain();
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  o.connect(g).connect(G.MG);
  o.start(t0);
  o.stop(t0 + dur + 0.02);
}
function sfx(n, x, y, k = 1) {
  if (!G.AC || G.muted || G.AC.state !== 'running') return;
  let v = 1;
  if (x !== undefined) {
    const d = Math.hypot(x - (cam.x + G.VW / 2), y - (cam.y + G.VH / 2));
    v = clamp(1 - d / (G.VW * 0.9), 0, 1);
    if (v <= 0) return;
  }
  v *= k;
  const t = G.AC.currentTime;
  switch (n) {
    case 'dig':
      nz(t, 0.07, 900, 300, 0.1 * v);
      break;
    // each material sounds a little different under the shovel
    case 'digSand':
      nz(t, 0.11, 2400, 900, 0.06 * v, 'bandpass');
      break;
    case 'digRock':
      tn(t, 'square', 1500 + rnd() * 400, 900, 0.03, 0.035 * v);
      nz(t, 0.05, 3500, 1800, 0.08 * v, 'bandpass');
      break;
    case 'ting':
      tn(t, 'triangle', 1760 + rnd() * 300, 2400, 0.09, 0.05 * v);
      break;
    case 'fanfare':
      [523, 659, 784, 1047].forEach((f, k) => tn(t + k * 0.11, 'square', f, f, k === 3 ? 0.35 : 0.1, 0.05));
      tn(t + 0.33, 'triangle', 523, 523, 0.4, 0.06);
      break;
    case 'boom':
      nz(t, 1.1, 1800, 50, 0.9 * v);
      tn(t, 'sine', 95, 30, 0.7, 0.6 * v);
      break;
    case 'jump':
      tn(t, 'square', 260, 520, 0.07, 0.035 * v);
      break;
    case 'coin':
      tn(t, 'square', 988, 988, 0.06, 0.05);
      tn(t + 0.07, 'square', 1319, 1319, 0.12, 0.05);
      break;
    case 'chop':
      nz(t, 0.05, 3000, 1200, 0.25 * v, 'bandpass');
      tn(t, 'triangle', 190, 110, 0.07, 0.15 * v);
      break;
    case 'hammer':
      tn(t, 'square', 700, 320, 0.04, 0.04 * v);
      nz(t, 0.03, 4000, 2500, 0.08 * v, 'highpass');
      break;
    case 'splash':
      nz(t, 0.3, 2500, 400, 0.2 * v);
      break;
    case 'hurt':
      tn(t, 'sawtooth', 320, 110, 0.16, 0.08 * v);
      break;
    case 'thud':
      nz(t, 0.3, 500, 60, 0.5 * v);
      tn(t, 'sine', 80, 40, 0.25, 0.35 * v);
      break;
    case 'pick':
      tn(t, 'triangle', 660, 990, 0.06, 0.07 * v);
      break;
    case 'throw':
      nz(t, 0.12, 600, 1800, 0.08 * v, 'bandpass');
      break;
    case 'clack':
      tn(t, 'square', 1200, 600, 0.03, 0.04 * v);
      nz(t, 0.04, 3000, 2000, 0.07 * v, 'bandpass');
      break;
    case 'creak':
      tn(t, 'sawtooth', 110, 70, 0.6, 0.06 * v);
      break;
    case 'done':
      tn(t, 'triangle', 523, 523, 0.1, 0.08);
      tn(t + 0.1, 'triangle', 659, 659, 0.1, 0.08);
      tn(t + 0.2, 'triangle', 784, 784, 0.18, 0.08);
      break;
    case 'growl':
      tn(t, 'sawtooth', 85, 55, 0.5, 0.12 * v);
      nz(t, 0.5, 300, 120, 0.15 * v);
      break;
    case 'hiss':
      nz(t, 0.4, 5000, 2000, 0.12 * v, 'highpass');
      break;
    case 'lift':
      tn(t, 'square', 140, 140, 0.03, 0.025 * v);
      break;
    case 'pump':
      nz(t, 0.12, 600, 300, 0.05 * v);
      break;
    case 'crackle':
      nz(t, 0.08, 4000, 1500, 0.06 * v, 'bandpass');
      nz(t + 0.05, 0.05, 3000, 1200, 0.04 * v, 'bandpass');
      break;
    case 'thunder':
      nz(t, 1.8, 900, 40, 0.7);
      nz(t + 0.15, 1.4, 400, 30, 0.5);
      break;
    case 'whoosh':
      nz(t, 1.2, 300, 2500, 0.15, 'bandpass');
      break;
    case 'saw':
      nz(t, 0.25, 3500, 2500, 0.06 * v, 'bandpass');
      tn(t, 'sawtooth', 420, 380, 0.25, 0.02 * v);
      break;
    case 'bow':
      nz(t, 0.1, 1200, 3000, 0.08 * v, 'bandpass');
      tn(t, 'triangle', 300, 600, 0.05, 0.05 * v);
      break;
    case 'fuse':
      nz(t, 0.6, 6000, 3000, 0.06 * v, 'highpass');
      break;
  }
}

// short vibration on phones for hits and blasts
function buzz(ms) {
  if (G.muted || !navigator.vibrate) return;
  try {
    navigator.vibrate(ms);
  } catch {}
}
export { buzz, audioInit, nz, sfx, tn };
