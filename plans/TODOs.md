# TODOs


# Features
- [x] Add per-kid exercise statistics on the kid's "Stats" tab (already shipped in M5: `📚 Ασκήσεις` row showing completed count + stars; backend `_exercise_stats_by_user` in `stats.py`, rendered in `Stats.tsx`)
- [x] Add the title of the exercise bundle above the "Exercise X of N" header. (`exercise-bundle-name` line in `BundlePlayer` head)
- [x] In the bundles page,
    - [x] move the "Completed" status to the bottom of the card (badge is now the last item in a bottom-anchored footer)
    - [x] anchor the title to the top so it does not move and is aligned with the rest of the cards. (title is the first child for every card; cards stretch to equal height so rows align)
    - [x] anchor the stars and difficulty to the bottom of the card (`.exercise-bundle-foot` wraps difficulty + stars + completed badge with `margin-top: auto`)
    - [x] Add a speaker button (reads the bundle title via new `GET /api/exercises/tts/{bundle_id}/title.mp3`; `SpeakButton` sits outside the `<Link>` so tapping it doesn't navigate)
