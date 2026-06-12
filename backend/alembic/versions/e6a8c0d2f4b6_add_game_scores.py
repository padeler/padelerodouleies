"""add game_scores table

Per-user best score for each Games-tab mini-game (memory.easy/medium/hard,
simon, catcher). One row per (user, game), updated only when the new score
beats the stored best.

Revision ID: e6a8c0d2f4b6
Revises: d4e6f8a0b2c4
Create Date: 2026-06-12 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e6a8c0d2f4b6'
down_revision: Union[str, Sequence[str], None] = 'd4e6f8a0b2c4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'game_scores',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('game', sa.String(length=40), nullable=False),
        sa.Column('best_score', sa.Integer(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'game', name='uq_game_scores_user_game'),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table('game_scores')
