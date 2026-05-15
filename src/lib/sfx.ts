// Synthetic sound effects via Web Audio — keeps the bundle asset-free.
// Each effect lazily creates an AudioContext on the first user gesture and
// reuses it. Browsers block AudioContext until a user gesture, so we expect
// callers to fire these from click handlers.

let ctx: AudioContext | null = null;
function ac(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const Ctor = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!Ctor) return null;
    try { ctx = new Ctor(); } catch { return null; }
  }
  if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

// Launch whoosh — pitch sweeps up then down with white-noise hiss.
export function playLaunch(durationMs = 1400) {
  const a = ac(); if (!a) return;
  const now = a.currentTime;
  const dur = durationMs / 1000;

  // Pitched sweep
  const osc = a.createOscillator();
  const oscGain = a.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(120, now);
  osc.frequency.exponentialRampToValueAtTime(1400, now + dur * 0.4);
  osc.frequency.exponentialRampToValueAtTime(80, now + dur);
  oscGain.gain.setValueAtTime(0.0001, now);
  oscGain.gain.exponentialRampToValueAtTime(0.18, now + 0.05);
  oscGain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
  osc.connect(oscGain).connect(a.destination);
  osc.start(now); osc.stop(now + dur + 0.05);

  // White noise hiss for the rocket exhaust
  const bufferSize = Math.floor(a.sampleRate * dur);
  const buf = a.createBuffer(1, bufferSize, a.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * 0.6;
  const noise = a.createBufferSource(); noise.buffer = buf;
  const noiseGain = a.createGain();
  noiseGain.gain.setValueAtTime(0.0001, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.12, now + 0.06);
  noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
  const bp = a.createBiquadFilter();
  bp.type = 'bandpass'; bp.frequency.value = 1800; bp.Q.value = 0.6;
  noise.connect(bp).connect(noiseGain).connect(a.destination);
  noise.start(now); noise.stop(now + dur);
}

// Impact boom — low rumble + crack.
export function playImpact() {
  const a = ac(); if (!a) return;
  const now = a.currentTime;

  // Sub-bass thump
  const sub = a.createOscillator();
  const subGain = a.createGain();
  sub.type = 'sine';
  sub.frequency.setValueAtTime(220, now);
  sub.frequency.exponentialRampToValueAtTime(30, now + 0.5);
  subGain.gain.setValueAtTime(0.6, now);
  subGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.7);
  sub.connect(subGain).connect(a.destination);
  sub.start(now); sub.stop(now + 0.75);

  // Crack: short white-noise burst
  const dur = 0.6;
  const buf = a.createBuffer(1, Math.floor(a.sampleRate * dur), a.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    const env = Math.exp(-i / (a.sampleRate * 0.15));
    data[i] = (Math.random() * 2 - 1) * env;
  }
  const noise = a.createBufferSource(); noise.buffer = buf;
  const g = a.createGain(); g.gain.value = 0.5;
  const hp = a.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 500;
  noise.connect(hp).connect(g).connect(a.destination);
  noise.start(now); noise.stop(now + dur);
}
