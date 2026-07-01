# Learning Adventure — Remaining Work Plan

**Branch:** `feat/learn-adventure`
**Date:** 2026-06-30
**State:** Items A + B.1 + B.2 committed. Only B.3 (spell-word, deferred) remains.

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
| B.2 | Multi-target mode ("Click all letter Α") | pending commit | HearVariant + multi-target hearRound generation + HearIt tap handler + removeFaller |

### Open Items

| # | Item | Priority | Deps |
|---|------|----------|------|
| B.3 | Spell-word mode | Low (deferred) | Reverse vocab map, polytonic letter handling |

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

#### Sub-feature B.3: Spell-Word Mode (DEFERRED)

**Rationale:** Requires mapping Greek words → individual letter tokens (e.g., "γάτα" → `[l03, l25, l18, l25]` where l25=ά). This needs a cross-reference between vocab words and deck tokens for each letter in the word. The current `LETTER_VOCAB` maps letter→word, not word→[letters].

**Future approach:**
1. Build a reverse map: `word → [token_for_each_letter]`
2. Extend HearRound with `spellSequence?: string[]` (array of tokens to tap in order)
3. `HearIt.tsx`: show the word as text above canvas, track progress through the sequence
4. Fallers spawn a continuous stream of random letters; kid taps the ones matching the current needed letter

**Estimated effort:** ~100 lines across 4 files. Blocker: reverse vocab map.

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

Phase B.3 (Spell-Word) — Deferred until reverse vocab map is built
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
- Spell-word mode (B.3) deferred — requires additional data structure
- Numbers track icon matching — numbers already have rich visual feedback via counting objects
- Real-time difficulty adjustment beyond the 3-step slot ramp — future work if needed
- Adding new TTS phrases for multi-target/spell modes — reuses existing "find X" prompt and praise phrases

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
