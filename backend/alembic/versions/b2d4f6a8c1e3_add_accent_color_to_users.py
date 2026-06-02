"""add accent_color to users

Revision ID: b2d4f6a8c1e3
Revises: a1c3e5f7b9d0
Create Date: 2026-06-02 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b2d4f6a8c1e3'
down_revision: Union[str, Sequence[str], None] = 'a1c3e5f7b9d0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('users', sa.Column('accent_color', sa.String(length=7), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('users', 'accent_color')
