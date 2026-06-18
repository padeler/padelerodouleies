import { useQuery } from '@tanstack/react-query';
import { getAdminExerciseStats } from '../../api/client';
import { useT } from '../../i18n/store';
import { Avatar } from '../../components/Avatar';
import './AdminPage.css';

export function AdminExercisesPage() {
  const t = useT();
  const { data, isLoading } = useQuery({ queryKey: ['admin-exercise-stats'], queryFn: getAdminExerciseStats });

  if (isLoading || !data) {
    return <div className="exercises-hub" />;
  }

  const { bundles, invalid, kid_stats } = data;
  const sortedBundles = bundles.slice().sort((a, b) => a.difficulty - b.difficulty);

  return (
    <div className="exercises-hub">
      <h2>📚 {t('exercises.admin.title')}</h2>

      <h3 className="admin-page-title">{t('exercises.admin.bundles_heading')}</h3>
      {bundles.length === 0 ? (
        <p className="exercises-empty">{t('exercises.admin.no_bundles')}</p>
      ) : (
        <table className="admin-table">
          <thead>
            <tr>
              <th>{t('exercises.title')}</th>
              <th>{t('exercises.admin.col_age')}</th>
              <th>{t('exercises.admin.col_difficulty')}</th>
              <th>{t('exercises.admin.col_stars')}</th>
              <th>{t('exercises.admin.col_count')}</th>
            </tr>
          </thead>
          <tbody>
            {sortedBundles.map((b) => (
              <tr key={b.id}>
                <td>
                  <span style={{ marginRight: 6 }}>{t(`exercises.subject.${b.subject}`)}</span>
                  {b.title}
                </td>
                <td>{t('exercises.admin.age_range', { min: String(b.age_min), max: String(b.age_max) })}</td>
                <td>{b.difficulty}/5</td>
                <td>{b.stars}</td>
                <td>{b.exercise_count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {invalid.length > 0 && (
        <>
          <h3 className="admin-page-title" style={{ marginTop: 24 }}>
            {t('exercises.admin.invalid_heading')}
          </h3>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Dir</th>
                <th>Error</th>
              </tr>
            </thead>
            <tbody>
              {invalid.map((b) => (
                <tr key={b.dir}>
                  <td>{b.dir}</td>
                  <td style={{ color: 'var(--danger, #e53e3e)', fontSize: 12 }}>{b.error}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <h3 className="admin-page-title" style={{ marginTop: 24 }}>
        {t('exercises.admin.kid_stats_heading')}
      </h3>
      {kid_stats.length === 0 ? (
        <p className="exercises-empty">—</p>
      ) : (
        <table className="admin-table">
          <thead>
            <tr>
              <th></th>
              <th></th>
              <th>{t('exercises.admin.col_completed')}</th>
              <th>{t('exercises.admin.col_stars_earned')}</th>
            </tr>
          </thead>
          <tbody>
            {kid_stats.map((k) => (
              <tr key={k.user_id}>
                <td style={{ width: 40 }}>
                  <Avatar kind={k.avatar_kind} value={k.avatar_value} size={32} />
                </td>
                <td>{k.name}</td>
                <td>{t('exercises.admin.completed', { count: String(k.completed_count) })}</td>
                <td>{t('exercises.admin.stars_earned', { stars: String(k.total_stars) })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
