/** Pure helpers for the Memory Match deck — exported separately for unit tests. */

export const MEMORY_EMOJI_POOL: readonly string[] = [
  '🐶', '🐱', '🦊', '🐼', '🦄', '🐸', '🐙', '🦋',
  '🚀', '🍕', '🎈', '⚽', '🌈', '🍦', '🤖', '🦖',
];

export type MemoryDifficulty = 'easy' | 'medium' | 'hard';

export const PAIRS_BY_DIFFICULTY: Record<MemoryDifficulty, number> = {
  easy: 6,
  medium: 8,
  hard: 10,
};

export interface MemoryCard {
  id: number;
  emoji: string;
}

/** Fisher–Yates shuffle; `rng` is injectable for deterministic tests. */
export function shuffle<T>(items: readonly T[], rng: () => number = Math.random): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const a = result[i];
    const b = result[j];
    if (a === undefined || b === undefined) throw new Error('shuffle: index out of range');
    result[i] = b;
    result[j] = a;
  }
  return result;
}

/** Build a shuffled deck of emoji pairs for the given difficulty. */
export function buildDeck(difficulty: MemoryDifficulty, rng: () => number = Math.random): MemoryCard[] {
  const pairs = PAIRS_BY_DIFFICULTY[difficulty];
  if (pairs > MEMORY_EMOJI_POOL.length) {
    throw new Error(`Not enough emojis for ${pairs} pairs`);
  }
  const emojis = shuffle(MEMORY_EMOJI_POOL, rng).slice(0, pairs);
  return shuffle([...emojis, ...emojis], rng).map((emoji, id) => ({ id, emoji }));
}
