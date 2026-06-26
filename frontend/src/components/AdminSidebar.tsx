import { NavLink } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getPendingCount } from '../api/client';
import { useT } from '../i18n/store';
import './AdminSidebar.css';

const navItems = [
  { path: '/admin/approvals', key: 'nav.approvals', icon: '✓' },
  { path: '/admin/chores', key: 'nav.chores', icon: '📋' },
  { path: '/admin/rewards', key: 'nav.rewards', icon: '🎁' },
  { path: '/admin/users', key: 'nav.users', icon: '👤' },
  { path: '/admin/fulfillment', key: 'nav.fulfillment', icon: '📦' },
  { path: '/admin/activity', key: 'nav.activity', icon: '📊' },
  { path: '/admin/stats', key: 'nav.stats', icon: '📈' },
  { path: '/admin/exercises', key: 'nav.exercises', icon: '📚' },
  { path: '/admin/games', key: 'nav.games', icon: '🎮' },
];

export function AdminSidebar({ onClose }: { onClose?: () => void } = {}) {
  const t = useT();
  const { data } = useQuery({
    queryKey: ['pending-count'],
    queryFn: getPendingCount,
    refetchOnWindowFocus: false,
    staleTime: 30_000,
  });

  return (
    <nav className="admin-sidebar">
      <div className="admin-sidebar-brand">
        <span>{t('nav.admin')}</span>
        {onClose && (
          <button className="sidebar-close" type="button" onClick={onClose} aria-label="Close menu">
            ✕
          </button>
        )}
      </div>
      <ul>
        {navItems.map((item) => (
          <li key={item.path}>
            <NavLink
              to={item.path}
              className={({ isActive }) => (isActive ? 'admin-nav-active' : '')}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-text">{t(item.key)}</span>
              {item.path === '/admin/approvals' && (data?.count ?? 0) > 0 && (
                <span className="admin-nav-badge">{data?.count ?? 0}</span>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
