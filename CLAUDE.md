### CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Status

Phases 1–4 complete. Phase 5 M5.1 (responsive polish & accessibility) complete. M5.6 (chore form rework + notification system) complete. Schema update: Chore/Reward models now use single `title`/`description` fields (removed `*_el`/`*_en` pairs), `Chore.start_time` is nullable, `User.username` is unique case-insensitive, `HistoryLedger` has `action_label` column, `User` has `preferred_theme` column (`system`/`light`/`dark`), `Chore.scope` renamed to `Chore.claim_mode` with values `each`/`one` (replacing old `individual`/`pooled`). Bugs fixed: missing setup icons, user self-deletion, chore 422 on missing start_time, image avatar double-prefix on login page, logout stale redirect, WebSocket double-accept error, timezone comparison bug in `_start_of` (now returns naive UTC datetime for correct SQLite string comparison), non-translated "Admin" sidebar label (now Greek "Διαχειριστής"), empty leaderboard with a single user, leaderboard celebration firing 3× (now once per visit via a ref guard), browser tab title (`frontend` → `padelerodouleies`), declined chores missing from the activity ITEM column (`decline_claim` now records the chore `ref_table`/`ref_id`), tiny image avatars on the login screen. Removed the manual stars-adjustment button from the admin users page. Features added: theme system (user-controlled dark/light/system), keyboard PIN input, lazy icon loading, touch-friendly toggle-based chore form UI, toast notification system with confetti celebrations, claimed-chore visibility (chores stay visible with claimant name+avatar instead of disappearing), admin avatar shown next to the name in the header, admin table pagination (reusable `Pagination`/`usePagination` in `components/Pagination.tsx` — client-side for chores/rewards/users/fulfillment/approvals, server-side via limit/offset for activity), yellow-star favicon, a playful kid-friendly login screen (animated background, language toggle), and per-tab themed animated backgrounds (`components/PageBackground.tsx` + `bgVariantForPath`, a fixed `z-index:-1` layer with a per-tab colour palette, light/dark aware, `prefers-reduced-motion` respected) across all kid and admin tabs. Remaining: M5.2 (Dockerfile), M5.3 (docker-compose), M5.4 (LAN testing), M5.5 (handover docs). Frontend has 114 Vitest tests (all passing) + 67 backend pytest tests. When asked to implement features, treat `PLAN.md` as the authoritative roadmap and `README.md` as the spec; if either disagrees with code that gets written later, the code wins but flag the drift.

## Stack & Architecture

Split frontend/backend, served from one container in production. The frontend is a **Vite + React + TypeScript** SPA; the backend is a **FastAPI** ASGI app that serves the built SPA assets as static files alongside the JSON / WebSocket API. The "single container, LAN-only, long-term self-hosted maintenance" constraint is load-bearing — deviations (e.g., separate Nginx, splitting frontend into its own container) should be raised before writing code.

- **Frontend:** Vite + React + TypeScript (strict mode). Built to static assets and copied into the runtime container; FastAPI mounts the build output and SPA-fallbacks to `index.html` for client-side routes.
- **Backend:** FastAPI on Uvicorn. SQLAlchemy + Alembic for persistence. WebSockets for realtime push.
- **Database:** Embedded SQLite, bind-mounted from container to host RAID at `/mnt/raid/padelerodouleies/data` → `/app/data/` inside the container. Schema is relational (5 tables: `USERS`, `CHORES`, `CHORE_HISTORY`, `REWARDS`, `REWARD_LEDGER` — see README §Database Schema).
- **Deployment:** Single multi-stage `Dockerfile` (Node build stage for frontend → Python runtime stage that bundles both) orchestrated via `docker-compose`. LAN-only (no public exposure planned).
- **Realtime:** FastAPI WebSocket endpoint with an in-process pub/sub broadcaster; state changes (chore approval, balance updates, leaderboard reordering) are pushed to all connected clients without page refresh.

## Core Domain Invariants

These are non-obvious rules that must hold across any feature work:

1. **Two roles only, PIN-gated.** `admin` (parents) vs `user` (kids). Auth is a 4-digit numeric PIN, not username/password. The landing UI is an avatar grid → giant 3×4 keypad → instant verify on the 4th keystroke. No text-entry login flows.
2. **Chore visibility is computed on-the-fly from `datetime.now()`** at dashboard render time, against the chore's `start_time` + `window_hours` and any existing same-day `CHORE_HISTORY` row. There is **no background scheduler / cron** materializing daily chore instances. Do not introduce one without discussion.
3. **Chore `claim_mode` is either `each` (every kid claims independently) or `one` (first kid to claim it takes it for the period).** Claimed chores always remain visible in the dashboard — `each` shows each kid's own status; `one` shows the claimant's name and avatar to other kids. The `/api/dashboard/visible-chores` response always includes all in-window chores with `status` (`available`/`pending`/`approved`) and `claimed_by` (null or `{user_id, name, avatar_kind, avatar_value}`).
4. **The history ledger is append-only and human-visible.** When an admin retroactively declines an approved claim, the system subtracts stars *and* writes a negative-delta row that the child sees in their timeline with the admin's reason text. Never silently mutate a child's balance — every delta must have a corresponding ledger entry.
5. **Bilingual by design, single-title content.** Default locale is Greek (`el`), secondary is English (`en`). All static UI strings live in a central `translations.py`. Admin-created content (chore/reward titles) uses a single `title`/`description` field — the admin types in whatever language they prefer, no bilingual columns. New user-visible strings must go through the translation layer, not be hardcoded.
6. **Collaborative rewards** pool stars from multiple users toward a shared target with a combined progress bar — distinct from individual rewards which deduct from one balance. The `is_collaborative` flag on `REWARDS` drives different UI and ledger logic.
7. **Theme system** is user-controlled per account. `User.preferred_theme` stores `system`/`light`/`dark`. The frontend `ThemeWatcher` in `main.tsx` applies `data-theme` to `<html>`. CSS uses both `@media (prefers-color-scheme: dark)` (browser default) and `html[data-theme="dark"]` (user choice). When testing, the theme attribute takes visual precedence over media queries.
8. **User deletion** is guarded: users cannot delete themselves, and the last active admin cannot be deleted. Backend raises 400; frontend hides the delete button for the current session user.
9. **WebSocket** accept is only called once in `main.py`; `broadcaster.connect()` does NOT call `accept()` again.

## Implementation Phases (from PLAN.md)

Work is sequenced as: (1) DB models + i18n scaffold → (2) Fast-Switcher auth + PIN reset → (3) Admin panel (chore/reward CRUD, approvals queue, manual star adjustments, fulfillment queue) → (4) Kid dashboard (dynamic chore cards, claim loop, marketplace, podium) → (5) Dockerfile + compose + LAN testing. M5.1 (responsive polish) is done. Next: M5.2 (Dockerfile). When picking up work, locate the current milestone in `PLAN.md` rather than guessing.

## Conventions

- Code comments and documentation: English (per global user instructions).
- Fail explicitly with clear exceptions — no silent fallback logic.
- Prefer functional style and immutability. SQLAlchemy ORM classes and Pydantic models are the natural exception on the backend; React function components with hooks are the default on the frontend (no class components).
- Strict typing with explicit return types: Python type hints + `mypy --strict` on the backend; TypeScript `strict: true` on the frontend.
- Minimal diffs; do not rewrite files for small changes.

## Testing

- **Frontend:** Vitest (v3.2.4) + jsdom + React Testing Library + MSW. Run `npm test` in `frontend/`. Tests live in `src/**/*.test.{ts,tsx}`. Test config in `vitest.config.ts`, setup in `tests/setup.ts`. 114 tests across 15 files, all passing.
- **E2E:** Playwright in `frontend/tests/responsive.spec.ts`. Requires backend running on :8000 and frontend on :5173. Run `npx playwright test` in `frontend/`. 9 responsive tests.
- **Backend:** pytest + httpx for FastAPI test client. Run `pytest` in `backend/`. 67 tests, all passing. Tests use the file database with an autouse fixture that deletes all rows after each test.
- MSW handlers registered via `server.use()` are NOT consumed after a single match — use a closure variable to track call count for sequential response patterns.
- React 19 + testing-library compatibility: jsdom over happy-dom, `expect.extend(matchers)` pattern for jest-dom, `@testing-library/user-event` for mutation flows that require proper event sequencing.
- Responsive breakpoint: `useIsMobile()` uses `< 768px` (not `<=`). CSS media queries use `max-width: 768px`. One-pixel off-by-one at exactly 768px is acceptable.
- Hamburger button visibility was fixed in M5.1 by changing `display: none` → `display: flex` in App.css (React conditional rendering handles DOM presence; CSS cascade order was overriding media queries).
