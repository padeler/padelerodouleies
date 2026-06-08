# TODOs

- [x] When a chore is "Approved" (i.e the kid completed it and a parent accepted it), there should be a an indicator on the cart on when it will be available again (i.e in X hours).
    - Backend `chores_for_dashboard` now emits `available_again_at` (the claim-period end as UTC ISO) for any non-available chore; `/api/dashboard/visible-chores` forwards it. Frontend shows a "Διαθέσιμη ξανά {when}" badge on approved cards via `formatRelativeFromNow` (Intl.RelativeTimeFormat, minutes/hours/days). New key `chore.available_again`.
- [x] The colloring of the background and of the cards should follow the selected accents.
    - `applyAccent` now derives `--accent-strong` (button gradient) and `--bg-accent-1/2/3` (page-background glow tints) from the chosen swatch. `PageBackground.css` per-tab palettes use `var(--bg-accent-*, <per-tab default>)`, so the background follows the accent when one is picked and keeps the per-tab colours otherwise. Chore cards (border/bg/icon-wrap/claim-button/avatar ring) use `--accent-*` vars instead of hardcoded purple. Status colours (pending/approved/taken) stay semantic.
