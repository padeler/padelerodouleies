# TODOs
# Features

## Learning Adventure (alphabet + numbers teaching game)

One shared engine, two tracks (`letters` / `numbers`), shipped as two Games-hub cards.
4 level-type slots per track, 4 difficulty tiers that loop harder forever, 3 lives
(endless until lives run out). All TTS is precomputed; Piper is fed phonetic words,
never bare glyphs.

**Locked decisions:**
- Tier flow: **lives, endless** — 3 lives, lose one on a wrong tap / missed falling target; clear all 4 slots → next tier harder; game over at 0 lives. Best score = `tier * 1000 + points`.
- Count Them: object set **capped at ~10** regardless of tier; higher tiers scale the recognition levels' number range (to 100), not the counting set.
- Slot 1 is track-specific: **Count Them** (numbers) / **Match Case** (letters). Slots 2–4 shared.
- Score keys: `number_adventure`, `letter_adventure` (both higher-is-better).

### M1 — Phonetics + decks (backend, pure, riskiest first) ✅
- [x] Create `backend/app/services/learn_decks.py`
- [x] Letter-name map: all 24 letters upper+lower → Greek spoken name (`Α/α → "άλφα"` … `Ω → "ωμέγα"`)
- [x] `greek_number_word(n)` for 1–100, **neuter counting form** (`ένα, δύο, τρία … είκοσι ένα … εκατό`), compounds from tens+units
- [x] `DeckItem` model `{ token, glyph, glyph_alt, tts }` (token path-safe, `n5` / `l01`; `glyph_alt` = lowercase for letters, `None` for numbers — one item per letter carries both cases)
- [x] Tier definitions: numbers T1 1–10 / T2 1–20 / T3 1–50 / T4 1–100; letters T1 Α–Ι / T2 Α–Ν / T3 Α–Σ / T4 full
- [x] pytest: 1–100 number-word hand-checked fixture (all irregulars + tens + compounds) + full-range Greek check; 24-letter completeness/distinctness; deck/tier construction; unknown-track raises (48 tests, mypy --strict clean)

### M2 — TTS precompute (server-side warm) ✅
- [x] Create `backend/app/services/learn_tts.py` with `warm_all()` over every deck `tts` word via existing `tts.py` synth+cache (deduped union of both decks)
- [x] Fire from FastAPI `lifespan` daemon thread alongside exercise TTS; idempotent; abort-with-one-log if toolchain missing
- [x] CLI entry: `python -m app.services.learn_tts`
- [x] pytest: cache-warming (4 tests, mirror `test_exercise_tts.py`); `learn_tts.py` mypy --strict clean

### M3 — Learn API + score keys ✅
- [x] Create `backend/app/api/learn.py`, mount under `/api/games/learn`
- [x] `GET /api/games/learn/{track}` → `{ track, items: [{token, glyph, glyph_alt, audio_url}], tiers }` (**no `tts` leaked to client**)
- [x] `GET /api/games/learn/{track}/tts/{token}.mp3` → reuse `tts.py`, auth-gated, served from warmed cache (token resolved against in-code deck — no traversal surface)
- [x] Add `number_adventure` + `letter_adventure` to `GAME_SCORE_DIRECTIONS` in `app/services/games.py` (reuse existing `/api/games/scores`)
- [x] pytest: 9 tests — endpoints, auth gate, unknown track/token 404, 503-on-toolchain-missing, `tts` not leaking, score-key acceptance; `learn.py` mypy --strict clean

### M4 — Pure game engine (frontend, no UI) ✅
- [x] Create `frontend/src/pages/dashboard/games/learn/learnEngine.ts` — rng-injectable, DOM-free: track/tier/slot state, per-level round generation, scoring, streak/combo, lives, `isTimeTrial`/`TIME_LIMIT_SECONDS` (component runs the clock)
- [x] Vitest: 15 tests — slot→level-type map, round generation per level type, slot/tier progression + loop (content plateau), lose-on-wrong, game-over-at-0 (no-op after), scoring/streak, final score; frontend `tsc` clean

### M5 — Shell + slots + deck prefetch (both tracks end-to-end) ✅
- [x] `useLearnDeck.ts` — fetch deck + **prefetch tier clips** into `Map<token, HTMLAudioElement>` behind a ready/`Φόρτωση…` gate
- [x] `LearnAdventure.tsx` shell (rendered as `NumberAdventure` / `LetterAdventure` via `track` prop) — HUD (tier/score/lives hearts/best), start + game-over overlay, score submit on death
- [x] Slot 0 components: `CountThem` (≤10 `⭐` objects → pick numeral) + `MatchCase` (pair Α↔α)
- [x] Pragmatic full loop now playable: `ChoiceGrid`, `HearIt` (tap version — M6 upgrades to canvas), `PutInOrder`, `WhatsNext`, `useDelayedAnswer`
- [x] Routes wired (`/dashboard/games/{numbers,letters}` + `/admin/...`) + two GamesHub cards + i18n keys added (`translations.py`)
- [x] Vitest: `useLearnDeck` prefetch gate + 8 player smoke/interaction tests (25 learn tests total); full suite 210 pass, backend 233, `npm run build` + build-tsc clean
- [x] Live end-to-end verification in the running app (Playwright: both tracks load, spoken intro + 3·2·1 countdown, count/match rounds render in light & dark themes)

### M6 — HearIt (the action level, both tracks) ✅
- [x] `hearEngine.ts` — pure, rng-injectable falling-targets sim (layout in columns, speed ramp, fall-off detection, tap hit-test)
- [x] `HearIt` rewritten: Canvas 2D + rAF over `hearEngine` — choices drift down, target spoken on entry (+replay), tap the match; missing the target = lose a life
- [x] Vitest: 4 `hearEngine` tests + HearIt mount smoke test

### M7 — PutInOrder + WhatsNext ✅
- [x] `PutInOrder` — tap-to-place ascending sequence (no HTML5 drag, per Tab 4 rule); wrong tap loses a life (shipped in M5)
- [x] `WhatsNext` — successor / next-letter (shipped M5) + **time-trial countdown** (`TimeTrialBar`, rAF, `TIME_LIMIT_SECONDS`, expire = lost life)
- [x] Vitest smoke tests (order accept/wrong, whats_next grading)

### M8 — Hub, routes, i18n, polish ✅
- [x] Two new Games-hub cards (`🔢 Ταξίδι Αριθμών`, `🔤 Ταξίδι Γραμμάτων`); routes under `/dashboard/games/{numbers,letters}` + `/admin/games/...` (base-relative back link)
- [x] `translations.py` + frontend keys: card titles, 5 level-type names + prompts, "tier cleared", loading, replay (score-key Stats labels reuse the existing game-scores scoreboard which lists raw keys)
- [x] "Level up" jingle `playLevelUp` in `lib/sound.ts` (synth two-octave run), fired on tier clear
- [x] Old-tablet compliance pass — emoji ≤6.1 (🔢/🔤/⭐), Lucide chrome (hearts/speaker), no `aspect-ratio`/`inset`/flex-`gap`, transform/opacity transitions, canvas `touch-action:none`
- [x] Full test pass (Vitest 214 / pytest 233), `npm run build` + build-tsc clean
- [~] `docker build` — running (no new deps; npm+pip builds already green)
- [x] Live end-to-end verification in the running app


## Bugs:

### Learning Adventure QA fixes (post-M8) ✅
- [x] **Overlapping audio** — `useLearnDeck` is now single-channel: starting any clip
      (token word or level intro) stops the one currently playing, so two Piper words
      never stack into garbled audio.
- [x] **Illegible single letters/numbers (Piper carrier phrases)** — root cause: Piper
      renders *isolated short words* with broken intonation and clips them
      (rhasspy/piper#252) — bare `πι` synthesizes to ~0.16s of unintelligible audio.
      Fix: the spoken string is now a two-word carrier phrase — `letter_tts`/`number_tts`
      in `learn_decks.py` wrap the name/word as `Γράμμα άλφα.` / `Αριθμός πέντε.` (with a
      declarative period). The on-screen glyph is unchanged; the kid also hears
      "the letter …" / "the number …". Verified: `Γράμμα πι.` → 1.32s, fully articulated.
- [x] **Light/dark theme text** — the start / game-over panel reused the dark-scrim
      `game-overlay-*` classes (hardcoded white text) on a plain page background →
      invisible in light mode. Re-themed via `var(--text-h)`/`var(--text)`; verified
      readable in both themes.
- [x] **Spoken round description** — each level now speaks a short Greek intro sentence
      before it starts (backend `GET /api/games/learn/say/{level}.mp3`, warmed alongside
      deck words; `RoundIntro` component plays it).
- [x] **Pause + 3·2·1 countdown** — `RoundIntro` adds a pause between levels and a
      counting-down 3·2·1 (with tick/go cues) before every time-trial round (Listen,
      What Comes Next) so the kid is ready when the clock starts.
- [x] **"Πάμε!" hold after the countdown** — `RoundIntro` shows a green "Πάμε!" for
      ~1s (`GO_HOLD_MS`) after the 3·2·1 before handing off to play, so the timed
      round doesn't start abruptly. Verified live: play begins ~1004ms after "Πάμε!".
- [x] **Level-complete celebration + Continue button** — clearing a level (slot or tier)
      now shows a `LevelCleared` panel (🎉 "Μπράβο!" / 🏆 tier message + score) with the
      celebration sound, and the kid taps **Συνέχεια** to advance — giving time to take in
      the result and the state change instead of auto-jumping to the next level.

