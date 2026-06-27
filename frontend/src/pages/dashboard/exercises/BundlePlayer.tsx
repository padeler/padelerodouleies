import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useT } from '../../../i18n/store';
import { SpeakButton } from '../../../components/SpeakButton';
import { exerciseAssetUrl, exerciseTtsUrl } from '../../../api/client';
import { notifyCelebration } from '../../../lib/notify';
import { playReward, playSuccess, playWrong } from '../../../lib/sound';
import { useExerciseBundle, useSubmitAnswer } from './useExercises';
import { MultipleChoicePlayer } from './MultipleChoicePlayer';
import { NumericEntryPlayer } from './NumericEntryPlayer';
import { CountingPlayer } from './CountingPlayer';
import { OrderingPlayer } from './OrderingPlayer';
import { MatchPairsPlayer } from './MatchPairsPlayer';
import { DecimalEntryPlayer } from './DecimalEntryPlayer';
import { FractionEntryPlayer } from './FractionEntryPlayer';
import { RevealedAnswer } from './RevealedAnswer';
import '../flip-card.css'; // .speak-btn styles
import './Exercises.css';

type Feedback = 'none' | 'correct' | 'wrong';

/** Plays one bundle: one exercise at a time, instant feedback, hint after a miss. */
export function BundlePlayer() {
  const t = useT();
  const { bundleId = '' } = useParams<{ bundleId: string }>();
  const { data: manifest, isLoading } = useExerciseBundle(bundleId);
  const submit = useSubmitAnswer(bundleId);

  const [idx, setIdx] = useState(0);
  // First-unsolved index: questions before it are solved and read-only. A kid can
  // only pass a question by answering it correctly, so everything < frontier has a
  // stored correct answer to reveal.
  const [frontier, setFrontier] = useState(0);
  const [answers, setAnswers] = useState<Record<number, unknown>>({});
  const [feedback, setFeedback] = useState<Feedback>('none');
  const [missed, setMissed] = useState(false); // reveal the hint after the first miss
  const [resetSignal, setResetSignal] = useState(0); // clears the numeric pad on a wrong try
  const [finished, setFinished] = useState(false);
  const [stars, setStars] = useState(0);

  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const later = (fn: () => void, ms: number) => {
    timers.current.push(setTimeout(fn, ms));
  };

  if (isLoading || !manifest) {
    return <div className="exercises-hub" />;
  }

  const exercises = manifest.exercises;

  if (finished) {
    return (
      <div className="exercises-hub exercise-finish">
        <div className="exercise-finish-emoji">🎉</div>
        <h2>{t('exercises.well_done')}</h2>
        {stars > 0 && <p className="exercise-finish-stars">{t('exercises.earned_stars', { stars: String(stars) })}</p>}
        <Link to=".." relative="path" className="exercise-finish-back">
          ← {t('exercises.back')}
        </Link>
      </div>
    );
  }

  const exercise = exercises[idx];
  if (!exercise) {
    return <div className="exercises-hub" />;
  }

  async function handleAnswer(response: unknown) {
    if (submit.isPending || feedback === 'correct') return;
    try {
      const result = await submit.mutateAsync({ exerciseId: exercise!.id, response });
      if (result.correct) {
        setFeedback('correct');
        playReward();
        // Record the correct response so this question can be revisited read-only.
        setAnswers((prev) => ({ ...prev, [idx]: response }));
        setFrontier((f) => Math.max(f, idx + 1));
        const isLast = idx === exercises.length - 1;
        if (isLast) {
          setStars(result.stars_awarded);
          later(() => {
            playSuccess();
            notifyCelebration(t('exercises.well_done'));
            setFinished(true);
          }, 600);
        } else {
          later(() => {
            setIdx((i) => i + 1);
            setMissed(false);
            setFeedback('none');
          }, 900);
        }
      } else {
        setFeedback('wrong');
        setMissed(true);
        playWrong();
        setResetSignal((s) => s + 1);
        later(() => setFeedback('none'), 800);
      }
    } catch {
      setFeedback('none');
    }
  }

  // A question before the frontier is already solved → shown read-only.
  const isSolved = idx < frontier;

  // Jump to any solved question or the active one (never skip ahead to unsolved).
  const goTo = (target: number) => {
    if (target < 0 || target > frontier || target === idx) return;
    setIdx(target);
    setMissed(false);
    setFeedback('none');
  };

  return (
    <div className="exercise-player">
      <div className="exercises-head">
        <Link to=".." relative="path" className="exercise-back">
          ← {t('exercises.back')}
        </Link>
        <span className="exercise-bundle-name">{manifest.title}</span>
        <span className="exercise-progress-text">
          {t('exercises.progress', { current: String(idx + 1), total: String(exercises.length) })}
        </span>
      </div>

      <div className="exercise-progress-dots">
        {exercises.map((ex, i) => (
          <button
            key={ex.id}
            type="button"
            className={`exercise-dot ${i < frontier ? 'dot-done' : ''} ${i === idx ? 'dot-active' : ''}`}
            disabled={i > frontier}
            aria-label={t('exercises.progress', { current: String(i + 1), total: String(exercises.length) })}
            onClick={() => goTo(i)}
          />
        ))}
      </div>

      {exercise.image && (
        <div className="exercise-scene">
          <img
            className="exercise-scene-img"
            src={exerciseAssetUrl(bundleId, exercise.image)}
            alt=""
          />
        </div>
      )}

      <div className={`exercise-prompt feedback-${feedback}`}>
        {exercise.icon && (
          <img
            className="exercise-prompt-icon"
            src={exerciseAssetUrl(bundleId, exercise.icon)}
            alt=""
          />
        )}
        <span className="exercise-prompt-text">{exercise.prompt}</span>
        <SpeakButton src={exerciseTtsUrl(bundleId, exercise.id, 'prompt')} />
      </div>

      {isSolved ? (
        <RevealedAnswer bundleId={bundleId} exercise={exercise} response={answers[idx]} />
      ) : exercise.type === 'numeric_entry' ? (
        <NumericEntryPlayer
          key={exercise.id}
          exercise={exercise}
          disabled={submit.isPending || feedback === 'correct'}
          resetSignal={resetSignal}
          onAnswer={handleAnswer}
        />
      ) : exercise.type === 'multiple_choice' ? (
        <MultipleChoicePlayer
          key={exercise.id}
          bundleId={bundleId}
          exercise={exercise}
          disabled={submit.isPending || feedback === 'correct'}
          onAnswer={handleAnswer}
        />
      ) : exercise.type === 'counting' ? (
        <CountingPlayer
          key={exercise.id}
          bundleId={bundleId}
          exercise={exercise}
          disabled={submit.isPending || feedback === 'correct'}
          onAnswer={handleAnswer}
        />
      ) : exercise.type === 'ordering' ? (
        <OrderingPlayer
          key={exercise.id}
          bundleId={bundleId}
          exercise={exercise}
          disabled={submit.isPending || feedback === 'correct'}
          resetSignal={resetSignal}
          onAnswer={handleAnswer}
        />
      ) : exercise.type === 'match_pairs' ? (
        <MatchPairsPlayer
          key={exercise.id}
          bundleId={bundleId}
          exercise={exercise}
          disabled={submit.isPending || feedback === 'correct'}
          resetSignal={resetSignal}
          onAnswer={handleAnswer}
        />
      ) : exercise.type === 'decimal_entry' ? (
        <DecimalEntryPlayer
          key={exercise.id}
          exercise={exercise}
          disabled={submit.isPending || feedback === 'correct'}
          resetSignal={resetSignal}
          onAnswer={handleAnswer}
        />
      ) : exercise.type === 'fraction_entry' ? (
        <FractionEntryPlayer
          key={exercise.id}
          exercise={exercise}
          disabled={submit.isPending || feedback === 'correct'}
          resetSignal={resetSignal}
          onAnswer={handleAnswer}
        />
      ) : (
        <div className="exercise-unsupported">
          {t('exercises.unsupported_type')}
        </div>
      )}

      {feedback !== 'none' && (
        <div className={`exercise-feedback feedback-${feedback}`}>
          {feedback === 'correct' ? t('exercises.correct') : t('exercises.wrong')}
        </div>
      )}

      {missed && exercise.hint && (
        <div className="exercise-hint">
          <span className="exercise-hint-label">💡 {t('exercises.hint')}:</span>
          <span className="exercise-hint-text">{exercise.hint}</span>
          <SpeakButton src={exerciseTtsUrl(bundleId, exercise.id, 'hint')} />
        </div>
      )}

      <div className="exercise-nav">
        <button
          type="button"
          className="exercise-nav-btn"
          disabled={idx === 0}
          onClick={() => goTo(idx - 1)}
        >
          ‹ {t('exercises.prev')}
        </button>
        <button
          type="button"
          className="exercise-nav-btn"
          disabled={idx >= frontier}
          onClick={() => goTo(idx + 1)}
        >
          {t('exercises.next_q')} ›
        </button>
      </div>
    </div>
  );
}
