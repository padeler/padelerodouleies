import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { logout } from '../api/client';
import { useAuth } from '../hooks/useAuth';
import { useT } from '../i18n/store';
import LocaleToggle from '../i18n/LocaleToggle';
import { SettingsModal } from './SettingsModal';

export function Header({ onToggleSidebar }: { onToggleSidebar?: () => void } = {}) {
  const t = useT();
  const navigate = useNavigate();
  const { user, clearUser } = useAuth();
  const queryClient = useQueryClient();
  const [showSettings, setShowSettings] = useState(false);

  const handleLogout = async () => {
    console.log('[Header] logout started');
    await logout();
    queryClient.clear();
    clearUser();
    console.log('[Header] navigating to /');
    navigate('/');
  };

  return (
    <>
      <header className="app-header">
        <div className="header-left">
          {onToggleSidebar && (
            <button
              className="hamburger-btn"
              type="button"
              onClick={onToggleSidebar}
              aria-label="Toggle menu"
            >
              ☰
            </button>
          )}
          {user && (
            <img
              className="user-avatar-img"
              src={user.avatar_kind === 'image' ? user.avatar_value : `/api/icons/svg/${user.avatar_value}`}
              alt=""
            />
          )}
          <span className="user-name">{user?.name}</span>
          {user?.role !== 'admin' && (
            <>
              {(user?.pending_stars ?? 0) > 0 && (
                <span className="user-pending-stars" title={t('chore.pending_stars')}>
                  {user?.pending_stars}☆
                </span>
              )}
              <span className="user-stars">{user?.current_stars ?? 0} ★</span>
            </>
          )}
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
            <span className="btn-icon">⏻</span>
            <span className="btn-text">{t('nav.logout')}</span>
          </button>
        </div>
      </header>
      <SettingsModal open={showSettings} onClose={() => setShowSettings(false)} />
    </>
  );
}
