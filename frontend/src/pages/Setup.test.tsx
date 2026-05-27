import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { Setup } from './Setup';
import { useAuthStore } from '../state/authStore';

const server = setupServer();

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

beforeAll(() => server.listen());

afterEach(() => {
  server.resetHandlers();
  useAuthStore.getState().clearUser();
});

afterAll(() => server.close());

describe('Setup', () => {
  it('renders the setup form', () => {
    renderSetup();
    expect(screen.getByText('Create Admin Account')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Your name')).toBeInTheDocument();
    expect(screen.getAllByPlaceholderText('1234').length).toBe(2);
  });

  it('shows error when name is empty', () => {
    renderSetup();
    fireEvent.click(screen.getByText('Create Account'));
    expect(screen.getByText('Please enter your name')).toBeInTheDocument();
  });

  it('shows error when PINs do not match', () => {
    renderSetup();
    fireEvent.change(screen.getByPlaceholderText('Your name'), { target: { value: 'Dad' } });
    const pinInputs = screen.getAllByPlaceholderText('1234');
    fireEvent.change(pinInputs[0], { target: { value: '1234' } });
    fireEvent.change(pinInputs[1], { target: { value: '5678' } });
    fireEvent.click(screen.getByText('Create Account'));
    expect(screen.getByText('PINs do not match')).toBeInTheDocument();
  });

  it('shows error for non-4-digit PIN', () => {
    renderSetup();
    fireEvent.change(screen.getByPlaceholderText('Your name'), { target: { value: 'Dad' } });
    const pinInputs = screen.getAllByPlaceholderText('1234');
    fireEvent.change(pinInputs[0], { target: { value: '12' } });
    fireEvent.change(pinInputs[1], { target: { value: '12' } });
    fireEvent.click(screen.getByText('Create Account'));
    expect(screen.getByText('PIN must be exactly 4 digits')).toBeInTheDocument();
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
    fireEvent.change(screen.getByPlaceholderText('Your name'), { target: { value: 'Dad' } });
    const pinInputs = screen.getAllByPlaceholderText('1234');
    fireEvent.change(pinInputs[0], { target: { value: '1234' } });
    fireEvent.change(pinInputs[1], { target: { value: '1234' } });
    fireEvent.click(screen.getByText('Create Account'));
    await waitFor(() => {
      const user = useAuthStore.getState().user;
      expect(user).not.toBeNull();
      expect(user!.name).toBe('Dad');
      expect(user!.role).toBe('admin');
    });
  });

  it('disables submit button while loading', async () => {
    let resolve;
    const p = new Promise(r => { resolve = r; });
    server.use(
      http.post('/api/bootstrap/setup', async () => {
        await p;
        return HttpResponse.json({ detail: 'fail' }, { status: 500 });
      }),
    );
    renderSetup();
    fireEvent.change(screen.getByPlaceholderText('Your name'), { target: { value: 'Dad' } });
    const pinInputs = screen.getAllByPlaceholderText('1234');
    fireEvent.change(pinInputs[0], { target: { value: '1234' } });
    fireEvent.change(pinInputs[1], { target: { value: '1234' } });
    const btn = screen.getByText('Create Account');
    fireEvent.click(btn);
    await waitFor(() => {
      expect(btn).toHaveTextContent('Creating');
    });
    resolve();
  });

  it('shows avatar selection icons', () => {
    renderSetup();
    // Should show at least some avatar icons
    const avatarSelect = document.querySelector('.avatar-select');
    expect(avatarSelect).toBeInTheDocument();
    const options = avatarSelect?.querySelectorAll('.avatar-option');
    expect(options!.length).toBeGreaterThan(5);
  });

  it('toggles avatar selection', () => {
    renderSetup();
    const options = document.querySelectorAll('.avatar-option');
    // First avatar (shield) is selected by default, click the second one
    expect(options[1].classList).not.toContain('selected');
    fireEvent.click(options[1]);
    expect(options[1].classList).toContain('selected');
  });
});
