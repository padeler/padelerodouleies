import { Check } from 'lucide-react';
import { exerciseAssetUrl } from '../../../api/client';
import { useT } from '../../../i18n/store';
import type { ExerciseOption, ExerciseView } from '../../../lib/types';

interface Props {
  bundleId: string;
  exercise: ExerciseView;
  /** The kid's stored correct response (they advance only on a correct answer). */
  response: unknown;
}

/** Image and/or text face for an option/item, read-only. */
function Face({ bundleId, opt }: { bundleId: string; opt: ExerciseOption }) {
  return (
    <>
      {opt.image && (
        <span className="reveal-img-wrap">
          <img className="reveal-img" src={exerciseAssetUrl(bundleId, opt.image)} alt={opt.text ?? ''} />
        </span>
      )}
      {opt.text && <span className="reveal-text">{opt.text}</span>}
    </>
  );
}

/**
 * Read-only display of a previously-solved exercise's correct answer. A kid can
 * only move past a question by answering it correctly, so the stored response is
 * the correct answer — shown here without any interactive controls so the
 * question cannot be replayed.
 */
export function RevealedAnswer({ bundleId, exercise, response }: Props) {
  const t = useT();
  return (
    <div className="exercise-revealed">
      <div className="reveal-label">
        <Check size={18} aria-hidden="true" /> {t('exercises.solved')}
      </div>
      <div className="reveal-body">{renderAnswer(bundleId, exercise, response)}</div>
    </div>
  );
}

function renderAnswer(bundleId: string, exercise: ExerciseView, response: unknown) {
  switch (exercise.type) {
    case 'multiple_choice': {
      const opt = (exercise.options ?? []).find((o) => o.id === response);
      return opt ? (
        <div className="reveal-chip">
          <Face bundleId={bundleId} opt={opt} />
        </div>
      ) : null;
    }
    case 'numeric_entry':
    case 'counting':
    case 'decimal_entry':
      return <div className="reveal-number">{String(response ?? '')}</div>;
    case 'fraction_entry': {
      const frac = response as { numerator?: number; denominator?: number } | null;
      return frac ? (
        <div className="reveal-fraction">
          <span className="reveal-frac-num">{frac.numerator}</span>
          <span className="reveal-frac-bar" />
          <span className="reveal-frac-den">{frac.denominator}</span>
        </div>
      ) : null;
    }
    case 'ordering': {
      const ids = (response as string[] | null) ?? [];
      const byId = (id: string) => (exercise.items ?? []).find((i) => i.id === id);
      return (
        <div className="reveal-sequence">
          {ids.map((id, i) => {
            const item = byId(id);
            return item ? (
              <div key={id} className="reveal-chip">
                <span className="reveal-index">{i + 1}</span>
                <Face bundleId={bundleId} opt={item} />
              </div>
            ) : null;
          })}
        </div>
      );
    }
    case 'match_pairs': {
      const links = (response as Record<string, string> | null) ?? {};
      const pairs = exercise.pairs ?? [];
      const leftById = (id: string) => pairs.find((p) => p.left.id === id)?.left;
      const rightById = (id: string) => pairs.find((p) => p.right.id === id)?.right;
      return (
        <div className="reveal-pairs">
          {Object.entries(links).map(([leftId, rightId]) => {
            const left = leftById(leftId);
            const right = rightById(rightId);
            return left && right ? (
              <div key={leftId} className="reveal-pair-row">
                <div className="reveal-chip">
                  <Face bundleId={bundleId} opt={left} />
                </div>
                <span className="reveal-pair-arrow">→</span>
                <div className="reveal-chip">
                  <Face bundleId={bundleId} opt={right} />
                </div>
              </div>
            ) : null;
          })}
        </div>
      );
    }
    default:
      return null;
  }
}
