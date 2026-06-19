# Milestones M4–M6 — Exercises (developer checklist)

> **Status: M4 + M5 done; M6 scaffolded (acceptance pending).** M1–M3 (the MVP)
> are complete on `feat/exercises-mvp` (see [milestones-1-3.md](./milestones-1-3.md)).
> M4 (all five exercise types playable) and M5 (admin rescan + Stats surfacing)
> are implemented and green. M6's generation workflow is a README-driven process
> under `exercise_lab/` (`exercise_lab/README.md`; all agentic-generation tooling,
> working `notes/`/`bundles/`, and the source textbook PDFs live under
> `exercise_lab/`); its acceptance test — one bundle from real school
> material — and M7 rollout remain. This file is the execution checklist for these
> milestones. Strategy and decisions live in
> [PLAN.md](./PLAN.md); the normative bundle format lives in
> [docs/EXERCISE_FORMAT.md](../docs/EXERCISE_FORMAT.md) (the Pydantic models in
> `backend/app/schemas/exercises.py` are its source of truth).

**Green gate (every milestone):** `cd backend && pytest` · `cd frontend && npm test`
· `npm run build` · `mypy --strict app` reports no *new* errors. Each milestone
ends green and gets a semver tag on merge to `main` (workflow memory).

---

## Starting point — what M1–M3 already shipped toward M4–M6

Read this before estimating; several pieces normally attributed to M4/M5 already
landed during the MVP push and only need their remaining halves:

- **All five exercise types already validate.** `schemas/exercises.py` defines and
  cross-validates `counting`, `ordering`, `match_pairs` (plus the two MVP types),
  and `kid_view`/`_exercise_view` already serialize their structural fields
  (`items`, `pairs`, `image`, `max_count`) — answers stripped.
- **Backend grading for all five types is done.** `services/exercises.py::grade`
  already handles `counting` (int), `ordering` (`list[str]` of item ids in order),
  and `match_pairs` (`{left_id: right_id}` dict). No backend grading work in M4.
- **The TS view types already exist.** `lib/types.ts::ExerciseView` already carries
  `options?`, `items?`, `pairs?`, `image?`, `max_count?` and the five-type union.
- **The admin page exists.** `pages/admin/AdminExercisesPage.tsx` + backend
  `GET /api/admin/exercises/stats` already render the bundles table (age,
  difficulty-sorted, stars, exercise count), the invalid-bundles+error table, and
  per-kid completion/stars. The admin route is mounted in `AdminPanel.tsx`.
- **Activity integration is done.** `action_type="exercise_complete"` has a kid
  history label and an admin activity label (`admin.py:601`).

So the real remaining work is: **M4** = three frontend players + CSS + sample
bundles + tests; **M5** = the Rescan control and the (decision-gated) visibility
override, plus optional Stats-tab surfacing; **M6** = the dev-machine generation
workflow and one real bundle.

---

## M4 — Remaining exercise types (`counting`, `ordering`, `match_pairs`)

Goal: make the three already-validated, already-graded types **playable** in the
kid tab. `BundlePlayer.tsx` currently renders an `exercises.unsupported_type`
placeholder for them — replace that with real players.

### Players (mirror `MultipleChoicePlayer` / `NumericEntryPlayer`)
All three live under `frontend/src/pages/dashboard/exercises/`, take the same
`{ exercise, disabled, onAnswer }` prop shape, shuffle presentation per render,
and post the response shape the backend `grade()` already expects.

- [x] `CountingPlayer.tsx`:
  - Renders the scene image via `exerciseAssetUrl(bundleId, exercise.image)`.
  - A number pad / number grid `0..exercise.max_count` (inclusive). Reuse the
    `NumericEntryPlayer` pad styling, or a tap-grid of numbers for small ranges —
    tablet-first big tap targets.
  - `onAnswer(n: number)` — posts the tapped integer (server compares exact int).
- [x] `OrderingPlayer.tsx`:
  - Shows `exercise.items` (image and/or text) shuffled; the kid taps them into a
    sequence (tap-to-append into an answer row, tap-in-row to remove). **No HTML5
    drag-and-drop** — unreliable touch support on the Samsung Tab 4; use taps.
  - A check button submits `onAnswer(orderedIds: string[])` once all items placed.
  - `exercise.answer` never reaches the client — server compares the full list.
- [x] `MatchPairsPlayer.tsx`:
  - Two columns from `exercise.pairs` — left sides in order, **right sides
    shuffled independently**. Tap a left then a right to link them (or tap-left,
    tap-right pairing with a visible connection/highlight).
  - Submit `onAnswer(map: Record<string,string>)` = `{left_id: right_id}` once
    every left is matched. Server compares against the implicit pairing.
  - Allow re-tapping to change a link before submit; clear on a wrong result.

### Wire into the player + types
- [x] `BundlePlayer.tsx`: extend the type switch (currently `numeric_entry` /
      `multiple_choice` / unsupported) to dispatch the three new players. Keep the
      `exercises.unsupported_type` branch as the fallback for any *future* type
      (forward-compat with `schema_version`).
- [x] Confirm `lib/types.ts::ExerciseView` covers every field the players read
      (`items`, `pairs`, `image`, `max_count` already present — verify, don't
      re-add). The `onAnswer` union in `BundlePlayer` already takes `unknown`, so
      `number` / `string[]` / `Record<string,string>` all flow through unchanged.
- [x] Reset behaviour on a wrong answer: ordering/match must clear their in-progress
      selection. Reuse the existing `resetSignal` prop pattern from
      `NumericEntryPlayer` (bump it in `BundlePlayer` on a wrong result) rather
      than inventing a new mechanism.

### CSS (old-tablet rules — PLAN.md §6)
- [x] Add player styles to `Exercises.css`: no `filter: blur`, transform/opacity
      transitions only, no `aspect-ratio`/`inset`/flex-`gap` (square-trick
      layouts, explicit margins), emoji ≤ Unicode 6.1 or Lucide icons. Match the
      existing `.mc-option` / `.num-pad` visual language and accent vars.

### Translations (invariant #5)
- [x] Add any new player chrome strings to `backend/app/i18n/translations.py`
      (el default + en), e.g. `exercises.tap_to_order`, `exercises.match_hint`,
      `exercises.how_many`. Reuse existing keys (`exercises.check`,
      `exercises.correct`/`wrong`, `exercises.hint`) where they fit.

### Sample bundles (deployable reference — doubles as M6 reference)
- [x] Extend `backend/scripts/make_sample_bundles.py` to emit at least one bundle
      per new type (it currently emits only `multiple_choice` + `numeric_entry`):
  - `counting`: a scene image with N drawable objects (add Pillow draw helpers
    like the existing `draw_apple`/`draw_sun`), `answer = N`, sensible `max_count`.
  - `ordering`: 3–5 items (numbers, sizes, or story frames) with the correct
    `answer` order.
  - `match_pairs`: 2–6 image↔text or image↔image pairs.
- [x] Each new sample must pass the M1 validator (`python -m app.schemas.exercises
      <dir>`) — the script already validates each bundle it writes; keep that.
- [x] Regenerate `samples/exercises/` and update `samples/exercises/README.md` if
      the bundle inventory changes.

### Tests
- [x] Vitest player tests under `pages/dashboard/exercises/`: counting taps the
      right number; ordering builds and submits the sequence; match links all
      pairs and submits the map; each drives `onAnswer` with the correct shape and
      shows correct/wrong feedback. Add MSW handlers for any new request paths
      (asset/TTS URLs are already covered by the existing helpers).
- [x] Backend: `grade()` for the three types is already covered — add a
      `test_exercises.py` case only if a sample-bundle round-trip (load → grade a
      correct + a wrong response) for each new type isn't already asserted.

**Done when:** all five types are playable end-to-end in the tab, sample bundles
cover every type, Vitest + pytest green, `npm run build` passes, no new mypy.

---

## M5 — Admin panel completion

Goal: finish the admin surface. The bundles/invalid/kid-stats tables and the
`/api/admin/exercises/stats` endpoint already exist — this milestone adds the
manual rescan control, resolves the visibility-override question, and (optionally)
surfaces exercises in Stats.

### Manual rescan
- [x] Backend `POST /api/admin/exercises/rescan` in `app/api/admin.py`: invalidate
      the discovery mtime cache and re-`discover()`, returning the fresh
      valid/invalid counts. Admin-gated like the other `/api/admin/*` routes.
      (Discovery is already scan-on-request + mtime-cached — invariant #2; this is
      just an explicit "refresh now" so the admin doesn't wait on mtime.)
- [x] `app/services/exercise_bundles.py`: expose a cache-clear hook the endpoint
      calls (fail-explicit: log what was re-scanned and any new invalid dirs).
- [x] Frontend: a "Rescan" button on `AdminExercisesPage.tsx` (Lucide icon, not
      emoji) that calls a new `rescanExercises()` client fn and invalidates
      `['admin-exercise-stats']`. Translations `exercises.admin.rescan` (el/en).
- [x] Test: pytest for the endpoint (admin-only; returns counts); a Vitest click
      test if the button has non-trivial state.

### Per-kid visibility override — DEFERRED (Q2 decided 2026-06-18)
**Decision: not in v1.** Age-range targeting (an admin-set `User.birthdate`) is
the sole visibility driver; no per-kid show/hide. Recorded in PLAN.md §7.
- [x] No work in M5 — do **not** build the override table/UI. Revisit only if real
      usage shows age ranges are too coarse.

### Stats-tab surfacing (firm — decided 2026-06-18)
- [x] Add per-kid solved/earned exercise counts to the kid-facing Stats tab
      (`frontend/src/pages/dashboard/Stats.tsx` + `app/services/stats.py`). Reuse
      the rollup the admin kid-stats already computes (completions + stars) rather
      than a second query; thread it through `GET /api/stats`.
- [x] Gate behind the same `User.is_active` filter as the rest of Stats (invariant
      #8 — soft-deleted kids excluded). Add the `Stats*` TS type + `stats.*`
      translations for the new section.
- [x] Tests: pytest for the stats payload field; Vitest for the rendered section.

**Done when:** rescan works from the admin page, the exercise section shows in the
Stats tab, tests green, no new mypy.

---

## M6 — Generation agent (dev-machine tooling, never shipped in the container)

Goal: a repeatable dev-machine workflow that turns school material (photos/PDFs) +
a target age into a valid bundle directory, validated by the **same M1 validator**
the container uses. The production image never calls an LLM (PLAN.md §1).

### The workflow
- [x] `exercise_lab/README.md`: a README-driven, multi-step dev-machine process
      (no Claude Code skill) whose contract is, **per course**:
  1. **Scan** the course PDFs under `exercise_lab/books/<school-year>/` and write
     per-chapter notes to `notes/<course>/chapter_<id>.md`, keeping references
     back into the PDF (page, paragraph, or image) for later use.
  2. **Ideate**: build an exercise-idea checklist in `notes/<course>/ideas.md`
     (one simple hint per entry, e.g. `chapter_<id> - basic addition exercises`;
     multiple exercises can come from one hint).
  3. **Generate** (guided — the user supplies difficulty level + star count) into
     `bundles/<course>/`, using the notes + ideas and pulling PDF images where
     needed. Greek by default unless the user says otherwise; re-runnable, watch
     `bundles/` for duplicates. Read `docs/EXERCISE_FORMAT.md` (the normative spec)
     and use `templates/manifest.template.jsonc`. Each bundle is a dir
     (`manifest.json` + `assets/` — cropped real-material photos **and/or**
     generated illustrations, both first-class).
  4. **Verify** each bundle with `python -m app.schemas.exercises <dir>` and
     iterate until it exits 0. A bundle that generates clean must load clean.
- [x] `templates/manifest.template.jsonc` covers **all five** exercise types (so do
      M4 first, or at least freeze the M4 sample shapes — they are the generation
      reference).

### Content rules the workflow must enforce (PLAN.md §2, §7)
- [x] **Mono-script per string**: no single `prompt`/`hint`/`text` mixes Greek and
      Latin letters (the validator rejects that). A bundle *may* hold both languages
      across separate strings — e.g. English-learning bundles with a Greek prompt +
      English options, or Greek↔English `match_pairs`. Write prompts right, not just
      to pass.
- [x] Correct **τόνος** on Greek; add a `prompt_tts`/`hint_tts` spoken override
      wherever Piper's auto-reading is wrong (respelled/re-accented/transliterated).
- [x] Images pre-sized to the validator's max dimension/byte limits (so they
      render fast on the Samsung Tab 4 — old-tablet performance, PLAN.md §6).
- [x] Image-only options + spoken prompts for the pre-reader (4-year-old) bundles.

### Acceptance
- [ ] Generate **one real bundle from actual school material** end-to-end, validate
      it, drop it into the dev `EXERCISES_DIR`, set a kid's birthdate, and play it
      through every exercise type it contains. This is the M6 acceptance test.
      *(The workflow/templates/docs are in place; run it against the textbook PDFs
      under `exercise_lab/books/` (git-ignored) when ready.)*
- [x] Document the workflow in `exercise_lab/README.md` (the process steps, inputs,
      and where notes/bundles land) and cross-link from `samples/exercises/README.md`.

**Done when:** the workflow produces a validator-clean bundle from real material that
plays correctly in the tab; the workflow is documented.

---

## After M6
M7 is production rollout — README §Exercises drop-workflow docs, `seed_dummy.py`
birthdates + sample attempts, GHCR deploy, and on-tablet verification (explicitly
including audio playback and player performance on the Samsung Tab 4). See
[PLAN.md](./PLAN.md) §5; detail it in a follow-up checklist once M4–M6 land.
