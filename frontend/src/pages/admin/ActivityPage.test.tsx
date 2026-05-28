import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { ActivityPage } from './ActivityPage';
import { useI18nStore } from '../../i18n/store';

const server = setupServer();

const TRANSLATIONS: Record<string, Record<string, string>> = {
  'nav.activity': { el: 'Δραστηριότητα', en: 'Activity' },
  'nav.users': { el: 'Χρήστες', en: 'Users' },
  'chore.scope': { el: 'Επίπεδο', en: 'Scope' },
  'history.empty': { el: 'Καμία δραστηριότητα', en: 'No activity yet' },
  'history.action_label_approved': { el: 'Εγκρίθηκε', en: 'Approved' },
  'history.action_label_declined': { el: 'Αρνήθηκε', en: 'Declined' },
  'history.action_label_manual': { el: 'Χειροκίνητη ρύθμιση', en: 'Manual adjustment' },
  'history.action_label_purchase': { el: 'Αγορά', en: 'Purchase' },
  'history.action_label_refund': { el: 'Επιστροφή', en: 'Refund' },
  'btn.clear': { el: 'Εκκαθάριση', en: 'Clear' },
  'common.loading': { el: 'Φόρτωση…', en: 'Loading…' },
  'activity.time': { el: 'Ώρα', en: 'Time' },
  'activity.action': { el: 'Ενέργεια', en: 'Action' },
  'activity.delta': { el: 'Αλλαγή', en: 'Delta' },
  'activity.note': { el: 'Σημείωση', en: 'Note' },
  'activity.item': { el: 'Αντικείμενο', en: 'Item' },
  'activity.all': { el: 'Όλα', en: 'All' },
  'activity.from': { el: 'Από', en: 'From' },
  'activity.to': { el: 'Έως', en: 'To' },
  'activity.total': { el: 'Σύνολο: {count} εγγραφές', en: 'Total: {count} entries' },
};

function renderActivityPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <ActivityPage />
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

describe('ActivityPage', () => {
  it('renders filter controls', async () => {
    server.use(
      http.get('/api/admin/users', async () => {
        return HttpResponse.json([
          { id: 1, name: 'Dad', avatar_kind: 'icon', avatar_value: 'shield', role: 'admin', current_stars: 0, preferred_locale: 'el', is_active: true },
        ]);
      }),
      http.get('/api/admin/history', async () => {
        return HttpResponse.json({ total: 0, entries: [] });
      }),
    );
    renderActivityPage();
    await waitFor(() => {
      // Filter selects are present
      const selects = document.querySelectorAll('select');
      expect(selects.length).toBeGreaterThanOrEqual(2);
      // Date inputs are present
      const dateInputs = document.querySelectorAll('input[type="date"]');
      expect(dateInputs.length).toBeGreaterThanOrEqual(2);
    });
  });

  it('shows history entries in table', async () => {
    server.use(
      http.get('/api/admin/users', async () => {
        return HttpResponse.json([]);
      }),
      http.get('/api/admin/history', async () => {
        return HttpResponse.json({
          total: 2,
          entries: [
            { id: 1, user_id: 2, user_name: 'Maria', action_type: 'chore_approved', points_delta: 5, ref_table: 'chore', ref_id: 1, admin_note: null, timestamp: '2024-06-01T08:00:00' },
            { id: 2, user_id: 2, user_name: 'Anna', action_type: 'manual_adjust', points_delta: 3, ref_table: null, ref_id: null, admin_note: 'Good behavior', timestamp: '2024-06-01T12:00:00' },
          ],
        });
      }),
    );
    renderActivityPage();
    await waitFor(() => {
      // Query within table body to avoid matching <option> elements
      const tbody = document.querySelector('.admin-table tbody');
      expect(tbody).toHaveTextContent('Maria');
      expect(tbody).toHaveTextContent('chore_approved');
      expect(tbody).toHaveTextContent('Good behavior');
      expect(tbody).toHaveTextContent('+5');
    });
    expect(screen.getByText('Σύνολο: 2 εγγραφές')).toBeInTheDocument();
  });

  it('shows empty message when no activity', async () => {
    server.use(
      http.get('/api/admin/users', async () => {
        return HttpResponse.json([]);
      }),
      http.get('/api/admin/history', async () => {
        return HttpResponse.json({ total: 0, entries: [] });
      }),
    );
    renderActivityPage();
    await waitFor(() => {
      expect(screen.getByText('Καμία δραστηριότητα')).toBeInTheDocument();
    });
  });

  it('shows user filter dropdown with users', async () => {
    server.use(
      http.get('/api/admin/users', async () => {
        return HttpResponse.json([
          { id: 2, name: 'Maria', avatar_kind: 'icon', avatar_value: 'fox', role: 'user', current_stars: 10, preferred_locale: 'el', is_active: true },
        ]);
      }),
      http.get('/api/admin/history', async () => {
        return HttpResponse.json({ total: 0, entries: [] });
      }),
    );
    renderActivityPage();
    await waitFor(() => {
      const select = document.querySelector('select');
      fireEvent.change(select, { target: { value: '2' } });
      expect(select).toHaveValue('2');
    });
  });

  it('shows action type filter with all types', async () => {
    server.use(
      http.get('/api/admin/users', async () => {
        return HttpResponse.json([]);
      }),
      http.get('/api/admin/history', async () => {
        return HttpResponse.json({ total: 0, entries: [] });
      }),
    );
    renderActivityPage();
    await waitFor(() => {
      const selects = document.querySelectorAll('select');
      expect(selects.length).toBeGreaterThanOrEqual(2);
    });
  });

  it('shows clear filters button', async () => {
    server.use(
      http.get('/api/admin/users', async () => {
        return HttpResponse.json([]);
      }),
      http.get('/api/admin/history', async () => {
        return HttpResponse.json({ total: 0, entries: [] });
      }),
    );
    renderActivityPage();
    await waitFor(() => {
      expect(screen.getByText(/Εκκαθάριση/)).toBeInTheDocument();
    });
  });
});
