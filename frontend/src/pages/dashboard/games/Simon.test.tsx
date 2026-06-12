import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Simon } from './Simon';
import { useI18nStore } from '../../../i18n/store';

// In-memory stand-in for the game-scores backend (higher-is-better for simon).
let serverScores: Record<string, number> = {};

vi.mock('../../../api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../api/client')>()),
  getGameScores: vi.fn(() => Promise.resolve({ ...serverScores })),
  submitGameScore: vi.fn((game: string, score: number) => {
    const current = serverScores[game];
    const improved = current === undefined || score > current;
    if (improved) serverScores[game] = score;
    return Promise.resolve({ best_score: serverScores[game] ?? score, improved });
  }),
}));

const TRANSLATIONS: Record<string, Record<string, string>> = {
  'games.back': { el: '…', en: 'All games' },
  'games.best': { el: '…', en: 'Best' },
  'games.new_best': { el: '…', en: 'New best!' },
  'games.score': { el: '…', en: 'Score' },
  'games.start': { el: '…', en: 'Start' },
  'games.play_again': { el: '…', en: 'Play again' },
  'games.game_over': { el: '…', en: 'Game over!' },
  'games.simon.title': { el: '…', en: 'Simon' },
  'games.simon.desc': { el: '…', en: 'Remember and repeat the color sequence!' },
  'games.simon.watch': { el: '…', en: 'Watch carefully…' },
  'games.simon.your_turn': { el: '…', en: 'Your turn!' },
  'games.simon.round': { el: '…', en: 'Round {round}' },
};

beforeAll(() => {
  useI18nStore.getState().setTranslations(TRANSLATIONS);
  useI18nStore.getState().setLocale('en');
});

beforeEach(() => {
  serverScores = {};
  vi.useFakeTimers();
  // Pad picks become deterministic: always pad 0 (green).
  vi.spyOn(Math, 'random').mockReturnValue(0);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function renderGame() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <Simon />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

/** Start the game and fast-forward through the watch phase of round 1. */
function startAndWatch() {
  fireEvent.click(screen.getByRole('button', { name: 'Start' }));
  act(() => {
    vi.advanceTimersByTime(2000);
  });
}

/** Flush pending microtasks (mocked API promises) inside act. */
async function flush() {
  await act(async () => {});
}

describe('Simon', () => {
  it('shows the start overlay when idle', () => {
    renderGame();
    expect(screen.getByRole('button', { name: 'Start' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'green' })).toBeDisabled();
  });

  it('plays the sequence then hands over to the player', () => {
    renderGame();
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    expect(screen.getByText('Watch carefully…')).toBeInTheDocument();
    expect(screen.getByText('Round 1')).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.getByText('Your turn!')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'green' })).toBeEnabled();
  });

  it('advances to the next round after a correct repeat', () => {
    renderGame();
    startAndWatch();
    fireEvent.click(screen.getByRole('button', { name: 'green' }));
    expect(screen.getByText('Round 2')).toBeInTheDocument();
    expect(screen.getByText('Watch carefully…')).toBeInTheDocument();
  });

  it('ends the game on a wrong pad without reporting a zero score', async () => {
    renderGame();
    startAndWatch();
    fireEvent.click(screen.getByRole('button', { name: 'red' }));
    expect(screen.getByText('Game over!')).toBeInTheDocument();
    expect(screen.getByText(/Score: 0/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Play again' })).toBeInTheDocument();
    await flush();
    expect(serverScores).toEqual({});
  });

  it('reports the score after completing at least one round', async () => {
    renderGame();
    startAndWatch();
    // Complete round 1 (sequence [0]), then fail in round 2.
    fireEvent.click(screen.getByRole('button', { name: 'green' }));
    act(() => {
      vi.advanceTimersByTime(4000);
    });
    expect(screen.getByText('Your turn!')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'red' }));
    expect(screen.getByText(/Score: 1/)).toBeInTheDocument();
    await flush();
    expect(screen.getByText(/New best!/)).toBeInTheDocument();
    expect(serverScores['simon']).toBe(1);
  });
});
