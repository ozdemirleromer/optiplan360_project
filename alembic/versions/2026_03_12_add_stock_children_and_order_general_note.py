"""add_stock_children_and_order_general_note

Revision ID: 2026_03_12_stock_children
Revises: 2026_03_12_system_backbone
Create Date: 2026-03-12 00:30:00.000000
"""

from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "2026_03_12_stock_children"
down_revision: Union[str, None] = "2026_03_12_system_backbone"
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


def _index_exists(table_name: str, index_name: str) -> bool:
    if not _table_exists(table_name):
        return False
    return any(index.get("name") == index_name for index in _inspector().get_indexes(table_name))


def upgrade() -> None:
    if _table_exists("orders") and not _column_exists("orders", "general_note"):
        op.add_column("orders", sa.Column("general_note", sa.Text(), nullable=True))

    if not _table_exists("stock_barcodes"):
        op.create_table(
            "stock_barcodes",
            sa.Column("id", sa.String(), nullable=False),
            sa.Column("stock_card_id", sa.String(), nullable=False),
            sa.Column("barcode", sa.String(), nullable=False),
            sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.func.now(), nullable=True),
            sa.Column(
                "updated_at",
                sa.TIMESTAMP(timezone=True),
                server_default=sa.func.now(),
                nullable=True,
            ),
            sa.ForeignKeyConstraint(["stock_card_id"], ["stock_cards.id"]),
            sa.PrimaryKeyConstraint("id"),
        )

    if not _table_exists("stock_prices"):
        op.create_table(
            "stock_prices",
            sa.Column("id", sa.String(), nullable=False),
            sa.Column("stock_card_id", sa.String(), nullable=False),
            sa.Column("price_type", sa.String(), nullable=False),
            sa.Column("amount", sa.Numeric(12, 2), nullable=False),
            sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.func.now(), nullable=True),
            sa.Column(
                "updated_at",
                sa.TIMESTAMP(timezone=True),
                server_default=sa.func.now(),
                nullable=True,
            ),
            sa.ForeignKeyConstraint(["stock_card_id"], ["stock_cards.id"]),
            sa.PrimaryKeyConstraint("id"),
        )

    indexes = (
        ("stock_barcodes", "ix_stock_barcodes_stock_card_id", ["stock_card_id"], False),
        ("stock_barcodes", "ux_stock_barcodes_barcode", ["barcode"], True),
        ("stock_prices", "ix_stock_prices_stock_card_id", ["stock_card_id"], False),
        ("stock_prices", "ix_stock_prices_stock_card_price_type", ["stock_card_id", "price_type"], True),
    )
    for table_name, index_name, columns, unique in indexes:
        if _table_exists(table_name) and not _index_exists(table_name, index_name):
            op.create_index(index_name, table_name, columns, unique=unique)


def downgrade() -> None:
    indexes = (
        ("stock_prices", "ix_stock_prices_stock_card_price_type"),
        ("stock_prices", "ix_stock_prices_stock_card_id"),
        ("stock_barcodes", "ux_stock_barcodes_barcode"),
        ("stock_barcodes", "ix_stock_barcodes_stock_card_id"),
    )
    for table_name, index_name in indexes:
        if _index_exists(table_name, index_name):
            op.drop_index(index_name, table_name=table_name)

    if _table_exists("stock_prices"):
        op.drop_table("stock_prices")
    if _table_exists("stock_barcodes"):
        op.drop_table("stock_barcodes")
    if _table_exists("orders") and _column_exists("orders", "general_note"):
        op.drop_column("orders", "general_note")
