"""add_order_header_fields

Revision ID: 2026_03_13_order_header
Revises: 2026_03_12_stock_children
Create Date: 2026-03-13 00:00:00.000000
"""

from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "2026_03_13_order_header"
down_revision: Union[str, None] = "2026_03_12_stock_children"
branch_labels = None
depends_on = None


def _inspector() -> sa.Inspector:
    return sa.inspect(op.get_bind())


def _table_exists(table_name: str) -> bool:
    return _inspector().has_table(table_name)


def _column_exists(table_name: str, column_name: str) -> bool:
    if not _table_exists(table_name):
        return False
    return any(column.get("name") == column_name for column in _inspector().get_columns(table_name))


def upgrade() -> None:
    if _table_exists("orders"):
        if not _column_exists("orders", "delivery_date"):
            op.add_column("orders", sa.Column("delivery_date", sa.TIMESTAMP(timezone=True), nullable=True))
        if not _column_exists("orders", "delivery_address"):
            op.add_column("orders", sa.Column("delivery_address", sa.Text(), nullable=True))
        if not _column_exists("orders", "payment_method"):
            op.add_column("orders", sa.Column("payment_method", sa.String(), nullable=True))


def downgrade() -> None:
    if _table_exists("orders"):
        if _column_exists("orders", "payment_method"):
            op.drop_column("orders", "payment_method")
        if _column_exists("orders", "delivery_address"):
            op.drop_column("orders", "delivery_address")
        if _column_exists("orders", "delivery_date"):
            op.drop_column("orders", "delivery_date")
