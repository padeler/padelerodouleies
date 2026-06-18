# QA Findings — 2026-06-18

## Summary

QA pass on the **Exercises MVP (M1–M3)** on branch `feat/exercises-mvp`. Scope:
bundle discovery, age filtering, kid UI (exercises hub, bundle list, bundle player),
multiple-choice and numeric-entry players, TTS speak button, star award / completion
idempotency, the admin birthdate field in the user modal, and the exercise activity
visible in kid history and the admin activity table.

All 174 Vitest tests and all 31 backend `test_exercises.py` pytest tests pass. The core
happy paths work end-to-end (discovery, age filtering, playing both exercise types,
correct/wrong feedback, completion, idempotent star award, WS broadcast). Findings
below are bugs or spec deviations only — items confirmed correct are not listed.

**Totals: 2 Medium bugs · 3 Low bugs · 1 Low risk/smell — all fixed 2026-06-18**

---

## Checklist

- [x] **[Medium][Bug]** Bundle manifest and answer endpoints skip age-appropriateness check — **fixed: `_get_visible_bundle` helper gates all four endpoints via `visible_bundles()`** — see #1
- [x] **[Medium][Bug]** `exercise_complete` label shown as raw string in kid history — **fixed: added `exercise_complete` branch in `getActionLabel()` + `history.action_exercise` translation key** — see #2
- [x] **[Low][Bug]** `exercise_complete` missing from admin Activity filter dropdown and shown in English — **fixed: added to `actionTypes` in `ActivityPage.tsx` + `history.action_label_exercise` translation key** — see #3
- [x] **[Low][Bug]** No CSS rule for `.mc-options.mc-count-4` (four-option multiple-choice layout) — **fixed: added explicit `repeat(2, 1fr)` rule in `Exercises.css`** — see #4
- [x] **[Low][Bug]** Speak buttons invisible on exercise prompt and hint — missing `position: relative` on `.exercise-prompt` and `.exercise-hint` — **fixed in `Exercises.css`** — see #6
- [x] **[Low][Risk]** M4 exercise types (`match_pairs`/`ordering`/`counting`) silently render as broken `MultipleChoicePlayer` if included in a bundle — **fixed: explicit `unsupported_type` branch renders a translated placeholder instead of falling through to `MultipleChoicePlayer`** — see #5

---

## Details

### 1. Bundle manifest and answer endpoints skip age-appropriateness check

- **Type / Severity:** Bug / Medium
- **Spec:** "A kid sees bundles where `age_min ≤ age(today) ≤ age_max`"
  (PLAN.md §2, age-targeting section). The list endpoint (`GET /api/exercises/bundles`)
  correctly filters by age. The individual endpoints do not.
- **Expected:** `GET /api/exercises/bundles/{bundle_id}`, `GET /api/exercises/assets/…`,
  `GET /api/exercises/tts/…`, and `POST /api/exercises/bundles/{bundle_id}/answers`
  should all return 404 (or 403) when the bundle's age range does not include the
  requesting kid's age. A kid with no birthdate should also get 404.
- **Actual:** All four endpoints succeed for any authenticated kid regardless of age.
  Verified via API: Ελένη (age 4, birthdate `2022-06-18`) is correctly excluded from the
  bundle list for `prosthesi-afairesi` (age 6–9), but `GET /api/exercises/bundles/prosthesi-afairesi`
  returns the full kid-view manifest (HTTP 200) and
  `POST /api/exercises/bundles/prosthesi-afairesi/answers` accepts and grades her answers.
  The star award also fires, crediting stars for a bundle outside her age range.
  Evidence: `backend/app/api/exercises.py:69–78` (`get_bundle_manifest`) and `:135–165`
  (`post_answer`) — neither calls `visible_bundles()` or checks `user.birthdate`.
- **Reproduction (by code inspection + API call):**
  1. Set Ελένη's birthdate to `2022-06-18` (age 4) — `prosthesi-afairesi` is age 6–9.
  2. Login as Ελένη (PIN 4444).
  3. `GET /api/exercises/bundles` → 0 age-appropriate bundles, `prosthesi-afairesi` absent.
  4. `GET /api/exercises/bundles/prosthesi-afairesi` → HTTP 200 with full manifest.
  5. `POST /api/exercises/bundles/prosthesi-afairesi/answers` with `{"exercise_id":"ex-01","response":5}` → HTTP 200, `correct: true`.
- **Notes:** Fix: in `get_bundle_manifest`, `get_asset`, `get_exercise_tts`, and
  `post_answer`, call `visible_bundles(current_user)` (or an equivalent age check) and
  raise HTTP 404 if the requested bundle is not in the result.

---

### 2. `exercise_complete` label shown as raw string in kid history

- **Type / Severity:** Bug / Medium
- **Spec:** Invariant #4 — "the kid sees [the star delta] in their timeline" — implies the
  timeline entry should be human-readable. Invariant #5 — all user-visible strings through
  the translation layer. PLAN.md §4 API section says `HistoryLedger` rows for exercises are
  surfaced "so the kid timeline … show exercise stars with zero new UI plumbing."
- **Expected:** In the kid's History tab (`/dashboard/history`), exercise completion entries
  show a translated label such as "Ολοκλήρωσες ασκήσεις!" (Greek) or "Completed exercises"
  (English), matching the style of other entries ("Εγκρίθηκε", "Αγόρασε: …").
- **Actual:** The entry displays the raw `action_type` string **`exercise_complete`**
  (untranslated, technical identifier) as the action label. Verified in the live UI at
  `/dashboard/history` — ref `e21` in the snapshot: `generic [ref=e21]: exercise_complete`.
- **Reproduction:**
  1. Complete any exercise bundle as a kid (stars must be > 0).
  2. Navigate to `/dashboard/history`.
  3. Observe the entry for the exercise completion — the "action" column shows `exercise_complete`.
- **Root cause:** `KidHistory.tsx:16–22` — `getActionLabel()` has no branch for
  `action_type === 'exercise_complete'`, so the fallback `return entry.action_type` fires.
  No translation key `history.action_exercise_complete` exists in `translations.py`.
- **Fix:** Add an `exercise_complete` case in `getActionLabel()` pointing to a new
  translation key (e.g. `history.action_exercise`), and add the key to `translations.py`.

---

### 3. `exercise_complete` missing from admin Activity filter and shown in English

- **Type / Severity:** Bug / Low
- **Spec:** "Kid exercise activity surfaced in the existing Activity table via `action_label`"
  (PLAN.md §5, M5 admin panel). Although M5 is not fully implemented, the activity *data*
  is already visible in the admin table since M2 wrote ledger rows. The label and filter
  should be consistent with other action types.
- **Expected:**
  a. The "Ενέργεια" filter dropdown in `/admin/activity` includes an option for exercise
     completions so admins can filter by them.
  b. The action label column for exercise completion rows shows a translated Greek string
     (e.g. "Ολοκλήρωση άσκησης") matching all other action labels in that table.
- **Actual:**
  a. The filter dropdown (`e80`) offers: "Έγκριση δουλειάς", "Απόρριψη δουλειάς",
     "Χειροκίνητη ρύθμιση αστέρων", "Αγορά βραβείου", "Επιστροφή βραβείου" — no exercise
     option. Confirmed in the snapshot at ref `e80`.
  b. The action label cell (`e147`) shows **"Completed exercises"** (hardcoded English
     from `admin.py:601`) while all other rows show Greek labels via `translations.py`.
- **Reproduction:**
  1. Complete a bundle as a kid.
  2. Login as admin, navigate to `/admin/activity`.
  3. Observe the entry — action column shows "Completed exercises" in English.
  4. Open the "Ενέργεια" filter — no option for exercise completions.
- **Root cause:** `ActivityPage.tsx:12–16` — `actionTypes` array does not include
  `{value: 'exercise_complete', key: 'history.action_label_exercise'}`. No translation key
  `history.action_label_exercise` exists in `translations.py`.
- **Fix:** Add `{value: 'exercise_complete', key: 'history.action_label_exercise'}` to
  `actionTypes` in `ActivityPage.tsx` and add the translation key to `translations.py`
  with both Greek and English values.

---

### 4. No CSS rule for `.mc-options.mc-count-4` (four-option multiple-choice layout)

- **Type / Severity:** Bug / Low
- **Spec:** The Pydantic validator (`MultipleChoiceExercise`) accepts 2–4 options
  (milestones-1-3.md M1: "2–4 options"). PLAN.md §3: "2–4 options".
- **Expected:** When a `multiple_choice` exercise has 4 options, the layout uses an
  appropriate grid — e.g. `grid-template-columns: repeat(2, 1fr)` (2×2) or
  `repeat(4, 1fr)` (1×4), explicitly defined.
- **Actual:** `Exercises.css` defines `.mc-options.mc-count-3` (3-column grid) but has
  no `.mc-options.mc-count-4` rule. For 4 options, the class `mc-count-4` is applied
  but no CSS matches it, so the default 2-column grid inherited from `.mc-options` is
  used — resulting in a 2×2 layout with no explicit specification.
  Evidence: `Exercises.css:181–189` (only one `mc-count-N` override present).
- **Reproduction (by code inspection):**
  1. Create a bundle with a `multiple_choice` exercise that has 4 options.
  2. Navigate to that exercise in the player.
  3. The 4 options render in a 2-column grid — CSS applied is the default `.mc-options`
     rule, not a dedicated 4-column rule.
- **Notes:** The 2×2 fallback is visually acceptable but was not designed explicitly.
  No current sample bundle triggers this path (all use 3 options). Add
  `.mc-options.mc-count-4 { grid-template-columns: repeat(2, 1fr); }` to make the
  intent explicit and tablet-safe.

---

### 5. M4 exercise types render as broken `MultipleChoicePlayer` if included in a bundle

- **Type / Severity:** Risk / Low
- **Spec:** "match_pairs`, `ordering`, `counting` validate and list but their players
  land in M4." (PLAN.md §5 M3 notes, CLAUDE.md features section).
- **Expected:** If a bundle containing `match_pairs`, `ordering`, or `counting` exercises
  were dropped into `EXERCISES_DIR`, the app would either skip those exercises gracefully,
  show a "coming soon" placeholder, or block the bundle from appearing in the kid tab.
- **Actual:** `BundlePlayer.tsx:115–129` uses a binary branch:
  `exercise.type === 'numeric_entry' ? <NumericEntryPlayer> : <MultipleChoicePlayer>`.
  Any exercise that is not `numeric_entry` renders as `MultipleChoicePlayer`. A
  `match_pairs` exercise has `pairs` not `options`, so `MultipleChoicePlayer` receives
  `exercise.options = undefined`, renders zero buttons, and the kid cannot answer.
  The exercise player is silently broken rather than showing an explicit "not yet
  available" message. The validator accepts all 5 types, so a dropped bundle containing
  M4 types would appear in the kid's tab but be unplayable without any feedback.
- **Reproduction (by code inspection + validator):**
  1. Create a `match_pairs` bundle directory in `EXERCISES_DIR` — the validator accepts it.
  2. Set a kid's birthdate to be within the bundle's age range.
  3. Navigate to that bundle — the player shows 0 options with no error or message.
- **Notes:** No current sample bundle triggers this. The risk activates the moment someone
  drops a bundle with M4 types before M4 ships. Mitigation: add an explicit
  `exercise.type === 'match_pairs' || ...` branch in `BundlePlayer.tsx` that renders a
  "coming soon" / skip UI instead of falling through to `MultipleChoicePlayer`.

---

### 6. Speak buttons invisible on exercise prompt and hint ✅ FIXED

- **Type / Severity:** Bug / Low
- **Root cause:** `.speak-btn` uses `position: absolute` (designed for the flip-card
  context). Neither `.exercise-prompt` nor `.exercise-hint` had `position: relative`,
  so the button escaped both flex containers and rendered relative to a distant ancestor
  — out of sight.
- **Fix:** Added `position: relative` to `.exercise-prompt` and `.exercise-hint` in
  `Exercises.css`. The speak button now anchors to the top-right corner of each box,
  matching the chore/reward card pattern.
