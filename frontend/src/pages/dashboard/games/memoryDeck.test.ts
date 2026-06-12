import { describe, expect, it } from 'vitest';
import { MEMORY_EMOJI_POOL, PAIRS_BY_DIFFICULTY, buildDeck, shuffle } from './memoryDeck';

/** Tiny deterministic LCG so shuffle-dependent tests are reproducible. */
function seededRng(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

describe('shuffle', () => {
  it('preserves all elements', () => {
    const input = [1, 2, 3, 4, 5];
    const result = shuffle(input, seededRng(1));
    expect([...result].sort((a, b) => a - b)).toEqual(input);
  });

  it('does not mutate the input', () => {
    const input = [1, 2, 3];
    shuffle(input, seededRng(7));
    expect(input).toEqual([1, 2, 3]);
  });

  it('is deterministic for a given rng', () => {
    expect(shuffle([1, 2, 3, 4], seededRng(42))).toEqual(shuffle([1, 2, 3, 4], seededRng(42)));
  });
});

describe('buildDeck', () => {
  it.each(['easy', 'medium', 'hard'] as const)('builds %s deck with every emoji exactly twice', (difficulty) => {
    const pairs = PAIRS_BY_DIFFICULTY[difficulty];
    const deck = buildDeck(difficulty, seededRng(3));
    expect(deck).toHaveLength(pairs * 2);

    const counts = new Map<string, number>();
    for (const card of deck) {
      counts.set(card.emoji, (counts.get(card.emoji) ?? 0) + 1);
    }
    expect(counts.size).toBe(pairs);
    for (const count of counts.values()) expect(count).toBe(2);
    for (const emoji of counts.keys()) expect(MEMORY_EMOJI_POOL).toContain(emoji);
  });

  it('assigns sequential unique ids', () => {
    const deck = buildDeck('easy', seededRng(9));
    expect(deck.map((c) => c.id)).toEqual([...deck.keys()]);
  });
});
