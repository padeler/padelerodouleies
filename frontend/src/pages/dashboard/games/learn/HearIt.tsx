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

// How long a correctly-tapped (but not final) group-target faller flashes
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
  // Both "multi-target" (find every faller repeating the target's glyph) and
  // "starts-with" (find every faller whose word begins with the target letter)
  // require tapping a whole group of fallers before the round resolves — the
  // set of tokens that count as a hit is target.token plus any extra tokens the
  // engine attached (starts-with's second curated word; empty otherwise).
  const isGroupTarget = round.variant === 'multi-target' || round.variant === 'starts-with';
  // "spell" requires tapping an ordered sequence of fallers, one dictation
  // prompt per step (distinct from the unordered group-target variants above).
  const isSpell = round.variant === 'spell';
  const spellSequence = round.spellSequence ?? [];
  const targetTokens = useRef(new Set([round.target.token, ...(round.startsWithTokens ?? [])])).current;
  // Distractor tokens are guaranteed disjoint from spellSequence (see
  // spellSequenceForTrack in learnEngine.ts), so token membership alone tells
  // a faller apart from a distractor even with repeated letters in the word.
  const spellTokenSet = useRef(new Set(spellSequence)).current;
  const nextSpellIndexRef = useRef(0);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const worldRef = useRef<HearWorld>(createHearWorld(round.choices, Math.random, round.fallSpeedMult ?? 1.0, round.icons));
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef<number | null>(null);
  const answeredRef = useRef(false);
  // Once set, the simulation is frozen on this resolved outcome (the highlighted
  // faller the kid picked, or null on a miss) until `finish` reports it.
  const resultRef = useRef<{ picked: Faller | null; correct: boolean } | null>(null);
  const finishTimer = useRef<number | undefined>(undefined);
  // Group-target/spell only: brief green flashes at the tap spot of an
  // already-cleared faller, so the still-running simulation gives "got it"
  // feedback without freezing on every intermediate tap.
  const pulsesRef = useRef<{ x: number; y: number; until: number }[]>([]);
  const [remaining, setRemaining] = useState<number>(() =>
    isSpell
      ? spellSequence.length
      : isGroupTarget
        ? round.choices.filter((c) => targetTokens.has(c.token)).length
        : 0,
  );

  /** Whether a still-on-screen faller is still needed for the round to resolve. */
  function isRequiredToken(token: string): boolean {
    return isSpell ? token === spellSequence[nextSpellIndexRef.current] : targetTokens.has(token);
  }

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
    // Spell: explain the mistake against whichever letter/number was next due
    // (not always the first one) — falls back to the round target once the
    // whole sequence is done (a correct finish never reads this fallback).
    const correctChoice = isSpell
      ? (round.choices.find((c) => c.token === spellSequence[nextSpellIndexRef.current]) ?? round.target)
      : round.target;
    onAnswer(correct, {
      pickedToken: picked ? picked.token : null,
      pickedGlyph: picked ? picked.glyph : null,
      correctToken: correctChoice.token,
      correctGlyph: correctChoice.glyph,
    });
  }

  /**
   * Correctness of a tap/miss being resolved. Spell has no fixed "target
   * token" to check against — it's correct exactly when the sequence has just
   * been fully consumed (the caller only reaches `resolve` here after either
   * advancing past the last required tap or hitting a wrong/out-of-order one).
   */
  function isCorrectPick(picked: Faller | null): boolean {
    if (picked === null) return false;
    if (isSpell) return nextSpellIndexRef.current >= spellSequence.length;
    return targetTokens.has(picked.token);
  }

  /** Freeze on the resolved outcome, draw the highlighted frame, then report. */
  function resolve(picked: Faller | null): void {
    if (answeredRef.current || resultRef.current) return;
    const correct = isCorrectPick(picked);
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
    const missed = isSpell ? fallen.some((token) => spellTokenSet.has(token)) : fallen.some((token) => targetTokens.has(token));
    if (missed) {
      resolve(null); // a still-needed faller hit the floor
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
      // While frozen, recolour: every still-required faller green, the wrong pick red.
      let fill = '#6c5ce7';
      if (result) {
        if (isRequiredToken(faller.token)) fill = '#16a34a';
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
    // Group-target: a fading green pulse where an already-cleared target was tapped.
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

    if (isSpell) {
      if (hit.token !== spellSequence[nextSpellIndexRef.current]) {
        resolve(hit); // wrong letter/number, or the right one out of order
        return;
      }
      const world = removeFaller(worldRef.current, hit.id);
      worldRef.current = world;
      nextSpellIndexRef.current += 1;
      setRemaining(spellSequence.length - nextSpellIndexRef.current);
      if (nextSpellIndexRef.current >= spellSequence.length) {
        resolve(hit); // sequence complete — freeze and report as correct
        return;
      }
      pulsesRef.current.push({ x: hit.x, y: hit.y, until: performance.now() + PULSE_MS });
      playFind(spellSequence[nextSpellIndexRef.current]!); // prompt the next step
      return;
    }

    if (isGroupTarget && targetTokens.has(hit.token)) {
      const world = removeFaller(worldRef.current, hit.id);
      worldRef.current = world;
      const left = world.fallers.filter((f) => targetTokens.has(f.token)).length;
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
      {/* Group-target/spell: how many more taps the kid still needs to make. */}
      {(isGroupTarget || isSpell) && <div className="learn-hear-remaining">×{remaining}</div>}
      {/* Subtle replay tucked into the canvas's top-right corner. */}
      <button
        type="button"
        className="learn-replay"
        onClick={() => playFind(isSpell ? (spellSequence[nextSpellIndexRef.current] ?? round.target.token) : round.target.token)}
        aria-label={t('games.learn.replay')}
      >
        <Volume2 size={22} />
      </button>
    </div>
  );
}
