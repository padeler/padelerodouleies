"""Kid-facing dashboard routes."""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.db.engine import get_session
from app.db.models import Chore, HistoryLedger, PendingClaim, User
from app.realtime import broadcaster
from app.services.chores import TZ, visible_chores_for
from app.security.session import get_current_user

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/visible-chores")
def get_visible_chores(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_session),
) -> list[dict]:
    """Return chores visible to the logged-in kid right now."""
    now = datetime.now(TZ)
    chores = visible_chores_for(current_user.id, now, db)
    return [
        {
            "id": c.id,
            "title": c.title,
            "icon_name": c.icon_name,
            "scope": c.scope,
            "points_value": c.points_value,
        }
        for c in chores
    ]


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


@router.post("/chores/{chore_id}/claim")
async def claim_chore(
    chore_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_session),
) -> JSONResponse:
    """Claim a chore (inserts a PendingClaim row)."""
    chore = db.query(Chore).filter(Chore.id == chore_id).first()
    if not chore:
        raise HTTPException(404, "Chore not found")

    now = datetime.now(TZ)
    visible = visible_chores_for(current_user.id, now, db)
    if not any(c.id == chore_id for c in visible):
        raise HTTPException(409, "Chore not available right now")

    if chore.scope == "pooled":
        existing = (
            db.query(PendingClaim)
            .filter(PendingClaim.chore_id == chore_id)
            .first()
        )
        if existing:
            raise HTTPException(409, "Someone else claimed this first")

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


@router.get("/history")
def get_history(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_session),
) -> dict:
    """Return the logged-in kid's history ledger entries."""
    q = (
        db.query(HistoryLedger)
        .filter(HistoryLedger.user_id == current_user.id)
        .order_by(HistoryLedger.timestamp.desc())
    )
    total = q.count()
    rows = q.limit(limit).offset(offset).all()

    entries = []
    for r in rows:
        entry = {
            "id": r.id,
            "action_type": r.action_type,
            "points_delta": r.points_delta,
            "ref_table": r.ref_table,
            "ref_id": r.ref_id,
            "admin_note": r.admin_note,
            "timestamp": r.timestamp.isoformat(),
        }
        if r.ref_table == "chore" and r.ref_id:
            chore = db.query(Chore).filter(Chore.id == r.ref_id).first()
            if chore:
                entry["chore_title"] = chore.title
                entry["chore_icon"] = chore.icon_name
                entry["chore_points_value"] = chore.points_value
        entries.append(entry)

    return {"total": total, "entries": entries}
