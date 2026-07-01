/**
 * Vocabulary dataset for Greek letter icon matching.
 *
 * Maps each of the 24 letter tokens (l01..l24) to a Greek word starting with
 * that letter and an optional emoji representation. ~15 letters carry a safe
 * emoji (Unicode <=6.0, verified on Android 4.4 KitKat); the rest fall back
 * gracefully to lowercase glyph rendering.
 *
 * Used by the match-level engine (Item A) to populate icon hints and by the
 * falling-targets level (Item B) to draw icons alongside glyphs.
 */

interface LetterVocabEntry {
  word: string; // Greek word starting with this letter
  emoji?: string; // Unicode <=6.0 emoji representing the word; optional fallback
}

/**
 * Vocabulary lookup keyed by deck token (l01..l24).
 * Derived from textbook notes under exercise_lab/notes/A_TACHY_DIMOTIKOU/glossa/.
 */
export const LETTER_VOCAB: Record<string, LetterVocabEntry> = {
  l01: { emoji: '\u{1F41A}', word: 'αχινός' },         // 🐚 sea urchin (6.0)
  l02: { emoji: '\u{1F4D6}', word: 'βιβλίο' },        // 📕 book (6.0)
  l03: { emoji: '\u{1F431}', word: 'γάτα' },          // 🐱 cat (5.0)
  l04: { emoji: '\u{1F48D}', word: 'δαχτυλίδι' },     // 💍 ring (6.0)
  l05: { emoji: '\u{1F418}', word: 'ελέφαντας' },     // 🐘 elephant (6.0)
  l06: { emoji: '☀', word: 'ζέστα' },            // ☀ sun (base ≤4.0)
  l07: { word: 'ήτα' },                               // Η — no icon fallback
  l08: { word: 'θήτα' },                              // Θ — no icon fallback
  l09: { word: 'γιώτα' },                             // Ι — no icon fallback
  l10: { emoji: '\u{1F333}', word: 'κήπος' },         // 🌳 tree (6.0)
  l11: { emoji: '\u{1F430}', word: 'λαγός' },         // 🐰 rabbit (6.0)
  l12: { emoji: '⚽', word: 'μπάλα' },           // ⚽ ball (in safe pool)
  l13: { word: 'νι' },                                // Ν — no icon fallback
  l14: { word: 'ξι' },                                // Ξ — no icon fallback
  l15: { emoji: '\u{1F40D}', word: 'οχιά' },          // 🐍 snake (6.0)
  l16: { word: 'πι' },                                // Π — no icon fallback
  l17: { word: 'ρο' },                                // Ρ — no icon fallback
  l18: { emoji: '\u{1F415}', word: 'σκύλος' },        // 🐕 dog (6.0)
  l19: { emoji: '\u{1F682}', word: 'τρένο' },         // 🚂 train (6.0)
  l20: { word: 'ύψιλον' },                            // Υ — no icon fallback
  l21: { emoji: '\u{1F353}', word: 'φράουλα' },       // 🍓 strawberry (6.0)
  l22: { emoji: '\u{1F990}', word: 'χαρίδα' },        // 🦐 shrimp (6.0)
  l23: { emoji: '\u{1F41F}', word: 'ψάρι' },          // 🐟 fish (6.0)
  l24: { word: 'ωμέγα' },                             // Ω — no icon fallback
};

/**
 * A second curated word (+ icon) for letters where a second safe, age-
 * appropriate emoji exists — only these letters can be the target of the
 * "starts-with" falling-targets variant (Item B), which needs two genuinely
 * different pictures sharing one initial letter, not a repeated one. Words are
 * drawn from the same textbook notes as LETTER_VOCAB where available.
 */
export const LETTER_VOCAB_EXTRA: Record<string, LetterVocabEntry> = {
  l01: { emoji: '\u{1F43B}', word: 'αρκούδα' },        // 🐻 bear (6.0)
  l02: { emoji: '\u{26F5}', word: 'βάρκα' },           // ⛵ boat (5.2)
  l03: { emoji: '\u{1F437}', word: 'γουρούνι' },       // 🐷 pig (6.0)
  l04: { emoji: '\u{1F409}', word: 'δράκος' },         // 🐉 dragon (6.0)
  l10: { emoji: '\u{1F414}', word: 'κότα' },           // 🐔 chicken (6.0)
  l11: { emoji: '\u{1F338}', word: 'λουλούδι' },       // 🌸 flower (6.0)
  l12: { emoji: '\u{1F34C}', word: 'μπανάνα' },        // 🍌 banana (6.0)
  l15: { emoji: '\u{2602}', word: 'ομπρέλα' },         // ☂ umbrella (1.1)
  l18: { emoji: '\u{1F3E0}', word: 'σπίτι' },          // 🏠 house (6.0)
  l19: { emoji: '\u{260E}', word: 'τηλέφωνο' },        // ☎ telephone (1.1)
  l21: { emoji: '\u{1F319}', word: 'φεγγάρι' },        // 🌙 moon (6.0)
  l22: { emoji: '\u{1F422}', word: 'χελώνα' },         // 🐢 turtle (6.0)
  l23: { emoji: '\u{2702}', word: 'ψαλίδι' },          // ✂ scissors (1.1)
};

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
