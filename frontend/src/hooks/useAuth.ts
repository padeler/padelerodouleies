import { useAuthStore } from '../state/authStore';

export function useAuth() {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const clearUser = useAuthStore((s) => s.clearUser);
  const selectedUserId = useAuthStore((s) => s.selected_user_id);
  const setSelectedUserId = useAuthStore((s) => s.setSelectedUserId);

  return {
    user,
    setUser,
    clearUser,
    isAuthenticated: user !== null,
    isAdmin: user?.role === 'admin',
    selectedUserId,
    setSelectedUserId,
  };
}
