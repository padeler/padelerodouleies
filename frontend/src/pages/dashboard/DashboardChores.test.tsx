import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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
  'common.loading': { el: 'Φόρτωση…', en: 'Loading…' },
  'error.generic': { el: 'Σφάλμα', en: 'Error' },
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
  // Seed a logged-in kid user
  useAuthStore.getState().setUser({
    id: 2,
    name: 'Maria',
    avatar_kind: 'icon',
    avatar_value: 'fox',
    role: 'user',
    current_stars: 25,
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
      http.get('/api/dashboard/visible-chores', async () => {
        return HttpResponse.json([]);
      }),
    );
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText(/Maria/)).toBeInTheDocument();
      expect(screen.getByText('25 ⭐')).toBeInTheDocument();
    });
  });

  it('shows empty state when no chores visible', async () => {
    server.use(
      http.get('/api/dashboard/visible-chores', async () => {
        return HttpResponse.json([]);
      }),
    );
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText('Κανένα εργάκι')).toBeInTheDocument();
    });
  });

  it('renders chore cards with title, points, and claim button', async () => {
    server.use(
      http.get('/api/dashboard/visible-chores', async () => {
        return HttpResponse.json([
          { id: 1, title_el: 'Βούρτσισμα', title_en: 'Brush Teeth', icon_name: 'tooth', scope: 'individual', points_value: 5 },
          { id: 2, title_el: 'Πλύσιμο χεριών', title_en: 'Wash Hands', icon_name: 'hand', scope: 'individual', points_value: 3 },
        ]);
      }),
    );
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText('Βούρτσισμα')).toBeInTheDocument();
      expect(screen.getByText('+5 ⭐')).toBeInTheDocument();
      expect(screen.getAllByText('Διεκδίκηση').length).toBe(2);
    });
  });

  it('claims a chore and removes card from list', async () => {
    const user = userEvent.setup();
    let getCalled = false;
    server.use(
      http.get('/api/dashboard/visible-chores', async () => {
        if (getCalled) return HttpResponse.json([]);
        getCalled = true;
        return HttpResponse.json([
          { id: 1, title_el: 'Βούρτσισμα', title_en: 'Brush Teeth', icon_name: 'tooth', scope: 'individual', points_value: 5 },
        ]);
      }),
      http.post('/api/dashboard/chores/1/claim', async () => {
        return HttpResponse.json({ ok: true });
      }),
    );
    renderDashboard();
    await screen.findByText('Βούρτσισμα');
    const btn = screen.getByRole('button', { name: 'Διεκδίκηση' });
    btn.focus();
    await user.keyboard('[Enter]');
    await screen.findByText('Κανένα εργάκι');
  });

  it('shows pending state during claim', async () => {
    const user = userEvent.setup();
    let resolve: () => void;
    const promise = new Promise<void>((r) => { resolve = r; });
    server.use(
      http.get('/api/dashboard/visible-chores', async () => {
        return HttpResponse.json([
          { id: 1, title_el: 'Βούρτσισμα', title_en: 'Brush Teeth', icon_name: 'tooth', scope: 'individual', points_value: 5 },
        ]);
      }),
      http.post('/api/dashboard/chores/1/claim', async () => {
        await promise;
        return HttpResponse.json({ ok: true });
      }),
    );
    renderDashboard();
    await screen.findByText('Βούρτσισμα');
    const btn = screen.getByRole('button', { name: 'Διεκδίκηση' });
    btn.focus();
    await user.keyboard('[Enter]');
    // The pending text contains ellipsis, use text function matcher
    await screen.findByText((content) => content.includes('Αναμονή'));
    resolve!();
  });

  it('displays chore icon image', async () => {
    server.use(
      http.get('/api/dashboard/visible-chores', async () => {
        return HttpResponse.json([
          { id: 1, title_el: 'Βούρτσισμα', title_en: 'Brush Teeth', icon_name: 'tooth', scope: 'individual', points_value: 5 },
        ]);
      }),
    );
    renderDashboard();
    await waitFor(() => {
      const icons = document.querySelectorAll('.chore-icon');
      expect(icons[0]).toHaveAttribute('src', '/api/icons/svg/tooth');
    });
  });
});
