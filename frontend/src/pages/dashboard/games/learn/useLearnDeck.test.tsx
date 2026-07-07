import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useLearnDeck } from './useLearnDeck';

const getLearnDeck = vi.fn();
vi.mock('../../../../api/client', () => ({
  getLearnDeck: (track: 'numbers' | 'letters') => getLearnDeck(track),
  learnSayUrl: (level: string) => `/api/games/learn/say/${level}.mp3`,
  learnFindUrl: (track: string, token: string) => `/api/games/learn/${track}/find/${token}.mp3`,
  learnFindAllUrl: (track: string, token: string) => `/api/games/learn/${track}/find-all/${token}.mp3`,
  learnFindStartsWithUrl: (token: string) => `/api/games/learn/letters/find-starts-with/${token}.mp3`,
  learnVocabUrl: (id: string) => `/api/games/learn/letters/vocab/${id}.mp3`,
  learnSuccessUrl: () => '/api/games/learn/feedback/success.mp3',
  learnWrongUrl: (track: string, correct: string, picked: string | null) =>
    `/api/games/learn/${track}/wrong/${correct}/${picked ?? '_none'}.mp3`,
}));

const created: FakeAudio[] = [];
class FakeAudio {
  src: string;
  preload = '';
  currentTime = 0;
  readyState = 4; // HAVE_ENOUGH_DATA → prefetch resolves without waiting
  load = vi.fn();
  play = vi.fn().mockResolvedValue(undefined);
  pause = vi.fn();
  addEventListener = vi.fn();
  removeEventListener = vi.fn();
  constructor(src: string) {
    this.src = src;
    created.push(this);
  }
}

/** Token clips only — the hook also pre-creates the 5 level-intro phrase clips. */
function tokenClips(): FakeAudio[] {
  return created.filter((a) => a.src.includes('/tts/'));
}

beforeEach(() => {
  created.length = 0;
  getLearnDeck.mockResolvedValue({
    track: 'numbers',
    items: [
      { token: 'n1', glyph: '1', glyph_alt: null, audio_url: '/api/games/learn/numbers/tts/n1.mp3' },
      { token: 'n2', glyph: '2', glyph_alt: null, audio_url: '/api/games/learn/numbers/tts/n2.mp3' },
    ],
    tiers: [{ level: 1, tokens: ['n1', 'n2'] }],
  });
  vi.stubGlobal('Audio', FakeAudio as unknown as typeof Audio);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('useLearnDeck', () => {
  it('pre-creates the level-intro phrase clips on mount', async () => {
    renderHook(() => useLearnDeck('numbers'), { wrapper });
    await waitFor(() => expect(created.length).toBeGreaterThan(0));
    const phraseSrcs = created.map((a) => a.src).filter((s) => s.includes('/say/'));
    expect(phraseSrcs).toEqual([
      '/api/games/learn/say/count.mp3',
      '/api/games/learn/say/match.mp3',
      '/api/games/learn/say/hear.mp3',
      '/api/games/learn/say/order.mp3',
      '/api/games/learn/say/whats_next.mp3',
    ]);
  });

  it('loads the deck and prefetches token clips into audio elements', async () => {
    const { result } = renderHook(() => useLearnDeck('numbers'), { wrapper });
    await waitFor(() => expect(result.current.ready).toBe(true));

    await result.current.prefetch(['n1', 'n2']);
    expect(tokenClips().map((a) => a.src)).toEqual([
      '/api/games/learn/numbers/tts/n1.mp3',
      '/api/games/learn/numbers/tts/n2.mp3',
    ]);
    expect(tokenClips().every((a) => a.load.mock.calls.length > 0)).toBe(true);
  });

  it('plays a prefetched token without creating a new element', async () => {
    const { result } = renderHook(() => useLearnDeck('numbers'), { wrapper });
    await waitFor(() => expect(result.current.ready).toBe(true));

    await result.current.prefetch(['n1']);
    const before = created.length;
    result.current.playToken('n1');
    expect(created.length).toBe(before); // reused from cache
    const n1 = tokenClips().find((a) => a.src.endsWith('n1.mp3'))!;
    expect(n1.play).toHaveBeenCalled();
  });

  it('plays only one clip at a time (single channel)', async () => {
    const { result } = renderHook(() => useLearnDeck('numbers'), { wrapper });
    await waitFor(() => expect(result.current.ready).toBe(true));

    await result.current.prefetch(['n1', 'n2']);
    result.current.playToken('n1');
    result.current.playToken('n2'); // must stop n1 before starting n2
    const n1 = tokenClips().find((a) => a.src.endsWith('n1.mp3'))!;
    expect(n1.pause).toHaveBeenCalled();
  });
});
