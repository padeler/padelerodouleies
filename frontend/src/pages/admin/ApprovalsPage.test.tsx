import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { ApprovalsPage } from './ApprovalsPage';
import { useI18nStore } from '../../i18n/store';

const server = setupServer();

const TRANSLATIONS: Record<string, Record<string, string>> = {
  'nav.approvals': { el: 'Εγκρίσεις', en: 'Approvals' },
  'common.loading': { el: 'Φόρτωση…', en: 'Loading…' },
  'common.error': { el: 'Σφάλμα', en: 'Error' },
  'btn.approve': { el: 'Έγκριση', en: 'Approve' },
  'btn.decline': { el: 'Απόρριψη', en: 'Decline' },
  'admin.reason_placeholder': { el: 'Λόγος (προαιρετικό)', en: 'Reason (optional)' },
  'chore.label': { el: 'Δουλειά', en: 'Chore' },
  'chore.approved': { el: 'Εγκρίθηκε', en: 'Approved' },
  'chore.declined': { el: 'Απορρίφθηκε', en: 'Declined' },
  'approvals.no_pending': { el: 'Δεν υπάρχουν εκκρεμείς αιτήσεις', en: 'Δεν υπάρχουν εκκρεμείς αιτήσεις' },
  'approvals.error_loading': { el: 'Σφάλμα κατά τη φόρτωση αιτήσεων', en: 'Error loading claims' },
};

function renderApprovals() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <ApprovalsPage />
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

describe('ApprovalsPage', () => {
  it('shows empty state when no pending claims', async () => {
    server.use(
      http.get('/api/admin/pending-claims', async () => {
        return HttpResponse.json([]);
      }),
    );
    renderApprovals();
    await waitFor(() => {
      expect(screen.getByText('Δεν υπάρχουν εκκρεμείς αιτήσεις')).toBeInTheDocument();
    });
  });

  it('renders claim cards with user name, chore title, and points', async () => {
    server.use(
      http.get('/api/admin/pending-claims', async () => {
        return HttpResponse.json([
          { id: 1, user_id: 2, user_name: 'Maria', user_avatar_kind: 'icon', user_avatar_value: 'fox', chore_id: 1, chore_icon: 'tooth', chore_title: 'Βούρτσισμα', points_value: 5, claimed_at: '2024-06-01T08:00:00' },
        ]);
      }),
    );
    renderApprovals();
    await waitFor(() => {
      expect(screen.getByText('Maria')).toBeInTheDocument();
      expect(screen.getByText('+5 ⭐')).toBeInTheDocument();
    });
  });

  it('shows approve and decline buttons', async () => {
    server.use(
      http.get('/api/admin/pending-claims', async () => {
        return HttpResponse.json([
          { id: 1, user_id: 2, user_name: 'Maria', user_avatar_kind: 'icon', user_avatar_value: 'fox', chore_id: 1, chore_icon: 'tooth', chore_title: 'Βούρτσισμα', points_value: 5, claimed_at: '2024-06-01T08:00:00' },
        ]);
      }),
    );
    renderApprovals();
    await waitFor(() => {
      expect(screen.getByText('Έγκριση')).toBeInTheDocument();
      expect(screen.getByText('Απόρριψη')).toBeInTheDocument();
    });
  });

  it('approving a claim removes it from the list', async () => {
    const user = userEvent.setup();
    let getCalled = false;
    server.use(
      http.get('/api/admin/pending-claims', async () => {
        if (getCalled) return HttpResponse.json([]);
        getCalled = true;
        return HttpResponse.json([
          { id: 1, user_id: 2, user_name: 'Maria', user_avatar_kind: 'icon', user_avatar_value: 'fox', chore_id: 1, chore_icon: 'tooth', chore_title: 'Βούρτσισμα', points_value: 5, claimed_at: '2024-06-01T08:00:00' },
        ]);
      }),
      http.post('/api/admin/pending-claims/1/approve', async () => {
        return HttpResponse.json({ ok: true });
      }),
    );
    renderApprovals();
    await screen.findByText('Maria');
    const btn = screen.getByRole('button', { name: /Έγκριση/ });
    btn.focus();
    await user.keyboard('[Enter]');
    await screen.findByText('Δεν υπάρχουν εκκρεμείς αιτήσεις');
  });

  it('declining sends admin note', async () => {
    const user = userEvent.setup();
    let getCalled = false;
    let capturedNote = '';
    server.use(
      http.get('/api/admin/pending-claims', async () => {
        if (getCalled) return HttpResponse.json([]);
        getCalled = true;
        return HttpResponse.json([
          { id: 1, user_id: 2, user_name: 'Maria', user_avatar_kind: 'icon', user_avatar_value: 'fox', chore_id: 1, chore_icon: 'tooth', chore_title: 'Βούρτσισμα', points_value: 5, claimed_at: '2024-06-01T08:00:00' },
        ]);
      }),
      http.post('/api/admin/pending-claims/1/decline', async ({ request }) => {
        const body = await request.json() as { admin_note: string };
        capturedNote = body.admin_note;
        return HttpResponse.json({ ok: true, note: body.admin_note });
      }),
    );
    renderApprovals();
    await screen.findByText('Maria');
    const textarea = screen.getByPlaceholderText('Λόγος (προαιρετικό)');
    await user.click(textarea);
    await user.type(textarea, 'Not done properly');
    const btn = screen.getByRole('button', { name: /Απόρριψη/ });
    btn.focus();
    await user.keyboard('[Enter]');
    await screen.findByText('Δεν υπάρχουν εκκρεμείς αιτήσεις');
    expect(capturedNote).toBe('Not done properly');
  });

  it('shows textarea for admin note', async () => {
    server.use(
      http.get('/api/admin/pending-claims', async () => {
        return HttpResponse.json([
          { id: 1, user_id: 2, user_name: 'Maria', user_avatar_kind: 'icon', user_avatar_value: 'fox', chore_id: 1, chore_icon: 'tooth', chore_title: 'Βούρτσισμα', points_value: 5, claimed_at: '2024-06-01T08:00:00' },
        ]);
      }),
    );
    renderApprovals();
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Λόγος (προαιρετικό)')).toBeInTheDocument();
    });
  });
});
