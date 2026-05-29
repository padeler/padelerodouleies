import { useQuery } from '@tanstack/react-query';
import { getKidHistory } from '../../api/client';
import { useT, useLocale } from '../../i18n/store';
import type { KidHistoryEntry } from '../../lib/types';
import './KidHistory.css';

function getEntryColor(entry: KidHistoryEntry) {
  if (entry.action_type === 'chore_approved') return 'history-approved';
  if (entry.action_type === 'chore_declined' && entry.points_delta < 0) return 'history-declined';
  if (entry.action_type === 'manual_adjust') return 'history-manual';
  if (entry.action_type === 'reward_purchase') return 'history-reward';
  return 'history-default';
}

function getActionLabel(entry: KidHistoryEntry, t: (key: string, params?: Record<string, string>) => string) {
  if (entry.action_type === 'chore_approved') return t('history.action_approved');
  if (entry.action_type === 'chore_declined') return t('history.action_declined', { reason: entry.admin_note ?? '' });
  if (entry.action_type === 'manual_adjust') return t('history.action_manual', { reason: entry.admin_note ?? '' });
  if (entry.action_type === 'reward_purchase') return t('history.action_purchase', { title: entry.item_title ?? entry.chore_title ?? '' });
  return entry.action_type;
}

export function KidHistory() {
  const t = useT();
  const locale = useLocale();

  const { data, isLoading } = useQuery({
    queryKey: ['kid-history'],
    queryFn: () => getKidHistory({ limit: 50 }),
  });

  if (isLoading) return <div className="page-loading">{t('common.loading')}</div>;

  const entries = data?.entries ?? [];

  return (
    <div className="kid-history">
      <h2>{t('nav.history')}</h2>
      {entries.length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon">📜</span>
          <p>{t('history.empty')}</p>
        </div>
      ) : (
        <div className="history-timeline">
          {entries.map((entry) => {
            const title = entry.item_title ?? entry.chore_title ?? '';
            const label = getActionLabel(entry, t);
            const note = entry.admin_note ?? '';
            const sign = entry.points_delta >= 0 ? '+' : '';

            const rawIcon = entry.item_icon ?? entry.chore_icon;
            const iconSrc = rawIcon
              ? rawIcon.startsWith('/') ? rawIcon : `/api/icons/svg/${rawIcon}`
              : null;

            return (
              <div key={entry.id} className={`history-entry ${getEntryColor(entry)}`}>
                <div className="history-dot" />
                <div className="history-content">
                  <div className="history-header">
                    {iconSrc && (
                      <img src={iconSrc} alt="" className="history-chore-icon" />
                    )}
                    <span className={`history-points ${sign}${entry.points_delta} ⭐`}>
                   {sign}{entry.points_delta} ⭐
                    </span>
                    <span className="history-action">{label}</span>
                  </div>
                  {title && (
                    <div className="history-chore-title">
                   — {title}
                    </div>
                  )}
                  {note && <div className="history-note">{note}</div>}
                  <div className="history-time">
                    {new Date(entry.timestamp).toLocaleString(locale === 'el' ? 'el-GR' : 'en-US', {
                   hour: '2-digit',
                   minute: '2-digit',
                   day: 'numeric',
                   month: 'short',
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
