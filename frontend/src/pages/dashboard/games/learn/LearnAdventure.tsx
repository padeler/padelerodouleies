import { useCallback, useEffect, useState } from 'react';
import { Heart } from 'lucide-react';
import { useT } from '../../../../i18n/store';
import { notifyCelebration } from '../../../../lib/notify';
import { WIN_TUNE_MAX_MS, playWinTune, playWrong } from '../../../../lib/sound';
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
  type GameEvent,
  type GameState,
  type LevelType,
  type Round,
  type RoundFeedback,
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

/**
 * A resolved-but-not-yet-committed answer. The game pauses on a result panel
 * after every round (success and failure alike); the kid taps Continue to
 * commit `next` and move on. Captured here so the panel can explain the outcome
 * and the celebration variant for a cleared slot/tier.
 */
interface Pending {
  correct: boolean;
  events: GameEvent[];
  feedback: RoundFeedback;
  levelType: LevelType; // the level just played (drives the count-specific text)
  next: GameState;
  nextRound: Round | null; // null when the run is over
  newLevel: boolean;
  tierJustCleared: number | null; // tier number cleared (for the 🏆 variant), else null
}

/** The Learning Adventure shell: one component, rendered per track. */
export function LearnAdventure({ track, emoji }: { track: Track; emoji: string }) {
  const t = useT();
  const { deck, prefetch, playToken, playPhrase, playFind, playWrongPhrase, stopAudio } =
    useLearnDeck(track);
  const best = useGameBest(SCORE_KEY[track]);
  const submitScore = useSubmitScore();

  const [audioReady, setAudioReady] = useState(false);
  const [game, setGame] = useState<GameState | null>(null);
  const [round, setRound] = useState<{ data: Round; id: number; newLevel: boolean } | null>(null);
  // 'intro' = spoken description / countdown; 'play' = interactive round;
  // 'feedback' = per-round result panel the kid dismisses with Continue.
  const [phase, setPhase] = useState<'intro' | 'play' | 'feedback'>('play');
  const [pending, setPending] = useState<Pending | null>(null);
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
    setPending(null);
    setGame(g);
    setRound({ data: nextRound(g), id: 0, newLevel: true });
    setPhase('intro'); // first level → speak its description before play
  }, [deck, track]);

  // Grade the round, but hold on the result panel rather than advancing — the
  // kid taps Continue (see handleContinue) to commit and move on. Plays the sound
  // effects and the spoken praise/explanation here so they start with the panel.
  const handleAnswer = useCallback(
    (correct: boolean, feedback: RoundFeedback): void => {
      if (!game || game.status !== 'playing') return;
      const levelType = currentLevelType(game);
      const { state: next, events } = applyAnswer(game, correct);

      if (events.includes('wrong')) playWrong();
      if (events.includes('tier_cleared')) {
        notifyCelebration(t('games.learn.tier_cleared', { tier: String(tierNumber(game)) }));
        if (deck) void prefetch(tierTokens(deck, next.tierIndex));
      }

      // Celebrate a correct answer with a random winning jingle (replaces the
      // spoken praise — the result screen then auto-advances). A wrong answer
      // keeps its spoken explanation and waits for the kid to dismiss it.
      if (correct) playWinTune();
      else playWrongPhrase(feedback.correctToken, feedback.pickedToken);

      const newLevel =
        next.status === 'playing' && (next.slot !== game.slot || next.tierIndex !== game.tierIndex);
      setPending({
        correct,
        events,
        feedback,
        levelType,
        next,
        // Pass the round just played so the next one is never an exact repeat
        // (only meaningful when the slot stays the same — across a slot/level
        // change the round kind differs, so the signature can't collide).
        nextRound: next.status === 'playing' ? nextRound(next, Math.random, round?.data) : null,
        newLevel,
        tierJustCleared: events.includes('tier_cleared') ? tierNumber(game) : null,
      });
      setPhase('feedback');
    },
    [game, round, deck, prefetch, playWrongPhrase, t],
  );

  // Commit the held result and move on: end the run (submit the score) or start
  // the next round, re-entering the intro for a new level or a timed round.
  const handleContinue = useCallback((): void => {
    if (!pending) return;
    const p = pending;
    setPending(null);
    setGame(p.next);
    if (p.next.status !== 'playing' || !p.nextRound) {
      stopAudio();
      submitScore(SCORE_KEY[track], finalScore(p.next), (improved) => {
        setNewBest(improved);
        if (improved) notifyCelebration(t('games.new_best'));
      });
      return;
    }
    setRound((prev) => ({ data: p.nextRound!, id: (prev?.id ?? 0) + 1, newLevel: p.newLevel }));
    setPhase(p.newLevel || isTimeTrial(p.next) ? 'intro' : 'play');
  }, [pending, stopAudio, submitScore, track, t]);

  const titleKey = `games.${track}.title`;
  const loading = !deck || !audioReady;

  // Start the run automatically once the deck + audio are ready — the old
  // welcome screen with a Start button was redundant (the kid is already on the
  // game page). A finished run still shows the game-over panel with Play again.
  useEffect(() => {
    if (!loading && !game) start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, game, start]);

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

          {/* Bordered play area, matching the other games' boards. */}
          <div className="learn-board">
            {game && game.status === 'playing' ? (
              phase === 'feedback' && pending ? (
                <ResultPanel pending={pending} onContinue={handleContinue} />
              ) : round ? (
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
                      playFind={playFind}
                    />
                  )}
                </div>
              ) : null
            ) : game && game.status === 'over' ? (
              <div className="learn-overlay">
                <p className="game-overlay-title">{t('games.game_over')}</p>
                <p className="game-overlay-text">
                  {t('games.score')}: {game.points}
                </p>
                {newBest && <p className="game-overlay-best">⭐ {t('games.new_best')}</p>}
                <button type="button" className="game-action-btn" onClick={start}>
                  {t('games.play_again')}
                </button>
              </div>
            ) : null}
          </div>
        </>
      )}
    </GamePage>
  );
}

/**
 * The per-round result panel, shown after every answer (success and failure).
 * On a mistake it explains what happened ("Διάλεξες το 8. Το σωστό ήταν το 9.");
 * on a cleared slot/tier it celebrates. The kid taps Continue to move on, so
 * they always get a beat to take in the result.
 */
// How long the winning result screen lingers before auto-advancing — long
// enough for the jingle to finish, plus a short beat to enjoy it.
const WIN_RESULT_MS = WIN_TUNE_MAX_MS + 500;

function ResultPanel({ pending, onContinue }: { pending: Pending; onContinue: () => void }) {
  const t = useT();
  const { correct, feedback, levelType, events, tierJustCleared, next } = pending;

  // A correct answer celebrates with a jingle and moves on by itself after a
  // short beat (no button). A wrong answer waits for the kid to tap Continue so
  // they can read the explanation at their own pace.
  useEffect(() => {
    if (!correct) return;
    const id = window.setTimeout(onContinue, WIN_RESULT_MS);
    return () => window.clearTimeout(id);
  }, [correct, onContinue]);

  let emoji: string;
  let title: string;
  if (tierJustCleared !== null) {
    emoji = '🏆';
    title = t('games.learn.tier_cleared', { tier: String(tierJustCleared) });
  } else if (correct && events.includes('slot_cleared')) {
    emoji = '🎉';
    title = t('games.learn.level_cleared');
  } else if (correct) {
    emoji = '⭐';
    title = t('games.learn.correct_title');
  } else {
    emoji = '';
    title = t('games.learn.wrong_title');
  }

  // The mistake explanation: what the kid picked (or "out of time"), then the
  // right answer — count uses its own wording ("Τα αστεράκια είναι 5").
  const explain = !correct && (
    <div className="learn-result-explain">
      {feedback.pickedGlyph !== null ? (
        <p>{t('games.learn.fb_you_picked', { glyph: feedback.pickedGlyph })}</p>
      ) : (
        <p>{t('games.learn.fb_time_up')}</p>
      )}
      {feedback.correctGlyph !== '' &&
        (levelType === 'count' ? (
          <p>{t('games.learn.fb_count_was', { count: feedback.correctGlyph })}</p>
        ) : (
          <p>{t('games.learn.fb_correct_was', { glyph: feedback.correctGlyph })}</p>
        ))}
    </div>
  );

  return (
    <div className={`learn-result ${correct ? 'ok' : 'bad'}`}>
      {emoji && <p className="learn-result-emoji">{emoji}</p>}
      <p className="learn-result-title">{title}</p>
      {explain}
      <p className="learn-result-score">
        {t('games.score')}: {next.points}
      </p>
      {!correct && (
        <button type="button" className="game-action-btn" onClick={onContinue}>
          {t('games.learn.continue')}
        </button>
      )}
    </div>
  );
}

function PlayerSwitch({
  round,
  onAnswer,
  playToken,
  playFind,
}: {
  round: Round;
  onAnswer: (correct: boolean, feedback: RoundFeedback) => void;
  playToken: (token: string) => void;
  playFind: (token: string) => void;
}) {
  switch (round.kind) {
    case 'count':
      return <CountThem round={round} onAnswer={onAnswer} playToken={playToken} />;
    case 'match':
      return <MatchCase round={round} onAnswer={onAnswer} playToken={playToken} />;
    case 'hear':
      return <HearIt round={round} onAnswer={onAnswer} playFind={playFind} />;
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
