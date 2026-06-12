import { NavLink } from 'react-router-dom';
import { useT } from '../i18n/store';
import './KidSidebar.css';

const navItems = [
  { path: '/dashboard/chores', key: 'nav.chores', icon: '📋' },
  { path: '/dashboard/marketplace', key: 'nav.marketplace', icon: '🏪' },
  { path: '/dashboard/history', key: 'nav.history', icon: '📜' },
  { path: '/dashboard/leaderboard', key: 'nav.leaderboard', icon: '🏆' },
  { path: '/dashboard/stats', key: 'nav.stats', icon: '📊' },
  { path: '/dashboard/games', key: 'nav.games', icon: '🎮' },
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
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-text">{t(item.key)}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
