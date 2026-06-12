import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { Landing } from './Landing';
import { useAuthStore } from '../state/authStore';
import { useI18nStore } from '../i18n/store';

const server = setupServer();

function renderLanding() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <Landing />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

beforeAll(() => {
  server.listen();
  useI18nStore.getState().setTranslations({});
});

afterEach(() => {
  server.resetHandlers();
  useAuthStore.getState().clearUser();
});

afterAll(() => {
  server.close();
});

describe('Landing', () => {
  it('renders title and avatar tiles', async () => {
    server.use(
      http.get('/api/auth/users', async () => {
        return HttpResponse.json([
          { id: 1, name: 'Maria', avatar_kind: 'icon', avatar_value: 'fox', role: 'user' },
        ]);
      }),
      http.get('/api/bootstrap/status', async () => {
        return HttpResponse.json({ first_run: false });
      }),
    );
    renderLanding();
    await waitFor(() => {
      expect(screen.getByText('Maria')).toBeInTheDocument();
    });
  });

  it('shows admin badge for admin users', async () => {
    server.use(
      http.get('/api/auth/users', async () => {
        return HttpResponse.json([
          { id: 1, name: 'Dad', avatar_kind: 'icon', avatar_value: 'shield', role: 'admin' },
        ]);
      }),
      http.get('/api/bootstrap/status', async () => {
        return HttpResponse.json({ first_run: false });
      }),
    );
    renderLanding();
    await waitFor(() => {
      expect(screen.getByText('Dad')).toBeInTheDocument();
      expect(document.querySelector('.admin-badge')).toBeInTheDocument();
    });
  });

  it('clicking avatar tile sets selected_user_id', async () => {
    server.use(
      http.get('/api/auth/users', async () => {
        return HttpResponse.json([
          { id: 2, name: 'Nikos', avatar_kind: 'icon', avatar_value: 'unicorn', role: 'user' },
        ]);
      }),
      http.get('/api/bootstrap/status', async () => {
        return HttpResponse.json({ first_run: false });
      }),
    );
    renderLanding();
    await waitFor(() => {
      fireEvent.click(screen.getByText('Nikos'));
      expect(useAuthStore.getState().selected_user_id).toBe(2);
    });
  });

  it('shows avatar image src for icon avatars', async () => {
    server.use(
      http.get('/api/auth/users', async () => {
        return HttpResponse.json([
          { id: 1, name: 'Maria', avatar_kind: 'icon', avatar_value: 'fox', role: 'user' },
        ]);
      }),
      http.get('/api/bootstrap/status', async () => {
        return HttpResponse.json({ first_run: false });
      }),
    );
    renderLanding();
    await waitFor(() => {
      const img = screen.getByAltText('Maria');
      expect(img).toHaveAttribute('src', '/api/icons/svg/fox');
    });
  });

  it('shows avatar image src for uploaded image avatars', async () => {
    server.use(
      http.get('/api/auth/users', async () => {
        return HttpResponse.json([
          { id: 1, name: 'Photo Kid', avatar_kind: 'image', avatar_value: '/avatars/abc123.webp', role: 'user' },
        ]);
      }),
      http.get('/api/bootstrap/status', async () => {
        return HttpResponse.json({ first_run: false });
      }),
    );
    renderLanding();
    await waitFor(() => {
      const img = screen.getByAltText('Photo Kid');
      expect(img).toHaveAttribute('src', '/avatars/abc123.webp');
    });
  });
});
