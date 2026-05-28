import { useQuery } from '@tanstack/react-query';
import { getRewards, updateReward, deleteReward } from '../../api/client';
import { useT } from '../../i18n/store';
import type { Reward } from '../../lib/types';
import { useState } from 'react';
import { notifySuccess, notifyError } from '../../lib/notify';
import { RewardModal } from '../../components/RewardModal';
import './AdminPage.css';

export function RewardsPage() {
  const t = useT();
  const [editing, setEditing] = useState<Reward | null>(null);
  const [creating, setCreating] = useState(false);
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['rewards'],
    queryFn: getRewards,
  });

  const handleToggle = async (reward: Reward) => {
    try {
      await updateReward(reward.id, { is_enabled: !reward.is_enabled });
      notifySuccess(reward.is_enabled ? t('common.disabled') + ' ✓' : t('common.enabled') + ' ✓');
      refetch();
    } catch (err) {
      notifyError(err instanceof Error ? err.message : t('common.error'));
    }
  };

  const handleDelete = async (reward: Reward) => {
    if (!window.confirm(t('common.confirm_delete', { title: reward.title }))) return;
    try {
      await deleteReward(reward.id);
      notifySuccess(t('common.delete') + ' ✓');
      refetch();
    } catch (err) {
      notifyError(err instanceof Error ? err.message : t('common.error'));
    }
  };

  if (isLoading) return <div>{t('common.loading')}</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 className="admin-page-title" style={{ marginBottom: 0 }}>{t('nav.rewards')}</h2>
        <button className="admin-btn admin-btn-primary" onClick={() => setCreating(true)}>
          <span className="btn-icon">+</span>
          <span className="btn-text">{t('reward.new')}</span>
        </button>
      </div>
      <div className="admin-table-wrap">
        <table className="admin-table">
        <thead>
          <tr>
            <th>{t('reward.table.icon')}</th>
            <th>{t('reward.title_placeholder')}</th>
            <th>{t('reward.table.cost')}</th>
            <th>{t('reward.table.collaborative')}</th>
            <th>{t('common.enabled')}</th>
            <th>{t('common.actions')}</th>
          </tr>
        </thead>
        <tbody>
          {(data as Reward[])?.map((reward) => (
            <tr key={reward.id}>
              <td>
                <img src={`/api/icons/svg/${reward.icon_name}`} alt="" style={{ width: 24, height: 24 }} />
              </td>
              <td>{reward.title}</td>
              <td>{reward.cost_stars} ⭐</td>
              <td>{reward.is_collaborative ? t('common.yes') : t('common.no')}</td>
              <td>
                <span className={`status-badge ${reward.is_enabled ? 'active' : 'inactive'}`}>
                  {reward.is_enabled ? t('common.enabled') : t('common.disabled')}
                </span>
              </td>
              <td className="actions">
                <button className="admin-btn" onClick={() => setEditing(reward)} title={t('btn.edit')}>
                  <span className="btn-icon">✎</span>
                  <span className="btn-text">{t('btn.edit')}</span>
                </button>
                <button className="admin-btn" onClick={() => handleToggle(reward)} title={reward.is_enabled ? t('btn.disable') : t('btn.enable')}>
                  <span className="btn-icon">{reward.is_enabled ? '👁' : '👁‍🗨'}</span>
                  <span className="btn-text">{reward.is_enabled ? t('btn.disable') : t('btn.enable')}</span>
                </button>
                <button className="admin-btn admin-btn-danger" onClick={() => handleDelete(reward)} title={t('btn.delete')}>
                  <span className="btn-icon">🗑</span>
                  <span className="btn-text">{t('btn.delete')}</span>
                </button>
              </td>
            </tr>
          ))}
          {data?.length === 0 && (
            <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted, #888)' }}>{t('reward.table.empty')}</td></tr>
          )}
        </tbody>
      </table>
      </div>
      {creating && <RewardModal onClose={() => setCreating(false)} />}
      {editing && <RewardModal reward={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
