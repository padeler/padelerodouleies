import { useEffect, useRef, useState } from 'react';
import { useT } from '../../../i18n/store';
import { notifyCelebration } from '../../../lib/notify';
import { playClaim, playReward, playWrong } from '../../../lib/sound';
import { GamePage } from './GamePage';
import {
  CELL,
  type Direction,
  type SnakeWorld,
  WORLD_H,
  WORLD_W,
  createWorld,
  stepInterval,
  stepWorld,
} from './snakeEngine';
import { useGameBest, useSubmitScore } from './useGameScores';
import './Snake.css';

type SnakePhase = 'ready' | 'running' | 'over';

// Fixed canvas colours (canvas can't read CSS vars): a friendly grass-green
// snake on the dark playfield, head a shade brighter than the body.
const SNAKE_BODY = '#4ade80';
const SNAKE_HEAD = '#22c55e';
const FOOD_EMOJI = '🍎'; // U+1F34E, Unicode 6.0 — renders on the old Tab 4 emoji font.

// A swipe must travel this many CSS px before it registers as a turn — small
// enough to feel responsive, large enough to ignore taps and jitter.
const SWIPE_THRESHOLD = 18;

export function Snake() {
  const t = useT();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const worldRef = useRef<SnakeWorld>(createWorld());
  const nextDirRef = useRef<Direction>('right');
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef<number | null>(null);
  const accRef = useRef(0);
  const swipeAnchorRef = useRef<{ x: number; y: number } | null>(null);
  const [phase, setPhase] = useState<SnakePhase>('ready');
  const [score, setScore] = useState(0);
  const [newBest, setNewBest] = useState(false);

  const best = useGameBest('snake');
  const submitScore = useSubmitScore();

  useEffect(
    () => () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    },
    [],
  );

  // Arrow / WASD keys for desktop play; touch swipe is the primary control.
  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      const dir = KEY_DIRS[e.key];
      if (dir) {
        queueDir(dir);
        e.preventDefault();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  function queueDir(dir: Direction): void {
    nextDirRef.current = dir;
  }

  function start(): void {
    worldRef.current = createWorld();
    nextDirRef.current = 'right';
    lastTsRef.current = null;
    accRef.current = 0;
    swipeAnchorRef.current = null;
    setScore(0);
    setNewBest(false);
    setPhase('running');
    playClaim(); // start jingle — also warms the AudioContext on this user gesture
    draw();
    rafRef.current = requestAnimationFrame(tick);
  }

  function tick(ts: number): void {
    const last = lastTsRef.current;
    lastTsRef.current = ts;
    // Clamp dt so a backgrounded tab doesn't fast-forward the snake on resume.
    const dt = last === null ? 0 : Math.min((ts - last) / 1000, 0.1);
    accRef.current += dt;

    let changed = false;
    let interval = stepInterval(worldRef.current.score);
    while (accRef.current >= interval) {
      accRef.current -= interval;
      const { world, events } = stepWorld(worldRef.current, nextDirRef.current);
      worldRef.current = world;
      changed = true;
      for (const event of events) {
        if (event === 'eat') {
          playReward();
          setScore(world.score);
        } else {
          playWrong();
        }
      }
      if (!world.alive) {
        draw();
        endGame(world.score);
        return;
      }
      interval = stepInterval(world.score);
    }

    // Nothing visually changes between steps, so only repaint on a real move.
    if (changed) draw();
    rafRef.current = requestAnimationFrame(tick);
  }

  function endGame(finalScore: number): void {
    if (finalScore > 0) {
      submitScore('snake', finalScore, (improved) => {
        setNewBest(improved);
        if (improved) notifyCelebration(t('games.new_best'));
      });
    }
    setPhase('over');
  }

  function draw(): void {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const world = worldRef.current;
    ctx.clearRect(0, 0, WORLD_W, WORLD_H);

    // Apple.
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '20px serif';
    ctx.fillText(FOOD_EMOJI, world.food.x * CELL + CELL / 2, world.food.y * CELL + CELL / 2);

    // Snake — filled rounded-ish cells with a 1px inset so segments read apart.
    world.snake.forEach((p, i) => {
      ctx.fillStyle = i === 0 ? SNAKE_HEAD : SNAKE_BODY;
      ctx.fillRect(p.x * CELL + 1, p.y * CELL + 1, CELL - 2, CELL - 2);
    });
  }

  function onPointerDown(clientX: number, clientY: number): void {
    if (phase !== 'running') return;
    swipeAnchorRef.current = { x: clientX, y: clientY };
  }

  function onPointerMove(clientX: number, clientY: number): void {
    const anchor = swipeAnchorRef.current;
    if (!anchor || phase !== 'running') return;
    const dx = clientX - anchor.x;
    const dy = clientY - anchor.y;
    if (Math.abs(dx) < SWIPE_THRESHOLD && Math.abs(dy) < SWIPE_THRESHOLD) return;
    // Dominant axis wins; re-anchor so the next flick steers immediately.
    if (Math.abs(dx) > Math.abs(dy)) queueDir(dx > 0 ? 'right' : 'left');
    else queueDir(dy > 0 ? 'down' : 'up');
    swipeAnchorRef.current = { x: clientX, y: clientY };
  }

  return (
    <GamePage emoji="🐍" title={t('games.snake.title')}>
      <div className="game-hud">
        <span className="game-hud-item">
          {t('games.score')}: {score}
        </span>
        {best !== null && (
          <span className="game-hud-item">
            {t('games.best')}: {best}
          </span>
        )}
      </div>
      <div className="snake-stage">
        <canvas
          ref={canvasRef}
          width={WORLD_W}
          height={WORLD_H}
          className="snake-canvas"
          onPointerDown={(e) => onPointerDown(e.clientX, e.clientY)}
          onPointerMove={(e) => onPointerMove(e.clientX, e.clientY)}
          onPointerUp={() => {
            swipeAnchorRef.current = null;
          }}
        />
        {phase !== 'running' && (
          <div className="game-overlay">
            {phase === 'ready' ? (
              <p className="game-overlay-text">{t('games.snake.howto')}</p>
            ) : (
              <>
                <p className="game-overlay-title">{t('games.game_over')}</p>
                <p className="game-overlay-text">
                  {t('games.score')}: {score} 🍎
                </p>
                {newBest && <p className="game-overlay-best">🍎 {t('games.new_best')}</p>}
              </>
            )}
            <button type="button" className="game-action-btn" onClick={start}>
              {phase === 'ready' ? t('games.start') : t('games.play_again')}
            </button>
          </div>
        )}
        {/* Direction pad overlaid on the bottom of the play area — a compact,
            translucent cross so it fits even on small screens. */}
        <div className="snake-dpad" aria-hidden={phase !== 'running'}>
          {DPAD_BUTTONS.map(({ dir, area, glyph }) => (
            <button
              key={dir}
              type="button"
              className={`snake-dpad-btn dpad-${area}`}
              disabled={phase !== 'running'}
              // Pointer down (not click) so a tap steers immediately, and stop the
              // gesture from also being read as a canvas swipe / page scroll.
              onPointerDown={(e) => {
                e.preventDefault();
                queueDir(dir);
              }}
              aria-label={dir}
            >
              {glyph}
            </button>
          ))}
        </div>
      </div>
    </GamePage>
  );
}

const DPAD_BUTTONS: { dir: Direction; area: string; glyph: string }[] = [
  { dir: 'up', area: 'up', glyph: '▲' },
  { dir: 'left', area: 'left', glyph: '◀' },
  { dir: 'down', area: 'down', glyph: '▼' },
  { dir: 'right', area: 'right', glyph: '▶' },
];

const KEY_DIRS: Record<string, Direction> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  w: 'up',
  s: 'down',
  a: 'left',
  d: 'right',
};
