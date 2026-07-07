# TODOs

# Features / Bugs

## Learning Adventure review (branch `fix/learn-adventure-bugs`, 2026-07-06)

Bugs found reviewing the Number/Letter Adventure games, focused on the falling
(Hear It) and matching (Match Case) levels.

### Fixed

- [x] **Match/Order: wrong-tap red flash was never visible.** `MatchCase` and
  `PutInOrder` reported a wrong answer synchronously, so the shell swapped in the
  result panel before the tile's `wrong` styling (and the tapped letter's audio)
  could be seen/heard. Both now hold the board for a 900ms beat (input locked)
  before reporting.
- [x] **Falling: taps could hit invisible fallers above the canvas.**
  `fallerAt` hit-tested the staggered fallers still above the top edge — a tap
  near the top could "pick" a faller the kid couldn't see and cost a life.
  Off-screen fallers are now excluded from hit-testing.
- [x] **Falling: spell rounds overcrowded the canvas.** A 5-letter spell word +
  2 distractors = 7 fallers in 6 columns' worth of space → overlapping circles
  and ambiguous taps. Total fallers are now capped (`MAX_HEAR_FALLERS = 6`);
  long words drop to a single distractor.
- [x] **Falling: 2-3 digit numbers overflowed the faller circle.** Glyphs like
  "100" were drawn at the fixed 36px font. Font now scales down (36/30/22px for
  1/2/3 chars).
- [x] **Falling: on a timeout miss, nothing was highlighted.** The missed faller
  was removed by the simulation step before the freeze, so the kid never saw
  which one was right. The freeze now keeps the pre-step world, leaving the
  missed faller visible (green) at the bottom edge.
- [x] **Counting: distractors could be absurdly far off.** At higher tiers the
  numeral choices were sampled from the whole pool (e.g. 87 next to 5), so the
  kid could pick by size instead of counting. Distractors now stay within ±3 of
  the real count.
- [x] **Vocab dataset content bugs:** 🦐 (`χαρίδα`) is Unicode 9.0 — renders as
  a tofu box on the Tab 4 tablets — *and* a misspelling (γαρίδα starts with γ,
  not χ) → replaced with 🐙 `χταπόδι`; 🐚 (spiral shell) did not depict
  `αχινός` → replaced with ✈ `αεροπλάνο`; `ζέστα` (typo) → 🎲 `ζάρι`.
- [x] **Matching: 9 letters had no icon** (Η Θ Ι Ν Ξ Π Ρ Υ Ω fell back to plain
  lowercase glyphs and could never be starts-with targets). Filled with safe
  emoji where one exists (☀ ήλιος, 🌊 θάλασσα, 💧 νερό, 🍦 παγωτό, ⏰ ρολόι) and
  ComfyUI-generated PNG icons for the rest (ιπποπόταμος, ξυλόφωνο, υποβρύχιο,
  ωκεανός) under `frontend/public/learn-icons/`; `MatchCase` and the falling
  level render image icons alongside emoji.
- [x] **Matching: icon tiles spoke the letter name, not the word.** Tapping 🐱
  played "γάμμα" — confusing for the picture-matching the level teaches. New
  backend endpoint `GET /api/games/learn/letters/word/{token}.mp3` (words in
  `LETTER_WORDS`, warmed at startup) + `playWord` on the client; icon tiles now
  speak the vocabulary word ("γάτα").

### Open / follow-ups

- [ ] **In-browser playthrough of the fixes is pending** (session wrapped up
  mid-verification): play both adventures — especially tier 3+ hear variants
  (multi-target / starts-with / spell), the match icon tiles (new PNG icons +
  spoken words), and dark mode on the image icons. All 250 frontend + 260
  backend tests pass and the production build is green.

- [x] **Multi-target falling rounds now speak a "find them all" prompt.** New
  `find_all_tts` ("Βρες όλα τα πέντε!") + `GET /api/games/learn/{track}/find-all/{token}.mp3`,
  warmed at startup; frontend `playFindAll`, used by `HearIt` for the
  `multi-target` variant (entry prompt + replay button). Spell keeps its
  per-step dictation prompt (still an option to add a "spell the word" intro).
- [x] `games.learn.match_prompt` now says "Ταίριαξε γράμμα και εικόνα" (the
  right column is always pictures since every letter has an icon), and the
  spoken `LEVEL_INTROS["match"]` was updated to match ("Ταίριαξε το γράμμα με
  τη σωστή εικόνα.").
- [x] What-comes-next distractors now come from a near window around the answer
  in deck order (`prefixLen + CHOICES - 1`), with a pool-wide fallback only for
  tiny pools — same idea as the counting ±3 fix.
- [ ] LETTER_WORDS (backend) duplicates letterVocab.ts words — consider serving
  the vocab (word + icon) from the deck API so there is a single source.

## Aesthetics pass (2026-07-07, same branch)

- [x] **Double-tap race in the single-answer levels:** two taps landing before
  the choice grid re-rendered disabled could schedule two graded answers in
  `useDelayedAnswer` — now guarded by a submitted ref.
- [x] Count Them varies the counted object per round (⭐🍎🌸🎈🍓🐠🐤🎀, all
  ≤ Unicode 6.1) with a staggered pop-in cascade that invites counting in
  order; `fb_count_was` text is object-neutral now ("Ήταν {count}!").
- [x] Falling bubbles use a per-faller colour palette instead of uniform
  purple; on the frozen result frame, bystander fallers dim to grey so the
  green/red highlight pair pops. Canvas got a subtle CSS gradient sky.
- [x] Choice/order tiles get rotating pink/purple/blue/orange borders; the
  level name renders as a pill chip; the wrong-answer panel shows a gentle 🙈.
  The match tiles are deliberately excluded from the border rainbow: there
  colour means "linked pair", and a first playthrough showed the positional
  colours falsely implying left/right tiles with the same border were pairs.
- [x] **Star mascot** (`frontend/public/learn-icons/mascot.png`, ComfyUI-
  generated like the letter icons, background removed + quantized to 12KB)
  greets the kid on the spoken-intro pause ("Έτοιμοι;") and the game-over
  panel.
- [x] In-browser playthrough done (2026-07-07): match icon tiles + new prompt,
  count variety/cascade, win auto-advance, wrong panel + 🙈, hearts, game-over
  mascot, multi-coloured fallers all verified via Playwright. Note: HUD "Ρεκόρ"
  shows the tier-weighted best (e.g. 1036) next to raw "Πόντοι" — documented
  design, but visually confusing side by side; candidate future tweak.
- [x] **Falling letters (starts-with): letters fell with an icon on top instead
  of the object alone.** The variant showed the same letter glyph twice (target
  + curated extra word) with different icons — confusing, since the task is
  "find the object", not "find the letter". Fallers in this variant now render
  icon-only (centered, no glyph), and the spoken prompt changed from "Βρες το
  γράμμα Χ" to a new dedicated "Βρες κάτι που αρχίζει από το γράμμα Χ" phrase
  (backend `find_starts_with_tts` + `/api/games/learn/letters/find-starts-with/{token}.mp3`,
  warmed at startup; frontend `playFindStartsWith`).
