import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getFulfillmentQueue, markFulfilled } from '../../api/client';
import { useT } from '../../i18n/store';
import type { FulfillmentEntry } from '../../lib/types';
import { useState } from 'react';
import { notifySuccess, notifyCelebration, notifyError } from '../../lib/notify';
import './AdminPage.css';

function FulfillRow({ entry }: { entry: FulfillmentEntry }) {
  const t = useT();
  const qc = useQueryClient();
  const mutate = useMutation({
    mutationFn: () => markFulfilled(entry.id),
    onSuccess: () => {
      notifyCelebration(t('reward.fulfilled'), `fulfill-${entry.id}`);
      qc.invalidateQueries({ queryKey: ['fulfillment', 'claimed'] });
      qc.invalidateQueries({ queryKey: ['fulfillment', 'fulfilled'] });
    },
    onError: (err) => {
      notifyError(err.message || t('common.error'));
    },
  });

  return (
    <tr>
      <td>
        <img src={`/api/icons/svg/${entry.reward_icon}`} alt="" style={{ width: 24, height: 24 }} />
      </td>
      <td>{entry.reward_title}</td>
      <td>{entry.user_name}</td>
      <td>{entry.stars_contributed}</td>
      <td>{new Date(entry.claimed_at).toLocaleString()}</td>
      <td>
        <button
          className="admin-btn admin-btn-success"
          onClick={() => mutate.mutate()}
          disabled={mutate.isPending || mutate.isSuccess}
        >
          <span className="btn-icon">✓</span>
          <span className="btn-text">{t('btn.mark_fulfilled')}</span>
        </button>
      </td>
    </tr>
  );
}

export function FulfillmentPage() {
  const t = useT();
  const [tab, setTab] = useState<'claimed' | 'fulfilled'>('claimed');
  const { data, isLoading } = useQuery({
    queryKey: ['fulfillment', tab],
    queryFn: () => getFulfillmentQueue(tab),
  });

  if (isLoading) return <div>{t('common.loading')}</div>;

  return (
    <div>
      <h2 className="admin-page-title">{t('nav.fulfillment')}</h2>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button
          className={`admin-btn ${tab === 'claimed' ? 'admin-btn-primary' : ''}`}
          onClick={() => setTab('claimed')}
        >
          <span className="btn-icon">📋</span>
          <span className="btn-text">{t('reward.claimed')}</span>
        </button>
        <button
          className={`admin-btn ${tab === 'fulfilled' ? 'admin-btn-primary' : ''}`}
          onClick={() => setTab('fulfilled')}
        >
          <span className="btn-icon">✓</span>
          <span className="btn-text">{t('reward.fulfilled')}</span>
        </button>
      </div>
      {(data as FulfillmentEntry[])?.length === 0 ? (
        <div style={{ color: 'var(--text-muted, #888)' }}>{t('fulfillment.empty')}</div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
          <thead>
            <tr>
              <th>{t('chore.icon')}</th>
              <th>{t('nav.rewards')}</th>
              <th>{t('nav.users')}</th>
              <th>{t('user.table.stars')}</th>
              <th>{t('reward.claimed')}</th>
              {tab === 'claimed' && <th>{t('common.actions')}</th>}
              {tab === 'fulfilled' && <th>{t('reward.fulfilled')}</th>}
            </tr>
          </thead>
          <tbody>
            {tab === 'claimed'
              ? (data as FulfillmentEntry[])?.map((entry) => (
                  <FulfillRow key={entry.id} entry={entry} />
                ))
              : (data as FulfillmentEntry[])?.map((entry) => (
                  <tr key={entry.id}>
                    <td>
                   <img src={`/api/icons/svg/${entry.reward_icon}`} alt="" style={{ width: 24, height: 24 }} />
                    </td>
                    <td>{entry.reward_title}</td>
                    <td>{entry.user_name}</td>
                    <td>{entry.stars_contributed}</td>
                    <td>{new Date(entry.claimed_at).toLocaleString()}</td>
                    <td>{entry.fulfilled_at ? new Date(entry.fulfilled_at).toLocaleString() : '—'}</td>
                  </tr>
                ))}
          </tbody>
        </table>
        </div>
      )}
    </div>
  );
}
