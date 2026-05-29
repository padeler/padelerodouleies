# Implementation Plan

This is the authoritative implementation plan for `padelerodouleies`. The product spec lives in `README.md`; this document sequences how to build it.

## Cross-cutting decisions (apply to all phases)

These are baseline architectural calls that shape multiple milestones. Capture them in code from Phase 1; do not relitigate later without a deliberate change.

- **Repo layout:** Monorepo with two top-level directories:
  - `backend/` — FastAPI app (`app/main.py`), SQLAlchemy models, Alembic migrations, Pydantic schemas, WebSocket broadcaster, `pyproject.toml`, `tests/`.
  - `frontend/` — Vite + React + TypeScript SPA (`src/`, `index.html`, `package.json`, `vite.config.ts`, `tsconfig.json`).
  - In dev, Vite runs on `:5173` and proxies `/api` and `/ws` to FastAPI on `:8000`. In production, Vite is built to `frontend/dist/` and FastAPI serves those assets from the same `:8000`.
- **API contract:** The JSON API lives under `/api/...`; the WebSocket endpoint is `/ws`. Pydantic models on the backend are the source of truth; the frontend consumes the OpenAPI schema at `/api/openapi.json` via `openapi-typescript` to generate `frontend/src/api/schema.d.ts`. Hand-maintained TypeScript types for API payloads are forbidden — regenerate.
- **Auth transport:** Sessions are an HttpOnly, SameSite=Strict cookie signed via `itsdangerous` (LAN-only; no CSRF token needed beyond SameSite). The cookie carries `user_id` + `issued_at`. The frontend never reads the cookie; it calls `GET /api/auth/me` on app boot to hydrate the session user.
- **Ledger model:** One unified `HistoryLedger` table records every star movement (chore approval, retroactive decline, manual adjustment, reward purchase). Fields: `id`, `user_id`, `action_type` (`chore_approved | chore_declined | manual_adjust | reward_purchase | reward_refund`), `points_delta` (signed int), `ref_table` + `ref_id` (nullable FK to chore or reward), `admin_note` (nullable), `timestamp`. Removes the need for a separate `CHORE_HISTORY` + adjustments table union when rendering the kid's timeline.
- **Time semantics:** The container runs in a fixed local timezone (`TZ=Europe/Athens` via env var). All `datetime` values are timezone-aware. "Today" means the local calendar day. Chore windows are allowed to wrap past midnight (`start_time=22:00, window_hours=4` → visible until `02:00` next day); the dedup-per-day check uses the local date in which the *window opened*.
- **PIN security:** PINs are stored as `pin_hash` using `bcrypt` (cost 12). Authentication tracks consecutive failures per user; after 5 failures the avatar is locked for 60 seconds with a visible countdown. A successful login resets the counter.
- **First-run bootstrap:** When `USERS` is empty, the landing page replaces the avatar grid with a one-time admin-creation form (name, avatar, PIN, PIN confirm). Once submitted, the system seeds the first admin row and reloads into the normal Fast Switcher.
- **Avatar storage:** A user's avatar is either an icon from the curated local library (e.g., `fa-fox`, `fa-unicorn`, `fa-shield`) or an admin-uploaded image (e.g., a photo of the child). The `User` row carries a discriminated pair: `avatar_kind` (`icon | image`) + `avatar_value` (icon name or relative file path). Uploaded files live at `/app/data/avatars/<uuid>.webp`, inside the bind-mounted data directory so they survive container rebuilds. Uploads are validated server-side (≤2 MB, MIME in `image/png|jpeg|webp`), re-encoded to WebP, center-cropped 1:1 and resized to 256×256 via Pillow. Chore and reward icons remain icon-library-only — uploads are for human avatars only.
- **Localization persistence:** Each `USERS` row carries a `preferred_locale` column (`el` default). The header locale toggle updates session state immediately and writes through to the row on change so the choice survives login.
- **Concurrency:** `claim_mode="one"` chore claims and collaborative-reward contributions go through DB transactions with row-level locking (`SELECT … FOR UPDATE` or SQLite's `BEGIN IMMEDIATE`) to prevent double-claim / double-spend races.

---

## Phase 1: Foundation & Data Architecture

*Set up the backend Python environment, the frontend Vite project, the shared database, and the services every later phase consumes.*

* [x] **Milestone 1.1: Environment Setup** — DONE
  * **Backend (`backend/`):** Create a virtual environment (`python -m venv .venv`). Install FastAPI, Uvicorn (with `[standard]` extras for WebSockets), SQLAlchemy 2.x, Alembic, `bcrypt`, `Pillow`, `itsdangerous`, `python-multipart` (for upload endpoints), `pytest`, `httpx` (for FastAPI test client), `mypy`. Pin in `pyproject.toml`. Establish folder layout: `backend/app/main.py`, `backend/app/api/` (routers), `backend/app/db/` (SQLAlchemy models + session), `backend/app/schemas/` (Pydantic), `backend/app/services/`, `backend/app/i18n/`, `backend/app/realtime/` (WebSocket broadcaster), `backend/alembic/`, `backend/tests/`.
  * **Frontend (`frontend/`):** Scaffold with `npm create vite@latest frontend -- --template react-ts`. Install React Router, TanStack Query, Zustand (state), `openapi-typescript` (dev). Configure `tsconfig.json` with `strict: true` and `noUncheckedIndexedAccess: true`. Configure `vite.config.ts` with a dev-mode proxy: `/api` and `/ws` → `http://localhost:8000`. Folder layout: `frontend/src/api/`, `frontend/src/components/`, `frontend/src/pages/`, `frontend/src/state/`, `frontend/src/i18n/`, `frontend/src/hooks/`.
  * **Codegen wiring:** Add an `npm run gen:api` script that fetches `http://localhost:8000/api/openapi.json` and writes `frontend/src/api/schema.d.ts` via `openapi-typescript`. Re-run after every backend schema change.
  * *Test:* `uvicorn app.main:app --reload` in `backend/` boots and `GET /api/health` returns `{"status": "ok"}`. `npm run dev` in `frontend/` boots Vite on `:5173` and the placeholder React page renders. `pytest` from `backend/` collects zero tests and exits 0. `tsc --noEmit` from `frontend/` exits 0.

* [x] **Milestone 1.2: Database Schema (SQLite + SQLAlchemy)** — DONE
  * Define ORM models matching `README.md` §Database Schema, with the cross-cutting refinements above:
    * `User`: `id`, `name`, `avatar_kind` (`icon | image`), `avatar_value` (icon name or relative file path under `/app/data/avatars/`), `pin_hash`, `role` (`admin | user`), `current_stars`, `preferred_locale`, `failed_pin_attempts`, `locked_until`, `created_at`.
    * `Chore`: `id`, `title`, `description`, `icon_name`, `claim_mode` (`each | one`), `points_value`, `is_repeating`, `start_time` (time-of-day), `window_hours`, `repeat_days`, `n_day_interval`, `is_active`, `created_at`. Note: `title`/`description` are single-language fields (bilingual columns removed); `claim_mode` replaced the old `scope` (`individual`/`pooled`) — `each` means every kid can claim independently, `one` means first-come-first-served for the period.
    * `Reward`: `id`, `title_el`, `title_en`, `description_el`, `description_en`, `icon_name`, `cost_stars`, `is_collaborative`, `is_enabled`, `created_at`.
    * `HistoryLedger`: as defined in cross-cutting decisions.
    * `RewardLedger`: `id`, `reward_id`, `user_id`, `status` (`claimed | fulfilled | refunded`), `claimed_at`, `fulfilled_at`, `stars_contributed` (for collaborative — per-user contribution), `admin_note`.
  * Configure SQLAlchemy engine pointing at `/app/data/padelerodouleies.db` (env-override `DB_PATH` for local dev).
  * Add Alembic and generate the initial migration (`alembic revision --autogenerate -m "initial schema"`).
  * *Test:* Pytest fixture spins up an in-memory SQLite, runs migrations, inserts dummy rows (2 kids, 1 admin, 2 chores, 1 reward); assertions confirm queries return as expected.

* [x] **Milestone 1.3: Localization Engine** — DONE
  * **Backend:** Create `backend/app/i18n/translations.py` as a flat dict: `TRANSLATIONS = {"login.welcome": {"el": "Καλωσήρθες", "en": "Welcome"}, ...}`. Build a pure helper `t(key: str, locale: str) -> str` with explicit `KeyError` on missing keys (no silent fallback). Expose `GET /api/i18n/translations` returning the full dict (cached) so the frontend bootstraps with one fetch.
  * **Frontend:** Create `frontend/src/i18n/store.ts` (Zustand) holding `{ locale: 'el' | 'en', translations: Record<string, Record<string, string>> }`. Expose a `t(key)` hook that throws on missing keys. Implement a `LocaleToggle` React component (header pill button, two-state, `EL` ↔ `EN`). Toggling updates the store and calls `POST /api/auth/me/locale` to persist `User.preferred_locale` for the logged-in user.
  * *Test:* Backend unit-test `t()` for hits, misses (raises), and the bilingual-content locale-fallback helper (chore titles). Frontend unit-test the `t()` hook with an in-memory store: hit returns the localized string, miss throws, toggling locale re-renders. Integration test confirms `POST /api/auth/me/locale` updates the DB row.

* [x] **Milestone 1.4: Security Primitives** — DONE
  * `security/pins.py`: `hash_pin(pin: str) -> str` and `verify_pin(pin: str, pin_hash: str) -> bool` using bcrypt; input validation rejects non-4-digit-numeric.
  * `security/lockout.py`: helpers `register_failure(user)`, `register_success(user)`, `is_locked(user) -> tuple[bool, int]` (returns seconds remaining). Operates on the `failed_pin_attempts` / `locked_until` columns under a DB transaction.
  * *Test:* Unit tests for hash round-trip, lockout after 5 failures, automatic unlock after 60s, success resets the counter.

* [x] **Milestone 1.5: First-Run Detection** — DONE
  * **Backend:** `backend/app/services/bootstrap.py` with `is_first_run() -> bool` returning true when `USERS` is empty. Endpoint `GET /api/bootstrap/status` returns `{"first_run": bool}`.
  * **Frontend:** The root route component calls `GET /api/bootstrap/status` on mount; when `first_run` is true, it renders the first-run admin form (Milestone 2.5) instead of the Fast Switcher.
  * *Test:* Unit test confirms `is_first_run()` returns `True` against an empty fixture DB and `False` after a single `User` row is inserted. Integration test against `GET /api/bootstrap/status` returns the expected JSON for both states.

* [x] **Milestone 1.6: Icon Catalog Curation** — DONE (109 icons, 8 categories)
  * Chose Lucide icons (MIT license). Vended SVGs under `backend/app/icons/svg/` and expose via FastAPI `StaticFiles` mount at `/api/icons/svg/{name}`. Catalog exposed via `GET /api/icons/catalog` so the frontend renders without bundling SVGs into the JS payload.
  * Curated 109 icons across 8 categories:
    * **Hygiene & morning routine:** toothbrush, soap, shower, comb, towel.
    * **Meals:** plate, fork, fruit, water bottle, milk.
    * **Tidying:** broom, vacuum, bed, toy box, books.
    * **School:** pencil, backpack, book, ruler.
    * **Pets & outdoor:** dog, cat, paw, plant, leaf.
    * **Avatar-friendly creatures:** fox, unicorn, dragon, owl, lion, butterfly, robot, star, heart.
    * **Parent/admin:** shield, crown, key, gear.
    * **Rewards:** ice cream, gift, movie reel, gamepad, ticket, balloon, swim ring.
  * Author `backend/app/icons/catalog.json` — one entry per icon with `name`, `category` (one of `hygiene | meals | tidying | school | pets | avatars | parent | rewards`, mapping 1:1 to the curation domains listed above), `svg_ref` (path under `icons/svg/`), `keywords_en[]` (3–6 terms incl. singular/plural and common synonyms), `keywords_el[]` (3–6 terms, same coverage). The `category` field drives the browse-mode grouping in Milestone 3.2. Keywords are the only text-search surface, so favour everyday parent vocabulary, not technical jargon.
  * Bake the catalog and SVG directory into the Docker image (Milestone 5.2) — no runtime fetches.
  * Download scripts in `scripts/fetch_icons.py` (downloads from jsDelivr CDN) and `scripts/build_catalog.py` (generates catalog.json with bilingual keywords).
  * *Test:* A pytest validator loads `catalog.json` and asserts: schema conformance (all five fields present), unique `name` across the file, `category` is in the allowed enum, no empty keyword lists, every `svg_ref` resolves to a real file on disk. A throwaway script (`scripts/preview_icons.py`) renders the full catalog to a static HTML grid grouped by `category` so the parent can eyeball-review and edit keywords *before* Milestone 3.2 wires the picker up.

---

## Phase 2: Authentication & Fast Switcher

*Build the entire login surface: avatar grid, PIN pad, PIN reset, first-run admin form.*

* [x] **Milestone 2.1: Avatar Grid Landing Page** — DONE
  * **Backend:** `GET /api/auth/users` returns the public-safe user list (`id`, `name`, `avatar_kind`, `avatar_value`, `role`) — no PIN data, no balances. Used only by the login screen.
  * **Frontend:** A `Landing` page component fetches the list via TanStack Query and renders circular avatar tiles in a responsive CSS grid (3 cols on phone, 5+ on tablet). Each tile shows the user's icon, name, and role badge (subtle for kids, prominent shield for admins). Tapping a tile sets a `selected_user_id` slice in the auth Zustand store and reveals the PIN pad.
  * *Test:* With 3 seeded users (2 kids, 1 admin), `GET /api/auth/users` returns 3 entries in DB-insertion order with no `pin_hash` leak. The React component renders 3 tiles; clicking one updates the store and toggles the PIN pad into view.

* [x] **Milestone 2.2: PIN Pad Component** — DONE
  * React `<PinPad>` component: 3×4 oversized numeric keypad (digits 0–9 + backspace + cancel).
  * Local component state tracks the entered digits (0–4). Visible input dots reflect the current length.
  * Cancel button clears the input and unsets `selected_user_id` in the auth store, returning to the avatar grid.
  * Touch-first styling: minimum 64px tap targets, no hover effects required, oversized focus/active states for touch feedback.
  * On the 4th digit, fire `onComplete(pin: string)` to the parent component (auth orchestrator in Milestone 2.3).
  * *Test:* React Testing Library test simulating taps `1,2,3,4` fills four dots and invokes the `onComplete` prop with `"1234"`; backspace removes the last dot; cancel clears the input and calls `onCancel`.

* [x] **Milestone 2.3: PIN Verification & Lockout** — DONE
  * **Backend:** `POST /api/auth/login` with body `{ user_id: int, pin: str }`. Checks lockout via `security/lockout.py`; on lockout responds `423 Locked` with `{ "locked_seconds": int }`. On wrong PIN, registers failure and responds `401`. On success, registers the success, signs and sets the session cookie, and responds with the logged-in user payload.
  * **Frontend:** On `PinPad.onComplete`, the auth orchestrator calls `POST /api/auth/login`. On `423`, render a countdown message in place of the keypad until the lockout expires. On `401`, run the shake/red-flash animation on the dots, clear input. On `200`, navigate to `/admin` or `/dashboard` based on the returned role.
  * *Test:* Backend integration test simulating 5 failed attempts triggers `423` with `locked_seconds > 0`; a successful login mid-streak resets the counter and clears `locked_until`. Frontend component test mocks the `/api/auth/login` endpoint with `MSW` to assert each response path triggers the correct UI behavior.

* [x] **Milestone 2.4: Session Management** — DONE
  * **Backend:** Session is the HttpOnly signed cookie set by `POST /api/auth/login` (per cross-cutting decisions). Add `POST /api/auth/logout` (clears the cookie) and `GET /api/auth/me` (returns the current user, or `401` if unauthenticated). A FastAPI dependency `require_user` (and `require_admin`) validates the cookie on every protected route.
  * **Frontend:** On app mount, the root component calls `GET /api/auth/me`; success hydrates the auth store, `401` falls back to the Landing page. A prominent "Logout / Έξοδος" button in the dashboard header calls `POST /api/auth/logout`, clears the auth store, and navigates to `/`.
  * Optional idle auto-logout: 30 minutes of inactivity calls `POST /api/auth/logout` and returns to the avatar grid (configurable via env var `IDLE_LOGOUT_MINUTES`, set to `0` to disable). Implementation: a single `useIdleTimer` hook that resets on `mousedown`/`touchstart`/`keydown`.
  * *Test:* Login, hard-refresh the page — `GET /api/auth/me` succeeds (cookie persisted by the browser) and the user lands back on their dashboard. Logout clears the cookie (verify via `Set-Cookie: ...; Max-Age=0`) and returns to the avatar grid. With `IDLE_LOGOUT_MINUTES=1` and `vi.useFakeTimers` advanced past 60s of no input, the session ends and the user is redirected to `/`.

* [x] **Milestone 2.5: First-Run Admin Setup Form** — DONE
  * **Backend:** `POST /api/bootstrap/setup` accepts `{ name, avatar_kind, avatar_value, pin }`. Refuses with `409 Conflict` if `is_first_run()` is false (prevents race conditions and replay). On success, inserts the admin row, signs and sets the session cookie, returns the created user.
  * **Frontend:** When the bootstrap status response is `first_run: true`, render a single-page form: name, avatar (using `AvatarPicker` from Milestone 3.2 — admin can pick an icon or upload an image), PIN (4 digits), confirm PIN. On submit, call `POST /api/bootstrap/setup`; on success, store hydrates and the user lands on the admin panel.
  * *Test:* End-to-end test on an empty DB: `GET /api/bootstrap/status` returns `first_run: true`, the form renders, submission inserts one admin row, subsequent `GET /api/bootstrap/status` returns `first_run: false`, and a second `POST /api/bootstrap/setup` is rejected with `409`.

* [x] **Milestone 2.6: Self-Service PIN Reset** — DONE
  * **Backend:** `POST /api/auth/me/pin` accepts `{ current_pin, new_pin }` (requires session). Verifies `current_pin` against `pin_hash` *without* touching the lockout counter (already-authenticated user); on mismatch responds `400`. On success, writes the new `pin_hash`.
  * **Frontend:** Gear icon on every dashboard opens a settings modal. Form: enter current PIN → enter new PIN → confirm new PIN → save. On `200`, show green confirmation banner. On `400`, show inline error.
  * *Test:* Correct current PIN + new PIN (entered twice) updates `pin_hash`; old PIN no longer verifies via `POST /api/auth/login`, new PIN does. Wrong current PIN returns `400` and leaves `failed_pin_attempts` untouched. Mismatched new-PIN confirmation is rejected client-side before any HTTP call.

---

## Phase 3: Admin Control Panel

*Build every surface the parents need to feed data into the app and process approvals.*

* [x] **Milestone 3.1: Admin Dashboard Shell** — DONE
  * **Frontend:** React Router layout at `/admin` with nested routes: `/admin/approvals` (with pending-count badge), `/admin/chores`, `/admin/rewards`, `/admin/users`, `/admin/fulfillment`. Sticky header carries the locale toggle + logout. The pending-count badge subscribes to the WebSocket (`pending_claims_changed` event) for live updates; falls back to a TanStack Query refetch on reconnect.
  * **Backend:** `GET /api/admin/pending-count` returns `{ count: int }` for initial render and reconnect fallback.
  * *Test:* Navigating between the five sections preserves the admin session (cookie carries through). The pending-count badge reflects the live `PendingClaim` row count — inserting two rows directly via the DB and broadcasting `pending_claims_changed` updates the badge to "2"; deleting one updates it to "1".

* [x] **Milestone 3.2: Icon & Avatar Pickers** — DONE
  * **Backend — Catalog endpoint:** `GET /api/icons/catalog` returns the parsed `catalog.json` (cached at startup). The TS frontend treats it as the source of truth for both grouping and search keywords.
  * **Frontend — `<IconPicker>`:** Search input above a scrollable grid of icons. Source: the catalog response. Every icon ships with hand-curated keywords in both locales (e.g., `fa-teeth` → `keywords_en: ["tooth", "teeth", "brush", "dental"]`, `keywords_el: ["δόντι", "δόντια", "βούρτσισμα", "οδοντόβουρτσα"]`). When the search box is empty, the grid renders the **entire catalog**, scrollable, grouped by `category` (Hygiene, Meals, Tidying, School, Pets, Avatars, Parent, Rewards — sourced from Milestone 1.6) with sticky section headers. A row of category chips above the grid acts as a multi-select filter applied as an AND on top of any active text query. Typing narrows live; clearing restores the full grid. The query is normalized (`String.prototype.normalize("NFD")` + lowercase + strip combining marks) and substring-matched against the normalized union of both keyword lists, so `tooth` or `δοντι`/`δόντι` surface the same icon. Used by chore and reward creation forms. Emits `(kind: 'icon', value: '<name>')`.
  * **Frontend — `<AvatarPicker>`:** Two-tab control: an "Icon" tab wrapping `<IconPicker>`, and an "Upload" tab with `<input type="file" accept="image/png,image/jpeg,image/webp">`, a live `<img>` preview, and a square crop handle (recommend `react-easy-crop`). Used by the first-run setup form and the user-management forms. Emits the same `(kind, value)` shape so downstream forms stay uniform.
  * **Backend — Upload pipeline:** `POST /api/avatars` accepts a `multipart/form-data` upload via FastAPI's `UploadFile` + `python-multipart`. Validate size (≤2 MB) and MIME (`image/png|jpeg|webp`) → re-encode to WebP, center-crop to 1:1, resize to 256×256 via Pillow → write to `/app/data/avatars/<uuid>.webp` → return `{ "url": "/avatars/<uuid>.webp" }`. When a user's avatar is later replaced via the user-update endpoint, the old file is deleted from disk (only when the previous `avatar_kind='image'`).
  * **Backend — Static serving:** Mount `app.mount("/avatars", StaticFiles(directory="/app/data/avatars"), name="avatars")` in `main.py`. URLs are stable regardless of the bind-mount's host path.
  * *Test:* `<IconPicker>` searches `tooth`, `Tooth`, `δόντι`, `δοντι` (no tonos), and `ΔΟΝΤΙ` (uppercase) all surface `fa-teeth`. A query in one locale does not exclude icons whose match came from the other locale's keyword list. Unit test the normalization helper directly (`normalize("Δόντι") === normalize("δοντι") === "δοντι"`). Browse mode: opening the picker with an empty query renders every icon in the catalog grouped under its category header (count rendered === count in `catalog.json`); selecting the "Hygiene" chip narrows to that category only; typing `tooth` while "Hygiene" is selected narrows further (intersection, not union); clearing both restores the full grid. Backend upload integration test: a 5 MB JPEG is rejected with `400`; a 1 MB PNG is accepted, written as a WebP at `/app/data/avatars/<uuid>.webp`, and `GET /avatars/<uuid>.webp` returns the bytes. Replacing an uploaded avatar via the user-update endpoint deletes the old WebP from disk.

* [x] **Milestone 3.3: Chore CRUD** — DONE
  * **Backend:** `GET /api/admin/chores`, `POST /api/admin/chores`, `PATCH /api/admin/chores/{id}`, `DELETE /api/admin/chores/{id}` (soft delete by flipping `is_active=False` — historical ledger rows must keep their FK). Pydantic request models enforce validation: points > 0, window_hours in 1–24, start_time is a valid `HH:MM`, both locale titles present. All admin endpoints are gated by the `require_admin` dependency.
  * **Frontend:** Listing view at `/admin/chores`: table of all chores with `is_active` toggle, edit, delete buttons. Create/edit modal: bilingual `title_el` / `title_en` (both required), bilingual descriptions (optional), icon (via `<IconPicker>`), scope dropdown (individual/pooled), points, is_repeating, start_time, window_hours. Uses react-hook-form + Zod schema mirroring the backend validation for instant client-side feedback.
  * *Test:* Create a chore via the API, edit its window, soft-delete it; verify `GET /api/dashboard/visible-chores` no longer returns it but the existing `HistoryLedger` rows referencing its `id` still render in the kid history endpoint.

* [x] **Milestone 3.4: Reward CRUD** — DONE
  * **Backend:** `GET /api/admin/rewards`, `POST /api/admin/rewards`, `PATCH /api/admin/rewards/{id}`, `DELETE /api/admin/rewards/{id}`. For v1, `cost_stars` *is* the collaborative target (one row, one goal); no separate `collab_target_stars` field.
  * **Frontend:** Listing view at `/admin/rewards`: table with `is_enabled` toggle, edit, delete. Create/edit modal: bilingual title/description, icon, cost, `is_collaborative` toggle.
  * *Test:* Toggle `is_enabled=false`; `GET /api/marketplace/rewards` (kid-facing) no longer returns the row, but `GET /api/admin/rewards` still does.

* [x] **Milestone 3.5: Approvals Queue** — DONE
  * **Decision (unchanged):** Keep a small `PendingClaim(id, user_id, chore_id, claimed_at)` table — appending pending rows to the ledger and later mutating them muddies the immutable-ledger invariant.
  * **Backend:** `GET /api/admin/pending-claims` returns the joined pending-claim view (claim id, user id+name+avatar, chore id+icon+localized title pair, `claimed_at`) ordered by newest first.
  * **Frontend:** View at `/admin/approvals` renders each pending claim as a card: child avatar, chore icon + title (localized via the i18n store), claim time, [Approve ✅] [Decline ❌] buttons, optional admin-note textarea. The pending-count badge on the navigation derives from this list's length.
  * *Test:* Seed two `PendingClaim` rows and one approved `HistoryLedger` row; `GET /api/admin/pending-claims` returns exactly two items (newest first), the approved row does not appear. The React component renders two cards and the nav badge shows "2".

* [x] **Milestone 3.6: Approve / Decline Logic** — DONE (WebSocket broadcast deferred to M4.8)
  * **Backend endpoints:**
    * `POST /api/admin/pending-claims/{id}/approve` — transactional: delete the `PendingClaim` row, insert `HistoryLedger(action_type='chore_approved', points_delta=+chore.points_value, ref_table='chore', ref_id=chore.id)`, increment `User.current_stars`. Broadcast `stars_changed` (for the affected user) and `pending_claims_changed` over the WebSocket.
    * `POST /api/admin/pending-claims/{id}/decline` — transactional: delete the `PendingClaim` row, insert `HistoryLedger(action_type='chore_declined', points_delta=0, admin_note=...)`. No balance change because nothing was credited yet. Broadcast `pending_claims_changed`.
    * `POST /api/admin/history/{ledger_id}/retroactive-decline` — operates on already-approved chores: insert `HistoryLedger(action_type='chore_declined', points_delta=-chore.points_value, admin_note=...)` and decrement `User.current_stars`. The original approval row stays for transparency; the negative row offsets it. Broadcast `stars_changed` and `history_changed`.
  * All three handlers run under a SQLAlchemy session with `BEGIN IMMEDIATE` (SQLite) so concurrent admin actions serialize cleanly.
  * *Test:* Concurrent approves on the same pending claim — second one must fail cleanly with `404` (row already gone) and emit no extra ledger row. Retroactive decline against a non-`chore_approved` ledger row is rejected with `400`.

* [x] **Milestone 3.7: User Management** — DONE
  * **Backend:** `GET /api/admin/users`, `POST /api/admin/users` (create), `PATCH /api/admin/users/{id}` (edit name/avatar/role), `DELETE /api/admin/users/{id}` (soft-delete via `is_active=False` flag — preserves ledger references), `POST /api/admin/users/{id}/pin-reset` (admin force-reset for forgotten kid PINs).
  * **Frontend:** Listing view at `/admin/users` — table of all users with role, avatar, balance, "Edit" / "Delete" / "Reset PIN" actions. Create form: name, role (admin/user), avatar (via `<AvatarPicker>`), initial PIN. Edit form: name, avatar, role. Replacing an uploaded avatar deletes the old file from disk per Milestone 3.2's pipeline.
  * *Test:* Creating a kid via `POST /api/admin/users` inserts a `User` row with the entered fields. `PATCH` updates the row without changing `id`. `DELETE` flips `is_active=False`; `GET /api/auth/users` no longer returns the row (avatar grid hides them) but `GET /api/admin/history?user_id=<id>` still renders existing ledger entries.

* [x] **Milestone 3.8: Manual Star Adjustments** — DONE
  * **Backend:** `POST /api/admin/users/{id}/adjust-stars` with body `{ points_delta: int, description: str }`. Pydantic validation: `description` length ≥ 3. Handler (transactional): update `User.current_stars`, insert `HistoryLedger(action_type='manual_adjust', points_delta=±N, admin_note=description, ref_table=NULL, ref_id=NULL)`. Reject adjustments that would push balance below 0 with `400` (configurable; default reject). Broadcast `stars_changed`.
  * **Frontend:** "Adjust Stars" button on each user row opens a modal with +/− toggle, integer input, mandatory description textarea.
  * *Test:* Applying `+3` with note `"for sharing"` to a user with balance 10 results in balance 13 and a single `HistoryLedger(action_type='manual_adjust', points_delta=+3, admin_note='for sharing', ref_table=NULL, ref_id=NULL)`. Applying `-20` to a user with balance 5 returns `400`; balance stays at 5 and no ledger row is written. Empty/short descriptions are rejected by Pydantic before any DB write.

* [x] **Milestone 3.9: Reward Fulfillment Queue** — DONE
  * **Backend:** `GET /api/admin/fulfillment?status=claimed|fulfilled` returns the matching `RewardLedger` rows joined with reward and contributor info. `POST /api/admin/fulfillment/{ledger_id}/mark-fulfilled` updates `status='fulfilled'` and `fulfilled_at=now()`.
  * **Frontend:** View at `/admin/fulfillment` renders one card per `claimed` row (child, reward icon+title, claimed time) with a [Mark Fulfilled] button. Fulfilled items render in a paginated read-only archive sub-tab.
  * *Test:* A `RewardLedger` row with `status='claimed'` appears in the active queue endpoint; tapping "Mark Fulfilled" sets `status='fulfilled'` and a non-null `fulfilled_at`, removes the row from `?status=claimed` and surfaces it under `?status=fulfilled`.

* [x] **Milestone 3.10: Admin Activity View (optional polish)** — DONE
  * **Backend:** `GET /api/admin/history` with query params `user_id`, `action_type`, `from`, `to`, `limit`, `offset`. Returns the matching `HistoryLedger` rows with embedded chore/reward summary fields.
  * **Frontend:** Paginated table at `/admin/activity` with the same filters as form controls.
  * *Test:* With seeded ledger spanning two users and three days, filtering by `user_id` returns only that user's rows; filtering by date range excludes rows outside the range; pagination at `limit=10` returns the correct offset/count for a 25-row fixture.

---

## Phase 4: Kid Dashboard & Gamification

*The most visually intense phase. Large buttons, high contrast, dynamic rendering, real-time updates.*

* [x] **Milestone 4.1: Kid Dashboard Shell** — DONE
  * **Frontend:** React Router layout at `/dashboard` with nested routes: `/dashboard/chores` (default), `/dashboard/marketplace`, `/dashboard/history`, `/dashboard/leaderboard`. Top section: large avatar + name, animated star counter (`current_stars`). Sticky locale toggle + logout. The star counter subscribes to `stars_changed` events on the WebSocket (Milestone 4.8) and animates between the previous and new value using `framer-motion` or a CSS transition on a `tabular-nums` span.
  * *Test:* Logged-in kid sees her own avatar, name, and `current_stars` value. Sending a `stars_changed` event over the WebSocket re-renders the counter with the new value and triggers the animated transition (use Playwright or Vitest + an in-memory WebSocket mock).

* [x] **Milestone 4.2: Dynamic Chore Visibility Engine** — DONE (reworked)
  * **Backend functions** in `backend/app/services/chores.py`:
    * `chores_for_dashboard(user_id, now, db) -> list[dict]` — returns ALL in-window chores with `{chore, status, claimed_by}`. Status: `available` / `pending` / `approved`. For `claim_mode="each"` status reflects only this user's claim; for `claim_mode="one"` it reflects any user's claim.
    * `chore_is_available_for(user_id, chore, now, db) -> bool` — used by the claim endpoint to gate submissions.
    * `_start_of(d: date) -> datetime` — returns Athens midnight as a **naive UTC datetime** for correct string-comparison with SQLite's UTC-stored timestamps (timezone-aware datetimes cause SQLite string comparison failures for claims made between UTC midnight and Athens midnight).
  * **Endpoint:** `GET /api/dashboard/visible-chores` returns all in-window chores (not just claimable ones) with `id`, `title`, `icon_name`, `claim_mode`, `points_value`, `status`, `claimed_by`. Frontend uses `status` to decide whether to show a claim button, a pending badge, or a "claimed by [name+avatar]" indicator.
  * *Test:* After claiming an `each`-mode chore, the chore remains in the response with `status="pending"`. After claiming a `one`-mode chore, all other users see `status="pending"` with `claimed_by` populated.

* [x] **Milestone 4.3: Chore Cards & Claim Flow** — DONE (reworked)
  * **Frontend:** Each chore card renders based on `status`:
    * `available` → shows "Claim / Διεκδίκηση" button.
    * `pending` + my claim → shows "Awaiting approval" badge (blue).
    * `approved` + my claim → shows "Approved!" badge (green).
    * `pending`/`approved` + someone else's claim (`one`-mode only) → shows "Claimed by {name}" / "Done by {name}" with the claimant's avatar. No claim button.
  * **Backend `POST /api/dashboard/chores/{id}/claim`:**
    * Calls `chore_is_available_for()` — returns 409 if not available.
    * Extra race guard for `claim_mode="one"`: re-checks no pending claim exists today before inserting.
    * Broadcasts `visible_chores_changed` to `"all"` for `one`-mode, `"user"` for `each`-mode.
  * Approve/decline in `api/admin.py` also broadcasts `visible_chores_changed` to `"all"` for `one`-mode (so the approved/available state propagates to all kids) or `"user"` for `each`-mode.
  * *Test:* After claiming an `each`-mode chore, same chore stays in response with `status="pending"`. For `one`-mode, second kid's claim returns `409`.

* [x] **Milestone 4.4: Kid History Timeline** — DONE
  * **Backend:** `GET /api/dashboard/history?limit=...&offset=...` returns the calling kid's own `HistoryLedger` rows joined with chore/reward summaries, newest first. Authorization scoped to `current_user.id` — no `user_id` query param accepted.
  * **Frontend:** Paginated view at `/dashboard/history`. Each row renders as a colored timeline entry, color-coded by `points_delta` sign:
    * `+5 ⭐ — Βούρτσισμα Δοντιών — Εγκρίθηκε` (green)
    * `-5 ⭐ — Βούρτσισμα Δοντιών — Declined by Parent: Toothbrush was dry!` (red)
    * `+3 ⭐ — For sharing her blocks beautifully` (gold, manual adjustment)
    * `-20 ⭐ — Redeemed 1 Hour of Screen Time` (blue)
  * Strings localized via the i18n store (initialized from `User.preferred_locale`). Chore/reward titles fall back client-side: prefer the active locale, fall back to the other if missing — implemented as a single `pickLocalized(row, locale)` helper used wherever bilingual content renders.
  * *Test:* With four seeded ledger rows (chore approval +5, retroactive decline -5, manual adjust +3, reward purchase -20), the timeline renders four entries newest-first with correct sign-based colors. Toggling locale via `<LocaleToggle>` from `el` to `en` re-renders strings; rows referencing a chore that has only `title_en` populated still render (locale fallback). Unit-test `pickLocalized` for both-present, primary-missing, both-missing (throws) cases.

* [x] **Milestone 4.5: Marketplace — Individual Rewards** — DONE
  * **Backend:** `GET /api/marketplace/rewards` returns `is_enabled=True` rewards (both individual and collaborative — frontend separates them in render). `POST /api/rewards/{id}/redeem` (transactional, `BEGIN IMMEDIATE`): reject if `is_collaborative=True` (use the contribute endpoint instead), re-verify balance, decrement `User.current_stars`, insert `RewardLedger(status='claimed')`, insert `HistoryLedger(action_type='reward_purchase', points_delta=-cost)`. Insufficient balance returns `400`. Broadcast `stars_changed` and `fulfillment_queue_changed`.
  * **Frontend:** Card grid of individual rewards at `/dashboard/marketplace`. Each card: icon, localized title/description, cost badge, "Redeem / Εξαργύρωση" button. Button is grayed with a padlock overlay when `current_stars < cost`.
  * *Test:* A kid with `current_stars=35` sees the Redeem button enabled on a 20-star reward and disabled (padlock overlay) on a 50-star reward. Calling `POST /api/rewards/{id}/redeem` on the 20-star reward decrements balance to 15, inserts one `RewardLedger(status='claimed')`, and inserts one `HistoryLedger(action_type='reward_purchase', points_delta=-20)`. A concurrent redeem that would push balance below 0 returns `400`; the balance never drops below 0.

* [x] **Milestone 4.6: Marketplace — Collaborative Rewards** — DONE
  * **Backend:** `POST /api/rewards/{id}/contribute` with body `{ stars: int }` (transactional, `BEGIN IMMEDIATE`): row-lock the reward, re-verify the cap (`current + stars <= target`), decrement user balance, insert/update a `RewardLedger` row for this user (`status='claimed'`, `stars_contributed` accumulates), insert `HistoryLedger(action_type='reward_purchase', points_delta=-stars, ref_table='reward', ref_id=reward.id)`. When the total contributions reach the target, the reward becomes visible in `GET /api/admin/fulfillment?status=claimed` with all contributors listed. Broadcast `stars_changed`, `collab_progress_changed` (carries reward_id + new totals for the progress bar), and `fulfillment_queue_changed` on cap-reach.
  * **Frontend:** Separate "Epic Goals / Επικοί Στόχοι" section above the individual cards. Each card shows a horizontal progress bar with stacked per-user contributions (different colors per child) and `current / target ⭐` text. "Contribute Stars / Συνεισφορά" button opens a slider modal: range 1 to `min(user.current_stars, target - current)`, plus a confirm button. Progress bars subscribe to `collab_progress_changed` for live updates across devices.
  * *Test:* Two kids contribute 15 and 10 to a 500-star goal — the progress bar reads 25/500 with two stacked colored segments and the reward is absent from the admin's fulfillment queue. Contributions exactly summing to 500 stop further client-side increments (slider max enforces) and surface the goal in the fulfillment queue with both contributor names. Concurrent contributions that would together exceed the cap: the second one is rejected with `400`, never overshoots.

* [x] **Milestone 4.7: Podium Leaderboard** — DONE
  * **Backend:** `GET /api/leaderboard` returns kids only (per README §5 framing), `role='user'` AND `is_active=True`, ranked by `current_stars` descending; tie-break by `id` ascending in the pure sort helper for determinism.
  * **Frontend:** Standalone page at `/dashboard/leaderboard`. Top 3 rendered as a literal podium (1st center+tall, 2nd left, 3rd right); the rest as a list below. The page subscribes to `stars_changed` over the WebSocket and re-queries `/api/leaderboard` so the order updates without refresh.
  * *Test:* With three kids at 50/30/10 stars, the podium renders 1st centered+tall, 2nd left, 3rd right in that order. Bumping the 3rd-place kid to 60 stars via `POST /api/admin/users/{id}/adjust-stars` re-renders the page with the new ordering (driven by the broadcast `stars_changed` event). Unit-test the pure sorting helper directly: equal balances tie-break by ascending id deterministically.

* [x] **Milestone 4.8: Real-Time WebSocket Broadcaster** — DONE
  * **Backend `backend/app/realtime/broadcaster.py`:** A single in-process pub/sub. Tracks connected sockets in a dict keyed by `(user_id, role)`. Exposes:
    * `async def connect(websocket, user_id, role)` / `async def disconnect(websocket)`.
    * `async def emit(event: str, payload: dict, audience: Literal['all', 'admins', 'user'], user_id: int | None = None)`.
  * **WebSocket endpoint `WS /ws`** authenticates via the session cookie on connect (reject `4401` if absent/invalid), then registers the socket. The frontend opens one connection per dashboard mount via `new WebSocket("/ws")`; the browser includes the session cookie automatically because the request is same-origin.
  * **Event vocabulary** (used across earlier milestones, captured here as the canonical list):
    * `stars_changed` → `{ user_id, current_stars }` → audience: `all`.
    * `pending_claims_changed` → `{ count }` → audience: `admins`.
    * `visible_chores_changed` → `{ user_id }` (frontend refetches its `visible-chores` query) → audience: `user` for `each`-mode chore claims/approvals/declines, `all` for `one`-mode.
    * `collab_progress_changed` → `{ reward_id, current, contributions: [{user_id, stars}] }` → audience: `all`.
    * `fulfillment_queue_changed` → `{}` → audience: `admins`.
    * `history_changed` → `{ user_id }` (frontend refetches the kid's history) → audience: `user`.
  * **Frontend hook `useRealtime()`** establishes one WebSocket per dashboard, auto-reconnects with exponential backoff, and dispatches incoming events to TanStack Query's `queryClient.invalidateQueries(...)` so the affected views refetch automatically. Optimistic updates from local mutations are preserved on reconnect via React Query's stale-while-revalidate semantics.
  * *Test:* Backend unit-test the broadcaster's `emit` audience routing with stub WebSockets. Backend integration test connects a test client to `/ws` with a valid cookie, triggers `POST /api/chores/{id}/claim`, and asserts the test client receives `pending_claims_changed`. Multi-device manual test checklist captured in `docs/realtime-test.md`: open the kid's dashboard on tablet A, open the admin approvals queue on phone B, claim a chore on A, approve from B, watch A's star counter animate up without refresh.

* [x] **Milestone 4.9: Frontend Test Infrastructure** — DONE
  * **Test framework:** Vitest (v3.2.4) with jsdom environment, configured in `frontend/vitest.config.ts`.
  * **Component testing:** `@testing-library/react` + `@testing-library/jest-dom` matchers via `expect.extend()`. MSW (Mock Service Worker) for API interception in `frontend/tests/handlers.ts`.
  * **Test coverage:** 113 tests across 15 files covering Zustand stores (auth, i18n), API client functions (auth, bootstrap, admin CRUD, dashboard, marketplace), React components (PinPad, IconPicker), pages (Landing, Setup, DashboardChores, Leaderboard, Marketplace, KidHistory, ApprovalsPage, ActivityPage).
  * Run via `npm test` (runs `vitest run`). All 113 passing.
  * *Note:* React 19 + testing-library compatibility required switching from happy-dom to jsdom, using `expect.extend(matchers)` pattern instead of `@testing-library/jest-dom/vitest` import, and downgrading Vitest from 4.x to 3.x.

---

## Phase 5: Deployment & Polish

* [x] **Milestone 5.1: Responsive Polish & Accessibility Pass** — DONE
  * Fixed hamburger menu visibility bug: `display: none` in App.css was overriding media query `display: flex` due to CSS cascade order. Changed base to `display: flex` (React conditional rendering already prevents desktop rendering).
  * Verified at 375px, 767px, 768px, 1280px via Playwright tests.
  * PIN pad keys confirmed 72x72px (>=64px tap target requirement).
  * Sidebar correctly collapses with mobile class at <768px; hamburger opens/closes drawer with backdrop overlay.
  * Added 9 Playwright responsive tests in `frontend/tests/responsive.spec.ts`.

* [x] **Milestone 5.6: Chore Form Rework & Notification System** — DONE
  * **Chore form UI reworked for touch screens:** Scope → toggle buttons (Individual/Pooled), Repeating → toggle button, Repeat Pattern → toggle buttons (Daily/Weekly) replacing radio buttons, "Every N Days" removed (weekday selector already covers school-day patterns), Window → preset toggle buttons (None, 1h, 2h, 4h, 8h) replacing number input.
  * **Notification system added:** `react-hot-toast` for toast notifications + `canvas-confetti` for celebratory animations. Toast on: chore/reward/user CRUD, claim, approve/decline, star adjustments, fulfillment. Confetti on: approve claims, redeem rewards, contribute to collab goals, adjust stars, mark fulfilled. Mounted `<Toaster>` in `main.tsx`, helper functions in `src/lib/notify.ts`.

* [x] **Milestone 5.2: Dockerfile (multi-stage)** — DONE
  * **Stage 1 — Frontend build:** `node:20-alpine`. Copy `frontend/package*.json`, run `npm ci`, copy `frontend/`, run `npm run build` → emits `frontend/dist/`.
  * **Stage 2 — Backend build:** `python:3.12-slim`. Copy `backend/pyproject.toml`, install dependencies into a venv. (Optional separate stage helps Docker layer caching when only frontend changes.)
  * **Stage 3 — Runtime:** `python:3.12-slim`. Copy the venv from Stage 2 and the `backend/` source. Copy `frontend/dist/` from Stage 1 into `/app/static/`. Bake the icon catalog + SVGs into the image — no runtime CDN fetches (LAN deployment). On container start, run Alembic migrations then `uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 1` (workers=1 is required so the in-process WebSocket broadcaster sees every event). `TZ=Europe/Athens` baked in via `ENV TZ=Europe/Athens`.
  * **FastAPI static + SPA fallback:** `main.py` mounts `app.mount("/", StaticFiles(directory="/app/static", html=True), name="spa")` *last*, after API and WebSocket routers, so unmatched paths fall back to `index.html` for client-side routing.
  * *Test:* `docker build .` succeeds. Running the image locally with `-p 8000:8000 -v $(pwd)/data:/app/data` runs Alembic migrations on first boot (creating the DB at `data/padelerodouleies.db` on the host), serves the first-run admin form at `http://localhost:8000/`, `curl http://localhost:8000/api/health` returns `200`, `curl http://localhost:8000/api/openapi.json` returns the schema, and `docker exec <container> date` reports Athens local time.

* [x] **Milestone 5.3: docker-compose & Storage** — DONE
  * Single service `padelerodouleies` in `docker-compose.yml`.
  * Bind mount: `/mnt/raid/padelerodouleies/data:/app/data` (host path overridable via `.env`).
  * Port mapping: `8000:8000` (FastAPI serves both the JSON/WebSocket API and the built Vite SPA from one process).
  * Healthcheck: `curl -fsS http://localhost:8000/api/health || exit 1` every 30s.
  * Auto-restart `unless-stopped`.
  * *Test:* `docker-compose up -d` brings the service to `healthy`. Complete the first-run admin form, create a user with an uploaded avatar; then `docker-compose down && docker-compose up -d` and verify the admin user, the avatar WebP file at `/mnt/raid/padelerodouleies/data/avatars/`, and the SQLite DB all persist via the bind mount.

* [x] **Milestone 5.4: Usability scripts** — DONE
  * Write python scripts for backing up the db (dump to json) and populating a db from a json dump (place them in backend/scripts)
  * `backend/scripts/backup_db.py` dumps every table to JSON (datetimes/times as ISO strings); `backend/scripts/restore_db.py` wipes and reloads verbatim (PKs preserved, `--force` to skip the prompt). Roundtrip verified.

* [x] **Milestone 5.5: Handover Docs** — DONE
  * Update `README.md` with a brief "Running" section: env vars (`TZ`, `DB_PATH`, `IDLE_LOGOUT_MINUTES`, `SESSION_SECRET` for the cookie signer), compose-up flow, where the DB file lives, how to add an admin from scratch (delete DB, restart, re-run setup), how to regenerate `frontend/src/api/schema.d.ts` against the running backend, basic troubleshooting.


---

## Out of scope (v1)

Items considered and deliberately deferred. Revisit if the family asks.

- Push notifications to parent's phone (LAN PWA + queue badge is sufficient for v1).
- Multi-household / multi-tenant support.
- Cloud backup of the SQLite file (RAID handles redundancy; manual `cp` snapshots are documented in 5.5).
- Web-accessible deployment outside the LAN (would require auth hardening beyond 4-digit PINs).
