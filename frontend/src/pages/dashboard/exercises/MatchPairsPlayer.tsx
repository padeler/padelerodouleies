import { useEffect, useMemo, useState } from 'react';
import { exerciseAssetUrl } from '../../../api/client';
import { useT } from '../../../i18n/store';
import { shuffle } from '../../../lib/shuffle';
import type { ExerciseOption, ExerciseView } from '../../../lib/types';

interface Props {
  bundleId: string;
  exercise: ExerciseView;
  disabled: boolean;
  /** Clears the in-progress links when the parent bumps it (after a miss). */
  resetSignal: number;
  onAnswer: (response: Record<string, string>) => void;
}

function Face({ bundleId, opt }: { bundleId: string; opt: ExerciseOption }) {
  return (
    <>
      {opt.image && (
        <span className="match-item-img-wrap">
          <img className="match-item-img" src={exerciseAssetUrl(bundleId, opt.image)} alt={opt.text ?? ''} />
        </span>
      )}
      {opt.text && <span className="match-item-text">{opt.text}</span>}
    </>
  );
}

/**
 * Link two columns by tapping: left sides in order, right sides shuffled
 * independently. Tap a left to select it, then a right to link them (re-tap to
 * change). Submit `{left_id: right_id}` once every left is matched. No HTML5
 * drag-and-drop — unreliable touch on the Samsung Tab 4.
 */
export function MatchPairsPlayer({ bundleId, exercise, disabled, resetSignal, onAnswer }: Props) {
  const t = useT();
  const pairs = useMemo(() => exercise.pairs ?? [], [exercise.pairs]);
  const lefts = useMemo(() => pairs.map((p) => p.left), [pairs]);
  const rights = useMemo(() => shuffle(pairs.map((p) => p.right)), [exercise.id, pairs]);

  const [selected, setSelected] = useState<string | null>(null); // selected left id
  const [links, setLinks] = useState<Record<string, string>>({}); // left_id -> right_id

  useEffect(() => {
    setSelected(null);
    setLinks({});
  }, [resetSignal, exercise.id]);

  // 1-based connection number per left column position, shared with its right.
  const leftIndex = (leftId: string) => lefts.findIndex((l) => l.id === leftId) + 1;
  const rightToLeft = (rightId: string) =>
    Object.entries(links).find(([, r]) => r === rightId)?.[0] ?? null;

  const tapLeft = (leftId: string) => {
    if (disabled) return;
    setSelected((s) => (s === leftId ? null : leftId));
  };

  const tapRight = (rightId: string) => {
    if (disabled || selected === null) return;
    setLinks((prev) => {
      const next: Record<string, string> = {};
      // Drop any existing use of this right or this left, then add the new link.
      for (const [l, r] of Object.entries(prev)) {
        if (r === rightId || l === selected) continue;
        next[l] = r;
      }
      next[selected] = rightId;
      return next;
    });
    setSelected(null);
  };

  const submit = () => {
    if (disabled || Object.keys(links).length !== lefts.length) return;
    onAnswer(links);
  };

  return (
    <div className="match-pairs">
      <div className="match-cols">
        <div className="match-col">
          {lefts.map((opt) => {
            const linked = links[opt.id] !== undefined;
            const cls = `match-item${selected === opt.id ? ' match-selected' : ''}${linked ? ' match-linked' : ''}`;
            return (
              <button key={opt.id} type="button" className={cls} disabled={disabled} onClick={() => tapLeft(opt.id)}>
                {linked && <span className="match-badge">{leftIndex(opt.id)}</span>}
                <Face bundleId={bundleId} opt={opt} />
              </button>
            );
          })}
        </div>
        <div className="match-col">
          {rights.map((opt) => {
            const ownerLeft = rightToLeft(opt.id);
            const cls = `match-item${ownerLeft ? ' match-linked' : ''}`;
            return (
              <button key={opt.id} type="button" className={cls} disabled={disabled} onClick={() => tapRight(opt.id)}>
                {ownerLeft && <span className="match-badge">{leftIndex(ownerLeft)}</span>}
                <Face bundleId={bundleId} opt={opt} />
              </button>
            );
          })}
        </div>
      </div>
      <button
        type="button"
        className="match-check"
        disabled={disabled || Object.keys(links).length !== lefts.length}
        onClick={submit}
      >
        {t('exercises.check')}
      </button>
    </div>
  );
}
