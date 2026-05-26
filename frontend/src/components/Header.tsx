import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { logout } from '../api/client';
import { useAuth } from '../hooks/useAuth';
import LocaleToggle from '../i18n/LocaleToggle';
import { SettingsModal } from './SettingsModal';

export function Header() {
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
            title="Settings"
          >
            ⚙
          </button>
          <button className="logout-btn" onClick={handleLogout}>
            Exit
          </button>
        </div>
      </header>
      <SettingsModal open={showSettings} onClose={() => setShowSettings(false)} />
    </>
  );
}
