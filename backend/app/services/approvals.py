"""Transactional approve/decline/retroactive-decline logic."""

from sqlalchemy.orm import Session

from app.db.models import Chore, HistoryLedger, PendingClaim, User


def approve_claim(claim_id: int, db: Session) -> None:
    claim = db.query(PendingClaim).filter(PendingClaim.id == claim_id).first()
    if not claim:
        raise ValueError("Claim not found")
    chore = db.query(Chore).filter(Chore.id == claim.chore_id).first()
    user = db.query(User).filter(User.id == claim.user_id).first()
    if not chore or not user:
        raise ValueError("Referenced chore or user not found")

    user.current_stars = user.current_stars + chore.points_value  # type: ignore[assignment]
    db.add(HistoryLedger(
        user_id=claim.user_id,
        action_type="chore_approved",
        points_delta=chore.points_value,
        ref_table="chore",
        ref_id=chore.id,
    ))
    db.delete(claim)


def decline_claim(claim_id: int, admin_note: str | None, db: Session) -> None:
    claim = db.query(PendingClaim).filter(PendingClaim.id == claim_id).first()
    if not claim:
        raise ValueError("Claim not found")

    db.add(HistoryLedger(
        user_id=claim.user_id,
        action_type="chore_declined",
        points_delta=0,
        admin_note=admin_note,
    ))
    db.delete(claim)


def retroactive_decline(ledger_id: int, admin_note: str | None, db: Session) -> None:
    original = db.query(HistoryLedger).filter(
        HistoryLedger.id == ledger_id,
        HistoryLedger.action_type == "chore_approved",
    ).first()
    if not original:
        raise ValueError("Only approved chore entries can be retroactively declined")

    chore = db.query(Chore).filter(Chore.id == original.ref_id).first()
    if not chore:
        raise ValueError("Referenced chore not found")
    user = db.query(User).filter(User.id == original.user_id).first()
    if not user:
        raise ValueError("Referenced user not found")

    if user.current_stars < chore.points_value:
        raise ValueError("Insufficient stars to reverse")

    user.current_stars = user.current_stars - chore.points_value  # type: ignore[assignment]
    db.add(HistoryLedger(
        user_id=original.user_id,
        action_type="chore_declined",
        points_delta=-chore.points_value,
        ref_table="chore",
        ref_id=chore.id,
        admin_note=admin_note,
    ))
