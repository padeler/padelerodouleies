# Playwright Functional Testing - Findings & Fixes

## Fixed Bugs

### 1. ✅ Sidebar links use relative paths (High)
**Files:** `AdminSidebar.tsx`, `KidSidebar.tsx`
**Fix:** Changed all `to={item.path}` from relative (`'chores'`) to absolute (`'/admin/chores'`).

### 2. ✅ "New" button text wrong on rewards/users pages (Medium)
**Files:** `RewardsPage.tsx`, `UsersPage.tsx`
**Fix:** Changed `t('chore.new')` to `t('reward.new')` and `t('user.new')` respectively. Added new translation keys.

### 3. ✅ i18n template literals not interpolated (Medium)
**Files:** `ApprovalsPage.tsx`, `KidHistory.tsx`, `store.ts`
**Fix:**
- ApprovalsPage: replaced dynamic key concatenation `t('chore.' + ...)` with static `t('chore.label')`
- Added `params` interpolation support to `t()` function: `t('key', { name: 'value' })`
- Updated `getActionLabel()` in KidHistory to pass params for `{reason}` and `{title}`

### 4. ✅ Locale toggle not switching language (High)
**File:** `i18n/store.ts`
**Root cause:** `t` was a stable function reference in zustand store, so `useT()` never detected locale changes.
**Fix:** Rewrote `useT()` to subscribe to `locale` and `translations` directly with `useCallback`, so the function reference updates when locale changes.

### 5. ✅ Hardcoded English strings (Medium)
**Files:** `RewardsPage.tsx`, `UsersPage.tsx`, `Header.tsx`, `translations.py`
**Fix:** Replaced hardcoded strings with translation keys. Added 15+ new translation keys to the backend.

## Remaining / Polish Issues

### Sidebar active state on index route
When on `/admin` (index route showing Approvals), the "Εγκρίσεις" link doesn't highlight because NavLink doesn't match. Fix: add `end` prop or use `className={({ isActive }) => isActive || location.pathname === '/admin'`.

### Dimitris balance shows 25 ⭐ in admin users table
The kid dashboard showed 10 ⭐ after reward purchase, but the admin users page showed 20 ⭐ before manual adjust to 25 ⭐. The WebSocket balance update might not invalidate the users query cache. Verify with fresh test.

### Reset PIN uses browser prompt()/alert()
Uses native `prompt()` and `alert()` instead of a modal dialog. Polish item, not a bug.

### Kids dashboard shows "Καθάρισμα δωμάτιου" chore claim then "no chores available"
This is correct behavior — the chore was claimed and removed from the visible list pending admin approval.

### WebSocket connection error on logout
When logging out, the WebSocket connection shows errors in console before the page redirects. Expected behavior but could add cleanup.
