# TODOs

# Generate exercise bundles

- [x] Use the exercise_lab skill to generate with the following command:
    /exercise_lab generate Γ_ΤΑΞΗ_ΔΗΜΟΤΙΚΟΥ glossa 10 1-2 4-5
    Done — batch 3, bundles 31–40 (40 glossa bundles total). Output is local only
    (`exercise_lab/bundles/` is git-ignored); the ledger is that folder's `progress.md`.
- [x] Use the exercise_lab skill to generate with the following command:
    /exercise_lab generate Γ_ΤΑΞΗ_ΔΗΜΟΤΙΚΟΥ mathimatika 10 1-2 4-5
    Done — batch 2, bundles 11–20 (20 mathimatika bundles total). Output is local only
    (`exercise_lab/bundles/` is git-ignored); the ledger is that folder's `progress.md`.
- [ ] Use the exercise_lab skill to generate with the following command:
    /exercise_lab generate Γ_ΤΑΞΗ_ΔΗΜΟΤΙΚΟΥ magic_book 10 1-2 3-4

# Exercises — spoken math operators

- [ ] Option / item / pair `text` has no `*_tts` override in `app/schemas/exercises.py`,
    but each option gets its own SpeakButton (`exerciseOptionTtsUrl`). espeak-ng Greek
    leaves `×` and `÷` **silent** and reads `−` (U+2212) as the English «μάινους», so an
    option `6 × 7` is spoken «έξι επτά» and `87 − 68` «ογδόντα επτά μάινους εξήντα οκτώ».
    Affects the shipped math bundles course-wide (both batches use the textbook glyphs).
    Fix is a design call: either add a per-option spoken override to the schema, or spell
    the operators out in the option text. Prompts are already fine via `prompt_tts`.
