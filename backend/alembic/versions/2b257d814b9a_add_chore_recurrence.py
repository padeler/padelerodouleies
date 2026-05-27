"""add chore recurrence columns

Revision ID: 2b257d814b9a
Revises: c351be147975
Create Date: 2025-05-27
"""
from alembic import op
import sqlalchemy as sa

revision = '2b257d814b9a'
down_revision = '3f71d342a7c0'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('chores', sa.Column('repeat_days', sa.JSON(), nullable=True))
    op.add_column('chores', sa.Column('n_day_interval', sa.Integer(), nullable=True))


def downgrade():
    op.drop_column('chores', 'n_day_interval')
    op.drop_column('chores', 'repeat_days')
