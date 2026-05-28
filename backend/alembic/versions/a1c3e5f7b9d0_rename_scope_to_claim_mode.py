"""rename chore scope to claim_mode with values each/one

Revision ID: a1c3e5f7b9d0
Revises: 2b257d814b9a
Create Date: 2026-05-29

"""
from alembic import op
import sqlalchemy as sa

revision = 'a1c3e5f7b9d0'
down_revision = '2b257d814b9a'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("chores") as batch_op:
        batch_op.add_column(sa.Column("claim_mode", sa.String(20), nullable=False, server_default="each"))

    op.execute("UPDATE chores SET claim_mode = 'each' WHERE scope = 'individual'")
    op.execute("UPDATE chores SET claim_mode = 'one' WHERE scope = 'pooled'")

    with op.batch_alter_table("chores") as batch_op:
        batch_op.drop_column("scope")


def downgrade():
    with op.batch_alter_table("chores") as batch_op:
        batch_op.add_column(sa.Column("scope", sa.String(20), nullable=False, server_default="individual"))

    op.execute("UPDATE chores SET scope = 'individual' WHERE claim_mode = 'each'")
    op.execute("UPDATE chores SET scope = 'pooled' WHERE claim_mode = 'one'")

    with op.batch_alter_table("chores") as batch_op:
        batch_op.drop_column("claim_mode")
