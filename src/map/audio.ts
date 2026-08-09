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

// A soft little munch tick — three of these in a row reads as nibbling.
export function playNibble(): void {
  const ac = ensureCtx();
  if (!ac) return;
  const t = ac.currentTime;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(320, t);
  osc.frequency.exponentialRampToValueAtTime(180, t + 0.07);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.05, t + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
  osc.connect(gain).connect(ac.destination);
  osc.start(t);
  osc.stop(t + 0.1);
}

// A gentle descending "aww" — the hungry rabbit shrinking a notch.
export function playShrink(): void {
  const ac = ensureCtx();
  if (!ac) return;
  const t = ac.currentTime;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(280, t);
  osc.frequency.exponentialRampToValueAtTime(150, t + 0.25);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.04, t + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
  osc.connect(gain).connect(ac.destination);
  osc.start(t);
  osc.stop(t + 0.32);
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
