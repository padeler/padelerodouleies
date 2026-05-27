"""single title and unique username

Revision ID: c351be147975
Revises: 3cb87a5b225c
Create Date: 2026-05-27 14:29:13.573117

- Replace title_el/title_en with single 'title' on chores and rewards
- Replace description_el/description_en with single 'description'
- Add unique constraint on users.name
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'c351be147975'
down_revision: Union[str, Sequence[str], None] = '3cb87a5b225c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    ctx = op.get_context()

    with op.batch_alter_table("chores") as batch:
        batch.alter_column("title_el", new_column_name="title")
        batch.alter_column("description_el", new_column_name="description")
        batch.drop_column("title_en")
        batch.drop_column("description_en")

    with op.batch_alter_table("rewards") as batch:
        batch.alter_column("title_el", new_column_name="title")
        batch.alter_column("description_el", new_column_name="description")
        batch.drop_column("title_en")
        batch.drop_column("description_en")

    with op.batch_alter_table("users") as batch:
        batch.create_unique_constraint("uq_users_name", ["name"])


def downgrade() -> None:
    with op.batch_alter_table("users") as batch:
        batch.drop_constraint("uq_users_name", type_="unique")

    with op.batch_alter_table("rewards") as batch:
        batch.add_column("title_en", sa.String(length=200, nullable=True))
        batch.add_column("description_en", sa.String(length=500, nullable=True))
        batch.alter_column("title", new_column_name="title_el")
        batch.alter_column("description", new_column_name="description_el")

    with op.batch_alter_table("chores") as batch:
        batch.add_column("title_en", sa.String(length=200, nullable=True))
        batch.add_column("description_en", sa.String(length=500, nullable=True))
        batch.alter_column("title", new_column_name="title_el")
        batch.alter_column("description", new_column_name="description_el")
