import { useEffect, useRef, useState } from 'react';
import { useT } from '../../../i18n/store';
import { notifyCelebration } from '../../../lib/notify';
import { playClaim, playFlip, playReward } from '../../../lib/sound';
import { GamePage } from './GamePage';
import { buildDeck, type MemoryCard, type MemoryDifficulty } from './memoryDeck';
import { useGameBest, useSubmitScore } from './useGameScores';
import './MemoryMatch.css';

const DIFFICULTIES: MemoryDifficulty[] = ['easy', 'medium', 'hard'];
const MISMATCH_FLIP_BACK_MS = 900;

export function MemoryMatch() {
  const t = useT();
  const [difficulty, setDifficulty] = useState<MemoryDifficulty>('easy');
  const [deck, setDeck] = useState<MemoryCard[]>(() => buildDeck('easy'));
  const [flipped, setFlipped] = useState<number[]>([]);
  const [matched, setMatched] = useState<Set<number>>(new Set());
  const [moves, setMoves] = useState(0);
  const [won, setWon] = useState(false);
  const [newBest, setNewBest] = useState(false);
  const flipBackTimer = useRef<number | null>(null);

  // Best = fewest moves, tracked per difficulty per user (server-backed).
  const best = useGameBest(`memory.${difficulty}`);
  const submitScore = useSubmitScore();

  useEffect(() => () => clearFlipBackTimer(), []);

  function clearFlipBackTimer(): void {
    if (flipBackTimer.current !== null) {
      window.clearTimeout(flipBackTimer.current);
      flipBackTimer.current = null;
    }
  }

  function newGame(nextDifficulty: MemoryDifficulty): void {
    clearFlipBackTimer();
    setDifficulty(nextDifficulty);
    setDeck(buildDeck(nextDifficulty));
    setFlipped([]);
    setMatched(new Set());
    setMoves(0);
    setWon(false);
    setNewBest(false);
  }

  function onCardClick(index: number): void {
    if (won || flipped.length === 2 || flipped.includes(index) || matched.has(index)) return;
    playFlip();
    const nextFlipped = [...flipped, index];
    setFlipped(nextFlipped);
    if (nextFlipped.length < 2) return;

    setMoves((m) => m + 1);
    const [i, j] = nextFlipped;
    if (i === undefined || j === undefined) {
      throw new Error('MemoryMatch: expected two flipped cards');
    }
    const first = deck[i];
    const second = deck[j];
    if (first === undefined || second === undefined) {
      throw new Error('MemoryMatch: flipped index outside the deck');
    }

    if (first.emoji === second.emoji) {
      const nextMatched = new Set(matched);
      nextMatched.add(i);
      nextMatched.add(j);
      setMatched(nextMatched);
      setFlipped([]);
      if (nextMatched.size === deck.length) {
        setWon(true);
        submitScore(`memory.${difficulty}`, moves + 1, (improved) => setNewBest(improved));
        notifyCelebration(t('games.memory.win'));
        playReward();
      } else {
        playClaim();
      }
    } else {
      flipBackTimer.current = window.setTimeout(() => setFlipped([]), MISMATCH_FLIP_BACK_MS);
    }
  }

  return (
    <GamePage emoji="🃏" title={t('games.memory.title')}>
      <div className="mm-controls">
        {DIFFICULTIES.map((d) => (
          <button
            key={d}
            type="button"
            className={d === difficulty ? 'active' : ''}
            onClick={() => newGame(d)}
          >
            {t(`games.memory.${d}`)}
          </button>
        ))}
      </div>
      <div className="game-hud">
        <span className="game-hud-item">
          {t('games.memory.moves')}: {moves}
        </span>
        {best !== null && (
          <span className="game-hud-item">
            {t('games.best')}: {best}
          </span>
        )}
      </div>
      <div className={`mm-board mm-${difficulty}`}>
        {deck.map((card, index) => {
          const faceUp = flipped.includes(index) || matched.has(index);
          return (
            <button
              key={card.id}
              type="button"
              className={`mm-card ${faceUp ? 'face-up' : ''} ${matched.has(index) ? 'matched' : ''}`}
              onClick={() => onCardClick(index)}
              data-emoji={card.emoji}
              aria-label={faceUp ? card.emoji : t('games.memory.title')}
            >
              <span className="mm-card-inner">
                <span className="mm-face mm-front">❓</span>
                <span className="mm-face mm-back">{card.emoji}</span>
              </span>
            </button>
          );
        })}
        {won && (
          <div className="game-overlay">
            <p className="game-overlay-title">🎉 {t('games.memory.win')}</p>
            <p className="game-overlay-text">
              {t('games.memory.moves')}: {moves}
            </p>
            {newBest && <p className="game-overlay-best">⭐ {t('games.new_best')}</p>}
            <button type="button" className="game-action-btn" onClick={() => newGame(difficulty)}>
              {t('games.play_again')}
            </button>
          </div>
        )}
      </div>
    </GamePage>
  );
}
