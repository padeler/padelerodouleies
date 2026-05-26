import { create } from 'zustand';

export interface AuthUser {
  id: number;
  name: string;
  avatar_kind: string;
  avatar_value: string;
  role: 'admin' | 'user';
  current_stars: number;
  preferred_locale: string;
}

interface AuthState {
  user: AuthUser | null;
  selected_user_id: number | null;
  setUser: (user: AuthUser) => void;
  clearUser: () => void;
  setSelectedUserId: (id: number | null) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  selected_user_id: null,
  setUser: (user) => set({ user }),
  clearUser: () => set({ user: null, selected_user_id: null }),
  setSelectedUserId: (id) => set({ selected_user_id: id }),
}));
