# Exercise Lab

In this folder you find the tools and material needed to produce exercise bundles
for the padelerodouleies application.

Material is stored under the **./books/** folder. It is organized by school year,
and each year holds multiple PDF books for that year's courses.

For example the folder
- `books/Γ_ΤΑΞΗ_ΔΗΜΟΤΙΚΟΥ`

contains the books for
- Glossa (Greek language)
- Istoria (History)
- Mathimatika (Math)
- Meleti Perivalontos (Environment studies)
- Magic Book (English language)

The goal is to produce exercise bundles for each course with:
- varying difficulty levels
- spanning the whole course (multiple PDFs)
- following the bundle format spec in
  [../docs/EXERCISE_FORMAT.md](../docs/EXERCISE_FORMAT.md) — the Pydantic models in
  `backend/app/schemas/exercises.py` are its source of truth.

## Layout

- `books/` — source textbook PDFs, by school year (git-ignored).
- `notes/<grade>/<course>/` — per-chapter notes plus an `ideas.md` checklist
  (working artifacts, tracked in git). `<grade>` mirrors the `books/` folder
  name (e.g. `Γ_ΤΑΞΗ_ΔΗΜΟΤΙΚΟΥ`), so the same course name (e.g. `glossa`) can
  exist under multiple grades without collision.
- `bundles/<grade>/<course>/` — the generated bundle directories (the output).
- `templates/manifest.template.jsonc` — annotated reference manifest covering all
  five exercise types.

## Bundle field conventions

Some manifest fields can't be read straight off the page — set them as follows.

- **`subject`** is a closed enum; map the course to it:

  | Course | `subject` |
  |---|---|
  | Glossa (Greek language) | `language` |
  | Magic Book (English language) | `language` |
  | Mathimatika | `math` |
  | Istoria | `history` |
  | Meleti Perivalontos | `nature` |

  (`geography` and `logic` also exist in the enum but have no course here.)

- **`age_min`/`age_max`** come from the school year of the source folder — age is
  the *only* visibility driver (a kid whose age falls outside the range never sees
  the bundle). Map the year to an age window:

  | School year | Ages |
  |---|---|
  | Α΄ Δημοτικού | 6–8 |
  | Β΄ Δημοτικού | 7–9 |
  | Γ΄ Δημοτικού | 8–10 |
  | Δ΄ Δημοτικού | 9–11 |
  | Ε΄ Δημοτικού | 10–12 |
  | ΣΤ΄ Δημοτικού | 11–13 |

  Widen by a year on either side only when the material clearly suits a broader range.

- **Language is mono-script per *string*** — the validator rejects any single
  `prompt`/`hint`/`text` that mixes Greek and Latin letters (Piper has one fixed
  pronunciation per voice, so a blended string mis-reads the minority script).
  Digits, operators and punctuation are script-neutral. There is **no per-bundle**
  restriction, so a single bundle may freely contain both Greek and English
  strings — just never both scripts inside one string.
  - Generate Greek by default. **Magic Book (English) bundles** are English, and
    **may blend** by putting each language in its own string — this is how
    "translate the word" exercises work:
    - `match_pairs` with Greek words in one column and their English equivalents in
      the other (`left.text: "μήλο"` ↔ `right.text: "apple"`).
    - `multiple_choice` with an all-Greek prompt and English options (or the
      reverse): `prompt: "Πώς λέγεται στα αγγλικά;"` + English options, or
      `prompt: "Translate to Greek"` + Greek options. Use an image (no text) for
      the word being translated to avoid putting it in the prompt string.
  - Add `prompt_tts`/`hint_tts` spoken overrides wherever Piper would mis-read a
    token (digits, operators, respelled or re-accented words).

- **`id` / `version`**: `id` is stable across versions and `(id, version)` is the
  bundle's identity; bump `version` to supersede a bundle. Name the bundle
  directory after `<id>-v<version>` (e.g. `glossa-gramma-a-v1/` for
  `id: glossa-gramma-a`, `version: 1`) so reruns don't collide.

## Process

Producing exercise bundles is a multi-step process. For each course:

1. **Scan the material.** For each chapter, write notes about the covered
   material, in markdown, to `notes/<grade>/<course>/chapter_<id>.md`. Always
   keep references back into the PDF (page, paragraph, or image) for later use.

   A course often has several PDFs, and a PDF often has several chapters. Reading
   PDF pages is token-heavy (the `Read` tool takes up to 20 pages per call), so
   **fan the per-chapter reading out to subagents** — this keeps the orchestrator's
   context lean and lets chapters run in parallel. The orchestrator:

   - Does a cheap structure pass first (table of contents / page headers) to
     enumerate each PDF's chapters and their page ranges — you can't assign a
     chapter to a subagent before you know its bounds.
   - Writes `notes/<grade>/<course>/progress.md` listing every PDF and chapter as
     pending / WIP / done, and keeps it updated as subagents return.
   - Spawns one subagent per chapter, using the Sonnet model (pass
     `model: "sonnet"` to the Agent tool — the per-spawn override is enough, no
     custom agent definition needed). Each subagent starts cold, so its prompt
     must spell out everything it needs:
     - the source PDF (absolute path) and the chapter's page range;
     - the exact output path (`notes/<grade>/<course>/chapter_<id>.md`) and the
       note format;
     - the rule to keep page/paragraph/image references back into the PDF.
   - Once every chapter of a PDF is done, verifies the notes are consistent (all
     chapters covered, refs resolve), then marks the PDF done in `progress.md`.

   Stop and wait for user instructions before moving on to step 2.

2. **Collect exercise ideas.** Build one `notes/<grade>/<course>/ideas.md` checklist with
   per-chapter entries.
   - Keep each entry simple, e.g. `chapter_<id> - basic addition exercises`.
   - Multiple exercises can come from a single hint.

3. **Generate bundles** into `bundles/<grade>/<course>/`, drawing on the notes + ideas and
   pulling images from the PDFs where needed. This is a **guided** step — the user
   supplies extra information such as the difficulty level and the number of stars
   rewarded.
   - Follow the **Bundle field conventions** above and copy the shapes you need
     from `templates/manifest.template.jsonc`.
   - **Assets** (`<bundle>/assets/`): crop the real page art and/or generate
     illustrations — both are first-class. Keep images small (a few hundred px on
     the long edge, web-optimized PNG/JPG) so they render fast on the old LAN
     tablets (Samsung Tab 4). The validator only checks that every referenced asset
     exists and stays inside `assets/`; image *size* is a performance concern, not
     a validation gate, so keep it lean yourself.
   - This step can run multiple times to add more bundles — watch `bundles/` to
     avoid duplicates (similar is fine).

   Like step 1, **fan the per-bundle generation out to subagents** — one bundle per
   subagent keeps the orchestrator's context lean and lets bundles run in parallel
   (each owns a distinct `<id>-v<version>/` dir, so parallel writes never collide).
   Because this step is *guided*, the orchestrator must **gather the guidance up
   front for the whole batch** (which ideas become bundles, and each one's
   difficulty + star count) — you can't prompt the user mid-fan-out. Then:

   - Maintains `bundles/<grade>/<course>/progress.md` listing every planned bundle
     (its `<id>-v<version>`, source idea, difficulty, stars) as pending / WIP /
     done, updated as subagents return. This is also the dedup ledger — check it
     before spawning so two subagents don't generate near-identical bundles.
   - Spawns one subagent per bundle, using the Sonnet model (pass
     `model: "sonnet"` to the Agent tool — the per-spawn override is enough, no
     custom agent definition needed). Each subagent starts cold, so its prompt must
     spell out everything it needs:
     - the exercise idea(s) from `ideas.md` this bundle covers, and the
       user-supplied **difficulty + star count**;
     - the source PDF (absolute path) and the page/image refs (from the chapter
       notes) it should crop page art from;
     - the resolved `subject` and `age_min`/`age_max` (per the **Bundle field
       conventions** tables), the mono-script-per-string rule, the
       `<id>-v<version>/` dir-naming rule, and the
       `templates/manifest.template.jsonc` path;
     - the exact output dir `bundles/<grade>/<course>/<id>-v<version>/`;
     - the mandate to **run the same validator the container uses on its own bundle
       and iterate until it exits 0 before returning** — so defects are fixed in the
       subagent, not surfaced later in the orchestrator:

       ```
       cd backend && python -m app.schemas.exercises ../exercise_lab/bundles/<grade>/<course>/<id>-v<version>
       ```

   A bundle that generates clean must load clean. To play-test it, copy the dir
   into `EXERCISES_DIR` and set a kid's birthdate — see
   [../samples/exercises/README.md](../samples/exercises/README.md) ("How to test").
