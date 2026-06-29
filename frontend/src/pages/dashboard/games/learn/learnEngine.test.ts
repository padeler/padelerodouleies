import { describe, expect, it } from 'vitest';
import {
  CHOICES,
  LIVES_START,
  ROUNDS_PER_SLOT,
  SLOTS_PER_TIER,
  applyAnswer,
  createGame,
  currentLevelType,
  finalScore,
  isTimeTrial,
  nextRound,
  tierNumber,
  type Deck,
  type GameState,
} from './learnEngine';

function numbersDeck(max = 20): Deck {
  const items = Array.from({ length: max }, (_, i) => ({
    token: `n${i + 1}`,
    glyph: String(i + 1),
    glyph_alt: null,
    audio_url: `/a/n${i + 1}`,
  }));
  return {
    items,
    tiers: [
      { level: 1, tokens: items.slice(0, 10).map((it) => it.token) },
      { level: 2, tokens: items.slice(0, 20).map((it) => it.token) },
    ],
  };
}

function lettersDeck(): Deck {
  const upper = ['Α', 'Β', 'Γ', 'Δ', 'Ε', 'Ζ', 'Η', 'Θ', 'Ι', 'Κ', 'Λ', 'Μ', 'Ν'];
  const lower = ['α', 'β', 'γ', 'δ', 'ε', 'ζ', 'η', 'θ', 'ι', 'κ', 'λ', 'μ', 'ν'];
  const items = upper.map((g, i) => ({
    token: `l${String(i + 1).padStart(2, '0')}`,
    glyph: g,
    glyph_alt: lower[i]!,
    audio_url: `/a/l${i + 1}`,
  }));
  return {
    items,
    tiers: [
      { level: 1, tokens: items.slice(0, 9).map((it) => it.token) },
      { level: 2, tokens: items.slice(0, 13).map((it) => it.token) },
    ],
  };
}

/** Apply N correct answers in a row, returning the resulting state. */
function correctTimes(state: GameState, n: number): GameState {
  let s = state;
  for (let i = 0; i < n; i += 1) s = applyAnswer(s, true).state;
  return s;
}

describe('learnEngine progression', () => {
  it('starts at tier 1, slot 0, full lives', () => {
    const g = createGame('numbers', numbersDeck());
    expect(g.status).toBe('playing');
    expect(g.lives).toBe(LIVES_START);
    expect(tierNumber(g)).toBe(1);
    expect(g.slot).toBe(0);
    expect(finalScore(g)).toBe(1000); // tier 1 * 1000 + 0 points
  });

  it('maps slots to the right level types per track', () => {
    const nums = createGame('numbers', numbersDeck());
    const lets = createGame('letters', lettersDeck());
    expect(currentLevelType({ ...nums, slot: 0 })).toBe('count');
    expect(currentLevelType({ ...lets, slot: 0 })).toBe('match');
    expect(currentLevelType({ ...nums, slot: 1 })).toBe('hear');
    expect(currentLevelType({ ...nums, slot: 2 })).toBe('order');
    expect(currentLevelType({ ...nums, slot: 3 })).toBe('whats_next');
  });

  it('marks Hear It and What Comes Next as time trials', () => {
    const g = createGame('numbers', numbersDeck());
    expect(isTimeTrial({ ...g, slot: 0 })).toBe(false);
    expect(isTimeTrial({ ...g, slot: 1 })).toBe(true);
    expect(isTimeTrial({ ...g, slot: 2 })).toBe(false);
    expect(isTimeTrial({ ...g, slot: 3 })).toBe(true);
  });

  it('a correct answer adds points and grows the streak', () => {
    const g = createGame('numbers', numbersDeck());
    const { state, events } = applyAnswer(g, true);
    expect(events).toContain('correct');
    expect(state.points).toBeGreaterThan(0);
    expect(state.streak).toBe(1);
  });

  it('a wrong answer costs a life, resets the streak, adds no points', () => {
    const g = correctTimes(createGame('numbers', numbersDeck()), 1);
    const { state, events } = applyAnswer(g, false);
    expect(events).toEqual(['wrong']);
    expect(state.lives).toBe(LIVES_START - 1);
    expect(state.streak).toBe(0);
    expect(state.points).toBe(g.points); // unchanged
  });

  it('clears a slot after ROUNDS_PER_SLOT correct answers', () => {
    const g = createGame('numbers', numbersDeck());
    const before = correctTimes(g, ROUNDS_PER_SLOT - 1);
    expect(before.slot).toBe(0);
    const { state, events } = applyAnswer(before, true);
    expect(events).toContain('slot_cleared');
    expect(state.slot).toBe(1);
    expect(state.roundInSlot).toBe(0);
  });

  it('clears a tier after all slots and loops to the next, harder tier', () => {
    const g = createGame('numbers', numbersDeck());
    const perTier = ROUNDS_PER_SLOT * SLOTS_PER_TIER;
    const justBefore = correctTimes(g, perTier - 1);
    const { state, events } = applyAnswer(justBefore, true);
    expect(events).toContain('tier_cleared');
    expect(tierNumber(state)).toBe(2);
    expect(state.slot).toBe(0);
  });

  it('ends the game when lives reach zero', () => {
    let g = createGame('numbers', numbersDeck());
    let lastEvents: string[] = [];
    for (let i = 0; i < LIVES_START; i += 1) {
      const r = applyAnswer(g, false);
      g = r.state;
      lastEvents = r.events;
    }
    expect(g.status).toBe('over');
    expect(lastEvents).toContain('game_over');
    // No-op once over.
    const after = applyAnswer(g, true);
    expect(after.events).toEqual([]);
    expect(after.state).toBe(g);
  });

  it('final score combines tier and points', () => {
    const g = createGame('numbers', numbersDeck());
    const cleared = correctTimes(g, ROUNDS_PER_SLOT * SLOTS_PER_TIER); // → tier 2
    expect(tierNumber(cleared)).toBe(2);
    expect(finalScore(cleared)).toBe(2000 + cleared.points);
  });
});

describe('learnEngine round generation', () => {
  it('count: answer glyph matches the object count and is among the choices', () => {
    const g = createGame('numbers', numbersDeck());
    const round = nextRound({ ...g, slot: 0 }, () => 0.5);
    expect(round.kind).toBe('count');
    if (round.kind !== 'count') throw new Error('wrong kind');
    expect(round.count).toBeGreaterThanOrEqual(1);
    expect(round.count).toBeLessThanOrEqual(10);
    expect(round.answer.glyph).toBe(String(round.count));
    expect(round.choices.map((c) => c.token)).toContain(round.answer.token);
    expect(round.choices.length).toBeLessThanOrEqual(CHOICES);
  });

  it('match: left and right hold the same letters (pairable by token)', () => {
    const g = createGame('letters', lettersDeck());
    const round = nextRound({ ...g, slot: 0 }, () => 0.3);
    if (round.kind !== 'match') throw new Error('wrong kind');
    expect(new Set(round.left.map((i) => i.token))).toEqual(
      new Set(round.right.map((i) => i.token)),
    );
    expect(round.left.every((i) => i.glyph_alt !== null)).toBe(true);
  });

  it('hear: the target is one of the choices', () => {
    const g = createGame('numbers', numbersDeck());
    const round = nextRound({ ...g, slot: 1 }, () => 0.2);
    if (round.kind !== 'hear') throw new Error('wrong kind');
    expect(round.choices.map((c) => c.token)).toContain(round.target.token);
  });

  it('order: the correct sequence is in deck order; shown holds the same items', () => {
    const g = createGame('numbers', numbersDeck());
    const round = nextRound({ ...g, slot: 2 }, () => 0.4);
    if (round.kind !== 'order') throw new Error('wrong kind');
    const values = round.sequence.map((i) => Number(i.glyph));
    expect([...values]).toEqual([...values].sort((a, b) => a - b));
    expect(new Set(round.shown.map((i) => i.token))).toEqual(
      new Set(round.sequence.map((i) => i.token)),
    );
  });

  it('whats_next: the answer is the successor of the shown prefix', () => {
    const g = createGame('numbers', numbersDeck());
    const round = nextRound({ ...g, slot: 3 }, () => 0);
    if (round.kind !== 'whats_next') throw new Error('wrong kind');
    // rng=0 → prefix starts at n1 → 1,2,3, next is 4.
    expect(round.prefix.map((i) => i.glyph)).toEqual(['1', '2', '3']);
    expect(round.answer.glyph).toBe('4');
    expect(round.choices.map((c) => c.token)).toContain(round.answer.token);
  });

  it('keeps generating rounds when the tier loops past the deck (content plateaus)', () => {
    const g = createGame('numbers', numbersDeck());
    const deep = { ...g, tierIndex: 9 }; // far past the 2 defined tiers
    const round = nextRound({ ...deep, slot: 1 }, () => 0.5);
    expect(round.kind).toBe('hear');
  });
});
