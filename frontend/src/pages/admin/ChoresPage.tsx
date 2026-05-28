import { useQuery } from '@tanstack/react-query';
import { getChores, updateChore, deleteChore } from '../../api/client';
import { useT } from '../../i18n/store';
import type { Chore } from '../../lib/types';
import { useState } from 'react';
import { notifySuccess, notifyError } from '../../lib/notify';
import { ChoreModal } from '../../components/ChoreModal';
import './AdminPage.css';

function ChoreIcon({ icon_name }: { icon_name: string }) {
  if (icon_name.startsWith('/')) {
    return <img src={icon_name} alt="" style={{ width: 24, height: 24, objectFit: 'contain' }} />;
  }
  return <img src={`/api/icons/svg/${icon_name}`} alt="" style={{ width: 24, height: 24 }} />;
}

export function ChoresPage() {
  const t = useT();
  const [editing, setEditing] = useState<Chore | null>(null);
  const [creating, setCreating] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['chores'],
    queryFn: getChores,
  });

  const handleToggleActive = async (chore: Chore) => {
    try {
      await updateChore(chore.id, { is_active: !chore.is_active });
      notifySuccess(chore.is_active ? t('common.disabled') + ' ✓' : t('common.enabled') + ' ✓');
      refetch();
    } catch (err) {
      notifyError(err instanceof Error ? err.message : t('common.error'));
    }
  };

  const handleDelete = async (chore: Chore) => {
    if (!window.confirm(t('common.confirm_delete', { title: chore.title }))) return;
    try {
      await deleteChore(chore.id);
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
        <h2 className="admin-page-title" style={{ marginBottom: 0 }}>{t('nav.chores')}</h2>
        <button className="admin-btn admin-btn-primary" onClick={() => setCreating(true)}>
          <span className="btn-icon">+</span>
          <span className="btn-text">{t('chore.new')}</span>
        </button>
      </div>
      <div className="admin-table-wrap">
        <table className="admin-table">
        <thead>
          <tr>
            <th>{t('chore.icon')}</th>
            <th>{t('chore.title_placeholder')}</th>
            <th>{t('chore.points')}</th>
            <th>{t('chore.claim_mode')}</th>
            <th>{t('common.enabled')}</th>
            <th>{t('common.actions')}</th>
          </tr>
        </thead>
        <tbody>
          {(data as Chore[])?.map((chore) => (
            <tr key={chore.id}>
              <td>
                <ChoreIcon icon_name={chore.icon_name} />
              </td>
              <td>{chore.title}</td>
              <td>{chore.points_value}</td>
              <td>{chore.claim_mode === 'each' ? t('chore.claim_mode_each') : t('chore.claim_mode_one')}</td>
              <td>
                <span className={`status-badge ${chore.is_active ? 'active' : 'inactive'}`}>
                  {chore.is_active ? t('common.enabled') : t('common.disabled')}
                </span>
              </td>
              <td className="actions">
                <button className="admin-btn" onClick={() => setEditing(chore)} title={t('btn.edit')}>
                  <span className="btn-icon">✎</span>
                  <span className="btn-text">{t('btn.edit')}</span>
                </button>
                <button className="admin-btn" onClick={() => handleToggleActive(chore)} title={chore.is_active ? t('btn.disable') : t('btn.enable')}>
                  <span className="btn-icon">{chore.is_active ? '👁' : '👁‍🗨'}</span>
                  <span className="btn-text">{chore.is_active ? t('btn.disable') : t('btn.enable')}</span>
                </button>
                <button className="admin-btn admin-btn-danger" onClick={() => handleDelete(chore)} title={t('btn.delete')}>
                  <span className="btn-icon">🗑</span>
                  <span className="btn-text">{t('btn.delete')}</span>
                </button>
              </td>
            </tr>
          ))}
          {data?.length === 0 && (
            <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted, #888)' }}>{t('chore.table.empty')}</td></tr>
          )}
        </tbody>
      </table>
      </div>
      {creating && <ChoreModal onClose={() => setCreating(false)} />}
      {editing && <ChoreModal chore={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
