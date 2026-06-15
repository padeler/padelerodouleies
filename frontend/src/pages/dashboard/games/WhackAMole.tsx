import { useEffect, useRef, useState } from 'react';
import { useT } from '../../../i18n/store';
import { notifyCelebration } from '../../../lib/notify';
import { playClaim, playReward } from '../../../lib/sound';
import { GamePage } from './GamePage';
import {
  GAME_DURATION,
  HOLES,
  type WhackWorld,
  createWorld,
  isOver,
  stepWorld,
  whack,
} from './whackEngine';
import { useGameBest, useSubmitScore } from './useGameScores';
import './WhackAMole.css';

type WhackPhase = 'ready' | 'running' | 'over';

const CRITTER = '🐹'; // U+1F439 hamster, Unicode 6.0 — renders on the old Tab 4 font.

/** Stable equality for the set of occupied holes, to avoid needless re-renders. */
function sameHoles(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((h, i) => h === b[i]);
}

export function WhackAMole() {
  const t = useT();
  const worldRef = useRef<WhackWorld>(createWorld());
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef<number | null>(null);
  const upHolesRef = useRef<number[]>([]);
  const [phase, setPhase] = useState<WhackPhase>('ready');
  const [score, setScore] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(GAME_DURATION);
  const [upHoles, setUpHoles] = useState<number[]>([]);
  const [newBest, setNewBest] = useState(false);

  const best = useGameBest('whack');
  const submitScore = useSubmitScore();

  useEffect(
    () => () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    },
    [],
  );

  function syncUpHoles(world: WhackWorld): void {
    const holes = world.moles.map((m) => m.hole).sort((a, b) => a - b);
    if (!sameHoles(holes, upHolesRef.current)) {
      upHolesRef.current = holes;
      setUpHoles(holes);
    }
  }

  function start(): void {
    worldRef.current = createWorld();
    lastTsRef.current = null;
    upHolesRef.current = [];
    setScore(0);
    setSecondsLeft(GAME_DURATION);
    setUpHoles([]);
    setNewBest(false);
    setPhase('running');
    playClaim(); // start jingle — also warms the AudioContext on this user gesture
    rafRef.current = requestAnimationFrame(tick);
  }

  function tick(ts: number): void {
    const last = lastTsRef.current;
    lastTsRef.current = ts;
    // Clamp dt so a backgrounded tab doesn't fast-forward the round on resume.
    const dt = last === null ? 0 : Math.min((ts - last) / 1000, 0.1);
    const { world } = stepWorld(worldRef.current, dt);
    worldRef.current = world;

    syncUpHoles(world);
    const secs = Math.ceil(world.timeLeft);
    if (secs !== secondsLeft) setSecondsLeft(secs);

    if (isOver(world)) {
      endGame(world.score);
      return;
    }
    rafRef.current = requestAnimationFrame(tick);
  }

  function endGame(finalScore: number): void {
    if (finalScore > 0) {
      submitScore('whack', finalScore, (improved) => {
        setNewBest(improved);
        if (improved) notifyCelebration(t('games.new_best'));
      });
    }
    setUpHoles([]);
    setPhase('over');
  }

  function onHolePress(hole: number): void {
    if (phase !== 'running') return;
    const { world, hit } = whack(worldRef.current, hole);
    if (!hit) return;
    worldRef.current = world;
    playReward();
    setScore(world.score);
    syncUpHoles(world);
  }

  return (
    <GamePage emoji="🐹" title={t('games.whack.title')}>
      <div className="game-hud">
        <span className="game-hud-item">
          {t('games.score')}: {score}
        </span>
        <span className="game-hud-item">
          {t('games.whack.time')}: {secondsLeft}
        </span>
        {best !== null && (
          <span className="game-hud-item">
            {t('games.best')}: {best}
          </span>
        )}
      </div>
      <div className="whack-stage">
        <div className="whack-board">
          {Array.from({ length: HOLES }, (_, hole) => {
            const up = upHoles.includes(hole);
            return (
              <button
                key={hole}
                type="button"
                className="whack-hole"
                disabled={phase !== 'running'}
                onPointerDown={() => onHolePress(hole)}
                aria-label={up ? CRITTER : 'hole'}
              >
                <span className={`whack-critter ${up ? 'up' : ''}`}>{CRITTER}</span>
              </button>
            );
          })}
        </div>
        {phase !== 'running' && (
          <div className="game-overlay">
            {phase === 'ready' ? (
              <p className="game-overlay-text">{t('games.whack.howto')}</p>
            ) : (
              <>
                <p className="game-overlay-title">{t('games.game_over')}</p>
                <p className="game-overlay-text">
                  {t('games.score')}: {score} 🐹
                </p>
                {newBest && <p className="game-overlay-best">🐹 {t('games.new_best')}</p>}
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
