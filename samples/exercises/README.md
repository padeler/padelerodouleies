# Sample exercise bundles

Ready-to-deploy bundles for testing the kids' **Ασκήσεις** tab end-to-end. They
cover the two MVP-playable exercise types (`multiple_choice` + `numeric_entry`)
across all six subject groups and overlapping age bands.

| Bundle | Subject | Ages | Type(s) |
|---|---|---|---|
| `eikones-glwssa-v1` | language | 4–6 | image-option multiple_choice |
| `syllaves-glwssa-v1` | language | 6–9 | numeric_entry + multiple_choice |
| `prosthesi-afairesi-v1` | math | 6–9 | numeric_entry + multiple_choice |
| `pollaplasiasmvos-v1` | math | 8–11 | numeric_entry + multiple_choice |
| `ta-zwa-v1` | nature | 4–7 | multiple_choice |
| `epoces-fysis-v1` | nature | 5–8 | multiple_choice + numeric_entry |
| `motiva-logiki-v1` | logic | 5–8 | multiple_choice |
| `arithmitika-motiva-v1` | logic | 7–10 | numeric_entry + multiple_choice |
| `ellada-geografia-v1` | geography | 8–12 | multiple_choice + numeric_entry |
| `eyropi-geografia-v1` | geography | 9–13 | multiple_choice + numeric_entry |
| `arxaia-ellada-v1` | history | 9–13 | multiple_choice + numeric_entry |
| `epanastasi-1821-v1` | history | 10–14 | numeric_entry + multiple_choice |

Content is Greek (the default locale); the speaker button reads each prompt/hint
via the in-container Piper TTS. Math bundles carry `prompt_tts` overrides so
digit expressions are read aloud in Greek.

> Only `multiple_choice` and `numeric_entry` are playable in the current MVP
> (M3). `counting` / `ordering` / `match_pairs` arrive in M4 — don't add bundles
> using them yet.

## Deploy

A bundle is just a directory (`manifest.json` + `assets/`). Drop it into the
exercises folder under the data volume; discovery is automatic (scan-on-request,
mtime-cached — no restart, no redeploy, no DB import).

**Local dev** (backend's default `EXERCISES_DIR` is `backend/data/exercises`):

```bash
mkdir -p backend/data/exercises
cp -r samples/exercises/*-v1 backend/data/exercises/
```

**Production NAS** (the `/app/data` bind mount → `/mnt/raid/padelerodouleies/data`):

```bash
mkdir -p /mnt/raid/padelerodouleies/data/exercises
cp -r samples/exercises/*-v1 /mnt/raid/padelerodouleies/data/exercises/
```

Then **set each kid's birthdate** in the admin Users modal (Διαχειριστής →
Χρήστες → edit). Age targeting is derived from the birthdate at request time; a
kid with no birthdate set sees no exercises. For the table above:
- age 4–6 → sees language (images) + nature bundles
- age 6–9 → sees all of the above + language (syllables) + math (basic)
- age 8–11 → additionally geography (Greece) + math (multiplication)
- age 9–13 → additionally geography (Europe) + history (ancient Greece)
- age 10–14 → all 12 bundles visible

## Regenerating / authoring

These were produced (and validated) by
`backend/scripts/make_sample_bundles.py`. Re-run it to regenerate:

```bash
cd backend && python -m scripts.make_sample_bundles
```

Note: the script deletes `samples/exercises/` before recreating it — this
`README.md` is checked in but **not** recreated by the script; restore it from
git if needed (`git checkout -- samples/exercises/README.md`).

Validate any hand-written bundle against the canonical schema before deploying:

```bash
cd backend && python -m app.schemas.exercises <bundle-dir>
```

See [`docs/EXERCISE_FORMAT.md`](../../docs/EXERCISE_FORMAT.md) for the full
format spec.
