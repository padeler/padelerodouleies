# PLAN.md — Exercises Extension

**Status: IN PROGRESS.** **M1–M5 are implemented** on the `feat/exercises-mvp`
branch: validator + bundle format, discovery/persistence/kid API, the kid
"Ασκήσεις" tab with **all five exercise types playable** (M4), and the admin
rescan + kid-Stats surfacing (M5). M6's dev-machine generation skill is scaffolded
(`exercise_lab/tools/exercise-gen/`); its acceptance test (one bundle from real school
material) and M7 rollout remain. Not yet merged to `main`. The normative bundle
format now lives in [docs/EXERCISE_FORMAT.md](../docs/EXERCISE_FORMAT.md) (the
Pydantic models in `backend/app/schemas/exercises.py` are its source of truth).

Adds school-material-based exercises for the kids: an offline generation workflow that
produces self-contained exercise *bundles*, a mounted volume where bundles are dropped
and auto-discovered, an age-targeted kid-facing exercise player, progress tracking, and
star awards through the existing append-only ledger.

---

## 1. Goals & non-goals

### Goals
- Parents generate exercise bundles from school material (photos/scans/notes) using an
  agent-assisted workflow on a dev machine — **the production container never calls an LLM**.
- Bundles are plain files (JSON manifest + image/audio assets) dropped into the existing
  data volume; the app discovers them automatically, no redeploy, no DB import step.
- Each kid sees only exercises matching her age (derived from an admin-set birthdate),
  navigated through **subject groups** (language, math, geography, …) that are visible
  only when they contain at least one available bundle for that kid.
- Completing exercises awards stars via `HistoryLedger` (invariant #4: every delta has a
  visible ledger row).
- Bilingual UI chrome as everywhere else (Greek default); bundle *content* is
  single-language like chores/rewards (the generator writes Greek).

### Non-goals (out of scope for this plan)
- LLM calls from the container / online generation.
- Free-text or handwriting input; grading is deterministic — taps/choices plus a
  constrained numeric keypad (`numeric_entry`), never an open text field.
- A background scheduler — discovery is scan-on-request, consistent with invariant #2.
- Multiplayer / collaborative exercises (could come later, like collaborative rewards).

---

## 2. Architecture overview

```
school material ──► exercise-gen agent (dev machine, M6)
                          │ produces + validates
                          ▼
            bundle dir: manifest.json + assets/
                          │ copied to NAS
                          ▼
   /mnt/raid/padelerodouleies/data/exercises/<bundle-dir>/   (existing /app/data mount)
                          │ scan-on-request (mtime cached)
                          ▼
   FastAPI: app/services/exercises.py  ──►  /api/exercises/* + asset serving
                          │                        │
                 SQLite: attempts/progress    React kid tab "Ασκήσεις"
                 + HistoryLedger star rows    (player components per type)
```

Key decisions (settled in discussion 2026-06-09 unless flagged ⚖️ — see §7):

- **Volume:** reuse the existing `/app/data` bind mount with an `exercises/`
  subdirectory. No compose change needed; bundles land on the RAID and survive
  container rebuilds, same as avatars/chore images.
- **Bundle = directory** (not zip): trivially inspectable/editable on the NAS, assets
  served straight from disk with a path-traversal guard. A bundle is immutable once
  dropped; corrections ship as a new `version`.
- **Discovery:** filesystem scan triggered lazily on API access, cached on directory
  mtimes. Invalid bundles are **not silently skipped** — they are surfaced in the admin
  UI with the validation error (fail-explicitly convention).
- **The backend validator is the single source of truth** for the bundle format
  (Pydantic models). The generation tool (M6) runs the same validator before emitting a
  bundle, so a bundle that generates clean always loads clean.
- **Age targeting:** add `User.birthdate` (nullable `Date`), set by an admin in the
  user modal. Age is derived at request time (Athens-local "today"), so it stays
  correct without manual bumps, and the stored birthdate enables future perks
  (birthday star gifts, birthday banner, …). A bundle declares `age_min`/`age_max`;
  a kid sees bundles where `age_min ≤ age(today) ≤ age_max`. A kid with no birthdate
  set sees no exercises (fail-explicit; the admin bundles page calls it out).
- **Subject groups are navigation, not targeting:** `subject` in the manifest is a
  closed enum (`language`, `math`, `geography`, `history`, `logic`, `nature` — final
  list in M1). The kid tab shows one card per group; a group renders only if it has
  ≥1 valid, age-matched bundle for that kid. Because `subject` is an enum (not free
  text), group labels go through `translations.py` and stay bilingual (invariant #5).
- **Audio prompts are synthesized server-side on demand by the existing Piper TTS
  service** (`app/services/tts.py`), the same engine, on-disk cache, and `SpeakButton`
  component already shipped for card TTS. Bundles carry **no audio assets** — the
  prompt/hint *text* is the single source, the speaker button hits a TTS endpoint that
  synthesizes (Piper → ffmpeg → mono MP3, cached by `sha256(voice|text)`) and the
  language is auto-picked from the text's script (Greek content → Greek voice),
  consistent with single-title content (invariant #5). This drops the whole
  generation-time audio step: text corrections auto-regenerate audio, bundles stay
  small and trivially editable, and a 4-year-old's image-only exercises get spoken
  prompts for free. Playback is a plain `HTMLAudioElement` (MP3 decode works down to
  the Samsung Tab 4's Android-4.x browser, whereas `speechSynthesis` there is
  unreliable and its Greek voice depends on an installed engine — rejected), always
  user-gesture-driven (old-Android autoplay policy). Verified on the Tab 4 in M7.
- **TTS text is mono-script per bundle.** Piper phonemizes via espeak-ng with **one
  fixed language per voice** (Greek model → Greek G2P) and has no per-word language
  switching, so mixing scripts in one string mispronounces the minority script — and
  `tts.py`'s `detect_language` (any Greek codepoint → Greek voice) makes that failure
  loud. The rule, which also fits invariant #5: a Greek bundle's text is Greek-only,
  an **English bundle's text is English-only** (e.g. the 9-year-old's English-learning
  exercises, read by the English voice), never blended. The generator enforces this;
  if a concept genuinely needs a foreign term, respell it in the bundle's own script.
- **Optional spoken-text override.** espeak-ng's Greek G2P leans on the written τόνος
  for stress, and rare words can still mispronounce. So every exercise may carry an
  optional `prompt_tts` / `hint_tts` field: the card *displays* `prompt`/`hint` but the
  speaker button *reads* the `*_tts` variant when present (respelled / re-accented /
  transliterated), else falls back to the displayed text. Server-side TTS-text
  selection mirrors how chore/reward TTS text is built (`app/api/tts.py`); the cache
  key stays correct because it hashes the exact text synthesized.

---

## 3. Bundle format (spec draft — finalized in M1)

```
exercises/
  2026-06-letters-A-v1/
    manifest.json
    assets/
      apple.png            # images only — audio is synthesized server-side from text
```

`manifest.json` (versioned with `schema_version` so the format can evolve):

```jsonc
{
  "schema_version": 1,
  "id": "2026-06-letters-A",        // stable across versions of the same bundle
  "version": 1,                     // bump to supersede; (id, version) is the identity
  "title": "Το γράμμα Α",           // single-language, like chores (invariant #5)
  "subject": "language",            // language | math | logic | nature | ... (enum, M1)
  "age_min": 4,
  "age_max": 6,
  "stars": 3,                       // suggested award for completing the bundle ⚖️
  "exercises": [
    {
      "id": "ex-01",
      "type": "multiple_choice",
      "prompt": "Ποια εικόνα αρχίζει από Α;",   // displayed text; audio synthesized on tap
      "prompt_tts": null,                        // optional spoken override (respelled/re-accented)
      "options": [
        { "id": "a", "image": "apple.png" },
        { "id": "b", "image": "ball.png" }
      ],
      "answer": "a",
      "hint": "Α όπως... αρκούδα!",              // optional, also spoken via TTS
      "hint_tts": null                           // optional spoken override for the hint
    }
  ]
}
```

### Exercise types

| Type | Interaction | Target | Milestone |
|---|---|---|---|
| `multiple_choice` | tap one of 2–4 options (text and/or image) | all ages | M3 (MVP) |
| `match_pairs` | tap-to-pair two columns (image↔image, image↔text) | all ages | M4 |
| `ordering` | arrange 3–5 items in sequence (numbers, story frames) | 5+ | M4 |
| `counting` | "how many X?" — tap the right number | 4+ | M4 |
| `numeric_entry` | type a number on an on-screen number pad (e.g. `2*3 + 4 = ?` → `10`) | math, older kids (7+) | M3 (MVP) |

All types are deterministic-graded on the backend (the manifest's `answer` never reaches
the client — the client posts the kid's response, the server grades it). For
`numeric_entry` the `answer` is a **number** (integer in v1) and the client posts the
typed value; the server compares numerically (so `"10"` and `10` and `" 10 "` all match,
but grading is exact — no tolerance). Input reuses the PIN-style numeric keypad (no
free-text field, consistent with invariant #1's no-text-entry ethos), so there is no
keyboard on the old tablets. The prompt is the expression itself; because it is
digits/operators (script-neutral) a Greek kid hears it via the English voice — supply a
`prompt_tts` override ("δύο επί τρία, συν τέσσερα") if a spoken reading is wanted.

**Note for the 4-year-old:** she can't read, so prompts need an audio rendition and
image-only options. Both are in v1 for free: image options are first-class, and the
prompt/hint text is spoken on demand by the in-container Piper TTS service — no
generation-time audio step, no per-exercise recordings.

---

## 4. Data model & API changes

### DB (Alembic migration, one per milestone that needs it)

- `USERS` + `birthdate` (nullable `Date`). Editable in the admin user modal.
- New table `EXERCISE_ATTEMPTS` (append-only, like the ledgers):
  `id, user_id FK, bundle_id, bundle_version, exercise_id, response_json, correct,
  created_at` — one row per answer submitted; "progress" is derived, never mutated.
- New table `EXERCISE_COMPLETIONS`:
  `id, user_id FK, bundle_id, bundle_version, stars_awarded, history_ledger_id FK,
  created_at` — written exactly once per (kid, bundle, version) when the bundle is
  finished; the FK ties the star delta to its visible ledger row.
- `HistoryLedger`: no schema change — reuse `ref_table='exercise_completions'`,
  `ref_id`, and `action_label` so the kid timeline and admin activity table show
  exercise stars with zero new UI plumbing.
- **No bundle table.** Bundle metadata lives only on disk; the DB stores only
  references (`bundle_id` strings). Deleting a bundle dir leaves history intact.

### API

- `GET  /api/exercises/bundles` — kid: visible bundles (age-filtered, with per-kid
  completion status and `subject`; the frontend derives the group cards from this
  list, so empty groups disappear for free); admin: all bundles incl. invalid ones
  with errors.
- `GET  /api/exercises/bundles/{bundle_id}` — manifest *minus answers*.
- `GET  /api/exercises/assets/{bundle_id}/{path}` — asset serving (traversal-guarded,
  auth-gated like avatar images).
- `GET  /api/exercises/tts/{bundle_id}/{exercise_id}/{prompt|hint}.mp3` — spoken prompt
  or hint, built server-side from the manifest text and synthesized via the existing
  `app/services/tts.py` (Piper → ffmpeg → cached mono MP3, language auto-picked by
  script). Auth-gated and lazy/cached exactly like the card-TTS endpoint (`app/api/tts.py`).
- `POST /api/exercises/bundles/{bundle_id}/answers` — `{exercise_id, response}` →
  graded result; on bundle completion: stars from the pluggable
  `compute_bundle_stars` policy (see Q1), completion row + ledger row +
  `stars_changed` WS broadcast (existing event, frontend already invalidates on it).
- Admin: `POST /api/admin/exercises/rescan` (manual refresh button) and per-kid
  visibility overrides (shape decided with Q2).

---

## 5. Milestones

Each milestone ends green: Vitest + pytest + `npm run build` + `mypy --strict` (no new
errors) pass, and gets a semver tag on merge to `main` (per workflow memory).

> **Detailed dev checklist for M1–M3 (the MVP):**
> [milestones-1-3.md](./milestones-1-3.md). The bullets below stay high-level; the
> step-by-step execution lives there.

### M1 — Bundle spec, validator, sample bundles *(foundation, no UI)* ✅ done
- `EXERCISE_FORMAT.md`: the normative spec (schema, types, asset rules, versioning).
- `backend/app/schemas/exercises.py`: Pydantic models = the validator.
- `backend/app/services/exercise_bundles.py`: load + validate a bundle dir; explicit
  `BundleValidationError` with the offending path/field.
- Two hand-written sample bundles under `backend/tests/fixtures/exercises/` (one valid
  per age band, one deliberately broken) — used by tests and as generator reference.
- Tests: validator accepts/rejects correctly; answers never serialize into the
  kid-facing schema.
- **Detailed steps:** [milestones-1-3.md → M1](./milestones-1-3.md#m1--bundle-spec-validator-sample-bundles-no-ui).

### M2 — Discovery, persistence, kid API ✅ done
- Migration: `User.birthdate` + `EXERCISE_ATTEMPTS` + `EXERCISE_COMPLETIONS`.
- Discovery service with mtime cache; `EXERCISES_DIR` env (default
  `/app/data/exercises`, dev default `backend/data/exercises`).
- The four kid endpoints (§4) incl. grading, completion, star award via the existing
  approval-service ledger pattern, `stars_changed` broadcast.
- Admin user modal + API: birthdate field.
- Tests: age filtering boundaries, double-completion idempotency (one ledger row max),
  asset path-traversal rejection, invalid bundle reporting.
- **Detailed steps:** [milestones-1-3.md → M2](./milestones-1-3.md#m2--discovery-persistence-kid-api-no-ui-yet).

### M3 — Kid UI MVP (multiple-choice + numeric-entry players) ✅ done
- New kid tab `/dashboard/exercises` ("Ασκήσεις"), `nav.exercises` translations, a
  `bgVariant`, sidebar entry.
- Two-level navigation: subject-group cards (only non-empty groups render; labels
  from `translations.py`) → bundle list within the group, reusing the chore-card
  visual language (accent vars, flip-card feel); completed bundles show a badge,
  mirroring `available_again`/"claimed today" patterns.
- Audio prompt playback lands here with the first player (the 4-year-old's bundles
  depend on it): reuse the existing `SpeakButton` component pointed at the new
  exercise TTS endpoint — no new playback code, no bundle audio assets.
- Player: one exercise at a time, big tap targets (tablet-first), instant
  right/wrong feedback, progress dots, confetti + `playReward` on bundle completion.
- Wrong answers: gentle retry until correct with encouraging feedback, plus the
  exercise's optional `hint` (text/audio) after the first miss; options shuffled per
  render. Stars come from the pluggable policy function (lenient MVP default — Q1).
- The two MVP players ship here: `multiple_choice` and `numeric_entry` (the latter
  reuses the PIN keypad for input, posts the typed integer, exact server-side compare —
  the older kid's math; see invariant #1 ethos). Remaining types follow in M4.
- Vitest coverage incl. MSW handlers for the new endpoints.
- **Detailed steps:** [milestones-1-3.md → M3](./milestones-1-3.md#m3--kid-ui-mvp-multiple-choice--numeric-entry-players).

### M4 — Remaining exercise types
- `match_pairs`, `ordering`, `counting` player components + backend grading
  (`multiple_choice` + `numeric_entry` already shipped in M3; audio playback shipped
  in M3 too; `lib/sound.ts` stays synth-only).
- Sample bundles extended to cover every type (doubles as generator reference).

### M5 — Admin panel
- `/admin/exercises`: discovered bundles table (status valid/invalid + error message,
  age range, per-kid completion), Rescan button, per-kid visibility override (per Q2).
- Kid exercise activity surfaced in the existing Activity table via `action_label`.
- Optional: exercises in the Stats tab (per-kid solved counts) — stretch, can slip.

### M6 — Generation agent (dev-machine tooling, not shipped in the container)
- `exercise_lab/`: the dev-machine lab for all agentic exercise generation — the
  Claude Code project skill + prompt templates under `exercise_lab/tools/exercise-gen/`,
  plus the source textbook PDFs under `exercise_lab/books/` (git-ignored). Takes
  school material (photos/PDFs) + target kid/age and emits a bundle directory.
- The skill's contract: read `EXERCISE_FORMAT.md`, generate `manifest.json` + assets,
  then **run the M1 validator** (`python -m app.schemas.exercises <dir>` entry point)
  and iterate until clean.
- Images: cropped photos of the actual school material **and/or** generated
  illustrations, per exercise — both first-class; the validator enforces max
  dimensions/byte size either way.
- Audio: nothing to generate — prompts/hints are spoken at runtime by the container's
  Piper TTS from the manifest text, so the agent only writes good prompt text:
  **mono-script per bundle** (no English mixed into Greek, or vice versa), correct
  τόνος on Greek, and a `prompt_tts`/`hint_tts` spoken override wherever a word reads
  wrong (validator rejects a bundle whose text mixes scripts).
- Deliverable: generate one real bundle from actual school material end-to-end as the
  acceptance test.

### M7 — Production rollout
- Docs: README §Exercises (bundle drop workflow on the NAS), compose comment update,
  CLAUDE.md feature notes.
- `seed_dummy.py`: seed birthdates + a few attempts so Stats/Activity have data.
- Deploy via the normal GHCR flow; create `data/exercises/` on the RAID; drop the M6
  real bundle; verify on the tablets — explicitly including audio playback and player
  performance on the Samsung Tab 4.

**Suggested sequencing:** M1→M2→M3 ship together as the usable MVP (one type,
end-to-end). M4/M5 next. M6 can start in parallel after M1 freezes the spec.

---

## 6. Risks

- **Old-tablet performance:** player must follow the existing rules — no
  `filter: blur` animations, GPU-cheap transforms only; images in bundles should be
  pre-sized by the generator (validator can enforce a max dimension/byte size).
- **Spec churn:** the format will evolve once real generated content exists;
  `schema_version` + the single shared validator keep old bundles loading or failing
  loudly, never silently misrendering.
- **SQLite + naive-UTC timestamps:** attempts/completions must follow the existing
  naive-UTC convention (`_start_of` bug history) — covered by tests in M2.

---

## 7. Decisions log & open questions

### Decided (2026-06-09)
- **Targeting:** pure age-range matching against an admin-set `User.birthdate`
  (age derived at request time; birthdate stored in full to enable future birthday
  perks like star gifts). No per-kid bundle assignment in v1.
- **Navigation:** kid-selectable subject groups (closed enum, translated labels);
  a group is visible only if it has ≥1 available bundle for that kid.
- **Audio:** synthesized server-side on demand by the in-container Piper TTS service
  (`app/services/tts.py`, shipped for card TTS), reusing its on-disk cache and the
  `SpeakButton` component; bundles carry no audio assets. Played via
  `HTMLAudioElement` behind a speaker button — chosen over `speechSynthesis` for
  Samsung Tab 4 (old Android browser) compatibility and consistent Greek voice
  quality. Gesture-driven playback only. *(Superseded the original "pre-generated MP3s
  in the bundle" decision once Piper TTS landed in production, 2026-06.)*
- **TTS-text language:** mono-script per bundle (Greek bundles Greek-only, English
  bundles English-only — e.g. the 9-year-old's English-learning exercises). Piper has
  no per-word language switching, so scripts are never mixed in one string. Each
  exercise may carry an optional `prompt_tts`/`hint_tts` spoken override (respelled or
  re-accented text) when the auto-reading is wrong, falling back to the displayed text.
- **Assets:** photos of the school material and/or generated illustrations, both
  supported; validator enforces size limits.
- **`numeric_entry` grading (v1):** integers only — no decimals, fractions, or
  negatives — and **exact match** (no tolerance/rounding). The validator rejects a
  non-integer `answer`. Decimals/fractions or a ±tolerance would be a future
  `schema_version` bump, not retrofitted into v1.

### Still open
- **Q1 — Star policy: deliberately open; implemented as a pluggable policy.**
  The goal is learning, not punishment, so we won't lock a scoring rule now.
  What the implementation guarantees instead:
  - `EXERCISE_ATTEMPTS` records **every** attempt with order and correctness, so any
    future policy (first-attempt accuracy, thresholds, per-age leniency, daily caps)
    is computable retroactively from data we already have.
  - Star computation lives in **one pure function**
    (`compute_bundle_stars(bundle, attempts) -> int` in the exercises service) — the
    only place a policy change ever touches; awarded once per (kid, bundle, version),
    auto-awarded through the ledger as before.
  - **MVP default: lenient** — full `stars` on bundle completion regardless of
    retries. We watch how the kids actually use it, then revisit.
  - Anti-brute-force levers exist independent of policy: options shuffled per
    render, generator prefers 3–4 options over 2.
  - **Guidance over penalty:** a wrong answer never blocks or scolds — the player
    gives encouraging feedback and, when the exercise provides one, a `hint`
    (text and/or audio, optional in the manifest) after the first wrong attempt.
- **Q2 — Kids' birthdates:** needed for the M2 seed and production setup — provide
  them when we get there.

### Decided (2026-06-18)
- **Per-kid bundle visibility override: deferred — not in v1.** Age-range matching
  against an admin-set `User.birthdate` is the sole visibility driver; no manual
  per-kid show/hide table or "ignore age" toggle is built in M5. Revisit only if
  real usage shows age ranges are too coarse. (Resolves the M4/M5 "Q2 visibility
  override" question — distinct from the still-open Q2 birthdates item above.)
- **Exercise stats in the kid Stats tab: yes.** M5 surfaces per-kid solved/earned
  exercise counts in the kid-facing Stats tab (not admin-only), reusing the admin
  kid-stats rollup. Promoted from a stretch goal to a firm M5 task.
- **Ordering / match_pairs interaction: tap-to-place, no HTML5 drag-and-drop** —
  unreliable touch DnD on the Samsung Tab 4 (Android 4.4); consistent with the
  existing tap-based players and the old-tablet rules (§6).
