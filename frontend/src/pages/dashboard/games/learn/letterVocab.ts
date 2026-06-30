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
