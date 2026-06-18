"""Populate the database with dummy data for testing.

Usage:
    cd backend && python scripts/seed_dummy.py

This will clear all existing data, run migrations, and insert:
- 1 admin (PIN: 1111)
- 3 kids (PIN: 2222, 3333, 4444)
- 14 chores (daily, weekly, every-N-days)
- 8 rewards (individual + collaborative)
- 4 pending claims (kids have claimed chores awaiting approval)
- ~8 weeks of realistic activity (chore approvals, bonuses, reward purchases)
  spread across weekdays so the Stats page has meaningful charts. Each kid has
  a distinct profile (Μαρία = top earner / hardest worker, Γιώργος = top buyer,
  Ελένη = lightest). Per-kid `current_stars` is recomputed from the seeded
  ledger so balances reconcile with the history.

Activity generation is deterministic (`random.seed(42)`), so re-running yields
the same dataset.

Run `alembic upgrade head` manually first if migrations are behind.
"""

import random
import sys
from datetime import date, datetime, time, timedelta, timezone

sys.path.insert(0, "..")

from app.db.engine import LocalSession, init_db
from app.db.models import (
    Chore,
    HistoryLedger,
    PendingClaim,
    Reward,
    RewardLedger,
    User,
)
from app.security.pins import hash_pin


def clear_all(db):
    """Delete all rows in the correct order to respect FK constraints."""
    db.query(PendingClaim).delete()
    db.query(RewardLedger).delete()
    db.query(HistoryLedger).delete()
    db.query(Chore).delete()
    db.query(Reward).delete()
    db.query(User).delete()
    db.commit()
    print("Cleared all tables.")


def seed_users(db):
    now = datetime.now()
    today = date.today()
    users = [
        User(
            name="Γονέας",
            role="admin",
            avatar_kind="icon",
            avatar_value="shield",
            pin_hash=hash_pin("1111"),
            current_stars=0,
            preferred_locale="el",
            preferred_theme="dark",
            created_at=now,
        ),
        User(
            name="Μαρία",
            role="user",
            avatar_kind="icon",
            avatar_value="fox",
            pin_hash=hash_pin("2222"),
            current_stars=45,
            preferred_locale="el",
            preferred_theme="light",
            birthdate=date(today.year - 9, today.month, today.day),
            created_at=now,
        ),
        User(
            name="Γιώργος",
            role="user",
            avatar_kind="icon",
            avatar_value="swords",
            pin_hash=hash_pin("3333"),
            current_stars=32,
            preferred_locale="el",
            preferred_theme="system",
            birthdate=date(today.year - 4, today.month, today.day),
            created_at=now,
        ),
        User(
            name="Ελένη",
            role="user",
            avatar_kind="icon",
            avatar_value="smile",
            pin_hash=hash_pin("4444"),
            current_stars=18,
            preferred_locale="el",
            preferred_theme="dark",
            created_at=now,
        ),
    ]
    for u in users:
        db.add(u)
    db.commit()
    for u in users:
        db.refresh(u)
    print(f"Seeded {len(users)} users (PIN: 1111=admin, 2222/3333/4444=kids).")
    return users


def seed_chores(db, users):
    now = datetime.now()
    chores = [
        # -- Daily individual chores --
        Chore(
            title="Βούρτσισμα δοντιών",
            description="Βούρτσισε τα δόντια σου πρωί και βράδυ",
            icon_name="tooth",
            claim_mode="each",
            points_value=5,
            is_repeating=True,
            start_time=time(7, 0),
            window_hours=24,
            is_active=True,
            created_at=now - timedelta(days=30),
        ),
        Chore(
            title="Τακτοποίηση κρεβατιού",
            description="Τακτοποίησε το κρεβάτι σου το πρωί",
            icon_name="bed",
            claim_mode="each",
            points_value=3,
            is_repeating=True,
            start_time=time(7, 30),
            window_hours=3,
            is_active=True,
            created_at=now - timedelta(days=30),
        ),
        Chore(
            title="Πλύσιμο πιάτων",
            description="Πλύνε τα πιάτα μετά το φαγητό",
            icon_name="plate",
            claim_mode="each",
            points_value=8,
            is_repeating=True,
            start_time=time(19, 30),
            window_hours=3,
            is_active=True,
            created_at=now - timedelta(days=25),
        ),
        Chore(
            title="Μάζεμα σχολικής τσάντας",
            description="Βάλε τα βιβλία σου στη τσάντα για αύριο",
            icon_name="backpack",
            claim_mode="each",
            points_value=4,
            is_repeating=True,
            start_time=time(20, 0),
            window_hours=3,
            is_active=True,
            created_at=now - timedelta(days=20),
        ),
        Chore(
            title="Διαβάσμα",
            description="Διάβασε για 30 λεπτά",
            icon_name="book",
            claim_mode="each",
            points_value=6,
            is_repeating=True,
            start_time=time(17, 0),
            window_hours=5,
            is_active=True,
            created_at=now - timedelta(days=5),
        ),
        Chore(
            title="Μπάνιο / Ντους",
            description="Κάνε ντους ή μπάνιο",
            icon_name="shower",
            claim_mode="each",
            points_value=5,
            is_repeating=True,
            start_time=time(18, 0),
            window_hours=4,
            is_active=True,
            created_at=now - timedelta(days=20),
        ),
        # -- Weekly chores --
        Chore(
            title="Σκούπισμα δωματίου",
            description="Σκούπισε και μάζεψε το δωμάτιό σου",
            icon_name="sparkles",
            claim_mode="each",
            points_value=10,
            is_repeating=True,
            repeat_days=["Mon", "Wed", "Fri"],
            is_active=True,
            created_at=now - timedelta(days=28),
        ),
        Chore(
            title="Τακτοποίηση σαλονιού",
            description="Τακτοποίησε τον καναπέ και το σαλόνι",
            icon_name="sofa",
            claim_mode="one",
            points_value=12,
            is_repeating=True,
            repeat_days=["Tue", "Thu", "Sat"],
            is_active=True,
            created_at=now - timedelta(days=15),
        ),
        Chore(
            title="Τακτοποίηση αυλής",
            description="Μάζεψε τα πράγματα από την αυλή",
            icon_name="fence",
            claim_mode="each",
            points_value=15,
            is_repeating=True,
            repeat_days=["Sun"],
            is_active=True,
            created_at=now - timedelta(days=14),
        ),
        Chore(
            title="Πλύσιμο μπάνιου",
            description="Καθάρισε τη μπανιέρα και τη λεκάνη",
            icon_name="bath",
            claim_mode="one",
            points_value=20,
            is_repeating=True,
            repeat_days=["Sat"],
            is_active=True,
            created_at=now - timedelta(days=28),
        ),
        # -- Every-N-days chores --
        Chore(
            title="Αλλαγή σεντονιών",
            description="Άλλαξε τα σεντόνια και μαξιλαροθήκες",
            icon_name="washing-machine",
            claim_mode="each",
            points_value=15,
            is_repeating=True,
            n_day_interval=7,
            is_active=True,
            created_at=now - timedelta(days=21),
        ),
        Chore(
            title="Καθαρισμός παπουτσιών",
            description="Καθάρισε τα παπούτσια σου",
            icon_name="footprints",
            claim_mode="each",
            points_value=8,
            is_repeating=True,
            n_day_interval=3,
            is_active=True,
            created_at=now - timedelta(days=10),
        ),
        # -- Inactive chore (to test disabled state) --
        Chore(
            title="Παλιά Δουλειά",
            description="Αυτή η δουλειά δεν είναι πλέον ενεργή",
            icon_name="archive",
            claim_mode="each",
            points_value=5,
            is_repeating=True,
            is_active=False,
            created_at=now - timedelta(days=60),
        ),
        # -- Flexible (no time window) --
        Chore(
            title="Γυμναστική",
            description="Κάνε τουλάχιστον 20 λεπτά άσκηση",
            icon_name="dumbbell",
            claim_mode="each",
            points_value=10,
            is_repeating=True,
            is_active=True,
            created_at=now - timedelta(days=5),
        ),
    ]
    for c in chores:
        db.add(c)
    db.commit()
    for c in chores:
        db.refresh(c)
    print(f"Seeded {len(chores)} chores.")
    return chores


def seed_rewards(db):
    now = datetime.now()
    rewards = [
        Reward(
            title="Εστιατόριο της επιλογής σου",
            description="Βγαίνουμε για φαγητό σε εστιατόριο της επιλογής σου",
            icon_name="utensils",
            cost_stars=30,
            is_collaborative=False,
            is_enabled=True,
            created_at=now - timedelta(days=20),
        ),
        Reward(
            title="Κινούμενα σχέδια 1 ώρα",
            description="Μπορείς να δεις ταινίες ή κινούμενα σχέδια για 1 ώρα",
            icon_name="tv",
            cost_stars=15,
            is_collaborative=False,
            is_enabled=True,
            created_at=now - timedelta(days=18),
        ),
        Reward(
            title="Βίντεο γκέιμ 30 λεπτά",
            description="Παίξε το αγαπημένο σου παιχνίδι για 30 λεπτά",
            icon_name="gamepad",
            cost_stars=20,
            is_collaborative=False,
            is_enabled=True,
            created_at=now - timedelta(days=15),
        ),
        Reward(
            title="Παγωτό βόλτα",
            description="Βγαίνουμε βόλτα και τρώμε παγωτό",
            icon_name="ice-cream-cone",
            cost_stars=25,
            is_collaborative=False,
            is_enabled=True,
            created_at=now - timedelta(days=12),
        ),
        Reward(
            title="Νέο παιχνίδι / βιβλίο",
            description="Αγοράζουμε ένα νέο παιχνίδι ή βιβλίο",
            icon_name="gift",
            cost_stars=50,
            is_collaborative=False,
            is_enabled=True,
            created_at=now - timedelta(days=30),
        ),
        Reward(
            title="Γλυκά από το ζαχαροπλαστείο",
            description="Επιλέγεις γλυκά από το αγαπημένο σου ζαχαροπλαστείο",
            icon_name="candy-cane",
            cost_stars=10,
            is_collaborative=False,
            is_enabled=True,
            created_at=now - timedelta(days=8),
        ),
        # -- Collaborative rewards --
        Reward(
            title="Εκδρομή στο θεματικό πάρκο",
            description="Πάμε όλη η οικογένεια σε θεματικό πάρκο!",
            icon_name="ferris-wheel",
            cost_stars=300,
            is_collaborative=True,
            is_enabled=True,
            created_at=now - timedelta(days=10),
        ),
        Reward(
            title="Πάρτι στο σπίτι",
            description="Διοργανώνουμε πάρτι με φίλους στο σπίτι",
            icon_name="party-popper",
            cost_stars=200,
            is_collaborative=True,
            is_enabled=True,
            created_at=now - timedelta(days=8),
        ),
    ]
    for r in rewards:
        db.add(r)
    db.commit()
    for r in rewards:
        db.refresh(r)
    print(f"Seeded {len(rewards)} rewards.")
    return rewards


def seed_claims(db, users, chores):
    """Create pending claims for kids on active chores."""
    maria, giorgos, eleni = users[1], users[2], users[3]
    active_each = [c for c in chores if c.is_active and c.claim_mode == "each"]
    active_one = [c for c in chores if c.is_active and c.claim_mode == "one"]

    # each-mode: multiple kids can have independent pending claims on the same chore
    claims = [
        PendingClaim(user_id=maria.id, chore_id=active_each[0].id),
        PendingClaim(user_id=giorgos.id, chore_id=active_each[1].id),
        PendingClaim(user_id=eleni.id, chore_id=active_each[0].id),
        PendingClaim(user_id=maria.id, chore_id=active_each[4].id),
    ]
    # one-mode: only one kid claims it for the period
    if active_one:
        claims.append(PendingClaim(user_id=giorgos.id, chore_id=active_one[0].id))
    for c in claims:
        db.add(c)
    db.commit()
    print(f"Seeded {len(claims)} pending claims.")
    return claims


# History/reward timestamps must be naive UTC to match how the app writes them
# (SQLite CURRENT_TIMESTAMP is UTC); the Stats service converts stored timestamps
# UTC -> Athens before bucketing by weekday, so seeding in UTC keeps the charts
# correct.
def _utc_now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


# Busier weekends, mid-week dip — gives the per-weekday chart visible shape.
_WEEKDAY_WEIGHT = {0: 0.65, 1: 0.6, 2: 0.45, 3: 0.6, 4: 0.8, 5: 1.0, 6: 0.95}

_ACTIVITY_DAYS = 56  # ~8 weeks of history


def seed_activity(db, users, chores, rewards):
    """Generate ~8 weeks of realistic activity to populate the Stats page.

    Writes chore approvals (positive), occasional manual bonuses, individual
    reward purchases and collaborative contributions (each a RewardLedger row +
    a negative `reward_purchase` history row, mirroring the marketplace service),
    then recomputes each kid's `current_stars` from the net ledger.
    """
    random.seed(42)
    admin = users[0]
    maria, giorgos, eleni = users[1], users[2], users[3]
    now = _utc_now()

    active_chores = [c for c in chores if c.is_active and c.is_repeating]
    individual_rewards = [r for r in rewards if not r.is_collaborative and r.is_enabled]
    collab_rewards = [r for r in rewards if r.is_collaborative]

    history: list[HistoryLedger] = []
    ledger: list[RewardLedger] = []
    balances = {u.id: 0 for u in users}

    # (user, daily chore intensity, individual purchases, manual bonuses)
    profiles = [
        (maria, 1.05, 4, 2),    # top earner + hardest worker
        (giorgos, 0.75, 8, 1),  # top buyer (most reward redemptions)
        (eleni, 0.50, 3, 1),    # lightest
    ]

    def _ts_on(day: datetime, lo: int, hi: int) -> datetime:
        return day.replace(
            hour=random.randint(lo, hi), minute=random.randint(0, 59), second=0, microsecond=0
        )

    for user, intensity, n_purchases, n_manual in profiles:
        # -- Chore approvals spread across the period --
        for d in range(_ACTIVITY_DAYS):
            day = now - timedelta(days=d)
            expected = intensity * _WEEKDAY_WEIGHT[day.weekday()]
            count = (1 if random.random() < expected else 0) + (
                1 if random.random() < expected * 0.5 else 0
            )
            for _ in range(count):
                chore = random.choice(active_chores)
                history.append(HistoryLedger(
                    user_id=user.id,
                    action_type="chore_approved",
                    points_delta=chore.points_value,
                    ref_table="chore",
                    ref_id=chore.id,
                    actor_user_id=admin.id,
                    timestamp=_ts_on(day, 7, 20),
                ))
                balances[user.id] += chore.points_value

        # -- Manual bonuses --
        for _ in range(n_manual):
            day = now - timedelta(days=random.randint(0, _ACTIVITY_DAYS))
            delta = random.choice([5, 10, 15])
            history.append(HistoryLedger(
                user_id=user.id,
                action_type="manual_adjust",
                points_delta=delta,
                admin_note="Μπόνους για εξαιρετική βοήθεια",
                actor_user_id=admin.id,
                timestamp=_ts_on(day, 9, 21),
            ))
            balances[user.id] += delta

        # -- Individual reward purchases --
        for _ in range(n_purchases):
            reward = random.choice(individual_rewards)
            day = now - timedelta(days=random.randint(0, _ACTIVITY_DAYS))
            ts = _ts_on(day, 10, 21)
            fulfilled = random.random() < 0.6
            ledger.append(RewardLedger(
                reward_id=reward.id,
                user_id=user.id,
                status="fulfilled" if fulfilled else "claimed",
                stars_contributed=reward.cost_stars,
                claimed_at=ts,
                fulfilled_at=(ts + timedelta(hours=random.randint(2, 48))) if fulfilled else None,
            ))
            history.append(HistoryLedger(
                user_id=user.id,
                action_type="reward_purchase",
                points_delta=-reward.cost_stars,
                ref_table="reward",
                ref_id=reward.id,
                admin_note=f"Αγορά: {reward.title}",
                timestamp=ts,
            ))
            balances[user.id] -= reward.cost_stars

    # -- Collaborative contributions (partial progress towards shared goals) --
    collab_plan = [
        (maria, collab_rewards[0], 30),
        (giorgos, collab_rewards[0], 25),
        (eleni, collab_rewards[0], 20),
        (maria, collab_rewards[1], 35),
        (giorgos, collab_rewards[1], 20),
    ]
    for user, reward, stars in collab_plan:
        day = now - timedelta(days=random.randint(1, 20))
        ts = _ts_on(day, 10, 20)
        ledger.append(RewardLedger(
            reward_id=reward.id,
            user_id=user.id,
            status="claimed",
            stars_contributed=stars,
            claimed_at=ts,
        ))
        history.append(HistoryLedger(
            user_id=user.id,
            action_type="reward_purchase",
            points_delta=-stars,
            ref_table="reward",
            ref_id=reward.id,
            admin_note=f"Συνεισφορά: {reward.title}",
            timestamp=ts,
        ))
        balances[user.id] -= stars

    for e in history:
        db.add(e)
    for e in ledger:
        db.add(e)
    # Reconcile each kid's balance with the seeded ledger (never below zero).
    for user in users:
        if user.role == "user":
            user.current_stars = max(0, balances[user.id])
    db.commit()

    print(
        f"Seeded {len(history)} history entries and {len(ledger)} reward-ledger "
        f"entries across {_ACTIVITY_DAYS} days."
    )
    for user in (maria, giorgos, eleni):
        print(f"  {user.name}: {user.current_stars} stars (net)")


def main():
    print("=== Seed Dummy Data ===\n")

    init_db()
    print("Migrations applied.")

    db = LocalSession()
    try:
        clear_all(db)
        users = seed_users(db)
        chores = seed_chores(db, users)
        rewards = seed_rewards(db)
        seed_claims(db, users, chores)
        seed_activity(db, users, chores, rewards)
        print("\n=== Seeding complete! ===")
        print("Login PINs:")
        print("  Admin: Γονέας  → 1111")
        print("  Kid:   Μαρία   → 2222")
        print("  Kid:   Γιώργος → 3333")
        print("  Kid:   Ελένη   → 4444")
    finally:
        db.close()


if __name__ == "__main__":
    main()
