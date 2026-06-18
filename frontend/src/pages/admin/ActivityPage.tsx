import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { getAdminHistory, getAdminUsers } from '../../api/client';
import { useT } from '../../i18n/store';
import type { HistoryEntry, AdminUser } from '../../lib/types';
import { useState } from 'react';
import { Pagination, PAGE_SIZE } from '../../components/Pagination';
import { Avatar } from '../../components/Avatar';
import { formatDateTime } from '../../lib/datetime';
import './AdminPage.css';

const actionTypes = [
  { value: 'chore_approved', key: 'history.action_label_approved' },
  { value: 'chore_declined', key: 'history.action_label_declined' },
  { value: 'manual_adjust', key: 'history.action_label_manual' },
  { value: 'reward_purchase', key: 'history.action_label_purchase' },
  { value: 'reward_refund', key: 'history.action_label_refund' },
  { value: 'exercise_complete', key: 'history.action_label_exercise' },
];

function UserAvatar({ kind, value, name }: { kind: 'icon' | 'image'; value: string; name: string }) {
  return (
    <span style={{ marginRight: 6 }}>
      <Avatar kind={kind} value={value} size={28} alt={name} />
    </span>
  );
}

function ItemIcon({ icon }: { icon: string }) {
  const src = icon.startsWith('/') ? icon : `/api/icons/svg/${icon}`;
  return (
    <img
      src={src}
      alt=""
      style={{ width: 24, height: 24, verticalAlign: 'middle', marginRight: 4 }}
    />
  );
}

export function ActivityPage() {
  const t = useT();
  const [userId, setUserId] = useState<number | undefined>(undefined);
  const [actionType, setActionType] = useState<string>('');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [page, setPage] = useState(0);

  const { data: users } = useQuery({
    queryKey: ['admin-users'],
    queryFn: getAdminUsers,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['admin-history', userId, actionType, fromDate, toDate, page],
    queryFn: () => getAdminHistory({
      userId,
      actionType: actionType || undefined,
      fromDate: fromDate || undefined,
      toDate: toDate || undefined,
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
    }),
    placeholderData: keepPreviousData,
  });

  const pageCount = Math.max(1, Math.ceil((data?.total ?? 0) / PAGE_SIZE));

  const clearFilters = () => {
    setUserId(undefined);
    setActionType('');
    setFromDate('');
    setToDate('');
    setPage(0);
  };

  const inputStyle = { padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg-s, rgba(255,255,255,0.05))', color: 'var(--text)' };
  const labelStyle = { fontSize: 12, fontWeight: 600, color: 'var(--text-muted, #888)' } as const;

  if (isLoading) return <div>{t('common.loading')}</div>;

  return (
    <div>
      <h2 className="admin-page-title">{t('nav.activity')}</h2>
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={labelStyle}>{t('nav.users')}</label>
          <select
            value={userId ?? ''}
            onChange={(e) => { setPage(0); setUserId(e.target.value ? Number(e.target.value) : undefined); }}
            style={inputStyle}
          >
            <option value="">{t('activity.all')}</option>
            {(users as AdminUser[])?.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={labelStyle}>{t('activity.action')}</label>
          <select
            value={actionType}
            onChange={(e) => { setPage(0); setActionType(e.target.value); }}
            style={inputStyle}
          >
            <option value="">{t('activity.all')}</option>
            {actionTypes.map((at) => (
              <option key={at.value} value={at.value}>{t(at.key)}</option>
            ))}
          </select>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={labelStyle}>{t('activity.from')}</label>
          <input
            type="date"
            lang="el"
            value={fromDate}
            onChange={(e) => { setPage(0); setFromDate(e.target.value); }}
            style={inputStyle}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={labelStyle}>{t('activity.to')}</label>
          <input
            type="date"
            lang="el"
            value={toDate}
            onChange={(e) => { setPage(0); setToDate(e.target.value); }}
            style={inputStyle}
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
              <th>{t('activity.time')}</th>
              <th>{t('nav.users')}</th>
              <th>{t('activity.action')}</th>
              <th>{t('activity.item')}</th>
              <th>{t('activity.delta')}</th>
              <th>{t('activity.note')}</th>
              <th>{t('activity.by')}</th>
            </tr>
          </thead>
          <tbody>
            {(data?.entries as HistoryEntry[])?.map((entry) => (
              <tr key={entry.id}>
                <td>{formatDateTime(entry.timestamp)}</td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  {entry.user_avatar_kind && (
                    <UserAvatar kind={entry.user_avatar_kind} value={entry.user_avatar_value} name={entry.user_name} />
                  )}
                  {entry.user_name}
                </td>
                <td>{(() => { const at = actionTypes.find(a => a.value === entry.action_type); return at ? t(at.key) : (entry.action_label || entry.action_type); })()}</td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  {entry.item_icon && <ItemIcon icon={entry.item_icon} />}
                  {entry.item_title ?? '—'}
                </td>
                <td style={{ color: entry.points_delta >= 0 ? '#4c8' : '#e55' }}>
                  {entry.points_delta > 0 ? '+' : ''}{entry.points_delta}
                </td>
                <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {entry.admin_note || '—'}
                </td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  {entry.actor_name ? (
                    <>
                      {entry.actor_avatar_kind && (
                        <UserAvatar kind={entry.actor_avatar_kind} value={entry.actor_avatar_value ?? ''} name={entry.actor_name} />
                      )}
                      {entry.actor_name}
                    </>
                  ) : '—'}
                </td>
              </tr>
            ))}
            {!data?.entries?.length && (
              <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted, #888)' }}>{t('history.empty')}</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <Pagination page={page} pageCount={pageCount} onChange={setPage} />
      <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted, #888)' }}>
        {t('activity.total', { count: String(data?.total ?? 0) })}
      </div>
    </div>
  );
}
