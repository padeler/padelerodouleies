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
- `templates/icon-catalog-reference.md` — browsable list of all 359 SVG icons
  available to exercises, with English/Greek keywords by category.
- `tools/pdf_crop.py` — PyMuPDF helper that crops a page (or region) of a book PDF
  into a web-optimized PNG asset (`pip install pymupdf`).

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

- **`schema_version`**: use `1` for bundles that only need the five original
  types (`multiple_choice`, `numeric_entry`, `counting`, `ordering`,
  `match_pairs`). Set `schema_version: 2` when the bundle uses `decimal_entry`
  or `fraction_entry` — the validator accepts either version and existing v1
  bundles load unchanged.

- **When to use `decimal_entry` vs alternatives:**
  - Use `decimal_entry` (v2) when the kid must **type** the decimal result
    freely — money arithmetic, measurement conversions, division results with a
    remainder expressed as a decimal.
  - Use `multiple_choice` / `ordering` of decimal strings when the goal is
    *recognising* or *ordering* decimals, not producing them from scratch.
  - Use a unit-converted `numeric_entry` (integer) only when the decimal can be
    expressed exactly as an integer in another unit (e.g. `1,25 m = 125 cm`).
  - `answer` is a **string** in canonical form (`"7,57"` or `"7.57"`); both
    separators are accepted by the grader and trailing zeros are normalised.
    Add a `prompt_tts` spoken override for any expression the Greek voice can't
    read correctly (`"3,25 €"` → `"τρία κόμμα εικοσιπέντε ευρώ"`).

- **When to use `fraction_entry` vs alternatives:**
  - Use `fraction_entry` (v2) when the kid must **enter** the fraction — reading
    a shaded diagram, expressing a part as a fraction, or simplifying a fraction
    by entering its reduced form.
  - Use `multiple_choice` or `match_pairs` when the kid *picks* from given
    fractions rather than constructing one.
  - `accept_equivalent: true` (default) grades `6/8` equal to `3/4` via
    cross-multiplication — appropriate for most recognition exercises. Set `false`
    only when the prompt explicitly asks for a *specific* form (e.g. "write in
    simplest form").
  - The `answer` denominator must be ≥ 1 (negative denominators are not
    representable). For negative fractions put the sign in the numerator.

- **`id` / `version`**: `id` is stable across versions and `(id, version)` is the
  bundle's identity; bump `version` to supersede a bundle. Name the bundle
  directory after `<id>-v<version>` (e.g. `glossa-gramma-a-v1/` for
  `id: glossa-gramma-a`, `version: 1`) so reruns don't collide.

## Content guidelines

These shape *what* a good exercise asks — they are as load-bearing as the field
conventions, and every bundle-generating subagent must be given them.

- **Self-contained questions only.** Never ask anything that requires recalling
  text from the book by heart. A kid is not expected to remember a specific
  passage, a date buried in a paragraph, or "what the story said". If answering
  needs context, **put that context into the question** — quote the short snippet,
  show the picture — so the exercise tests understanding, not
  rote memorisation of the page. This does not apply for things the kid should 
  remember like grammar and spelling.

- **Questions should have an image and/or an icon.** Aim for *most* questions to
  carry a visual at the question level. Visuals make the tab usable for pre-readers
  and far more engaging. The two manifest fields are **complementary, not
  either/or** — render differently and can be used together on the same exercise:

  | Field | Renders | Best for |
  |---|---|---|
  | `"image"` | **Full-size above the prompt** (16:9 scene box) | Book art, generated illustrations, counting scenes — a picture that *is the content* of the question |
  | `"icon"` | **Small, inline alongside the prompt text** | A decorative Lucide SVG accent — a quick visual cue for a text-led question |

  A strong exercise often has **both**: a cropped book illustration in `"image"`
  *and* a small topical `"icon"` next to the prompt. Reach for a real book image
  first (it ties the exercise to material the kid has seen); add an icon as the
  inline accent. The three sources:

  - **Re-use art from the book** → the `"image"` field (the preferred scene source).
    Crop the real page illustrations, diagrams, maps, or photos referenced in the
    chapter notes with the **`tools/pdf_crop.py`** helper (PyMuPDF — `pip install
    pymupdf`), which renders a page or a sub-region to a web-optimized PNG straight
    into the bundle's `assets/`:

    ```
    python exercise_lab/tools/pdf_crop.py \
      "exercise_lab/books/<grade>/<BOOK>.pdf" <pdf-page> \
      exercise_lab/bundles/<grade>/<course>/<id>-v<version>/assets/scene.png \
      --frac 0 0.12 1 0.62 --max-width 520
    ```

    `<pdf-page>` is the PDF page index recorded in the chapter notes (see step 1).
    Use `--frac x0 y0 x1 y1` (page fractions) or `--rect` (PDF points) to crop a
    region; omit both for the full page. Check the result — no white margins, no cut
    text. **Do not crop text as an image** — put any needed text directly in the
    question. Reference it as `"image": "scene.png"` (a bare filename, relative to
    `assets/`).
  - **Generate an image** → the `"image"` field. Draw or illustrate a scene (a number
    line, shapes to count, labelled objects) when the book has nothing suitable.
  - **SVG Icon library** → the `"icon"` field. The app ships with **359 Lucide SVG
    icons** (animals, food, school objects, nature, transport, faces, etc.), already
    served by the running app — **no copying**. Browse
    `templates/icon-catalog-reference.md` (English/Greek keywords by category) to
    find a name, then reference the icon by its **served URL** directly:
    `"icon": "/api/icons/svg/dog"`. The validator accepts this form and checks the
    name against the shipped catalog (fail-explicit on a typo), so the SVG never
    needs to live in the bundle's `assets/`. The same URL works in dev and prod
    (same-origin). You may also use an icon URL anywhere an image ref is accepted
    (e.g. a `multiple_choice` option's `"image"`), but prefer `"icon"` for the
    inline-accent role.

  Keep cropped/generated assets small and web-optimized per the asset rules in
  step 3 below (built-in icons are already optimized).

## Process

Producing exercise bundles is a multi-step process. For each course:

1. **Scan the material.** For each chapter, write notes about the covered
   material, in markdown, to `notes/<grade>/<course>/chapter_<id>.md`. Always
   keep references back into the PDF (page, paragraph, or image) for later use.

   **Always record page references as the PDF page index** (1-based position in the
   file) — the same number the `Read` tool uses to open the page and that
   `pdf_crop.py` takes, so no conversion is ever needed later. The number *printed*
   on the page usually differs (front matter offsets it); ignore the printed folio
   and record the PDF page you actually read.

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
     - the rule to keep page/paragraph/image references back into the PDF,
       **always citing the PDF page index** (1-based file position — the page the
       `Read` tool opened), never the printed book folio.
   - Once every chapter of a PDF is done, verifies the notes are consistent (all
     chapters covered, refs resolve), then marks the PDF done in `progress.md`.

   Stop and wait for user instructions before moving on to step 2.

2. **Collect exercise ideas.** Build one `notes/<grade>/<course>/ideas.md` checklist with
   per-chapter entries.
   - Keep each entry simple, e.g. `chapter_<id> - basic addition exercises`.
   - Multiple exercises can come from a single hint.

3. **Generate bundles** into `bundles/<grade>/<course>/`, drawing on the notes + ideas. 
   Read all markdown files in the `notes/<grade>/<course>/` and especially `ideas.md`. 
   You can find the references to the book pdfs in the `progress.md` and corresponding chapter notes.
   You can pull images from the book PDFs where needed. This is a **guided** step — the user
   supplies extra information such as the difficulty level and the number of stars
   rewarded.
   - Follow the **Bundle field conventions** above and copy the shapes you need
     from `templates/manifest.template.jsonc`.
   - **Assets** — two complementary kinds (see **Content guidelines** above):
     - **Scene images** (`"image"`): crop real page art with `tools/pdf_crop.py`
       and/or generate illustrations into `<bundle>/assets/`. Both are first-class.
       Keep them small (a few hundred px on the long edge, web-optimized PNG/JPG)
       so they render fast on the old LAN tablets (Samsung Tab 4). The validator
       checks that every `assets/` reference exists and stays inside `assets/`;
       image *size* is a performance concern, not a validation gate, so keep it lean.
     - **Inline icons** (`"icon"`): reference a shipped icon by URL
       (`"/api/icons/svg/<name>"`) — **no copy into `assets/`**. The validator
       verifies the name against the catalog. Prefer pairing a book `"image"` with
       a topical `"icon"`.
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
     - the source PDF (absolute path) and the page/image refs (PDF page indices,
       from the chapter notes) it should crop page art from, plus the
       `tools/pdf_crop.py` invocation;
     - the resolved `subject` and `age_min`/`age_max` (per the **Bundle field
       conventions** tables), the mono-script-per-string rule, the
       `<id>-v<version>/` dir-naming rule, and the
       `templates/manifest.template.jsonc` path;
     - the **Content guidelines** above verbatim — self-contained questions (no
       recall-by-heart of book text; fold any needed context into the question)
       and a visual on every question: prefer a cropped book `"image"` (or a
       generated one), plus a topical `"icon"` referenced by URL
       (`"/api/icons/svg/<name>"`, no copy) as the inline accent;
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
