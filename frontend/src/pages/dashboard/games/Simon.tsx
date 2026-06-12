import { useEffect, useRef, useState } from 'react';
import { useT } from '../../../i18n/store';
import { notifyCelebration } from '../../../lib/notify';
import { playSimonPad, playWrong } from '../../../lib/sound';
import { GamePage } from './GamePage';
import { useGameBest, useSubmitScore } from './useGameScores';
import './Simon.css';

type SimonPhase = 'idle' | 'watch' | 'input' | 'over';

const PAD_COLORS = ['green', 'red', 'yellow', 'blue'] as const;
const SEQUENCE_START_DELAY_MS = 600;
const PAD_FLASH_MS = 220;

/** Playback speed ramps up gently with the sequence length. */
function padOnMs(round: number): number {
  return Math.max(550 - round * 25, 260);
}

export function Simon() {
  const t = useT();
  const [phase, setPhase] = useState<SimonPhase>('idle');
  const [sequence, setSequence] = useState<number[]>([]);
  const [activePad, setActivePad] = useState<number | null>(null);
  const [newBest, setNewBest] = useState(false);
  const inputPos = useRef(0);
  const timers = useRef<number[]>([]);

  const best = useGameBest('simon');
  const submitScore = useSubmitScore();

  useEffect(() => () => clearTimers(), []);

  function clearTimers(): void {
    for (const id of timers.current) window.clearTimeout(id);
    timers.current = [];
  }

  function later(fn: () => void, ms: number): void {
    timers.current.push(window.setTimeout(fn, ms));
  }

  function randomPad(): number {
    return Math.floor(Math.random() * PAD_COLORS.length);
  }

  function start(): void {
    clearTimers();
    setNewBest(false);
    const seq = [randomPad()];
    setSequence(seq);
    playSequence(seq);
  }

  function playSequence(seq: number[]): void {
    setPhase('watch');
    const onMs = padOnMs(seq.length);
    const gapMs = onMs + 170;
    seq.forEach((pad, k) => {
      later(() => {
        setActivePad(pad);
        playSimonPad(pad, onMs / 1000);
      }, SEQUENCE_START_DELAY_MS + k * gapMs);
      later(() => setActivePad(null), SEQUENCE_START_DELAY_MS + k * gapMs + onMs);
    });
    later(() => {
      inputPos.current = 0;
      setPhase('input');
    }, SEQUENCE_START_DELAY_MS + seq.length * gapMs);
  }

  function onPadPress(pad: number): void {
    if (phase !== 'input') return;
    setActivePad(pad);
    later(() => setActivePad(null), PAD_FLASH_MS);

    const expected = sequence[inputPos.current];
    if (pad === expected) {
      playSimonPad(pad);
      inputPos.current += 1;
      if (inputPos.current === sequence.length) {
        const next = [...sequence, randomPad()];
        setSequence(next);
        setPhase('watch');
        later(() => playSequence(next), 700);
      }
    } else {
      playWrong();
      const score = sequence.length - 1;
      if (score > 0) {
        submitScore('simon', score, (improved) => {
          setNewBest(improved);
          if (improved) notifyCelebration(t('games.new_best'));
        });
      }
      setPhase('over');
    }
  }

  const score = Math.max(sequence.length - 1, 0);

  return (
    <GamePage emoji="🚦" title={t('games.simon.title')}>
      <div className="game-hud">
        {(phase === 'watch' || phase === 'input') && (
          <span className="game-hud-item">{t('games.simon.round', { round: String(sequence.length) })}</span>
        )}
        {best !== null && (
          <span className="game-hud-item">
            {t('games.best')}: {best}
          </span>
        )}
      </div>
      <p className="simon-status">
        {phase === 'watch' ? t('games.simon.watch') : phase === 'input' ? t('games.simon.your_turn') : ' '}
      </p>
      <div className="simon-board">
        {PAD_COLORS.map((color, pad) => (
          <button
            key={color}
            type="button"
            className={`simon-pad simon-${color} ${activePad === pad ? 'lit' : ''}`}
            disabled={phase !== 'input'}
            onClick={() => onPadPress(pad)}
            aria-label={color}
          />
        ))}
        {(phase === 'idle' || phase === 'over') && (
          <div className="game-overlay">
            {phase === 'over' ? (
              <>
                <p className="game-overlay-title">{t('games.game_over')}</p>
                <p className="game-overlay-text">
                  {t('games.score')}: {score}
                </p>
                {newBest && <p className="game-overlay-best">⭐ {t('games.new_best')}</p>}
              </>
            ) : (
              <p className="game-overlay-text">{t('games.simon.desc')}</p>
            )}
            <button type="button" className="game-action-btn" onClick={start}>
              {phase === 'idle' ? t('games.start') : t('games.play_again')}
            </button>
          </div>
        )}
      </div>
    </GamePage>
  );
}
