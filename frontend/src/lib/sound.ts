/**
 * Lightweight sound effects via the Web Audio API.
 *
 * Tones are synthesized on the fly (no audio asset files) to keep the single
 * LAN container small. Playback is gated by a persisted mute flag exposed through
 * a zustand store so the header toggle and the play helpers share one state.
 *
 * The AudioContext is created lazily on first use — playback is always triggered
 * by a user gesture (claim/redeem/flip), satisfying browser autoplay policies.
 */

import { create } from 'zustand';

const STORAGE_KEY = 'padelerodouleies.sound-muted';

interface SoundState {
  muted: boolean;
  toggleMuted: () => void;
}

function readMuted(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export const useSoundStore = create<SoundState>((set, get) => ({
  muted: readMuted(),
  toggleMuted: () => {
    const muted = !get().muted;
    try {
      localStorage.setItem(STORAGE_KEY, String(muted));
    } catch {
      // Ignore storage failures (private mode); state still updates in-memory.
    }
    set({ muted });
  },
}));

type AudioContextCtor = typeof AudioContext;

let ctx: AudioContext | null = null;

/** Lazily create (and resume) a shared AudioContext, or null if unsupported (e.g. jsdom). */
function audioCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor: AudioContextCtor | undefined =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioContextCtor }).webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx) {
    try {
      ctx = new Ctor();
    } catch {
      return null;
    }
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

interface Tone {
  freq: number;
  /** Seconds from the start of the sequence. */
  delay?: number;
  duration?: number;
  type?: OscillatorType;
  gain?: number;
}

function playTones(tones: Tone[]): void {
  if (useSoundStore.getState().muted) return;
  const ac = audioCtx();
  if (!ac) return;
  const start = ac.currentTime;
  for (const tone of tones) {
    const osc = ac.createOscillator();
    const gainNode = ac.createGain();
    osc.type = tone.type ?? 'sine';
    osc.frequency.value = tone.freq;
    const t0 = start + (tone.delay ?? 0);
    const t1 = t0 + (tone.duration ?? 0.15);
    const peak = tone.gain ?? 0.18;
    gainNode.gain.setValueAtTime(0.0001, t0);
    gainNode.gain.exponentialRampToValueAtTime(peak, t0 + 0.012);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, t1);
    osc.connect(gainNode).connect(ac.destination);
    osc.start(t0);
    osc.stop(t1 + 0.02);
  }
}

/** Rising two-note chirp when a chore is claimed. */
export function playClaim(): void {
  playTones([
    { freq: 587.33, delay: 0, duration: 0.12 }, // D5
    { freq: 880.0, delay: 0.1, duration: 0.16 }, // A5
  ]);
}

/** Bright ascending triad when a reward is redeemed. */
export function playReward(): void {
  playTones([
    { freq: 523.25, delay: 0, duration: 0.14 }, // C5
    { freq: 659.25, delay: 0.11, duration: 0.14 }, // E5
    { freq: 783.99, delay: 0.22, duration: 0.22 }, // G5
  ]);
}

/** Short soft tick when a card is flipped. */
export function playFlip(): void {
  playTones([{ freq: 440, delay: 0, duration: 0.08, type: 'triangle', gain: 0.12 }]);
}

/** One note per Simon pad (C major: C4 / E4 / G4 / C5). */
const SIMON_FREQS = [261.63, 329.63, 392.0, 523.25] as const;

export function playSimonPad(pad: number, duration = 0.3): void {
  const freq = SIMON_FREQS[pad];
  if (freq === undefined) throw new Error(`Invalid Simon pad index: ${pad}`);
  playTones([{ freq, delay: 0, duration, type: 'triangle', gain: 0.2 }]);
}

/** Quick high blip when a falling star is caught. */
export function playCatch(): void {
  playTones([{ freq: 987.77, delay: 0, duration: 0.07, type: 'sine', gain: 0.14 }]); // B5
}

/** Low descending buzz on a mistake / lost life. */
export function playWrong(): void {
  playTones([
    { freq: 196.0, delay: 0, duration: 0.16, type: 'square', gain: 0.08 }, // G3
    { freq: 146.83, delay: 0.14, duration: 0.24, type: 'square', gain: 0.08 }, // D3
  ]);
}

/** Short neutral blip for each countdown tick (3… 2… 1…). */
export function playCountTick(): void {
  playTones([{ freq: 440, delay: 0, duration: 0.12, type: 'triangle', gain: 0.16 }]);
}

/** Rising "go!" cue when a countdown ends and a timed round starts. */
export function playGo(): void {
  playTones([
    { freq: 659.25, delay: 0, duration: 0.1, type: 'triangle', gain: 0.2 }, // E5
    { freq: 987.77, delay: 0.1, duration: 0.2, type: 'triangle', gain: 0.2 }, // B5
  ]);
}

/** Triumphant ascending fanfare on exercise bundle completion. */
export function playSuccess(): void {
  playTones([
    { freq: 523.25, delay: 0, duration: 0.1 },    // C5
    { freq: 659.25, delay: 0.09, duration: 0.1 }, // E5
    { freq: 783.99, delay: 0.18, duration: 0.1 }, // G5
    { freq: 987.77, delay: 0.27, duration: 0.1 }, // B5
    { freq: 1046.5, delay: 0.36, duration: 0.35 }, // C6
  ]);
}

/**
 * A small set of cheerful "you got it!" jingles for the Learning Adventure
 * result screen. Each is short (≈1–1.4s) so the screen can auto-advance once it
 * finishes; `playWinTune` picks one at random so the celebration stays fresh.
 */
const WIN_TUNES: readonly Tone[][] = [
  // 1 — C-major climb with a little echo flourish.
  [
    { freq: 523.25, delay: 0, duration: 0.12, type: 'triangle' }, // C5
    { freq: 659.25, delay: 0.12, duration: 0.12, type: 'triangle' }, // E5
    { freq: 783.99, delay: 0.24, duration: 0.12, type: 'triangle' }, // G5
    { freq: 1046.5, delay: 0.36, duration: 0.16, type: 'triangle' }, // C6
    { freq: 783.99, delay: 0.56, duration: 0.1, type: 'triangle' }, // G5
    { freq: 1046.5, delay: 0.66, duration: 0.34, type: 'triangle', gain: 0.22 }, // C6
  ],
  // 2 — bouncy G-major skip.
  [
    { freq: 392.0, delay: 0, duration: 0.12, type: 'triangle' }, // G4
    { freq: 493.88, delay: 0.12, duration: 0.12, type: 'triangle' }, // B4
    { freq: 587.33, delay: 0.24, duration: 0.12, type: 'triangle' }, // D5
    { freq: 783.99, delay: 0.36, duration: 0.16, type: 'triangle' }, // G5
    { freq: 587.33, delay: 0.54, duration: 0.1, type: 'triangle' }, // D5
    { freq: 783.99, delay: 0.64, duration: 0.32, type: 'triangle', gain: 0.22 }, // G5
  ],
  // 3 — playful "da-da-da-daa" with a high finish.
  [
    { freq: 659.25, delay: 0, duration: 0.1, type: 'triangle' }, // E5
    { freq: 659.25, delay: 0.16, duration: 0.1, type: 'triangle' }, // E5
    { freq: 523.25, delay: 0.32, duration: 0.1, type: 'triangle' }, // C5
    { freq: 659.25, delay: 0.46, duration: 0.1, type: 'triangle' }, // E5
    { freq: 783.99, delay: 0.6, duration: 0.14, type: 'triangle' }, // G5
    { freq: 1046.5, delay: 0.8, duration: 0.36, type: 'triangle', gain: 0.22 }, // C6
  ],
  // 4 — sparkly rising arpeggio.
  [
    { freq: 523.25, delay: 0, duration: 0.1, type: 'triangle' }, // C5
    { freq: 587.33, delay: 0.1, duration: 0.1, type: 'triangle' }, // D5
    { freq: 659.25, delay: 0.2, duration: 0.1, type: 'triangle' }, // E5
    { freq: 783.99, delay: 0.3, duration: 0.1, type: 'triangle' }, // G5
    { freq: 880.0, delay: 0.4, duration: 0.1, type: 'triangle' }, // A5
    { freq: 1046.5, delay: 0.5, duration: 0.36, type: 'triangle', gain: 0.22 }, // C6
  ],
];

/** Longest win tune, in ms — callers use it to time an auto-advance. */
export const WIN_TUNE_MAX_MS = 1200;

/** Play a random winning jingle (Learning Adventure correct-answer screen). */
export function playWinTune(rng: () => number = Math.random): void {
  const tune = WIN_TUNES[Math.floor(rng() * WIN_TUNES.length)] ?? WIN_TUNES[0]!;
  playTones(tune);
}
