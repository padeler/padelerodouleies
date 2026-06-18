import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { BundlePlayer } from './BundlePlayer';
import { useI18nStore } from '../../../i18n/store';

// Stub confetti/audio so jsdom stays quiet and we can spy on the celebration.
const notifyCelebration = vi.fn();
vi.mock('../../../lib/notify', () => ({ notifyCelebration: (...a: unknown[]) => notifyCelebration(...a) }));
vi.mock('../../../lib/sound', () => ({ playReward: vi.fn(), playWrong: vi.fn(), playSuccess: vi.fn() }));

const server = setupServer();

const TRANSLATIONS: Record<string, Record<string, string>> = {
  'exercises.back': { el: 'Πίσω', en: 'Back' },
  'exercises.progress': { el: '{current}/{total}', en: '{current} of {total}' },
  'exercises.correct': { el: 'Μπράβο!', en: 'Correct!' },
  'exercises.wrong': { el: 'Ξανά!', en: 'Try again!' },
  'exercises.hint': { el: 'Βοήθεια', en: 'Hint' },
  'exercises.check': { el: 'Έλεγχος', en: 'Check' },
  'exercises.tap_to_order': { el: 'Πάτησε με τη σειρά', en: 'Tap in order' },
  'exercises.well_done': { el: 'Τέλεια!', en: 'Great!' },
  'exercises.earned_stars': { el: 'Κέρδισες {stars} ⭐!', en: 'You earned {stars} ⭐!' },
  'card.listen': { el: 'Άκουσέ το', en: 'Listen' },
  'common.error': { el: 'Σφάλμα', en: 'Error' },
};

const MC_MANIFEST = {
  schema_version: 1, id: 'letters-A', version: 1, title: 'Letters', subject: 'language',
  age_min: 4, age_max: 6, stars: 3,
  exercises: [
    {
      id: 'ex-01', type: 'multiple_choice', prompt: 'Which is apple?', hint: 'It is red',
      options: [{ id: 'a', text: 'apple' }, { id: 'b', text: 'ball' }],
    },
    {
      id: 'ex-02', type: 'multiple_choice', prompt: 'Which says meow?',
      options: [{ id: 'cat', text: 'cat' }, { id: 'dog', text: 'dog' }],
    },
  ],
};

const NUM_MANIFEST = {
  schema_version: 1, id: 'math-1', version: 1, title: 'Math', subject: 'math',
  age_min: 7, age_max: 9, stars: 5,
  exercises: [{ id: 'ex-01', type: 'numeric_entry', prompt: '5 + 5 = ?' }],
};

function gradeMC(exerciseId: string, response: unknown) {
  const correctMap: Record<string, string> = { 'ex-01': 'a', 'ex-02': 'cat' };
  const correct = response === correctMap[exerciseId];
  const completed = correct && exerciseId === 'ex-02';
  return { correct, completed, stars_awarded: completed ? 3 : 0, current_stars: completed ? 3 : 0 };
}

function renderPlayer(bundleId: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <MemoryRouter initialEntries={[`/dashboard/exercises/language/${bundleId}`]}>
      <QueryClientProvider client={queryClient}>
        <Routes>
          <Route path="/dashboard/exercises/:subject/:bundleId" element={<BundlePlayer />} />
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
beforeEach(() => notifyCelebration.mockClear());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('BundlePlayer — multiple choice', () => {
  beforeEach(() => {
    server.use(
      http.get('/api/exercises/bundles/letters-A', () => HttpResponse.json(MC_MANIFEST)),
      http.post('/api/exercises/bundles/letters-A/answers', async ({ request }) => {
        const body = (await request.json()) as { exercise_id: string; response: unknown };
        return HttpResponse.json(gradeMC(body.exercise_id, body.response));
      }),
    );
  });

  it('shows the hint after a wrong answer, then advances on a correct one', async () => {
    const user = userEvent.setup();
    renderPlayer('letters-A');

    await screen.findByText('Which is apple?');
    // Wrong answer → "Try again!" + hint revealed.
    await user.click(screen.getByRole('button', { name: 'ball' }));
    await waitFor(() => expect(screen.getByText('Try again!')).toBeInTheDocument());
    expect(screen.getByText('It is red')).toBeInTheDocument();

    // Correct answer → advance to the second exercise.
    await user.click(screen.getByRole('button', { name: 'apple' }));
    await waitFor(() => expect(screen.getByText('Which says meow?')).toBeInTheDocument(), { timeout: 2000 });
  });

  it('celebrates exactly once on completion', async () => {
    const user = userEvent.setup();
    renderPlayer('letters-A');

    await screen.findByText('Which is apple?');
    await user.click(screen.getByRole('button', { name: 'apple' }));
    await waitFor(() => expect(screen.getByText('Which says meow?')).toBeInTheDocument(), { timeout: 2000 });
    await user.click(screen.getByRole('button', { name: 'cat' }));

    await waitFor(() => expect(screen.getByText('Great!')).toBeInTheDocument(), { timeout: 2000 });
    expect(screen.getByText('You earned 3 ⭐!')).toBeInTheDocument();
    expect(notifyCelebration).toHaveBeenCalledTimes(1);
  });
});

const COUNT_MANIFEST = {
  schema_version: 1, id: 'count-1', version: 1, title: 'Counting', subject: 'math',
  age_min: 4, age_max: 6, stars: 3,
  exercises: [{ id: 'ex-01', type: 'counting', prompt: 'How many apples?', image: 'apples.png', max_count: 6 }],
};

const ORDER_MANIFEST = {
  schema_version: 1, id: 'order-1', version: 1, title: 'Ordering', subject: 'logic',
  age_min: 5, age_max: 8, stars: 4,
  exercises: [{
    id: 'ex-01', type: 'ordering', prompt: 'Put in order',
    items: [{ id: 'x1', text: 'a' }, { id: 'x2', text: 'b' }, { id: 'x3', text: 'c' }],
  }],
};

const MATCH_MANIFEST = {
  schema_version: 1, id: 'match-1', version: 1, title: 'Match', subject: 'language',
  age_min: 4, age_max: 7, stars: 4,
  exercises: [{
    id: 'ex-01', type: 'match_pairs', prompt: 'Match them',
    pairs: [
      { left: { id: 'l1', text: 'cat' }, right: { id: 'r1', text: 'meow' } },
      { left: { id: 'l2', text: 'dog' }, right: { id: 'r2', text: 'woof' } },
    ],
  }],
};

describe('BundlePlayer — counting', () => {
  beforeEach(() => {
    server.use(
      http.get('/api/exercises/bundles/count-1', () => HttpResponse.json(COUNT_MANIFEST)),
      http.post('/api/exercises/bundles/count-1/answers', async ({ request }) => {
        const body = (await request.json()) as { response: unknown };
        const correct = body.response === 3;
        return HttpResponse.json({ correct, completed: correct, stars_awarded: correct ? 3 : 0, current_stars: correct ? 3 : 0 });
      }),
    );
  });

  it('posts the tapped number and completes when correct', async () => {
    const user = userEvent.setup();
    renderPlayer('count-1');

    await screen.findByText('How many apples?');
    await user.click(screen.getByRole('button', { name: '3' }));

    await waitFor(() => expect(screen.getByText('Great!')).toBeInTheDocument(), { timeout: 2000 });
    expect(screen.getByText('You earned 3 ⭐!')).toBeInTheDocument();
    expect(notifyCelebration).toHaveBeenCalledTimes(1);
  });
});

describe('BundlePlayer — ordering', () => {
  beforeEach(() => {
    server.use(
      http.get('/api/exercises/bundles/order-1', () => HttpResponse.json(ORDER_MANIFEST)),
      http.post('/api/exercises/bundles/order-1/answers', async ({ request }) => {
        const body = (await request.json()) as { response: unknown };
        const correct = JSON.stringify(body.response) === JSON.stringify(['x1', 'x2', 'x3']);
        return HttpResponse.json({ correct, completed: correct, stars_awarded: correct ? 4 : 0, current_stars: correct ? 4 : 0 });
      }),
    );
  });

  it('builds the sequence by tapping and submits it', async () => {
    const user = userEvent.setup();
    renderPlayer('order-1');

    await screen.findByText('Put in order');
    await user.click(screen.getByRole('button', { name: 'a' }));
    await user.click(screen.getByRole('button', { name: 'b' }));
    await user.click(screen.getByRole('button', { name: 'c' }));
    await user.click(screen.getByRole('button', { name: 'Check' }));

    await waitFor(() => expect(screen.getByText('Great!')).toBeInTheDocument(), { timeout: 2000 });
    expect(screen.getByText('You earned 4 ⭐!')).toBeInTheDocument();
    expect(notifyCelebration).toHaveBeenCalledTimes(1);
  });
});

describe('BundlePlayer — match pairs', () => {
  beforeEach(() => {
    server.use(
      http.get('/api/exercises/bundles/match-1', () => HttpResponse.json(MATCH_MANIFEST)),
      http.post('/api/exercises/bundles/match-1/answers', async ({ request }) => {
        const body = (await request.json()) as { response: Record<string, string> };
        const correct = body.response.l1 === 'r1' && body.response.l2 === 'r2';
        return HttpResponse.json({ correct, completed: correct, stars_awarded: correct ? 4 : 0, current_stars: correct ? 4 : 0 });
      }),
    );
  });

  it('links every left to a right and submits the map', async () => {
    const user = userEvent.setup();
    renderPlayer('match-1');

    await screen.findByText('Match them');
    await user.click(screen.getByRole('button', { name: 'cat' }));
    await user.click(screen.getByRole('button', { name: 'meow' }));
    await user.click(screen.getByRole('button', { name: 'dog' }));
    await user.click(screen.getByRole('button', { name: 'woof' }));
    await user.click(screen.getByRole('button', { name: 'Check' }));

    await waitFor(() => expect(screen.getByText('Great!')).toBeInTheDocument(), { timeout: 2000 });
    expect(screen.getByText('You earned 4 ⭐!')).toBeInTheDocument();
    expect(notifyCelebration).toHaveBeenCalledTimes(1);
  });
});

describe('BundlePlayer — numeric entry', () => {
  beforeEach(() => {
    server.use(
      http.get('/api/exercises/bundles/math-1', () => HttpResponse.json(NUM_MANIFEST)),
      http.post('/api/exercises/bundles/math-1/answers', async ({ request }) => {
        const body = (await request.json()) as { response: unknown };
        const correct = body.response === 10;
        return HttpResponse.json({ correct, completed: correct, stars_awarded: correct ? 5 : 0, current_stars: correct ? 5 : 0 });
      }),
    );
  });

  it('posts the typed integer and completes when correct', async () => {
    const user = userEvent.setup();
    renderPlayer('math-1');

    await screen.findByText('5 + 5 = ?');
    await user.click(screen.getByRole('button', { name: '1' }));
    await user.click(screen.getByRole('button', { name: '0' }));
    await user.click(screen.getByRole('button', { name: 'Check' }));

    await waitFor(() => expect(screen.getByText('Great!')).toBeInTheDocument(), { timeout: 2000 });
    expect(screen.getByText('You earned 5 ⭐!')).toBeInTheDocument();
    expect(notifyCelebration).toHaveBeenCalledTimes(1);
  });
});
