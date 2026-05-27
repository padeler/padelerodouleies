import { useQuery } from '@tanstack/react-query';
import { getAdminHistory, getAdminUsers } from '../../api/client';
import { useT } from '../../i18n/store';
import type { HistoryEntry, AdminUser } from '../../lib/types';
import { useState } from 'react';
import './AdminPage.css';

const actionTypes = [
  { value: 'chore_approved', key: 'history.action_label_approved' },
  { value: 'chore_declined', key: 'history.action_label_declined' },
  { value: 'manual_adjust', key: 'history.action_label_manual' },
  { value: 'reward_purchase', key: 'history.action_label_purchase' },
  { value: 'reward_refund', key: 'history.action_label_refund' },
];

export function ActivityPage() {
  const t = useT();
  const [userId, setUserId] = useState<number | undefined>(undefined);
  const [actionType, setActionType] = useState<string>('');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');

  const { data: users } = useQuery({
    queryKey: ['admin-users'],
    queryFn: getAdminUsers,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['admin-history', userId, actionType, fromDate, toDate],
    queryFn: () => getAdminHistory({
      userId,
      actionType: actionType || undefined,
      fromDate: fromDate || undefined,
      toDate: toDate || undefined,
      limit: 50,
      offset: 0,
    }),
  });

  const clearFilters = () => {
    setUserId(undefined);
    setActionType('');
    setFromDate('');
    setToDate('');
  };

  if (isLoading) return <div>{t('common.loading')}</div>;

  return (
    <div>
      <h2 className="admin-page-title">{t('nav.activity')}</h2>
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted, #888)' }}>{t('nav.users')}</label>
          <select
            value={userId ?? ''}
            onChange={(e) => setUserId(e.target.value ? Number(e.target.value) : undefined)}
            style={{ padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg-s, rgba(255,255,255,0.05))', color: 'var(--text)' }}
          >
            <option value="">All</option>
            {(users as AdminUser[])?.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted, #888)' }}>{t('chore.scope')}</label>
          <select
            value={actionType}
            onChange={(e) => setActionType(e.target.value)}
            style={{ padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg-s, rgba(255,255,255,0.05))', color: 'var(--text)' }}
          >
            <option value="">All</option>
            {actionTypes.map((at) => (
              <option key={at.value} value={at.value}>{t(at.key)}</option>
            ))}
          </select>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted, #888)' }}>From</label>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            style={{ padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg-s, rgba(255,255,255,0.05))', color: 'var(--text)' }}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted, #888)' }}>To</label>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            style={{ padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg-s, rgba(255,255,255,0.05))', color: 'var(--text)' }}
          />
        </div>
        <button className="admin-btn" onClick={clearFilters}>
          <span className="btn-icon">✕</span>
          <span className="btn-text">{t('btn.clear')}</span>
        </button>
      </div>
      <div className="admin-table-wrap">
        <table className="admin-table">
        <thead>
          <tr>
            <th>Time</th>
            <th>{t('nav.users')}</th>
            <th>Action</th>
            <th>Delta</th>
            <th>Note</th>
          </tr>
        </thead>
        <tbody>
          {(data?.entries as HistoryEntry[])?.map((entry) => (
            <tr key={entry.id}>
              <td>{new Date(entry.timestamp).toLocaleString()}</td>
              <td>{entry.user_name}</td>
              <td>{entry.action_label || entry.action_type}</td>
              <td style={{ color: entry.points_delta >= 0 ? '#4c8' : '#e55' }}>
                {entry.points_delta > 0 ? '+' : ''}{entry.points_delta}
              </td>
              <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {entry.admin_note || '—'}
              </td>
            </tr>
          ))}
          {!data?.entries?.length && (
            <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted, #888)' }}>{t('history.empty')}</td></tr>
          )}
        </tbody>
      </table>
      </div>
      <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted, #888)' }}>
        Total: {data?.total} entries
      </div>
    </div>
  );
}
