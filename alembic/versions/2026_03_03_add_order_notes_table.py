"""add_order_notes_table

Revision ID: 2026_03_03_add_order_notes
Revises: 2026_02_19_price_tracking_tables
Create Date: 2026-03-03 00:00:00.000000
"""

from typing import Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "2026_03_03_add_order_notes"
down_revision: Union[str, None] = "2026_02_19_price_tracking_tables"
branch_labels = None
depends_on = None


def _inspector() -> sa.Inspector:
    return sa.inspect(op.get_bind())


def _table_exists(table_name: str) -> bool:
    return _inspector().has_table(table_name)


def _index_exists(table_name: str, index_name: str) -> bool:
    if not _table_exists(table_name):
        return False
    return any(idx.get("name") == index_name for idx in _inspector().get_indexes(table_name))


def upgrade() -> None:
    if not (_table_exists("orders") and _table_exists("users")):
        return

    if not _table_exists("order_notes"):
        op.create_table(
            "order_notes",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("order_id", sa.Integer(), sa.ForeignKey("orders.id", ondelete="CASCADE"), nullable=False),
            sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
            sa.Column("note_text", sa.Text(), nullable=False),
            sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.func.now(), nullable=True),
            sa.Column("updated_at", sa.TIMESTAMP(timezone=True), nullable=True),
            sa.PrimaryKeyConstraint("id"),
        )

    if not _index_exists("order_notes", "ix_order_notes_order_id"):
        op.create_index("ix_order_notes_order_id", "order_notes", ["order_id"])
    if not _index_exists("order_notes", "ix_order_notes_user_id"):
        op.create_index("ix_order_notes_user_id", "order_notes", ["user_id"])


def downgrade() -> None:
    if _index_exists("order_notes", "ix_order_notes_user_id"):
        op.drop_index("ix_order_notes_user_id", table_name="order_notes")
    if _index_exists("order_notes", "ix_order_notes_order_id"):
        op.drop_index("ix_order_notes_order_id", table_name="order_notes")
    if _table_exists("order_notes"):
        op.drop_table("order_notes")
