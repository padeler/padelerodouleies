import { useMemo } from 'react';
import { exerciseAssetUrl, exerciseOptionTtsUrl } from '../../../api/client';
import { SpeakButton } from '../../../components/SpeakButton';
import { shuffle } from '../../../lib/shuffle';
import type { ExerciseView } from '../../../lib/types';

interface Props {
  bundleId: string;
  exercise: ExerciseView;
  disabled: boolean;
  onAnswer: (response: string) => void;
}

/** Tap one of 2–4 options (image and/or text). Options shuffled per exercise. */
export function MultipleChoicePlayer({ bundleId, exercise, disabled, onAnswer }: Props) {
  // Re-shuffles whenever the exercise changes (a fresh instance per exercise).
  const options = useMemo(() => shuffle(exercise.options ?? []), [exercise.id, exercise.options]);

  return (
    <div className={`mc-options mc-count-${options.length}`}>
      {options.map((opt) => (
        <div key={opt.id} className="mc-option-wrap">
          <button
            type="button"
            className={`mc-option${opt.image ? '' : ' mc-option-text-only'}`}
            disabled={disabled}
            onClick={() => onAnswer(opt.id)}
          >
            {opt.image && (
              <span className="mc-option-img-wrap">
                <img
                  className="mc-option-img"
                  src={exerciseAssetUrl(bundleId, opt.image)}
                  alt={opt.text ?? ''}
                />
              </span>
            )}
            {opt.text && <span className="mc-option-text">{opt.text}</span>}
          </button>
          {opt.text && (
            <SpeakButton src={exerciseOptionTtsUrl(bundleId, exercise.id, opt.id)} />
          )}
        </div>
      ))}
    </div>
  );
}
