import { NavLink } from 'react-router-dom';
import { useT } from '../i18n/store';
import './KidSidebar.css';

const navItems = [
  { path: '/dashboard/chores', key: 'nav.chores' },
  { path: '/dashboard/marketplace', key: 'nav.marketplace' },
  { path: '/dashboard/history', key: 'nav.history' },
  { path: '/dashboard/leaderboard', key: 'nav.leaderboard' },
];

export function KidSidebar({ onClose }: { onClose?: () => void } = {}) {
  const t = useT();

  return (
    <nav className="kid-sidebar">
      <div className="kid-sidebar-brand">
        <span>{t('nav.dashboard')}</span>
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
              className={({ isActive }) => (isActive ? 'kid-nav-active' : '')}
            >
              {t(item.key)}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
