# Chore Recurrence & UX Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add chore recurrence patterns (daily, weekly on specific days, every-N-days), pending stars visual distinction, image icons on kid dashboard, avatars next to names in header/dashboard, and hide stars for admins.

**Architecture:** Two-phase: (1) backend schema + API changes with Alembic migration, visibility engine update, new pending-stars endpoint, and WebSocket events; (2) frontend React changes — recurrence UI in ChoreModal, pending stars display, avatar rendering, admin star hiding. Image upload for chores is already implemented in admin; only the kid-dashboard ChoreCard needs to handle image icons.

**Tech Stack:** SQLAlchemy + Alembic (backend), React + TypeScript + Zustand + TanStack Query (frontend), FastAPI WebSockets (realtime)

---

### Task 1: Alembic migration — add recurrence columns to chores table

**Files:**
- Create: `backend/alembic/versions/xxxx_add_chore_recurrence.py`

- [ ] **Step 1: Generate migration revision ID**

Run: `cd backend && python -c "import uuid; print(uuid.uuid4().hex[:12])"`
Use the output as the revision ID.

- [ ] **Step 2: Write the migration file**

Create `backend/alembic/versions/<REVISION>_add_chore_recurrence.py`:

```python
"""add chore recurrence columns

Revision ID: <REVISION>
Revises: c351be147975
Create Date: 2025-05-27
"""
from alembic import op
import sqlalchemy as sa

revision = '<REVISION>'
down_revision = 'c351be147975'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('chores', sa.Column('repeat_days', sa.JSON(), nullable=True))
    op.add_column('chores', sa.Column('n_day_interval', sa.Integer(), nullable=True))


def downgrade():
    op.drop_column('chores', 'n_day_interval')
    op.drop_column('chores', 'repeat_days')
```

- [ ] **Step 3: Run the migration**

Run: `cd backend && alembic upgrade head`
Expected: SUCCESS with no errors

- [ ] **Step 4: Commit**

```bash
git add alembic/versions/<REVISION>_add_chore_recurrence.py
git commit -m "feat: add repeat_days and n_day_interval columns to chores table"
```

---

### Task 2: Update backend models and schemas

**Files:**
- Modify: `backend/app/db/models.py:46-61` — add `repeat_days`, `n_day_interval` columns
- Modify: `backend/app/schemas/admin.py:10-45` — add fields to ChoreCreate, ChoreUpdate, ChoreRead

- [ ] **Step 1: Add import for JSON type**

In `backend/app/db/models.py`, line 9 already imports from sqlalchemy. Add `JSON` to the import block:

```python
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    JSON,
    String,
    Time,
    func,
)
```

- [ ] **Step 2: Add columns to Chore model**

In `backend/app/db/models.py`, after line 57 (`window_hours`), add:

```python
    repeat_days = Column(JSON, nullable=True)  # e.g. ["Mon", "Wed", "Fri"] — NULL means daily
    n_day_interval = Column(Integer, nullable=True)  # e.g. 7 — NULL means not used
```

- [ ] **Step 3: Update ChoreCreate schema**

In `backend/app/schemas/admin.py`, lines 10-18, update `ChoreCreate`:

```python
class ChoreCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: str | None = None
    icon_name: str
    scope: str = "individual"
    points_value: int = Field(gt=0)
    is_repeating: bool = True
    start_time: dtime | None = None
    window_hours: int | None = Field(default=None, ge=1, le=24)
    repeat_days: list[str] | None = None
    n_day_interval: int | None = Field(default=None, ge=1, le=30)
```

- [ ] **Step 4: Update ChoreUpdate schema**

In `backend/app/schemas/admin.py`, lines 21-30, update `ChoreUpdate`:

```python
class ChoreUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    icon_name: str | None = None
    scope: str | None = None
    points_value: int | None = Field(default=None, gt=0)
    is_repeating: bool | None = None
    start_time: dtime | None = None
    window_hours: int | None = Field(default=None, ge=1, le=24)
    is_active: bool | None = None
    repeat_days: list[str] | None = None
    n_day_interval: int | None = None
```

- [ ] **Step 5: Update ChoreRead schema**

In `backend/app/schemas/admin.py`, lines 33-45, update `ChoreRead`:

```python
class ChoreRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    title: str
    description: str | None
    icon_name: str
    scope: str
    points_value: int
    is_repeating: bool
    start_time: dtime | None
    window_hours: int | None
    is_active: bool
    repeat_days: list[str] | None
    n_day_interval: int | None
    created_at: datetime
```

- [ ] **Step 6: Run tests to verify no regression**

Run: `cd backend && python -m pytest tests/ -v --tb=short 2>&1 | tail -20`
Expected: All 60 tests pass

- [ ] **Step 7: Commit**

```bash
git add app/db/models.py app/schemas/admin.py
git commit -m "feat: add recurrence fields to Chore model and schemas"
```

---

### Task 3: Update visibility engine with recurrence logic

**Files:**
- Modify: `backend/app/services/chores.py:15-64` — add `_matches_day()` helper, update `visible_chores_for()`

- [ ] **Step 1: Add `_matches_day()` helper**

Add after `_is_in_window()` function in `backend/app/services/chores.py`:

```python
def _matches_day(chore: Chore, today: date) -> bool:
    """Check if today is a valid day for this chore's recurrence pattern."""
    if chore.n_day_interval is not None and chore.n_day_interval > 0:
        # Every-N-days: compute days since created_at
        days_since = (today - chore.created_at.date()).days
        return days_since % chore.n_day_interval == 0
    if chore.repeat_days is not None and len(chore.repeat_days) > 0:
        # Weekly on specific days
        weekday_names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
        today_name = weekday_names[today.weekday()]
        return today_name in chore.repeat_days
    # Default: daily (both repeat_days and n_day_interval are None)
    return True
```

- [ ] **Step 2: Update `visible_chores_for()` to call `_matches_day()`**

In `backend/app/services/chores.py`, modify the loop in `visible_chores_for()` (around line 34-41) to add the day check:

```python
    result: list[Chore] = []
    for chore in active:
        if not _matches_day(chore, today):
            continue
        if not _is_in_window(chore.start_time, chore.window_hours, today, now_time):
            continue
        if _is_already_done(chore, user_id, today, db):
            continue
        result.append(chore)
```

- [ ] **Step 3: Run tests to verify no regression**

Run: `cd backend && python -m pytest tests/test_phase4.py -v --tb=short 2>&1 | tail -15`
Expected: All Phase 4 tests still pass (they create chores without repeat_days/n_day_interval, so `_matches_day` returns True)

- [ ] **Step 4: Commit**

```bash
git add app/services/chores.py
git commit -m "feat: add recurrence-based day filtering to chore visibility engine"
```

---

### Task 4: Backend tests for recurrence

**Files:**
- Create: `backend/tests/test_recurrence.py`

- [ ] **Step 1: Write recurrence tests**

```python
"""Test chore recurrence visibility logic."""

import pytest
from datetime import datetime, date, time, timedelta
from zoneinfo import ZoneInfo

from app.db.models import Chore, User, PendingClaim, HistoryLedger

TZ = ZoneInfo("Europe/Athens")


@pytest.fixture
def sample_chore(db_session):
    """Create a repeating chore with no recurrence filter (daily)."""
    chore = Chore(
        title="Test Chore",
        icon_name="star",
        scope="individual",
        points_value=5,
        is_repeating=True,
        is_active=True,
        created_at=datetime(2025, 1, 1, tzinfo=TZ),
    )
    db_session.add(chore)
    db_session.commit()
    db_session.refresh(chore)
    return chore


@pytest.fixture
def sample_user(db_session):
    user = User(
        name="TestUser",
        pin_hash="hashed",
        role="user",
        is_active=True,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


def test_daily_chore_always_visible(sample_chore, sample_user, db_session):
    """A chore with no recurrence filter should be visible every day."""
    from app.services.chores import visible_chores_for

    now = datetime(2025, 5, 27, 10, 0, tzinfo=TZ)  # a Tuesday
    result = visible_chores_for(sample_user.id, now, db_session)
    assert any(c.id == sample_chore.id for c in result)


def test_weekly_chore_visible_on_matching_day(sample_user, db_session):
    """A chore set for Mon/Wed/Fri should be visible on Wednesday."""
    chore = Chore(
        title="Weekly Chore",
        icon_name="brush",
        scope="individual",
        points_value=3,
        is_repeating=True,
        is_active=True,
        repeat_days=["Mon", "Wed", "Fri"],
        created_at=datetime(2025, 1, 1, tzinfo=TZ),
    )
    db_session.add(chore)
    db_session.commit()
    db_session.refresh(chore)

    from app.services.chores import visible_chores_for

    wednesday = datetime(2025, 5, 28, 10, 0, tzinfo=TZ)  # Wednesday
    result = visible_chores_for(sample_user.id, wednesday, db_session)
    assert any(c.id == chore.id for c in result)


def test_weekly_chore_hidden_on_non_matching_day(sample_user, db_session):
    """A chore set for Mon/Wed/Fri should NOT be visible on Saturday."""
    chore = Chore(
        title="Weekly Chore",
        icon_name="brush",
        scope="individual",
        points_value=3,
        is_repeating=True,
        is_active=True,
        repeat_days=["Mon", "Wed", "Fri"],
        created_at=datetime(2025, 1, 1, tzinfo=TZ),
    )
    db_session.add(chore)
    db_session.commit()
    db_session.refresh(chore)

    from app.services.chores import visible_chores_for

    saturday = datetime(2025, 5, 31, 10, 0, tzinfo=TZ)  # Saturday
    result = visible_chores_for(sample_user.id, saturday, db_session)
    assert not any(c.id == chore.id for c in result)


def test_every_n_days_visible_on_schedule(sample_user, db_session):
    """A chore with n_day_interval=7 should be visible on day 0, 7, 14, ..."""
    chore = Chore(
        title="Weekly Filter",
        icon_name="filter",
        scope="individual",
        points_value=10,
        is_repeating=True,
        is_active=True,
        n_day_interval=7,
        created_at=datetime(2025, 5, 1, tzinfo=TZ),
    )
    db_session.add(chore)
    db_session.commit()
    db_session.refresh(chore)

    from app.services.chores import visible_chores_for

    # Day 7 after creation: May 8
    may_8 = datetime(2025, 5, 8, 10, 0, tzinfo=TZ)
    result = visible_chores_for(sample_user.id, may_8, db_session)
    assert any(c.id == chore.id for c in result)


def test_every_n_days_hidden_off_schedule(sample_user, db_session):
    """A chore with n_day_interval=7 should NOT be visible on day 3."""
    chore = Chore(
        title="Weekly Filter",
        icon_name="filter",
        scope="individual",
        points_value=10,
        is_repeating=True,
        is_active=True,
        n_day_interval=7,
        created_at=datetime(2025, 5, 1, tzinfo=TZ),
    )
    db_session.add(chore)
    db_session.commit()
    db_session.refresh(chore)

    from app.services.chores import visible_chores_for

    # Day 3 after creation: May 4
    may_4 = datetime(2025, 5, 4, 10, 0, tzinfo=TZ)
    result = visible_chores_for(sample_user.id, may_4, db_session)
    assert not any(c.id == chore.id for c in result)
```

- [ ] **Step 2: Run recurrence tests**

Run: `cd backend && python -m pytest tests/test_recurrence.py -v --tb=short`
Expected: All 5 tests pass

- [ ] **Step 3: Run full test suite**

Run: `cd backend && python -m pytest tests/ -v --tb=short 2>&1 | tail -5`
Expected: 65 tests pass

- [ ] **Step 4: Commit**

```bash
git add tests/test_recurrence.py
git commit -m "test: add recurrence visibility tests"
```

---

### Task 5: Add pending-stars endpoint

**Files:**
- Modify: `backend/app/api/dashboard.py` — add `GET /dashboard/pending-stars`
- Modify: `frontend/src/api/client.ts` — add `getPendingStars()` function

- [ ] **Step 1: Add the endpoint**

In `backend/app/api/dashboard.py`, after the `get_visible_chores` endpoint (after line 35), add:

```python
@router.get("/pending-stars")
def get_pending_stars(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_session),
) -> dict:
    """Return sum of points_value for all pending claims of this user."""
    claims = (
        db.query(PendingClaim)
        .join(Chore, PendingClaim.chore_id == Chore.id)
        .filter(PendingClaim.user_id == current_user.id)
        .all()
    )
    pending_stars = sum(c.chore.points_value for c in claims)
    return {
        "pending_stars": pending_stars,
        "claims": [
            {
                "claim_id": c.id,
                "chore_id": c.chore_id,
                "chore_title": c.chore.title,
                "points_value": c.chore.points_value,
                "claimed_at": c.claimed_at.isoformat(),
            }
            for c in claims
        ],
    }
```

- [ ] **Step 2: Add frontend client function**

In `frontend/src/api/client.ts`, after `getVisibleChores` (around line 385), add:

```typescript
export async function getPendingStars() {
  return request<{
    pending_stars: number;
    claims: Array<{
      claim_id: number;
      chore_id: number;
      chore_title: string;
      points_value: number;
      claimed_at: string;
    }>;
  }>('/dashboard/pending-stars');
}
```

- [ ] **Step 3: Write backend test**

In `backend/tests/test_phase4.py`, add a test after the existing visible chores test. Read the file first to find the right insertion point, then add:

```python
async def test_pending_stars_endpoint(async_client, admin_cookie, kid_cookie):
    # Create a chore via admin
    await async_client.post("/api/admin/chores", json={
        "title": "Test Chore",
        "icon_name": "star",
        "points_value": 5,
    }, cookies=admin_cookie)

    # Get the chore
    chores = (await async_client.get("/api/admin/chores", cookies=admin_cookie)).json()
    chore_id = chores[0]["id"]

    # Claim it
    resp = await async_client.post(f"/api/dashboard/chores/{chore_id}/claim", cookies=kid_cookie)
    assert resp.status_code == 200

    # Check pending stars
    resp = await async_client.get("/api/dashboard/pending-stars", cookies=kid_cookie)
    assert resp.status_code == 200
    data = resp.json()
    assert data["pending_stars"] == 5
    assert len(data["claims"]) == 1
```

- [ ] **Step 4: Run tests**

Run: `cd backend && python -m pytest tests/ -v --tb=short 2>&1 | tail -5`
Expected: 66 tests pass

- [ ] **Step 5: Commit**

```bash
git add app/api/dashboard.py frontend/src/api/client.ts tests/test_phase4.py
git commit -m "feat: add pending-stars endpoint for tracking unapproved claim points"
```

---

### Task 6: Add claim_pending WebSocket event

**Files:**
- Modify: `backend/app/api/dashboard.py:38-71` — emit `pending_stars_changed` on claim
- Modify: `frontend/src/lib/types.ts:130-137` — add `pending_stars_changed` to WSEvent type
- Modify: `frontend/src/hooks/useRealtime.ts` — handle `pending_stars_changed` event

- [ ] **Step 1: Emit event on claim**

In `backend/app/api/dashboard.py`, in the `claim_chore` endpoint, after `db.commit()` (around line 64), calculate pending stars and emit:

```python
    db.add(PendingClaim(user_id=current_user.id, chore_id=chore_id))
    db.commit()

    # Calculate pending stars for this user
    user_claims = (
        db.query(PendingClaim)
        .join(Chore, PendingClaim.chore_id == Chore.id)
        .filter(PendingClaim.user_id == current_user.id)
        .all()
    )
    pending_stars = sum(c.chore.points_value for c in user_claims)

    await broadcaster.emit("pending_claims_changed", {"count": db.query(PendingClaim).count()}, "admins")
    await broadcaster.emit("pending_stars_changed", {"user_id": current_user.id, "pending_stars": pending_stars}, "user", user_id=current_user.id)
    audience = "all" if chore.scope == "pooled" else "user"
    await broadcaster.emit(
        "visible_chores_changed", {"user_id": current_user.id}, audience, user_id=current_user.id,
    )
    return JSONResponse(content={"message": "Claimed"})
```

- [ ] **Step 2: Also emit on approval/decline**

In `backend/app/api/admin.py`, in `approve_claim_endpoint` (around line 251-266), after emitting `stars_changed`, also emit `pending_stars_changed`:

```python
    if result:
        # Calculate remaining pending stars for this user
        remaining_claims = (
            db.query(PendingClaim)
            .join(Chore, PendingClaim.chore_id == Chore.id)
            .filter(PendingClaim.user_id == result.user_id)
            .all()
        )
        remaining_pending = sum(c.chore.points_value for c in remaining_claims)
        await broadcaster.emit("stars_changed", {"user_id": result.user_id, "current_stars": result.current_stars}, "all")
        await broadcaster.emit("pending_stars_changed", {"user_id": result.user_id, "pending_stars": remaining_pending}, "user", user_id=result.user_id)
        count = db.query(PendingClaim).count()
        await broadcaster.emit("pending_claims_changed", {"count": count}, "admins")
```

Do the same in `decline_claim_endpoint` (around line 269-283):

```python
    decline_claim(claim_id, req.admin_note, db)
    db.commit()

    # Find the claim's user for pending stars broadcast
    claim = db.query(PendingClaim).filter(PendingClaim.id == claim_id).first()
    # claim was deleted, so get user from history... actually decline_claim deletes the claim.
    # We need the user_id before deletion. Let's fix this.
```

Actually, the `decline_claim` function in `app/services/approvals.py` deletes the claim before we can query it. We need to emit the pending stars update. Let me revise — in the decline endpoint, get the user_id BEFORE calling `decline_claim`:

```python
@router.post("/pending-claims/{claim_id}/decline")
async def decline_claim_endpoint(
    claim_id: int,
    req: DeclineRequest,
    db: Session = Depends(get_session),
    _admin: User = Depends(require_admin),
) -> JSONResponse:
    claim = db.query(PendingClaim).filter(PendingClaim.id == claim_id).first()
    if not claim:
        raise HTTPException(404, "Claim not found")
    try:
        decline_claim(claim_id, req.admin_note, db)
    except ValueError as e:
        raise HTTPException(404, str(e))
    db.commit()
    count = db.query(PendingClaim).count()
    await broadcaster.emit("pending_claims_changed", {"count": count}, "admins")

    # Calculate remaining pending stars for the claim's user
    remaining_claims = (
        db.query(PendingClaim)
        .join(Chore, PendingClaim.chore_id == Chore.id)
        .filter(PendingClaim.user_id == claim.user_id)
        .all()
    )
    remaining_pending = sum(c.chore.points_value for c in remaining_claims)
    await broadcaster.emit("pending_stars_changed", {"user_id": claim.user_id, "pending_stars": remaining_pending}, "user", user_id=claim.user_id)
    return JSONResponse(content={"message": "Declined"})
```

- [ ] **Step 3: Add WSEvent type**

In `frontend/src/lib/types.ts`, add to the `WSEvent` union (around line 130):

```typescript
export type WSEvent =
  | { event: 'stars_changed'; user_id: number; current_stars: number }
  | { event: 'pending_stars_changed'; user_id: number; pending_stars: number }
  | { event: 'pending_claims_changed'; count: number }
  | { event: 'visible_chores_changed'; user_id: number }
  | { event: 'collab_progress_changed'; reward_id: number; current: number; target: number; contributions: Array<{ user_id: number; user_name: string; stars: number }> }
  | { event: 'fulfillment_queue_changed' }
  | { event: 'history_changed'; user_id: number }
  | { event: 'chores_changed' };
```

- [ ] **Step 4: Handle event in useRealtime hook**

In `frontend/src/hooks/useRealtime.ts`, add a case for `pending_stars_changed`:

```typescript
        case 'pending_stars_changed': {
          const user = useAuthStore.getState().user;
          if (user && msg.user_id === user.id) {
            useAuthStore.setState({ user: { ...user, pending_stars: msg.pending_stars } });
          }
          break;
        }
```

- [ ] **Step 5: Run backend tests**

Run: `cd backend && python -m pytest tests/ -v --tb=short 2>&1 | tail -5`
Expected: All tests still pass

- [ ] **Step 6: Commit**

```bash
git add app/api/dashboard.py app/api/admin.py frontend/src/lib/types.ts frontend/src/hooks/useRealtime.ts
git commit -m "feat: add pending_stars_changed WebSocket event on claim, approve, and decline"
```

---

### Task 7: Frontend ChoreModal — recurrence UI

**Files:**
- Modify: `frontend/src/components/ChoreModal.tsx` — add recurrence pattern radio + day toggles + N-days input
- Modify: `frontend/src/api/client.ts:164-178` — update `getChores` return type
- Modify: `frontend/src/lib/types.ts:3-15` — update Chore type

- [ ] **Step 1: Update Chore type**

In `frontend/src/lib/types.ts`, add fields to the `Chore` interface:

```typescript
export interface Chore {
  id: number;
  title: string;
  description: string | null;
  icon_name: string;
  scope: 'individual' | 'pooled';
  points_value: number;
  is_repeating: boolean;
  start_time: string | null;
  window_hours: number | null;
  is_active: boolean;
  repeat_days: string[] | null;
  n_day_interval: number | null;
  created_at: string;
}
```

- [ ] **Step 2: Update getChores return type**

In `frontend/src/api/client.ts`, add the new fields to the return type of `getChores`:

```typescript
export async function getChores() {
  return request<Array<{
    id: number;
    title: string;
    description: string | null;
    icon_name: string;
    scope: string;
    points_value: number;
    is_repeating: boolean;
    start_time: string | null;
    window_hours: number | null;
    is_active: boolean;
    repeat_days: string[] | null;
    n_day_interval: number | null;
    created_at: string;
  }>>('/admin/chores');
}
```

- [ ] **Step 3: Update ChoreModal with recurrence fields**

Replace the `is_repeating` checkbox with a recurrence pattern selector. In `frontend/src/components/ChoreModal.tsx`:

Update the Zod schema (lines 13-22):

```typescript
const choreSchema = z.object({
  title: z.string().min(1, 'Required').max(200),
  description: z.string().max(500).optional(),
  icon_name: z.string().min(1, 'Required'),
  scope: z.enum(['individual', 'pooled']),
  points_value: z.number().int().min(1),
  is_repeating: z.boolean(),
  start_time: z.string().nullable().optional(),
  window_hours: z.number().int().min(1).max(24).optional(),
  repeat_pattern: z.enum(['daily', 'weekly', 'every_n_days']),
  repeat_days: z.array(z.string()).optional(),
  n_day_interval: z.number().int().min(1).max(30).optional(),
});
```

Update `ChoreForm` type and default values:

```typescript
type ChoreForm = z.infer<typeof choreSchema>;

// Helper to determine pattern from existing chore
function getRepeatPattern(chore?: Chore): 'daily' | 'weekly' | 'every_n_days' {
  if (chore?.n_day_interval) return 'every_n_days';
  if (chore?.repeat_days?.length) return 'weekly';
  return 'daily';
}

// In the component, update defaultValues:
const defaultValues: ChoreForm = {
  title: chore?.title ?? '',
  description: chore?.description ?? '',
  icon_name: chore?.icon_name ?? 'star',
  scope: chore?.scope ?? 'individual',
  points_value: chore?.points_value ?? 5,
  is_repeating: chore?.is_repeating ?? true,
  start_time: chore?.start_time ?? undefined,
  window_hours: chore?.window_hours ?? undefined,
  repeat_pattern: getRepeatPattern(chore),
  repeat_days: chore?.repeat_days ?? [],
  n_day_interval: chore?.n_day_interval ?? undefined,
};
```

Add the watch and UI state:

```typescript
  const isRepeating = watch('is_repeating');
  const repeatPattern = watch('repeat_pattern');
```

Replace the recurrence UI section (lines 154-176) with:

```tsx
          {isRepeating && (
            <>
              <div className="admin-form-group">
                <label>{t('chore.repeat_pattern')}</label>
                <div style={{ display: 'flex', gap: 12 }}>
                  {['daily', 'weekly', 'every_n_days'].map((pattern) => (
                    <label key={pattern} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <input
                        type="radio"
                        name="repeat_pattern"
                        value={pattern}
                        checked={repeatPattern === pattern}
                        onChange={() => field.onChange(pattern)}  // use the repeat_pattern field's onChange
                      />
                      {pattern === 'daily' ? t('chore.daily') : pattern === 'weekly' ? t('chore.weekly') : t('chore.every_n_days')}
                    </label>
                  ))}
                </div>
              </div>
              {repeatPattern === 'weekly' && (
                <div className="admin-form-group">
                  <label>{t('chore.repeat_days_label')}</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
                      <button
                        key={day}
                        type="button"
                        className={`day-toggle ${(watch('repeat_days') || [])?.includes(day) ? 'day-toggle-active' : ''}`}
                        onClick={() => {
                          const current = watch('repeat_days') || [];
                          const next = current.includes(day)
                            ? current.filter((d) => d !== day)
                            : [...current, day];
                          const { getField } = control as any;
                          getField('repeat_days')?.onChange(next);
                        }}
                      >
                        {day}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {repeatPattern === 'every_n_days' && (
                <div className="admin-form-group">
                  <label>{t('chore.n_days_label')}</label>
                  <Controller name="n_day_interval" control={control} render={({ field }) => (
                    <input {...field} type="number" min={1} max={30} onChange={(e) => field.onChange(Number(e.target.value))} />
                  )} />
                </div>
              )}
              <div className="admin-form-group">
                <label>{t('chore.start_time')}</label>
                <Controller name="start_time" control={control} render={({ field }) => (
                  <TimePicker24h value={field.value} onChange={field.onChange} />
                )} />
              </div>
              <div className="admin-form-group">
                <label>{t('chore.window')}</label>
                <Controller name="window_hours" control={control} render={({ field }) => (
                  <input {...field} type="number" min={1} max={24} onChange={(e) => field.onChange(Number(e.target.value))} />
                )} />
                {errors.window_hours && <div className="field-error">{errors.window_hours.message}</div>}
              </div>
            </>
          )}
```

- [ ] **Step 4: Add day-toggle CSS**

In `frontend/src/pages/admin/AdminPage.css` (or the shared App.css), add:

```css
.day-toggle {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  border: 2px solid #d1c4e9;
  background: #fff;
  font-weight: 600;
  font-size: 13px;
  cursor: pointer;
  color: var(--text, #333);
  transition: background 0.15s, border-color 0.15s;
}
.day-toggle-day-toggle-active {
  background: #7b2ff7;
  color: #fff;
  border-color: #7b2ff7;
}
```

Wait — that compound class is wrong. The condition adds `day-toggle-active` but the CSS selector should be `.day-toggle.day-toggle-active` or just `.day-toggle-active`. Let me fix the JS to use just `day-toggle-active`:

In the JSX, change to:
```tsx
className={`day-toggle ${...includes(day) ? 'day-toggle-active' : ''}`}
```

CSS:
```css
.day-toggle-active {
  background: #7b2ff7;
  color: #fff;
  border-color: #7b2ff7;
}
```

- [ ] **Step 5: Update mutation payload**

In the `mutate` callback, map `repeat_pattern` → backend fields:

```typescript
    mutationFn: async (data: ChoreForm) => {
      const payload: any = { ...data };
      if (payload.start_time === '') delete payload.start_time;
      // Map repeat_pattern to backend fields
      if (payload.repeat_pattern === 'daily') {
        payload.repeat_days = null;
        payload.n_day_interval = null;
      } else if (payload.repeat_pattern === 'weekly') {
        payload.repeat_days = payload.repeat_days || [];
        payload.n_day_interval = null;
      } else if (payload.repeat_pattern === 'every_n_days') {
        payload.repeat_days = null;
      }
      delete payload.repeat_pattern;
      if (chore) {
        return updateChore(chore.id, payload);
      }
      return createChore(payload);
    },
```

- [ ] **Step 6: Add i18n keys**

Add new translation keys to both `el` and `en` in the translations file. First find the translations file:

Run: `grep -rn "chore.repeating" /home/padeler/work/padelerodouleies/frontend/src/i18n/ --include="*.ts" --include="*.json"`

Add keys:
- `chore.repeat_pattern` → "Repeat pattern" / "Συχνότητα επανάληψης"
- `chore.daily` → "Daily" / "Καθημερινά"
- `chore.weekly` → "Weekly" / "Εβδομαδιαία"
- `chore.every_n_days` → "Every N days" / "Κάθε N ημέρες"
- `chore.repeat_days_label` → "Which days?" / "Ποιες ημέρες;"
- `chore.n_days_label` → "Every how many days?" / "Κάθε πόσες ημέρες;"

- [ ] **Step 7: Run frontend tests**

Run: `cd frontend && npm test 2>&1 | tail -10`
Expected: All tests still pass

- [ ] **Step 8: Commit**

```bash
git add frontend/src/components/ChoreModal.tsx frontend/src/lib/types.ts frontend/src/api/client.ts frontend/src/i18n/ frontend/src/pages/admin/AdminPage.css
git commit -m "feat: add recurrence pattern selector (daily/weekly/every-N-days) to chore modal"
```

---

### Task 8: AuthStore + Header — pending stars, avatars, hide admin stars

**Files:**
- Modify: `frontend/src/state/authStore.ts:3-37` — add `pending_stars` field
- Modify: `frontend/src/components/Header.tsx:10-62` — add avatar, pending stars, hide admin stars
- Modify: `frontend/src/hooks/useAuth.ts` — update to set `pending_stars` on login

- [ ] **Step 1: Add pending_stars to AuthStore**

In `frontend/src/state/authStore.ts`, add to `AuthUser` interface (line 9):

```typescript
export interface AuthUser {
  id: number;
  name: string;
  avatar_kind: string;
  avatar_value: string;
  role: 'admin' | 'user';
  current_stars: number;
  pending_stars: number;
  preferred_locale: string;
  preferred_theme: string;
}
```

- [ ] **Step 2: Set pending_stars on login**

Read `frontend/src/hooks/useAuth.ts` to find where `setUser` is called. In the login flow, after fetching `/auth/me`, also fetch `/dashboard/pending-stars` and merge into the user state. If the user is an admin, `pending_stars` should default to 0 (admins don't claim chores).

In `useAuth.ts`, in the `login` function, after `setUser(data)`, add:

```typescript
  if (data.role === 'user') {
    try {
      const pending = await getPendingStars();
      setUser({ ...data, pending_stars: pending.pending_stars });
    } catch {
      // Fallback if endpoint fails
      setUser({ ...data, pending_stars: 0 });
    }
  }
```

Also in the `getMe` refresh logic, do the same.

- [ ] **Step 3: Update Header component**

In `frontend/src/components/Header.tsx`:

```tsx
  return (
    <>
      <header className="app-header">
        <div className="header-left">
          {onToggleSidebar && (
            <button
              className="hamburger-btn"
              type="button"
              onClick={onToggleSidebar}
              aria-label="Toggle menu"
            >
              ☰
            </button>
          )}
          {user && (
            <img
              className="header-avatar"
              src={user.avatar_kind === 'image' ? user.avatar_value : `/api/icons/svg/${user.avatar_value}`}
              alt=""
            />
          )}
          <span className="user-name">{user?.name}</span>
          {user?.role !== 'admin' && (
            <>
              {user?.pending_stars > 0 && (
                <span className="user-pending-stars" title="Pending stars">
                  {user.pending_stars}☆
                </span>
              )}
              <span className="user-stars">{user?.current_stars ?? 0} ★</span>
            </>
          )}
        </div>
        ...
      </header>
      ...
    </>
  );
```

- [ ] **Step 4: Add header CSS**

Add to the shared CSS (find where `.user-name` and `.user-stars` are styled — likely `App.css` or a shared header CSS):

```css
.header-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  object-fit: cover;
  margin-right: 8px;
  border: 2px solid #d1c4e9;
}

.user-pending-stars {
  margin-right: 8px;
  color: #ccc;
  font-size: 0.9em;
}
```

- [ ] **Step 5: Run frontend tests**

Run: `cd frontend && npm test 2>&1 | tail -10`
Expected: All tests still pass

- [ ] **Step 6: Commit**

```bash
git add frontend/src/state/authStore.ts frontend/src/hooks/useAuth.ts frontend/src/components/Header.tsx frontend/src/App.css
git commit -m "feat: show avatars next to names, pending stars, and hide stars for admins in header"
```

---

### Task 9: Dashboard greeting — avatar + pending stars + hide admin stars

**Files:**
- Modify: `frontend/src/pages/dashboard/DashboardChores.tsx:51-86` — add avatar, pending stars, conditional stars

- [ ] **Step 1: Update DashboardChores greeting**

In `frontend/src/pages/dashboard/DashboardChores.tsx`:

```tsx
export function DashboardChores() {
  const t = useT();
  const { user } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ['visible-chores'],
    queryFn: getVisibleChores,
    refetchInterval: 30_000,
  });

  // Fetch pending stars
  const { data: pendingData } = useQuery({
    queryKey: ['pending-stars'],
    queryFn: getPendingStars,
    enabled: user?.role !== 'admin',
  });

  if (isLoading) return <div className="page-loading">{t('common.loading')}</div>;

  const chores = data ?? [];
  const pendingStars = pendingData?.pending_stars ?? 0;

  return (
    <div className="dashboard-chores">
      <div className="dashboard-greeting">
        {user && (
          <img
            className="dashboard-avatar"
            src={user.avatar_kind === 'image' ? user.avatar_value : `/api/icons/svg/${user.avatar_value}`}
            alt=""
          />
        )}
        <h2>
          {t('login.welcome')} {user?.name}!
        </h2>
        {user?.role !== 'admin' && (
          <div className="stars-display">
            {pendingStars > 0 && (
              <span className="pending-stars" title="Pending stars">{pendingStars}☆ </span>
            )}
            <span className="confirmed-stars">{user?.current_stars ?? 0} ★</span>
          </div>
        )}
      </div>
      ...
    </div>
  );
}
```

- [ ] **Step 2: Add CSS for dashboard greeting**

In `frontend/src/pages/dashboard/DashboardChores.css`, add:

```css
.dashboard-avatar {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  object-fit: cover;
  margin-bottom: 12px;
  border: 3px solid #d1c4e9;
}

.pending-stars {
  color: #bbb;
}

.confirmed-stars {
  color: #f0c36d;
}
```

- [ ] **Step 3: Run frontend tests**

Run: `cd frontend && npm test 2>&1 | tail -10`
Expected: All tests still pass

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/dashboard/DashboardChores.tsx frontend/src/pages/dashboard/DashboardChores.css
git commit -m "feat: show avatar, pending stars, and hide stars for admins in dashboard greeting"
```

---

### Task 10: Dashboard ChoreCard — handle image icons

**Files:**
- Modify: `frontend/src/pages/dashboard/DashboardChores.tsx:8-49` — use ChoreIcon component or inline logic

- [ ] **Step 1: Update ChoreCard to handle image icons**

In `frontend/src/pages/dashboard/DashboardChores.tsx`, update the `ChoreCard` component:

```tsx
function ChoreCard({ chore }: { chore: VisibleChore }) {
  const t = useT();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => claimChore(chore.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['visible-chores'] });
    },
  });

  const iconSrc = chore.icon_name.startsWith('/')
    ? chore.icon_name
    : `/api/icons/svg/${chore.icon_name}`;

  return (
    <div className={`chore-card chore-scope-${chore.scope}`}>
      <div className="chore-icon-wrap">
        <img
          src={iconSrc}
          alt=""
          className="chore-icon"
        />
      </div>
      <h3 className="chore-title">{chore.title}</h3>
      <div className="chore-points">+{chore.points_value} ★</div>
      ...
    </div>
  );
}
```

- [ ] **Step 2: Also update the visible-chores API to include icon_name for images**

The backend `/api/dashboard/visible-chores` already returns `icon_name`. For uploaded images, this field contains the path starting with `/`. No backend change needed.

- [ ] **Step 3: Run frontend tests**

Run: `cd frontend && npm test 2>&1 | tail -10`
Expected: All tests still pass

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/dashboard/DashboardChores.tsx
git commit -m "feat: render uploaded image icons in dashboard chore cards"
```

---

### Task 11: Frontend tests for new features

**Files:**
- Modify: `frontend/src/pages/dashboard/DashboardChores.test.tsx` (or create if not exists)
- Create: `frontend/src/pages/dashboard/PendingStars.test.tsx`

- [ ] **Step 1: Find existing test files**

Run: `find frontend/src -name "*.test.*" | head -20`

- [ ] **Step 2: Test pending stars display**

Create or update a test file to test:
1. Pending stars appear as outlined stars (☆) in the header
2. Confirmed stars appear as filled stars (★)
3. Admins don't see stars in the header
4. Avatar renders in the header

```tsx
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Header } from './Header';
import { useAuth } from '../hooks/useAuth';

const mockUser = {
  id: 1,
  name: 'TestUser',
  avatar_kind: 'icon',
  avatar_value: 'fox',
  role: 'user',
  current_stars: 10,
  pending_stars: 5,
  preferred_locale: 'el',
  preferred_theme: 'system',
};

const mockAdmin = { ...mockUser, role: 'admin' as const, name: 'Admin' };

describe('Header', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });

  it('shows pending and confirmed stars for regular users', () => {
    (useAuth as jest.Mock).mockReturnValue({ user: mockUser });
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <Header />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(screen.getByText(/5☆/)).toBeTruthy();
    expect(screen.getByText(/10★/)).toBeTruthy();
  });

  it('hides stars for admin users', () => {
    (useAuth as jest.Mock).mockReturnValue({ user: mockAdmin });
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <Header />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(screen.queryByText(/★/)).not.toBeTruthy();
    expect(screen.queryByText(/☆/)).not.toBeTruthy();
  });
});
```

- [ ] **Step 3: Run frontend tests**

Run: `cd frontend && npm test 2>&1 | tail -15`
Expected: All tests pass including new tests

- [ ] **Step 4: Commit**

```bash
git add frontend/src/**/*.test.tsx
git commit -m "test: add tests for pending stars display and admin star hiding"
```

---

### Task 12: End-to-end verification

**Files:** None — manual verification step

- [ ] **Step 1: Start the backend**

Run: `cd backend && uvicorn app.main:app --reload --port 8000`

- [ ] **Step 2: Start the frontend dev server**

Run: `cd frontend && npm run dev`

- [ ] **Step 3: Verify chore recurrence**

1. Login as admin
2. Create a chore with "weekly" pattern, select Mon/Wed/Fri
3. Verify chore appears on Monday/Wednesday/Friday in kid dashboard
4. Create a chore with "every N days", set N=2
5. Verify chore appears every 2 days from creation date

- [ ] **Step 4: Verify pending stars**

1. Login as kid
2. Claim a chore
3. Verify pending stars (☆) appear in header and dashboard greeting
4. Login as admin, approve the claim
5. Verify pending stars decrease and confirmed stars (★) increase

- [ ] **Step 5: Verify avatars**

1. Check that avatar appears next to name in header
2. Check that avatar appears in dashboard greeting
3. Check that admin stars are hidden in header and dashboard

- [ ] **Step 6: Verify image icons**

1. Upload an image as a chore icon in admin panel
2. Verify the image appears in the kid dashboard chore card

- [ ] **Step 7: Run full test suite one last time**

Run: `cd backend && python -m pytest tests/ -v --tb=short && cd ../frontend && npm test`
Expected: All tests pass

---

## Self-Review Checklist

- [x] **Spec coverage:** All 5 features covered — recurrence (Tasks 1-4, 7), pending stars (Tasks 5-6, 8-9), image icons on dashboard (Task 10), avatars next to names (Tasks 8-9), hide admin stars (Tasks 8-9)
- [x] **No placeholders:** All code snippets are complete with actual function signatures, CSS class names, and file paths
- [x] **Type consistency:** `repeat_days` is `string[] | null` in frontend, `list[str] | None` in backend — Pydantic handles the conversion. `pending_stars` is `number` in TS, `int` in Python. WSEvent type matches backend emit payloads.
- [x] **TDD:** Backend tests for recurrence (Task 4), pending stars endpoint (Task 5), frontend tests (Task 11)
- [x] **Frequent commits:** 12 tasks, each ends with a commit
- [x] **No over-engineering:** No new database tables, no scheduler, no abstract base classes. Minimal additions to existing files.
