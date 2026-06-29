import { useEffect, useRef } from 'react';
import { Volume2 } from 'lucide-react';
import { useT } from '../../../../i18n/store';
import {
  FALLER_R,
  HEAR_H,
  HEAR_W,
  createHearWorld,
  fallerAt,
  stepHear,
  type HearWorld,
} from './hearEngine';
import type { HearRound } from './learnEngine';

/**
 * Listen (slot 1) — the action level. The target word is spoken on entry (and
 * replayable); the choices drift down the canvas and the kid taps the one that
 * matches what they heard. Catching the target → correct; tapping a wrong
 * faller, or letting the target reach the bottom, costs a life (reports false).
 *
 * Canvas 2D + rAF over the pure `hearEngine`; glyphs are drawn as text (letters
 * and digits render everywhere, unlike emoji) on accent tiles for contrast.
 */
export function HearIt({
  round,
  onAnswer,
  playToken,
}: {
  round: HearRound;
  onAnswer: (correct: boolean) => void;
  playToken: (token: string) => void;
}) {
  const t = useT();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const worldRef = useRef<HearWorld>(createHearWorld(round.choices));
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef<number | null>(null);
  const answeredRef = useRef(false);

  useEffect(() => {
    playToken(round.target.token); // speak the prompt once on entry
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function finish(correct: boolean): void {
    if (answeredRef.current) return;
    answeredRef.current = true;
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    onAnswer(correct);
  }

  function tick(ts: number): void {
    const last = lastTsRef.current;
    lastTsRef.current = ts;
    const dt = last === null ? 0 : Math.min((ts - last) / 1000, 0.05);
    const { world, fallen } = stepHear(worldRef.current, dt);
    worldRef.current = world;
    draw();
    if (fallen.includes(round.target.token)) {
      finish(false); // missed the target — it hit the floor
      return;
    }
    if (!answeredRef.current) rafRef.current = requestAnimationFrame(tick);
  }

  function draw(): void {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, HEAR_W, HEAR_H);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 36px sans-serif';
    for (const faller of worldRef.current.fallers) {
      ctx.fillStyle = '#6c5ce7';
      ctx.beginPath();
      ctx.arc(faller.x, faller.y, FALLER_R, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.fillText(faller.glyph, faller.x, faller.y + 2);
    }
  }

  function onTap(clientX: number, clientY: number): void {
    const canvas = canvasRef.current;
    if (!canvas || answeredRef.current) return;
    const rect = canvas.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * HEAR_W;
    const y = ((clientY - rect.top) / rect.height) * HEAR_H;
    const hit = fallerAt(worldRef.current, x, y);
    if (!hit) return;
    playToken(hit.token);
    finish(hit.token === round.target.token);
  }

  return (
    <div className="learn-hear">
      <button
        type="button"
        className="learn-replay"
        onClick={() => playToken(round.target.token)}
        aria-label={t('games.learn.replay')}
      >
        <Volume2 size={40} />
      </button>
      <canvas
        ref={canvasRef}
        width={HEAR_W}
        height={HEAR_H}
        className="learn-hear-canvas"
        onPointerDown={(e) => onTap(e.clientX, e.clientY)}
      />
    </div>
  );
}
