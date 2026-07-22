import { useMemo, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Play, RefreshCw, Upload } from 'lucide-react';
import {
  getAdminExerciseStats,
  rescanExercises,
  uploadExerciseBundles,
} from '../../api/client';
import type { DuplicateBundleId } from '../../lib/types';
import { useT } from '../../i18n/store';
import { notifyError, notifyInfo, notifySuccess } from '../../lib/notify';
import { Avatar } from '../../components/Avatar';
import { Pagination, usePagination } from '../../components/Pagination';
import './AdminPage.css';

export function AdminExercisesPage() {
  const t = useT();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { data, isLoading } = useQuery({ queryKey: ['admin-exercise-stats'], queryFn: getAdminExerciseStats });

  const notifyDuplicates = (duplicates: DuplicateBundleId[]) => {
    if (duplicates.length > 0) {
      notifyError(t('exercises.admin.duplicate_warning', { count: String(duplicates.length) }));
    }
  };

  const rescan = useMutation({
    mutationFn: rescanExercises,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['admin-exercise-stats'] });
      notifySuccess(t('exercises.admin.rescan_done', { valid: String(result.valid) }));
      if (result.invalid > 0) {
        notifyInfo(t('exercises.admin.rescan_invalid', { invalid: String(result.invalid) }));
      }
      notifyDuplicates(result.duplicates);
    },
    onError: () => notifyError(t('exercises.admin.rescan_failed')),
  });

  const upload = useMutation({
    mutationFn: uploadExerciseBundles,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['admin-exercise-stats'] });
      notifySuccess(
        t('exercises.admin.upload_done', {
          extracted: String(result.extracted),
          valid: String(result.valid),
        }),
      );
      if (result.invalid > 0) {
        notifyInfo(t('exercises.admin.rescan_invalid', { invalid: String(result.invalid) }));
      }
      notifyDuplicates(result.duplicates);
    },
    onError: (err: Error) => notifyError(err.message || t('exercises.admin.upload_failed')),
  });

  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset so re-selecting the same file re-fires onChange.
    e.target.value = '';
    if (file) upload.mutate(file);
  };

  const sortedBundles = useMemo(
    () => (data?.bundles ?? []).slice().sort((a, b) => a.difficulty - b.difficulty),
    [data],
  );
  const bundlePager = usePagination(sortedBundles);

  if (isLoading || !data) {
    return <div className="exercises-hub" />;
  }

  const { bundles, invalid, duplicates, kid_stats } = data;

  return (
    <div className="exercises-hub">
      <h2>📚 {t('exercises.admin.title')}</h2>

      <div style={{ marginBottom: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button
          type="button"
          className="admin-btn admin-btn-primary"
          disabled={rescan.isPending || upload.isPending}
          onClick={() => rescan.mutate()}
        >
          <RefreshCw size={16} aria-hidden="true" style={{ marginRight: 6 }} />
          {t('exercises.admin.rescan')}
        </button>
        <button
          type="button"
          className="admin-btn"
          disabled={rescan.isPending || upload.isPending}
          title={t('exercises.admin.upload_hint')}
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload size={16} aria-hidden="true" style={{ marginRight: 6 }} />
          {t('exercises.admin.upload')}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".zip,application/zip"
          style={{ display: 'none' }}
          onChange={onPickFile}
        />
      </div>

      {duplicates.length > 0 && (
        <>
          <h3 className="admin-page-title" style={{ color: 'var(--danger, #e53e3e)' }}>
            ⚠️ {t('exercises.admin.duplicate_heading')}
          </h3>
          <table className="admin-table">
            <thead>
              <tr>
                <th>{t('exercises.admin.col_id')}</th>
                <th>{t('exercises.admin.col_paths')}</th>
              </tr>
            </thead>
            <tbody>
              {duplicates.map((d) => (
                <tr key={d.id}>
                  <td style={{ fontFamily: 'monospace' }}>{d.id}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--danger, #e53e3e)' }}>
                    {d.paths.join(', ')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <h3 className="admin-page-title">{t('exercises.admin.bundles_heading')}</h3>
      {bundles.length === 0 ? (
        <p className="exercises-empty">{t('exercises.admin.no_bundles')}</p>
      ) : (
        <table className="admin-table">
          <thead>
            <tr>
              <th>{t('exercises.title')}</th>
              <th>{t('exercises.admin.col_path')}</th>
              <th>{t('exercises.admin.col_age')}</th>
              <th>{t('exercises.admin.col_difficulty')}</th>
              <th>{t('exercises.admin.col_stars')}</th>
              <th>{t('exercises.admin.col_count')}</th>
              <th>{t('exercises.admin.col_preview')}</th>
            </tr>
          </thead>
          <tbody>
            {bundlePager.pageItems.map((b) => (
              <tr key={b.id}>
                <td>
                  <span style={{ marginRight: 6 }}>{t(`exercises.subject.${b.subject}`)}</span>
                  {b.title}
                </td>
                <td style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--text-muted, #718096)' }}>
                  {b.path}
                </td>
                <td>{t('exercises.admin.age_range', { min: String(b.age_min), max: String(b.age_max) })}</td>
                <td>{b.difficulty}/5</td>
                <td>{b.stars}</td>
                <td>{b.exercise_count}</td>
                <td>
                  <Link to={b.id} className="admin-btn" style={{ textDecoration: 'none' }} aria-label={t('exercises.admin.preview')}>
                    <Play size={16} aria-hidden="true" />
                    {t('exercises.admin.preview')}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <Pagination page={bundlePager.page} pageCount={bundlePager.pageCount} onChange={bundlePager.setPage} />

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
