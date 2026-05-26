import { NavLink } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getPendingCount } from '../api/client';
import { useT } from '../i18n/store';
import './AdminSidebar.css';

const navItems = [
  { path: 'approvals', key: 'nav.approvals' },
  { path: 'chores', key: 'nav.chores' },
  { path: 'rewards', key: 'nav.rewards' },
  { path: 'users', key: 'nav.users' },
  { path: 'fulfillment', key: 'nav.fulfillment' },
  { path: 'activity', key: 'nav.activity' },
];

export function AdminSidebar() {
  const t = useT();
  const { data } = useQuery({
    queryKey: ['pending-count'],
    queryFn: getPendingCount,
    refetchOnWindowFocus: false,
    staleTime: 30_000,
  });

  return (
    <nav className="admin-sidebar">
      <div className="admin-sidebar-brand">{t('nav.admin')}</div>
      <ul>
        {navItems.map((item) => (
          <li key={item.path}>
            <NavLink
              to={item.path}
              className={({ isActive }) => (isActive ? 'admin-nav-active' : '')}
            >
              {t(item.key)}
              {item.path === 'approvals' && (data?.count ?? 0) > 0 && (
                <span className="admin-badge">{data?.count ?? 0}</span>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
