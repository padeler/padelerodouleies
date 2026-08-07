import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { BundleList } from './BundleList';
import { useI18nStore } from '../../../i18n/store';

const server = setupServer();

const TRANSLATIONS: Record<string, Record<string, string>> = {
  'exercises.empty': { el: 'Καμία άσκηση', en: 'No exercises for you yet.' },
  'exercises.filter_empty': { el: 'Καμία', en: 'Nothing matches this filter.' },
  'exercises.filter.all': { el: 'Όλες', en: 'All' },
  'exercises.filter.completed': { el: 'Ολοκληρωμένες', en: 'Completed' },
  'exercises.filter.not_started': { el: 'Νέες', en: 'Not started' },
  'exercises.back': { el: 'Πίσω', en: 'Back' },
  'exercises.completed': { el: 'Ολοκληρώθηκε', en: 'Completed' },
  'exercises.exercise_count': { el: '{count} ασκήσεις', en: '{count} exercises' },
  'exercises.subject.math': { el: 'Μαθηματικά', en: 'Math' },
  'card.listen': { el: 'Άκου', en: 'Listen' },
};

function bundle(id: string, completed: boolean, difficulty: number) {
  return {
    id,
    version: 1,
    title: id.toUpperCase(),
    subject: 'math',
    difficulty,
    age_min: 7,
    age_max: 9,
    stars: 3,
    exercise_count: 2,
    completed,
  };
}

function renderList() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <MemoryRouter initialEntries={['/dashboard/exercises/math']}>
      <QueryClientProvider client={queryClient}>
        <Routes>
          <Route path="/dashboard/exercises/:subject" element={<BundleList />} />
        </Routes>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

function serveBundles(list: ReturnType<typeof bundle>[]) {
  server.use(http.get('/api/exercises/bundles', () => HttpResponse.json(list)));
}

beforeAll(() => {
  server.listen();
  useI18nStore.getState().setTranslations(TRANSLATIONS);
  useI18nStore.getState().setLocale('en');
});
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('BundleList completion filter', () => {
  it('defaults to "not started" and hides completed bundles', async () => {
    serveBundles([bundle('a', false, 1), bundle('b', true, 2), bundle('c', false, 3)]);
    renderList();

    await waitFor(() => expect(screen.getByRole('link', { name: /^A/ })).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /Not started/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.queryByRole('link', { name: /^B/ })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^C/ })).toBeInTheDocument();
  });

  it('switches to completed and back to all', async () => {
    const user = userEvent.setup();
    serveBundles([bundle('a', false, 1), bundle('b', true, 2)]);
    renderList();
    await waitFor(() => expect(screen.getByRole('link', { name: /^A/ })).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /^Completed/ }));
    expect(screen.queryByRole('link', { name: /^A/ })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^B/ })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /All/ }));
    expect(screen.getByRole('link', { name: /^A/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^B/ })).toBeInTheDocument();
  });

  it('shows per-filter counts', async () => {
    serveBundles([bundle('a', false, 1), bundle('b', true, 2), bundle('c', true, 3)]);
    renderList();

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Not started/ })).toHaveTextContent('1'),
    );
    expect(screen.getByRole('button', { name: /^Completed/ })).toHaveTextContent('2');
    expect(screen.getByRole('button', { name: /All/ })).toHaveTextContent('3');
  });

  it('shows the filter-empty message when everything in the group is completed', async () => {
    serveBundles([bundle('a', true, 1)]);
    renderList();

    await waitFor(() =>
      expect(screen.getByText('Nothing matches this filter.')).toBeInTheDocument(),
    );
    // The group itself is not empty, so the filter bar stays visible.
    expect(screen.getByRole('button', { name: /All/ })).toBeInTheDocument();
  });

  it('shows the group-empty message and no filter bar when the group has no bundles', async () => {
    serveBundles([]);
    renderList();

    await waitFor(() =>
      expect(screen.getByText('No exercises for you yet.')).toBeInTheDocument(),
    );
    expect(screen.queryByRole('button', { name: /All/ })).not.toBeInTheDocument();
  });
});
