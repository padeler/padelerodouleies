import { useState } from 'react';
import { LogOut, Settings, Volume2, VolumeX } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { logout } from '../api/client';
import { useAuth } from '../hooks/useAuth';
import { useT } from '../i18n/store';
import LocaleToggle from '../i18n/LocaleToggle';
import { SettingsModal } from './SettingsModal';
import { Avatar } from './Avatar';
import { useSoundStore } from '../lib/sound';

export function Header({ onToggleSidebar }: { onToggleSidebar?: () => void } = {}) {
  const t = useT();
  const navigate = useNavigate();
  const { user, clearUser } = useAuth();
  const queryClient = useQueryClient();
  const [showSettings, setShowSettings] = useState(false);
  const muted = useSoundStore((s) => s.muted);
  const toggleMuted = useSoundStore((s) => s.toggleMuted);

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
            <Avatar kind={user.avatar_kind} value={user.avatar_value} size={36} />
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
            className="sound-btn"
            type="button"
            onClick={toggleMuted}
            title={muted ? t('nav.unmute') : t('nav.mute')}
            aria-label={muted ? t('nav.unmute') : t('nav.mute')}
            aria-pressed={muted}
          >
            {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
          <button
            className="settings-btn"
            type="button"
            onClick={() => setShowSettings(true)}
            title={t('nav.settings')}
          >
            <Settings className="btn-icon" size={18} />
            <span className="btn-text">{t('nav.settings')}</span>
          </button>
          <button className="logout-btn" onClick={handleLogout}>
            <LogOut className="btn-icon" size={18} />
            <span className="btn-text">{t('nav.logout')}</span>
          </button>
        </div>
      </header>
      <SettingsModal open={showSettings} onClose={() => setShowSettings(false)} />
    </>
  );
}
