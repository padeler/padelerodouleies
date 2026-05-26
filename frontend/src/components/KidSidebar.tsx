import { NavLink } from 'react-router-dom';
import { useT } from '../i18n/store';
import './KidSidebar.css';

const navItems = [
  { path: 'chores', key: 'nav.chores' },
  { path: 'marketplace', key: 'nav.marketplace' },
  { path: 'history', key: 'nav.history' },
  { path: 'leaderboard', key: 'nav.leaderboard' },
];

export function KidSidebar() {
  const t = useT();

  return (
    <nav className="kid-sidebar">
      <div className="kid-sidebar-brand">{t('nav.dashboard')}</div>
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
