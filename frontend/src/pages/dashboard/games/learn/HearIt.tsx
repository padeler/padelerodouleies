import { useEffect, useRef, useState } from 'react';
import { Volume2 } from 'lucide-react';
import { useT } from '../../../../i18n/store';
import {
  FALLER_R,
  HEAR_H,
  HEAR_W,
  createHearWorld,
  fallerAt,
  removeFaller,
  stepHear,
  type Faller,
  type HearWorld,
} from './hearEngine';
import type { HearRound, RoundFeedback } from './learnEngine';

// How long a correctly-tapped (but not final) multi-target faller flashes
// green before the pulse fades, giving the kid a "got it, keep going" beat
// without freezing the still-running simulation.
const PULSE_MS = 300;

// How long the frozen, highlighted frame lingers after a tap/miss so the kid
// sees which faller was right (and which they picked) before the result panel.
const FREEZE_MS = 900;

/**
 * Listen (slot 1) — the action level. The target word is spoken on entry (via
 * the "find X" prompt) and replayable; the choices drift down the canvas and the
 * kid taps the one that matches what they heard. On a tap (or a miss, when the
 * target reaches the floor) the simulation freezes and highlights the correct
 * faller — green — and the kid's wrong pick — red — for a beat, then reports the
 * result so the shell can explain it.
 *
 * Canvas 2D + rAF over the pure `hearEngine`; glyphs are drawn as text (letters
 * and digits render everywhere, unlike emoji) on accent tiles for contrast.
 */
export function HearIt({
  round,
  onAnswer,
  playFind,
}: {
  round: HearRound;
  onAnswer: (correct: boolean, feedback: RoundFeedback) => void;
  playFind: (token: string) => void;
}) {
  const t = useT();
  const isMultiTarget = round.variant === 'multi-target';
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const worldRef = useRef<HearWorld>(createHearWorld(round.choices, Math.random, round.fallSpeedMult ?? 1.0, round.icons));
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef<number | null>(null);
  const answeredRef = useRef(false);
  // Once set, the simulation is frozen on this resolved outcome (the highlighted
  // faller the kid picked, or null on a miss) until `finish` reports it.
  const resultRef = useRef<{ picked: Faller | null; correct: boolean } | null>(null);
  const finishTimer = useRef<number | undefined>(undefined);
  // Multi-target only: brief green flashes at the tap spot of already-cleared
  // target fallers, so the still-running simulation gives "got it" feedback
  // without freezing on every intermediate tap.
  const pulsesRef = useRef<{ x: number; y: number; until: number }[]>([]);
  const [remaining, setRemaining] = useState<number>(() =>
    isMultiTarget ? round.choices.filter((c) => c.token === round.target.token).length : 0,
  );

  useEffect(() => {
    playFind(round.target.token); // speak the "find X" prompt once on entry
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      window.clearTimeout(finishTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function finish(correct: boolean, picked: Faller | null): void {
    if (answeredRef.current) return;
    answeredRef.current = true;
    onAnswer(correct, {
      pickedToken: picked ? picked.token : null,
      pickedGlyph: picked ? picked.glyph : null,
      correctToken: round.target.token,
      correctGlyph: round.target.glyph,
    });
  }

  /** Freeze on the resolved outcome, draw the highlighted frame, then report. */
  function resolve(picked: Faller | null): void {
    if (answeredRef.current || resultRef.current) return;
    const correct = picked?.token === round.target.token;
    resultRef.current = { picked, correct };
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    draw();
    finishTimer.current = window.setTimeout(() => finish(correct, picked), FREEZE_MS);
  }

  function tick(ts: number): void {
    const last = lastTsRef.current;
    lastTsRef.current = ts;
    const dt = last === null ? 0 : Math.min((ts - last) / 1000, 0.05);
    const { world, fallen } = stepHear(worldRef.current, dt);
    worldRef.current = world;
    if (pulsesRef.current.length > 0) pulsesRef.current = pulsesRef.current.filter((p) => p.until > ts);
    draw();
    if (fallen.includes(round.target.token)) {
      resolve(null); // missed the target — it hit the floor
      return;
    }
    if (!answeredRef.current && !resultRef.current) rafRef.current = requestAnimationFrame(tick);
  }

  function draw(): void {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const result = resultRef.current;
    ctx.clearRect(0, 0, HEAR_W, HEAR_H);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const faller of worldRef.current.fallers) {
      // While frozen, recolour: the target green, the wrong pick red.
      let fill = '#6c5ce7';
      if (result) {
        if (faller.token === round.target.token) fill = '#16a34a';
        else if (result.picked && faller.id === result.picked.id) fill = '#ef4444';
      }
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.arc(faller.x, faller.y, FALLER_R, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      // If this faller carries an emoji icon, draw it above the circle.
      if (faller.icon) {
        ctx.font = '24px sans-serif';
        ctx.fillText(faller.icon, faller.x, faller.y - FALLER_R - 14);
      }
      // Glyph inside the circle.
      ctx.font = 'bold 36px sans-serif';
      ctx.fillText(faller.glyph, faller.x, faller.y + 2);
    }
    // Multi-target: a fading green pulse where an already-cleared target was tapped.
    for (const pulse of pulsesRef.current) {
      ctx.fillStyle = '#16a34a';
      ctx.beginPath();
      ctx.arc(pulse.x, pulse.y, FALLER_R, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function onTap(clientX: number, clientY: number): void {
    const canvas = canvasRef.current;
    if (!canvas || answeredRef.current || resultRef.current) return;
    const rect = canvas.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * HEAR_W;
    const y = ((clientY - rect.top) / rect.height) * HEAR_H;
    const hit = fallerAt(worldRef.current, x, y);
    if (!hit) return;

    if (isMultiTarget && hit.token === round.target.token) {
      const world = removeFaller(worldRef.current, hit.id);
      worldRef.current = world;
      const left = world.fallers.filter((f) => f.token === round.target.token).length;
      setRemaining(left);
      if (left === 0) {
        resolve(hit); // last one found — freeze and report as correct
        return;
      }
      pulsesRef.current.push({ x: hit.x, y: hit.y, until: performance.now() + PULSE_MS });
      return;
    }
    resolve(hit);
  }

  return (
    <div className="learn-hear">
      <canvas
        ref={canvasRef}
        width={HEAR_W}
        height={HEAR_H}
        className="learn-hear-canvas"
        onPointerDown={(e) => onTap(e.clientX, e.clientY)}
      />
      {/* Multi-target: how many more of the target the kid still needs to tap. */}
      {isMultiTarget && <div className="learn-hear-remaining">×{remaining}</div>}
      {/* Subtle replay tucked into the canvas's top-right corner. */}
      <button
        type="button"
        className="learn-replay"
        onClick={() => playFind(round.target.token)}
        aria-label={t('games.learn.replay')}
      >
        <Volume2 size={22} />
      </button>
    </div>
  );
}
