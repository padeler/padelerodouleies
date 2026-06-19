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
          <span key={ex.id} className={`exercise-dot ${i < idx ? 'dot-done' : ''} ${i === idx ? 'dot-active' : ''}`} />
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
        <span className="exercise-prompt-text">{exercise.prompt}</span>
        <SpeakButton src={exerciseTtsUrl(bundleId, exercise.id, 'prompt')} />
      </div>

      {exercise.type === 'numeric_entry' ? (
        <NumericEntryPlayer
          exercise={exercise}
          disabled={submit.isPending || feedback === 'correct'}
          resetSignal={resetSignal}
          onAnswer={handleAnswer}
        />
      ) : exercise.type === 'multiple_choice' ? (
        <MultipleChoicePlayer
          bundleId={bundleId}
          exercise={exercise}
          disabled={submit.isPending || feedback === 'correct'}
          onAnswer={handleAnswer}
        />
      ) : exercise.type === 'counting' ? (
        <CountingPlayer
          bundleId={bundleId}
          exercise={exercise}
          disabled={submit.isPending || feedback === 'correct'}
          onAnswer={handleAnswer}
        />
      ) : exercise.type === 'ordering' ? (
        <OrderingPlayer
          bundleId={bundleId}
          exercise={exercise}
          disabled={submit.isPending || feedback === 'correct'}
          resetSignal={resetSignal}
          onAnswer={handleAnswer}
        />
      ) : exercise.type === 'match_pairs' ? (
        <MatchPairsPlayer
          bundleId={bundleId}
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
    </div>
  );
}
