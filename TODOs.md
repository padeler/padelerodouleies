# TODOs

# Security review — hardening before internet exposure

> **Status (2026-07-24):** the `feat/security-hardening` work (C1–C3 app side,
> H2–H5, backend part of M1) is merged to `main`. The remaining items below —
> **H1** (roster leak), the C2 product decisions (longer admin credentials,
> CAPTCHA), the C3 ops work (TLS reverse proxy), the frontend half of M1, and
> **M2–M4 / L1–L2** — are deliberately deferred to a later stage. Do not expose
> the app publicly until at least H1 and the TLS proxy are addressed.

The app was built for a LAN-only Synology NAS where "anyone on the network is
family" was an acceptable trust boundary. Exposing it on a public URL removes
that boundary: the login screen, the full user roster, and the PIN brute-force
surface all become reachable by anyone on the internet. The items below are
ordered by severity. Each has a concrete suggested fix.

Files referenced use repo-relative paths.

---

## CRITICAL

### C1. Weak/forgeable session secret via silent dev fallback  ✅ DONE (`feat/security-hardening`)
- **Implemented:** `backend/app/config.py:session_secret()` fails startup when
  `SESSION_SECRET` is unset or equals the dev default and `APP_ENV=production`;
  `session.py` resolves the key through it. `docker-compose.prod.yml` sets
  `APP_ENV=production`. Dev keeps the fallback. Tests in `test_hardening.py`.

- **Where:** `backend/app/security/session.py:16`
  `SECRET_KEY = os.getenv("SESSION_SECRET", "padelerodouleies-dev-secret")`
- **Problem:** Session cookies are stateless, signed with `itsdangerous`. If
  `SESSION_SECRET` is ever unset, the code silently falls back to a **public,
  hardcoded string**. Anyone who reads this repo can forge a valid session
  cookie for `uid=1` (typically the first admin) and get full admin access — no
  PIN needed. `docker-compose*.yml` requires the env var, but the application
  code must not depend on compose to be safe; a manual `docker run`, a test
  harness, or a future deploy path can bypass it. This violates the project's
  own "no silent fallback" rule.
- **Fix:** Fail explicitly at startup when `SESSION_SECRET` is missing/empty in
  production. E.g. read the env var once at import; if it is unset or equals the
  dev default and an `APP_ENV=production` flag is set, raise `RuntimeError`.
  Keep a dev fallback only when explicitly in dev mode. Generate the production
  secret with `python -c "import secrets;print(secrets.token_urlsafe(64))"` and
  keep it out of the image/git.

### C2. 4-digit PINs are trivially brute-forceable over the internet  ✅ PARTIAL (`feat/security-hardening`)
- **Implemented:** (1) In-process per-IP rate limiting
  (`backend/app/security/ratelimit.py`) on `/api/auth/login` (20/min/IP) and
  `/api/bootstrap/setup` (5/min/IP); (2) **escalating** lockout
  (`lockout.py`: ×4 backoff per failure past the threshold, capped at 1h).
  Tests in `test_hardening.py`.
- **Still open (product decisions, not done here):** longer/stronger admin
  credentials (6+ digit PIN or password), and CAPTCHA after N failures. Left
  out because they change the login UX (invariant #1) — raise before building.

- **Where:** login flow `backend/app/api/auth.py:45`, lockout policy
  `backend/app/security/lockout.py:7-8` (`MAX_ATTEMPTS = 5`,
  `LOCKOUT_SECONDS = 60`).
- **Problem:** The entire credential space is **10,000 combinations** (0000–9999).
  Login is by numeric `user_id` (enumerable, and leaked outright — see H1), so
  an attacker targets a specific account directly. The only throttle is a
  per-user lockout that clears itself after **60 seconds**: 5 tries/minute ≈
  300/hour, and the lockout auto-expires with no escalation. Worse, an attacker
  can rotate across all `user_id`s in parallel — there is **no global or
  per-IP rate limit** — so the effective guess rate is 5 × (number of users)
  per minute. A single admin PIN is realistically crackable in hours to a day.
- **Fix (layered):**
  1. Add **IP-based rate limiting** on `/api/auth/login` and
     `/api/bootstrap/*` (e.g. `slowapi`: a few requests/minute/IP, plus a
     stricter per-(IP,user) bucket). This is the single highest-value change.
  2. Make lockout **escalate** (exponential backoff: 1 min → 5 → 30 → hours)
     and persist across the window instead of a flat 60s that resets.
  3. Consider allowing **longer PINs** (6+ digits) for admin accounts, or a
     real password for admins while keeping short PINs for kids.
  4. Add a delay/CAPTCHA after N failures. Even a fixed ~500ms artificial delay
     per attempt hugely raises brute-force cost.

### C3. No HTTPS enforcement — PINs and session cookies sent in cleartext  ✅ PARTIAL (`feat/security-hardening`)
- **Implemented (app side):** `Secure` cookie flag via `config.cookie_secure()`
  (on in production); HSTS header via `config.hsts_enabled()` emitted by the
  `main.py` security-headers middleware.
- **Still required (ops, cannot be code):** stand up a **TLS reverse proxy**
  (Caddy/nginx/Traefik + Let's Encrypt) in front of the container, do **not**
  publish `:8000` publicly, and redirect HTTP→HTTPS at the proxy. The app flags
  above are inert until TLS actually terminates in front.

- **Where:** app serves plain HTTP on `0.0.0.0:8000` (`Dockerfile:101`,
  compose `ports: 8000:8000`); cookie set without `secure` in
  `backend/app/security/session.py:33-42`.
- **Problem:** On a LAN this was tolerable. On the internet, without TLS the
  4-digit PIN and the session cookie traverse the network in plaintext and are
  trivially sniffable / MITM-able. The session cookie also lacks the `secure`
  flag, so even with TLS in front it could leak over an accidental HTTP request.
- **Fix:**
  1. Terminate TLS in a reverse proxy in front of the container (Caddy/nginx/
     Traefik with Let's Encrypt), and never expose `:8000` publicly.
  2. Add `secure=True` to `response.set_cookie(...)` (gate on an env flag so
     local HTTP dev still works).
  3. Add **HSTS** (`Strict-Transport-Security`) at the proxy or via middleware.
  4. Redirect HTTP→HTTPS at the proxy.

---

## HIGH

### H1. Full user roster (including which accounts are admins) is public
- **Where:** `backend/app/api/auth.py:95` — `GET /api/auth/users` has **no auth
  dependency** and returns every active user's `id`, `name`, `avatar`, and
  `role`.
- **Problem:** Anyone can enumerate all accounts, learn the exact `user_id` to
  target, and see **which are `admin`** — turning C2 from "brute-force a random
  account" into "brute-force the known admin id." This endpoint exists to render
  the landing avatar grid, which is fine on a LAN but is a roster leak on the
  internet.
- **Fix (pick per threat model):**
  - Minimum: **omit `role`** from the public payload so admins aren't flagged.
  - Better: require the client to prove it's on an allowed network / behind an
    auth wall before listing users, or move to a **username+PIN typed login**
    (no avatar grid) so the roster is never enumerable. The domain currently
    assumes "pick your avatar" (invariant #1) — revisit that assumption for
    public exposure.

### H2. Unbounded zip upload → memory/disk DoS (decompression bomb)  ✅ DONE (`feat/security-hardening`)
- **Implemented:** raw body cap (50MB, streamed) in
  `admin.py:upload_exercise_bundles`; member-count (2000) + total-uncompressed
  (200MB) caps in `extract_bundles_zip`, enforced both on the zip header and on
  bytes actually written (spoofed `file_size` guarded). Zip-slip check retained.
  Tests in `test_hardening.py`.

- **Where:** `backend/app/api/admin.py:759` (`upload_exercise_bundles`) does
  `data = await file.read()` (whole upload into RAM, **no size cap**), then
  `extract_bundles_zip` (`backend/app/services/exercise_bundles.py:283`) writes
  every member with **no limit on uncompressed size or file count**.
- **Problem:** Zip-slip is correctly guarded, but a **zip bomb** (a few KB that
  expands to gigabytes) or a huge upload will exhaust RAM/disk and take the
  single-worker container down. Admin-gated, but admin creds are the very thing
  C2 threatens, and DoS-via-admin is still a concern once exposed.
- **Fix:** Cap the raw request body (reject > a few MB before reading fully —
  stream and count bytes, like `_read_file_safe` in `avatars.py`). In
  `extract_bundles_zip`, enforce a **total-uncompressed-size budget** and a
  **max member count**, checking `info.file_size` cumulatively and aborting
  before writing. Reject archives whose ratio looks like a bomb.

### H3. Admin-uploaded SVGs are stored and served unsanitized → stored XSS  ✅ DONE (`feat/security-hardening`)
- **Implemented:** `avatars._reject_dangerous_svg` rejects (fail-explicit) any
  uploaded SVG containing `<script>`, event handlers, `<foreignObject>`,
  `javascript:`, or entity/doctype declarations. Defense-in-depth: user-content
  paths (`/avatars/`, `/chore-images/`, `/api/icons/svg/`) are served with a
  locked-down `default-src 'none'; sandbox` CSP + `nosniff` by the `main.py`
  middleware, so a hostile SVG opened directly can't execute. Tests in
  `test_hardening.py`.

- **Where:** `backend/app/services/avatars.py:98-100` writes SVG bytes verbatim;
  served as `image/svg+xml` from the `/chore-images` mount and by
  `backend/app/api/icons.py:31` (`GET /api/icons/svg/{name}`).
- **Problem:** SVG files can embed `<script>`. If such an SVG is opened directly
  (or ever inlined into the DOM), the script runs **same-origin**, able to read
  the session cookie's effects and call the API as the victim. Upload is
  admin-only, but combined with C2 this is a privilege-persistence vector, and
  any XSS on this origin is high impact.
- **Fix:** Sanitize uploaded SVGs server-side (strip `<script>`, event handlers,
  external refs) — or disallow SVG uploads for chore images entirely and
  rasterize to WebP like photos. Serve user-uploaded files with
  `Content-Security-Policy: default-src 'none'` and
  `Content-Disposition: attachment`, and consider serving uploads from a
  separate origin. Add `X-Content-Type-Options: nosniff` globally (see H5).

### H4. OpenAPI schema is publicly exposed  ✅ DONE (`feat/security-hardening`)
- **Implemented:** `main.py` sets `openapi_url=None` when
  `config.expose_openapi()` is false (the default in production; overridable via
  `EXPOSE_OPENAPI=1`). Swagger/ReDoc UIs remain off in all environments.

- **Where:** `backend/app/main.py:41` — `openapi_url="/api/openapi.json"` is
  reachable without auth (Swagger/ReDoc UIs are disabled, but the raw schema is
  not).
- **Problem:** Hands an attacker the complete API map — every route, parameter,
  and shape — lowering the cost of finding the weak endpoints above.
- **Fix:** Set `openapi_url=None` in production (gate on env), or protect it
  behind admin auth. Not a vuln by itself, but free reconnaissance you don't
  need to give away.

### H5. No security headers (CSP, X-Frame-Options, nosniff, Referrer-Policy)  ✅ DONE (`feat/security-hardening`)
- **Implemented:** `main.py` `security_headers` middleware emits `CSP`
  (SPA policy: `script-src 'self'`, `style-src 'self' 'unsafe-inline'`,
  `frame-ancestors 'none'`, same-origin `connect-src` for WebSocket),
  `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`,
  `Referrer-Policy: no-referrer`, and HSTS in production. Tests in
  `test_hardening.py`.

- **Where:** `backend/app/main.py` — no headers middleware anywhere.
- **Problem:** No `Content-Security-Policy` (limits blast radius of any XSS, incl.
  H3), no `X-Frame-Options`/`frame-ancestors` (clickjacking), no
  `X-Content-Type-Options: nosniff` (MIME sniffing), no `Referrer-Policy`.
- **Fix:** Add a small middleware (or set at the reverse proxy) emitting at
  least: `Content-Security-Policy` (start report-only, tighten to
  `default-src 'self'`), `X-Frame-Options: DENY`,
  `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`,
  and HSTS (see C3).

---

## MEDIUM

### M1. Sensitive auth details printed to stdout logs
- **Where:** `backend/app/security/session.py:53,63` print session presence and
  the authenticated **user id + name on every request**;
  `backend/app/api/bootstrap.py:57` prints on setup;
  `frontend/src/api/client.ts:4,13` logs every API call to the browser console.
- **Problem:** Container logs (and browser consoles) leak per-request identity
  and add noise; anyone with log access reconstructs who did what. Not a
  breach, but poor hygiene for a public service and easy to fix.
- **Fix:** Remove the `print(...)` calls or downgrade to `logger.debug(...)`
  behind a debug flag; drop the `console.log` API tracing from the production
  frontend build.
- **Partially done (`feat/security-hardening`):** the backend auth prints in
  `session.py` and `bootstrap.py` were removed. The frontend `console.log` API
  tracing in `client.ts` is still open.

### M2. Stateless sessions cannot be revoked; 24h lifetime
- **Where:** `backend/app/security/session.py` (itsdangerous timed token,
  `SESSION_MAX_AGE = 86400`).
- **Problem:** A PIN reset or a suspected compromise **cannot invalidate
  existing sessions** — a stolen cookie stays valid for up to 24h, and the only
  global revocation is rotating `SESSION_SECRET` (which logs everyone out).
- **Fix:** For a public deployment, consider server-side session records (a
  `sessions` table or a signed token carrying a per-user `token_version` that
  PIN-reset increments), so individual sessions can be revoked. At minimum,
  bump `token_version` on PIN change/reset and reject older tokens.

### M3. `avatar_value` accepts arbitrary strings (no validation)
- **Where:** `backend/app/api/auth.py:199` (`update_my_avatar`) and admin user
  update — `avatar_value` is stored as-is for `kind in {icon,image}`.
- **Problem:** A user can set `avatar_value` to an arbitrary string / external
  URL that the frontend renders in an `<img src>`, enabling off-site content
  loading (privacy/tracking) or content injection depending on how it's
  rendered. Low severity but unvalidated user input reaching the DOM.
- **Fix:** Validate `avatar_value`: for `image`, require it to match an
  uploaded `/avatars/<uuid>.webp` path; for `icon`, require it to be a known
  catalog name. Reject anything else (fail explicit).

### M4. Bootstrap admin-creation is reachable whenever the DB is empty
- **Where:** `backend/app/api/bootstrap.py:22` — `/api/bootstrap/setup` creates
  the first **admin**, guarded only by `is_first_run()` (DB has no users).
- **Problem:** If the data volume is ever wiped/mismounted on a public host, the
  first internet visitor to hit this endpoint claims admin. On a LAN this was a
  non-issue.
- **Fix:** Gate first-run setup behind a one-time out-of-band secret
  (env-provided setup token required in the request), or require it to be
  performed from an allowlisted admin network, so an empty DB can't be silently
  hijacked.

---

## LOW / DEFENSE-IN-DEPTH

### L1. Login response distinguishes "no such user" vs "wrong PIN" vs "locked"
- **Where:** `backend/app/api/auth.py:47-68` returns 401 "Invalid credentials"
  (unknown user), 401 "Invalid PIN" (known user), 423 (locked) — a user-
  enumeration oracle. Largely moot today because H1 already leaks the roster,
  but fix it alongside H1.
- **Fix:** Return a single generic 401 for all bad-credential cases; keep 423
  only after auth succeeds-but-locked, or fold lockout into the generic
  response timing.

### L2. Single Uvicorn worker = easy resource exhaustion
- **Where:** `Dockerfile:101` (`--workers 1`, required by the in-process WS
  broadcaster).
- **Problem:** One synchronous slow request (e.g. large upload, TTS synth) or a
  flood can starve all users. Acceptable for a family LAN; a consideration under
  public load.
- **Fix:** Front with the reverse proxy's rate/connection limits and timeouts;
  offload TTS/zip work off the request path if load becomes real. Don't add
  workers without solving the shared-broadcaster constraint first.

---

## Suggested implementation order
1. **C3 + C1** — stand up TLS reverse proxy, set `secure` cookie + HSTS, and
   make `SESSION_SECRET` fail-explicit. (No app safety without these.)
2. **C2 + H1** — add IP rate limiting + escalating lockout, and stop leaking the
   admin roster. (Closes the primary break-in path.)
3. **H2, H3, H4, H5** — upload hardening, SVG sanitization, hide OpenAPI,
   security headers.
4. **M1–M4, L1–L2** — hygiene and defense-in-depth.
