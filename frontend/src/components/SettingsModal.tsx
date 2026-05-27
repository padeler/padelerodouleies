import { useState, useCallback } from 'react';
import { changePin, updateTheme } from '../api/client';
import { useAuth } from '../hooks/useAuth';
import './SettingsModal.css';

const THEMES = [
  { value: 'system', label: 'System', icon: '💻' },
  { value: 'light', label: 'Light', icon: '☀️' },
  { value: 'dark', label: 'Dark', icon: '🌙' },
];

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
}

export function SettingsModal({ open, onClose }: SettingsModalProps) {
  const { user, setUser } = useAuth();
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError('');
      setSuccess(false);

      if (newPin !== confirmPin) {
        setError('New PINs do not match');
        return;
      }
      if (!/^\d{4}$/.test(newPin)) {
        setError('PIN must be exactly 4 digits');
        return;
      }

      setLoading(true);
      try {
        await changePin(currentPin, newPin);
        setSuccess(true);
        setCurrentPin('');
        setNewPin('');
        setConfirmPin('');
        setTimeout(() => {
          setSuccess(false);
          onClose();
        }, 1500);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to change PIN');
      } finally {
        setLoading(false);
      }
    },
    [currentPin, newPin, confirmPin, onClose],
  );

  const handleThemeChange = useCallback(
    async (theme: string) => {
      try {
        await updateTheme(theme);
        if (user) {
          setUser({ ...user, preferred_theme: theme });
        }
      } catch (err) {
        console.error('[Settings] failed to update theme:', err);
      }
    },
    [user, setUser],
  );

  const handleClose = useCallback(() => {
    setCurrentPin('');
    setNewPin('');
    setConfirmPin('');
    setError('');
    setSuccess(false);
    onClose();
  }, [onClose]);

  if (!open) return null;

  return (
    <div className="settings-overlay" onClick={handleClose}>
      <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <h2>Settings</h2>
          <button className="close-btn" type="button" onClick={handleClose}>
            ✕
          </button>
        </div>

        <div className="settings-section">
          <h3>Theme</h3>
          <div className="theme-selector">
            {THEMES.map((t) => (
              <button
                key={t.value}
                type="button"
                className={`theme-option ${user?.preferred_theme === t.value ? 'active' : ''}`}
                onClick={() => handleThemeChange(t.value)}
              >
                <span className="theme-icon">{t.icon}</span>
                <span>{t.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="settings-section">
          <h3>Change PIN</h3>
          {success ? (
            <div className="success-msg">PIN updated!</div>
          ) : (
            <form onSubmit={handleSubmit} className="settings-form">
              <label className="form-group">
                <span>Current PIN</span>
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
                <span>New PIN</span>
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
                <span>Confirm New PIN</span>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  placeholder="5678"
                />
              </label>

              {error && <div className="settings-error">{error}</div>}

              <button type="submit" className="settings-submit" disabled={loading}>
                {loading ? 'Saving…' : 'Save'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
