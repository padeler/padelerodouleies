"""Admin control panel routes."""

from datetime import datetime, timezone
from typing import Any

import asyncio

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.db.engine import get_session
from app.db.models import Chore, HistoryLedger, PendingClaim, Reward, RewardLedger, User
from app.realtime import broadcaster
from app.schemas.admin import (
    AdminUserCreate,
    AdminUserRead,
    AdminUserUpdate,
    ChoreCreate,
    ChoreRead,
    ChoreUpdate,
    DeclineRequest,
    FulfillmentRead,
    HistoryRead,
    PendingClaimRead,
    PinResetRequest,
    RewardCreate,
    RewardRead,
    RewardUpdate,
    StarAdjustmentRequest,
)
from app.security import pins as pin_utils
from app.security.session import require_admin
from app.services.approvals import approve_claim, decline_claim, retroactive_decline
from app.services.avatars import delete_avatar, save_avatar

router = APIRouter(prefix="/api/admin", tags=["admin"])


# ---------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------

def _user_dict(user: User) -> dict[str, Any]:
    return {
        "id": user.id,
        "name": user.name,
        "avatar_kind": user.avatar_kind,
        "avatar_value": user.avatar_value,
        "role": user.role,
        "current_stars": user.current_stars,
        "preferred_locale": user.preferred_locale,
        "is_active": user.is_active,
    }


# ---------------------------------------------------------------------
# Pending count
# ---------------------------------------------------------------------

@router.get("/pending-count")
def get_pending_count(
    db: Session = Depends(get_session),
    _admin: User = Depends(require_admin),
) -> dict[str, int]:
    count = db.query(PendingClaim).count()
    return {"count": count}


# ---------------------------------------------------------------------
# Avatar upload
# ---------------------------------------------------------------------

@router.post("/avatars")
async def upload_avatar_endpoint(
    file: UploadFile,
    _admin: User = Depends(require_admin),
) -> JSONResponse:
    try:
        url = await save_avatar(file)
    except ValueError as e:
        return JSONResponse(status_code=400, content={"detail": str(e)})
    return JSONResponse(content={"url": url})


# ---------------------------------------------------------------------
# Chore CRUD
# ---------------------------------------------------------------------

@router.get("/chores")
def list_chores(
    db: Session = Depends(get_session),
    _admin: User = Depends(require_admin),
) -> list[ChoreRead]:
    chores = db.query(Chore).order_by(Chore.id).all()
    return [ChoreRead.model_validate(c) for c in chores]


@router.post("/chores", status_code=201)
def create_chore(
    req: ChoreCreate,
    db: Session = Depends(get_session),
    _admin: User = Depends(require_admin),
) -> ChoreRead:
    chore = Chore(**req.model_dump())
    db.add(chore)
    db.commit()
    db.refresh(chore)
    return ChoreRead.model_validate(chore)


@router.patch("/chores/{chore_id}")
def update_chore(
    chore_id: int,
    req: ChoreUpdate,
    db: Session = Depends(get_session),
    _admin: User = Depends(require_admin),
) -> ChoreRead:
    chore = db.query(Chore).filter(Chore.id == chore_id).first()
    if not chore:
        raise HTTPException(404, "Chore not found")
    update_data = req.model_dump(exclude_unset=True)
    for k, v in update_data.items():
        setattr(chore, k, v)
    db.commit()
    db.refresh(chore)
    return ChoreRead.model_validate(chore)


@router.delete("/chores/{chore_id}")
def delete_chore(
    chore_id: int,
    db: Session = Depends(get_session),
    _admin: User = Depends(require_admin),
) -> dict[str, str]:
    chore = db.query(Chore).filter(Chore.id == chore_id).first()
    if not chore:
        raise HTTPException(404, "Chore not found")
    chore.is_active = False
    db.commit()
    return {"message": "Deleted"}


# ---------------------------------------------------------------------
# Reward CRUD
# ---------------------------------------------------------------------

@router.get("/rewards")
def list_rewards(
    db: Session = Depends(get_session),
    _admin: User = Depends(require_admin),
) -> list[RewardRead]:
    rewards = db.query(Reward).order_by(Reward.id).all()
    return [RewardRead.model_validate(r) for r in rewards]


@router.post("/rewards", status_code=201)
def create_reward(
    req: RewardCreate,
    db: Session = Depends(get_session),
    _admin: User = Depends(require_admin),
) -> RewardRead:
    reward = Reward(**req.model_dump())
    db.add(reward)
    db.commit()
    db.refresh(reward)
    return RewardRead.model_validate(reward)


@router.patch("/rewards/{reward_id}")
def update_reward(
    reward_id: int,
    req: RewardUpdate,
    db: Session = Depends(get_session),
    _admin: User = Depends(require_admin),
) -> RewardRead:
    reward = db.query(Reward).filter(Reward.id == reward_id).first()
    if not reward:
        raise HTTPException(404, "Reward not found")
    update_data = req.model_dump(exclude_unset=True)
    for k, v in update_data.items():
        setattr(reward, k, v)
    db.commit()
    db.refresh(reward)
    return RewardRead.model_validate(reward)


@router.delete("/rewards/{reward_id}")
def delete_reward(
    reward_id: int,
    db: Session = Depends(get_session),
    _admin: User = Depends(require_admin),
) -> dict[str, str]:
    reward = db.query(Reward).filter(Reward.id == reward_id).first()
    if not reward:
        raise HTTPException(404, "Reward not found")
    reward.is_enabled = False
    db.commit()
    return {"message": "Disabled"}


# ---------------------------------------------------------------------
# Approvals queue
# ---------------------------------------------------------------------

@router.get("/pending-claims")
def list_pending_claims(
    db: Session = Depends(get_session),
    _admin: User = Depends(require_admin),
) -> list[PendingClaimRead]:
    claims = (
        db.query(PendingClaim)
        .join(User, PendingClaim.user_id == User.id)
        .join(Chore, PendingClaim.chore_id == Chore.id)
        .order_by(PendingClaim.claimed_at.desc())
        .all()
    )
    result: list[PendingClaimRead] = []
    for claim in claims:
        user = claim.user
        chore = claim.chore
        result.append(PendingClaimRead(
            id=claim.id,
            user_id=user.id,
            user_name=user.name,
            user_avatar_kind=user.avatar_kind,
            user_avatar_value=user.avatar_value,
            chore_id=chore.id,
            chore_icon=chore.icon_name,
            chore_title_el=chore.title_el,
            chore_title_en=chore.title_en,
            points_value=chore.points_value,
            claimed_at=claim.claimed_at,
        ))
    return result


@router.post("/pending-claims/{claim_id}/approve")
async def approve_claim_endpoint(
    claim_id: int,
    db: Session = Depends(get_session),
    _admin: User = Depends(require_admin),
) -> JSONResponse:
    try:
        result = approve_claim(claim_id, db)
    except ValueError as e:
        raise HTTPException(404, str(e))
    db.commit()
    if result:
        await broadcaster.emit("stars_changed", {"user_id": result.user_id, "current_stars": result.current_stars}, "all")
        count = db.query(PendingClaim).count()
        await broadcaster.emit("pending_claims_changed", {"count": count}, "admins")
    return JSONResponse(content={"message": "Approved"})


@router.post("/pending-claims/{claim_id}/decline")
async def decline_claim_endpoint(
    claim_id: int,
    req: DeclineRequest,
    db: Session = Depends(get_session),
    _admin: User = Depends(require_admin),
) -> JSONResponse:
    try:
        decline_claim(claim_id, req.admin_note, db)
    except ValueError as e:
        raise HTTPException(404, str(e))
    db.commit()
    count = db.query(PendingClaim).count()
    await broadcaster.emit("pending_claims_changed", {"count": count}, "admins")
    return JSONResponse(content={"message": "Declined"})


@router.post("/history/{ledger_id}/retroactive-decline")
async def retroactive_decline_endpoint(
    ledger_id: int,
    req: DeclineRequest,
    db: Session = Depends(get_session),
    _admin: User = Depends(require_admin),
) -> JSONResponse:
    try:
        result = retroactive_decline(ledger_id, req.admin_note, db)
    except ValueError as e:
        raise HTTPException(400, str(e))
    db.commit()
    if result:
        await broadcaster.emit("stars_changed", {"user_id": result.user_id, "current_stars": result.current_stars}, "all")
        await broadcaster.emit("history_changed", {"user_id": result.user_id}, "user", user_id=result.user_id)
    return JSONResponse(content={"message": "Declined"})


# ---------------------------------------------------------------------
# User management
# ---------------------------------------------------------------------

@router.get("/users")
def list_admin_users(
    db: Session = Depends(get_session),
    _admin: User = Depends(require_admin),
) -> list[AdminUserRead]:
    users = db.query(User).order_by(User.id).all()
    return [AdminUserRead.model_validate(u) for u in users]


@router.post("/users", status_code=201)
def create_admin_user(
    req: AdminUserCreate,
    db: Session = Depends(get_session),
    _admin: User = Depends(require_admin),
) -> JSONResponse:
    if len(req.pin) != 4 or not req.pin.isdigit():
        return JSONResponse(status_code=400, content={"detail": "PIN must be 4 digits"})
    user = User(
        name=req.name,
        role=req.role,
        avatar_kind=req.avatar_kind,
        avatar_value=req.avatar_value,
        pin_hash=pin_utils.hash_pin(req.pin),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return JSONResponse(
        status_code=201,
        content=AdminUserRead.model_validate(user).model_dump(),
    )


@router.patch("/users/{user_id}")
def update_admin_user(
    user_id: int,
    req: AdminUserUpdate,
    db: Session = Depends(get_session),
    _admin: User = Depends(require_admin),
) -> JSONResponse:
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(404, "User not found")

    if req.avatar_kind == "image" and req.avatar_value:
        if user.avatar_kind == "image" and user.avatar_value != req.avatar_value:
            delete_avatar(user.avatar_value)

    update_data = req.model_dump(exclude_unset=True)
    for k, v in update_data.items():
        setattr(user, k, v)
    db.commit()
    db.refresh(user)
    return JSONResponse(content=AdminUserRead.model_validate(user).model_dump())


@router.delete("/users/{user_id}")
def delete_admin_user(
    user_id: int,
    db: Session = Depends(get_session),
    _admin: User = Depends(require_admin),
) -> dict[str, str]:
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(404, "User not found")
    user.is_active = False
    db.commit()
    return {"message": "Deleted"}


@router.post("/users/{user_id}/pin-reset")
def reset_pin(
    user_id: int,
    req: PinResetRequest,
    db: Session = Depends(get_session),
    _admin: User = Depends(require_admin),
) -> JSONResponse:
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(404, "User not found")
    if len(req.new_pin) != 4 or not req.new_pin.isdigit():
        return JSONResponse(status_code=400, content={"detail": "PIN must be 4 digits"})
    user.pin_hash = pin_utils.hash_pin(req.new_pin)  # type: ignore[assignment]
    db.commit()
    return JSONResponse(content={"message": "PIN reset"})


# ---------------------------------------------------------------------
# Star adjustments
# ---------------------------------------------------------------------

@router.post("/users/{user_id}/adjust-stars")
async def adjust_stars(
    user_id: int,
    req: StarAdjustmentRequest,
    db: Session = Depends(get_session),
    _admin: User = Depends(require_admin),
) -> JSONResponse:
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(404, "User not found")
    new_balance = user.current_stars + req.points_delta
    if new_balance < 0:
        return JSONResponse(
            status_code=400,
            content={"detail": "Adjustment would push balance below zero"},
        )
    user.current_stars = new_balance  # type: ignore[assignment]
    db.add(HistoryLedger(
        user_id=user_id,
        action_type="manual_adjust",
        points_delta=req.points_delta,
        admin_note=req.description,
    ))
    db.commit()
    await broadcaster.emit("stars_changed", {"user_id": user_id, "current_stars": new_balance}, "all")
    return JSONResponse(
        content={"message": "Adjusted", "new_balance": new_balance},
    )


# ---------------------------------------------------------------------
# Fulfillment queue
# ---------------------------------------------------------------------

@router.get("/fulfillment")
def list_fulfillment(
    status: str = Query("claimed"),
    db: Session = Depends(get_session),
    _admin: User = Depends(require_admin),
) -> list[FulfillmentRead]:
    entries = (
        db.query(RewardLedger)
        .join(Reward, RewardLedger.reward_id == Reward.id)
        .join(User, RewardLedger.user_id == User.id)
        .filter(RewardLedger.status == status)
        .order_by(RewardLedger.claimed_at.desc())
        .all()
    )
    return [
        FulfillmentRead(
            id=e.id,
            reward_id=e.reward_id,
            reward_title_el=e.reward.title_el,
            reward_title_en=e.reward.title_en,
            reward_icon=e.reward.icon_name,
            user_id=e.user_id,
            user_name=e.user.name,
            status=e.status,
            claimed_at=e.claimed_at,
            fulfilled_at=e.fulfilled_at,
            stars_contributed=e.stars_contributed,
        )
        for e in entries
    ]


@router.post("/fulfillment/{ledger_id}/mark-fulfilled")
async def mark_fulfilled(
    ledger_id: int,
    db: Session = Depends(get_session),
    _admin: User = Depends(require_admin),
) -> JSONResponse:
    entry = db.query(RewardLedger).filter(RewardLedger.id == ledger_id).first()
    if not entry:
        raise HTTPException(404, "Entry not found")
    entry.status = "fulfilled"  # type: ignore[assignment]
    entry.fulfilled_at = datetime.now(timezone.utc)  # type: ignore[assignment]
    db.commit()
    await broadcaster.emit("fulfillment_queue_changed", {}, "admins")
    return JSONResponse(content={"message": "Fulfilled"})


# ---------------------------------------------------------------------
# Admin activity / history
# ---------------------------------------------------------------------

@router.get("/history")
def list_history(
    user_id: int | None = Query(None),
    action_type: str | None = Query(None),
    from_date: datetime | None = Query(None, alias="from"),
    to_date: datetime | None = Query(None, alias="to"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_session),
    _admin: User = Depends(require_admin),
) -> dict[str, Any]:
    q = db.query(HistoryLedger).join(User, HistoryLedger.user_id == User.id)
    if user_id is not None:
        q = q.filter(HistoryLedger.user_id == user_id)
    if action_type:
        q = q.filter(HistoryLedger.action_type == action_type)
    if from_date:
        q = q.filter(HistoryLedger.timestamp >= from_date)
    if to_date:
        q = q.filter(HistoryLedger.timestamp <= to_date)
    total = q.count()
    rows = q.order_by(HistoryLedger.timestamp.desc()).limit(limit).offset(offset).all()
    return {
        "total": total,
        "entries": [
            HistoryRead(
                id=r.id,
                user_id=r.user_id,
                user_name=r.user.name,
                action_type=r.action_type,
                points_delta=r.points_delta,
                ref_table=r.ref_table,
                ref_id=r.ref_id,
                admin_note=r.admin_note,
                timestamp=r.timestamp,
            ).model_dump()
            for r in rows
        ],
    }
