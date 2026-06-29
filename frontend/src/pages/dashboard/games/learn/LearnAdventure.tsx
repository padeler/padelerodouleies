import { useCallback, useEffect, useState } from 'react';
import { Heart } from 'lucide-react';
import { useT } from '../../../../i18n/store';
import { notifyCelebration } from '../../../../lib/notify';
import { playLevelUp, playReward, playSuccess, playWrong } from '../../../../lib/sound';
import { GamePage } from '../GamePage';
import { useGameBest, useSubmitScore } from '../useGameScores';
import { CountThem } from './CountThem';
import { MatchCase } from './MatchCase';
import { HearIt } from './HearIt';
import { PutInOrder } from './PutInOrder';
import { WhatsNext } from './WhatsNext';
import { RoundIntro } from './RoundIntro';
import { useLearnDeck } from './useLearnDeck';
import {
  LIVES_START,
  applyAnswer,
  createGame,
  currentLevelType,
  finalScore,
  isTimeTrial,
  nextRound,
  tierNumber,
  type Deck,
  type GameState,
  type LevelType,
  type Round,
  type Track,
} from './learnEngine';
import './LearnAdventure.css';

const SCORE_KEY: Record<Track, string> = {
  numbers: 'number_adventure',
  letters: 'letter_adventure',
};

const LEVEL_NAME_KEY: Record<LevelType, string> = {
  count: 'games.learn.count',
  match: 'games.learn.match',
  hear: 'games.learn.hear',
  order: 'games.learn.order',
  whats_next: 'games.learn.whats_next',
};

const LEVEL_PROMPT_KEY: Record<LevelType, string> = {
  count: 'games.learn.count_prompt',
  match: 'games.learn.match_prompt',
  hear: 'games.learn.hear_prompt',
  order: 'games.learn.order_prompt',
  whats_next: 'games.learn.whats_next_prompt',
};

function tierTokens(deck: Deck, tierIndex: number): string[] {
  return deck.tiers[Math.min(tierIndex, deck.tiers.length - 1)]!.tokens;
}

/** The Learning Adventure shell: one component, rendered per track. */
export function LearnAdventure({ track, emoji }: { track: Track; emoji: string }) {
  const t = useT();
  const { deck, prefetch, playToken, playPhrase, stopAudio } = useLearnDeck(track);
  const best = useGameBest(SCORE_KEY[track]);
  const submitScore = useSubmitScore();

  const [audioReady, setAudioReady] = useState(false);
  const [game, setGame] = useState<GameState | null>(null);
  const [round, setRound] = useState<{ data: Round; id: number; newLevel: boolean } | null>(null);
  // 'intro' = spoken description / countdown; 'play' = interactive round;
  // 'cleared' = level-complete celebration the kid dismisses with a button.
  const [phase, setPhase] = useState<'intro' | 'play' | 'cleared'>('play');
  const [cleared, setCleared] = useState<{ tier: boolean; tierNum: number } | null>(null);
  const [newBest, setNewBest] = useState(false);

  // Pre-fetch the first tier's clips so the very first tap is instant.
  useEffect(() => {
    if (!deck) return;
    let cancelled = false;
    void prefetch(tierTokens(deck, 0)).then(() => {
      if (!cancelled) setAudioReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [deck, prefetch]);

  const start = useCallback((): void => {
    if (!deck) return;
    const g = createGame(track, deck);
    setNewBest(false);
    setGame(g);
    setRound({ data: nextRound(g), id: 0, newLevel: true });
    setPhase('intro'); // first level → speak its description before play
  }, [deck, track]);

  const handleAnswer = useCallback(
    (correct: boolean): void => {
      if (!game || game.status !== 'playing') return;
      const { state: next, events } = applyAnswer(game, correct);

      if (events.includes('wrong')) playWrong();
      if (events.includes('tier_cleared')) {
        playLevelUp();
        notifyCelebration(t('games.learn.tier_cleared', { tier: String(tierNumber(game)) }));
        if (deck) void prefetch(tierTokens(deck, next.tierIndex));
      } else if (events.includes('slot_cleared')) {
        playReward();
      } else if (events.includes('correct')) {
        playSuccess();
      }

      setGame(next);
      if (next.status === 'playing') {
        const newLevel = next.slot !== game.slot || next.tierIndex !== game.tierIndex;
        setRound((prev) => ({ data: nextRound(next), id: (prev?.id ?? 0) + 1, newLevel }));
        if (events.includes('slot_cleared') || events.includes('tier_cleared')) {
          // End of a level: hold on a celebration the kid dismisses by tapping
          // Continue, so they can take in the result before the next level.
          setCleared({ tier: events.includes('tier_cleared'), tierNum: tierNumber(game) });
          setPhase('cleared');
        } else {
          // Intro plays between levels (spoken description) and before every timed
          // round (3·2·1 countdown); a same-level untimed round starts immediately.
          setPhase(newLevel || isTimeTrial(next) ? 'intro' : 'play');
        }
      } else {
        stopAudio();
        submitScore(SCORE_KEY[track], finalScore(next), (improved) => {
          setNewBest(improved);
          if (improved) notifyCelebration(t('games.new_best'));
        });
      }
    },
    [game, deck, prefetch, submitScore, stopAudio, track, t],
  );

  const titleKey = `games.${track}.title`;
  const loading = !deck || !audioReady;

  return (
    <GamePage emoji={emoji} title={t(titleKey)}>
      {loading ? (
        <p className="learn-loading">{t('games.learn.loading')}</p>
      ) : (
        <>
          {game && (
            <div className="game-hud">
              <span className="game-hud-item">{t('games.learn.tier', { tier: String(tierNumber(game)) })}</span>
              <span className="game-hud-item">
                {t('games.score')}: {game.points}
              </span>
              <span className="game-hud-item learn-lives">
                {Array.from({ length: LIVES_START }, (_, i) => (
                  <Heart
                    key={i}
                    size={20}
                    className={i < game.lives ? 'learn-heart full' : 'learn-heart empty'}
                    fill={i < game.lives ? 'currentColor' : 'none'}
                  />
                ))}
              </span>
              {best !== null && (
                <span className="game-hud-item">
                  {t('games.best')}: {best}
                </span>
              )}
            </div>
          )}

          {game && round && game.status === 'playing' ? (
            phase === 'cleared' && cleared ? (
              <LevelCleared
                cleared={cleared}
                points={game.points}
                onContinue={() => {
                  setCleared(null);
                  setPhase(round.newLevel || isTimeTrial(game) ? 'intro' : 'play');
                }}
              />
            ) : (
              <div className="learn-stage">
                <p className="learn-level-name">{t(LEVEL_NAME_KEY[currentLevelType(game)])}</p>
                <p className="learn-prompt">{t(LEVEL_PROMPT_KEY[currentLevelType(game)])}</p>
                {phase === 'intro' ? (
                  <RoundIntro
                    key={round.id}
                    levelType={currentLevelType(game)}
                    speak={round.newLevel}
                    countdown={isTimeTrial(game)}
                    playPhrase={playPhrase}
                    onReady={() => setPhase('play')}
                  />
                ) : (
                  <PlayerSwitch
                    key={round.id}
                    round={round.data}
                    onAnswer={handleAnswer}
                    playToken={playToken}
                  />
                )}
              </div>
            )
          ) : (
            <div className="learn-overlay">
              {game && game.status === 'over' ? (
                <>
                  <p className="game-overlay-title">{t('games.game_over')}</p>
                  <p className="game-overlay-text">
                    {t('games.score')}: {game.points}
                  </p>
                  {newBest && <p className="game-overlay-best">⭐ {t('games.new_best')}</p>}
                </>
              ) : (
                <p className="game-overlay-text">{t(`games.${track}.desc`)}</p>
              )}
              <button type="button" className="game-action-btn" onClick={start}>
                {game ? t('games.play_again') : t('games.start')}
              </button>
            </div>
          )}
        </>
      )}
    </GamePage>
  );
}

/** Level-complete celebration; the kid taps Continue to start the next level. */
function LevelCleared({
  cleared,
  points,
  onContinue,
}: {
  cleared: { tier: boolean; tierNum: number };
  points: number;
  onContinue: () => void;
}) {
  const t = useT();
  return (
    <div className="learn-cleared">
      <p className="learn-cleared-emoji">{cleared.tier ? '🏆' : '🎉'}</p>
      <p className="learn-cleared-title">
        {cleared.tier
          ? t('games.learn.tier_cleared', { tier: String(cleared.tierNum) })
          : t('games.learn.level_cleared')}
      </p>
      <p className="learn-cleared-score">
        {t('games.score')}: {points}
      </p>
      <button type="button" className="game-action-btn" onClick={onContinue}>
        {t('games.learn.continue')}
      </button>
    </div>
  );
}

function PlayerSwitch({
  round,
  onAnswer,
  playToken,
}: {
  round: Round;
  onAnswer: (correct: boolean) => void;
  playToken: (token: string) => void;
}) {
  switch (round.kind) {
    case 'count':
      return <CountThem round={round} onAnswer={onAnswer} playToken={playToken} />;
    case 'match':
      return <MatchCase round={round} onAnswer={onAnswer} playToken={playToken} />;
    case 'hear':
      return <HearIt round={round} onAnswer={onAnswer} playToken={playToken} />;
    case 'order':
      return <PutInOrder round={round} onAnswer={onAnswer} playToken={playToken} />;
    case 'whats_next':
      return <WhatsNext round={round} onAnswer={onAnswer} playToken={playToken} />;
  }
}

export function NumberAdventure() {
  return <LearnAdventure track="numbers" emoji="🔢" />;
}

export function LetterAdventure() {
  return <LearnAdventure track="letters" emoji="🔤" />;
}
