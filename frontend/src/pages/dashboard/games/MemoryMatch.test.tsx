import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryMatch } from './MemoryMatch';
import { useI18nStore } from '../../../i18n/store';

// In-memory stand-in for the game-scores backend (lower-is-better for memory).
let serverScores: Record<string, number> = {};

vi.mock('../../../api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../api/client')>()),
  getGameScores: vi.fn(() => Promise.resolve({ ...serverScores })),
  submitGameScore: vi.fn((game: string, score: number) => {
    const current = serverScores[game];
    const improved = current === undefined || score < current;
    if (improved) serverScores[game] = score;
    return Promise.resolve({ best_score: serverScores[game] ?? score, improved });
  }),
}));

const TRANSLATIONS: Record<string, Record<string, string>> = {
  'games.back': { el: '…', en: 'All games' },
  'games.best': { el: '…', en: 'Best' },
  'games.new_best': { el: '…', en: 'New best!' },
  'games.play_again': { el: '…', en: 'Play again' },
  'games.memory.title': { el: '…', en: 'Memory Match' },
  'games.memory.moves': { el: '…', en: 'Moves' },
  'games.memory.win': { el: '…', en: 'You found them all!' },
  'games.memory.easy': { el: '…', en: 'Easy' },
  'games.memory.medium': { el: '…', en: 'Medium' },
  'games.memory.hard': { el: '…', en: 'Hard' },
};

beforeAll(() => {
  useI18nStore.getState().setTranslations(TRANSLATIONS);
  useI18nStore.getState().setLocale('en');
});

beforeEach(() => {
  serverScores = {};
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

function renderGame() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <MemoryMatch />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

function getCards(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>('.mm-card'));
}

/** Pair up card indices by their emoji (exposed via data-emoji for tests). */
function pairsByEmoji(cards: HTMLElement[]): Map<string, number[]> {
  const pairs = new Map<string, number[]>();
  cards.forEach((card, index) => {
    const emoji = card.dataset.emoji ?? '';
    pairs.set(emoji, [...(pairs.get(emoji) ?? []), index]);
  });
  return pairs;
}

/** Flush pending microtasks (mocked API promises) inside act. */
async function flush() {
  await act(async () => {});
}

describe('MemoryMatch', () => {
  it('renders 12 face-down cards on easy', () => {
    renderGame();
    const cards = getCards();
    expect(cards).toHaveLength(12);
    expect(cards.filter((c) => c.classList.contains('face-up'))).toHaveLength(0);
  });

  it('switches deck size with difficulty', () => {
    renderGame();
    fireEvent.click(screen.getByRole('button', { name: 'Hard' }));
    expect(getCards()).toHaveLength(20);
  });

  it('keeps a matched pair face up and counts the move', () => {
    renderGame();
    const cards = getCards();
    const firstPair = [...pairsByEmoji(cards).values()][0];
    if (!firstPair || firstPair.length !== 2) throw new Error('expected a pair');
    const [a, b] = firstPair as [number, number];

    fireEvent.click(cards[a]!);
    fireEvent.click(cards[b]!);
    expect(cards[a]!.classList.contains('matched')).toBe(true);
    expect(cards[b]!.classList.contains('matched')).toBe(true);
    expect(screen.getByText(/Moves: 1/)).toBeInTheDocument();
  });

  it('flips a mismatched pair back after a delay', () => {
    renderGame();
    const cards = getCards();
    const pairs = [...pairsByEmoji(cards).values()];
    const pairA = pairs[0];
    const pairB = pairs[1];
    if (!pairA || !pairB) throw new Error('expected two pairs');

    fireEvent.click(cards[pairA[0]!]!);
    fireEvent.click(cards[pairB[0]!]!);
    expect(cards[pairA[0]!]!.classList.contains('face-up')).toBe(true);

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(cards[pairA[0]!]!.classList.contains('face-up')).toBe(false);
    expect(cards[pairB[0]!]!.classList.contains('face-up')).toBe(false);
  });

  it('shows the win overlay and reports the score to the server', async () => {
    renderGame();
    const cards = getCards();
    for (const pair of pairsByEmoji(cards).values()) {
      const [a, b] = pair as [number, number];
      fireEvent.click(cards[a]!);
      fireEvent.click(cards[b]!);
    }
    expect(screen.getByText(/You found them all!/)).toBeInTheDocument();

    await flush(); // server answers: improved → "New best!" + refreshed best
    expect(screen.getByText(/New best!/)).toBeInTheDocument();
    expect(serverScores['memory.easy']).toBe(6);

    // Play again resets the board; best now comes from the server.
    fireEvent.click(screen.getByRole('button', { name: 'Play again' }));
    await flush();
    expect(screen.getByText(/Moves: 0/)).toBeInTheDocument();
    expect(screen.getByText(/Best: 6/)).toBeInTheDocument();
  });
});
