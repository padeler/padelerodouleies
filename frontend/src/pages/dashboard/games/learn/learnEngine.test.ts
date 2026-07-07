import { describe, expect, it } from 'vitest';
import { LETTER_VOCAB, LETTER_VOCAB_EXTRA, LETTER_VOCAB_POOL, SPELL_WORDS } from './letterVocab';
import {
  CHOICES,
  LIVES_START,
  MAX_HEAR_FALLERS,
  ROUNDS_PER_SLOT,
  SLOTS_PER_TIER,
  applyAnswer,
  createGame,
  currentLevelType,
  finalScore,
  isTimeTrial,
  nextRound,
  roundSignature,
  tierNumber,
  type Deck,
  type GameState,
} from './learnEngine';

/** A deterministic rng that walks a fixed list of values (cycling). */
function seqRng(values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length]!;
}

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

  it('match (letters): picks a real pool entry per letter (icon + audio id agree)', () => {
    const g = createGame('letters', lettersDeck());
    const round = nextRound({ ...g, slot: 0 }, () => 0.3);
    if (round.kind !== 'match') throw new Error('wrong kind');
    expect(round.icons).toBeDefined();
    expect(round.vocabIds).toBeDefined();
    for (const item of round.left) {
      const pool = LETTER_VOCAB_POOL[item.token]!;
      const id = round.vocabIds!.get(item.token)!;
      const entry = pool.find((en) => en.id === id);
      // The chosen entry belongs to this letter's pool and its icon is shown.
      expect(entry).toBeDefined();
      expect(round.icons!.get(item.token)).toBe(entry!.emoji ?? entry!.image);
    }
  });

  it('match: the recent-token window rotates through the whole tier slice without repeats', () => {
    const g = createGame('letters', lettersDeck()); // tier 0 pool = 9 letters
    const recent: string[] = [];
    const seen = new Set<string>();
    let prev: Round | undefined;
    // 9 letters / 3 per round → three rounds should cover the slice exactly once.
    for (let r = 0; r < 3; r += 1) {
      const round = nextRound({ ...g, slot: 0 }, Math.random, prev, recent);
      if (round.kind !== 'match') throw new Error('wrong kind');
      for (const it of round.left) seen.add(it.token);
      recent.push(...round.left.map((it) => it.token));
      prev = round;
    }
    expect(seen.size).toBe(9); // every letter shown once, none repeated
  });

  it('match: once the slice is exhausted, the least-recently-used letters come back first', () => {
    const g = createGame('letters', lettersDeck()); // 9 letters
    const recent: string[] = [];
    const rounds: string[][] = [];
    let prev: Round | undefined;
    for (let r = 0; r < 4; r += 1) {
      const round = nextRound({ ...g, slot: 0 }, Math.random, prev, recent);
      if (round.kind !== 'match') throw new Error('wrong kind');
      const tokens = round.left.map((it) => it.token);
      rounds.push(tokens);
      recent.push(...tokens);
      prev = round;
    }
    // Round 4 (pool exhausted after 3 rounds) reuses round 1's letters — the
    // oldest — not round 2's or 3's.
    expect(new Set(rounds[3])).toEqual(new Set(rounds[0]));
  });

  it('hear: the target is one of the choices', () => {
    const g = createGame('numbers', numbersDeck());
    const round = nextRound({ ...g, slot: 1 }, () => 0.2);
    if (round.kind !== 'hear') throw new Error('wrong kind');
    expect(round.choices.map((c) => c.token)).toContain(round.target.token);
  });

  it('hear (letters): populates icons from vocab for choice tokens', () => {
    const g = createGame('letters', lettersDeck());
    const round = nextRound({ ...g, slot: 1 }, () => 0.3);
    if (round.kind !== 'hear') throw new Error('wrong kind');
    expect(round.icons).toBeDefined();
    // Every choice with a vocab emoji should appear in the icons map.
    for (const item of round.choices) {
      const entry = LETTER_VOCAB[item.token];
      if (entry?.emoji) {
        expect(round.icons!.get(item.token)).toBe(entry.emoji);
      } else {
        expect(round.icons!.has(item.token)).toBe(false);
      }
    }
  });

  it('hear (numbers): does not populate icons for numbers track', () => {
    const g = createGame('numbers', numbersDeck());
    const round = nextRound({ ...g, slot: 1 }, () => 0.2);
    if (round.kind !== 'hear') throw new Error('wrong kind');
    expect(round.icons).toBeUndefined();
  });

  it('hear round is single-target below the multi-target threshold', () => {
    const g = createGame('numbers', numbersDeck());
    const round = nextRound({ ...g, tierIndex: 0, slot: 1, roundInSlot: 0 }, () => 0.5);
    if (round.kind !== 'hear') throw new Error('wrong kind');
    expect(round.variant).toBeUndefined();
    expect(round.choices.filter((c) => c.token === round.target.token)).toHaveLength(1);
  });

  it('hear round spawns 2-3 extra target fallers once tier/difficulty is high enough', () => {
    const g = createGame('numbers', numbersDeck());
    const round = nextRound({ ...g, tierIndex: 2, slot: 1, roundInSlot: 1 }, () => 0.5);
    if (round.kind !== 'hear') throw new Error('wrong kind');
    expect(round.variant).toBe('multi-target');
    const targetCount = round.choices.filter((c) => c.token === round.target.token).length;
    expect(targetCount).toBeGreaterThanOrEqual(3); // the original + 2..3 extra copies
    expect(targetCount).toBeLessThanOrEqual(4);
  });

  it('hear round can generate a "starts-with" variant for letters with a curated second word', () => {
    const g = createGame('letters', lettersDeck());
    // rng() < 0.5 always steers hearRound into the starts-with branch once eligible.
    const round = nextRound({ ...g, tierIndex: 2, slot: 1, roundInSlot: 1 }, () => 0.1);
    if (round.kind !== 'hear') throw new Error('wrong kind');
    expect(round.variant).toBe('starts-with');
    expect(round.startsWithTokens).toHaveLength(1);
    const extraToken = round.startsWithTokens![0]!;
    const tokens = round.choices.map((c) => c.token);
    expect(tokens).toContain(round.target.token);
    expect(tokens).toContain(extraToken);
    // Both the primary and the curated extra word get their own, distinct icon.
    expect(round.icons!.get(round.target.token)).toBe(LETTER_VOCAB[round.target.token]!.emoji);
    expect(round.icons!.get(extraToken)).toBe(LETTER_VOCAB_EXTRA[round.target.token]!.emoji);
    expect(round.icons!.get(extraToken)).not.toBe(round.icons!.get(round.target.token));
    // Every faller that isn't a required target is a distractor from another letter.
    for (const item of round.choices) {
      if (item.token !== round.target.token && item.token !== extraToken) {
        expect(item.token).not.toBe(round.target.token);
      }
    }
  });

  it('hear round never generates "starts-with" for the numbers track', () => {
    const g = createGame('numbers', numbersDeck());
    const round = nextRound({ ...g, tierIndex: 5, slot: 1, roundInSlot: 2 }, () => 0.1);
    if (round.kind !== 'hear') throw new Error('wrong kind');
    expect(round.variant).not.toBe('starts-with');
    expect(round.startsWithTokens).toBeUndefined();
  });

  it('hear round can generate a "spell" variant for letters — a curated word, tapped in order', () => {
    const g = createGame('letters', lettersDeck());
    // First rng() call is the starts-with roll (>= 1/3 skips it); the second is
    // the spell roll (< 0.5 picks it).
    const round = nextRound({ ...g, tierIndex: 2, slot: 1, roundInSlot: 1 }, seqRng([0.9, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6]));
    if (round.kind !== 'hear') throw new Error('wrong kind');
    expect(round.variant).toBe('spell');
    const seq = round.spellSequence;
    expect(seq).toBeDefined();
    expect(seq!.length).toBeGreaterThanOrEqual(3);
    // The sequence must be exactly one of the curated words.
    expect(SPELL_WORDS.some((w) => w.tokens.join(',') === seq!.join(','))).toBe(true);
    expect(round.target.token).toBe(seq![0]);
    // Every sequence token (including repeats) has at least one matching faller,
    // plus exactly 2 distractor fallers whose tokens never collide with it.
    for (const tok of seq!) {
      expect(round.choices.filter((c) => c.token === tok).length).toBeGreaterThanOrEqual(1);
    }
    expect(round.choices.length).toBe(seq!.length + 2);
  });

  it('hear round can generate a "spell" variant for numbers — count up from one, in order', () => {
    const g = createGame('numbers', numbersDeck());
    // Numbers never qualify for starts-with, so the very first rng() call is
    // the spell roll (< 0.5 picks it).
    const round = nextRound({ ...g, tierIndex: 2, slot: 1, roundInSlot: 1 }, seqRng([0.1, 0.5, 0.2, 0.3]));
    if (round.kind !== 'hear') throw new Error('wrong kind');
    expect(round.variant).toBe('spell');
    const seq = round.spellSequence;
    expect(seq).toBeDefined();
    expect(seq!.length).toBeGreaterThanOrEqual(3);
    expect(seq!.length).toBeLessThanOrEqual(5);
    expect(seq).toEqual(Array.from({ length: seq!.length }, (_, i) => `n${i + 1}`));
    expect(round.target.token).toBe('n1');
  });

  it('hear round never generates "spell" below the harder-tier threshold', () => {
    const g = createGame('letters', lettersDeck());
    const round = nextRound({ ...g, tierIndex: 0, slot: 1, roundInSlot: 0 }, () => 0.1);
    if (round.kind !== 'hear') throw new Error('wrong kind');
    expect(round.variant).not.toBe('spell');
    expect(round.spellSequence).toBeUndefined();
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

  it('whats_next distractors stay near the answer in deck order', () => {
    // A 20-item tier used to hand out far-off distractors (e.g. 19 after
    // "2 3 4"), making the round trivially easy. They must now come from a
    // near window around the answer.
    const g = createGame('numbers', numbersDeck());
    const tier2 = { ...g, tierIndex: 1, slot: 3 };
    for (let i = 0; i < 50; i += 1) {
      const r = nextRound(tier2, seqRng([i / 50, 0.3, 0.7, 0.1, 0.9]));
      if (r.kind !== 'whats_next') throw new Error('wrong kind');
      const answerValue = Number(r.answer.token.slice(1));
      expect(r.choices.length).toBe(CHOICES);
      for (const choice of r.choices) {
        // Window: prefix length (3) + CHOICES - 1 = 6 around the answer.
        expect(Math.abs(Number(choice.token.slice(1)) - answerValue)).toBeLessThanOrEqual(6);
      }
    }
  });

  it('whats_next still fills all choices when the pool is tiny', () => {
    // 4-item pool: the near window alone cannot fill 3 distractors once the
    // prefix is excluded — the fallback must top the choices up pool-wide.
    const deck = numbersDeck(4);
    const smallDeck: Deck = { items: deck.items, tiers: [{ level: 1, tokens: deck.items.map((it) => it.token) }] };
    const state = { ...createGame('numbers', smallDeck), slot: 3 };
    const r = nextRound(state, () => 0);
    if (r.kind !== 'whats_next') throw new Error('wrong kind');
    // prefix 1,2,3 → answer 4; only 3 remaining non-prefix items at most.
    expect(r.choices.map((c) => c.token)).toContain(r.answer.token);
    expect(new Set(r.choices.map((c) => c.token)).size).toBe(r.choices.length);
  });

  it('keeps generating rounds when the tier loops past the deck (content plateaus)', () => {
    const g = createGame('numbers', numbersDeck());
    const deep = { ...g, tierIndex: 9 }; // far past the 2 defined tiers
    const round = nextRound({ ...deep, slot: 1 }, () => 0.5);
    expect(round.kind).toBe('hear');
  });

  it('does not hand back the same question twice in a row (no-repeat)', () => {
    // A two-item hear pool: with the previous round targeting n1, passing it as
    // `prev` makes nextRound regenerate until it lands on the other target (n2).
    const items = [
      { token: 'n1', glyph: '1', glyph_alt: null, audio_url: '/a/n1' },
      { token: 'n2', glyph: '2', glyph_alt: null, audio_url: '/a/n2' },
    ];
    const deck: Deck = { items, tiers: [{ level: 1, tokens: ['n1', 'n2'] }] };
    const state = { ...createGame('numbers', deck), slot: 1 }; // hear
    const prev = nextRound(state, () => 0); // target n1
    expect(prev.kind === 'hear' && prev.target.token).toBe('n1');
    // First generation repeats n1 (→ regenerate), second yields n2.
    const next = nextRound(state, seqRng([0, 0, 0.9, 0]), prev);
    expect(roundSignature(next)).not.toBe(roundSignature(prev));
    expect(next.kind === 'hear' && next.target.token).toBe('n2');
  });

  it('roundSignature distinguishes questions but ignores distractor order', () => {
    const a = num3CountRound(3);
    const b = num3CountRound(3);
    const c = num3CountRound(5);
    expect(roundSignature(a)).toBe(roundSignature(b));
    expect(roundSignature(a)).not.toBe(roundSignature(c));
  });

  it('hear round carries timeLimit and fallSpeedMult that ramp with difficulty', () => {
    const g = createGame('numbers', numbersDeck());
    const r0 = nextRound({ ...g, slot: 1, roundInSlot: 0 }, () => 0.5);
    const r2 = nextRound({ ...g, slot: 1, roundInSlot: 2 }, () => 0.5);
    if (r0.kind !== 'hear' || r2.kind !== 'hear') throw new Error('wrong kind');
    expect(r0.timeLimit).toBe(12); // full time at round 0
    expect(r2.timeLimit).toBeLessThan(r0.timeLimit!); // less time at higher difficulty
    expect(r2.fallSpeedMult ?? 1.0).toBeGreaterThan(r0.fallSpeedMult ?? 1.0); // faster drops
  });

  it('whats_next carries timeLimit that ramps with difficulty', () => {
    const g = createGame('numbers', numbersDeck());
    const r0 = nextRound({ ...g, slot: 3, roundInSlot: 0 }, () => 0.5);
    const r2 = nextRound({ ...g, slot: 3, roundInSlot: 2 }, () => 0.5);
    if (r0.kind !== 'whats_next' || r2.kind !== 'whats_next') throw new Error('wrong kind');
    expect(r0.timeLimit).toBe(12);
    expect(r2.timeLimit).toBeLessThan(r0.timeLimit!);
  });

  it('order round sequence grows with difficulty within a slot', () => {
    const g = createGame('numbers', numbersDeck());
    const r0 = nextRound({ ...g, slot: 2, roundInSlot: 0 }, () => 0.5);
    const r2 = nextRound({ ...g, slot: 2, roundInSlot: 2 }, () => 0.5);
    if (r0.kind !== 'order' || r2.kind !== 'order') throw new Error('wrong kind');
    expect(r0.sequence.length).toBeLessThanOrEqual(2); // shorter at round 0
    expect(r2.sequence.length).toBeGreaterThanOrEqual(r0.sequence.length);
  });

  it('count round max count increases with difficulty within a slot', () => {
    const g = createGame('numbers', numbersDeck());
    // Tier 2 has a pool of 20 items. With difficulty step=2, the effective max
    // is Math.min(COUNT_MAX + 2, 20) = 12, so we can see counts > COUNT_MAX.
    const tier2 = { ...g, tierIndex: 1 };
    let foundAbove = false;
    for (let i = 0; i < 200; i += 1) {
      const r = nextRound({ ...tier2, slot: 0, roundInSlot: 2 }, () => 0.5 + (i % 10) * 0.05);
      if (r.kind === 'count' && r.count > 10) {
        foundAbove = true;
        break;
      }
    }
    expect(foundAbove).toBe(true);
  });

  it('count round distractors stay within ±3 of the real count', () => {
    const g = createGame('numbers', numbersDeck());
    // A large tier pool used to hand out far-off distractors (e.g. 17 next to
    // 2), turning the round into "spot the small number" instead of counting.
    const tier2 = { ...g, tierIndex: 1 };
    for (let i = 0; i < 50; i += 1) {
      const r = nextRound({ ...tier2, slot: 0, roundInSlot: 0 }, seqRng([i / 50, 0.3, 0.7, 0.1]));
      if (r.kind !== 'count') throw new Error('wrong kind');
      expect(r.choices.length).toBe(CHOICES);
      for (const choice of r.choices) {
        expect(Math.abs(Number(choice.token.slice(1)) - r.count)).toBeLessThanOrEqual(3);
      }
    }
  });

  it('spell rounds never spawn more fallers than fit the canvas columns', () => {
    const g = createGame('letters', lettersDeck());
    // Force the spell variant across many rng streams and check every choice
    // list (sequence + distractors) respects MAX_HEAR_FALLERS.
    for (let i = 0; i < 100; i += 1) {
      const round = nextRound(
        { ...g, tierIndex: 2, slot: 1, roundInSlot: 1 },
        seqRng([0.9, 0.1, i / 100, (i * 7) % 100 / 100, 0.5]),
      );
      if (round.kind !== 'hear' || round.variant !== 'spell') continue;
      expect(round.choices.length).toBeLessThanOrEqual(MAX_HEAR_FALLERS);
      expect(round.choices.length).toBeGreaterThan(round.spellSequence!.length); // ≥1 distractor
    }
  });
});

function num3CountRound(count: number) {
  const item = (n: number) => ({ token: `n${n}`, glyph: String(n), glyph_alt: null, audio_url: `/a/n${n}` });
  return {
    kind: 'count' as const,
    count,
    objectGlyph: '⭐',
    answer: item(count),
    choices: [item(count), item(count + 1)],
  };
}
