// Coin-blip sound effects, synthesized with the Web Audio API — no audio
// assets. Consecutive pops climb a pentatonic scale like a combo counter,
// resetting after a couple of quiet seconds.

let ctx: AudioContext | null = null;
let comboStep = 0;
let lastPopAt = 0;
let muted = localStorage.getItem('rhm-muted') === '1';

export function isMuted(): boolean {
  return muted;
}

export function setMuted(m: boolean): void {
  muted = m;
  localStorage.setItem('rhm-muted', m ? '1' : '0');
}

function ensureCtx(): AudioContext | null {
  if (muted) return null;
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

// Semitone offsets of a major pentatonic run — everything sounds cheerful.
const SCALE = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];
const BASE_FREQ = 523.25; // C5

export function playPop(): void {
  const ac = ensureCtx();
  if (!ac) return;
  const now = performance.now();
  if (now - lastPopAt > 2000) comboStep = 0;
  lastPopAt = now;
  const step = SCALE[Math.min(comboStep, SCALE.length - 1)];
  comboStep++;
  coinBlip(ac, BASE_FREQ * Math.pow(2, step / 12));
}

// A short metallic hit — two square oscillators at an inharmonic ratio.
// Three of these in a row reads as wrench cranks on a crate.
export function playClank(): void {
  const ac = ensureCtx();
  if (!ac) return;
  const t = ac.currentTime;
  const osc1 = ac.createOscillator();
  const osc2 = ac.createOscillator();
  const gain = ac.createGain();
  osc1.type = 'square';
  osc1.frequency.setValueAtTime(520, t);
  osc1.frequency.exponentialRampToValueAtTime(400, t + 0.05);
  osc2.type = 'square';
  osc2.frequency.setValueAtTime(707, t); // inharmonic against osc1 — reads as metal
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.06, t + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
  osc1.connect(gain);
  osc2.connect(gain);
  gain.connect(ac.destination);
  osc1.start(t);
  osc2.start(t);
  osc1.stop(t + 0.12);
  osc2.stop(t + 0.12);
}

// New armor bolting on: a servo spin-up topped with a bright coin "ding".
export function playPowerup(): void {
  const ac = ensureCtx();
  if (!ac) return;
  const t = ac.currentTime;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(80, t);
  osc.frequency.exponentialRampToValueAtTime(160, t + 0.1);
  osc.frequency.exponentialRampToValueAtTime(330, t + 0.35);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.07, t + 0.04);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
  osc.connect(gain).connect(ac.destination);
  osc.start(t);
  osc.stop(t + 0.6);
  // The "ding" lands right as the servo peaks.
  const ding = ac.createOscillator();
  const dingGain = ac.createGain();
  ding.type = 'square';
  ding.frequency.setValueAtTime(1318.5, t + 0.35); // E6
  dingGain.gain.setValueAtTime(0.0001, t + 0.35);
  dingGain.gain.exponentialRampToValueAtTime(0.06, t + 0.37);
  dingGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
  ding.connect(dingGain).connect(ac.destination);
  ding.start(t + 0.35);
  ding.stop(t + 0.72);
}

// A robotic sigh — the low-fuel rabbit powering down a notch.
export function playPowerdown(): void {
  const ac = ensureCtx();
  if (!ac) return;
  const t = ac.currentTime;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(240, t);
  osc.frequency.exponentialRampToValueAtTime(90, t + 0.4);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.03, t + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
  osc.connect(gain).connect(ac.destination);
  osc.start(t);
  osc.stop(t + 0.47);
}

// Classic coin shape: a short tone that jumps up a fourth and rings out.
function coinBlip(ac: AudioContext, freq: number): void {
  const t = ac.currentTime;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = 'square';
  osc.frequency.setValueAtTime(freq, t);
  osc.frequency.setValueAtTime((freq * 4) / 3, t + 0.08);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.1, t + 0.012);
  gain.gain.setValueAtTime(0.1, t + 0.08);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
  osc.connect(gain).connect(ac.destination);
  osc.start(t);
  osc.stop(t + 0.55);
}
