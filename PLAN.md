# Learning Adventure — Remaining Work Plan

**Branch:** `feat/learn-adventure`
**Date:** 2026-07-01
**State:** Items A + B.1 + B.2 + B.2b + B.3 committed. All planned work for the falling-letters engagement variations is done.

---

## Current State (What's Landed)

### Completed Items (TODOs 1–8 + progressive difficulty + Icon Matching + Falling Icons)

| # | Item | Commit | Status |
|---|------|--------|--------|
| 1 | Remove redundant welcome/start screen | landed | Auto-start on audio ready |
| 2 | Fix "Μπράβο!" layout overlap | landed | Reserved emoji box, gentler pop animation |
| 3 | Border around game area | landed | `.learn-board` with accent border |
| 4 | Delay result on last match pair | landed | `FINAL_DELAY_MS = 900` in MatchCase |
| 5 | Delay result on last order placement | landed | `FINAL_DELAY_MS = 900` in PutInOrder |
| 6 | Colorize matched pairs | landed | 6 distinct colors from exercises palette |
| 7 | No-repeat same exercise twice | landed | `roundSignature()` + MAX_REGEN_TRIES regeneration |
| 8 | Subtle speaker icon | landed | Top-right corner, 44px translucent button |
| 9 | Progressive intra-tier difficulty | `042e06f` | Wider counts, faster drops, shorter→longer sequences, less time |
| A | Icon-based letter matching | `d0f5ced` | Vocab dataset + MatchRound.icons + has-icon CSS + fallback |
| B.1 | Emoji icons on falling targets | `7251b18` | Faller.icon + createHearWorld icons map + canvas draw + hearRound population |
| B.2 | Multi-target mode ("Click all letter Α") | `afa707f` | HearVariant + multi-target hearRound generation + HearIt tap handler + removeFaller |
| B.2b | Starts-with mode ("Click all items that start with Β") | pending commit | `LETTER_VOCAB_EXTRA` curated 2nd word/icon per letter + `starts-with` HearVariant + generalized group-target tap handling in HearIt |
| B.3 | Spell-word mode ("Spell γάτα" / "Count to 5") | pending commit | `SPELL_WORDS` curated word→letter-token list + `spell` HearVariant + sequential per-letter dictation in HearIt |

### Open Items

None — all planned Learning Adventure items (A, B.1, B.2, B.2b, B.3) are implemented.

---

## Detailed Implementation Steps

---

### Item A: Matching Letters — Icon-to-Letter Engagement Upgrade

**Goal:** Replace uppercase↔lowercase matching with uppercase letter → emoji icon of a Greek word starting with that letter (e.g., Α → 🐚 for αχινός).

**Why:** Current match case is too simple for the target age group. Adding icons creates meaningful association between letter shape and vocabulary.

#### Step A.1 — Create `letterVocab.ts` (New File)

**Path:** `frontend/src/pages/dashboard/games/learn/letterVocab.ts`

```typescript
interface LetterVocabEntry {
  word: string;     // Greek word starting with this letter
  emoji: string;    // Unicode ≤6.0 emoji representing the word
}
export const LETTER_VOCAB: Record<string, LetterVocabEntry>;
```

**Emoji selection rules:**
- Must be Unicode ≤6.0 (verifiable via `MEMORY_EMOJI_POOL` in `memoryDeck.ts` as baseline)
- Already-safe emojis confirmed on Android 4.4: 🐶🐱🐵🐼🐧🐸🐙🐝🚀🍕🎈⚽🌈🍦🐢🐬⭐💩🍎🐹
- Additional verified 6.0: 🐚📕💍🐘☀️🐍🦐🐟🌳🐰🐕🚂🍓

**Vocabulary dataset (from textbook notes, `exercise_lab/notes/Α_ΤΑΞΗ_ΔΗΜΟΤΙΚΟΥ/glossa/`):**

| Token | Letter | Word | Emoji | Safe? |
|-------|--------|------|-------|-------|
| l01 | Α α | αχινός | 🐚 | ✓ 6.0 |
| l02 | Β β | βιβλίο | 📕 | ✓ 6.0 |
| l03 | Γ γ | γάτα | 🐱 | ✓ 6.0 |
| l04 | Δ δ | δαχτυλίδι | 💍 | ✓ 6.0 |
| l05 | Ε ε | ελέφαντας | 🐘 | ✓ 6.0 |
| l06 | Ζ ζ | ζέστα | ☀️ | ✓ 6.0 |
| l07 | Η η | — | (empty) | fallback to glyph |
| l08 | Θ θ | — | (empty) | fallback to glyph |
| l09 | Ι ι | — | (empty) | fallback to glyph |
| l10 | Κ κ | κήπος | 🌳 | ✓ 6.0 |
| l11 | Λ λ | λαγός | 🐰 | ✓ 6.0 |
| l12 | Μ μ | μπάλα | ⚽ | ✓ 6.0 |
| l13 | Ν ν | — | (empty) | fallback to glyph |
| l14 | Ξ ξ | — | (empty) | fallback to glyph |
| l15 | Ο ο | οχιά | 🐍 | ✓ 6.0 |
| l16 | Π π | — | (empty) | fallback to glyph |
| l17 | Ρ ρ | — | (empty) | fallback to glyph |
| l18 | Σ σ | σκύλος | 🐕 | ✓ 6.0 |
| l19 | Τ τ | τρένο | 🚂 | ✓ 6.0 |
| l20 | Υ υ | — | (empty) | fallback to glyph |
| l21 | Φ φ | φράουλα | 🍓 | ✓ 6.0 |
| l22 | Χ χ | χαρίδα | 🦐 | ✓ 6.0 |
| l23 | Ψ ψ | ψάρι | 🐟 | ✓ 6.0 |
| l24 | Ω ω | — | (empty) | fallback to glyph |

> ~15 of 24 letters get icons; the rest fall back gracefully to lowercase glyphs.

#### Step A.2 — Extend `MatchRound` in `learnEngine.ts`

Add optional icon map:
```typescript
export interface MatchRound {
  kind: 'match';
  left: DeckItem[];
  right: DeckItem[];
  icons?: Map<string, string>;  // token → emoji; undefined = no icons
}
```

Update `matchRound()` generator to import vocab and populate icons for tokens that have entries. For `count` track (numbers), skip icon matching — numbers use glyph only.

#### Step A.3 — Update `MatchCase.tsx` Right Column Rendering

When `round.icons?.get(item.token)` returns a non-empty string, render the emoji instead of `item.glyph_alt`. Add conditional `.has-icon` CSS class for font-size adjustment (emoji glyphs differ from Greek text in ascent/descent).

#### Step A.4 — Update `LearnAdventure.css`

Add `.learn-match-tile.has-icon { font-size: 32px; }` to keep emoji centered in the tile.

#### Step A.5 — Add Tests

- `learnEngine.test.ts`: verify match rounds carry icons for tokens with vocab entries
- `learnPlayers.test.tsx`: update MatchCase test fixtures with icon Map

**Total impact:** ~80 lines across 5 files. No backend changes.

---

### Item B: Falling Letters — Engagement Variations

**Goal:** Make the Hear It (falling targets) level more engaging through three progressive sub-features.

#### Sub-feature B.1: Draw Icons Alongside Glyphs on Fallers

**Prerequisite:** `letterVocab.ts` from Step A.1.

##### Step B.1.1 — Add `icon?: string` to `Faller` in `hearEngine.ts`

The faller shape already carries `(x, y, token, glyph)`. Add optional icon field.

##### Step B.1.2 — Pass Icon Map Through `createHearWorld`

Extend signature:
```typescript
export function createHearWorld(
  choices: HearChoice[],
  rng: () => number = Math.random,
  speedMult: number = 1.0,
  icons?: Map<string, string>,  // token → emoji; undefined = no icons
): HearWorld
```

##### Step B.1.3 — Update `HearIt.tsx` Draw Function

In the canvas render loop, when a faller has `icon`, draw it above the circle at `(faller.x, faller.y - FALLER_R - 14)` using `ctx.font = '24px sans-serif'` and `ctx.fillText(icon, ...)`.

##### Step B.1.4 — Update `learnEngine.ts` hearRound generator

Build icon map from vocab for the current pool items:
```typescript
const icons = new Map<string, string>();
for (const item of round.choices) {
  const entry = LETTER_VOCAB[item.token];
  if (entry?.emoji) icons.set(item.token, entry.emoji);
}
```

**Total impact:** ~30 lines across 3 files. Ships after Item A is merged.

---

#### Sub-feature B.2: Multi-Target Mode ("Click All Letter Α") — Implemented

Actual implementation deviates slightly from the sketch below: `HearIt.tsx` derives
the remaining-target count straight from `worldRef` (no separate counter needed)
and shows it as a small badge; a correct-but-not-final tap draws a short green
pulse at the tap point (canvas-drawn, not a faller recolour) since the tapped
faller is removed immediately via the new `hearEngine.removeFaller`.

##### Step B.2.1 — Add `HearVariant` to HearRound in `learnEngine.ts`

```typescript
export type HearVariant = 'single' | 'multi-target';
export interface HearRound {
  // ... existing fields
  variant?: HearVariant;  // defaults to 'single'
}
```

##### Step B.2.2 — Generate Multi-Target Rounds at Higher Tiers

In `hearRound()` generator:
- When `tierIndex >= 2` AND `diffStep(state) >= 1`, randomly spawn extra copies of the target glyph in the choices pool (2–3 additional tokens sharing the same glyph as the target).
- Set `variant = 'multi-target'`.

##### Step B.2.3 — Update `HearIt.tsx` Tap Handler for Multi-Target

Current behavior: one tap → resolve → result panel. Multi-target requires:
1. Track which faller tokens are targets (same glyph as round target).
2. On correct tap: remove the faller from the world, highlight green, decrement remaining count.
3. On wrong tap: resolve immediately (cost life).
4. When all target fallers are cleared: resolve as correct.

This state lives in `HearIt.tsx` refs (consistent with existing pattern where components own input/grading).

##### Step B.2.4 — Add Tests

- hearEngine.test.ts: verify multi-target faller pool setup
- learnPlayers.test.tsx: mock HearIt with multi-target round, verify multiple taps needed

**Total impact:** ~60 lines across 3 files.

---

#### Sub-feature B.2b: Starts-With Mode ("Click All Items That Start With Β") — Implemented

**Goal:** A third Hear It variant where the kid finds every falling icon whose
*word* begins with the spoken target letter, instead of every faller repeating
the same glyph. Reinforces letter→initial-sound recognition via genuinely
different pictures, not a repeated icon.

**Why a design decision was needed:** `LETTER_VOCAB` (Item A) maps each letter
to exactly *one* word/icon, so there was no second icon to offer as a match for
the same initial letter. Scope (which letters get a second curated word) was
confirmed with the user rather than guessed — the recommended "only letters
with 2+ safe words" option was chosen over covering all 24 letters or skipping
the variant.

##### Step B.2b.1 — Add `LETTER_VOCAB_EXTRA` in `letterVocab.ts`

A second curated `{ word, emoji }` per letter, only for letters where a safe
(Unicode ≤6.1) second icon exists — sourced from the same textbook notes as
`LETTER_VOCAB` (`exercise_lab/notes/Α_ΤΑΞΗ_ΔΗΜΟΤΙΚΟΥ/glossa/`) where available.
13 of the 24 letters qualify (Α,Β,Γ,Δ,Κ,Λ,Μ,Ο,Σ,Τ,Φ,Χ,Ψ); the rest are simply
never picked as a starts-with target.

##### Step B.2b.2 — Add `'starts-with'` to `HearVariant` + `startsWithTokens` to `HearRound`

```typescript
export type HearVariant = 'single' | 'multi-target' | 'starts-with';
export interface HearRound {
  // ... existing fields
  startsWithTokens?: string[]; // synthetic extra tokens that also count as correct
}
```

##### Step B.2b.3 — Generate Starts-With Rounds in `hearRound()`

- Eligible targets are pool letters with both a `LETTER_VOCAB` and a
  `LETTER_VOCAB_EXTRA` icon (`eligibleStartsWithTargets`) — letters track only,
  gated behind the same harder-tier check as multi-target
  (renamed `isMultiTargetHear` → `isHarderHearTier` since it now gates both).
- When eligible, a 50/50 roll (`rng() < 0.5`) picks starts-with over
  multi-target. The extra word gets a synthetic token (`${token}#starts-with`,
  same glyph as the real letter, its own icon) so it can ride alongside the
  real deck token in `choices`/`icons` without colliding with it.
- 2 other-letter distractors (each with their own real icon) fill out the pool.

##### Step B.2b.4 — Generalize `HearIt.tsx` Tap/Miss/Highlight Logic

The existing multi-target logic hardcoded `hit.token === round.target.token`
in four places (resolve/tick/draw/onTap). Generalized all four to a
`targetTokens = new Set([target.token, ...startsWithTokens])` check
(`isGroupTarget = variant === 'multi-target' || variant === 'starts-with'`) so
both variants share one code path — including the miss case (any required
token, not just the literal target, hitting the floor is a miss).

##### Step B.2b.5 — Add Tests

- `learnEngine.test.ts`: starts-with round has 2 distinct icons + is letters-only
- `learnPlayers.test.tsx`: mirrors the multi-target describe block — needs both
  the target and the extra word tapped; a same-letter distractor pick resolves wrong

**Verified live** (temporarily forcing the harder-tier gate on): the multi-target
render/miss path was unaffected by the generalization, and the starts-with
variant renders its `×2` badge and correct miss messaging as expected. Tapping
a moving canvas target via browser automation was too slow/flaky to catch a
live correct-tap; that path is covered deterministically by the component tests
instead (mocked `Math.random` fixes faller layout).

**Total impact:** ~110 lines across 4 files (`letterVocab.ts`, `learnEngine.ts`, `HearIt.tsx`, plus tests).

---

#### Sub-feature B.3: Spell-Word Mode — Implemented

**Goal:** A fourth Hear It variant where the kid taps a *sequence* of fallers in
order, one dictation prompt per step: letters spells a curated short word
("Βρες το γράμμα γάμμα." → tap Γ → "Βρες το γράμμα άλφα." → tap Α → ...);
numbers counts up from one ("Βρες τον αριθμό ένα." → tap 1 → "Βρες τον αριθμό
δύο." → tap 2 → ...).

**Why the original "reverse vocab map" plan was replaced:** the deferred
approach called for deriving a word's letters generically (stripping tonos
accents from arbitrary `LETTER_VOCAB` words, which run up to 10 letters and
aren't length-bounded for playability). Instead, `SPELL_WORDS` in
`letterVocab.ts` is a small **curated** list of short (3-5 letter) Greek
words, each hand-mapped letter-by-letter to deck tokens — no generic
accent-stripping code, consistent with how `LETTER_VOCAB_EXTRA` (B.2b) is
already curated rather than derived. A word is only offered once every one of
its tokens is unlocked in the kid's current tier pool
(`eligibleSpellWords`), so easier tiers only ever see the earlier, shorter
entries (e.g. `ιδέα`/`θεά` at tier 1).

**Why per-letter dictation instead of "show the word as text":** re-prompting
with the existing "find X" phrase for whichever letter/number is next reuses
`find_tts` as-is (no new backend TTS phrases, per the original non-goal) and
turns spelling into a genuine listen-then-tap dictation exercise rather than
a copy-the-glyphs-you-can-see task.

##### Step B.3.1 — Add `SPELL_WORDS` in `letterVocab.ts`

`{ word: string; tokens: string[] }[]` — 14 curated words spanning all four
letter tiers (Α-Ι through Α-Ω), including one with a repeated letter
("μαμά") to exercise duplicate-token handling.

##### Step B.3.2 — Add `'spell'` to `HearVariant` + `spellSequence` to `HearRound`

```typescript
export type HearVariant = 'single' | 'multi-target' | 'starts-with' | 'spell';
export interface HearRound {
  // ... existing fields
  spellSequence?: string[]; // ordered tokens the kid must tap in sequence
}
```

##### Step B.3.3 — Generate Spell Rounds in `hearRound()`

- `eligibleSpellWords(pool)` filters `SPELL_WORDS` to those whose every token
  is present in the pool; `spellSequenceForTrack` picks one (letters) or
  builds `n1..nN` for a random `N` in 3..5 (numbers — always eligible, since
  every tier starts at n1).
- The three "harder" variants (starts-with, spell, multi-target) share one
  rng roll each round: starts-with gets 1/3, spell gets half of what's left
  (another 1/3 overall), multi-target is the default fallback — mirrors the
  original 50/50 starts-with-vs-multi-target roll from B.2b, now split three
  ways with each check short-circuiting when its variant isn't eligible.
- `choices` = one faller per sequence token (duplicates included, e.g. two
  'Α' fallers for "μαμά") + 2 distractors whose tokens are constructed to be
  disjoint from the sequence — this lets the component tell a required
  faller apart from a distractor by token alone, even with repeated letters.

##### Step B.3.4 — Add Sequential Tap Handling to `HearIt.tsx`

A `nextSpellIndexRef` tracks progress through `spellSequence`. On tap: a
token match at the current index removes that faller, advances the index,
and re-prompts via `playFind` for the next token (or resolves correct if the
sequence is exhausted); any other tap (wrong letter, or the right letter out
of order) resolves wrong immediately. A required faller reaching the floor
before its turn is also a miss. The existing group-target machinery
(`isGroupTarget`'s freeze/highlight/pulse/remaining-badge code) is
generalized via a new `isRequiredToken`/`isCorrectPick` pair so spell shares
the same freeze-frame highlight and `×N` remaining badge instead of
duplicating that UI.

##### Step B.3.5 — Add Tests

- `learnEngine.test.ts`: letters spell round is a curated word tapped in
  order; numbers spell round is `n1..nN` ascending; spell never fires below
  the harder-tier threshold.
- `learnPlayers.test.tsx`: mirrors the multi-target/starts-with describe
  blocks — a 4-letter word (with a repeated letter) needs all four taps in
  the right order before resolving correct, with `playFind` re-prompting
  after each step; an out-of-order tap resolves wrong immediately.

**Total impact:** ~180 lines across 4 files (`letterVocab.ts`, `learnEngine.ts`,
`HearIt.tsx`, plus tests) — no backend or CSS changes (reuses the existing
`.learn-hear-remaining` badge and `find_tts`/`wrong_tts` phrases).

---

## Implementation Order

```
Phase A (Icon Matching) — Ships standalone
├── A.1: Create letterVocab.ts
├── A.2: Extend MatchRound.icons
├── A.3: Update MatchCase rendering
├── A.4: CSS adjustments
└── A.5: Tests

Phase B.1 (Falling Icons) — Depends on Phase A vocab
├── B.1.1: Add icon to Faller type
├── B.1.2: Pass icon map through createHearWorld
├── B.1.3: Draw icons in HearIt canvas
├── B.1.4: Update hearRound generator
└── Tests

Phase B.2 (Multi-Target) — Depends on Phase A + B.1
├── B.2.1: Add HearVariant enum
├── B.2.2: Generate multi-target at higher tiers
├── B.2.3: Update HearIt tap handler
└── Tests

Phase B.2b (Starts-With) — Depends on Phase A + B.1 + B.2
├── B.2b.1: Add LETTER_VOCAB_EXTRA (curated 2nd word/icon per eligible letter)
├── B.2b.2: Add 'starts-with' HearVariant + startsWithTokens
├── B.2b.3: Generate starts-with rounds at higher tiers (letters only)
├── B.2b.4: Generalize HearIt tap/miss/highlight to a target-token set
└── Tests

Phase B.3 (Spell-Word) — Depends on Phase A + B.1 + B.2 + B.2b
├── B.3.1: Add SPELL_WORDS (curated short word → letter-token sequence)
├── B.3.2: Add 'spell' HearVariant + spellSequence
├── B.3.3: Generate spell rounds at higher tiers (both tracks)
├── B.3.4: Sequential ordered-tap handling in HearIt (nextSpellIndexRef)
└── Tests
```

---

## Constraints & Non-Goals

### Constraints
- **Emoji Unicode ≤6.0 only** — Android 4.4 KitKat emoji font coverage limit. Any emoji above this renders as tofu boxes. Verify against `memoryDeck.ts` pool + Canvas `fillText` test if unsure.
- **Old-tablet CSS rules** — No `aspect-ratio`, `inset`, flex-gap. Transform/opacity transitions only. `touch-action: none` on canvases.
- **Pure engine pattern** — `learnEngine.ts` and `hearEngine.ts` must remain DOM-free, timer-free, side-effect-free. Game mode state tracking lives in components.
- **Single-channel audio** — A new clip stops the current one. No overlapping speech.
- **No backend changes** — All vocabulary data is frontend-only; API shapes unchanged.

### Non-Goals
- Numbers track icon matching — numbers already have rich visual feedback via counting objects
- Real-time difficulty adjustment beyond the 3-step slot ramp — future work if needed
- Adding new TTS phrases for multi-target/starts-with/spell modes — reuses existing "find X" prompt and praise phrases

---

## File Inventory

### Files Created
| File | Phase | Purpose |
|------|-------|---------|
| `frontend/.../learn/letterVocab.ts` | A.1 | Greek letter→word→emoji vocabulary dataset |

### Files Modified (Phase A)
| File | Lines | Change |
|------|-------|--------|
| `learnEngine.ts` | ~20 | MatchRound.icons field, import vocab, populate in matchRound() |
| `MatchCase.tsx` | ~10 | Render emoji when available from icons map |
| `LearnAdventure.css` | ~5 | `.has-icon` tile class for emoji sizing |
| `learnEngine.test.ts` | ~10 | Match round icon assertions |
| `learnPlayers.test.tsx` | ~5 | Update MatchCase fixtures with icons |

### Files Modified (Phase B.1)
| File | Lines | Change |
|------|-------|--------|
| `hearEngine.ts` | ~10 | Faller.icon field, icon map in createHearWorld |
| `HearIt.tsx` | ~15 | Draw emoji icons above faller circles |
| `learnEngine.ts` | ~10 | Build icon map from vocab in hearRound() |
| `hearEngine.test.ts` | ~10 | Icon attachment tests |

### Files Modified (Phase B.2)
| File | Lines | Change |
|------|-------|--------|
| `learnEngine.ts` | ~15 | HearVariant type, multi-target generation logic |
| `HearIt.tsx` | ~40 | Multi-target state tracking in refs, modified tap handler |
| `learnPlayers.test.tsx` | ~15 | Multi-target HearIt test |

### Files Modified (Phase B.2b)
| File | Lines | Change |
|------|-------|--------|
| `letterVocab.ts` | ~20 | `LETTER_VOCAB_EXTRA` — curated 2nd word/icon for 13 eligible letters |
| `learnEngine.ts` | ~50 | `'starts-with'` HearVariant, `startsWithTokens`, `eligibleStartsWithTargets`, rewritten `hearRound()` |
| `HearIt.tsx` | ~15 | Generalized target-token-set check (was hardcoded to `multi-target`) across resolve/tick/draw/onTap |
| `learnEngine.test.ts` | ~25 | Starts-with round generation + letters-only assertions |
| `learnPlayers.test.tsx` | ~55 | Starts-with HearIt describe block mirroring multi-target's |

### Files Modified (Phase B.3)
| File | Lines | Change |
|------|-------|--------|
| `letterVocab.ts` | ~35 | `SpellWordEntry` type + `SPELL_WORDS` — 14 curated short words, hand-mapped to letter tokens |
| `learnEngine.ts` | ~50 | `'spell'` HearVariant, `spellSequence`, `eligibleSpellWords`, `spellSequenceForTrack`, rewritten `hearRound()` 3-way variant roll, signature update |
| `HearIt.tsx` | ~40 | `nextSpellIndexRef`, `isRequiredToken`/`isCorrectPick` helpers generalizing the freeze/highlight logic, ordered tap handling, re-prompting `playFind` per step |
| `learnEngine.test.ts` | ~40 | Letters spell round is a curated word in order; numbers spell round counts up; threshold gating |
| `learnPlayers.test.tsx` | ~65 | Spell HearIt describe block — in-order taps with re-prompts, out-of-order tap fails immediately |
