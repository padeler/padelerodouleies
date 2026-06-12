import { useEffect, useRef, useState } from 'react';
import { useT } from '../../../i18n/store';
import { notifyCelebration } from '../../../lib/notify';
import { playCatch, playClaim, playWrong } from '../../../lib/sound';
import { GamePage } from './GamePage';
import {
  BASKET_W,
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

// Basket sprite: Lucide "shopping-basket" rasterised to an <img> and drawn onto
// the canvas, so it renders identically everywhere. (The previous emoji basket
// relied on the system emoji font, which the old LAN tablets lack — it drew a
// blank box.) Warm straw colour for contrast against the purple night sky.
const BASKET_COLOR = '#f6c863';
const BASKET_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${BASKET_COLOR}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 11-1 9"/><path d="m19 11-4-7"/><path d="M2 11h20"/><path d="m3.5 11 1.6 7.4a2 2 0 0 0 2 1.6h9.8a2 2 0 0 0 2-1.6l1.7-7.4"/><path d="M4.5 15.5h15"/><path d="m5 11 4-7"/><path d="m9 11 1 9"/></svg>`;
const BASKET_DRAW_W = BASKET_W;
const BASKET_DRAW_H = 58;

function createBasketImage(): HTMLImageElement {
  const img = new Image(BASKET_DRAW_W, BASKET_DRAW_H);
  img.src = `data:image/svg+xml;utf8,${encodeURIComponent(BASKET_SVG)}`;
  return img;
}

export function StarCatcher() {
  const t = useT();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const worldRef = useRef<CatcherWorld>(createWorld());
  const basketXRef = useRef(WORLD_W / 2);
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef<number | null>(null);
  const basketImgRef = useRef<HTMLImageElement>(createBasketImage());
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
    const basket = basketImgRef.current;
    if (basket.complete && basket.naturalWidth > 0) {
      ctx.drawImage(
        basket,
        basketXRef.current - BASKET_DRAW_W / 2,
        WORLD_H - BASKET_DRAW_H - 2,
        BASKET_DRAW_W,
        BASKET_DRAW_H,
      );
    }
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
