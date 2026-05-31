import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { Marketplace } from './Marketplace';
import { useAuthStore } from '../../state/authStore';
import { useI18nStore } from '../../i18n/store';

const server = setupServer();

const TRANSLATIONS: Record<string, Record<string, string>> = {
  'nav.marketplace': { el: 'Αγορά', en: 'Marketplace' },
  'nav.rewards': { el: 'Βραβεία', en: 'Rewards' },
  'common.loading': { el: 'Φόρτωση…', en: 'Loading…' },
  'common.success': { el: 'Επιτυχία!', en: 'Success!' },
  'common.error': { el: 'Σφάλμα', en: 'Error' },
  'common.cancel': { el: 'Άκυρο', en: 'Cancel' },
  'common.confirm': { el: 'Επιβεβαίωση', en: 'Confirm' },
  'reward.redeem': { el: 'Εξαργύρωση', en: 'Redeem' },
  'reward.insufficient': { el: 'Ανεπαρκή αστέρια', en: 'Not enough stars' },
  'reward.contribute': { el: 'Συνεισφορά', en: 'Contribute' },
  'reward.collaborative_goals': { el: 'Επικοί Στόχοι', en: 'Epic Goals' },
  'reward.complete': { el: 'Ολοκληρώθηκε!', en: 'Complete!' },
  'marketplace.empty': { el: 'Κανένα βραβείο', en: 'No rewards' },
};

function renderMarketplace() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <Marketplace />
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
    current_stars: 35,
    preferred_locale: 'el',
  });
});

afterEach(() => server.resetHandlers());

afterAll(() => {
  server.close();
  useAuthStore.getState().clearUser();
});

describe('Marketplace — individual rewards', () => {
  it('shows redeem button enabled when user has enough stars', async () => {
    server.use(
      http.get('/api/marketplace/rewards', async () => {
        return HttpResponse.json([
          { id: 1, title: 'Κινηματογράφος', description: null, icon_name: 'film', cost_stars: 20, is_collaborative: false },
        ]);
      }),
    );
    renderMarketplace();
    await waitFor(() => {
      const btn = screen.getByText('Εξαργύρωση');
      expect(btn).toBeEnabled();
    });
  });

  it('shows locked button with star count when insufficient', async () => {
    server.use(
      http.get('/api/marketplace/rewards', async () => {
        return HttpResponse.json([
          { id: 1, title: 'Ταξίδι', description: null, icon_name: 'plane', cost_stars: 100, is_collaborative: false },
        ]);
      }),
    );
    renderMarketplace();
    await waitFor(() => {
      expect(screen.getByText(/Ανεπαρκή αστέρια \(35\/100\)/)).toBeInTheDocument();
    });
  });

  it('shows reward cost and title', async () => {
    server.use(
      http.get('/api/marketplace/rewards', async () => {
        return HttpResponse.json([
          { id: 1, title: 'Πάρκο', description: 'Πεζοπορία', icon_name: 'trees', cost_stars: 30, is_collaborative: false },
        ]);
      }),
    );
    renderMarketplace();
    await waitFor(() => {
      // Title and cost appear on both the front and the flippable back face.
      expect(screen.getAllByText('Πάρκο').length).toBeGreaterThan(0);
      expect(screen.getByText('Πεζοπορία')).toBeInTheDocument();
      expect(screen.getAllByText('30 ⭐').length).toBeGreaterThan(0);
    });
  });

  it('shows empty state for no individual rewards', async () => {
    server.use(
      http.get('/api/marketplace/rewards', async () => {
        return HttpResponse.json([]);
      }),
    );
    renderMarketplace();
    await waitFor(() => {
      expect(screen.getByText('Κανένα βραβείο')).toBeInTheDocument();
    });
  });
});

describe('Marketplace — collaborative rewards', () => {
  it('shows collab card with progress bar', async () => {
    server.use(
      http.get('/api/marketplace/rewards', async () => {
        return HttpResponse.json([
          { id: 2, title: 'Ψαθούλα', description: null, icon_name: 'ship', cost_stars: 500, is_collaborative: true, current_stars: 100, target_stars: 500, contributors: [{ user_id: 2, user_name: 'Maria', stars: 60 }, { user_id: 3, user_name: 'Nikos', stars: 40 }] },
        ]);
      }),
    );
    renderMarketplace();
    await waitFor(() => {
      expect(screen.getAllByText('Ψαθούλα').length).toBeGreaterThan(0);
      expect(screen.getByText('100 / 500 ⭐')).toBeInTheDocument();
    });
  });

  it('shows contribute button when user can contribute', async () => {
    server.use(
      http.get('/api/marketplace/rewards', async () => {
        return HttpResponse.json([
          { id: 2, title: 'Ψαθούλα', description: null, icon_name: 'ship', cost_stars: 500, is_collaborative: true, current_stars: 100, target_stars: 500, contributors: [] },
        ]);
      }),
    );
    renderMarketplace();
    await waitFor(() => {
      expect(screen.getByText('Συνεισφορά')).toBeInTheDocument();
    });
  });

  it('opens contribute modal on button click', async () => {
    server.use(
      http.get('/api/marketplace/rewards', async () => {
        return HttpResponse.json([
          { id: 2, title: 'Ψαθούλα', description: null, icon_name: 'ship', cost_stars: 500, is_collaborative: true, current_stars: 100, target_stars: 500, contributors: [] },
        ]);
      }),
    );
    renderMarketplace();
    await waitFor(() => {
      fireEvent.click(screen.getByText('Συνεισφορά'));
      const modal = document.querySelector('.collab-modal');
      expect(modal).toBeInTheDocument();
    });
  });

  it('shows collab-complete when target reached', async () => {
    server.use(
      http.get('/api/marketplace/rewards', async () => {
        return HttpResponse.json([
          { id: 2, title: 'Ολοκληρωμένο', description: null, icon_name: 'trophy', cost_stars: 100, is_collaborative: true, current_stars: 100, target_stars: 100, contributors: [{ user_id: 2, user_name: 'Maria', stars: 100 }] },
        ]);
      }),
    );
    renderMarketplace();
    await waitFor(() => {
      // Translation includes exclamation mark, use partial match
      expect(screen.getByText(/Ολοκληρώθηκε/)).toBeInTheDocument();
    });
  });

  it('separates individual and collaborative rewards', async () => {
    server.use(
      http.get('/api/marketplace/rewards', async () => {
        return HttpResponse.json([
          { id: 1, title: 'Μοναδικό', description: null, icon_name: 'star', cost_stars: 20, is_collaborative: false },
          { id: 2, title: 'Ομαδικό', description: null, icon_name: 'trophy', cost_stars: 500, is_collaborative: true, current_stars: 100, target_stars: 500, contributors: [] },
        ]);
      }),
    );
    renderMarketplace();
    await waitFor(() => {
      // Individual reward in reward-grid
      const rewardGrid = document.querySelector('.reward-grid');
      expect(rewardGrid).toHaveTextContent('Μοναδικό');
      // Collaborative in collab-grid
      const collabGrid = document.querySelector('.collab-grid');
      expect(collabGrid).toHaveTextContent('Ομαδικό');
    });
  });
});
