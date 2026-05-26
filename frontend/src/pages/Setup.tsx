import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { bootstrapSetup } from '../api/client';
import { useAuth } from '../hooks/useAuth';
import './Setup.css';

const AVATAR_ICONS = ['shield', 'fox', 'unicorn', 'dragon', 'owl', 'lion', 'butterfly', 'robot', 'star', 'heart'];

export function Setup() {
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
        setError('Please enter your name');
        return;
      }
      if (pin !== confirmPin) {
        setError('PINs do not match');
        return;
      }
      if (!/^\d{4}$/.test(pin)) {
        setError('PIN must be exactly 4 digits');
        return;
      }

      setLoading(true);
      try {
        const user = await bootstrapSetup(name.trim(), 'icon', avatar, pin);
        setUser({ ...user, role: user.role as 'admin' | 'user' });
        navigate('/admin');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Setup failed');
      } finally {
        setLoading(false);
      }
    },
    [name, avatar, pin, confirmPin, setUser, navigate],
  );

  return (
    <div className="setup">
      <form className="setup-form" onSubmit={handleSubmit}>
        <h1>Create Admin Account</h1>

        <label className="form-group">
          <span>Name</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            autoFocus
          />
        </label>

        <label className="form-group">
          <span>Avatar</span>
          <div className="avatar-select">
            {AVATAR_ICONS.map((icon) => (
              <button
                key={icon}
                type="button"
                className={`avatar-option ${avatar === icon ? 'selected' : ''}`}
                onClick={() => setAvatar(icon)}
              >
                <img src={`/icons/${icon}.svg`} alt={icon} />
              </button>
            ))}
          </div>
        </label>

        <label className="form-group">
          <span>PIN (4 digits)</span>
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
          <span>Confirm PIN</span>
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
          {loading ? 'Creating…' : 'Create Account'}
        </button>
      </form>
    </div>
  );
}
