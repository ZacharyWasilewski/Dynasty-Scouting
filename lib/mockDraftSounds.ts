"use client";

// Small set of synthesized sound effects for the Mock Draft tool, generated
// with the Web Audio API rather than external audio files (no network
// access to source real recordings). Swap these for real <audio> playback
// later if you'd rather use recorded sound effects — just replace the
// bodies of the three exported functions below and drop files in /public.

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AudioCtor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtor) return null;
  if (!audioCtx) {
    audioCtx = new AudioCtor();
  }
  if (audioCtx.state === "suspended") {
    // Browsers require a user gesture to start audio — every sound trigger
    // here (clicking a draft-type card, making a pick, a running timer
    // started by that same click) already happens after one.
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

function playTone(
  freq: number,
  durationMs: number,
  opts: { type?: OscillatorType; gain?: number; delayMs?: number; freqTo?: number } = {}
) {
  const ctx = getAudioContext();
  if (!ctx) return;
  const startAt = ctx.currentTime + (opts.delayMs ?? 0) / 1000;
  const endAt = startAt + durationMs / 1000;
  const osc = ctx.createOscillator();
  const gainNode = ctx.createGain();
  osc.type = opts.type ?? "sine";
  osc.frequency.setValueAtTime(freq, startAt);
  if (opts.freqTo !== undefined) {
    osc.frequency.exponentialRampToValueAtTime(opts.freqTo, endAt);
  }
  const peakGain = opts.gain ?? 0.15;
  gainNode.gain.setValueAtTime(0, startAt);
  gainNode.gain.linearRampToValueAtTime(peakGain, startAt + 0.008);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, endAt);
  osc.connect(gainNode);
  gainNode.connect(ctx.destination);
  osc.start(startAt);
  osc.stop(endAt + 0.02);
}

/**
 * Continuous rising pitch sweep into a bright, longer-ringing top "ding"
 * with a soft sustain layer underneath — deliberately longer overall
 * (~800ms) than playPickSound()'s short blip (~190ms), on top of already
 * having a different shape (glide + chime vs. two flat notes), so it
 * reads as a clearly bigger "alert" moment rather than a quick confirm.
 */
export function playOnClockSound() {
  playTone(350, 350, { type: "sine", gain: 0.11, freqTo: 700 }); // slow glide up
  playTone(1046.5, 450, { type: "sine", gain: 0.15, delayMs: 330 }); // bright ding, long ring
  playTone(1318.51, 400, { type: "sine", gain: 0.07, delayMs: 350 }); // soft harmonic layer for sustain
}

/** Short confirmation blip — plays for every pick made, user or computer. */
export function playPickSound() {
  playTone(392, 90, { type: "triangle", gain: 0.12 }); // G4
  playTone(523.25, 130, { type: "triangle", gain: 0.14, delayMs: 60 }); // C5
}

// Alternates a slightly brighter/duller filter frequency each call, like
// the tick/tock of a real analog clock instead of an identical beep twice.
let tickAlternate = false;

/**
 * Filtered white-noise burst — a real mechanical "tick" rather than a
 * pure tone. Plays once per second for the last 10 seconds of the pick
 * clock, alternating a slightly higher and lower click for a tick/tock feel.
 */
export function playTickSound() {
  const ctx = getAudioContext();
  if (!ctx) return;

  const duration = 0.035;
  const bufferSize = Math.max(1, Math.floor(ctx.sampleRate * duration));
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    const decay = Math.pow(1 - i / bufferSize, 2);
    data[i] = (Math.random() * 2 - 1) * decay;
  }

  const noise = ctx.createBufferSource();
  noise.buffer = buffer;

  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = tickAlternate ? 2600 : 3400;
  filter.Q.value = 1.4;
  tickAlternate = !tickAlternate;

  const gainNode = ctx.createGain();
  const startAt = ctx.currentTime;
  gainNode.gain.setValueAtTime(0.35, startAt);
  gainNode.gain.exponentialRampToValueAtTime(0.001, startAt + duration);

  noise.connect(filter);
  filter.connect(gainNode);
  gainNode.connect(ctx.destination);
  noise.start(startAt);
  noise.stop(startAt + duration + 0.01);
}
