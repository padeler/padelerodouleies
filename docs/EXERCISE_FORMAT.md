# Exercise Bundle Format (`schema_version: 1`)

Normative spec for exercise **bundles** — the self-contained, offline-generated
units the kids' "Ασκήσεις" tab plays. The Pydantic models in
`backend/app/schemas/exercises.py` are the **single source of truth**; this
document describes them. A bundle that validates against those models loads in
the app, and the M6 generation tool runs the same validator before emitting a
bundle.

## Directory layout

A bundle is a **directory** (not a zip), dropped under the data volume at
`/app/data/exercises/<bundle-dir>/` (dev: `backend/data/exercises/`):

```
exercises/
  2026-06-letters-A-v1/
    manifest.json
    assets/
      apple.png        # images only — audio is synthesized server-side from text
      ball.png
```

- The directory name is free-form (convention: `<id>-v<version>`).
- `assets/` holds **images only**. There are **no audio assets** — prompt/hint
  audio is synthesized on demand by the in-container Piper TTS service from the
  manifest text (see [Audio](#audio)).
- A bundle is **immutable** once dropped. To correct it, ship a new directory
  with a bumped `version` (same `id`).

## `manifest.json`

```jsonc
{
  "schema_version": 1,
  "id": "letters-A",        // stable across versions of the same bundle
  "version": 1,             // bump to supersede; (id, version) is the identity
  "title": "Το γράμμα Α",   // single-language, like chores (invariant #5)
  "subject": "language",    // closed enum, see below
  "age_min": 4,
  "age_max": 6,
  "stars": 3,               // award for completing the bundle
  "difficulty": 1,          // 1 (easiest) – 5 (hardest); shown as dots on the kid card
  "exercises": [ /* … */ ]
}
```

### Top-level fields

| Field | Type | Rules |
|---|---|---|
| `schema_version` | int | must equal `1` |
| `id` | str | 1–80 chars; stable across versions |
| `version` | int | ≥ 1; `(id, version)` is the bundle identity |
| `title` | str | 1–200 chars; single-language |
| `subject` | enum | one of `language`, `math`, `geography`, `history`, `logic`, `nature` |
| `age_min` / `age_max` | int | `0 ≤ age_min ≤ age_max ≤ 120` |
| `stars` | int | ≥ 0; awarded once per (kid, bundle, version) on completion |
| `difficulty` | int | 1–5; displayed as filled/empty dots on the kid bundle card; bundles are sorted easier → harder within a subject group |
| `exercises` | list | non-empty; unique exercise `id`s |

`subject` is a **closed enum** so its label can be translated (invariant #5); it
drives navigation only (subject-group cards), never targeting.

## Exercise types

Every exercise has: `id`, `type`, `prompt`, optional `prompt_tts`, optional
`hint`, optional `hint_tts`. Grading is **deterministic and server-side** — the
`answer` never reaches the client (`kid_view` strips it along with the `*_tts`
fields).

| Type | Shape | Answer | Milestone |
|---|---|---|---|
| `multiple_choice` | `options`: 2–4 `{id, image?, text?}` (≥1 of image/text) | option `id` (str) | M3 |
| `numeric_entry` | — | `int` (exact, integers only) | M3 |
| `counting` | `image` (asset), `max_count` (1–99, default 10) | `int` ≤ `max_count` | M4 |
| `ordering` | `items`: 3–5 `{id, image?, text?}` | ordered list of item `id`s | M4 |
| `match_pairs` | `pairs`: 2–6 `{left, right}` options | implicit (each `left`↔its `right`) | M4 |

`numeric_entry` is **integers only, exact match** — no decimals, fractions,
negatives, or tolerance in v1 (a future `schema_version` bump if ever needed).
Input reuses the PIN-style number pad (no free-text field, invariant #1 ethos).

### Options

```jsonc
{ "id": "a", "image": "apple.png", "text": "μήλο" }
```

- `id`: 1–40 chars, unique within the exercise.
- At least one of `image` / `text` is required.
- `image` is a path **relative to `assets/`**; path traversal (`..`, absolute,
  leading `/`) is rejected and the file must exist.

## Audio

Bundles carry **no audio**. The card shows a 🔊 speaker button; on tap the
client hits `GET /api/exercises/tts/{bundle_id}/{exercise_id}/{prompt|hint}.mp3`,
which builds the text server-side and synthesizes it via the existing Piper TTS
service (Piper → ffmpeg → cached mono MP3). The reading language is auto-picked
from the text's script.

### Mono-script rule

Piper has **one fixed language per voice** (no per-word switching), so a string
that mixes Greek and Latin **letters** mispronounces the minority script. The
validator therefore **rejects** any TTS-bound string (`prompt`, `hint`, their
`*_tts` overrides, and option `text`) that contains both Greek and Latin
letters. Digits, operators and punctuation are script-neutral and allowed. The
rule is **per string, not per bundle** — a single bundle may freely contain both
Greek and English strings (e.g. an English-learning bundle with Greek↔English
`match_pairs`, or a Greek prompt with English options); only mixing both scripts
*inside one string* is rejected.

### Spoken-text overrides (`prompt_tts` / `hint_tts`)

The card **displays** `prompt`/`hint`; the speaker button **reads** the matching
`*_tts` value when present (respelled / re-accented / transliterated), else the
displayed text. Use it where espeak-ng's Greek G2P misreads a word, or to give a
spoken rendition of a digits-only expression (e.g. `"2 * 3"` →
`"δύο επί τρία"`). The TTS cache key hashes the exact text synthesized, so it
stays correct.

## Validating a bundle

```bash
cd backend
python -m app.schemas.exercises <bundle-dir>
```

Exits `0` and prints `OK: …` on success; exits non-zero with the offending
path + field on failure (the M6 generator iterates against this).

## Versioning

The format is versioned by the top-level `schema_version`. New, backward-
incompatible shapes bump it; the single shared validator keeps old bundles
loading or failing **loudly**, never silently misrendering. Content corrections
bump the bundle's own `version` (not `schema_version`).
