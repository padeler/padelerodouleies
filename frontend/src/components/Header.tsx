import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { logout } from '../api/client';
import { useAuth } from '../hooks/useAuth';
import { useT } from '../i18n/store';
import LocaleToggle from '../i18n/LocaleToggle';
import { SettingsModal } from './SettingsModal';

export function Header() {
  const t = useT();
  const navigate = useNavigate();
  const { user, clearUser } = useAuth();
  const [showSettings, setShowSettings] = useState(false);

  const handleLogout = async () => {
    await logout();
    clearUser();
    navigate('/');
  };

  return (
    <>
      <header className="app-header">
        <div className="header-left">
          <span className="user-name">{user?.name}</span>
          <span className="user-stars">{user?.current_stars ?? 0} ⭐</span>
        </div>
        <div className="header-right">
          <LocaleToggle />
          <button
            className="settings-btn"
            type="button"
            onClick={() => setShowSettings(true)}
            title={t('nav.settings')}
          >
            ⚙
          </button>
          <button className="logout-btn" onClick={handleLogout}>
            {t('nav.logout')}
          </button>
        </div>
      </header>
      <SettingsModal open={showSettings} onClose={() => setShowSettings(false)} />
    </>
  );
}
