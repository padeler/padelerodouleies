### CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Status

**In production.** The initial build plan is fully delivered (Phases 1–5 — see [Build history](#build-history)) and the app has been live in production on the LAN-only Synology NAS since early June 2026. Two large post-launch features have since **merged to `main` and shipped** in the release line (current tag **v0.9.1**):

- **Age-targeted exercises** (was `feat/exercises-mvp`) — all seven exercise types playable (M1–M5 + M8: `decimal_entry`/`fraction_entry`, admin rescan, Stats surfacing). The dev-machine **generation workflow** under `exercise_lab/` (M6) is a README-driven multi-step process (`exercise_lab/README.md`) used to turn real school material into validator-clean bundles.
- **Learning Adventure** teaching games (was `feat/learn-adventure`) — the shared numbers/letters engine with falling-target action levels (see the Games-tab feature note below).

Ongoing work is incremental — minor features and bug fixes on `main`. **All agentic exercise-generation tooling lives under `exercise_lab/`** — the workflow README + `templates/`, the per-course working notes in `notes/`, the output `bundles/`, and the source textbook PDFs in `exercise_lab/books/` (git-ignored, organized by school year); nothing under `exercise_lab/` ships in the container. Bundle scene images can be generated with the **ComfyUI MCP service** (configured in the repo-root `.mcp.json`) — see `exercise_lab/README.md`.

**Health:** 255 Vitest tests + 271 backend pytest tests all pass; the production build (`npm run build`) and `docker build` both succeed. `mypy --strict` on the backend still reports pre-existing SQLAlchemy `Column[T]` vs `T` errors (not introduced here; the new exercises modules add only the same documented `Column[T]` class).

> `README.md` is the product spec; the exercises bundle format is normatively documented in [docs/EXERCISE_FORMAT.md](docs/EXERCISE_FORMAT.md). Both the original build plan and the exercises-feature plan have shipped and their `PLAN.md` files have been removed. Work from `README.md`, [docs/EXERCISE_FORMAT.md](docs/EXERCISE_FORMAT.md), and this file — and when any doc disagrees with code written later, the code wins, but flag the drift.

## Implementation Notes

The subsections below capture the current state of the build — deployment, schema, shipped features, performance constraints, tooling, versioning, and CI/CD.

### Deployment

- Single container: Node build stage → Python runtime stage that bundles both. The runtime stage also carries `piper-tts` + `ffmpeg` + two Piper voice models (`el_GR`/`en_US`, ~60MB each, downloaded at build) for the card TTS feature.
- FastAPI serves the built SPA via `SPAStaticFiles` (mounted last at `/`, falls back to `index.html` on a 404 caught from Starlette's `HTTPException`); `openapi_url="/api/openapi.json"`.
- `SESSION_SECRET` is required by compose (no default).
- OpenAPI / SPA / health / TZ / DB-creation all verified by running the image and `docker compose up`.

### Build gotcha (tsc)

The production build (`build` script) uses `frontend/tsconfig.build.json`, which **excludes `*.test.*`** so test files aren't type-checked in the build; `tsconfig.app.json` still includes tests so Vitest/esbuild keep the `react-jsx` runtime. Keep this split.

### Schema

- Chore/Reward models use single `title`/`description` fields (removed the `*_el`/`*_en` pairs).
- `Chore.start_time` is nullable.
- `Chore.scope` renamed to `Chore.claim_mode` with values `each`/`one` (replacing old `individual`/`pooled`).
- `User.username` is unique case-insensitive; `User` has a `preferred_theme` column (`system`/`light`/`dark`).
- `HistoryLedger` has an `action_label` column and a nullable `actor_user_id` FK (the admin who approved/declined) — surfaced as a "By" column in the admin activity table via `actor_name`/avatar fields on `/api/admin/history`, populated by the approval-service functions (which now take an `actor_id`). Added as a plain column in migration `d4e6f8a0b2c4` since SQLite `ALTER TABLE` can't add FK constraints.
- **Exercises (migration `f8b0d2c4e6a8`):** `User.birthdate` (nullable `Date`, admin-set, drives age targeting); `EXERCISE_ATTEMPTS` (append-only: one row per submitted answer); `EXERCISE_COMPLETIONS` (unique `(user_id, bundle_id, bundle_version)` for idempotent star award, `history_ledger_id` FK tying the delta to its ledger row). **No bundle table** — bundle metadata lives only on disk; the DB stores only `bundle_id`/`bundle_version` references, so deleting a bundle dir leaves history intact.

### Features

Each entry is a pointer — read the named modules for detail. Cross-cutting rules (old-tablet constraints, TTS carrier trim) are spelled out because they're non-obvious.

- **Theming & backgrounds:** per-user theme (`system`/`light`/`dark`) + accent swatch. `lib/accent.ts` drives the `--accent-*`/`--bg-accent-*` vars; `components/PageBackground.tsx` + `bgVariantForPath` render the per-tab animated glow (GPU-cheap radial gradients, `prefers-reduced-motion` aware). All kid cards are theme-aware (opaque `var(--bg)` surface, needed so flip-card backs stay opaque; status tints layer translucent over it). Catalog line-icons (`img[src*="/api/icons/svg/"]`) are inverted in dark mode via `index.css` (the `src*=` selector spares uploaded photos).
- **Stats:** kid `/dashboard/stats` + admin `/admin/stats` reuse `pages/dashboard/Stats.tsx`, backed by `GET /api/stats` → `app/services/stats.py` (naive-UTC → Athens before bucketing; CSS bar chart, no chart lib). Chore/reward rollups are kids-only; the **game-scores section is a whole-family scoreboard** (`_game_players` includes any parent who has played). Includes a per-kid "📚 Ασκήσεις" exercise row.
- **Chore/reward availability:** non-`available` chores and daily-limited individual rewards emit `available_again_at` (claim-period end from `_period_bounds`); the card renders it via `formatRelativeFromNow`. Claimed chores stay visible with the claimant's name/avatar. Individual rewards are once-per-Athens-day (`app/services/rewards.py`, 409 on repeat).
- **Notifications & sound:** toast + confetti; `lib/sound.ts` synthesizes tones via Web Audio (no asset files), mute persisted in a zustand store (`useSoundStore`).
- **Text-to-speech** (`app/services/tts.py`, `components/SpeakButton.tsx`, `GET /api/tts/...`): Piper (CPU) → ffmpeg → mono MP3, cached by `sha256(voice|text)` under `TTS_DIR`; language auto-picked by script; fails explicit (`TTSUnavailableError` → 503), never a silent empty file. **Non-obvious carrier trim:** the Greek voice garbles a lone letter/word/number synthesized in isolation, so `tts.carrier_phrase` wraps it in a carrier sentence and `app/services/piper_synth.py` trims it back off using phoneme alignments — which requires the Greek `.onnx` **patched to expose its `Ceil` tensor** (`piper.patch_voice_with_alignment`, done in the Dockerfile and `scripts/fetch_voices.sh`). Warmers pre-render every finite spoken string at startup + after rescan: `exercise_tts.py` (bundles), `learn_tts.py` (learn decks/prompts).
- **Games hub** (`pages/dashboard/games/`, both roles, no star payouts): best scores server-backed per user via the `GameScore` table (`app/services/games.py`, `useGameScores.ts`; keys + direction in `GAME_SCORE_DIRECTIONS`). Five games, each a DOM-free unit-tested pure engine + a thin Canvas/DOM view: Memory Match (`memoryDeck.ts`), Simon, Star Catcher (`catcherEngine.ts`), Snake (`snakeEngine.ts`), Whack-a-Mole (`whackEngine.ts`). Reusable table `Pagination`/`usePagination` in `components/Pagination.tsx`.
- **Learning Adventure** (`pages/dashboard/games/learn/`, two Games-hub cards): shared numbers/letters teaching engine, endless & lives-based (tiers × 4 level-type slots). Pure engines `learnEngine.ts` (progression/scoring/streak) + `hearEngine.ts` (falling-targets sim). Backend `app/api/learn.py` (`/api/games/learn`) serves the kid deck (`tts` stripped) + per-token/per-level/feedback audio; decks in `app/services/learn_decks.py` store the **bare spoken word** (the TTS carrier handles lone words — no per-deck wrappers). Client audio `useLearnDeck.ts` is single-channel. **Letter vocab icons** are a per-letter pool authored in `exercise_lab/tools/gen_learn_icons.py` (dev-only) which codegens `frontend/…/learn/letterVocabData.ts` + `app/services/learn_vocab.py` in lock-step (regenerate: `python exercise_lab/tools/gen_learn_icons.py emit`); `generate` mode drives the ComfyUI HTTP API for the PNGs under `frontend/public/learn-icons/`. `letterVocab.ts` holds the selection logic.
- **Exercises** (`/dashboard/exercises`, also `/admin/exercises`): age-targeted offline bundles. **Format is normatively [docs/EXERCISE_FORMAT.md](docs/EXERCISE_FORMAT.md); `app/schemas/exercises.py` is the single source of truth** (discriminated union over seven types, `extra="forbid"`, mono-script-per-string + path-traversal guards, `kid_view` strips `answer`/`*_tts`; CLI `python -m app.schemas.exercises <dir>`). A bundle is a directory (`manifest.json` + `assets/`) under `EXERCISES_DIR`; discovery is scan-on-request/mtime-cached and recurses nested dirs (`app/services/exercise_bundles.py`). `image`/`icon` may be an `assets/` path or a `/api/icons/svg/<name>` URL (no copy). Grading is deterministic server-side (`app/services/exercises.py`): append-only `EXERCISE_ATTEMPTS`, idempotent `EXERCISE_COMPLETIONS` → one `HistoryLedger` row + `stars_changed` broadcast (invariant #4). **Age (from `User.birthdate`) is the sole visibility driver, enforced on every per-bundle endpoint** via `_get_visible_bundle()`. Seven players under `pages/dashboard/exercises/` (`BundlePlayer` switch; `decimal_entry`/`fraction_entry` need `schema_version: 2`; revisit navigation via `frontier` + read-only `RevealedAnswer`). Admin rescan: `POST /api/admin/exercises/rescan`. Generation is dev-only under `exercise_lab/` — **read `exercise_lab/README.md` first**.
- **Misc UI:** keyboard PIN input, lazy icon loading, toggle-based chore form, yellow-star favicon, playful kid login screen.

### Performance (old tablets)

- Background blobs use GPU-cheap `radial-gradient` glows — **not** animated `filter: blur()`, which re-rasterizes every frame and janks on old GPUs. **Do not reintroduce `filter: blur` here.** The float animation runs on a `will-change: transform` promoted layer.
- `AuthGuard` validates the session once on mount (not on every navigation) — re-checking per route fired a redundant `getMe()` and flashed the full-page loading spinner on each tab switch.
- **Emoji glyph coverage:** the old LAN tablets (Samsung Tab 4 / Android 4.4 KitKat) ship an emoji font that only covers **Unicode ≤6.1**; newer emoji render as empty "tofu" boxes. Any emoji rendered as text or via canvas `fillText` must be ≤6.1 (the `memoryDeck.ts` pool and Star Catcher's falling `⭐`/`💩` follow this). **Interface chrome icons use `lucide-react`** (same Lucide family as the backend SVG icon catalog) instead of emoji — inline SVGs that inherit `currentColor`, tree-shaken, and render everywhere: Header settings/logout/mute, Leaderboard podium medals, admin row buttons (edit/toggle/delete, reset-pin), the Landing admin badge, and the Stats champion cards. Star Catcher's basket is likewise a rasterised Lucide `shopping-basket` SVG (`new Image()` from an inline SVG data URL → `drawImage`), keeping the SVG's intrinsic `width`/`height` so old WebKit rasterises it onto the canvas. Prefer a Lucide icon over a new emoji for any UI chrome.

### Dev tooling

- `backend/scripts/seed_dummy.py` seeds ~8 weeks of deterministic (`random.seed(42)`) per-kid activity (distinct profiles so the Stats champions differ) with naive-UTC timestamps and balances recomputed from the ledger.
- Root `dev.sh` launches / tears down both dev servers via per-process-group `setsid`.
- `backend/scripts/fetch_voices.sh` downloads the Piper voice models into `backend/voices/` (git-ignored), where `tts.py` looks by default — no env vars needed for local TTS. Audio in dev also needs `pip install piper-tts` + `ffmpeg`; without them the speaker button returns 503 and the rest of the app is unaffected.
- `backend/scripts/make_sample_bundles.py` regenerates the sample exercise bundles under `samples/exercises/` (17 bundles covering **all seven** exercise types, including two M8 bundles: `dekadikoi-euro-v1` for `decimal_entry` and `klasmata-apla-v1` for `fraction_entry`), drawing the image assets with Pillow and validating each via the M1 loader. `samples/` is **git-ignored** — this script is the tracked source of truth; regenerate locally with `cd backend && python -m scripts.make_sample_bundles`. Copy `samples/exercises/*-v1` into `EXERCISES_DIR` (dev `backend/data/exercises`, prod `/mnt/raid/padelerodouleies/data/exercises`) and set a kid's birthdate to test the tab — see `samples/exercises/README.md`.

### Versioning

We tag releases with semantic-versioning git tags in `X.Y.Z` notation (the UI/`git describe` prefixes them with `v`, e.g. `v1.4.2`):

- **Z (patch)** — bump for bug fixes.
- **Y (minor)** — bump for small features.
- **X (major)** — bump **only when the user explicitly requests it**. Never bump `X` on your own initiative.

When merging a feature to `main`, create and push a new tag following these rules.

### CI/CD

- `.github/workflows/build.yml` is build-only (no test gate): on push to `main` and `v*.*.*` tags it builds the `linux/amd64` image and pushes to `ghcr.io/padeler/padelerodouleies` (tags `latest`/`sha-`/semver) using `GITHUB_TOKEN`.
- The GHCR package must be made Public once (manual, repo → Packages) so the LAN-only Synology NAS can pull without credentials.
- Production deploy is manual: `docker-compose.prod.yml` pulls the GHCR image via `IMAGE_TAG` (default `latest`) instead of building; pull + restart from Synology Container Manager (see README "CI/CD" section). An **optional host-side auto-updater** (`auto-update.sh` + a Synology `/etc/crontab` entry — the DS220+ has no `crontab` util — documented in [AUTO_UPDATE.md](AUTO_UPDATE.md)) pulls `:latest` and recreates the container only when the image digest moves; no Watchtower / Docker socket in a container.
- The login screen shows a build version: Vite injects `__APP_VERSION__` from the `APP_VERSION` env (CI sets it from `git describe --tags`, so it reflects the nearest git tag like `v0.1.0`; falls back to `package.json` version locally). `git describe` tags already start with `v`, so the UI does not add its own prefix; `vitest.config.ts` mirrors the `define` so tests don't hit a `ReferenceError`.

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
2. **Chore visibility is computed on-the-fly from `datetime.now()`** at dashboard render time, against the chore's `start_time` + `window_hours` and any existing claim/`CHORE_HISTORY` row within the chore's **claim period**. The claim period is a single day for daily / n-day chores but the whole Monday-to-Monday ISO week for **weekly** chores (any chore with `repeat_days` set) — so a weekly chore claimed once stays "done" for the rest of that week (per-kid for `claim_mode=each`, once total for `claim_mode=one`) and only reappears the following week. See `_period_bounds` in `app/services/chores.py`. There is **no background scheduler / cron** materializing daily chore instances. Do not introduce one without discussion.
3. **Chore `claim_mode` is either `each` (every kid claims independently) or `one` (first kid to claim it takes it for the period).** Claimed chores always remain visible in the dashboard — `each` shows each kid's own status; `one` shows the claimant's name and avatar to other kids. The `/api/dashboard/visible-chores` response always includes all in-window chores with `status` (`available`/`pending`/`approved`) and `claimed_by` (null or `{user_id, name, avatar_kind, avatar_value}`).
4. **The history ledger is append-only and human-visible.** When an admin retroactively declines an approved claim, the system subtracts stars *and* writes a negative-delta row that the child sees in their timeline with the admin's reason text. Never silently mutate a child's balance — every delta must have a corresponding ledger entry.
5. **Bilingual by design, single-title content.** Default locale is Greek (`el`), secondary is English (`en`). All static UI strings live in a central `translations.py`. Admin-created content (chore/reward titles) uses a single `title`/`description` field — the admin types in whatever language they prefer, no bilingual columns. New user-visible strings must go through the translation layer, not be hardcoded.
6. **Collaborative rewards** pool stars from multiple users toward a shared target with a combined progress bar — distinct from individual rewards which deduct from one balance. The `is_collaborative` flag on `REWARDS` drives different UI and ledger logic.
7. **Theme system** is user-controlled per account. `User.preferred_theme` stores `system`/`light`/`dark`. The frontend `ThemeWatcher` in `main.tsx` applies `data-theme` to `<html>`. CSS uses both `@media (prefers-color-scheme: dark)` (browser default) and `html[data-theme="dark"]` (user choice). When testing, the theme attribute takes visual precedence over media queries.
8. **User deletion is a soft delete** (`User.is_active = False`, never a row delete) and is guarded: users cannot delete themselves, and the last active admin cannot be deleted. Backend raises 400; frontend hides the delete button for the current session user. Deleted (inactive) kids are excluded from the Stats tab and their stars from cumulative totals — `compute_stats` filters `User.is_active == True`.
9. **WebSocket** accept is only called once in `main.py`; `broadcaster.connect()` does NOT call `accept()` again.

## Build history

The initial build shipped in five phases: (1) DB models + i18n scaffold → (2) Fast-Switcher auth + PIN reset → (3) Admin panel (chore/reward CRUD, approvals queue, manual star adjustments, fulfillment queue) → (4) Kid dashboard (dynamic chore cards, claim loop, marketplace, podium) → (5) Dockerfile + compose + LAN testing. All five are complete and the app is in production. The `PLAN.md` files that sequenced both this work and the later exercises feature have been removed now that they are delivered.

## Conventions

- Code comments and documentation: English (per global user instructions).
- Fail explicitly with clear exceptions — no silent fallback logic.
- Prefer functional style and immutability. SQLAlchemy ORM classes and Pydantic models are the natural exception on the backend; React function components with hooks are the default on the frontend (no class components).
- Strict typing with explicit return types: Python type hints + `mypy --strict` on the backend; TypeScript `strict: true` on the frontend.
- Minimal diffs; do not rewrite files for small changes.

## Testing

- **Frontend:** Vitest (v3.2.4) + jsdom + React Testing Library + MSW. Run `npm test` in `frontend/`. Tests live in `src/**/*.test.{ts,tsx}`. Test config in `vitest.config.ts`, setup in `tests/setup.ts`. 255 tests across 30 files, all passing.
- **E2E:** Playwright in `frontend/tests/responsive.spec.ts`. Requires backend running on :8000 and frontend on :5173. Run `npx playwright test` in `frontend/`. 9 responsive tests.
- **Backend:** pytest + httpx for FastAPI test client. Run `pytest` in `backend/`. 271 tests, all passing (incl. `test_exercises.py` covering the validator, discovery, age filtering, grading — all seven types, incl. M8 decimal/fraction equivalence — idempotent completion, and the admin-only rescan endpoint; `test_exercise_tts.py` covers the TTS cache-warming service; `test_stats.py` covers the per-kid exercise rollup). Tests use the file database with an autouse fixture that deletes all rows after each test.
- MSW handlers registered via `server.use()` are NOT consumed after a single match — use a closure variable to track call count for sequential response patterns.
- React 19 + testing-library compatibility: jsdom over happy-dom, `expect.extend(matchers)` pattern for jest-dom, `@testing-library/user-event` for mutation flows that require proper event sequencing.
- Responsive breakpoint: `useIsMobile()` uses `< 768px` (not `<=`). CSS media queries use `max-width: 768px`. One-pixel off-by-one at exactly 768px is acceptable.
- Hamburger button visibility was fixed in M5.1 by changing `display: none` → `display: flex` in App.css (React conditional rendering handles DOM presence; CSS cascade order was overriding media queries).
