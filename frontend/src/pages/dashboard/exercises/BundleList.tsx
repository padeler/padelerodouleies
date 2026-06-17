import { Link, useParams } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { useT } from '../../../i18n/store';
import { useExerciseBundles } from './useExercises';
import type { ExerciseSubject } from '../../../lib/types';
import './Exercises.css';

/** Bundles within one subject group. */
export function BundleList() {
  const t = useT();
  const { subject } = useParams<{ subject: string }>();
  const { data: bundles, isLoading } = useExerciseBundles();

  const inGroup = (bundles ?? []).filter((b) => b.subject === subject);

  return (
    <div className="exercises-hub">
      <div className="exercises-head">
        {/* Base-relative so it resolves under /dashboard or /admin. */}
        <Link to=".." relative="path" className="exercise-back">
          ← {t('exercises.back')}
        </Link>
        <h2>{subject ? t(`exercises.subject.${subject as ExerciseSubject}`) : ''}</h2>
      </div>
      {!isLoading && inGroup.length === 0 ? (
        <p className="exercises-empty">{t('exercises.empty')}</p>
      ) : (
        <div className="exercises-grid">
          {inGroup.map((b) => (
            <Link key={b.id} to={b.id} className={`exercise-bundle-card ${b.completed ? 'done' : ''}`}>
              {b.completed && (
                <span className="exercise-done-badge">
                  <CheckCircle2 size={16} aria-hidden="true" /> {t('exercises.completed')}
                </span>
              )}
              <span className="exercise-bundle-title">{b.title}</span>
              <span className="exercise-bundle-meta">
                {t('exercises.exercise_count', { count: String(b.exercise_count) })}
              </span>
              <span className="exercise-bundle-stars">⭐ {b.stars}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
