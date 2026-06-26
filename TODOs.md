# TODOs


## Bugs:
- [x] On exercises when the choice is numerical (or very short text) the buttons are too small and the speaker is rendered on the text or the text is wrapped making difficult to read
- [x] Pagination for the bundles on the admin "Exercises" tab.
- [x] On a phone screen the multiple choice buttons are sometimes to long causing horizontal sidescroll
- [x] Dark mode theme contrast issues: Text is not visible on cards with light background. Icons with dark details not vidible on dark cards (i.e match game)
  - Fixed so far: kid chore/reward/collab flip-cards (text pinned to dark on the always-light card) and Memory Match revealed tile (light face in dark mode).

## Dark mode — remaining contrast problems (found via Playwright walkthrough, dark theme):
- [x] **Kid History (Ιστορικό) timeline cards**: gave `.history-content` a dark surface (`#20222b`) in dark mode so the theme light text reads; adjusted the note/time/timeline-line/dot light-only bits and inverted catalog SVG chore icons (uploaded images untouched). Verified readable in dark mode.
- [x] **Admin Approvals reason field**: added a reusable `.admin-textarea` themed style and applied it to the approvals "Αιτιολογία" textarea — now translucent-dark with light text, matching the chore/reward modal inputs.
- [x] **Dark line-icon avatars on dark surfaces (kid areas)**: added an `invert(0.85)` rule for catalog SVG avatar icons in dark mode (`Avatar.css` `.avatar-icon`, `Landing.css` `.avatar-img:not(.avatar-img-photo)`); photos are never inverted. Verified on the login grid (shield/books/swords/smiley now legible).

## Verified OK in dark mode (no action needed):
- Login grid, Chores dashboard + flipped backs, Marketplace (rewards + collaborative), Leaderboard layout, Stats (summary, bar chart, champion + per-kid + game-score cards), Games hub + Memory Match, Admin chores table, Admin chore edit modal (incl. icon picker), Admin Exercises table + new pagination.
