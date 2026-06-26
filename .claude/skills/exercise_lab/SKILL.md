---
name: exercise_lab
description: Run a step of the exercise-bundle generation workflow under exercise_lab/. Use when asked to scan school material, collect exercise ideas, or generate exercise bundles, or when the user invokes /exercise_lab with a step.
argument-hint: <step: scan|ideas|generate|verify|1|2|3|4> [grade] [course] [count stars difficulty]
---

# Exercise Lab workflow

The user wants to run a step of the exercise-bundle generation workflow.

**First, read `exercise_lab/README.md` in full** — it is the authoritative guide
for all exercise-generation work (the field conventions, content guidelines, and
the multi-step process). Do not skip it; the conventions there are load-bearing
and not derivable from the code.

## Resolve the requested step from the arguments

The arguments are: `$ARGUMENTS`

- Step selector: `$1` — one of `scan`/`1`, `ideas`/`2`, `generate`/`3`, `verify`/`4`.
- Optional `$2` = grade (mirrors a `books/` folder name, e.g. `Γ_ΤΑΞΗ_ΔΗΜΟΤΙΚΟΥ`).
- Optional `$3` = course (e.g. `glossa`, `mathimatika`, `magic_book`).
- **Generate-only batch parameters** (ignored for `scan`/`ideas`):
  - `$4` = **count** — number of bundles to create in this run.
  - `$5` = **stars** — stars awarded for completing each bundle.
  - `$6` = **difficulty** — difficulty level 1–5 for the bundles.

Map the selector to the README's **Process** section and follow **only that step**:

| Selector | README step | What it does |
|---|---|---|
| `scan` / `1` | Step 1 — *Scan the material* | Read the book PDFs, write per-chapter notes to `notes/<grade>/<course>/chapter_<id>.md` (PDF page indices), maintain `progress.md`, fan chapter reading out to Sonnet subagents. Stop and wait for the user before step 2. |
| `ideas` / `2` | Step 2 — *Collect exercise ideas* | Build one `notes/<grade>/<course>/ideas.md` checklist with per-chapter entries. |
| `generate` / `3` | Step 3 — *Generate bundles* | Create **`$4` bundles**, each awarding **`$5` stars** at **difficulty `$6`**, fanning generation out to Sonnet subagents into `bundles/<grade>/<course>/`, validating each with `cd backend && python -m app.schemas.exercises ../exercise_lab/bundles/<grade>/<course>/<id>-v<version>` until it exits 0. |
| `verify` / `4` | Step 4 — *Verify the generated bundles* | Proof-read every human-visible string in `bundles/<grade>/<course>/` for Greek spelling/accent/grammar mistakes (Sonnet's weak spot) and fix them in place, re-validating each edited bundle. **Use the orchestrating (strong) model directly — do NOT fan this out to a Sonnet subagent**, and re-run the validator after edits. |

### Step 3 batch parameters

When running `generate`, treat `$4`/`$5`/`$6` as the batch guidance the README's
Step 3 says to "gather up front" before the fan-out:

- **count (`$4`)** — pick that many distinct exercise ideas from
  `notes/<grade>/<course>/ideas.md`, checking `bundles/<grade>/<course>/progress.md`
  first to avoid duplicating already-generated bundles, and spawn one subagent per
  bundle.
- **stars (`$5`)** — set each manifest's star reward to this value.
- **difficulty (`$6`)** — set each manifest's `difficulty` field (1–5) to this value.

If any of `$4`/`$5`/`$6` is missing for a `generate` run, **ask the user** for it
before spawning subagents — do not guess these, the step is explicitly *guided*.

If `$1` is missing or unrecognized, ask the user which step to run (scan / ideas /
generate / verify) rather than guessing. If grade/course are missing but the step needs
them, ask or infer from `exercise_lab/books/` and the current `notes/`/`bundles/`
state.

Then carry out that step exactly as the README describes — including its subagent
fan-out, `progress.md` ledger, field conventions, and content guidelines.
