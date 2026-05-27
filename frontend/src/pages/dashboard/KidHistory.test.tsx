import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { KidHistory } from './KidHistory';
import { useI18nStore } from '../../i18n/store';

const server = setupServer();

const TRANSLATIONS: Record<string, Record<string, string>> = {
  'nav.history': { el: 'Ιστορικό', en: 'History' },
  'common.loading': { el: 'Φόρτωση…', en: 'Loading…' },
  'history.empty': { el: 'Καμία δραστηριότητα', en: 'No activity' },
  'history.action_approved': { el: 'Εγκρίθηκε', en: 'Approved' },
  'history.action_declined': { el: 'Αρνήθηκε', en: 'Declined' },
  'history.action_manual': { el: 'Χειροκίνητη ρύθμιση', en: 'Manual adjustment' },
  'history.action_purchase': { el: 'Αγορά', en: 'Purchase' },
};

function renderHistory() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <KidHistory />
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

describe('KidHistory', () => {
  it('shows empty state when no entries', async () => {
    server.use(
      http.get('/api/dashboard/history', async () => {
        return HttpResponse.json({ total: 0, entries: [] });
      }),
    );
    renderHistory();
    await waitFor(() => {
      expect(screen.getByText('Καμία δραστηριότητα')).toBeInTheDocument();
    });
  });

  it('renders chore approved entry with green class', async () => {
    server.use(
      http.get('/api/dashboard/history', async () => {
        return HttpResponse.json({
          total: 1,
          entries: [
            { id: 1, action_type: 'chore_approved', points_delta: 5, ref_table: 'chore', ref_id: 1, admin_note: null, timestamp: '2024-06-01T08:00:00', chore_title_el: 'Βούρτσισμα', chore_title_en: 'Brush Teeth' },
          ],
        });
      }),
    );
    renderHistory();
    await waitFor(() => {
      expect(screen.getByText('+5 ⭐')).toBeInTheDocument();
      expect(screen.getByText('Εγκρίθηκε')).toBeInTheDocument();
      const entry = document.querySelector('.history-approved');
      expect(entry).toBeInTheDocument();
    });
  });

  it('renders negative chore declined entry with red class', async () => {
    server.use(
      http.get('/api/dashboard/history', async () => {
        return HttpResponse.json({
          total: 1,
          entries: [
            { id: 1, action_type: 'chore_declined', points_delta: -5, ref_table: null, ref_id: null, admin_note: 'Not done properly', timestamp: '2024-06-01T10:00:00', chore_title_el: null, chore_title_en: null },
          ],
        });
      }),
    );
    renderHistory();
    await waitFor(() => {
      expect(screen.getByText('-5 ⭐')).toBeInTheDocument();
      expect(screen.getByText('Not done properly')).toBeInTheDocument();
      const entry = document.querySelector('.history-declined');
      expect(entry).toBeInTheDocument();
    });
  });

  it('renders manual adjust entry with gold class', async () => {
    server.use(
      http.get('/api/dashboard/history', async () => {
        return HttpResponse.json({
          total: 1,
          entries: [
            { id: 2, action_type: 'manual_adjust', points_delta: 3, ref_table: null, ref_id: null, admin_note: 'For sharing', timestamp: '2024-06-01T12:00:00' },
          ],
        });
      }),
    );
    renderHistory();
    await waitFor(() => {
      expect(screen.getByText('+3 ⭐')).toBeInTheDocument();
      const entry = document.querySelector('.history-manual');
      expect(entry).toBeInTheDocument();
    });
  });

  it('renders reward purchase entry with blue class', async () => {
    server.use(
      http.get('/api/dashboard/history', async () => {
        return HttpResponse.json({
          total: 1,
          entries: [
            { id: 3, action_type: 'reward_purchase', points_delta: -20, ref_table: 'reward', ref_id: 1, admin_note: null, timestamp: '2024-06-01T14:00:00' },
          ],
        });
      }),
    );
    renderHistory();
    await waitFor(() => {
      expect(screen.getByText('-20 ⭐')).toBeInTheDocument();
      const entry = document.querySelector('.history-reward');
      expect(entry).toBeInTheDocument();
    });
  });

  it('shows chore title when present', async () => {
    server.use(
      http.get('/api/dashboard/history', async () => {
        return HttpResponse.json({
          total: 1,
          entries: [
            { id: 1, action_type: 'chore_approved', points_delta: 5, ref_table: 'chore', ref_id: 1, admin_note: null, timestamp: '2024-06-01T08:00:00', chore_title_el: 'Βούρτσισμα Δοντιών', chore_title_en: 'Brush Teeth' },
          ],
        });
      }),
    );
    renderHistory();
    await waitFor(() => {
      expect(screen.getByText(/Βούρτσισμα Δοντιών/)).toBeInTheDocument();
    });
  });

  it('shows admin note when present', async () => {
    server.use(
      http.get('/api/dashboard/history', async () => {
        return HttpResponse.json({
          total: 1,
          entries: [
            { id: 1, action_type: 'manual_adjust', points_delta: 3, ref_table: null, ref_id: null, admin_note: 'For being a star', timestamp: '2024-06-01T08:00:00' },
          ],
        });
      }),
    );
    renderHistory();
    await waitFor(() => {
      expect(screen.getByText('For being a star')).toBeInTheDocument();
    });
  });

  it('renders timeline entries newest first', async () => {
    server.use(
      http.get('/api/dashboard/history', async () => {
        return HttpResponse.json({
          total: 2,
          entries: [
            { id: 2, action_type: 'chore_approved', points_delta: 3, ref_table: null, ref_id: null, admin_note: null, timestamp: '2024-06-02T08:00:00' },
            { id: 1, action_type: 'chore_approved', points_delta: 5, ref_table: null, ref_id: null, admin_note: null, timestamp: '2024-06-01T08:00:00' },
          ],
        });
      }),
    );
    renderHistory();
    await waitFor(() => {
      const entries = document.querySelectorAll('.history-entry');
      expect(entries.length).toBe(2);
      // First entry should be id=2 (newest)
      expect(entries[0]).toHaveTextContent('+3 ⭐');
      expect(entries[1]).toHaveTextContent('+5 ⭐');
    });
  });
});
