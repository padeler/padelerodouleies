import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { Setup } from './Setup';
import { useAuthStore } from '../state/authStore';
import { useI18nStore } from '../i18n/store';

const server = setupServer();

const TRANSLATIONS: Record<string, Record<string, string>> = {
  'login.first_run_title': { el: 'Δημιουργία Λογαριασμού Admin', en: 'Create Admin Account' },
  'bootstrap.name': { el: 'Όνομα', en: 'Name' },
  'bootstrap.pin': { el: 'PIN (4 ψηφία)', en: 'PIN (4 digits)' },
  'bootstrap.pin_confirm': { el: 'Επιβεβαίωση PIN', en: 'Confirm PIN' },
  'bootstrap.avatar': { el: 'Εικόνα προφίλ', en: 'Profile picture' },
  'bootstrap.pin_mismatch': { el: 'Τα PIN δεν ταιριάζουν', en: 'PINs do not match' },
  'setup.create': { el: 'Δημιουργία Λογαριασμού', en: 'Create Account' },
  'setup.creating': { el: 'Δημιουργία…', en: 'Creating…' },
  'setup.error_name': { el: 'Παρακαλώ εισάγετε το όνομά σας', en: 'Please enter your name' },
  'setup.error_pin_digits': { el: 'Το PIN πρέπει να είναι ακριβώς 4 ψηφία', en: 'PIN must be exactly 4 digits' },
  'setup.error_failed': { el: 'Η εγκατάσταση απέτυχε', en: 'Setup failed' },
  'common.error': { el: 'Σφάλμα', en: 'Error' },
};

function renderSetup() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <Setup />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

beforeAll(() => {
  server.listen();
  useI18nStore.getState().setTranslations(TRANSLATIONS);
});

afterEach(() => {
  server.resetHandlers();
  useAuthStore.getState().clearUser();
});

afterAll(() => server.close());

describe('Setup', () => {
  it('renders the setup form', () => {
    renderSetup();
    expect(screen.getByText('Δημιουργία Λογαριασμού Admin')).toBeInTheDocument();
    expect(screen.getAllByPlaceholderText('1234').length).toBe(2);
  });

  it('shows error when name is empty', () => {
    renderSetup();
    fireEvent.click(screen.getByText('Δημιουργία Λογαριασμού'));
    expect(screen.getByText('Παρακαλώ εισάγετε το όνομά σας')).toBeInTheDocument();
  });

  it('shows error when PINs do not match', () => {
    renderSetup();
    const nameInput = document.querySelector('input[type="text"]') as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: 'Dad' } });
    const pinInputs = screen.getAllByPlaceholderText('1234');
    fireEvent.change(pinInputs[0], { target: { value: '1234' } });
    fireEvent.change(pinInputs[1], { target: { value: '5678' } });
    fireEvent.click(screen.getByText('Δημιουργία Λογαριασμού'));
    expect(screen.getByText('Τα PIN δεν ταιριάζουν')).toBeInTheDocument();
  });

  it('shows error for non-4-digit PIN', () => {
    renderSetup();
    const nameInput = document.querySelector('input[type="text"]') as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: 'Dad' } });
    const pinInputs = screen.getAllByPlaceholderText('1234');
    fireEvent.change(pinInputs[0], { target: { value: '12' } });
    fireEvent.change(pinInputs[1], { target: { value: '12' } });
    fireEvent.click(screen.getByText('Δημιουργία Λογαριασμού'));
    expect(screen.getByText('Το PIN πρέπει να είναι ακριβώς 4 ψηφία')).toBeInTheDocument();
  });

  it('successfully creates admin and sets user in store', async () => {
    server.use(
      http.post('/api/bootstrap/setup', async ({ request }) => {
        const body = await request.json() as { name: string; avatar_kind: string; avatar_value: string; pin: string };
        return HttpResponse.json({
          id: 1,
          name: body.name,
          avatar_kind: body.avatar_kind,
          avatar_value: body.avatar_value,
          role: 'admin',
          current_stars: 0,
          preferred_locale: 'el',
        });
      }),
    );
    renderSetup();
    const nameInput = document.querySelector('input[type="text"]') as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: 'Dad' } });
    const pinInputs = screen.getAllByPlaceholderText('1234');
    fireEvent.change(pinInputs[0], { target: { value: '1234' } });
    fireEvent.change(pinInputs[1], { target: { value: '1234' } });
    fireEvent.click(screen.getByText('Δημιουργία Λογαριασμού'));
    await waitFor(() => {
      const user = useAuthStore.getState().user;
      expect(user).not.toBeNull();
      expect(user!.name).toBe('Dad');
      expect(user!.role).toBe('admin');
    });
  });

  it('disables submit button while loading', async () => {
    let resolve: (v: unknown) => void;
    const p = new Promise(r => { resolve = r; });
    server.use(
      http.post('/api/bootstrap/setup', async () => {
        await p;
        return HttpResponse.json({ detail: 'fail' }, { status: 500 });
      }),
    );
    renderSetup();
    const nameInput = document.querySelector('input[type="text"]') as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: 'Dad' } });
    const pinInputs = screen.getAllByPlaceholderText('1234');
    fireEvent.change(pinInputs[0], { target: { value: '1234' } });
    fireEvent.change(pinInputs[1], { target: { value: '1234' } });
    const btn = screen.getByText('Δημιουργία Λογαριασμού');
    fireEvent.click(btn);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Δημιουργία/ })).toBeDisabled();
    });
    resolve!(undefined);
  });

  it('shows avatar selection icons', () => {
    renderSetup();
    const avatarSelect = document.querySelector('.avatar-select');
    expect(avatarSelect).toBeInTheDocument();
    const options = avatarSelect?.querySelectorAll('.avatar-option');
    expect(options!.length).toBeGreaterThan(5);
  });

  it('toggles avatar selection', () => {
    renderSetup();
    const options = document.querySelectorAll('.avatar-option');
    expect(options[1].classList).not.toContain('selected');
    fireEvent.click(options[1]);
    expect(options[1].classList).toContain('selected');
  });
});
