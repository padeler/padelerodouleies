# exercise-gen — dev-machine bundle generator

A Claude Code project skill that turns school material into a validator-clean
**exercise bundle** for the kids' "Ασκήσεις" tab. **Dev-machine only** — the
production container never calls an LLM (PLAN.md §1); it just discovers the
finished bundle directories on disk.

## What it produces

A bundle directory:

```
<id>-v<version>/
  manifest.json      # the exercise definitions (the single source of content)
  assets/            # PNG images: cropped photos and/or generated illustrations
```

Audio is **not** generated — prompts/hints are spoken at runtime by the
container's Piper TTS straight from the manifest text, so the generator only
writes good prompt text (see the content rules in [`SKILL.md`](./SKILL.md)).

## Inputs

- Source material: photo / scan / PDF / typed-notes file paths — the school
  textbook PDFs live alongside this skill under `exercise_lab/books/` (git-ignored).
- Target kid **age** → `age_min` / `age_max`.
- **Subject** (closed enum): `language`, `math`, `geography`, `history`, `logic`,
  `nature`.

## How to run

This is a skill, not a script — drive it with Claude Code:

1. Point Claude at the source material and state the target age + subject.
2. The skill reads [`docs/EXERCISE_FORMAT.md`](../../../docs/EXERCISE_FORMAT.md),
   authors `manifest.json` (shapes in [`templates/manifest.template.jsonc`](./templates/manifest.template.jsonc),
   covering all five types), and writes the image assets.
3. It validates and iterates until clean:
   ```bash
   cd backend && python -m app.schemas.exercises <path-to-bundle-dir>
   ```
   Exit 0 = the bundle loads in the app.

## Where bundles land

Copy the validated `<id>-v<version>/` directory into `EXERCISES_DIR`:

- **dev:** `backend/data/exercises/`
- **prod (NAS):** `/mnt/raid/padelerodouleies/data/exercises/`

Set a kid's birthdate (admin user modal) so the age gate lets them see it, then
play it through. The admin **Rescan** button forces immediate re-discovery.

## Reference content

`backend/scripts/make_sample_bundles.py` emits validator-clean bundles for **every**
type under `samples/exercises/` (see [`samples/exercises/README.md`](../../../samples/exercises/README.md)).
Read it for concrete, working examples — including the Pillow drawers for
`counting` scene images.
