import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowDownUp, Ear, Hash, Heart, Lightbulb, Puzzle, type LucideIcon } from 'lucide-react';
import { useT } from '../../../../i18n/store';
import { learnCardUrl } from '../../../../api/client';
import { notifyCelebration } from '../../../../lib/notify';
import { WIN_TUNE_MAX_MS, playFlip, playWinTune, playWrong } from '../../../../lib/sound';
import { SpeakButton } from '../../../../components/SpeakButton';
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
  LEVEL_WEIGHT,
  LIVES_START,
  MATCH_HISTORY_WINDOW,
  applyAnswer,
  createMiniGame,
  currentLevelType,
  isTimeTrial,
  levelNumber,
  levelTypesFor,
  nextRound,
  poolTokensForLevel,
  runScore,
  type GameEvent,
  type GameState,
  type LevelType,
  type Round,
  type RoundFeedback,
  type Track,
} from './learnEngine';
import '../../flip-card.css';
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

// Short description shown on the picker card's back (and spoken by its speaker).
const LEVEL_DESC_KEY: Record<LevelType, string> = {
  count: 'games.learn.count_desc',
  match: 'games.learn.match_desc',
  hear: 'games.learn.hear_desc',
  order: 'games.learn.order_desc',
  whats_next: 'games.learn.whats_next_desc',
};

// A distinct Lucide chrome icon per mini-game (per the old-tablet emoji rule,
// interface icons use lucide-react, not emoji).
const LEVEL_ICON: Record<LevelType, LucideIcon> = {
  count: Hash,
  match: Puzzle,
  hear: Ear,
  order: ArrowDownUp,
  whats_next: Lightbulb,
};

/** Sum of the best run per mini-game this session — the score we submit. */
function sessionTotal(bestByType: Partial<Record<LevelType, number>>): number {
  return Object.values(bestByType).reduce((a, b) => a + (b ?? 0), 0);
}

/**
 * A resolved-but-not-yet-committed answer. The game pauses on a result panel
 * after every round (success and failure alike); the kid taps Continue to
 * commit `next` and move on. Captured here so the panel can explain the outcome
 * and celebrate a level-up.
 */
interface Pending {
  correct: boolean;
  events: GameEvent[];
  feedback: RoundFeedback;
  levelType: LevelType; // the mini-game being played (drives the count-specific text)
  next: GameState;
  nextRound: Round | null; // null when the run is over
}

/** The Learning Adventure shell: one component, rendered per track. */
export function LearnAdventure({ track, emoji }: { track: Track; emoji: string }) {
  const t = useT();
  const {
    deck,
    prefetch,
    playToken,
    playPhrase,
    playFind,
    playFindAll,
    playFindStartsWith,
    playVocab,
    playWrongPhrase,
    stopAudio,
  } = useLearnDeck(track);
  const best = useGameBest(SCORE_KEY[track]);
  const submitScore = useSubmitScore();

  const [audioReady, setAudioReady] = useState(false);
  // `game === null` means we are on the mini-game picker.
  const [game, setGame] = useState<GameState | null>(null);
  // `speakIntro` marks the first round of a mini-game (speak its description).
  const [round, setRound] = useState<{ data: Round; id: number; speakIntro: boolean } | null>(null);
  // 'intro' = spoken description / countdown; 'play' = interactive round;
  // 'feedback' = per-round result panel the kid dismisses with Continue.
  const [phase, setPhase] = useState<'intro' | 'play' | 'feedback'>('play');
  const [pending, setPending] = useState<Pending | null>(null);
  // Best run per mini-game this session; their sum is the submitted score.
  const [bestByType, setBestByType] = useState<Partial<Record<LevelType, number>>>({});
  const [newBest, setNewBest] = useState(false);

  // Rolling window of recently-matched letters (oldest→newest) so Match Case
  // rounds rotate through the alphabet slice instead of repeating the same pairs.
  const recentMatchTokens = useRef<string[]>([]);

  // Generate the next round, feeding the match-history window to the engine and
  // recording a match round's letters back into it (capped to the window).
  const genRound = useCallback((state: GameState, prev?: Round): Round => {
    const generated = nextRound(state, Math.random, prev, recentMatchTokens.current);
    if (generated.kind === 'match') {
      recentMatchTokens.current = [
        ...recentMatchTokens.current,
        ...generated.left.map((it) => it.token),
      ].slice(-MATCH_HISTORY_WINDOW);
    }
    return generated;
  }, []);

  // Pre-fetch the smallest tier's clips (the level-0 pool for any mini-game) so
  // the very first tap is instant.
  useEffect(() => {
    if (!deck) return;
    let cancelled = false;
    void prefetch(poolTokensForLevel(deck, 0)).then(() => {
      if (!cancelled) setAudioReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [deck, prefetch]);

  // Launch an endless run of one mini-game from the picker.
  const startMiniGame = useCallback(
    (levelType: LevelType): void => {
      if (!deck) return;
      const g = createMiniGame(track, deck, levelType);
      setNewBest(false);
      setPending(null);
      recentMatchTokens.current = [];
      setGame(g);
      setRound({ data: genRound(g), id: 0, speakIntro: true });
      setPhase('intro'); // speak the mini-game's description before the first round
    },
    [deck, track, genRound],
  );

  // Back to the picker (keeps the session's accumulated best-per-mini-game).
  const backToPicker = useCallback((): void => {
    stopAudio();
    setGame(null);
    setRound(null);
    setPending(null);
  }, [stopAudio]);

  // Grade the round, but hold on the result panel rather than advancing — the
  // kid taps Continue (see handleContinue) to commit and move on. Plays the sound
  // effects and the spoken praise/explanation here so they start with the panel.
  const handleAnswer = useCallback(
    (correct: boolean, feedback: RoundFeedback): void => {
      if (!game || game.status !== 'playing') return;
      const levelType = currentLevelType(game);
      const { state: next, events } = applyAnswer(game, correct);

      if (events.includes('wrong')) playWrong();
      if (events.includes('level_up')) {
        notifyCelebration(t('games.learn.level_up', { level: String(levelNumber(next)) }));
        if (deck) void prefetch(poolTokensForLevel(deck, next.level));
      }

      // Celebrate a correct answer with a random winning jingle (replaces the
      // spoken praise — the result screen then auto-advances). A wrong answer
      // keeps its spoken explanation and waits for the kid to dismiss it.
      if (correct) playWinTune();
      else playWrongPhrase(feedback.correctToken, feedback.pickedToken);

      setPending({
        correct,
        events,
        feedback,
        levelType,
        next,
        // Pass the round just played so the next one is never an exact repeat.
        nextRound: next.status === 'playing' ? genRound(next, round?.data) : null,
      });
      setPhase('feedback');
    },
    [game, round, deck, prefetch, playWrongPhrase, t, genRound],
  );

  // Commit the held result and move on: end the run (bank + submit the session
  // total) or start the next round, re-entering the intro for a timed round.
  const handleContinue = useCallback((): void => {
    if (!pending) return;
    const p = pending;
    setPending(null);
    setGame(p.next);

    if (p.next.status !== 'playing' || !p.nextRound) {
      stopAudio();
      // Bank this run: keep the best run per mini-game this session, and submit
      // the session total only when it grows (a worse replay changes nothing).
      const gained = runScore(p.next);
      setNewBest(false);
      if (gained > (bestByType[p.levelType] ?? 0)) {
        const nextBest = { ...bestByType, [p.levelType]: gained };
        setBestByType(nextBest);
        submitScore(SCORE_KEY[track], sessionTotal(nextBest), (improved) => {
          setNewBest(improved);
          if (improved) notifyCelebration(t('games.new_best'));
        });
      }
      return;
    }

    setRound((prev) => ({ data: p.nextRound!, id: (prev?.id ?? 0) + 1, speakIntro: false }));
    setPhase(isTimeTrial(p.next.levelType) ? 'intro' : 'play');
  }, [pending, bestByType, stopAudio, submitScore, track, t]);

  const titleKey = `games.${track}.title`;
  const loading = !deck || !audioReady;
  const total = sessionTotal(bestByType);

  return (
    <GamePage emoji={emoji} title={t(titleKey)}>
      {loading ? (
        <p className="learn-loading">{t('games.learn.loading')}</p>
      ) : !game ? (
        <MiniGamePicker
          track={track}
          bestByType={bestByType}
          sessionTotal={total}
          serverBest={best}
          onPick={startMiniGame}
        />
      ) : (
        <>
          {/* Back to the mini-game picker mid-run (the GamePage link above leaves
              the adventure entirely; this returns to the picker within it). */}
          <button type="button" className="learn-back" onClick={backToPicker}>
            ← {t('games.learn.choose_another')}
          </button>
          <div className="game-hud">
            <span className="game-hud-item">
              {t('games.learn.level', { level: String(levelNumber(game)) })}
            </span>
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

          {/* Bordered play area, matching the other games' boards. */}
          <div className="learn-board">
            {game.status === 'playing' ? (
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
                      speak={round.speakIntro}
                      countdown={isTimeTrial(game.levelType)}
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
                      playFindAll={playFindAll}
                      playFindStartsWith={playFindStartsWith}
                      playVocab={playVocab}
                    />
                  )}
                </div>
              ) : null
            ) : (
              <div className="learn-overlay">
                <img className="learn-mascot" src="/learn-icons/mascot.png" alt="" draggable={false} />
                <p className="game-overlay-title">{t('games.game_over')}</p>
                <p className="game-overlay-text">
                  {t('games.score')}: {game.points}
                </p>
                <p className="game-overlay-text">
                  {t('games.learn.total')}: {total}
                </p>
                {newBest && <p className="game-overlay-best">⭐ {t('games.new_best')}</p>}
                <div className="learn-overlay-actions">
                  <button
                    type="button"
                    className="game-action-btn"
                    onClick={() => startMiniGame(game.levelType)}
                  >
                    {t('games.play_again')}
                  </button>
                  <button type="button" className="game-action-btn secondary" onClick={backToPicker}>
                    {t('games.learn.choose_another')}
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </GamePage>
  );
}

/**
 * The mini-game picker shown when a run is not in progress. One card per
 * mini-game for the track, showing its name, points weight and this session's
 * best; the footer shows the accumulated session total and the all-time best.
 */
function MiniGamePicker({
  track,
  bestByType,
  sessionTotal: total,
  serverBest,
  onPick,
}: {
  track: Track;
  bestByType: Partial<Record<LevelType, number>>;
  sessionTotal: number;
  serverBest: number | null;
  onPick: (levelType: LevelType) => void;
}) {
  const t = useT();
  // Easiest first: order the mini-games by their score multiplier ascending.
  const ordered = [...levelTypesFor(track)].sort((a, b) => LEVEL_WEIGHT[a] - LEVEL_WEIGHT[b]);
  return (
    <div className="learn-picker">
      <p className="learn-picker-heading">{t('games.learn.choose')}</p>
      <div className="learn-picker-grid">
        {ordered.map((lt) => (
          <MiniGameCard
            key={lt}
            levelType={lt}
            best={bestByType[lt] ?? null}
            onPick={onPick}
          />
        ))}
      </div>
      <div className="learn-picker-totals">
        <span>
          {t('games.learn.total')}: {total}
        </span>
        {serverBest !== null && (
          <span>
            {t('games.best')}: {serverBest}
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * One mini-game as a flip card (like the chore/reward cards): the front shows
 * the icon, name, points multiplier, this session's best and a Play button; the
 * back reveals a short description. Tapping the card flips it; the speaker reads
 * the title + description. The Play button and speaker stop propagation so they
 * never flip the card.
 */
function MiniGameCard({
  levelType,
  best,
  onPick,
}: {
  levelType: LevelType;
  best: number | null;
  onPick: (levelType: LevelType) => void;
}) {
  const t = useT();
  const [flipped, setFlipped] = useState(false);
  const Icon = LEVEL_ICON[levelType];
  const name = t(LEVEL_NAME_KEY[levelType]);
  return (
    <div
      className={`flip-card learn-picker-flip ${flipped ? 'flipped' : ''}`}
      onClick={() => {
        playFlip();
        setFlipped((f) => !f);
      }}
    >
      <div className="flip-card-inner">
        <div className="learn-picker-card flip-card-face flip-card-front">
          <SpeakButton src={learnCardUrl(levelType)} />
          <Icon className="learn-picker-icon" size={34} aria-hidden="true" />
          <span className="learn-picker-name">{name}</span>
          <span className="learn-picker-weight">×{LEVEL_WEIGHT[levelType]}</span>
          {best != null && (
            <span className="learn-picker-best">
              {t('games.best')}: {best}
            </span>
          )}
          <button
            type="button"
            className="learn-picker-play"
            onClick={(e) => {
              e.stopPropagation();
              onPick(levelType);
            }}
          >
            {t('games.play')}
          </button>
        </div>

        <div className="learn-picker-card flip-card-face flip-card-back">
          <div className="flip-back-header">
            <Icon className="flip-back-icon" size={28} aria-hidden="true" />
            <h3 className="flip-back-title">{name}</h3>
          </div>
          <p className="flip-back-desc">{t(LEVEL_DESC_KEY[levelType])}</p>
        </div>
      </div>
    </div>
  );
}

/**
 * The per-round result panel, shown after every answer (success and failure).
 * On a mistake it explains what happened ("Διάλεξες το 8. Το σωστό ήταν το 9.");
 * on a level-up it celebrates. The kid taps Continue to move on, so they always
 * get a beat to take in the result.
 */
// How long the winning result screen lingers before auto-advancing — long
// enough for the jingle to finish, plus a short beat to enjoy it.
const WIN_RESULT_MS = WIN_TUNE_MAX_MS + 500;

function ResultPanel({ pending, onContinue }: { pending: Pending; onContinue: () => void }) {
  const t = useT();
  const { correct, feedback, levelType, events, next } = pending;

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
  if (correct && events.includes('level_up')) {
    emoji = '🎉';
    title = t('games.learn.level_up', { level: String(levelNumber(next)) });
  } else if (correct) {
    emoji = '⭐';
    title = t('games.learn.correct_title');
  } else {
    emoji = '🙈'; // see-no-evil monkey (Unicode 6.0) — a gentle "oops", not a sad face
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
  playFindAll,
  playFindStartsWith,
  playVocab,
}: {
  round: Round;
  onAnswer: (correct: boolean, feedback: RoundFeedback) => void;
  playToken: (token: string) => void;
  playFind: (token: string) => void;
  playFindAll: (token: string) => void;
  playFindStartsWith: (token: string) => void;
  playVocab: (id: string) => void;
}) {
  switch (round.kind) {
    case 'count':
      return <CountThem round={round} onAnswer={onAnswer} playToken={playToken} />;
    case 'match':
      return <MatchCase round={round} onAnswer={onAnswer} playToken={playToken} playVocab={playVocab} />;
    case 'hear':
      return (
        <HearIt
          round={round}
          onAnswer={onAnswer}
          playFind={playFind}
          playFindAll={playFindAll}
          playFindStartsWith={playFindStartsWith}
        />
      );
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
