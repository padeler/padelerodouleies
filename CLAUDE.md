### CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Status

Phases 1–4 complete. Phase 5 M5.1 (responsive polish & accessibility) complete. Schema update: Chore/Reward models now use single `title`/`description` fields (removed `*_el`/`*_en` pairs), `Chore.start_time` is nullable, `User.username` is unique case-insensitive, `HistoryLedger` has `action_label` column. Remaining: M5.2 (Dockerfile), M5.3 (docker-compose), M5.4 (LAN testing), M5.5 (handover docs). Frontend has 113 Vitest tests (all passing) + 9 Playwright responsive tests. When asked to implement features, treat `PLAN.md` as the authoritative roadmap and `README.md` as the spec; if either disagrees with code that gets written later, the code wins but flag the drift.

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
3. **Chore scope is either `individual` (per-user instance) or `pooled` (first-come-first-served, disappears once claimed by anyone).** This affects every dashboard query that lists active chores.
4. **The history ledger is append-only and human-visible.** When an admin retroactively declines an approved claim, the system subtracts stars *and* writes a negative-delta row that the child sees in their timeline with the admin's reason text. Never silently mutate a child's balance — every delta must have a corresponding ledger entry.
5. **Bilingual by design, single-title content.** Default locale is Greek (`el`), secondary is English (`en`). All static UI strings live in a central `translations.py`. Admin-created content (chore/reward titles) uses a single `title`/`description` field — the admin types in whatever language they prefer, no bilingual columns. New user-visible strings must go through the translation layer, not be hardcoded.
6. **Collaborative rewards** pool stars from multiple users toward a shared target with a combined progress bar — distinct from individual rewards which deduct from one balance. The `is_collaborative` flag on `REWARDS` drives different UI and ledger logic.

## Implementation Phases (from PLAN.md)

Work is sequenced as: (1) DB models + i18n scaffold → (2) Fast-Switcher auth + PIN reset → (3) Admin panel (chore/reward CRUD, approvals queue, manual star adjustments, fulfillment queue) → (4) Kid dashboard (dynamic chore cards, claim loop, marketplace, podium) → (5) Dockerfile + compose + LAN testing. M5.1 (responsive polish) is done. Next: M5.2 (Dockerfile). When picking up work, locate the current milestone in `PLAN.md` rather than guessing.

## Conventions

- Code comments and documentation: English (per global user instructions).
- Fail explicitly with clear exceptions — no silent fallback logic.
- Prefer functional style and immutability. SQLAlchemy ORM classes and Pydantic models are the natural exception on the backend; React function components with hooks are the default on the frontend (no class components).
- Strict typing with explicit return types: Python type hints + `mypy --strict` on the backend; TypeScript `strict: true` on the frontend.
- Minimal diffs; do not rewrite files for small changes.

## Testing

- **Frontend:** Vitest (v3.2.4) + jsdom + React Testing Library + MSW. Run `npm test` in `frontend/`. Tests live in `src/**/*.test.{ts,tsx}`. Test config in `vitest.config.ts`, setup in `tests/setup.ts`. 113 tests across 15 files, all passing.
- **E2E:** Playwright in `frontend/tests/responsive.spec.ts`. Requires backend running on :8000 and frontend on :5173. Run `npx playwright test` in `frontend/`. 9 responsive tests.
- **Backend:** pytest + httpx for FastAPI test client. Run `pytest` in `backend/`.
- MSW handlers registered via `server.use()` are NOT consumed after a single match — use a closure variable to track call count for sequential response patterns.
- React 19 + testing-library compatibility: jsdom over happy-dom, `expect.extend(matchers)` pattern for jest-dom, `@testing-library/user-event` for mutation flows that require proper event sequencing.
- Responsive breakpoint: `useIsMobile()` uses `< 768px` (not `<=`). CSS media queries use `max-width: 768px`. One-pixel off-by-one at exactly 768px is acceptable.
- Hamburger button visibility was fixed in M5.1 by changing `display: none` → `display: flex` in App.css (React conditional rendering handles DOM presence; CSS cascade order was overriding media queries).
