import { useQuery } from '@tanstack/react-query';
import { getAdminUsers, deleteAdminUser, resetUserPin } from '../../api/client';
import { useT } from '../../i18n/store';
import { AdminUser } from '../../lib/types';
import { useState } from 'react';
import { UserModal } from '../../components/UserModal';
import { AdjustStarsModal } from '../../components/AdjustStarsModal';
import './AdminPage.css';

function AvatarCell(user: AdminUser) {
  if (user.avatar_kind === 'image') {
    return <img src={user.avatar_value} alt="" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} />;
  }
  return <img src={`/icons/svg/${user.avatar_value}.svg`} alt="" style={{ width: 32, height: 32 }} />;
}

export function UsersPage() {
  const t = useT();
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [creating, setCreating] = useState(false);
  const [adjusting, setAdjusting] = useState<AdminUser | null>(null);
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['admin-users'],
    queryFn: getAdminUsers,
  });

  const handleDelete = async (user: AdminUser) => {
    await deleteAdminUser(user.id);
    refetch();
  };

  const handleResetPin = async (user: AdminUser) => {
    const pin = prompt('Enter new 4-digit PIN for ' + user.name);
    if (pin && /^\d{4}$/.test(pin)) {
      await resetUserPin(user.id, pin);
      refetch();
    } else if (pin) {
      alert('PIN must be exactly 4 digits.');
    }
  };

  if (isLoading) return <div>{t('common.loading')}</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 className="admin-page-title" style={{ marginBottom: 0 }}>{t('nav.users')}</h2>
        <button className="admin-btn admin-btn-primary" onClick={() => setCreating(true)}>
          {t('chore.new')}
        </button>
      </div>
      <table className="admin-table">
        <thead>
          <tr>
            <th>Avatar</th>
            <th>Name</th>
            <th>Role</th>
            <th>Stars</th>
            <th>Active</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {(data as AdminUser[])?.map((user) => (
            <tr key={user.id}>
              <td><AvatarCell {...user} /></td>
              <td>{user.name}</td>
              <td>
                <span className={`status-badge ${user.role === 'admin' ? 'active' : ''}`}>
                  {user.role}
                </span>
              </td>
              <td>{user.current_stars} ⭐</td>
              <td>
                <span className={`status-badge ${user.is_active ? 'active' : 'inactive'}`}>
                  {user.is_active ? 'Active' : 'Inactive'}
                </span>
              </td>
              <td className="actions">
                <button className="admin-btn" onClick={() => setEditing(user)}>
                  {t('common.edit')}
                </button>
                <button className="admin-btn" onClick={() => setAdjusting(user)}>
                  {t('stars.adjust')}
                </button>
                <button className="admin-btn" onClick={() => handleResetPin(user)}>
                  Reset PIN
                </button>
                <button className="admin-btn admin-btn-danger" onClick={() => handleDelete(user)}>
                  {t('common.delete')}
                </button>
              </td>
            </tr>
          ))}
          {data?.length === 0 && (
            <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted, #888)' }}>No users</td></tr>
          )}
        </tbody>
      </table>
      {creating && <UserModal onClose={() => setCreating(false)} />}
      {editing && <UserModal user={editing} onClose={() => setEditing(null)} />}
      {adjusting && <AdjustStarsModal user={adjusting} onClose={() => setAdjusting(null)} />}
    </div>
  );
}
