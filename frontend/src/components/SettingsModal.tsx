import { useState, useCallback, useEffect } from 'react';
import { changePin, updateTheme, uploadMyAvatar, updateMeAvatar } from '../api/client';
import { useAuth } from '../hooks/useAuth';
import { useT } from '../i18n/store';
import { IconPicker } from './IconPicker';
import type { AvatarSelection } from '../lib/types';
import './SettingsModal.css';
import './AvatarPicker.css';

const THEMES = [
  { value: 'system', key: 'settings.theme_system', icon: '💻' },
  { value: 'light', key: 'settings.theme_light', icon: '☀️' },
  { value: 'dark', key: 'settings.theme_dark', icon: '🌙' },
];

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
}

export function SettingsModal({ open, onClose }: SettingsModalProps) {
  const t = useT();
  const { user, setUser } = useAuth();

  // PIN state
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [pinSuccess, setPinSuccess] = useState(false);
  const [pinLoading, setPinLoading] = useState(false);

  // Theme state
  const [themeError, setThemeError] = useState('');

  // Avatar state
  const [avatarTab, setAvatarTab] = useState<'icon' | 'upload'>('icon');
  const [selectedAvatar, setSelectedAvatar] = useState<AvatarSelection | null>(null);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [avatarSuccess, setAvatarSuccess] = useState(false);
  const [avatarError, setAvatarError] = useState('');

  // Reset state when modal opens/closes
  useEffect(() => {
    if (open) {
      setSelectedAvatar(
        user ? { kind: user.avatar_kind, value: user.avatar_value } : null
      );
      setPinSuccess(false);
      setAvatarSuccess(false);
      setPinError('');
      setAvatarError('');
    }
  }, [open, user]);

  const handleSubmitPin = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setPinError('');
      setPinSuccess(false);

      if (newPin !== confirmPin) {
        setPinError('New PINs do not match');
        return;
      }
      if (!/^\d{4}$/.test(newPin)) {
        setPinError('PIN must be exactly 4 digits');
        return;
      }

      setPinLoading(true);
      try {
        await changePin(currentPin, newPin);
        setPinSuccess(true);
        setCurrentPin('');
        setNewPin('');
        setConfirmPin('');
        setTimeout(() => {
          setPinSuccess(false);
          onClose();
        }, 1500);
      } catch (err) {
        setPinError(err instanceof Error ? err.message : 'Failed to change PIN');
      } finally {
        setPinLoading(false);
      }
    },
    [currentPin, newPin, confirmPin, onClose],
  );

  const handleThemeChange = useCallback(
    async (theme: string) => {
      try {
        setThemeError('');
        await updateTheme(theme);
        if (user) {
          setUser({ ...user, preferred_theme: theme });
        }
      } catch (err) {
        console.error('[Settings] failed to update theme:', err);
        setThemeError('Failed to update theme');
      }
    },
    [user, setUser],
  );

  const handleIconSelect = useCallback(
    async (name: string) => {
      if (!user) return;
      const newAvatar: AvatarSelection = { kind: 'icon', value: name };
      setSelectedAvatar(newAvatar);
      setAvatarLoading(true);
      setAvatarError('');
      try {
        const updated = await updateMeAvatar(newAvatar.kind, newAvatar.value);
        setUser({ ...user, avatar_kind: updated.avatar_kind, avatar_value: updated.avatar_value });
        setAvatarSuccess(true);
        setTimeout(() => setAvatarSuccess(false), 2000);
      } catch (err) {
        console.error('[Settings] failed to update avatar:', err);
        setAvatarError(err instanceof Error ? err.message : 'Failed to update avatar');
      } finally {
        setAvatarLoading(false);
      }
    },
    [user, setUser],
  );

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !user) return;
      setAvatarLoading(true);
      setAvatarError('');
      try {
        const resp = await uploadMyAvatar(file);
        const updated = await updateMeAvatar('image', resp.url);
        setUser({ ...user, avatar_kind: updated.avatar_kind, avatar_value: updated.avatar_value });
        setSelectedAvatar({ kind: 'image', value: resp.url });
        setAvatarSuccess(true);
        setTimeout(() => setAvatarSuccess(false), 2000);
      } catch (err) {
        console.error('[Settings] failed to upload avatar:', err);
        setAvatarError(err instanceof Error ? err.message : 'Upload failed');
      } finally {
        setAvatarLoading(false);
      }
    },
    [user, setUser],
  );

  const handleClose = useCallback(() => {
    setCurrentPin('');
    setNewPin('');
    setConfirmPin('');
    setPinError('');
    setPinSuccess(false);
    setAvatarError('');
    setAvatarSuccess(false);
    setSelectedAvatar(null);
    onClose();
  }, [onClose]);

  if (!open) return null;

  return (
    <div className="settings-overlay" onClick={handleClose}>
      <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <h2>{t('nav.settings')}</h2>
          <button className="close-btn" type="button" onClick={handleClose}>
            ✕
          </button>
        </div>

        {/* Avatar Section */}
        <div className="settings-section">
          <h3>{t('settings.avatar_section')}</h3>
          {avatarSuccess ? (
            <div className="success-msg">{t('settings.avatar_saved')}</div>
          ) : (
            <>
              <div className="avatar-picker">
                <div className="avatar-picker-tabs">
                  <button
                    type="button"
                    className={`avatar-picker-tab ${avatarTab === 'icon' ? 'active' : ''}`}
                    onClick={() => setAvatarTab('icon')}
                  >
                    <span className="btn-icon">✦</span>
                    <span className="btn-text">{t('icon_picker.tab_icon')}</span>
                  </button>
                  <button
                    type="button"
                    className={`avatar-picker-tab ${avatarTab === 'upload' ? 'active' : ''}`}
                    onClick={() => setAvatarTab('upload')}
                  >
                    <span className="btn-icon">⬆</span>
                    <span className="btn-text">{t('icon_picker.tab_upload')}</span>
                  </button>
                </div>
                {avatarTab === 'icon' ? (
                  <IconPicker
                    selected={selectedAvatar?.kind === 'icon' ? selectedAvatar.value : undefined}
                    onChange={handleIconSelect}
                    avatarMode={true}
                  />
                ) : (
                  <div className="avatar-picker-upload">
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={handleFileChange}
                    />
                    {selectedAvatar?.kind === 'image' && (
                      <img
                        src={selectedAvatar.value}
                        alt="Preview"
                        className="avatar-picker-preview"
                      />
                    )}
                  </div>
                )}
              </div>
              {avatarError && <div className="settings-error">{avatarError}</div>}
            </>
          )}
        </div>

        {/* Theme Section */}
        <div className="settings-section">
          <h3>{t('settings.theme')}</h3>
          <div className="theme-selector">
            {THEMES.map((themeOption) => (
              <button
                key={themeOption.value}
                type="button"
                className={`theme-option ${user?.preferred_theme === themeOption.value ? 'active' : ''}`}
                onClick={() => handleThemeChange(themeOption.value)}
              >
                <span className="theme-icon">{themeOption.icon}</span>
                <span>{t(themeOption.key)}</span>
              </button>
            ))}
          </div>
          {themeError && <div className="settings-error">{themeError}</div>}
        </div>

        {/* PIN Section */}
        <div className="settings-section">
          <h3>{t('pin_reset.title')}</h3>
          {pinSuccess ? (
            <div className="success-msg">{t('pin_reset.success')}</div>
          ) : (
            <form onSubmit={handleSubmitPin} className="settings-form">
              <label className="form-group">
                <span>{t('pin_reset.current')}</span>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  value={currentPin}
                  onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  placeholder="1234"
                />
              </label>

              <label className="form-group">
                <span>{t('pin_reset.new')}</span>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  placeholder="5678"
                />
              </label>

              <label className="form-group">
                <span>{t('pin_reset.confirm')}</span>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  placeholder="5678"
                />
              </label>

              {pinError && <div className="settings-error">{pinError}</div>}

              <button type="submit" className="settings-submit" disabled={pinLoading}>
                {pinLoading ? t('pin_reset.updating') : t('pin_reset.update_pin')}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
