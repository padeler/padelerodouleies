import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../hooks/useAuth';
import { logout } from '../api/client';
import { useT } from '../i18n/store';
import { notifyInfo } from '../lib/notify';

/** Auto-logout after this much inactivity (kids and admins alike). */
const IDLE_LIMIT_MS = 5 * 60 * 1000;

const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'] as const;

/**
 * Logs the current user out after IDLE_LIMIT_MS without interaction, returning
 * to the login screen with an explanatory toast. Renders nothing; only active
 * while a user is logged in.
 */
export function IdleWatcher() {
  const { user, clearUser } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const t = useT();
  const timer = useRef<number | undefined>(undefined);

  // Keyed on user id so per-render user updates (e.g. star changes) don't churn.
  const userId = user?.id;

  useEffect(() => {
    if (!userId) return;

    const handleTimeout = async () => {
      console.log('[Idle] inactivity timeout reached, logging out');
      try {
        await logout();
      } finally {
        qc.clear();
        clearUser();
        notifyInfo(t('auth.idle_logout'));
        navigate('/');
      }
    };

    const reset = () => {
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(handleTimeout, IDLE_LIMIT_MS);
    };

    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    reset();

    return () => {
      if (timer.current) window.clearTimeout(timer.current);
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [userId, clearUser, navigate, qc, t]);

  return null;
}
