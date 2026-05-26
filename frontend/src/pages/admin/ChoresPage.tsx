import { useQuery } from '@tanstack/react-query';
import { getChores, updateChore, deleteChore } from '../../api/client';
import { useT } from '../../i18n/store';
import type { Chore } from '../../lib/types';
import { useState } from 'react';
import { ChoreModal } from '../../components/ChoreModal';
import './AdminPage.css';

export function ChoresPage() {
  const t = useT();
  const [editing, setEditing] = useState<Chore | null>(null);
  const [creating, setCreating] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['chores'],
    queryFn: getChores,
  });

  const handleToggleActive = async (chore: Chore) => {
    await updateChore(chore.id, { is_active: !chore.is_active });
    refetch();
  };

  const handleDelete = async (chore: Chore) => {
    await deleteChore(chore.id);
    refetch();
  };

  if (isLoading) return <div>{t('common.loading')}</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 className="admin-page-title" style={{ marginBottom: 0 }}>{t('nav.chores')}</h2>
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
            <th>Points</th>
            <th>Scope</th>
            <th>Active</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {(data as Chore[])?.map((chore) => (
            <tr key={chore.id}>
              <td>
                <img src={`/api/icons/svg/${chore.icon_name}`} alt="" style={{ width: 24, height: 24 }} />
              </td>
              <td>{chore.title_el}</td>
              <td>{chore.title_en}</td>
              <td>{chore.points_value}</td>
              <td>{chore.scope}</td>
              <td>
                <span className={`status-badge ${chore.is_active ? 'active' : 'inactive'}`}>
                  {chore.is_active ? 'Active' : 'Inactive'}
                </span>
              </td>
              <td className="actions">
                <button className="admin-btn" onClick={() => setEditing(chore)}>
                  {t('common.edit')}
                </button>
                <button className="admin-btn" onClick={() => handleToggleActive(chore)}>
                  {chore.is_active ? 'Disable' : 'Enable'}
                </button>
                <button className="admin-btn admin-btn-danger" onClick={() => handleDelete(chore)}>
                  {t('common.delete')}
                </button>
              </td>
            </tr>
          ))}
          {data?.length === 0 && (
            <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted, #888)' }}>No chores yet</td></tr>
          )}
        </tbody>
      </table>
      {creating && <ChoreModal onClose={() => setCreating(false)} />}
      {editing && <ChoreModal chore={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
