import { describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { DashboardChores } from './DashboardChores';
import { useAuthStore } from '../../state/authStore';
import { useI18nStore } from '../../i18n/store';

const server = setupServer();

const TRANSLATIONS: Record<string, Record<string, string>> = {
  'login.welcome': { el: 'Καλωσήρθες', en: 'Welcome' },
  'chore.pending': { el: 'Αναμονή…', en: 'Pending…' },
  'chore.claim': { el: 'Διεκδίκηση', en: 'Claim' },
  'chore.already_claimed': { el: 'Ήδη διεκδικήθηκε!', en: 'Already claimed!' },
  'chore.none_visible': { el: 'Κανένα εργάκι', en: 'No chores' },
  'chore.status_pending_mine': { el: 'Αναμονή έγκρισης', en: 'Awaiting approval' },
  'chore.status_approved_mine': { el: 'Εγκρίθηκε!', en: 'Approved!' },
  'chore.claimed_by': { el: 'Διεκδικήθηκε από {name}', en: 'Claimed by {name}' },
  'chore.done_by': { el: 'Ολοκληρώθηκε από {name}', en: 'Done by {name}' },
  'chore.available_again': { el: 'Διαθέσιμη ξανά {when}', en: 'Available again {when}' },
  'common.loading': { el: 'Φόρτωση…', en: 'Loading…' },
  'error.generic': { el: 'Σφάλμα', en: 'Error' },
};

const AVAILABLE_CHORE = {
  id: 1,
  title: 'Βούρτσισμα',
  icon_name: 'tooth',
  claim_mode: 'each' as const,
  points_value: 5,
  status: 'available' as const,
  claimed_by: null,
  available_again_at: null,
};

function renderDashboard() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <DashboardChores />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

beforeAll(() => {
  server.listen();
  useI18nStore.getState().setTranslations(TRANSLATIONS);
  useAuthStore.getState().setUser({
    id: 2,
    name: 'Maria',
    avatar_kind: 'icon',
    avatar_value: 'fox',
    role: 'user',
    current_stars: 25,
    pending_stars: 0,
    preferred_locale: 'el',
  });
});

afterEach(() => {
  server.resetHandlers();
});

afterAll(() => {
  server.close();
  useAuthStore.getState().clearUser();
});

describe('DashboardChores', () => {
  it('shows greeting with user name and stars', async () => {
    server.use(
      http.get('/api/dashboard/visible-chores', async () => HttpResponse.json([])),
      http.get('/api/dashboard/pending-stars', async () => HttpResponse.json({ pending_stars: 0, claims: [] })),
    );
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText(/Maria/)).toBeInTheDocument();
      expect(screen.getByText(/25/)).toBeInTheDocument();
    });
  });

  it('shows empty state when no chores visible', async () => {
    server.use(
      http.get('/api/dashboard/visible-chores', async () => HttpResponse.json([])),
      http.get('/api/dashboard/pending-stars', async () => HttpResponse.json({ pending_stars: 0, claims: [] })),
    );
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText('Κανένα εργάκι')).toBeInTheDocument();
    });
  });

  it('renders chore cards with title, points, and claim button for available chores', async () => {
    server.use(
      http.get('/api/dashboard/visible-chores', async () => HttpResponse.json([
        AVAILABLE_CHORE,
        { ...AVAILABLE_CHORE, id: 2, title: 'Πλύσιμο χεριών', icon_name: 'hand', points_value: 3 },
      ])),
      http.get('/api/dashboard/pending-stars', async () => HttpResponse.json({ pending_stars: 0, claims: [] })),
    );
    renderDashboard();
    await waitFor(() => {
      // Title and points appear on both the front and the flippable back face.
      expect(screen.getAllByText('Βούρτσισμα').length).toBeGreaterThan(0);
      expect(screen.getAllByText(/\+5/).length).toBeGreaterThan(0);
      expect(screen.getAllByText('Διεκδίκηση').length).toBe(2);
    });
  });

  it('claims a chore and card updates to pending state', async () => {
    const user = userEvent.setup();
    let getCalled = false;
    server.use(
      http.get('/api/dashboard/visible-chores', async () => {
        if (getCalled) {
          return HttpResponse.json([{ ...AVAILABLE_CHORE, status: 'pending', claimed_by: { user_id: 2, name: 'Maria', avatar_kind: 'icon', avatar_value: 'fox' } }]);
        }
        getCalled = true;
        return HttpResponse.json([AVAILABLE_CHORE]);
      }),
      http.get('/api/dashboard/pending-stars', async () => HttpResponse.json({ pending_stars: 0, claims: [] })),
      http.post('/api/dashboard/chores/1/claim', async () => HttpResponse.json({ ok: true })),
    );
    renderDashboard();
    await screen.findAllByText('Βούρτσισμα');
    const btn = screen.getByRole('button', { name: 'Διεκδίκηση' });
    btn.focus();
    await user.keyboard('[Enter]');
    await waitFor(() => {
      expect(screen.getByText('Αναμονή έγκρισης')).toBeInTheDocument();
    });
  });

  it('shows pending state during claim mutation', async () => {
    const user = userEvent.setup();
    let resolve: () => void;
    const promise = new Promise<void>((r) => { resolve = r; });
    server.use(
      http.get('/api/dashboard/visible-chores', async () => HttpResponse.json([AVAILABLE_CHORE])),
      http.get('/api/dashboard/pending-stars', async () => HttpResponse.json({ pending_stars: 0, claims: [] })),
      http.post('/api/dashboard/chores/1/claim', async () => {
        await promise;
        return HttpResponse.json({ ok: true });
      }),
    );
    renderDashboard();
    await screen.findAllByText('Βούρτσισμα');
    const btn = screen.getByRole('button', { name: 'Διεκδίκηση' });
    btn.focus();
    await user.keyboard('[Enter]');
    await screen.findByText((content) => content.includes('Αναμονή'));
    resolve!();
  });

  it('displays chore icon image', async () => {
    server.use(
      http.get('/api/dashboard/visible-chores', async () => HttpResponse.json([AVAILABLE_CHORE])),
      http.get('/api/dashboard/pending-stars', async () => HttpResponse.json({ pending_stars: 0, claims: [] })),
    );
    renderDashboard();
    await waitFor(() => {
      const icons = document.querySelectorAll('.chore-icon');
      expect(icons[0]).toHaveAttribute('src', '/api/icons/svg/tooth');
    });
  });

  it('shows a re-availability indicator on the current kid\'s approved chore', async () => {
    const inThreeHours = new Date(Date.now() + 3 * 3_600_000).toISOString();
    server.use(
      http.get('/api/dashboard/visible-chores', async () => HttpResponse.json([
        {
          ...AVAILABLE_CHORE,
          status: 'approved',
          claimed_by: { user_id: 2, name: 'Maria', avatar_kind: 'icon', avatar_value: 'fox' },
          available_again_at: inThreeHours,
        },
      ])),
      http.get('/api/dashboard/pending-stars', async () => HttpResponse.json({ pending_stars: 0, claims: [] })),
    );
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText(/Διαθέσιμη ξανά/)).toBeInTheDocument();
    });
  });

  it('shows claimed-by info when one-mode chore is taken by another user', async () => {
    server.use(
      http.get('/api/dashboard/visible-chores', async () => HttpResponse.json([
        {
          id: 1,
          title: 'Πλύσιμο Αυτοκινήτου',
          icon_name: 'car',
          claim_mode: 'one',
          points_value: 20,
          status: 'pending',
          claimed_by: { user_id: 3, name: 'Nikos', avatar_kind: 'icon', avatar_value: 'boy' },
        },
      ])),
      http.get('/api/dashboard/pending-stars', async () => HttpResponse.json({ pending_stars: 0, claims: [] })),
    );
    renderDashboard();
    await waitFor(() => {
      expect(screen.getAllByText('Πλύσιμο Αυτοκινήτου').length).toBeGreaterThan(0);
      expect(screen.getByText('Nikos')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Διεκδίκηση' })).not.toBeInTheDocument();
    });
  });
});
