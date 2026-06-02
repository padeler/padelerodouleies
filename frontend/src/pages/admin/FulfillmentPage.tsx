import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getFulfillmentQueue, markFulfilled, cancelFulfillment } from '../../api/client';
import { useT } from '../../i18n/store';
import type { FulfillmentEntry } from '../../lib/types';
import { useState } from 'react';
import { notifyCelebration, notifyError, notifySuccess } from '../../lib/notify';
import { Pagination, usePagination } from '../../components/Pagination';
import { formatDateTime } from '../../lib/datetime';
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

  const cancel = useMutation({
    mutationFn: (reason: string | undefined) => cancelFulfillment(entry.id, reason),
    onSuccess: (res) => {
      notifySuccess(t('fulfillment.cancelled', { stars: String(res.refunded) }));
      qc.invalidateQueries({ queryKey: ['fulfillment', 'claimed'] });
      qc.invalidateQueries({ queryKey: ['fulfillment', 'fulfilled'] });
    },
    onError: (err) => {
      notifyError(err.message || t('common.error'));
    },
  });

  const handleCancel = () => {
    if (!window.confirm(t('fulfillment.cancel_confirm', { name: entry.user_name, stars: String(entry.stars_contributed) }))) {
      return;
    }
    const reason = window.prompt(t('fulfillment.cancel_reason')) ?? undefined;
    cancel.mutate(reason || undefined);
  };

  const busy = mutate.isPending || mutate.isSuccess || cancel.isPending || cancel.isSuccess;

  return (
    <tr>
      <td>
        <img src={`/api/icons/svg/${entry.reward_icon}`} alt="" style={{ width: 24, height: 24 }} />
      </td>
      <td>{entry.reward_title}</td>
      <td>{entry.user_name}</td>
      <td>{entry.stars_contributed}</td>
      <td>{formatDateTime(entry.claimed_at)}</td>
      <td>
        <div className="row-actions">
          <button
            className="admin-btn admin-btn-success"
            onClick={() => mutate.mutate()}
            disabled={busy}
          >
            <span className="btn-icon">✓</span>
            <span className="btn-text">{t('btn.mark_fulfilled')}</span>
          </button>
          <button
            className="admin-btn admin-btn-danger"
            onClick={handleCancel}
            disabled={busy}
          >
            <span className="btn-icon">↩</span>
            <span className="btn-text">{t('btn.cancel_order')}</span>
          </button>
        </div>
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
  const { page, setPage, pageCount, pageItems } = usePagination(data as FulfillmentEntry[] | undefined);

  if (isLoading) return <div>{t('common.loading')}</div>;

  return (
    <div>
      <h2 className="admin-page-title">{t('nav.fulfillment')}</h2>
      <div className="admin-tabs">
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
              ? pageItems.map((entry) => (
                  <FulfillRow key={entry.id} entry={entry} />
                ))
              : pageItems.map((entry) => (
                  <tr key={entry.id}>
                    <td>
                   <img src={`/api/icons/svg/${entry.reward_icon}`} alt="" style={{ width: 24, height: 24 }} />
                    </td>
                    <td>{entry.reward_title}</td>
                    <td>{entry.user_name}</td>
                    <td>{entry.stars_contributed}</td>
                    <td>{formatDateTime(entry.claimed_at)}</td>
                    <td>{entry.fulfilled_at ? formatDateTime(entry.fulfilled_at) : '—'}</td>
                  </tr>
                ))}
          </tbody>
        </table>
        <Pagination page={page} pageCount={pageCount} onChange={setPage} />
        </div>
      )}
    </div>
  );
}
