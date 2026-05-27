---
name: chore-recurrence-and-ux-improvements
description: Recurrence patterns (daily, weekly, every-N-days), pending stars visual distinction, image chore icons, avatars next to names, hide admin stars
metadata:
  type: design
  date: 2025-05-27
  status: draft
---

# Chore Recurrence & UX Improvements

## Context

Bug #1 (chore visibility with NULL time window) is fixed. This spec covers the remaining 5 items in TODOs.md.

---

## Feature 1: Chore Recurrence Patterns

### Problem

Chores only have a boolean `is_repeating` — they either appear every day or not at all. Parents need to schedule chores on specific days (e.g., "clean room Mon, Wed, Fri") or every N days (e.g., "clean filter every 7 days").

### Design

Replace `is_repeating` (Boolean) with `repeat_pattern` (String enum: `"daily"`, `"weekly"`, `"every_n_days"`). Add two new nullable columns:

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| `repeat_pattern` | `String(20)` | No | `"daily"` |
| `repeat_days` | `JSON` (day names array) | Yes | `NULL` |
| `n_day_interval` | `Integer` | Yes | `NULL` |

Backward migration: existing `is_repeating=True` → `repeat_pattern="daily"`; `False` → leave as `"daily"` with `is_active=False` or migrate to `"daily"` with note.

**Visibility engine (`_is_in_window`):**
- `"daily"` — always visible (same as today's behavior)
- `"weekly"` — check today's weekday against `repeat_days` array; skip if not in list
- `"every_n_days"` — compute days since chore `created_at`; visible when `days_elapsed % n_day_interval == 0`. If a chore is skipped, the schedule drifts — acceptable for a kid chore app. Admin can re-create the chore to reset the cycle.

**Admin UI (`ChoreModal.tsx`):**
- Radio buttons: "daily", "weekly", "every N days"
- Selecting "weekly" reveals a 7-day toggle row (Mon–Sun pill buttons)
- Selecting "every N days" reveals a number input (min 1, max 30)
- Time window pickers still appear when repeating pattern is selected (independent of recurrence pattern)

**Migration:**
1. Add `repeat_pattern`, `repeat_days`, `n_day_interval` columns via Alembic
2. Migrate `is_repeating=True` → `repeat_pattern="daily"`
3. Mark `is_repeating` deprecated; remove after one release cycle

---

## Feature 2: Pending Stars Visual Distinction

### Problem

Kids don't get feedback when they claim a chore — stars only appear after admin approval. The motivation loop is too slow.

### Design

**No schema change.** `PendingClaim` rows already exist. Add a new endpoint `GET /api/dashboard/pending-stars` that returns `{ pending_stars: int, pending_claims: list[ClaimSummary] }` — sums the `points_value` of all pending claims for the current user.

**Frontend:**
- `authStore` gains a `pending_stars` field, populated on mount and updated via WebSocket
- Header greeting shows: `Greeting, Username` + `{pending_stars}☆` + `{current_stars}★`
- `☆` (outlined) for pending, `★` (filled) for confirmed
- When admin approves a claim, the WebSocket `stars_changed` event fires — `pending_stars` decreases, `current_stars` increases
- When admin declines, `pending_stars` decreases with a ledger entry

**WebSocket events:**
- New event: `claim_pending` — fires when a user claims a chore, broadcasts `{ user_id, pending_stars, points_value }` to that user only
- Existing `stars_changed` event — already fires on approval/decline

---

## Feature 3: Image Icons for Chores

### Problem

Chores only support built-in SVG icons. Parents want to upload custom images (e.g., photos of rooms, drawings) as chore icons.

### Design

**Schema:** Add `icon_kind` column to `Chore` model: `"svg"` or `"image"`. `icon_name` stores either the SVG icon name or the image path.

**Admin UI:** In `ChoreModal`, add a toggle: "SVG icon" or "Upload image". If "Upload image", show the same file upload component used in `AvatarPicker`. Reuse `/api/icons/upload-avatar` endpoint or create `/api/admin/upload-chore-icon` with the same logic (crop to square, resize to 256×256, save as WebP).

**Frontend rendering:** Same as avatars — check `icon_kind` and render `<img>` for images, `<img src="/api/icons/svg/{icon_name}">` for SVG icons.

---

## Feature 4: Avatars Next to Names

### Problem

User names appear without avatars in the dashboard header and leaderboard, making it harder to identify users at a glance.

### Design

- `DashboardChores.tsx` header: render the user's avatar next to the greeting using `authStore.user.avatar_kind` + `avatar_value`
- `Leaderboard.tsx`: already has avatars, but verify podium and list items both render them
- `ApprovalsPage.tsx`: already renders avatars, no change needed
- `Header.tsx`: add avatar next to the username in the top bar

---

## Feature 5: Hide Stars for Admins

### Problem

Admins (parents) don't earn stars, but the star count appears next to their name just like for kids.

### Design

Check `user?.role === 'admin'` before rendering:
- `Header.tsx` (line 41): hide `<span className="user-stars">` when role is admin
- `DashboardChores.tsx` (line 70): hide `<div className="stars-display">` when role is admin
- `Leaderboard.tsx`: no change — admins don't appear in the leaderboard (only `role='user'`)
