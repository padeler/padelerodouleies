import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { useT } from '../../../i18n/store';
import { SpeakButton } from '../../../components/SpeakButton';
import { exerciseBundleTitleTtsUrl } from '../../../api/client';
import { useExerciseBundles } from './useExercises';
import type { ExerciseSubject } from '../../../lib/types';
import '../flip-card.css'; // .speak-btn styles
import './Exercises.css';

function DifficultyDots({ value }: { value: number }) {
  return (
    <span className="exercise-difficulty">
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={`difficulty-dot${i <= value ? ' filled' : ''}`} />
      ))}
    </span>
  );
}

/** Completion filter over the group. `not_started` is the default so the list
 *  stays short as more bundles are added. */
type CompletionFilter = 'not_started' | 'completed' | 'all';

const FILTERS: CompletionFilter[] = ['not_started', 'completed', 'all'];

function matchesFilter(completed: boolean, filter: CompletionFilter): boolean {
  if (filter === 'all') return true;
  return filter === 'completed' ? completed : !completed;
}

/** Bundles within one subject group, sorted easier → harder. */
export function BundleList() {
  const t = useT();
  const { subject } = useParams<{ subject: string }>();
  const { data: bundles, isLoading } = useExerciseBundles();
  const [filter, setFilter] = useState<CompletionFilter>('not_started');

  const inGroup = (bundles ?? [])
    .filter((b) => b.subject === subject)
    .slice()
    .sort((a, b) => a.difficulty - b.difficulty);
  const shown = inGroup.filter((b) => matchesFilter(b.completed, filter));

  return (
    <div className="exercises-hub">
      <div className="exercises-head">
        {/* Base-relative so it resolves under /dashboard or /admin. */}
        <Link to=".." relative="path" className="exercise-back">
          ← {t('exercises.back')}
        </Link>
        <h2>{subject ? t(`exercises.subject.${subject as ExerciseSubject}`) : ''}</h2>
        {inGroup.length > 0 && (
          <div className="exercise-filter" role="group">
            {FILTERS.map((f) => {
              const count = inGroup.filter((b) => matchesFilter(b.completed, f)).length;
              return (
                <button
                  key={f}
                  type="button"
                  className={`exercise-filter-btn${f === filter ? ' active' : ''}`}
                  aria-pressed={f === filter}
                  onClick={() => setFilter(f)}
                >
                  {t(`exercises.filter.${f}`)} <span className="exercise-filter-count">{count}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
      {isLoading ? null : inGroup.length === 0 ? (
        <p className="exercises-empty">{t('exercises.empty')}</p>
      ) : shown.length === 0 ? (
        <p className="exercises-empty">{t('exercises.filter_empty')}</p>
      ) : (
        <div className="exercises-grid">
          {shown.map((b) => (
            <div key={b.id} className="exercise-bundle-card-wrap">
              {/* SpeakButton is a sibling of the Link (not nested in the anchor)
                  so tapping it never navigates into the bundle. */}
              <SpeakButton src={exerciseBundleTitleTtsUrl(b.id)} />
              <Link to={b.id} className={`exercise-bundle-card ${b.completed ? 'done' : ''}`}>
                <span className="exercise-bundle-title">{b.title}</span>
                <span className="exercise-bundle-meta">
                  {t('exercises.exercise_count', { count: String(b.exercise_count) })}
                </span>
                {/* Completed status + difficulty + stars pinned to the card bottom. */}
                <div className="exercise-bundle-foot">
                  {b.completed && (
                    <span className="exercise-done-badge">
                      <CheckCircle2 size={16} aria-hidden="true" /> {t('exercises.completed')}
                    </span>
                  )}
                  <DifficultyDots value={b.difficulty} />
                  <span className="exercise-bundle-stars">⭐ {b.stars}</span>
                </div>
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
