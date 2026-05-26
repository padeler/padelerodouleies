"""Database schema tests using in-memory SQLite."""

from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session, sessionmaker

from app.db.models import Base, Chore, Reward, User


def _get_in_memory_session() -> Session:
    """Create an in-memory SQLite DB with all tables."""
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    return Session(engine)


def test_users_table_structure() -> None:
    session = _get_in_memory_session()
    user = User(name="Admin", role="admin", avatar_value="shield", current_stars=0)
    session.add(user)
    session.commit()
    assert user.id is not None
    assert user.is_active is True
    assert user.preferred_locale == "el"
    assert user.failed_pin_attempts == 0
    assert user.locked_until is None


def test_chore_table_structure() -> None:
    session = _get_in_memory_session()
    chore = Chore(
        title_el="Βούρτσισμα Δοντιών",
        title_en="Brush Teeth",
        icon_name="tooth",
        scope="individual",
        points_value=5,
        is_repeating=True,
        is_active=True,
    )
    session.add(chore)
    session.commit()
    assert chore.id is not None
    assert chore.description_el is None
    assert chore.is_active is True


def test_reward_table_structure() -> None:
    session = _get_in_memory_session()
    reward = Reward(
        title_el="Ώρα Screen Time",
        title_en="Screen Time Hour",
        icon_name="monitor",
        cost_stars=20,
        is_collaborative=False,
        is_enabled=True,
    )
    session.add(reward)
    session.commit()
    assert reward.id is not None
    assert reward.is_enabled is True


def test_seed_users_and_query() -> None:
    """Seed 2 kids, 1 admin, 2 chores, 1 reward; verify queries."""
    session = _get_in_memory_session()

    admin = User(name="Parent", role="admin", avatar_value="shield", current_stars=0)
    kid1 = User(name="Elina", role="user", avatar_value="fox", current_stars=10)
    kid2 = User(name="Sofia", role="user", avatar_value="unicorn", current_stars=5)
    session.add_all([admin, kid1, kid2])
    session.commit()

    chore1 = Chore(title_el="Πρωινό", title_en="Morning", icon_name="sun", scope="individual", points_value=5, is_repeating=True, is_active=True)
    chore2 = Chore(title_el="Δishes", title_en="Dishes", icon_name="plate", scope="pooled", points_value=10, is_repeating=True, is_active=True)
    session.add_all([chore1, chore2])
    session.commit()

    reward1 = Reward(title_el="Προσομοίωση", title_en="Doll", icon_name="gift", cost_stars=30, is_collaborative=False, is_enabled=True)
    session.add(reward1)
    session.commit()

    assert session.query(User).filter_by(role="user").count() == 2
    assert session.query(User).filter_by(role="admin").count() == 1
    assert session.query(Chore).filter_by(is_active=True).count() == 2
    assert session.query(Reward).count() == 1
    assert session.query(User).filter_by(name="Elina").first().current_stars == 10
