const BASE = '/api';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  console.log('[API] →', init?.method || 'GET', `${BASE}${path}`);
  const resp = await fetch(`${BASE}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });
  console.log('[API] ←', resp.status, path);
  if (!resp.ok && resp.status !== 401 && resp.status !== 423) {
    const body = await resp.json().catch(() => ({}));
    throw new Error(body.detail || `HTTP ${resp.status}`);
  }
  if (resp.status === 401) {
    throw { status: 401, detail: 'Unauthorized' };
  }
  if (resp.status === 423) {
    const body = await resp.json();
    throw { status: 423, detail: body.detail, locked_seconds: body.locked_seconds };
  }
  return resp.json();
}

export async function login(userId: number, pin: string) {
  return request<{
    id: number;
    name: string;
    avatar_kind: string;
    avatar_value: string;
    role: string;
    current_stars: number;
    preferred_locale: string;
    preferred_theme: string;
  }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ user_id: userId, pin }),
  });
}

export async function logout() {
  return request<unknown>('/auth/logout', { method: 'POST' });
}

export async function getMe() {
  return request<{
    id: number;
    name: string;
    avatar_kind: string;
    avatar_value: string;
    role: string;
    current_stars: number;
    preferred_locale: string;
    preferred_theme: string;
  }>('/auth/me');
}

export async function getUsers() {
  return request<{
    id: number;
    name: string;
    avatar_kind: string;
    avatar_value: string;
    role: string;
  }[]>('/auth/users');
}

export async function updateLocale(locale: string) {
  return request<{ locale: string }>('/auth/me/locale', {
    method: 'POST',
    body: JSON.stringify({ locale }),
  });
}

export async function updateTheme(theme: string) {
  return request<{ theme: string }>('/auth/me/theme', {
    method: 'POST',
    body: JSON.stringify({ theme }),
  });
}

export async function updateAccent(accentColor: string | null) {
  return request<{ accent_color: string | null }>('/auth/me/accent', {
    method: 'POST',
    body: JSON.stringify({ accent_color: accentColor }),
  });
}

export async function changePin(currentPin: string, newPin: string) {
  return request<{ message: string }>('/auth/me/pin', {
    method: 'POST',
    body: JSON.stringify({ current_pin: currentPin, new_pin: newPin }),
  });
}

export async function uploadMyAvatar(file: File) {
  const formData = new FormData();
  formData.append('file', file);
  const resp = await fetch('/api/auth/me/avatar-upload', {
    method: 'POST',
    credentials: 'include',
    body: formData,
  });
  if (!resp.ok) {
    const body = await resp.json().catch(() => ({}));
    throw new Error(body.detail || `HTTP ${resp.status}`);
  }
  return resp.json() as Promise<{ url: string }>;
}

export async function updateMeAvatar(avatarKind: string, avatarValue: string) {
  return request<{
    id: number;
    name: string;
    avatar_kind: string;
    avatar_value: string;
    role: string;
    current_stars: number;
    preferred_locale: string;
    preferred_theme: string;
  }>('/auth/me/avatar', {
    method: 'PATCH',
    body: JSON.stringify({ avatar_kind: avatarKind, avatar_value: avatarValue }),
  });
}

export async function getBootstrapStatus() {
  return request<{ first_run: boolean }>('/bootstrap/status');
}

export async function bootstrapSetup(name: string, avatarKind: string, avatarValue: string, pin: string) {
  return request<{
    id: number;
    name: string;
    avatar_kind: string;
    avatar_value: string;
    role: string;
    current_stars: number;
    preferred_locale: string;
    preferred_theme: string;
  }>('/bootstrap/setup', {
    method: 'POST',
    body: JSON.stringify({ name, avatar_kind: avatarKind, avatar_value: avatarValue, pin }),
  });
}

export async function getTranslations() {
  return request<Record<string, Record<string, string>>>('/i18n/translations');
}

/* -- Admin endpoints -- */

export async function getPendingCount() {
  return request<{ count: number }>('/admin/pending-count');
}

export async function getIconCatalog() {
  return request<Array<{
    name: string;
    category: string;
    svg_ref: string;
    keywords_en: string[];
    keywords_el: string[];
  }>>('/icons/catalog');
}

export async function uploadAvatar(file: File) {
  const formData = new FormData();
  formData.append('file', file);
  const resp = await fetch('/api/admin/avatars', {
    method: 'POST',
    credentials: 'include',
    body: formData,
  });
  if (!resp.ok) {
    const body = await resp.json().catch(() => ({}));
    throw new Error(body.detail || `HTTP ${resp.status}`);
  }
  return resp.json() as Promise<{ url: string }>;
}

export async function uploadChoreImage(file: File) {
  const formData = new FormData();
  formData.append('file', file);
  const resp = await fetch('/api/admin/chore-images', {
    method: 'POST',
    credentials: 'include',
    body: formData,
  });
  if (!resp.ok) {
    const body = await resp.json().catch(() => ({}));
    throw new Error(body.detail || `HTTP ${resp.status}`);
  }
  return resp.json() as Promise<{ url: string }>;
}

/* -- Chore CRUD -- */

export async function getChores() {
  return request<Array<{
    id: number;
    title: string;
    description: string | null;
    icon_name: string;
    scope: string;
    points_value: number;
    is_repeating: boolean;
    start_time: string | null;
    window_hours: number | null;
    is_active: boolean;
    repeat_days: string[] | null;
    n_day_interval: number | null;
    created_at: string;
  }>>('/admin/chores');
}

export async function createChore(data: Record<string, unknown>) {
  return request<unknown>('/admin/chores', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateChore(id: number, data: Record<string, unknown>) {
  return request<unknown>(`/admin/chores/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteChore(id: number) {
  return request<unknown>(`/admin/chores/${id}`, { method: 'DELETE' });
}

/* -- Reward CRUD -- */

export async function getRewards() {
  return request<Array<{
    id: number;
    title: string;
    description: string | null;
    icon_name: string;
    cost_stars: number;
    is_collaborative: boolean;
    is_enabled: boolean;
    created_at: string;
  }>>('/admin/rewards');
}

export async function createReward(data: {
  title: string;
  description?: string;
  icon_name: string;
  cost_stars: number;
  is_collaborative: boolean;
}) {
  return request<unknown>('/admin/rewards', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateReward(id: number, data: Record<string, unknown>) {
  return request<unknown>(`/admin/rewards/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteReward(id: number) {
  return request<unknown>(`/admin/rewards/${id}`, { method: 'DELETE' });
}

/* -- Pending claims -- */

export async function getPendingClaims() {
  return request<Array<{
    id: number;
    user_id: number;
    user_name: string;
    user_avatar_kind: string;
    user_avatar_value: string;
    chore_id: number;
    chore_icon: string;
    chore_title: string;
    points_value: number;
    claimed_at: string;
  }>>('/admin/pending-claims');
}

export async function approveClaim(claimId: number) {
  return request<unknown>(`/admin/pending-claims/${claimId}/approve`, { method: 'POST' });
}

export async function declineClaim(claimId: number, adminNote?: string) {
  return request<unknown>(`/admin/pending-claims/${claimId}/decline`, {
    method: 'POST',
    body: JSON.stringify({ admin_note: adminNote }),
  });
}

/* -- User management -- */

export async function getAdminUsers() {
  return request<Array<{
    id: number;
    name: string;
    avatar_kind: string;
    avatar_value: string;
    role: string;
    current_stars: number;
    preferred_locale: string;
    is_active: boolean;
  }>>('/admin/users');
}

export async function createAdminUser(data: {
  name: string;
  avatar_kind: string;
  avatar_value: string;
  role: string;
  pin: string;
}) {
  return request<unknown>('/admin/users', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateAdminUser(id: number, data: Record<string, unknown>) {
  return request<unknown>(`/admin/users/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteAdminUser(id: number) {
  return request<unknown>(`/admin/users/${id}`, { method: 'DELETE' });
}

export async function resetUserPin(id: number, newPin: string) {
  return request<unknown>(`/admin/users/${id}/pin-reset`, {
    method: 'POST',
    body: JSON.stringify({ new_pin: newPin }),
  });
}

export async function adjustStars(userId: number, pointsDelta: number, description: string) {
  return request<unknown>(`/admin/users/${userId}/adjust-stars`, {
    method: 'POST',
    body: JSON.stringify({ points_delta: pointsDelta, description }),
  });
}

/* -- Fulfillment -- */

export async function getFulfillmentQueue(status: 'claimed' | 'fulfilled') {
  return request<Array<{
    id: number;
    reward_id: number;
    reward_title: string;
    reward_icon: string;
    user_id: number;
    user_name: string;
    status: string;
    claimed_at: string;
    fulfilled_at: string | null;
    stars_contributed: number;
  }>>(`/admin/fulfillment?status=${status}`);
}

export async function markFulfilled(ledgerId: number) {
  return request<unknown>(`/admin/fulfillment/${ledgerId}/mark-fulfilled`, { method: 'POST' });
}

export async function cancelFulfillment(ledgerId: number, reason?: string) {
  return request<{ message: string; refunded: number }>(
    `/admin/fulfillment/${ledgerId}/cancel`,
    { method: 'POST', body: JSON.stringify({ reason: reason ?? null }) },
  );
}

/* -- Admin history -- */

export async function getAdminHistory(params: {
  userId?: number;
  actionType?: string;
  fromDate?: string;
  toDate?: string;
  limit?: number;
  offset?: number;
}) {
  const qs = new URLSearchParams();
  if (params.userId) qs.set('user_id', String(params.userId));
  if (params.actionType) qs.set('action_type', params.actionType);
  if (params.fromDate) qs.set('from', params.fromDate);
  if (params.toDate) qs.set('to', params.toDate);
  if (params.limit) qs.set('limit', String(params.limit));
  if (params.offset) qs.set('offset', String(params.offset));
  const separator = qs.toString() ? '?' : '';
  return request<{
    total: number;
    entries: Array<{
      id: number;
      user_id: number;
      user_name: string;
      action_type: string;
      action_label: string | null;
      points_delta: number;
      ref_table: string | null;
      ref_id: number | null;
      admin_note: string | null;
      timestamp: string;
    }>;
  }>(`/admin/history${separator}${qs}`);
}

/* -- Dashboard endpoints -- */

export async function getVisibleChores() {
  return request<import('../lib/types').VisibleChore[]>('/dashboard/visible-chores');
}

export async function getPendingStars() {
  return request<{
    pending_stars: number;
    claims: Array<{
      claim_id: number;
      chore_id: number;
      chore_title: string;
      points_value: number;
      claimed_at: string;
    }>;
  }>('/dashboard/pending-stars');
}

export async function claimChore(choreId: number) {
  return request<unknown>(`/dashboard/chores/${choreId}/claim`, { method: 'POST' });
}

export async function getKidHistory(params?: { limit?: number; offset?: number }) {
  const qs = new URLSearchParams();
  if (params?.limit) qs.set('limit', String(params.limit));
  if (params?.offset) qs.set('offset', String(params.offset));
  const separator = qs.toString() ? '?' : '';
  return request<{
    total: number;
    entries: Array<{
      id: number;
      action_type: string;
      points_delta: number;
      ref_table: string | null;
      ref_id: number | null;
      admin_note: string | null;
      timestamp: string;
      chore_title?: string;
      chore_icon?: string;
      chore_points_value?: number;
      item_title?: string;
      item_icon?: string;
    }>;
  }>(`/dashboard/history${separator}${qs}`);
}

export async function getMarketplaceRewards() {
  return request<Array<{
    id: number;
    title: string;
    description: string | null;
    icon_name: string;
    cost_stars: number;
    is_collaborative: boolean;
    current_stars?: number;
    target_stars?: number;
    contributors?: Array<{ user_id: number; user_name: string; stars: number }>;
    available_again_at?: string | null;
  }>>('/marketplace/rewards');
}

export async function redeemReward(rewardId: number) {
  return request<unknown>(`/rewards/${rewardId}/redeem`, { method: 'POST' });
}

export async function contributeReward(rewardId: number, stars: number) {
  return request<unknown>(`/rewards/${rewardId}/contribute`, {
    method: 'POST',
    body: JSON.stringify({ stars }),
  });
}

export async function getLeaderboard() {
  return request<Array<{
    ranking: number;
    id: number;
    name: string;
    avatar_kind: string;
    avatar_value: string;
    current_stars: number;
  }>>('/leaderboard');
}

export async function getStats() {
  return request<import('../lib/types').StatsResponse>('/stats');
}

export async function getGameScores() {
  return request<Record<string, number>>('/games/scores');
}

export async function submitGameScore(game: string, score: number) {
  return request<{ best_score: number; improved: boolean }>('/games/scores', {
    method: 'POST',
    body: JSON.stringify({ game, score }),
  });
}
