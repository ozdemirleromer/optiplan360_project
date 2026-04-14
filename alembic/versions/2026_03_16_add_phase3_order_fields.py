"""add_phase3_order_fields

Revision ID: 2026_03_16_phase3_order
Revises: 2026_03_16_product_unique
Create Date: 2026-03-16 12:00:00.000000

Phase 3 OrderEntry: siparis_no, termin, bant_kalinligi, grain_varsayilan, cari_kodu, stok_kodu
Master karar: optiplan_nihai_profesyonel_master_uygulama_promptu.md §16
"""

from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "2026_03_16_phase3_order"
down_revision: Union[str, None] = "2026_03_16_product_unique"
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
    if not _table_exists("orders"):
        return

    if not _column_exists("orders", "siparis_no"):
        op.add_column("orders", sa.Column("siparis_no", sa.String(), nullable=True))
    if not _column_exists("orders", "termin"):
        op.add_column("orders", sa.Column("termin", sa.TIMESTAMP(timezone=True), nullable=True))
    if not _column_exists("orders", "bant_kalinligi"):
        op.add_column("orders", sa.Column("bant_kalinligi", sa.String(), nullable=True))
    if not _column_exists("orders", "grain_varsayilan"):
        op.add_column(
            "orders",
            sa.Column("grain_varsayilan", sa.Integer(), nullable=True, server_default="0"),
        )
    if not _column_exists("orders", "cari_kodu"):
        op.add_column("orders", sa.Column("cari_kodu", sa.String(), nullable=True))
    if not _index_exists("orders", "ix_orders_cari_kodu"):
        op.create_index("ix_orders_cari_kodu", "orders", ["cari_kodu"])
    if not _column_exists("orders", "stok_kodu"):
        op.add_column("orders", sa.Column("stok_kodu", sa.String(), nullable=True))
    if not _index_exists("orders", "ix_orders_stok_kodu"):
        op.create_index("ix_orders_stok_kodu", "orders", ["stok_kodu"])


def downgrade() -> None:
    if not _table_exists("orders"):
        return

    if _index_exists("orders", "ix_orders_stok_kodu"):
        op.drop_index("ix_orders_stok_kodu", table_name="orders")
    if _column_exists("orders", "stok_kodu"):
        op.drop_column("orders", "stok_kodu")
    if _index_exists("orders", "ix_orders_cari_kodu"):
        op.drop_index("ix_orders_cari_kodu", table_name="orders")
    if _column_exists("orders", "cari_kodu"):
        op.drop_column("orders", "cari_kodu")
    if _column_exists("orders", "grain_varsayilan"):
        op.drop_column("orders", "grain_varsayilan")
    if _column_exists("orders", "bant_kalinligi"):
        op.drop_column("orders", "bant_kalinligi")
    if _column_exists("orders", "termin"):
        op.drop_column("orders", "termin")
    if _column_exists("orders", "siparis_no"):
        op.drop_column("orders", "siparis_no")
