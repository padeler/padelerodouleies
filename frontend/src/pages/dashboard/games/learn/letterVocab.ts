/**
 * Vocabulary dataset for Greek letter icon matching.
 *
 * The raw data — a per-letter *pool* of ≈10 word+icon entries — lives in the
 * generated `letterVocabData.ts` (authored in `exercise_lab/tools/gen_learn_icons.py`,
 * regenerate with `python exercise_lab/tools/gen_learn_icons.py emit`). Each
 * entry has a stable `id` (spoken-word TTS key + PNG filename stem), a Greek
 * `word` starting with that letter, and an icon: either an old-tablet-safe emoji
 * (Unicode ≤6.1, renders on Android 4.4 KitKat) or a generated PNG under
 * `/learn-icons/`. The many entries per letter give the matching game its
 * variety/replayability (the engine picks a random one per round).
 *
 * The spoken words are mirrored server-side in `LETTER_VOCAB_WORDS`
 * (backend/app/services/learn_vocab.py, also generated) which drives the per-word
 * TTS endpoint — both files come from the same master table, so regenerate both.
 *
 * `LETTER_VOCAB` / `LETTER_VOCAB_EXTRA` are derived views (pool index 0 / 1) kept
 * for the spell + starts-with falling-targets variants.
 */

import { LETTER_VOCAB_POOL } from './letterVocabData';

export interface LetterVocabEntry {
  id: string; // stable slug: TTS key + PNG filename stem
  word: string; // Greek word starting with this letter
  emoji?: string; // Unicode <=6.1 emoji representing the word
  image?: string; // bundled PNG icon URL (used where no safe emoji exists)
}

/** The icon for a vocab entry — emoji if present, else the bundled image URL. */
export function vocabIcon(entry: LetterVocabEntry | undefined): string | undefined {
  return entry?.emoji ?? entry?.image;
}

export { LETTER_VOCAB_POOL };

/** Pick a random pool entry for a letter token (rng injectable for tests). */
export function randomVocab(token: string, rng: () => number): LetterVocabEntry | undefined {
  const pool = LETTER_VOCAB_POOL[token];
  if (!pool || pool.length === 0) return undefined;
  return pool[Math.floor(rng() * pool.length)]!;
}

/**
 * Canonical (primary) entry per letter — pool index 0. Drives the spell variant
 * and the starts-with primary picture; a derived map kept for back-compat.
 */
export const LETTER_VOCAB: Record<string, LetterVocabEntry> = Object.fromEntries(
  Object.entries(LETTER_VOCAB_POOL).map(([token, entries]) => [token, entries[0]!]),
);

/**
 * Second curated entry per letter — pool index 1 — the "starts-with" second
 * picture (a genuinely different word sharing the same initial letter). Absent
 * for a letter whose pool has a single entry.
 */
export const LETTER_VOCAB_EXTRA: Record<string, LetterVocabEntry> = Object.fromEntries(
  Object.entries(LETTER_VOCAB_POOL)
    .filter(([, entries]) => entries.length > 1)
    .map(([token, entries]) => [token, entries[1]!]),
);

export interface SpellWordEntry {
  word: string; // Greek word, shown/spoken whole and spelled letter-by-letter
  tokens: string[]; // deck tokens (l01..l24), one per letter, in spelling order
}

/**
 * Curated short (3-5 letter) Greek words for the "spell the word" falling-
 * targets variant (Item B.3): the kid taps letters in order as each is named
 * ("Βρες το γράμμα ..."). Tokens are hand-mapped letter-by-letter — accents
 * and the final-sigma variant are dropped since the deck only carries the 24
 * base letters (Α..Ω). A word is only offered once every one of its tokens is
 * unlocked in the kid's current tier pool (see `eligibleSpellWords` in
 * learnEngine.ts), so easier tiers naturally see only the earlier entries.
 */
export const SPELL_WORDS: SpellWordEntry[] = [
  { word: 'ιδέα', tokens: ['l09', 'l04', 'l05', 'l01'] }, // idea — Α-Ι alphabet
  { word: 'θεά', tokens: ['l08', 'l05', 'l01'] }, // goddess — Α-Ι alphabet
  { word: 'ένα', tokens: ['l05', 'l13', 'l01'] }, // one — needs Ν
  { word: 'μια', tokens: ['l12', 'l09', 'l01'] }, // a/one (fem) — needs Μ
  { word: 'μέλι', tokens: ['l12', 'l05', 'l11', 'l09'] }, // honey — needs Μ, Λ
  { word: 'δέκα', tokens: ['l04', 'l05', 'l10', 'l01'] }, // ten — needs Κ
  { word: 'μαμά', tokens: ['l12', 'l01', 'l12', 'l01'] }, // mom — needs Μ, repeated letters
  { word: 'μήλο', tokens: ['l12', 'l07', 'l11', 'l15'] }, // apple — needs Ο
  { word: 'λαγός', tokens: ['l11', 'l01', 'l03', 'l15', 'l18'] }, // rabbit — needs Σ
  { word: 'γάτα', tokens: ['l03', 'l01', 'l19', 'l01'] }, // cat — needs Τ
  { word: 'τρία', tokens: ['l19', 'l17', 'l09', 'l01'] }, // three — needs Τ, Ρ
  { word: 'πέντε', tokens: ['l16', 'l05', 'l13', 'l19', 'l05'] }, // five — needs Π, Τ
  { word: 'δύο', tokens: ['l04', 'l20', 'l15'] }, // two — needs Υ
  { word: 'φως', tokens: ['l21', 'l24', 'l18'] }, // light — needs Φ, Ω
];
