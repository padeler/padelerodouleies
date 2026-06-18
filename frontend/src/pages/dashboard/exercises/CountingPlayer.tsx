import { exerciseAssetUrl } from '../../../api/client';
import type { ExerciseView } from '../../../lib/types';

interface Props {
  bundleId: string;
  exercise: ExerciseView;
  disabled: boolean;
  onAnswer: (response: number) => void;
}

/**
 * "How many X?" — show the scene image, then a grid of numbers `0..max_count`
 * (inclusive). Tapping a number posts that integer; the server compares exactly.
 * Big tap targets, no free-text field (invariant #1 ethos, tablet-first).
 */
export function CountingPlayer({ bundleId, exercise, disabled, onAnswer }: Props) {
  const max = exercise.max_count ?? 10;
  const numbers = Array.from({ length: max + 1 }, (_, n) => n);

  return (
    <div className="counting">
      {exercise.image && (
        <div className="counting-scene">
          <img
            className="counting-img"
            src={exerciseAssetUrl(bundleId, exercise.image)}
            alt=""
          />
        </div>
      )}
      <div className="count-pad">
        {numbers.map((n) => (
          <button
            key={n}
            type="button"
            className="count-key"
            disabled={disabled}
            onClick={() => onAnswer(n)}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}
