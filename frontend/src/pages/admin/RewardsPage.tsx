import { useQuery } from '@tanstack/react-query';
import { getRewards, updateReward, deleteReward } from '../../api/client';
import { useT } from '../../i18n/store';
import type { Reward } from '../../lib/types';
import { useState } from 'react';
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
    await updateReward(reward.id, { is_enabled: !reward.is_enabled });
    refetch();
  };

  const handleDelete = async (reward: Reward) => {
    await deleteReward(reward.id);
    refetch();
  };

  if (isLoading) return <div>{t('common.loading')}</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 className="admin-page-title" style={{ marginBottom: 0 }}>{t('nav.rewards')}</h2>
        <button className="admin-btn admin-btn-primary" onClick={() => setCreating(true)}>
          {t('chore.new')}
        </button>
      </div>
      <table className="admin-table">
        <thead>
          <tr>
            <th>Icon</th>
            <th>Title (EL)</th>
            <th>Title (EN)</th>
            <th>Cost</th>
            <th>Collaborative</th>
            <th>Enabled</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {(data as Reward[])?.map((reward) => (
            <tr key={reward.id}>
              <td>
                <img src={`/icons/svg/${reward.icon_name}.svg`} alt="" style={{ width: 24, height: 24 }} />
              </td>
              <td>{reward.title_el}</td>
              <td>{reward.title_en}</td>
              <td>{reward.cost_stars} ⭐</td>
              <td>{reward.is_collaborative ? 'Yes' : 'No'}</td>
              <td>
                <span className={`status-badge ${reward.is_enabled ? 'active' : 'inactive'}`}>
                  {reward.is_enabled ? 'Enabled' : 'Disabled'}
                </span>
              </td>
              <td className="actions">
                <button className="admin-btn" onClick={() => setEditing(reward)}>
                  {t('common.edit')}
                </button>
                <button className="admin-btn" onClick={() => handleToggle(reward)}>
                  {reward.is_enabled ? 'Disable' : 'Enable'}
                </button>
                <button className="admin-btn admin-btn-danger" onClick={() => handleDelete(reward)}>
                  {t('common.delete')}
                </button>
              </td>
            </tr>
          ))}
          {data?.length === 0 && (
            <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted, #888)' }}>No rewards yet</td></tr>
          )}
        </tbody>
      </table>
      {creating && <RewardModal onClose={() => setCreating(false)} />}
      {editing && <RewardModal reward={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
