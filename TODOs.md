# TODOs


## Bugs:

- [x] More issues on the dark mode (verify with playwright)
  - [x] speaker icos have poor contrust — brightened the speaker in the exercise player (Exercises.css dark override)
  - [x] in exercise cards the text is unreadable (white on white) — pinned the light text palette on the bundle/group cards

- [x] Speaker icon is not visible on the "match" exercises — match items now render a speaker below each text item (like ordering/MC)
- [x] Multiple choise with long answers should align on a single column to make text easier to read — `mc-single-col` when a text-only option exceeds 18 chars
- [x] speaker icon on ordering exercises is not working — the 32px speaker overlapped the tiny tray item; now a compact speaker sits below the item, clearly visible and tappable
- [x] on exercise questions that have numberical input and show a keypad the "submit" button has no vertical separation from the keypad buttons. It is ugly (verify with playwright) — submit moved out of the keypad grid into a full-width `.num-submit` below, with a gap (numeric/decimal/fraction)
- [x] On the admin sidepanel the "Approvals" icon is not verically aligned with the rest of the icons (maybe it is an icon border issue). It is ugly (verify with playwright) — fixed-width centered `.nav-icon` column; also fixed the pending-count badge (broken path condition + global `.admin-badge` class collision → renamed to `.admin-nav-badge`)


## Features 

- [x] When in an exercise bundle, a user should be able to revisit previous questions (i.e buttons to move back and forward on the answered questions) 
showing the correct answer but not able to play it again (it is already solved) — added ‹ Προηγούμενη / Επόμενη › nav + clickable progress dots in `BundlePlayer`; solved questions render a read-only `RevealedAnswer` (shows the kid's correct response, no interactive controls), and you can never skip ahead past the first unsolved question
- [x] A service should run on the background to prerecord the tts files for the exercises. Maybe a cronjob in the container. — `app/services/exercise_tts.py` warms the content-hashed TTS cache for every bundle string (titles/prompts/hints/options), run in a daemon thread at startup (FastAPI `lifespan`) and after admin rescan; no cron (immutable bundles → one-shot pass, aligns with the no-scheduler ethos). CLI: `python -m app.services.exercise_tts`
