import { useQuery } from '@tanstack/react-query';
import { getAdminUsers, deleteAdminUser, resetUserPin } from '../../api/client';
import { useT } from '../../i18n/store';
import type { AdminUser } from '../../lib/types';
import { useAuth } from '../../hooks/useAuth';
import { useState } from 'react';
import { notifySuccess, notifyError } from '../../lib/notify';
import { UserModal } from '../../components/UserModal';
import { AdjustStarsModal } from '../../components/AdjustStarsModal';
import './AdminPage.css';

function AvatarCell(user: AdminUser) {
  if (user.avatar_kind === 'image') {
    return <img src={user.avatar_value} alt="" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} />;
  }
  return <img src={`/api/icons/svg/${user.avatar_value}`} alt="" style={{ width: 32, height: 32 }} />;
}

export function UsersPage() {
  const t = useT();
  const { user: currentUser } = useAuth();
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [creating, setCreating] = useState(false);
  const [adjusting, setAdjusting] = useState<AdminUser | null>(null);
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['admin-users'],
    queryFn: getAdminUsers,
  });

  const handleDelete = async (user: AdminUser) => {
    try {
      await deleteAdminUser(user.id);
      notifySuccess(t('common.delete') + ' ✓');
      refetch();
    } catch (err) {
      notifyError(err instanceof Error ? err.message : t('common.error'));
    }
  };

  const handleResetPin = async (user: AdminUser) => {
    const pin = prompt(t('user.reset_pin_prompt', { name: user.name }));
    try {
      if (pin && /^\d{4}$/.test(pin)) {
        await resetUserPin(user.id, pin);
        notifySuccess(t('pin_reset.success'));
        refetch();
      } else if (pin) {
        notifyError(t('pin_reset.must_be_4_digits'));
      }
    } catch (err) {
      notifyError(err instanceof Error ? err.message : t('common.error'));
    }
  };

  if (isLoading) return <div>{t('common.loading')}</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 className="admin-page-title" style={{ marginBottom: 0 }}>{t('nav.users')}</h2>
        <button className="admin-btn admin-btn-primary" onClick={() => setCreating(true)}>
          <span className="btn-icon">+</span>
          <span className="btn-text">{t('user.new')}</span>
        </button>
      </div>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>{t('user.table.avatar')}</th>
              <th>{t('user.table.name')}</th>
              <th>{t('user.table.role')}</th>
              <th>{t('user.table.stars')}</th>
              <th>{t('user.table.active')}</th>
              <th>{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {(data as AdminUser[])?.map((user) => (
              <tr key={user.id}>
                <td><AvatarCell {...user} /></td>
                <td>{user.name}</td>
                <td>
                  <span className={`status-badge ${user.role === 'admin' ? 'active' : ''}`}>
                    {user.role === 'admin' ? t('user.role_admin') : t('user.role_user')}
                  </span>
                </td>
                <td>{user.current_stars} ⭐</td>
                <td>
                  <span className={`status-badge ${user.is_active ? 'active' : 'inactive'}`}>
                    {user.is_active ? t('common.enabled') : t('common.disabled')}
                  </span>
                </td>
                <td className="actions">
                  <button className="admin-btn" onClick={() => setEditing(user)} title={t('btn.edit')}>
                    <span className="btn-icon">✎</span>
                    <span className="btn-text">{t('btn.edit')}</span>
                  </button>
                  <button className="admin-btn" onClick={() => setAdjusting(user)} title={t('btn.adjust_stars')}>
                    <span className="btn-icon">⭐</span>
                    <span className="btn-text">{t('btn.adjust_stars')}</span>
                  </button>
                  <button className="admin-btn" onClick={() => handleResetPin(user)} title={t('btn.reset_pin')}>
                    <span className="btn-icon">🔑</span>
                    <span className="btn-text">{t('btn.reset_pin')}</span>
                  </button>
                  <button className="admin-btn admin-btn-danger" onClick={() => handleDelete(user)} title={t('btn.delete')} style={{ display: currentUser?.id === user.id ? 'none' : undefined }}>
                    <span className="btn-icon">🗑</span>
                    <span className="btn-text">{t('btn.delete')}</span>
                  </button>
                </td>
              </tr>
            ))}
            {data?.length === 0 && (
              <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted, #888)' }}>{t('user.table.empty')}</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {creating && <UserModal onClose={() => setCreating(false)} />}
      {editing && <UserModal user={editing} onClose={() => setEditing(null)} />}
      {adjusting && <AdjustStarsModal user={adjusting} onClose={() => setAdjusting(null)} />}
    </div>
  );
}
