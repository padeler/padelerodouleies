import { useEffect, useRef, useState } from 'react';
import { useT } from '../../../i18n/store';
import { notifyCelebration } from '../../../lib/notify';
import { playCatch, playClaim, playWrong } from '../../../lib/sound';
import { GamePage } from './GamePage';
import {
  BASKET_W,
  CATCH_ZONE_H,
  START_LIVES,
  WORLD_H,
  WORLD_W,
  createWorld,
  stepWorld,
  type CatcherWorld,
} from './catcherEngine';
import { useGameBest, useSubmitScore } from './useGameScores';
import './StarCatcher.css';

type CatcherPhase = 'ready' | 'running' | 'over';

export function StarCatcher() {
  const t = useT();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const worldRef = useRef<CatcherWorld>(createWorld());
  const basketXRef = useRef(WORLD_W / 2);
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef<number | null>(null);
  const [phase, setPhase] = useState<CatcherPhase>('ready');
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(START_LIVES);
  const [newBest, setNewBest] = useState(false);

  const best = useGameBest('catcher');
  const submitScore = useSubmitScore();

  useEffect(
    () => () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    },
    [],
  );

  function start(): void {
    worldRef.current = createWorld();
    basketXRef.current = WORLD_W / 2;
    lastTsRef.current = null;
    setScore(0);
    setLives(START_LIVES);
    setNewBest(false);
    setPhase('running');
    playClaim(); // start jingle — also warms the AudioContext on this user gesture
    rafRef.current = requestAnimationFrame(tick);
  }

  function tick(ts: number): void {
    const last = lastTsRef.current;
    lastTsRef.current = ts;
    // Clamp dt so a backgrounded tab doesn't fast-forward the world on resume.
    const dt = last === null ? 0 : Math.min((ts - last) / 1000, 0.05);
    const { world, events } = stepWorld(worldRef.current, dt, basketXRef.current);
    worldRef.current = world;
    for (const event of events) {
      if (event === 'catch') playCatch();
      else playWrong();
    }
    if (events.length > 0) {
      setScore(world.score);
      setLives(world.lives);
    }
    draw();
    if (world.lives <= 0) {
      endGame(world.score);
      return;
    }
    rafRef.current = requestAnimationFrame(tick);
  }

  function endGame(finalScore: number): void {
    if (finalScore > 0) {
      submitScore('catcher', finalScore, (improved) => {
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
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '28px serif';
    for (const item of world.items) {
      ctx.fillText(item.kind === 'star' ? '⭐' : '💩', item.x, item.y);
    }
    ctx.font = '44px serif';
    ctx.fillText('🧺', basketXRef.current, WORLD_H - CATCH_ZONE_H / 2);
  }

  function moveBasket(clientX: number): void {
    const canvas = canvasRef.current;
    if (!canvas || phase !== 'running') return;
    const rect = canvas.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * WORLD_W;
    basketXRef.current = Math.max(BASKET_W / 2, Math.min(WORLD_W - BASKET_W / 2, x));
  }

  return (
    <GamePage emoji="⭐" title={t('games.catcher.title')}>
      <div className="game-hud">
        <span className="game-hud-item">
          {t('games.score')}: {score}
        </span>
        <span className="game-hud-item">
          {t('games.catcher.lives')}: {lives > 0 ? '❤️'.repeat(lives) : '💔'}
        </span>
        {best !== null && (
          <span className="game-hud-item">
            {t('games.best')}: {best}
          </span>
        )}
      </div>
      <div className="catcher-stage">
        <canvas
          ref={canvasRef}
          width={WORLD_W}
          height={WORLD_H}
          className="catcher-canvas"
          onPointerDown={(e) => moveBasket(e.clientX)}
          onPointerMove={(e) => moveBasket(e.clientX)}
        />
        {phase !== 'running' && (
          <div className="game-overlay">
            {phase === 'ready' ? (
              <p className="game-overlay-text">{t('games.catcher.howto')}</p>
            ) : (
              <>
                <p className="game-overlay-title">{t('games.game_over')}</p>
                <p className="game-overlay-text">
                  {t('games.score')}: {score} ⭐
                </p>
                {newBest && <p className="game-overlay-best">⭐ {t('games.new_best')}</p>}
              </>
            )}
            <button type="button" className="game-action-btn" onClick={start}>
              {phase === 'ready' ? t('games.start') : t('games.play_again')}
            </button>
          </div>
        )}
      </div>
    </GamePage>
  );
}
