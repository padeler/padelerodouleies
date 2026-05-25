### CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Status

Pre-implementation. The repo currently contains only product documentation (`README.md`) and a phased implementation plan (`PLAN.md`) — no application source code, no commits, no build tooling exists yet. When asked to implement features, treat `PLAN.md` as the authoritative roadmap and `README.md` as the spec; if either disagrees with code that gets written later, the code wins but flag the drift.

## Stack & Architecture (Planned)

The entire app is intentionally 100% Python via the **Reflex** framework (compiles to a Next.js frontend + ASGI backend from a single Python codebase). Deviations from this — e.g., introducing a separate JS frontend, swapping out Reflex for FastAPI+templates — should be raised with the user before writing code, because the "single Python codebase for long-term self-hosted maintenance" constraint is load-bearing.

- **Framework:** Reflex (Python → Next.js + ASGI)
- **Database:** Embedded SQLite, bind-mounted from container to host RAID at `/mnt/raid/padelerodouleies/data` → `/app/data/` inside the container. Schema is relational (5 tables: `USERS`, `CHORES`, `CHORE_HISTORY`, `REWARDS`, `REWARD_LEDGER` — see README §Database Schema).
- **Deployment:** Single multi-stage `Dockerfile` orchestrated via `docker-compose`. LAN-only (no public exposure planned).
- **Realtime:** Reflex WebSockets push state changes to all connected clients (e.g., leaderboard / star counters update without refresh when an admin approves a chore).

## Core Domain Invariants

These are non-obvious rules that must hold across any feature work:

1. **Two roles only, PIN-gated.** `admin` (parents) vs `user` (kids). Auth is a 4-digit numeric PIN, not username/password. The landing UI is an avatar grid → giant 3×4 keypad → instant verify on the 4th keystroke. No text-entry login flows.
2. **Chore visibility is computed on-the-fly from `datetime.now()`** at dashboard render time, against the chore's `start_time` + `window_hours` and any existing same-day `CHORE_HISTORY` row. There is **no background scheduler / cron** materializing daily chore instances. Do not introduce one without discussion.
3. **Chore scope is either `individual` (per-user instance) or `pooled` (first-come-first-served, disappears once claimed by anyone).** This affects every dashboard query that lists active chores.
4. **The history ledger is append-only and human-visible.** When an admin retroactively declines an approved claim, the system subtracts stars *and* writes a negative-delta row that the child sees in their timeline with the admin's reason text. Never silently mutate a child's balance — every delta must have a corresponding ledger entry.
5. **Bilingual by design.** Default locale is Greek (`el`), secondary is English (`en`). All static UI strings live in a central `translations.py`; admin-created content (chore/reward titles) stores both `*_el` and `*_en` columns with fallback. New user-visible strings must go through the translation layer, not be hardcoded.
6. **Collaborative rewards** pool stars from multiple users toward a shared target with a combined progress bar — distinct from individual rewards which deduct from one balance. The `is_collaborative` flag on `REWARDS` drives different UI and ledger logic.

## Implementation Phases (from PLAN.md)

Work is sequenced as: (1) DB models + i18n scaffold → (2) Fast-Switcher auth + PIN reset → (3) Admin panel (chore/reward CRUD, approvals queue, manual star adjustments, fulfillment queue) → (4) Kid dashboard (dynamic chore cards, claim loop, marketplace, podium) → (5) Dockerfile + compose + LAN testing. When picking up work, locate the current milestone in `PLAN.md` rather than guessing.

## Conventions

- Code comments and documentation: English (per global user instructions).
- Fail explicitly with clear exceptions — no silent fallback logic.
- Prefer functional style and immutability unless Reflex's State class model requires OOP.
- Strict typing with explicit return types.
- Minimal diffs; do not rewrite files for small changes.
