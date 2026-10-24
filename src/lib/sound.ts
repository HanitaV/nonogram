/** Small synthesised sounds, so there are no audio files to load. */
let ctx: AudioContext | null = null;
/** Mirrors the sound setting so UI code can play a click without reading the store. */
let enabled = false;

export function setSoundEnabled(on: boolean): void {
  enabled = on;
}

function audio(): AudioContext | null {
  if (typeof window === 'undefined' || !('AudioContext' in window)) return null;
  ctx ??= new AudioContext();
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function tone(freq: number, start: number, dur: number, gain: number, type: OscillatorType = 'sine', slideTo?: number): void {
  const a = audio();
  if (!a) return;
  const o = a.createOscillator();
  const g = a.createGain();
  const t = a.currentTime + start;
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

let step = 0;
/** A soft pop whose pitch walks up a pentatonic scale as you paint. */
export function playTick(): void {
  const scale = [659.25, 739.99, 830.61, 987.77, 1108.73];
  tone(scale[step++ % scale.length]!, 0, 0.07, 0.04, 'triangle');
}

export function playClick(): void {
  if (enabled) tone(520, 0, 0.06, 0.03, 'triangle', 340);
}

export function playSolved(): void {
  const notes = [523.25, 659.25, 783.99, 1046.5, 1318.51];
  notes.forEach((f, i) => tone(f, i * 0.09, 0.6, 0.045, 'triangle'));
  tone(261.63, 0, 1.2, 0.04);
  tone(1567.98, 0.5, 0.9, 0.03);
}
