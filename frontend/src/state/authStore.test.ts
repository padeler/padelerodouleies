import { describe, expect, it, afterEach } from 'vitest';
import { useAuthStore } from './authStore';

describe('authStore', () => {
  afterEach(() => {
    useAuthStore.getState().clearUser();
  });

  it('initializes with null user and selected_user_id', () => {
    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.selected_user_id).toBeNull();
  });

  it('sets a user via setUser', () => {
    const user = {
      id: 1,
      name: 'Admin',
      avatar_kind: 'icon' as const,
      avatar_value: 'shield',
      role: 'admin' as const,
      current_stars: 100,
      preferred_locale: 'el',
    };
    useAuthStore.getState().setUser(user);
    expect(useAuthStore.getState().user).toEqual(user);
  });

  it('clears user and selected_user_id via clearUser', () => {
    useAuthStore.getState().setUser({
      id: 2,
      name: 'Kid',
      avatar_kind: 'icon',
      avatar_value: 'fox',
      role: 'user',
      current_stars: 10,
      preferred_locale: 'en',
    });
    useAuthStore.getState().setSelectedUserId(42);
    useAuthStore.getState().clearUser();
    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().selected_user_id).toBeNull();
  });

  it('sets selected_user_id independently', () => {
    useAuthStore.getState().setSelectedUserId(7);
    expect(useAuthStore.getState().selected_user_id).toBe(7);
    // user should still be null
    expect(useAuthStore.getState().user).toBeNull();
  });
});
