import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { ExercisesHub } from './ExercisesHub';
import { useI18nStore } from '../../../i18n/store';

const server = setupServer();

const TRANSLATIONS: Record<string, Record<string, string>> = {
  'exercises.title': { el: 'Ασκήσεις', en: 'Exercises' },
  'exercises.empty': { el: 'Καμία άσκηση', en: 'No exercises for you yet.' },
  'exercises.subject.language': { el: 'Γλώσσα', en: 'Language' },
  'exercises.subject.foreign_language': { el: 'Ξένη Γλώσσα', en: 'Foreign Language' },
  'exercises.subject.math': { el: 'Μαθηματικά', en: 'Math' },
  'exercises.subject.geography': { el: 'Γεωγραφία', en: 'Geography' },
  'exercises.subject.history': { el: 'Ιστορία', en: 'History' },
  'exercises.subject.logic': { el: 'Λογική', en: 'Logic' },
  'exercises.subject.nature': { el: 'Φύση', en: 'Nature' },
};

function renderHub() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <MemoryRouter initialEntries={['/dashboard/exercises']}>
      <QueryClientProvider client={queryClient}>
        <Routes>
          <Route path="/dashboard/exercises" element={<ExercisesHub />} />
        </Routes>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

beforeAll(() => {
  server.listen();
  useI18nStore.getState().setTranslations(TRANSLATIONS);
  useI18nStore.getState().setLocale('en');
});
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('ExercisesHub', () => {
  it('renders a card only for subjects that have at least one bundle', async () => {
    server.use(
      http.get('/api/exercises/bundles', () =>
        HttpResponse.json([
          { id: 'a', version: 1, title: 'A', subject: 'language', age_min: 4, age_max: 6, stars: 3, exercise_count: 2, completed: false },
          { id: 'b', version: 1, title: 'B', subject: 'language', age_min: 4, age_max: 6, stars: 3, exercise_count: 1, completed: true },
          { id: 'c', version: 1, title: 'C', subject: 'math', age_min: 7, age_max: 9, stars: 5, exercise_count: 3, completed: false },
        ]),
      ),
    );
    renderHub();

    const language = await screen.findByRole('link', { name: /Language/ });
    expect(language).toHaveAttribute('href', '/dashboard/exercises/language');
    expect(screen.getByRole('link', { name: /Math/ })).toBeInTheDocument();
    // Subjects without bundles are not rendered.
    expect(screen.queryByRole('link', { name: /Geography/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Nature/ })).not.toBeInTheDocument();
    // language group shows 1/2 completed.
    expect(language).toHaveTextContent('1/2');
  });

  it('shows the empty message when there are no bundles', async () => {
    server.use(http.get('/api/exercises/bundles', () => HttpResponse.json([])));
    renderHub();
    await waitFor(() => expect(screen.getByText('No exercises for you yet.')).toBeInTheDocument());
  });
});
