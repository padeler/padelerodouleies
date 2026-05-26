import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getFulfillmentQueue, markFulfilled } from '../../api/client';
import { useT } from '../../i18n/store';
import type { FulfillmentEntry } from '../../lib/types';
import { useState } from 'react';
import './AdminPage.css';

function FulfillRow({ entry }: { entry: FulfillmentEntry }) {
  const qc = useQueryClient();
  const mutate = useMutation({
    mutationFn: () => markFulfilled(entry.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fulfillment', 'claimed'] });
      qc.invalidateQueries({ queryKey: ['fulfillment', 'fulfilled'] });
    },
  });

  return (
    <tr>
      <td>
        <img src={`/api/icons/svg/${entry.reward_icon}`} alt="" style={{ width: 24, height: 24 }} />
      </td>
      <td>{entry.reward_title_el}</td>
      <td>{entry.user_name}</td>
      <td>{entry.stars_contributed}</td>
      <td>{new Date(entry.claimed_at).toLocaleString()}</td>
      <td>
        <button
          className="admin-btn admin-btn-success"
          onClick={() => mutate.mutate()}
          disabled={mutate.isPending}
        >
          Mark Fulfilled
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
          {t('reward.claimed')}
        </button>
        <button
          className={`admin-btn ${tab === 'fulfilled' ? 'admin-btn-primary' : ''}`}
          onClick={() => setTab('fulfilled')}
        >
          {t('reward.fulfilled')}
        </button>
      </div>
      {(data as FulfillmentEntry[])?.length === 0 ? (
        <div style={{ color: 'var(--text-muted, #888)' }}>No entries</div>
      ) : (
        <table className="admin-table">
          <thead>
            <tr>
              <th>Icon</th>
              <th>Reward</th>
              <th>User</th>
              <th>Stars</th>
              <th>Claimed</th>
              {tab === 'claimed' && <th>Actions</th>}
              {tab === 'fulfilled' && <th>Fulfilled</th>}
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
                    <td>{entry.reward_title_el}</td>
                    <td>{entry.user_name}</td>
                    <td>{entry.stars_contributed}</td>
                    <td>{new Date(entry.claimed_at).toLocaleString()}</td>
                    <td>{entry.fulfilled_at ? new Date(entry.fulfilled_at).toLocaleString() : '—'}</td>
                  </tr>
                ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
