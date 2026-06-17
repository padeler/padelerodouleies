# Milestones M1–M3 — Exercises MVP (developer checklist)

> **Status: M1–M3 complete** on the `feat/exercises-mvp` branch (boxes below
> checked) — green gate passing (174 Vitest + 136 pytest, build + tsc clean,
> mypy adds only the documented `Column[T]` class). Not yet merged to `main`, so
> no semver tag has been cut. Sample deployable bundles live in
> `samples/exercises/` (see its README).

Detailed, actionable steps for the first three milestones of the Exercises
extension. Strategy, rationale, and decisions live in [PLAN.md](./PLAN.md) — this
file is the execution checklist. M1→M2→M3 ship together as the usable MVP (one
exercise type, end-to-end). Each milestone ends green and gets a semver tag on
merge to `main`.

**Green gate (every milestone):** `cd backend && pytest` · `cd frontend && npm test`
· `npm run build` · `mypy --strict app` reports no *new* errors.

---

## M1 — Bundle spec, validator, sample bundles (no UI)

Goal: a normative bundle format and a single Pydantic-based validator that is the
sole source of truth (the M6 generator will reuse it). No DB, no API, no UI.

### Spec doc
- [x] Write `docs/EXERCISE_FORMAT.md`: directory layout, `manifest.json` schema,
      the five exercise types, asset rules (images only — audio is synthesized,
      see PLAN.md §2), versioning (`schema_version`, `(id, version)` identity),
      and the mono-script + `prompt_tts`/`hint_tts` rules from PLAN.md §3.

### Validator (Pydantic = source of truth)
- [x] `backend/app/schemas/exercises.py` with strict models (extra="forbid"):
  - [x] `ExerciseOption`: `id: str`, optional `image: str`, optional `text: str`
        (at least one of image/text required).
  - [x] `Exercise`: `id`, `type: Literal["multiple_choice","match_pairs",
        "ordering","counting","numeric_entry"]`, `prompt: str`,
        `prompt_tts: str | None`, `options`, `answer`, `hint: str | None`,
        `hint_tts: str | None`.
  - [x] `BundleManifest`: `schema_version: int`, `id: str`, `version: int`,
        `title: str`, `subject: Literal[...closed enum...]`, `age_min: int`,
        `age_max: int`, `stars: int`, `exercises: list[Exercise]`.
- [x] Cross-field validators, each raising `BundleValidationError(path, field, msg)`:
  - [x] `age_min <= age_max`; `age_min >= 0`; `stars >= 0`; non-empty `exercises`.
  - [x] `multiple_choice`: `answer` ∈ option ids; 2–4 options.
  - [x] `numeric_entry`: `answer` is an **int** (reject float/str); exact match
        (no tolerance field) — per PLAN.md §7.
  - [x] `match_pairs`/`ordering`/`counting`: shape per spec (left/right pairs;
        ordered id list; numeric answer) — finalize shapes here.
  - [x] **Mono-script check:** every TTS-bound string (`prompt`/`hint` and their
        `*_tts` overrides) must not mix Greek + Latin letters (reuse the Greek
        regex idea from `tts.py::_GREEK_RE`). Digits/operators/punctuation are
        script-neutral and allowed.
  - [x] Asset references resolve to files inside `assets/`; reject path traversal
        (`..`, absolute paths, leading `/`).
- [x] `kid_view(manifest)` helper that serializes a manifest **without** `answer`
      (and without `*_tts` — answers and tts text never leave the server; the
      client only gets display `prompt`/`hint`).
- [x] CLI entry point `python -m app.schemas.exercises <dir>`: validate a bundle
      dir, exit non-zero with the explicit error (used by the M6 generator).

### Bundle loader
- [x] `backend/app/services/exercise_bundles.py`:
  - [x] `load_bundle(dir: Path) -> BundleManifest` — read+parse+validate, raising
        `BundleValidationError` with the offending path/field (fail explicitly).
  - [x] No silent skipping: callers decide how to surface invalid bundles.

### Fixtures + tests
- [x] `backend/tests/fixtures/exercises/`: two valid bundles (one per age band,
      covering `multiple_choice` + `numeric_entry`) and one deliberately broken.
- [x] `backend/tests/test_exercises.py`: validator accepts valid / rejects each
      invalid case (bad subject, mixed script, non-int numeric answer, traversal,
      answer not in options); `kid_view` never serializes `answer`.

**Done when:** validator + loader + fixtures land, tests green, no new mypy errors.

---

## M2 — Discovery, persistence, kid API (no UI yet)

Goal: discover bundles from disk, persist attempts/completions, and expose the kid
endpoints incl. grading, star award through the ledger, and the prompt/hint TTS.

### DB migration
- [x] One Alembic migration under `backend/alembic/versions/`:
  - [x] `users.birthdate` (nullable `Date`).
  - [x] `EXERCISE_ATTEMPTS` (append-only): `id, user_id FK, bundle_id,
        bundle_version, exercise_id, response_json, correct, created_at`.
  - [x] `EXERCISE_COMPLETIONS`: `id, user_id FK, bundle_id, bundle_version,
        stars_awarded, history_ledger_id FK, created_at`; unique
        `(user_id, bundle_id, bundle_version)` for idempotency.
- [x] Add the ORM models to `backend/app/db/models.py` (timestamps naive-UTC, per
      the `_start_of` convention). *(New-table coverage lives in
      `test_exercises.py`, exercising both tables against the real DB;
      `test_db_schema.py` was left unchanged.)*

### Discovery service
- [x] Extend `backend/app/services/exercise_bundles.py` (or add
      `exercises.py`) with `discover(dir)`:
  - [x] `EXERCISES_DIR` env (default `/app/data/exercises`; dev default
        `backend/data/exercises`) — mirror the env pattern in `tts.py`.
  - [x] Scan-on-request with an **mtime cache** (no background scheduler —
        invariant #2). Cache keyed on dir mtimes; re-validate on change.
  - [x] Return both valid manifests and a list of invalid dirs **with their
        validation error** (surfaced to admin later; never silently skipped).

### Grading + award service
- [x] `backend/app/services/exercises.py`:
  - [x] `age_for(birthdate, today_athens) -> int`; `visible_bundles(user)` filters
        `age_min <= age <= age_max`; a kid with no birthdate sees none (explicit).
  - [x] `grade(bundle, exercise_id, response) -> bool` — server-side, deterministic;
        `numeric_entry` compares as int (exact); `multiple_choice` compares ids.
        Records an `EXERCISE_ATTEMPTS` row per submission.
  - [x] `compute_bundle_stars(bundle, attempts) -> int` — **one pure function**
        (PLAN.md Q1); MVP returns full `bundle.stars` on completion.
  - [x] `complete_bundle(...)` — idempotent: on first completion write the
        `EXERCISE_COMPLETIONS` row + a `HistoryLedger` row
        (`ref_table="exercise_completions"`, `ref_id`, `action_label`) following
        the `approvals.py` pattern; return data for the `stars_changed` broadcast.

### API
- [x] `backend/app/api/exercises.py` (`APIRouter(prefix="/api")`), registered in
      `backend/app/main.py`:
  - [x] `GET /api/exercises/bundles` — kid: age-filtered list w/ `subject` +
        per-kid completion status.
  - [x] `GET /api/exercises/bundles/{bundle_id}` — `kid_view` manifest (no answers).
  - [x] `GET /api/exercises/assets/{bundle_id}/{path}` — traversal-guarded
        `FileResponse`, auth-gated (mirror avatar image serving).
  - [x] `GET /api/exercises/tts/{bundle_id}/{exercise_id}/{prompt|hint}.mp3` —
        build text server-side (prefer `*_tts` override else display text), call
        `tts.get_or_synthesize`, return `FileResponse`; 503 on `TTSUnavailableError`
        — exactly like `backend/app/api/tts.py`.
  - [x] `POST /api/exercises/bundles/{bundle_id}/answers` — `{exercise_id,
        response}` → graded result; on completion award stars + broadcast
        `stars_changed`.
- [x] Admin: add `birthdate` to the user-update path used by
      `frontend/src/pages/admin/UsersPage.tsx` (schema in
      `backend/app/schemas/admin.py`, route in `backend/app/api/admin.py`).

### Tests
- [x] `backend/tests/test_exercises.py` (extend): age boundary filtering (min/max
      inclusive), no-birthdate → empty, double-completion idempotency (exactly one
      ledger row), asset path-traversal 404, invalid-bundle reporting, grading for
      `numeric_entry` (exact int) + `multiple_choice`, naive-UTC timestamps.

**Done when:** migration applies, endpoints + grading + award work, tests green,
no new mypy errors.

---

## M3 — Kid UI MVP (multiple-choice + numeric-entry players)

Goal: the kid-facing "Ασκήσεις" tab — group navigation, bundle list, and a working
player for the MVP types, with audio prompts via the reused `SpeakButton`.

### Wiring (mirror the Games tab)
- [x] Translations in `backend/app/i18n/translations.py`: `nav.exercises` (el/en) +
      `exercises.*` keys (subject-group labels from the closed enum, player
      strings, completion). Bilingual UI chrome (invariant #5).
- [x] Route under `frontend/src/pages/KidDashboard.tsx` (`/dashboard/exercises`)
      and the admin mount in `AdminPanel.tsx`; sidebar entry in `KidSidebar`;
      `exercises` `bgVariant` in `components/PageBackground.tsx`.
- [x] `frontend/src/api/client.ts`: `getExerciseBundles`, `getExerciseBundle`,
      `postExerciseAnswer`, and a `exerciseTtsUrl(bundleId, exerciseId, kind)`
      helper (returns the `/api/exercises/tts/...` URL for `SpeakButton`).
- [x] `frontend/src/pages/dashboard/exercises/useExercises.ts` — react-query hooks
      (list/detail/submit) modeled on `useGameScores.ts`; invalidate `['stats']`
      and the bundle list on a `stars_changed`-driven completion.

### Navigation + components
- [x] `pages/dashboard/exercises/ExercisesHub.tsx`: subject-group cards; a group
      renders only if it has ≥1 visible bundle (derive from the list response).
      Reuse the chore-card visual language (accent vars, flip-card feel).
- [x] `BundleList.tsx`: bundles within a group; completed bundles show a badge
      (mirror the `available_again` / "claimed today" patterns).
- [x] `BundlePlayer.tsx`: one exercise at a time, big tap targets (tablet-first),
      progress dots, instant right/wrong feedback, options shuffled per render.
  - [x] `MultipleChoicePlayer` (image/text options).
  - [x] `NumericEntryPlayer` — reuse the PIN keypad component for input; post the
        typed integer; no free-text field (invariant #1 ethos).
  - [x] Wrong answer: gentle retry + optional `hint` (text and, via `SpeakButton`,
        audio) after first miss — never blocks/scolds (PLAN.md Q1).
  - [x] On completion: confetti + `playReward` (reuse `lib/notify.ts` +
        `lib/sound.ts`), show stars awarded.
- [x] Audio: `SpeakButton` on prompt (and hint) pointed at `exerciseTtsUrl(...)` —
      no new playback code.

### Old-tablet rules (PLAN.md §6)
- [x] No `filter: blur`; transform/opacity transitions only; emoji ≤ Unicode 6.1
      or Lucide icons; square-trick layouts (no `aspect-ratio`).

### Tests
- [x] Vitest + MSW handlers for the new endpoints: group cards hide empty groups,
      multiple-choice correct/incorrect+hint flow, numeric-entry typed answer,
      completion celebration fires once.

**Done when:** the tab works end-to-end against M2, Vitest green, `npm run build`
passes.

---

## After M3
M4 adds the remaining types (`match_pairs`, `ordering`, `counting`) and M5 the admin
panel — see [PLAN.md](./PLAN.md) §5. A separate `milestones-4-7.md` will detail those
once the MVP lands.
