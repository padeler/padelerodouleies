"""add actor_user_id to history_ledger

Records which admin performed an action (e.g. approved/declined a chore) so the
activity table can show "by whom". Nullable, since not every ledger row comes
from an admin action.

Revision ID: d4e6f8a0b2c4
Revises: b2d4f6a8c1e3
Create Date: 2026-06-04 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd4e6f8a0b2c4'
down_revision: Union[str, Sequence[str], None] = 'b2d4f6a8c1e3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema.

    Added as a plain column without an inline FK constraint: SQLite's ALTER TABLE
    cannot add a constraint (it does not enforce FKs by default), so we follow the
    same pattern as the other ADD COLUMN migrations. The FK is declared on the ORM
    model for relationship resolution.
    """
    op.add_column(
        'history_ledger',
        sa.Column('actor_user_id', sa.Integer(), nullable=True),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('history_ledger', 'actor_user_id')
