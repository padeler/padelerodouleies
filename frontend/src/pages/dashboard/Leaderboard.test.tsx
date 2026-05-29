import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { Leaderboard } from './Leaderboard';
import { useI18nStore } from '../../i18n/store';

const server = setupServer();

const TRANSLATIONS: Record<string, Record<string, string>> = {
  'nav.leaderboard': { el: 'Κατάταξη', en: 'Leaderboard' },
  'common.loading': { el: 'Φόρτωση…', en: 'Loading…' },
  'leaderboard.empty': { el: 'Κανείς ακόμα', en: 'Nobody yet' },
};

function renderLeaderboard() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <Leaderboard />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

beforeAll(() => {
  server.listen();
  useI18nStore.getState().setTranslations(TRANSLATIONS);
});

afterEach(() => server.resetHandlers());

afterAll(() => server.close());

describe('Leaderboard', () => {
  it('shows podium for top 3', async () => {
    server.use(
      http.get('/api/leaderboard', async () => {
        return HttpResponse.json([
          { ranking: 1, id: 2, name: 'Maria', avatar_kind: 'icon', avatar_value: 'fox', current_stars: 50 },
          { ranking: 2, id: 3, name: 'Nikos', avatar_kind: 'icon', avatar_value: 'unicorn', current_stars: 30 },
          { ranking: 3, id: 4, name: 'Anna', avatar_kind: 'icon', avatar_value: 'star', current_stars: 10 },
        ]);
      }),
    );
    renderLeaderboard();
    await waitFor(() => {
      expect(screen.getByText('Maria')).toBeInTheDocument();
      expect(screen.getByText('Nikos')).toBeInTheDocument();
      expect(screen.getByText('Anna')).toBeInTheDocument();
    });
  });

  it('orders podium as 2nd, 1st, 3rd (podiumOrder [1, 0, 2])', async () => {
    server.use(
      http.get('/api/leaderboard', async () => {
        return HttpResponse.json([
          { ranking: 1, id: 1, name: 'First', avatar_kind: 'icon', avatar_value: 'shield', current_stars: 100 },
          { ranking: 2, id: 2, name: 'Second', avatar_kind: 'icon', avatar_value: 'fox', current_stars: 80 },
          { ranking: 3, id: 3, name: 'Third', avatar_kind: 'icon', avatar_value: 'star', current_stars: 50 },
        ]);
      }),
    );
    renderLeaderboard();
    await waitFor(() => {
      const figures = document.querySelectorAll('.podium-figure');
      expect(figures.length).toBe(3);
      // podiumOrder [1, 0, 2] maps to: Second (left), First (center), Third (right)
      expect(figures[0].querySelector('.podium-name')).toHaveTextContent('Second');
      expect(figures[1].querySelector('.podium-name')).toHaveTextContent('First');
      expect(figures[2].querySelector('.podium-name')).toHaveTextContent('Third');
    });
  });

  it('shows remaining entries as list below podium', async () => {
    server.use(
      http.get('/api/leaderboard', async () => {
        return HttpResponse.json([
          { ranking: 1, id: 1, name: 'First', avatar_kind: 'icon', avatar_value: 'shield', current_stars: 100 },
          { ranking: 2, id: 2, name: 'Second', avatar_kind: 'icon', avatar_value: 'fox', current_stars: 80 },
          { ranking: 3, id: 3, name: 'Third', avatar_kind: 'icon', avatar_value: 'star', current_stars: 50 },
          { ranking: 4, id: 4, name: 'Fourth', avatar_kind: 'icon', avatar_value: 'crown', current_stars: 30 },
        ]);
      }),
    );
    renderLeaderboard();
    await waitFor(() => {
      const list = document.querySelector('.leaderboard-list');
      expect(list).toBeInTheDocument();
      expect(screen.getByText('Fourth')).toBeInTheDocument();
      expect(screen.getByText('#4')).toBeInTheDocument();
    });
  });

  it('shows empty state when no entries', async () => {
    server.use(
      http.get('/api/leaderboard', async () => {
        return HttpResponse.json([]);
      }),
    );
    renderLeaderboard();
    await waitFor(() => {
      expect(screen.getByText('Κανείς ακόμα')).toBeInTheDocument();
    });
  });

  it('shows stars for each entry', async () => {
    server.use(
      http.get('/api/leaderboard', async () => {
        return HttpResponse.json([
          { ranking: 1, id: 1, name: 'Maria', avatar_kind: 'icon', avatar_value: 'fox', current_stars: 50 },
          { ranking: 2, id: 2, name: 'Nikos', avatar_kind: 'icon', avatar_value: 'unicorn', current_stars: 30 },
        ]);
      }),
    );
    renderLeaderboard();
    await waitFor(() => {
      // Use regex to match star count with possible whitespace variation
      expect(screen.getByText((content) => content.includes('50'))).toBeInTheDocument();
    });
  });
});
