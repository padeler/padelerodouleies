"""Populate the database with dummy data for testing.

Usage:
    cd backend && python scripts/seed_dummy.py

This will clear all existing data, run migrations, and insert:
- 1 admin (PIN: 1111)
- 3 kids (PIN: 2222, 3333, 4444)
- 14 chores (daily, weekly, every-N-days)
- 8 rewards (individual + collaborative)
- 4 pending claims (kids have claimed chores awaiting approval)
- 8 history ledger entries (sample activity)

Run `alembic upgrade head` manually first if migrations are behind.
"""

import sys
from datetime import datetime, time, timedelta

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
            scope="individual",
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
            scope="individual",
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
            scope="individual",
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
            scope="individual",
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
            scope="individual",
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
            scope="individual",
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
            scope="individual",
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
            scope="pooled",
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
            scope="individual",
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
            scope="pooled",
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
            scope="individual",
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
            scope="individual",
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
            scope="individual",
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
            scope="individual",
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
    """Create pending claims for kids on active individual chores."""
    maria, giorgos, eleni = users[1], users[2], users[3]
    active_individual = [c for c in chores if c.is_active and c.scope == "individual"]
    active_pooled = [c for c in chores if c.is_active and c.scope == "pooled"]

    claims = [
        PendingClaim(user_id=maria.id, chore_id=active_individual[0].id),
        PendingClaim(user_id=giorgos.id, chore_id=active_individual[1].id),
        PendingClaim(user_id=eleni.id, chore_id=active_individual[0].id),
        PendingClaim(user_id=maria.id, chore_id=active_individual[4].id),
    ]
    if active_pooled:
        claims.append(PendingClaim(user_id=giorgos.id, chore_id=active_pooled[0].id))
    for c in claims:
        db.add(c)
    db.commit()
    print(f"Seeded {len(claims)} pending claims.")
    return claims


def seed_history(db, users, chores, rewards):
    """Create sample history ledger entries."""
    maria, giorgos, eleni = users[1], users[2], users[3]
    now = datetime.now()

    entries = [
        HistoryLedger(
            user_id=maria.id,
            action_type="chore_approved",
            points_delta=5,
            ref_table="chore",
            ref_id=chores[0].id,
            timestamp=now - timedelta(hours=2),
        ),
        HistoryLedger(
            user_id=maria.id,
            action_type="chore_approved",
            points_delta=3,
            ref_table="chore",
            ref_id=chores[1].id,
            timestamp=now - timedelta(hours=5),
        ),
        HistoryLedger(
            user_id=giorgos.id,
            action_type="chore_approved",
            points_delta=10,
            ref_table="chore",
            ref_id=chores[6].id,
            timestamp=now - timedelta(hours=1),
        ),
        HistoryLedger(
            user_id=eleni.id,
            action_type="chore_approved",
            points_delta=8,
            ref_table="chore",
            ref_id=chores[2].id,
            timestamp=now - timedelta(hours=3),
        ),
        HistoryLedger(
            user_id=giorgos.id,
            action_type="manual_adjust",
            points_delta=10,
            admin_note="Εξαιρετική βοήθεια σε μεγάλη δουλειά",
            timestamp=now - timedelta(hours=8),
        ),
        HistoryLedger(
            user_id=maria.id,
            action_type="reward_purchase",
            points_delta=-15,
            ref_table="reward",
            ref_id=rewards[1].id,
            timestamp=now - timedelta(days=1),
            admin_note="Αγορά κινούμενων σχεδίων",
        ),
        HistoryLedger(
            user_id=eleni.id,
            action_type="chore_declined",
            points_delta=-5,
            ref_table="chore",
            ref_id=chores[0].id,
            admin_note="Δεν ολοκληρώθηκε σωστά",
            timestamp=now - timedelta(days=2),
        ),
        HistoryLedger(
            user_id=giorgos.id,
            action_type="chore_approved",
            points_delta=4,
            ref_table="chore",
            ref_id=chores[3].id,
            timestamp=now - timedelta(days=1),
        ),
    ]
    for e in entries:
        db.add(e)
    db.commit()
    print(f"Seeded {len(entries)} history entries.")


def seed_collaborative_ledger(db, users, rewards):
    """Add some contributions to collaborative rewards."""
    maria, giorgos, eleni = users[1], users[2], users[3]
    collab_rewards = [r for r in rewards if r.is_collaborative]
    now = datetime.now()

    ledger_entries = [
        RewardLedger(
            reward_id=collab_rewards[0].id,
            user_id=maria.id,
            status="claimed",
            stars_contributed=30,
            claimed_at=now - timedelta(days=3),
        ),
        RewardLedger(
            reward_id=collab_rewards[0].id,
            user_id=giorgos.id,
            status="claimed",
            stars_contributed=25,
            claimed_at=now - timedelta(days=2),
        ),
        RewardLedger(
            reward_id=collab_rewards[1].id,
            user_id=eleni.id,
            status="claimed",
            stars_contributed=40,
            claimed_at=now - timedelta(days=1),
        ),
    ]
    for e in ledger_entries:
        db.add(e)
    db.commit()
    print(f"Seeded {len(ledger_entries)} collaborative reward ledger entries.")


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
        seed_history(db, users, chores, rewards)
        seed_collaborative_ledger(db, users, rewards)
        print("\n=== Seeding complete! ===")
        print("Login PINs:")
        print("  Admin: Γονέας  → 1111")
        print("  Kid:   Μαρία   → 2222  (45 stars)")
        print("  Kid:   Γιώργος → 3333  (32 stars)")
        print("  Kid:   Ελένη   → 4444  (18 stars)")
    finally:
        db.close()


if __name__ == "__main__":
    main()
