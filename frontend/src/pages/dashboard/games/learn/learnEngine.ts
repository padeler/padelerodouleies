/**
 * Pure engine for the Learning Adventure teaching games — no DOM, no timers,
 * no sound, no audio playback. The components own rendering, the rAF/timer
 * loops, audio and input; this module owns progression and round generation so
 * the rules are unit-testable in isolation.
 *
 * Shape of a run: 4 level-type slots per tier, ROUNDS_PER_SLOT correct answers
 * to clear a slot, 4 slots to clear a tier, then the tier number climbs forever
 * (content plateaus at the largest deck slice — "endless, harder"). 3 lives; a
 * wrong answer (or a missed falling target / expired time-trial, reported by the
 * component as `correct=false`) costs one. The final score submitted to the
 * server is `tier * 1000 + points`.
 *
 * Since these games award no stars, the correct answer travels inside the Round
 * (the component compares locally) — there is no server grading to protect.
 */

import { LETTER_VOCAB } from './letterVocab';

export type Track = 'numbers' | 'letters';

/** A deck item as the client holds it (mirrors the API `KidDeckItem`). */
export interface DeckItem {
  token: string;
  glyph: string;
  glyph_alt: string | null;
  audio_url: string;
}

export interface Tier {
  level: number;
  tokens: string[];
}

export interface Deck {
  items: DeckItem[];
  tiers: Tier[];
}

// The four level-type slots per track, in play order. Slot 0 is track-specific
// (Count Them for numbers, Match Case for letters); slots 1–3 are shared.
export type LevelType = 'count' | 'match' | 'hear' | 'order' | 'whats_next';

const LEVEL_TYPES: Record<Track, readonly LevelType[]> = {
  numbers: ['count', 'hear', 'order', 'whats_next'],
  letters: ['match', 'hear', 'order', 'whats_next'],
};

export const SLOTS_PER_TIER = 4;
export const ROUNDS_PER_SLOT = 3;
export const LIVES_START = 3;
export const COUNT_MAX = 10; // Count Them never shows more than this many objects
export const SEQUENCE_LEN = 3; // items shown in order / match / before "what's next"
export const CHOICES = 4; // tappable choices in single-answer levels
export const COUNT_OBJECT = '⭐'; // ≤ Unicode 6.1 — safe on the old tablets
export const TIME_LIMIT_SECONDS = 12; // time-trial rounds (component runs the clock)

// Time-trial slots: Hear It (1) and What Comes Next (3). The component reads
// this to decide whether to run the countdown.
const TIME_TRIAL_SLOTS = new Set([1, 3]);

const POINTS_PER_CORRECT = 10;
const STREAK_BONUS_STEP = 2; // extra points per consecutive correct, capped
const STREAK_BONUS_CAP = 5;

// --- Rounds -------------------------------------------------------------------

export interface CountRound {
  kind: 'count';
  count: number; // how many objects to render (1..COUNT_MAX)
  objectGlyph: string;
  choices: DeckItem[];
  answer: DeckItem;
}
export interface MatchRound {
  kind: 'match';
  left: DeckItem[]; // shown via glyph (uppercase)
  right: DeckItem[]; // shown via glyph_alt (lowercase), shuffled; pair by token
  icons?: Map<string, string>; // token → emoji for visual icon matching; undefined = no icons
}
export interface HearRound {
  kind: 'hear';
  target: DeckItem; // component plays target.audio_url
  choices: DeckItem[];
  timeLimit?: number; // seconds; undefined means engine default (TIME_LIMIT_SECONDS)
  fallSpeedMult?: number; // multiplier for hearEngine base speed; undefined = 1.0
}
export interface OrderRound {
  kind: 'order';
  sequence: DeckItem[]; // correct ascending/alphabetical order
  shown: DeckItem[]; // shuffled presentation
}
export interface WhatsNextRound {
  kind: 'whats_next';
  prefix: DeckItem[]; // the run shown so far
  answer: DeckItem; // the next item
  choices: DeckItem[];
  timeLimit?: number; // seconds; undefined means engine default (TIME_LIMIT_SECONDS)
}
export type Round = CountRound | MatchRound | HearRound | OrderRound | WhatsNextRound;

/**
 * What the kid did on a round, surfaced to the result panel so it can explain
 * the outcome (display text) and play the spoken explanation (by token). The
 * player components build this; `picked*` is null when the kid ran out of time.
 */
export interface RoundFeedback {
  pickedToken: string | null;
  pickedGlyph: string | null;
  correctToken: string;
  correctGlyph: string;
}

// --- Game state ---------------------------------------------------------------

export interface GameState {
  track: Track;
  itemsByToken: Record<string, DeckItem>;
  tiers: Tier[];
  tierIndex: number; // 0-based; score tier number = tierIndex + 1, grows unbounded
  slot: number; // 0..SLOTS_PER_TIER-1
  roundInSlot: number; // 0..ROUNDS_PER_SLOT-1
  lives: number;
  points: number;
  streak: number;
  status: 'playing' | 'over';
}

export type GameEvent = 'correct' | 'wrong' | 'slot_cleared' | 'tier_cleared' | 'game_over';

// --- Small pure rng helpers (rng injectable for deterministic tests) ----------

function shuffleWith<T>(items: T[], rng: () => number): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = a[i]!;
    a[i] = a[j]!;
    a[j] = tmp;
  }
  return a;
}

function sample<T>(items: T[], n: number, rng: () => number): T[] {
  return shuffleWith(items, rng).slice(0, Math.min(n, items.length));
}

function pickOne<T>(items: T[], rng: () => number): T {
  if (items.length === 0) throw new Error('pickOne: empty pool');
  return items[Math.floor(rng() * items.length)]!;
}

// --- Difficulty ramping (progressive within each slot) -------------------------

/** Clamp roundInSlot to 0..2 for a 3-step ramp within each slot. */
function diffStep(state: GameState): number {
  return Math.min(state.roundInSlot, ROUNDS_PER_SLOT - 1);
}

/** Time-trial duration in seconds (decreases as rounds progress). */
export function timeLimitForState(state: GameState): number {
  const step = diffStep(state);
  // Round 0: full time; round 1: -1s; round 2: -2s (but never < 4s).
  return Math.max(4, TIME_LIMIT_SECONDS - step);
}

/** Fall speed multiplier for Hear It (increases as rounds progress). */
export function fallSpeedMultiplier(state: GameState): number {
  const step = diffStep(state);
  // Round 0: 1.0x; round 1: 1.25x; round 2: 1.5x
  return 1 + step * 0.25;
}

/** Sequence length for Ordering (starts shorter, grows to SEQUENCE_LEN). */
export function orderSequenceLength(state: GameState): number {
  const step = diffStep(state);
  // Round 0: 2 items; round 1+: up to SEQUENCE_LEN
  return Math.min(2 + step, SEQUENCE_LEN);
}

// --- Public API ---------------------------------------------------------------

export function createGame(track: Track, deck: Deck): GameState {
  if (deck.tiers.length === 0) throw new Error('createGame: deck has no tiers');
  const itemsByToken: Record<string, DeckItem> = {};
  for (const item of deck.items) itemsByToken[item.token] = item;
  return {
    track,
    itemsByToken,
    tiers: deck.tiers,
    tierIndex: 0,
    slot: 0,
    roundInSlot: 0,
    lives: LIVES_START,
    points: 0,
    streak: 0,
    status: 'playing',
  };
}

/** Score tier number (1-based, unbounded as the game loops). */
export function tierNumber(state: GameState): number {
  return state.tierIndex + 1;
}

/** Final score submitted to the server: tier * 1000 + accumulated points. */
export function finalScore(state: GameState): number {
  return tierNumber(state) * 1000 + state.points;
}

export function currentLevelType(state: GameState): LevelType {
  return LEVEL_TYPES[state.track][state.slot]!;
}

export function isTimeTrial(state: GameState): boolean {
  return TIME_TRIAL_SLOTS.has(state.slot);
}

/** Deck items in play this tier (content plateaus at the largest tier slice). */
function poolForState(state: GameState): DeckItem[] {
  const contentTier = Math.min(state.tierIndex, state.tiers.length - 1);
  const tier = state.tiers[contentTier]!;
  return tier.tokens.map((t) => state.itemsByToken[t]!);
}

/**
 * Apply a graded answer, advancing the game. The component reports a single
 * boolean (it compares the kid's input against the Round locally); the engine
 * owns scoring, life loss and slot/tier advancement. Returns the next state and
 * the events that fired (for sound/confetti).
 */
export function applyAnswer(state: GameState, correct: boolean): { state: GameState; events: GameEvent[] } {
  if (state.status !== 'playing') return { state, events: [] };

  if (!correct) {
    const lives = state.lives - 1;
    const next: GameState = { ...state, lives, streak: 0, status: lives <= 0 ? 'over' : 'playing' };
    return { state: next, events: lives <= 0 ? ['wrong', 'game_over'] : ['wrong'] };
  }

  const events: GameEvent[] = ['correct'];
  const streak = state.streak + 1;
  const bonus = Math.min(streak - 1, STREAK_BONUS_CAP) * STREAK_BONUS_STEP;
  const points = state.points + POINTS_PER_CORRECT + bonus;

  let { slot, tierIndex } = state;
  let roundInSlot = state.roundInSlot + 1;

  if (roundInSlot >= ROUNDS_PER_SLOT) {
    roundInSlot = 0;
    slot += 1;
    events.push('slot_cleared');
    if (slot >= SLOTS_PER_TIER) {
      slot = 0;
      tierIndex += 1;
      events.push('tier_cleared');
    }
  }

  return {
    state: { ...state, slot, tierIndex, roundInSlot, points, streak },
    events,
  };
}

// How many regeneration attempts before giving up on avoiding a repeat (the
// pool may be too small to vary — then we accept whatever we last generated).
const MAX_REGEN_TRIES = 8;

/**
 * A stable signature of a round's "question", used to avoid handing the kid the
 * exact same exercise twice in a row within a slot (TODO: no-repeat). Two rounds
 * with the same signature pose the same task even if the distractors differ.
 */
export function roundSignature(round: Round): string {
  switch (round.kind) {
    case 'count':
      return `count:${round.count}`;
    case 'match':
      return `match:${round.left.map((it) => it.token).sort().join(',')}`;
    case 'hear':
      return `hear:${round.target.token}`;
    case 'order':
      return `order:${round.sequence.map((it) => it.token).join(',')}`;
    case 'whats_next':
      return `wn:${round.answer.token}`;
  }
}

function generateRound(state: GameState, pool: DeckItem[], rng: () => number): Round {
  switch (currentLevelType(state)) {
    case 'count':
      return countRound(state, pool, rng);
    case 'match':
      return matchRound(state, pool, rng);
    case 'hear':
      return hearRound(state, pool, rng);
    case 'order':
      return orderRound(state, pool, rng);
    case 'whats_next':
      return whatsNextRound(state, pool, rng);
  }
}

/**
 * Generate the round for the current slot/tier. Pure; rng injectable. Pass the
 * previous round so the same question is not repeated back-to-back — we
 * regenerate up to MAX_REGEN_TRIES times to land on a different signature.
 */
export function nextRound(state: GameState, rng: () => number = Math.random, prev?: Round): Round {
  const pool = poolForState(state);
  const avoid = prev ? roundSignature(prev) : null;
  let round = generateRound(state, pool, rng);
  for (let i = 0; avoid !== null && i < MAX_REGEN_TRIES && roundSignature(round) === avoid; i += 1) {
    round = generateRound(state, pool, rng);
  }
  return round;
}

function withDistractors(answer: DeckItem, pool: DeckItem[], rng: () => number): DeckItem[] {
  const others = pool.filter((it) => it.token !== answer.token);
  const distractors = sample(others, CHOICES - 1, rng);
  return shuffleWith([answer, ...distractors], rng);
}

function countRound(state: GameState, pool: DeckItem[], rng: () => number): CountRound {
  // Count is numbers-only; objects are capped regardless of tier.
  const maxValue = Math.min(COUNT_MAX + diffStep(state), pool.length);
  const count = 1 + Math.floor(rng() * maxValue);
  const answer = state.itemsByToken[`n${count}`]!;
  return {
    kind: 'count',
    count,
    objectGlyph: COUNT_OBJECT,
    answer,
    choices: withDistractors(answer, pool, rng),
  };
}

function matchRound(state: GameState, pool: DeckItem[], rng: () => number): MatchRound {
  const left = sample(pool, SEQUENCE_LEN, rng);
  const round: MatchRound = { kind: 'match', left, right: shuffleWith(left, rng) };

  // Letters track: populate icon hints from the vocabulary dataset.
  // Numbers track (count slot) uses glyph-only matching — skip icons.
  if (state.track === 'letters') {
    const icons = new Map<string, string>();
    for (const item of left) {
      const entry = LETTER_VOCAB[item.token];
      if (entry?.emoji) icons.set(item.token, entry.emoji);
    }
    round.icons = icons;
  }

  return round;
}

function hearRound(state: GameState, pool: DeckItem[], rng: () => number): HearRound {
  const target = pickOne(pool, rng);
  return {
    kind: 'hear',
    target,
    choices: withDistractors(target, pool, rng),
    timeLimit: timeLimitForState(state),
    fallSpeedMult: fallSpeedMultiplier(state),
  };
}

function orderRound(state: GameState, pool: DeckItem[], rng: () => number): OrderRound {
  const seqLen = orderSequenceLength(state);
  const chosen = sample(pool, Math.min(seqLen, pool.length), rng);
  // Restore deck order (pool is already ordered) for the correct sequence.
  const order = new Map(pool.map((it, i) => [it.token, i]));
  const sequence = [...chosen].sort((a, b) => order.get(a.token)! - order.get(b.token)!);
  let shown = shuffleWith(sequence, rng);
  // Avoid handing back an already-sorted "shuffle".
  if (sequence.length > 1 && shown.every((it, i) => it.token === sequence[i]!.token)) {
    shown = [...sequence].reverse();
  }
  return { kind: 'order', sequence, shown };
}

function whatsNextRound(state: GameState, pool: DeckItem[], rng: () => number): WhatsNextRound {
  // A run of consecutive items, then pick the next. Shorten the prefix if the
  // tier pool is too small to show SEQUENCE_LEN and still have a successor.
  const prefixLen = Math.min(SEQUENCE_LEN, pool.length - 1);
  const maxStart = pool.length - prefixLen - 1;
  const start = Math.floor(rng() * (maxStart + 1));
  const prefix = pool.slice(start, start + prefixLen);
  const answer = pool[start + prefixLen]!;
  const others = pool.filter((it) => !prefix.includes(it) && it.token !== answer.token);
  const choices = shuffleWith([answer, ...sample(others, CHOICES - 1, rng)], rng);
  return { kind: 'whats_next', prefix, answer, choices, timeLimit: timeLimitForState(state) };
}
