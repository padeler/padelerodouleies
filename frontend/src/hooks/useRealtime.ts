import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../state/authStore';

const WS_BASE = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`;

let sharedConnection: WebSocket | null = null;

function connect() {
  if (sharedConnection) return;
  const ws = new WebSocket(WS_BASE);
  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    window.dispatchEvent(new CustomEvent('ws-event', { detail: msg }));
  };
  ws.onclose = () => {
    sharedConnection = null;
    setTimeout(connect, 3000);
  };
  ws.onerror = () => ws.close();
  sharedConnection = ws;
}

export function useRealtime() {
  const queryClient = useQueryClient();

  useEffect(() => {
    connect();
    const handler = (e: Event) => {
      const msg = (e as CustomEvent).detail;
      switch (msg.event) {
        case 'stars_changed': {
          const user = useAuthStore.getState().user;
          if (user && msg.user_id === user.id) {
            useAuthStore.setState({ user: { ...user, current_stars: msg.current_stars } });
          }
          queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
          queryClient.invalidateQueries({ queryKey: ['stats'] });
          break;
        }
        case 'pending_stars_changed': {
          const user = useAuthStore.getState().user;
          if (user && msg.user_id === user.id) {
            useAuthStore.setState({ user: { ...user, pending_stars: msg.pending_stars } });
          }
          break;
        }
        case 'visible_chores_changed':
          queryClient.invalidateQueries({ queryKey: ['visible-chores'] });
          break;
        case 'collab_progress_changed':
          queryClient.invalidateQueries({ queryKey: ['marketplace-rewards'] });
          break;
        case 'pending_claims_changed':
          queryClient.invalidateQueries({ queryKey: ['pending-count'] });
          break;
        case 'history_changed':
          queryClient.invalidateQueries({ queryKey: ['kid-history'] });
          break;
        case 'fulfillment_queue_changed':
          queryClient.invalidateQueries({ queryKey: ['fulfillment'] });
          break;
        case 'chores_changed':
          queryClient.invalidateQueries({ queryKey: ['chores'] });
          break;
      }
    };
    window.addEventListener('ws-event', handler);
    return () => {
      window.removeEventListener('ws-event', handler);
    };
  }, [queryClient]);
}
