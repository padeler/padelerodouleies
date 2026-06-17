import { useMemo } from 'react';
import { exerciseAssetUrl } from '../../../api/client';
import type { ExerciseView } from '../../../lib/types';

function shuffle<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = a[i]!;
    a[i] = a[j]!;
    a[j] = tmp;
  }
  return a;
}

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
        <button
          key={opt.id}
          type="button"
          className="mc-option"
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
      ))}
    </div>
  );
}
