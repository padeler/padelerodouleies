"""Marketplace routes — individual and collaborative rewards."""

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.db.engine import get_session
from app.db.models import HistoryLedger, Reward, RewardLedger, User
from app.realtime import broadcaster
from app.security.session import get_current_user

router = APIRouter(prefix="/api", tags=["marketplace"])


class ContributeRequest(BaseModel):
    stars: int = Field(gt=0)


@router.get("/marketplace/rewards")
def list_marketplace_rewards(
    db: Session = Depends(get_session),
    _user: User = Depends(get_current_user),
) -> list[dict]:
    """Return enabled rewards with collaborative progress info."""
    rewards = db.query(Reward).filter(Reward.is_enabled == True).order_by(Reward.id).all()
    result = []
    for r in rewards:
        data = {
            "id": r.id,
            "title_el": r.title_el,
            "title_en": r.title_en,
            "description_el": r.description_el,
            "description_en": r.description_en,
            "icon_name": r.icon_name,
            "cost_stars": r.cost_stars,
            "is_collaborative": r.is_collaborative,
        }
        if r.is_collaborative:
            contributions = (
                db.query(RewardLedger)
                .join(User, RewardLedger.user_id == User.id)
                .filter(RewardLedger.reward_id == r.id)
                .all()
            )
            total = sum(c.stars_contributed for c in contributions)
            data["current_stars"] = total
            data["target_stars"] = r.cost_stars
            data["contributors"] = [
                {"user_id": c.user_id, "user_name": c.user.name, "stars": c.stars_contributed}
                for c in contributions
            ]
        result.append(data)
    return result


@router.post("/rewards/{reward_id}/redeem")
async def redeem_reward(
    reward_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_session),
) -> JSONResponse:
    """Redeem an individual reward (spend stars)."""
    reward = db.query(Reward).filter(Reward.id == reward_id).first()
    if not reward:
        raise HTTPException(404, "Reward not found")
    if reward.is_collaborative:
        raise HTTPException(400, "Use the contribute endpoint for collaborative rewards")
    if not reward.is_enabled:
        raise HTTPException(400, "Reward is disabled")

    if current_user.current_stars < reward.cost_stars:
        raise HTTPException(400, "Insufficient stars")

    current_user.current_stars = current_user.current_stars - reward.cost_stars  # type: ignore[assignment]
    db.add(RewardLedger(
        reward_id=reward.id,
        user_id=current_user.id,
        status="claimed",
        stars_contributed=reward.cost_stars,
    ))
    db.add(HistoryLedger(
        user_id=current_user.id,
        action_type="reward_purchase",
        points_delta=-reward.cost_stars,
        ref_table="reward",
        ref_id=reward.id,
    ))
    db.commit()

    await broadcaster.emit(
        "stars_changed",
        {"user_id": current_user.id, "current_stars": current_user.current_stars},
        "all",
    )
    await broadcaster.emit("fulfillment_queue_changed", {}, "admins")
    return JSONResponse(content={"message": "Redeemed", "new_balance": current_user.current_stars})


@router.post("/rewards/{reward_id}/contribute")
async def contribute_reward(
    reward_id: int,
    req: ContributeRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_session),
) -> JSONResponse:
    """Contribute stars toward a collaborative reward."""
    reward = db.query(Reward).filter(Reward.id == reward_id).first()
    if not reward:
        raise HTTPException(404, "Reward not found")
    if not reward.is_collaborative:
        raise HTTPException(400, "Use the redeem endpoint for individual rewards")
    if not reward.is_enabled:
        raise HTTPException(400, "Reward is disabled")

    if current_user.current_stars < req.stars:
        raise HTTPException(400, "Insufficient stars")

    contributions = db.query(RewardLedger).filter(RewardLedger.reward_id == reward.id).all()
    total = sum(c.stars_contributed for c in contributions)
    remaining = reward.cost_stars - total
    if remaining <= 0:
        raise HTTPException(400, "Goal already reached")

    actual = min(req.stars, remaining)
    current_user.current_stars = current_user.current_stars - actual  # type: ignore[assignment]

    existing = (
        db.query(RewardLedger)
        .filter(RewardLedger.reward_id == reward.id, RewardLedger.user_id == current_user.id)
        .first()
    )
    if existing:
        existing.stars_contributed = existing.stars_contributed + actual  # type: ignore[assignment]
    else:
        db.add(RewardLedger(
            reward_id=reward.id,
            user_id=current_user.id,
            status="claimed",
            stars_contributed=actual,
        ))

    db.add(HistoryLedger(
        user_id=current_user.id,
        action_type="reward_purchase",
        points_delta=-actual,
        ref_table="reward",
        ref_id=reward.id,
    ))
    db.commit()

    new_total = total + actual
    new_contributions = (
        db.query(RewardLedger)
        .join(User, RewardLedger.user_id == User.id)
        .filter(RewardLedger.reward_id == reward.id)
        .all()
    )

    await broadcaster.emit(
        "stars_changed",
        {"user_id": current_user.id, "current_stars": current_user.current_stars},
        "all",
    )
    await broadcaster.emit(
        "collab_progress_changed",
        {
            "reward_id": reward.id,
            "current": new_total,
            "target": reward.cost_stars,
            "contributions": [
                {"user_id": c.user_id, "user_name": c.user.name, "stars": c.stars_contributed}
                for c in new_contributions
            ],
        },
        "all",
    )
    if new_total >= reward.cost_stars:
        await broadcaster.emit("fulfillment_queue_changed", {}, "admins")

    return JSONResponse(
        content={"message": "Contributed", "new_balance": current_user.current_stars, "total": new_total},
    )
