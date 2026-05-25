# Implementation Plan

This is the authoritative implementation plan for `padelerodouleies`. The product spec lives in `README.md`; this document sequences how to build it.

## Cross-cutting decisions (apply to all phases)

These are baseline architectural calls that shape multiple milestones. Capture them in code from Phase 1; do not relitigate later without a deliberate change.

- **Ledger model:** One unified `HistoryLedger` table records every star movement (chore approval, retroactive decline, manual adjustment, reward purchase). Fields: `id`, `user_id`, `action_type` (`chore_approved | chore_declined | manual_adjust | reward_purchase | reward_refund`), `points_delta` (signed int), `ref_table` + `ref_id` (nullable FK to chore or reward), `admin_note` (nullable), `timestamp`. Removes the need for a separate `CHORE_HISTORY` + adjustments table union when rendering the kid's timeline.
- **Time semantics:** The container runs in a fixed local timezone (`TZ=Europe/Athens` via env var). All `datetime` values are timezone-aware. "Today" means the local calendar day. Chore windows are allowed to wrap past midnight (`start_time=22:00, window_hours=4` → visible until `02:00` next day); the dedup-per-day check uses the local date in which the *window opened*.
- **PIN security:** PINs are stored as `pin_hash` using `bcrypt` (cost 12). Authentication tracks consecutive failures per user; after 5 failures the avatar is locked for 60 seconds with a visible countdown. A successful login resets the counter.
- **First-run bootstrap:** When `USERS` is empty, the landing page replaces the avatar grid with a one-time admin-creation form (name, avatar, PIN, PIN confirm). Once submitted, the system seeds the first admin row and reloads into the normal Fast Switcher.
- **Avatar storage:** A user's avatar is either an icon from the curated local library (e.g., `fa-fox`, `fa-unicorn`, `fa-shield`) or an admin-uploaded image (e.g., a photo of the child). The `User` row carries a discriminated pair: `avatar_kind` (`icon | image`) + `avatar_value` (icon name or relative file path). Uploaded files live at `/app/data/avatars/<uuid>.webp`, inside the bind-mounted data directory so they survive container rebuilds. Uploads are validated server-side (≤2 MB, MIME in `image/png|jpeg|webp`), re-encoded to WebP, center-cropped 1:1 and resized to 256×256 via Pillow. Chore and reward icons remain icon-library-only — uploads are for human avatars only.
- **Localization persistence:** Each `USERS` row carries a `preferred_locale` column (`el` default). The header locale toggle updates session state immediately and writes through to the row on change so the choice survives login.
- **Concurrency:** Pooled-chore claims and collaborative-reward contributions go through DB transactions with row-level locking (`SELECT … FOR UPDATE` or SQLite's `BEGIN IMMEDIATE`) to prevent double-claim / double-spend races.

---

## Phase 1: Foundation & Data Architecture

*Set up the Python environment, folder structure, database, and shared services that every later phase consumes.*

* [ ] **Milestone 1.1: Environment Setup**
  * Create a virtual environment (`python -m venv venv`).
  * Install Reflex, SQLAlchemy, `bcrypt`, `pytest` (`pip install reflex sqlalchemy bcrypt pytest`).
  * Initialize the Reflex project (`reflex init`).
  * Establish folder layout: `padelerodouleies/state/`, `padelerodouleies/views/`, `padelerodouleies/components/`, `padelerodouleies/database/`, `padelerodouleies/i18n/`, `tests/`.
  * Commit a `requirements.txt` (or `pyproject.toml`) pinning versions.
  * *Test:* `reflex run` boots without errors and serves the default placeholder page on `localhost:3000`. `pytest` from the project root collects zero tests and exits 0.

* [ ] **Milestone 1.2: Database Schema (SQLite + SQLAlchemy)**
  * Define ORM models matching `README.md` §Database Schema, with the cross-cutting refinements above:
    * `User`: `id`, `name`, `avatar_kind` (`icon | image`), `avatar_value` (icon name or relative file path under `/app/data/avatars/`), `pin_hash`, `role` (`admin | user`), `current_stars`, `preferred_locale`, `failed_pin_attempts`, `locked_until`, `created_at`.
    * `Chore`: `id`, `title_el`, `title_en`, `description_el`, `description_en`, `icon_name`, `scope` (`individual | pooled`), `points_value`, `is_repeating`, `start_time` (time-of-day), `window_hours`, `is_active`, `created_at`.
    * `Reward`: `id`, `title_el`, `title_en`, `description_el`, `description_en`, `icon_name`, `cost_stars`, `is_collaborative`, `is_enabled`, `created_at`.
    * `HistoryLedger`: as defined in cross-cutting decisions.
    * `RewardLedger`: `id`, `reward_id`, `user_id`, `status` (`claimed | fulfilled | refunded`), `claimed_at`, `fulfilled_at`, `stars_contributed` (for collaborative — per-user contribution), `admin_note`.
  * Configure SQLAlchemy engine pointing at `/app/data/padelerodouleies.db` (env-override `DB_PATH` for local dev).
  * Add Alembic and generate the initial migration (`alembic revision --autogenerate -m "initial schema"`).
  * *Test:* Pytest fixture spins up an in-memory SQLite, runs migrations, inserts dummy rows (2 kids, 1 admin, 2 chores, 1 reward); assertions confirm queries return as expected.

* [ ] **Milestone 1.3: Localization Engine**
  * Create `i18n/translations.py` as a flat dict: `TRANSLATIONS = {"login.welcome": {"el": "Καλωσήρθες", "en": "Welcome"}, ...}`.
  * Build `AppState.locale: str` (default `el`) and a pure helper `t(key: str, locale: str) -> str` with explicit `KeyError` on missing keys (no silent fallback).
  * Implement `LocaleToggle` component (header pill button, two-state, `EL` ↔ `EN`). Toggling updates `AppState.locale` and persists to `User.preferred_locale` on the logged-in user.
  * *Test:* Unit-test `t()` for hits, misses (raises), and locale fallback for admin-created bilingual content (chore titles).

* [ ] **Milestone 1.4: Security Primitives**
  * `security/pins.py`: `hash_pin(pin: str) -> str` and `verify_pin(pin: str, pin_hash: str) -> bool` using bcrypt; input validation rejects non-4-digit-numeric.
  * `security/lockout.py`: helpers `register_failure(user)`, `register_success(user)`, `is_locked(user) -> tuple[bool, int]` (returns seconds remaining). Operates on the `failed_pin_attempts` / `locked_until` columns under a DB transaction.
  * *Test:* Unit tests for hash round-trip, lockout after 5 failures, automatic unlock after 60s, success resets the counter.

* [ ] **Milestone 1.5: First-Run Detection**
  * `database/bootstrap.py`: helper `is_first_run() -> bool` returning true when `USERS` is empty.
  * Wire into the root route so it renders the first-run admin form (Milestone 2.5) instead of the Fast Switcher.
  * *Test:* Unit test confirms `is_first_run()` returns `True` against an empty fixture DB and `False` after a single `User` row is inserted.

* [ ] **Milestone 1.6: Icon Catalog Curation**
  * Choose an icon set with a permissive self-hosting license (recommended: Lucide MIT, or the FontAwesome Free subset). Vendor the chosen SVGs under `padelerodouleies/icons/svg/`.
  * Hand-curate ~200 icons covering the real-world domain:
    * **Hygiene & morning routine:** toothbrush, soap, shower, comb, towel.
    * **Meals:** plate, fork, fruit, water bottle, milk.
    * **Tidying:** broom, vacuum, bed, toy box, books.
    * **School:** pencil, backpack, book, ruler.
    * **Pets & outdoor:** dog, cat, paw, plant, leaf.
    * **Avatar-friendly creatures:** fox, unicorn, dragon, owl, lion, butterfly, robot, star, heart.
    * **Parent/admin:** shield, crown, key, gear.
    * **Rewards:** ice cream, gift, movie reel, gamepad, ticket, balloon, swim ring.
  * Author `padelerodouleies/icons/catalog.json` — one entry per icon with `name`, `category` (one of `hygiene | meals | tidying | school | pets | avatars | parent | rewards`, mapping 1:1 to the curation domains listed above), `svg_ref` (path under `icons/svg/`), `keywords_en[]` (3–6 terms incl. singular/plural and common synonyms), `keywords_el[]` (3–6 terms, same coverage). The `category` field drives the browse-mode grouping in Milestone 3.2. Keywords are the only text-search surface, so favour everyday parent vocabulary, not technical jargon.
  * Bake the catalog and SVG directory into the Docker image (Milestone 5.2) — no runtime fetches.
  * *Test:* A pytest validator loads `catalog.json` and asserts: schema conformance (all five fields present), unique `name` across the file, `category` is in the allowed enum, no empty keyword lists, every `svg_ref` resolves to a real file on disk. A throwaway script (`scripts/preview_icons.py`) renders the full catalog to a static HTML grid grouped by `category` so the parent can eyeball-review and edit keywords *before* Milestone 3.2 wires the picker up.

---

## Phase 2: Authentication & Fast Switcher

*Build the entire login surface: avatar grid, PIN pad, PIN reset, first-run admin form.*

* [ ] **Milestone 2.1: Avatar Grid Landing Page**
  * Query all users; render circular avatar tiles in a responsive grid (3 cols on phone, 5+ on tablet).
  * Each tile shows the user's icon, name, and role badge (subtle for kids, prominent shield for admins).
  * Tapping a tile sets `AuthState.selected_user_id` and reveals the PIN pad.
  * *Test:* With 3 seeded users (2 kids, 1 admin), the grid renders 3 tiles in DB-insertion order; tapping a tile sets `AuthState.selected_user_id` to that user's id and toggles the PIN pad into view.

* [ ] **Milestone 2.2: PIN Pad Component**
  * 3×4 oversized numeric keypad (digits 0–9 + backspace + cancel).
  * Visible input dots showing 0–4 entered digits.
  * Cancel button returns to the avatar grid.
  * Component is touch-first: minimum 64px tap targets, no hover effects required.
  * *Test:* Component test simulating taps `1,2,3,4` fills four dots and emits the assembled string on the 4th digit; backspace removes the last dot; cancel clears the input and returns to the avatar grid (`selected_user_id=None`).

* [ ] **Milestone 2.3: PIN Verification & Lockout**
  * On the 4th digit pressed, fire `verify_pin` against `selected_user`.
  * Check lockout first; if locked, replace the keypad with a countdown message and disable input until expiry.
  * Success: clear pad, set `AuthState.logged_in_user_id`, redirect to admin panel or kid dashboard based on role.
  * Failure: shake animation on the dots, red flash, clear input, increment failure counter, lock after 5 consecutive failures.
  * *Test:* Integration test simulating 5 failed attempts triggers lockout; successful login mid-streak resets counter.

* [ ] **Milestone 2.4: Session Management**
  * Persist `logged_in_user_id` in `rx.LocalStorage` keyed by browser, so a tablet refresh keeps the session.
  * Add a prominent "Logout / Έξοδος" button in the dashboard header.
  * Optional idle auto-logout: 30 minutes of inactivity returns to the avatar grid (configurable via env var `IDLE_LOGOUT_MINUTES`, set to `0` to disable).
  * *Test:* Login, hard-refresh the page — session persists (`logged_in_user_id` still set). Logout clears the LocalStorage key and returns to the avatar grid. With `IDLE_LOGOUT_MINUTES=1` and a faked clock advanced past 60s of no input, the session ends.

* [ ] **Milestone 2.5: First-Run Admin Setup Form**
  * When `is_first_run()` returns true, render a single-page form: name, avatar (using `AvatarPicker` from Milestone 3.2 — admin can pick an icon or upload an image), PIN (4 digits), confirm PIN.
  * On submit, create one admin row and reload into the normal Fast Switcher.
  * *Test:* End-to-end test on an empty DB renders the form; after submission `USERS` has one admin and the avatar grid renders.

* [ ] **Milestone 2.6: Self-Service PIN Reset**
  * Gear icon on every dashboard opens a settings modal.
  * Form: enter current PIN → enter new PIN → confirm new PIN → save.
  * On success, overwrite `pin_hash`, show green confirmation banner.
  * On wrong current PIN, show inline error without locking (this isn't a brute-force vector — user is already authenticated).
  * *Test:* Correct current PIN + new PIN (entered twice) updates `pin_hash`; old PIN no longer verifies, new PIN does. Wrong current PIN shows the inline error and leaves `failed_pin_attempts` untouched. Mismatched new-PIN confirmation rejects the submit before any DB write.

---

## Phase 3: Admin Control Panel

*Build every surface the parents need to feed data into the app and process approvals.*

* [ ] **Milestone 3.1: Admin Dashboard Shell**
  * Navigation: Approvals Queue (with pending-count badge), Chores, Rewards, Users, Reward Fulfillment.
  * Sticky header carries locale toggle + logout.
  * *Test:* Navigating between the five sections preserves the admin session. The pending-count badge reflects the live `PendingClaim` row count — inserting two rows directly and re-rendering shows "2"; deleting one shows "1".

* [ ] **Milestone 3.2: Icon & Avatar Pickers**
  * `IconPicker` — search input above a scrollable grid of icons. Source: a curated subset (~200) bundled locally as `icons/catalog.json` with `name`, `category`, `keywords_el[]`, `keywords_en[]`, `svg_ref` — every icon ships with hand-curated keywords in both locales (e.g., `fa-teeth` → `keywords_en: ["tooth", "teeth", "brush", "dental"]`, `keywords_el: ["δόντι", "δόντια", "βούρτσισμα", "οδοντόβουρτσα"]`). When the search box is empty, the grid renders the **entire catalog**, scrollable, grouped by `category` (Hygiene, Meals, Tidying, School, Pets, Avatars, Parent, Rewards — sourced from Milestone 1.6) with sticky section headers so a parent who isn't sure what to type can browse visually. A row of category chips above the grid acts as a one-tap filter (multi-select; chips applied as an AND-filter on top of any active text query). Typing into the search box narrows the visible icons live; clearing the box restores the full browseable grid. The query is normalized (lowercase + diacritic-strip applied to both Greek tonos and Latin accents via `unicodedata.normalize('NFD')`) and substring-matched against the normalized union of both keyword lists, so the parent can type either `tooth` or `δοντι`/`δόντι` to surface the same icon. Used by chore and reward creation. Emits `(kind='icon', value='<name>')`.
  * `AvatarPicker` — two-tab control: an "Icon" tab wrapping `IconPicker`, and an "Upload" tab with a file input, live preview, and square crop handle. Used by the first-run setup form and the user-management forms. Emits the same `(kind, value)` shape so downstream forms stay uniform.
  * **Upload pipeline (server side):** accept multipart upload via Reflex's `rx.upload` handler → validate size (≤2 MB) and MIME (`image/png|jpeg|webp`) → re-encode to WebP, center-crop to 1:1, resize to 256×256 via Pillow → write to `/app/data/avatars/<uuid>.webp` → return the relative path. On a successful replacement, delete the previous file referenced by the user's old `avatar_value` (only when `avatar_kind='image'`).
  * **Static serving:** mount `/app/data/avatars/` under the `/avatars/<filename>` URL path via a custom FastAPI route attached to Reflex's underlying app, so URLs are stable regardless of the bind-mount's host path.
  * *Test:* `IconPicker` searches `tooth`, `Tooth`, `δόντι`, `δοντι` (no tonos), and `ΔΟΝΤΙ` (uppercase) all surface `fa-teeth`. A query in one locale does not exclude icons whose match came from the other locale's keyword list. Unit test the normalization helper directly (`normalize("Δόντι") == normalize("δοντι") == "δοντι"`). Browse mode: opening the picker with an empty query renders every icon in the catalog grouped under its category header (count rendered == count in `catalog.json`); selecting the "Hygiene" chip narrows to that category only; typing `tooth` while "Hygiene" is selected narrows further (intersection, not union); clearing both restores the full grid. `AvatarPicker` upload of a 5 MB JPEG is rejected with a clear error; a 1 MB PNG is accepted, written as a WebP, and served at the returned URL. Replacing an uploaded avatar deletes the old WebP from disk.

* [ ] **Milestone 3.3: Chore CRUD**
  * Listing view: all chores, with `is_active` toggle, edit, delete (soft delete by flipping `is_active=False` — historical ledger rows must keep their FK).
  * Create/edit form: bilingual `title_el` / `title_en` (both required), bilingual descriptions (optional), icon (via picker), scope dropdown (individual/pooled), points, is_repeating, start_time, window_hours.
  * Server-side validation: points > 0, window_hours in 1–24, start_time is a valid `HH:MM`, both locale titles present.
  * *Test:* Create a chore, edit its window, soft-delete it; verify it disappears from kid dashboards but its past ledger entries still render.

* [ ] **Milestone 3.4: Reward CRUD**
  * Listing view: all rewards, with `is_enabled` toggle, edit, delete.
  * Create/edit form: bilingual title/description, icon, cost, `is_collaborative` toggle. When collaborative, an additional `collab_target_stars` field (which can differ from per-purchase cost? — for v1, `cost_stars` *is* the collaborative target; one row, one goal).
  * *Test:* Toggle `is_enabled` off; reward disappears from kid marketplace but remains in admin listing.

* [ ] **Milestone 3.5: Approvals Queue**
  * Query `HistoryLedger` for rows where `action_type='chore_approved'` AND `status='pending'` — actually, since the ledger is append-only, model pending claims as a separate `PendingClaim` table OR as `HistoryLedger` rows with `points_delta=0` and `action_type='chore_pending'` that get *replaced* (deleted + new row inserted) on approve/decline. **Decision:** keep a small `PendingClaim(id, user_id, chore_id, claimed_at)` table — appending pending rows to the ledger and later mutating them muddies the immutable-ledger invariant.
  * View renders each pending claim as a card: child avatar, chore icon + title (localized), claim time, [Approve ✅] [Decline ❌] buttons, optional admin-note textarea.
  * Pending-count badge on the nav links here.
  * *Test:* Seed two `PendingClaim` rows and one approved `HistoryLedger` row; the queue renders exactly two cards (newest first), the approved row does not appear, and the nav badge shows "2".

* [ ] **Milestone 3.6: Approve / Decline Logic**
  * **Approve action (transactional):** delete the `PendingClaim` row, insert `HistoryLedger(action_type='chore_approved', points_delta=+chore.points_value, ref_table='chore', ref_id=chore.id)`, increment `User.current_stars`.
  * **Decline action (transactional):** delete the `PendingClaim` row, insert `HistoryLedger(action_type='chore_declined', points_delta=0, admin_note=...)` — no balance change because nothing was credited yet.
  * **Retroactive decline** (different surface — operates on already-approved chores from a chore-history view): inserts `HistoryLedger(action_type='chore_declined', points_delta=-chore.points_value, admin_note=...)` and decrements `User.current_stars`. The original approval row stays for transparency; the negative row offsets it.
  * *Test:* Concurrent approves on the same pending claim — second one must fail cleanly (DB constraint / row not found).

* [ ] **Milestone 3.7: User Management**
  * Listing view: all users with role, avatar, balance, "Edit" / "Delete" / "Reset PIN".
  * Create form: name, role (admin/user), avatar (via `AvatarPicker` — icon or uploaded image), initial PIN.
  * Edit form: name, avatar, role. PIN reset is a separate explicit action (admins can force-reset a kid's PIN if they forget it). Replacing an uploaded avatar deletes the old file from disk per Milestone 3.2's pipeline.
  * Delete: soft-delete (`is_active=False` flag on `User`); preserves ledger references.
  * *Test:* Creating a kid inserts a `User` row with the entered name and `avatar_kind`/`avatar_value`. Editing the row updates the fields without changing `id`. Soft-delete flips `is_active=False`; the user disappears from the Fast Switcher avatar grid but their existing `HistoryLedger` rows still render in the activity view.

* [ ] **Milestone 3.8: Manual Star Adjustments**
  * "Adjust Stars" button on each user row.
  * Modal: +/− toggle, integer input, mandatory `description` textarea (≥3 chars).
  * Submit (transactional): update `User.current_stars`, insert `HistoryLedger(action_type='manual_adjust', points_delta=±N, admin_note=description, ref_table=NULL, ref_id=NULL)`.
  * Reject adjustments that would push balance below 0 (configurable; default reject).
  * *Test:* Applying `+3` with note `"for sharing"` to a user with balance 10 results in balance 13 and a `HistoryLedger(action_type='manual_adjust', points_delta=+3, admin_note='for sharing', ref_table=NULL, ref_id=NULL)`. Applying `-20` to a user with balance 5 is rejected; balance stays at 5 and no ledger row is written. Empty/short descriptions reject before any DB write.

* [ ] **Milestone 3.9: Reward Fulfillment Queue**
  * View querying `RewardLedger` for `status='claimed'`.
  * Card per row: child, reward, claimed time, [Mark Fulfilled] button.
  * On fulfill: update `status='fulfilled'`, set `fulfilled_at`. Item moves to an archive view (paginated, read-only).
  * *Test:* A `RewardLedger` row with `status='claimed'` appears in the active queue; tapping "Mark Fulfilled" sets `status='fulfilled'` and a non-null `fulfilled_at`, removes it from the active queue, and surfaces it in the archive view.

* [ ] **Milestone 3.10: Admin Activity View (optional polish)**
  * A simple paginated `HistoryLedger` viewer with filters (user, action_type, date range). Useful for parents to audit "what happened last Tuesday".
  * *Test:* With seeded ledger spanning two users and three days, filtering by `user_id` returns only that user's rows; filtering by date range excludes rows outside the range; pagination at page-size 10 returns the correct offset/count for a 25-row fixture.

---

## Phase 4: Kid Dashboard & Gamification

*The most visually intense phase. Large buttons, high contrast, dynamic rendering, real-time updates.*

* [ ] **Milestone 4.1: Kid Dashboard Shell**
  * Top section: large avatar + name, animated star counter (`current_stars`).
  * Nav: Chores (default), Marketplace, History, Leaderboard.
  * Sticky locale toggle + logout.
  * *Test:* Logged-in kid sees her own avatar, name, and `current_stars` value. Updating the user's `current_stars` directly in the DB and re-rendering shows the new value with an animated transition.

* [ ] **Milestone 4.2: Dynamic Chore Visibility Engine**
  * Pure function `visible_chores_for(user, now: datetime) -> list[Chore]` that:
    1. Filters `is_active=True` chores.
    2. Computes each chore's current window using timezone-aware arithmetic: open at the local time `start_time` on the current local date; closed `window_hours` later (may extend past midnight).
    3. Filters out chores already completed today (`PendingClaim` exists OR `HistoryLedger` row with `action_type='chore_approved'` AND timestamp inside the same window for individual chores; for pooled chores, filters out chores claimed by *any* user in the window).
  * Pure, side-effect-free — easy to unit-test by injecting `now`.
  * *Test:* Cases: chore window 07:00–11:00, query at 06:59 (hidden), 07:00 (visible), 10:59 (visible), 11:01 (hidden). Wrap-around 22:00–02:00 queried at 01:00 next day must be visible.

* [ ] **Milestone 4.3: Chore Cards & Claim Flow**
  * Render each visible chore as a large colorful card: icon, localized title, `+N ⭐` badge, giant "Claim / Διεκδίκηση" button.
  * Claim button (transactional):
    * For pooled chores: `SELECT … FOR UPDATE` (or `BEGIN IMMEDIATE` in SQLite) on the chore row, re-check no `PendingClaim` or approved-today row exists, then insert `PendingClaim`. Race-loser gets a "Someone else claimed this first!" toast.
    * For individual chores: same transactional insert but no contention beyond duplicate-claim-prevention per user.
  * Button transitions to disabled "Pending… / Σε αναμονή" with a spinner.
  * *Test:* Claiming an individual chore inserts one `PendingClaim` and the same chore disappears from this user's dashboard (but stays visible for the sibling). For a pooled chore, two concurrent claim attempts execute in sequence — the first inserts a `PendingClaim`, the second raises and surfaces the "Someone else claimed this first!" toast without creating a duplicate row.

* [ ] **Milestone 4.4: Kid History Timeline**
  * Paginated view querying `HistoryLedger` rows where `user_id = me`, newest first.
  * Each row renders as a colored timeline entry, color-coded by `points_delta` sign:
    * `+5 ⭐ — Βούρτσισμα Δοντιών — Εγκρίθηκε` (green)
    * `-5 ⭐ — Βούρτσισμα Δοντιών — Declined by Parent: Toothbrush was dry!` (red)
    * `+3 ⭐ — For sharing her blocks beautifully` (gold, manual adjustment)
    * `-20 ⭐ — Redeemed 1 Hour of Screen Time` (blue)
  * Strings localized via `User.preferred_locale`. Chore/reward titles fall back: prefer the active locale, fall back to the other if missing.
  * *Test:* With four seeded ledger rows (chore approval +5, retroactive decline -5, manual adjust +3, reward purchase -20), the timeline renders four entries newest-first with correct sign-based colors. Switching `preferred_locale` from `el` to `en` re-renders strings; rows referencing a chore that has only `title_en` populated still render (locale fallback).

* [ ] **Milestone 4.5: Marketplace — Individual Rewards**
  * Card grid of `is_enabled=True` AND `is_collaborative=False` rewards.
  * Each card: icon, localized title/description, cost badge, "Redeem / Εξαργύρωση" button.
  * Button is grayed with a padlock overlay when `current_stars < cost`.
  * Redeem action (transactional): re-verify balance, decrement `User.current_stars`, insert `RewardLedger(status='claimed')`, insert `HistoryLedger(action_type='reward_purchase', points_delta=-cost)`.
  * *Test:* A kid with `current_stars=35` sees the Redeem button enabled on a 20-star reward and disabled (padlock overlay) on a 50-star reward. Redeeming the 20-star reward decrements balance to 15, inserts one `RewardLedger(status='claimed')`, and inserts one `HistoryLedger(action_type='reward_purchase', points_delta=-20)`. A racing redeem against a stale balance fails cleanly without going negative.

* [ ] **Milestone 4.6: Marketplace — Collaborative Rewards**
  * Separate "Epic Goals / Επικοί Στόχοι" section above the individual cards.
  * Each card shows a horizontal progress bar with stacked per-user contributions (different colors per child) and `current / target ⭐` text.
  * "Contribute Stars / Συνεισφορά" button opens a slider modal: range 1 to `min(user.current_stars, target - current)`, plus a confirm button.
  * Contribute action (transactional): row-lock the reward, re-verify the cap, decrement user balance, insert/update a `RewardLedger` row for this user (`status='claimed'`, `stars_contributed` accumulates), insert `HistoryLedger(action_type='reward_purchase', points_delta=-N, ref=reward)`.
  * When the target is reached, the reward enters the admin's fulfillment queue with all contributors listed.
  * *Test:* Two kids contribute 15 and 10 to a 500-star goal — the progress bar reads 25/500 with two stacked colored segments and the reward is absent from the admin's fulfillment queue. Pushing further contributions to exactly 500 inserts no ledger row above the cap (slider max enforces it) and surfaces the goal in the fulfillment queue with both contributor names. Concurrent contributions that would together exceed the cap: the second one is clamped or rejected, never overshoot.

* [ ] **Milestone 4.7: Podium Leaderboard**
  * Standalone page showing all users (kids only? or kids + admins? — kids only, per README §5 framing) ranked by `current_stars` descending.
  * Top 3 rendered as a literal podium (1st center+tall, 2nd left, 3rd right); rest as a list below.
  * Uses Reflex's reactive state so the page auto-updates when balances change elsewhere.
  * *Test:* With three kids at 50/30/10 stars, the podium renders 1st centered+tall, 2nd left, 3rd right in that order. Bumping the 3rd-place kid to 60 stars via a direct DB update re-renders the page with the new ordering on next state tick. Tie-breaking is deterministic (e.g., user `id` ascending) and covered by a unit test on the sorting helper.

* [ ] **Milestone 4.8: Real-Time WebSocket Verification**
  * Multi-device manual test: open the kid's dashboard on tablet A, open the admin approvals queue on phone B, claim a chore on A, approve from B, watch A's star counter animate up without refresh. Same for leaderboard updates.
  * If Reflex's default state-binding doesn't propagate cross-session by default, wire up `rx.Broadcast` (or whatever Reflex's pub/sub primitive is in the installed version) on the relevant state slices.
  * *Test:* Documented manual test checklist captured in `docs/realtime-test.md`.

---

## Phase 5: Deployment & Polish

* [ ] **Milestone 5.1: Responsive Polish & Accessibility Pass**
  * Test every page at 360px width (phone portrait), 768px (tablet portrait), 1280px (desktop).
  * Verify PIN pad keys are ≥64px tap targets on the smallest tested device.
  * Test the EL↔EN toggle on every screen; no untranslated leakage.
  * High-contrast color check for the 4-year-old's visual recognition path.

* [ ] **Milestone 5.2: Dockerfile (multi-stage)**
  * Stage 1: Python builder — install requirements, run `reflex export` to compile the Next.js frontend.
  * Stage 2: Runtime — slim Python image, copy compiled assets + backend, run Alembic migrations on startup, launch the Reflex ASGI server.
  * Bake the icon catalog into the image; no runtime CDN fetches (LAN deployment).
  * `TZ=Europe/Athens` baked into the runtime stage.
  * *Test:* `docker build .` succeeds. Running the image locally with `-p 8000:8000 -v $(pwd)/data:/app/data` runs Alembic migrations on first boot (creating the DB at `data/padelerodouleies.db` on the host), serves the first-run admin form at `localhost:8000`, and `docker exec <container> date` reports Athens local time.

* [ ] **Milestone 5.3: docker-compose & Storage**
  * Single service `padelerodouleies` in `docker-compose.yml`.
  * Bind mount: `/mnt/raid/padelerodouleies/data:/app/data` (host path overridable via `.env`).
  * Port mapping: `8000:8000` (Reflex backend + frontend served from one process in production export).
  * Healthcheck pinging `/` every 30s.
  * Auto-restart `unless-stopped`.
  * *Test:* `docker-compose up -d` brings the service to `healthy`. Complete the first-run admin form, create a user with an uploaded avatar; then `docker-compose down && docker-compose up -d` and verify the admin user, the avatar WebP file, and the SQLite DB all persist via the bind mount.

* [ ] **Milestone 5.4: First Deploy & LAN Verification**
  * `docker-compose up -d` on the home server.
  * First-run setup form completes the bootstrap admin.
  * Connect from each target device (9yo tablet, 4yo tablet, parent phone). Bookmark/install as PWA so it opens chromeless.
  * Run the realtime test checklist from 4.8 against the real LAN.
  * Verify SQLite file lives at the bind-mounted host path and persists across `docker-compose down && up`.

* [ ] **Milestone 5.5: Handover Docs**
  * Update `README.md` with a brief "Running" section: env vars (`TZ`, `DB_PATH`, `IDLE_LOGOUT_MINUTES`), compose-up flow, where the DB file lives, how to add an admin from scratch (delete DB, restart, re-run setup), basic troubleshooting.

---

## Out of scope (v1)

Items considered and deliberately deferred. Revisit if the family asks.

- Push notifications to parent's phone (LAN PWA + queue badge is sufficient for v1).
- Multi-household / multi-tenant support.
- Cloud backup of the SQLite file (RAID handles redundancy; manual `cp` snapshots are documented in 5.5).
- Web-accessible deployment outside the LAN (would require auth hardening beyond 4-digit PINs).
- Mobile native apps (PWA-as-app via home-screen bookmark is sufficient).
- Internationalization beyond `el` / `en`.
