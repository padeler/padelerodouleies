import { useEffect, useMemo, useState } from 'react';
import { exerciseAssetUrl, exerciseOptionTtsUrl } from '../../../api/client';
import { SpeakButton } from '../../../components/SpeakButton';
import { useT } from '../../../i18n/store';
import { shuffle } from '../../../lib/shuffle';
import type { ExerciseOption, ExerciseView } from '../../../lib/types';

interface Props {
  bundleId: string;
  exercise: ExerciseView;
  disabled: boolean;
  /** Clears the in-progress sequence when the parent bumps it (after a miss). */
  resetSignal: number;
  onAnswer: (response: string[]) => void;
}

/** One orderable item: image (square trick) and/or text. */
function ItemFace({ bundleId, item }: { bundleId: string; item: ExerciseOption }) {
  return (
    <>
      {item.image && (
        <span className="order-item-img-wrap">
          <img className="order-item-img" src={exerciseAssetUrl(bundleId, item.image)} alt={item.text ?? ''} />
        </span>
      )}
      {item.text && <span className="order-item-text">{item.text}</span>}
    </>
  );
}

/**
 * Arrange items into a sequence by tapping (no HTML5 drag-and-drop — unreliable
 * touch on the Samsung Tab 4). Tap a tray item to append it to the answer row;
 * tap a placed item to send it back. Submit once every item is placed.
 */
export function OrderingPlayer({ bundleId, exercise, disabled, resetSignal, onAnswer }: Props) {
  const t = useT();
  const items = useMemo(() => exercise.items ?? [], [exercise.items]);
  const order = useMemo(() => shuffle(items), [exercise.id, items]);
  const [placed, setPlaced] = useState<string[]>([]);

  // Clear progress on a wrong try (resetSignal bump) or when the exercise changes.
  useEffect(() => {
    setPlaced([]);
  }, [resetSignal, exercise.id]);

  const byId = (id: string) => items.find((i) => i.id === id)!;
  const remaining = order.filter((i) => !placed.includes(i.id));

  const place = (id: string) => {
    if (disabled) return;
    setPlaced((p) => (p.includes(id) ? p : [...p, id]));
  };
  const remove = (id: string) => {
    if (disabled) return;
    setPlaced((p) => p.filter((x) => x !== id));
  };
  const submit = () => {
    if (disabled || placed.length !== items.length) return;
    onAnswer(placed);
  };

  return (
    <div className="ordering">
      <div className="order-answer-row">
        {placed.length === 0 && <span className="order-placeholder">{t('exercises.tap_to_order')}</span>}
        {placed.map((id, i) => (
          <button
            key={id}
            type="button"
            className="order-item order-placed"
            disabled={disabled}
            onClick={() => remove(id)}
          >
            <span className="order-item-index">{i + 1}</span>
            <ItemFace bundleId={bundleId} item={byId(id)} />
          </button>
        ))}
      </div>

      <div className="order-tray">
        {remaining.map((item) => (
          <div key={item.id} className="order-item-wrap">
            <button
              type="button"
              className="order-item"
              disabled={disabled}
              onClick={() => place(item.id)}
            >
              <ItemFace bundleId={bundleId} item={item} />
            </button>
            {item.text && (
              <SpeakButton src={exerciseOptionTtsUrl(bundleId, exercise.id, item.id)} />
            )}
          </div>
        ))}
      </div>

      <button
        type="button"
        className="order-check"
        disabled={disabled || placed.length !== items.length}
        onClick={submit}
      >
        {t('exercises.check')}
      </button>
    </div>
  );
}
