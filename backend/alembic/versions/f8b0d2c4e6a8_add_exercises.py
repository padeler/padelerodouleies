"""add exercises: users.birthdate + exercise_attempts + exercise_completions

Supports the age-targeted exercises feature. ``users.birthdate`` is an
admin-set nullable Date driving age targeting. ``exercise_attempts`` is an
append-only log of every submitted answer; ``exercise_completions`` records the
one-time star award per (user, bundle, version) and links it to its history
ledger row.

Revision ID: f8b0d2c4e6a8
Revises: e6a8c0d2f4b6
Create Date: 2026-06-17 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f8b0d2c4e6a8'
down_revision: Union[str, Sequence[str], None] = 'e6a8c0d2f4b6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('users', sa.Column('birthdate', sa.Date(), nullable=True))

    op.create_table(
        'exercise_attempts',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('bundle_id', sa.String(length=80), nullable=False),
        sa.Column('bundle_version', sa.Integer(), nullable=False),
        sa.Column('exercise_id', sa.String(length=40), nullable=False),
        sa.Column('response_json', sa.JSON(), nullable=False),
        sa.Column('correct', sa.Boolean(), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table(
        'exercise_completions',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('bundle_id', sa.String(length=80), nullable=False),
        sa.Column('bundle_version', sa.Integer(), nullable=False),
        sa.Column('stars_awarded', sa.Integer(), nullable=False),
        sa.Column('history_ledger_id', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.ForeignKeyConstraint(['history_ledger_id'], ['history_ledger.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'bundle_id', 'bundle_version', name='uq_exercise_completion'),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table('exercise_completions')
    op.drop_table('exercise_attempts')
    op.drop_column('users', 'birthdate')
