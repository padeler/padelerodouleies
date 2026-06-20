# Exercise Bundle Format (`schema_version: 1` / `2`)

Normative spec for exercise **bundles** — the self-contained, offline-generated
units the kids' "Ασκήσεις" tab plays. The Pydantic models in
`backend/app/schemas/exercises.py` are the **single source of truth**; this
document describes them. A bundle that validates against those models loads in
the app, and the M6 generation tool runs the same validator before emitting a
bundle.

## Directory layout

A bundle is a **directory** (not a zip), dropped under the data volume at
`/app/data/exercises/` (dev: `backend/data/exercises/`). Discovery **recurses**,
so a bundle may sit at the top level or nested inside container directories — the
dev workflow nests them as `<grade>/<course>/<bundle>/` to keep production tidy. A
directory holding a `manifest.json` (or an `assets/` folder) is treated as a
bundle and not descended into; any other directory is a container that's walked.

```
exercises/
  2026-06-letters-A-v1/        # top-level bundle
    manifest.json
    assets/
      apple.png        # images only — audio is synthesized server-side from text
      ball.png
  Γ_ΤΑΞΗ_ΔΗΜΟΤΙΚΟΥ/            # container (grade)
    glossa/                    # container (course)
      glossa-gramma-a-v1/      # nested bundle
        manifest.json
        assets/
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
| `schema_version` | int | `1` or `2`; use `2` for bundles with `decimal_entry` or `fraction_entry` exercises |
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

### Exercise-level visuals

Every exercise type supports two optional visual fields:

| Field | Renders | Use when |
|---|---|---|
| `image` | **Full-size scene above the prompt** (16:9 box, before the interactive controls) | The image is *about* the question — book art, a generated illustration, the objects to count. Rendering order: progress dots → scene image → prompt + speaker → player. |
| `icon` | **Small, inline alongside the prompt text** (44 px, semi-transparent) | A decorative Lucide SVG icon used as a visual accent — pairs well with a scene `image`. |

Each field is **either** a path inside `assets/` (a cropped/generated bundle image)
**or** a built-in icon URL `"/api/icons/svg/<name>"`. A built-in icon ships with the
app and is *not* copied into the bundle — the validator verifies the name against the
shipped catalog (fail-explicit on a typo). **Counting exercises require `image`** (the
scene the kid counts items in); for all other types both fields are optional and
default to `null`. Using both `image` and `icon` on one exercise is encouraged (a book
scene plus a topical inline icon).

| Type | Shape | Answer | schema_version | Milestone |
|---|---|---|---|---|
| `multiple_choice` | `image?`, `icon?`, `options`: 2–4 `{id, image?, text?}` (≥1 of image/text) | option `id` (str) | 1 | M3 |
| `numeric_entry` | `image?`, `icon?` | `int` (exact, integers only) | 1 | M3 |
| `counting` | `image` **(required)**, `max_count` (1–99, default 10) | `int` ≤ `max_count` | 1 | M4 |
| `ordering` | `image?`, `icon?`, `items`: 3–5 `{id, image?, text?}` | ordered list of item `id`s | 1 | M4 |
| `match_pairs` | `image?`, `icon?`, `pairs`: 2–6 `{left, right}` options | implicit (each `left`↔its `right`) | 1 | M4 |
| `decimal_entry` | `image?`, `icon?`, `decimals?` (int, UI hint for keypad places) | `str` matching `^-?\d+([.,]\d+)?$` | **2** | M8 |
| `fraction_entry` | `image?`, `icon?`, `accept_equivalent` (bool, default `true`) | `{numerator: int, denominator: int}` (denominator ≥ 1) | **2** | M8 |

`numeric_entry` is **integers only, exact match** — no decimals, fractions, or
negatives in v1 (`numeric_entry` remains strict-integer even after M8; the new
types isolate decimal/fraction logic without weakening it).
Input reuses the PIN-style number pad (no free-text field, invariant #1 ethos).

### `decimal_entry` (schema_version: 2)

Type a decimal number (δεκαδικός) on a PIN-style keypad extended with a comma
(υποδιαστολή) key. The `answer` is stored as a string in canonical form
(e.g. `"7,57"`) to avoid float precision drift. Both `,` and `.` are accepted by
the grader, and trailing zeros are normalized (`7,50` == `7,5`).

The optional `decimals` field hints to the keypad UI how many decimal places to
expect (cosmetic only — the grader doesn't enforce a fixed decimal count).

Prefer `decimal_entry` over `multiple_choice` of decimal strings when the goal
is **free entry** of the result (e.g. money arithmetic, length conversions).

```jsonc
{
  "id": "d1",
  "type": "decimal_entry",
  "prompt": "3,25 € + 4,32 € = ?",
  "prompt_tts": "τρία κόμμα εικοσιπέντε ευρώ συν τέσσερα κόμμα τριάντα δύο ευρώ",
  "answer": "7,57",
  "decimals": 2
}
```

### `fraction_entry` (schema_version: 2)

Enter a fraction (κλάσμα) by typing numerator and denominator on separate tap
targets that share one on-screen number keypad. Posts `{numerator, denominator}`.

`accept_equivalent` (default `true`) grades `6/8` as equal to `3/4` via
cross-multiplication (no float arithmetic). Set to `false` to require an exact
match.

Prefer `fraction_entry` over `multiple_choice` of fraction strings or
`match_pairs` of fractions when the goal is free entry of the fraction itself
(e.g. reading a shaded diagram and expressing what fraction is shaded).

```jsonc
{
  "id": "f1",
  "type": "fraction_entry",
  "prompt": "Τι κλάσμα είναι χρωματισμένο;",
  "image": "shape-3-4.png",
  "answer": {"numerator": 3, "denominator": 4},
  "accept_equivalent": true
}
```

### Options

```jsonc
{ "id": "a", "image": "apple.png", "text": "μήλο" }
```

- `id`: 1–40 chars, unique within the exercise.
- At least one of `image` / `text` is required.
- `image` is a path **relative to `assets/`**; path traversal (`..`, absolute,
  leading `/`) is rejected and the file must exist. The same rules apply to the
  exercise-level `image` and `icon` fields. The one allowed non-`assets/` form is a
  built-in icon URL `"/api/icons/svg/<name>"` (name restricted to `[a-z0-9-]+`).

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
