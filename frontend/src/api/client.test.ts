import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { login, logout, getMe, getUsers, updateLocale, changePin, getBootstrapStatus, bootstrapSetup, getChores, createChore, getRewards, createReward, getPendingClaims, approveClaim, declineClaim, getAdminUsers, adjustStars, getVisibleChores, claimChore, getKidHistory, getMarketplaceRewards, redeemReward, getLeaderboard, getIconCatalog } from './client';

const server = setupServer();

beforeEach(() => {
  server.listen();
});

afterEach(() => {
  server.resetHandlers();
  server.close();
});

describe('API client — auth', () => {
  it('login returns user data on success', async () => {
    server.use(
      http.post('/api/auth/login', async () => {
        return HttpResponse.json({ id: 1, name: 'Admin', avatar_kind: 'icon', avatar_value: 'shield', role: 'admin', current_stars: 100, preferred_locale: 'el' });
      }),
    );
    const user = await login(1, '1234');
    expect(user.name).toBe('Admin');
    expect(user.role).toBe('admin');
  });

  it('login throws 401 on wrong PIN', async () => {
    server.use(
      http.post('/api/auth/login', async () => {
        return HttpResponse.json({ detail: 'Invalid PIN' }, { status: 401 });
      }),
    );
    await expect(login(1, '0000')).rejects.toMatchObject({ status: 401 });
  });

  it('login throws 423 on lockout', async () => {
    server.use(
      http.post('/api/auth/login', async () => {
        return HttpResponse.json({ detail: 'Locked', locked_seconds: 30 }, { status: 423 });
      }),
    );
    await expect(login(1, '1234')).rejects.toMatchObject({ status: 423, locked_seconds: 30 });
  });

  it('getMe returns current user', async () => {
    server.use(
      http.get('/api/auth/me', async () => {
        return HttpResponse.json({ id: 2, name: 'Kid', avatar_kind: 'icon', avatar_value: 'fox', role: 'user', current_stars: 10, preferred_locale: 'el' });
      }),
    );
    const user = await getMe();
    expect(user.name).toBe('Kid');
  });

  it('getMe throws 401 when unauthenticated', async () => {
    server.use(
      http.get('/api/auth/me', async () => {
        return HttpResponse.json({ detail: 'Unauthorized' }, { status: 401 });
      }),
    );
    await expect(getMe()).rejects.toMatchObject({ status: 401 });
  });

  it('getUsers returns user list', async () => {
    server.use(
      http.get('/api/auth/users', async () => {
        return HttpResponse.json([
          { id: 1, name: 'Parent', avatar_kind: 'icon', avatar_value: 'shield', role: 'admin' },
          { id: 2, name: 'Kid', avatar_kind: 'icon', avatar_value: 'fox', role: 'user' },
        ]);
      }),
    );
    const users = await getUsers();
    expect(users.length).toBe(2);
    expect(users[0].role).toBe('admin');
    expect(users[1].role).toBe('user');
  });

  it('updateLocale persists locale change', async () => {
    let captured = '';
    server.use(
      http.post('/api/auth/me/locale', async ({ request }) => {
        const body = await request.json() as { locale: string };
        captured = body.locale;
        return HttpResponse.json({ locale: body.locale });
      }),
    );
    const result = await updateLocale('en');
    expect(captured).toBe('en');
    expect(result.locale).toBe('en');
  });

  it('changePin updates PIN successfully', async () => {
    server.use(
      http.post('/api/auth/me/pin', async ({ request }) => {
        const body = await request.json() as { current_pin: string; new_pin: string };
        if (body.current_pin !== '1234') {
          return HttpResponse.json({ detail: 'Wrong current PIN' }, { status: 400 });
        }
        return HttpResponse.json({ message: 'PIN changed' });
      }),
    );
    const result = await changePin('1234', '5678');
    expect(result.message).toBe('PIN changed');

    await expect(changePin('wrong', '5678')).rejects.toThrow();
  });

  it('logout clears session', async () => {
    server.use(
      http.post('/api/auth/logout', async () => {
        return HttpResponse.json({ message: 'Logged out' });
      }),
    );
    const result = await logout();
    expect(result).toEqual({ message: 'Logged out' });
  });
});

describe('API client — bootstrap', () => {
  it('getBootstrapStatus returns first_run true on empty DB', async () => {
    server.use(
      http.get('/api/bootstrap/status', async () => {
        return HttpResponse.json({ first_run: true });
      }),
    );
    const result = await getBootstrapStatus();
    expect(result.first_run).toBe(true);
  });

  it('bootstrapSetup creates admin and returns user', async () => {
    server.use(
      http.post('/api/bootstrap/setup', async ({ request }) => {
        const body = await request.json() as { name: string; avatar_kind: string; avatar_value: string; pin: string };
        return HttpResponse.json({ id: 1, name: body.name, avatar_kind: body.avatar_kind, avatar_value: body.avatar_value, role: 'admin', current_stars: 0, preferred_locale: 'el' });
      }),
    );
    const user = await bootstrapSetup('Dad', 'icon', 'shield', '1234');
    expect(user.name).toBe('Dad');
    expect(user.role).toBe('admin');
  });
});

describe('API client — admin chores', () => {
  it('getChores returns chore list', async () => {
    server.use(
      http.get('/api/admin/chores', async () => {
        return HttpResponse.json([
          { id: 1, title_el: 'Βούρτσισμα', title_en: 'Brush Teeth', description_el: null, description_en: null, icon_name: 'tooth', scope: 'individual', points_value: 5, is_repeating: true, start_time: '07:00:00', window_hours: 2, is_active: true, created_at: '2024-01-01T00:00:00' },
        ]);
      }),
    );
    const chores = await getChores();
    expect(chores.length).toBe(1);
    expect(chores[0].title_en).toBe('Brush Teeth');
    expect(chores[0].points_value).toBe(5);
  });

  it('createChore sends correct payload', async () => {
    let captured: any = null;
    server.use(
      http.post('/api/admin/chores', async ({ request }) => {
        captured = await request.json();
        return HttpResponse.json({ id: 2 }, { status: 200 });
      }),
    );
    await createChore({ title_el: 'Πλύσιμο', title_en: 'Wash Hands', icon_name: 'hand', scope: 'individual', points_value: 3, is_repeating: true });
    expect(captured.title_en).toBe('Wash Hands');
    expect(captured.points_value).toBe(3);
  });
});

describe('API client — admin rewards', () => {
  it('getRewards returns reward list', async () => {
    server.use(
      http.get('/api/admin/rewards', async () => {
        return HttpResponse.json([
          { id: 1, title_el: 'Κινηματογράφος', title_en: 'Movie', description_el: null, description_en: null, icon_name: 'film', cost_stars: 30, is_collaborative: false, is_enabled: true, created_at: '2024-01-01' },
        ]);
      }),
    );
    const rewards = await getRewards();
    expect(rewards.length).toBe(1);
    expect(rewards[0].cost_stars).toBe(30);
  });

  it('createReward sends correct payload', async () => {
    let captured: any = null;
    server.use(
      http.post('/api/admin/rewards', async ({ request }) => {
        captured = await request.json();
        return HttpResponse.json({ id: 3 }, { status: 200 });
      }),
    );
    await createReward({ title_el: 'Πάρκο', title_en: 'Park', icon_name: 'trees', cost_stars: 50, is_collaborative: false });
    expect(captured.title_en).toBe('Park');
    expect(captured.cost_stars).toBe(50);
  });
});

describe('API client — pending claims', () => {
  it('getPendingClaims returns claims', async () => {
    server.use(
      http.get('/api/admin/pending-claims', async () => {
        return HttpResponse.json([
          { id: 1, user_id: 2, user_name: 'Maria', user_avatar_kind: 'icon', user_avatar_value: 'fox', chore_id: 1, chore_icon: 'tooth', chore_title_el: 'Βούρτσισμα', chore_title_en: 'Brush Teeth', points_value: 5, claimed_at: '2024-06-01T08:00:00' },
        ]);
      }),
    );
    const claims = await getPendingClaims();
    expect(claims.length).toBe(1);
    expect(claims[0].user_name).toBe('Maria');
  });

  it('approveClaim calls correct endpoint', async () => {
    let called = false;
    server.use(
      http.post('/api/admin/pending-claims/1/approve', async () => {
        called = true;
        return HttpResponse.json({ ok: true });
      }),
    );
    await approveClaim(1);
    expect(called).toBe(true);
  });

  it('declineClaim sends admin note', async () => {
    let captured = '';
    server.use(
      http.post('/api/admin/pending-claims/1/decline', async ({ request }) => {
        const body = await request.json() as { admin_note: string };
        captured = body.admin_note;
        return HttpResponse.json({ ok: true });
      }),
    );
    await declineClaim(1, 'Not done properly');
    expect(captured).toBe('Not done properly');
  });
});

describe('API client — user management', () => {
  it('getAdminUsers returns users', async () => {
    server.use(
      http.get('/api/admin/users', async () => {
        return HttpResponse.json([
          { id: 1, name: 'Dad', avatar_kind: 'icon', avatar_value: 'shield', role: 'admin', current_stars: 0, preferred_locale: 'el', is_active: true },
        ]);
      }),
    );
    const users = await getAdminUsers();
    expect(users[0].role).toBe('admin');
    expect(users[0].is_active).toBe(true);
  });

  it('adjustStars sends correct delta', async () => {
    let captured: any = null;
    server.use(
      http.post('/api/admin/users/2/adjust-stars', async ({ request }) => {
        captured = await request.json();
        return HttpResponse.json({ ok: true });
      }),
    );
    await adjustStars(2, 5, 'Good behavior');
    expect(captured.points_delta).toBe(5);
    expect(captured.description).toBe('Good behavior');
  });
});

describe('API client — dashboard', () => {
  it('getVisibleChores returns active chores', async () => {
    server.use(
      http.get('/api/dashboard/visible-chores', async () => {
        return HttpResponse.json([
          { id: 1, title_el: 'Βούρτσισμα', title_en: 'Brush Teeth', icon_name: 'tooth', scope: 'individual', points_value: 5 },
        ]);
      }),
    );
    const chores = await getVisibleChores();
    expect(chores[0].points_value).toBe(5);
  });

  it('claimChore calls correct endpoint', async () => {
    let choreId = '';
    server.use(
      http.post('/api/dashboard/chores/:id/claim', async ({ params }) => {
        choreId = params.id as string;
        return HttpResponse.json({ ok: true });
      }),
    );
    await claimChore(42);
    expect(choreId).toBe('42');
  });

  it('getKidHistory returns paginated history', async () => {
    server.use(
      http.get('/api/dashboard/history', async () => {
        return HttpResponse.json({
          total: 2,
          entries: [
            { id: 1, action_type: 'chore_approved', points_delta: 5, ref_table: 'chore', ref_id: 1, admin_note: null, timestamp: '2024-06-01T08:00:00' },
          ],
        });
      }),
    );
    const history = await getKidHistory();
    expect(history.total).toBe(2);
    expect(history.entries[0].points_delta).toBe(5);
  });

  it('getLeaderboard returns ranked kids', async () => {
    server.use(
      http.get('/api/leaderboard', async () => {
        return HttpResponse.json([
          { ranking: 1, id: 2, name: 'Maria', avatar_kind: 'icon', avatar_value: 'fox', current_stars: 50 },
          { ranking: 2, id: 3, name: 'Nikos', avatar_kind: 'icon', avatar_value: 'unicorn', current_stars: 30 },
        ]);
      }),
    );
    const board = await getLeaderboard();
    expect(board[0].ranking).toBe(1);
    expect(board[1].current_stars).toBe(30);
  });
});

describe('API client — marketplace', () => {
  it('getMarketplaceRewards returns rewards', async () => {
    server.use(
      http.get('/api/marketplace/rewards', async () => {
        return HttpResponse.json([
          { id: 1, title_el: 'Κινηματογράφος', title_en: 'Movie', description_el: null, description_en: null, icon_name: 'film', cost_stars: 30, is_collaborative: false },
        ]);
      }),
    );
    const rewards = await getMarketplaceRewards();
    expect(rewards[0].cost_stars).toBe(30);
  });

  it('redeemReward calls correct endpoint', async () => {
    let rewardId = '';
    server.use(
      http.post('/api/rewards/:id/redeem', async ({ params }) => {
        rewardId = params.id as string;
        return HttpResponse.json({ ok: true });
      }),
    );
    await redeemReward(7);
    expect(rewardId).toBe('7');
  });
});

describe('API client — icons', () => {
  it('getIconCatalog returns catalog entries', async () => {
    server.use(
      http.get('/api/icons/catalog', async () => {
        return HttpResponse.json([
          { name: 'star', category: 'rewards', svg_ref: 'icons/svg/star.svg', keywords_en: ['star', 'points'], keywords_el: ['άστρο', 'πόντοι'] },
        ]);
      }),
    );
    const catalog = await getIconCatalog();
    expect(catalog[0].name).toBe('star');
    expect(catalog[0].keywords_en).toContain('star');
  });
});
