import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { getUsers, login, getBootstrapStatus, getPendingStars } from '../api/client';
import { useAuth } from '../hooks/useAuth';
import { PinPad } from '../components/PinPad';
import './Landing.css';

interface UserListItem {
  id: number;
  name: string;
  avatar_kind: string;
  avatar_value: string;
  role: string;
}

function AvatarTile({ user, onSelected }: { user: UserListItem; onSelected: (id: number) => void }) {
  const handleClick = () => {
    onSelected(user.id);
  };

  const avatarSrc =
    user.avatar_kind === 'image'
      ? user.avatar_value
      : `/api/icons/svg/${user.avatar_value}`;

  return (
    <button className="avatar-tile" type="button" onClick={handleClick}>
      <div className="avatar-circle">
        <img src={avatarSrc} alt={user.name} className="avatar-img" />
      </div>
      <span className="avatar-name">{user.name}</span>
      {user.role === 'admin' && <span className="admin-badge">🛡</span>}
    </button>
  );
}

export function Landing() {
  const navigate = useNavigate();
  const { setUser, selectedUserId, clearUser, setSelectedUserId } = useAuth();
  const [showPin, setShowPin] = useState(false);
  const [lockedSeconds, setLockedSeconds] = useState<number | null>(null);

  const { data: users } = useQuery<UserListItem[]>({
    queryKey: ['users'],
    queryFn: getUsers,
  });

  const { data: bootstrap } = useQuery<{ first_run: boolean }>({
    queryKey: ['bootstrap'],
    queryFn: getBootstrapStatus,
  });

  useEffect(() => {
    if (bootstrap?.first_run) {
      navigate('/setup');
    }
  }, [bootstrap, navigate]);

  const handlePinComplete = async (pin: string) => {
    if (!selectedUserId) return;
    try {
      const user = await login(selectedUserId, pin);
      const authUser = { ...user, role: user.role as 'admin' | 'user' };
      if (user.role === 'user') {
        try {
          const pending = await getPendingStars();
          setUser({ ...authUser, pending_stars: pending.pending_stars });
        } catch {
          setUser({ ...authUser, pending_stars: 0 });
        }
      } else {
        setUser({ ...authUser, pending_stars: 0 });
      }
      if (user.role === 'admin') {
        navigate('/admin');
      } else {
        navigate('/dashboard');
      }
    } catch (e) {
      const err = e as { status?: number; locked_seconds?: number };
      if (err.status === 423 && err.locked_seconds) {
        setLockedSeconds(err.locked_seconds);
        setShowPin(true);
      } else {
        window.dispatchEvent(new Event('pin-trigger-wrong'));
      }
    }
  };

  const handlePinCancel = () => {
    setShowPin(false);
    setLockedSeconds(null);
    clearUser();
  };

  return (
    <div className="landing">
      <h1 className="landing-title">Select your profile</h1>
      {users && (
        <div className="avatar-grid">
          {users.map((user) => (
            <AvatarTile key={user.id} user={user} onSelected={(id) => { setSelectedUserId(id); setShowPin(true); }} />
          ))}
        </div>
      )}
      {showPin && (
        <PinPad
          onComplete={handlePinComplete}
          onCancel={handlePinCancel}
          lockedSeconds={lockedSeconds}
        />
      )}
    </div>
  );
}
