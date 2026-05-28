import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { bootstrapSetup } from '../api/client';
import { useAuth } from '../hooks/useAuth';
import { useT } from '../i18n/store';
import './Setup.css';

const AVATAR_ICONS = ['shield', 'fox', 'unicorn', 'crown', 'ghost', 'rabbit', 'rocket', 'gem', 'star', 'trophy'];

export function Setup() {
  const t = useT();
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState('shield');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError('');

      if (!name.trim()) {
        setError(t('setup.error_name'));
        return;
      }
      if (pin !== confirmPin) {
        setError(t('bootstrap.pin_mismatch'));
        return;
      }
      if (!/^\d{4}$/.test(pin)) {
        setError(t('setup.error_pin_digits'));
        return;
      }

      setLoading(true);
      try {
        const user = await bootstrapSetup(name.trim(), 'icon', avatar, pin);
        setUser({ ...user, role: user.role as 'admin' | 'user' });
        navigate('/admin');
      } catch (err) {
        setError(err instanceof Error ? err.message : t('setup.error_failed'));
      } finally {
        setLoading(false);
      }
    },
    [name, avatar, pin, confirmPin, setUser, navigate, t],
  );

  return (
    <div className="setup">
      <form className="setup-form" onSubmit={handleSubmit}>
        <h1>{t('login.first_run_title')}</h1>

        <label className="form-group">
          <span>{t('bootstrap.name')}</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('bootstrap.name')}
            autoFocus
          />
        </label>

        <label className="form-group">
          <span>{t('bootstrap.avatar')}</span>
          <div className="avatar-select">
            {AVATAR_ICONS.map((icon) => (
              <button
                key={icon}
                type="button"
                className={`avatar-option ${avatar === icon ? 'selected' : ''}`}
                onClick={() => setAvatar(icon)}
              >
                <img src={`/api/icons/svg/${icon}`} alt={icon} />
              </button>
            ))}
          </div>
        </label>

        <label className="form-group">
          <span>{t('bootstrap.pin')}</span>
          <input
            type="password"
            inputMode="numeric"
            maxLength={4}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
            placeholder="1234"
          />
        </label>

        <label className="form-group">
          <span>{t('bootstrap.pin_confirm')}</span>
          <input
            type="password"
            inputMode="numeric"
            maxLength={4}
            value={confirmPin}
            onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
            placeholder="1234"
          />
        </label>

        {error && <div className="setup-error">{error}</div>}

        <button type="submit" className="setup-submit" disabled={loading}>
          {loading ? t('setup.creating') : t('setup.create')}
        </button>
      </form>
    </div>
  );
}
