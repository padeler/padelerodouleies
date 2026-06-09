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
