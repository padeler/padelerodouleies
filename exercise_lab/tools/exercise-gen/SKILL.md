---
name: exercise-gen
description: Generate an age-targeted exercise bundle (manifest.json + image assets) for the padelerodouleies kids app from school material (photos/PDFs/notes) plus a target age and subject. Produces a validator-clean bundle directory. Use on a dev machine only — the production container never calls an LLM.
---

# Exercise bundle generator

Turn real school material into a self-contained **exercise bundle** the kids play
in the "Ασκήσεις" tab. The output is a directory (`manifest.json` + `assets/`)
that loads clean in the app because it passes the **same validator** the container
uses. This skill runs on a dev machine; the production image never generates
content (PLAN.md §1).

## Contract (do these in order)

1. **Read the normative spec** [`docs/EXERCISE_FORMAT.md`](../../../docs/EXERCISE_FORMAT.md).
   The Pydantic models in `backend/app/schemas/exercises.py` are its source of
   truth — when in doubt, the models win.
2. **Collect inputs** from the user:
   - source material: image/PDF/text file paths (photos of the actual worksheet,
     scans, or typed notes) — the school textbook PDFs live under
     `exercise_lab/books/` (git-ignored),
   - **target kid age** (drives `age_min`/`age_max`),
   - **subject** — one of the closed enum: `language`, `math`, `geography`,
     `history`, `logic`, `nature`.
3. **Author the manifest** following the format and the content rules below. Use
   the per-type snippets in [`templates/`](./templates/) as the shape reference —
   they cover all five exercise types.
4. **Produce assets**: cropped photos of the real material **and/or** generated
   illustrations (both first-class). Put them under `assets/`, referenced by
   bare filename (no `/`, no `..` — the validator rejects traversal).
5. **Validate and iterate** until it exits 0:
   ```bash
   cd backend && python -m app.schemas.exercises <path-to-bundle-dir>
   ```
   A bundle that generates clean must load clean. Fix every reported field and
   re-run; never hand back a bundle you have not validated.

## Bundle layout

```
<id>-v<version>/
  manifest.json
  assets/
    <image>.png        # images only — audio is synthesized at runtime by Piper TTS
```

`(id, version)` is the bundle identity; corrections ship as a **new version**, not
an in-place edit (bundles are immutable once dropped). Drop the dir into
`EXERCISES_DIR` (dev `backend/data/exercises`, prod
`/mnt/raid/padelerodouleies/data/exercises`) and the app discovers it on the next
request (admin "Rescan" button forces it immediately).

## Content rules (enforce in the text, don't just pass the validator)

- **Mono-script per bundle.** A Greek bundle's text is Greek-only; an English
  bundle's text is English-only — never blended in one string. The validator
  rejects mixed Greek/Latin letters because Piper has no per-word language
  switching (one fixed G2P per voice). If a concept needs a foreign term, respell
  it in the bundle's own script.
- **Correct τόνος on Greek.** espeak-ng leans on the written accent for stress.
  Where a word still reads wrong (rare words, abbreviations, digit-only prompts),
  add a spoken override: `prompt_tts` / `hint_tts` is *read aloud* while
  `prompt` / `hint` is *displayed*. Example: a `numeric_entry` prompt `"2 × 3 = ?"`
  is script-neutral digits, so add `"prompt_tts": "δύο επί τρία"`.
- **Pre-readers (≈4 years).** Use **image-only options** and lean on the spoken
  prompt — every prompt/hint gets a 🔊 speaker button for free (TTS is synthesized
  on tap). Do not require reading.
- **Anti-guessing.** Prefer 3–4 options over 2 for `multiple_choice` (options are
  shuffled per render server-side; more options = less brute-forcing).
- **Images small and fast.** The kids use old Samsung Tab 4 tablets. Keep assets
  small (≈256 px, PNG, tens of KB), pre-cropped/pre-scaled. The validator checks
  existence + path-traversal; sizing is a performance guideline you must follow
  even though it is not byte-enforced.

## Exercise types (all five are playable as of M4)

| Type | `answer` shape | Notes |
|---|---|---|
| `multiple_choice` | option `id` (string) | 2–4 options, text and/or image |
| `numeric_entry` | integer (exact) | digits/operators prompt; add `prompt_tts` for a spoken reading |
| `counting` | integer (exact) | one scene `image`; kid taps `0..max_count` |
| `ordering` | list of item `id`s in order | 3–5 items; `answer` must list exactly the item ids |
| `match_pairs` | implicit (each `left` ↔ its own `right`) | 2–6 pairs; right column shuffled at play time |

The `answer` (and the `*_tts` fields) are **stripped from the kid view** — they
never reach the browser. Grading is deterministic and server-side.

## Reference samples

`backend/scripts/make_sample_bundles.py` emits one or more bundles per type under
`samples/exercises/` and validates each as it writes — read it for working,
validator-clean examples of every type (including the Pillow asset drawers for
`counting` scenes). Regenerate with `cd backend && python -m scripts.make_sample_bundles`.

See [`README.md`](./README.md) for the end-to-end run-through and where bundles land.
