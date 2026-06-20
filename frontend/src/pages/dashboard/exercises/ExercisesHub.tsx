import { Link } from 'react-router-dom';
import { useT } from '../../../i18n/store';
import { useExerciseBundles } from './useExercises';
import type { ExerciseSubject } from '../../../lib/types';
import './Exercises.css';

// Fixed display order + emoji (all Unicode ≤6.1 for the old tablets).
const SUBJECTS: { key: ExerciseSubject; emoji: string }[] = [
  { key: 'language', emoji: '🔤' },
  { key: 'foreign_language', emoji: '🌐' },
  { key: 'math', emoji: '➕' },
  { key: 'geography', emoji: '🌍' },
  { key: 'history', emoji: '📜' },
  { key: 'logic', emoji: '💡' },
  { key: 'nature', emoji: '🌳' },
];

export function ExercisesHub() {
  const t = useT();
  const { data: bundles, isLoading } = useExerciseBundles();

  if (isLoading) {
    return <div className="exercises-hub" />;
  }

  // A group renders only if it has ≥1 visible bundle for this kid.
  const counts = new Map<ExerciseSubject, { total: number; done: number }>();
  for (const b of bundles ?? []) {
    const c = counts.get(b.subject) ?? { total: 0, done: 0 };
    c.total += 1;
    if (b.completed) c.done += 1;
    counts.set(b.subject, c);
  }

  const groups = SUBJECTS.filter((s) => counts.has(s.key));

  return (
    <div className="exercises-hub">
      <h2>📚 {t('exercises.title')}</h2>
      {groups.length === 0 ? (
        <p className="exercises-empty">{t('exercises.empty')}</p>
      ) : (
        <div className="exercises-grid">
          {groups.map((s) => {
            const c = counts.get(s.key)!;
            return (
              <Link key={s.key} to={s.key} className="exercise-group-card">
                <span className="exercise-group-emoji">{s.emoji}</span>
                <span className="exercise-group-title">{t(`exercises.subject.${s.key}`)}</span>
                <span className="exercise-group-meta">
                  {c.done}/{c.total}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
