const BASE = '/api';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const resp = await fetch(`${BASE}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });
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

export async function changePin(currentPin: string, newPin: string) {
  return request<{ message: string }>('/auth/me/pin', {
    method: 'POST',
    body: JSON.stringify({ current_pin: currentPin, new_pin: newPin }),
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
  }>('/bootstrap/setup', {
    method: 'POST',
    body: JSON.stringify({ name, avatar_kind: avatarKind, avatar_value: avatarValue, pin }),
  });
}
