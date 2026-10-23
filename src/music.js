// Generative background music: soft pads, bass and a wandering pentatonic melody.
// Three moods: bright in the lobby, calm on the surface, dark minor in caves.
import { P } from './profile.js';
import { G } from './state.js';

const EIGHTH = 60 / 96 / 2;
const SONGS = {
  lobby: {
    chords: [
      [48, 52, 55],
      [43, 47, 50],
      [45, 48, 52],
      [41, 45, 48],
    ],
    scale: [60, 62, 64, 67, 69, 72, 74, 76],
    density: 0.55,
    hat: true,
  },
  game: {
    chords: [
      [48, 52, 55],
      [45, 48, 52],
      [41, 45, 48],
      [43, 47, 50],
    ],
    scale: [60, 62, 64, 67, 69, 72, 74],
    density: 0.3,
  },
  cave: {
    chords: [
      [45, 48, 52],
      [41, 45, 48],
      [38, 41, 45],
      [40, 44, 47],
    ],
    scale: [57, 60, 62, 64, 67, 69, 72],
    density: 0.18,
  },
};
const hz = m => 440 * 2 ** ((m - 69) / 12);
let bus = null,
  next = 0,
  step = 0,
  mel = 3;

function voice(t, f, dur, vol, type, attack) {
  const o = G.AC.createOscillator();
  o.type = type;
  o.frequency.value = f;
  const g = G.AC.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(bus);
  o.start(t);
  o.stop(t + dur + 0.05);
}
function hat(t) {
  const s = G.AC.createBufferSource();
  s.buffer = G.NB;
  const f = G.AC.createBiquadFilter();
  f.type = 'highpass';
  f.frequency.value = 7000;
  const g = G.AC.createGain();
  g.gain.setValueAtTime(0.025, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
  s.connect(f).connect(g).connect(bus);
  s.start(t, Math.random() * 0.5);
  s.stop(t + 0.06);
}
function play(song, n, t) {
  const S = SONGS[song];
  const chord = S.chords[Math.floor(n / 16) % S.chords.length];
  if (n % 16 === 0) for (const m of chord) voice(t, hz(m), EIGHTH * 16, 0.035, 'sine', 0.6);
  if (n % 4 === 0) voice(t, hz(chord[n % 8 === 0 ? 0 : 2] - 12), EIGHTH * 3.5, 0.09, 'triangle', 0.02);
  if (S.hat && n % 2 === 1) hat(t);
  if (Math.random() < S.density) {
    mel = Math.max(0, Math.min(S.scale.length - 1, mel + [-2, -1, -1, 1, 1, 2][Math.floor(Math.random() * 6)]));
    // strong beats snap to a chord tone
    let m = S.scale[mel];
    if (n % 4 === 0) m = chord.map(c => c + 12).reduce((a, b) => (Math.abs(b - m) < Math.abs(a - m) ? b : a));
    voice(t, hz(m), EIGHTH * (Math.random() < 0.3 ? 3 : 1.6), 0.05, 'triangle', 0.01);
  }
}
// called every frame with the current mood
function updMusic(song) {
  if (!G.AC || G.AC.state !== 'running') return;
  const on = !G.muted && P.music !== false;
  if (!bus) {
    bus = G.AC.createGain();
    bus.connect(G.MG);
  }
  const now = G.AC.currentTime;
  bus.gain.setTargetAtTime(on ? 0.8 : 0, now, 0.3);
  if (!on) return;
  if (next < now) next = now + 0.05;
  while (next < now + 0.3) {
    play(song, step++, next);
    next += EIGHTH;
  }
}

export { updMusic };
