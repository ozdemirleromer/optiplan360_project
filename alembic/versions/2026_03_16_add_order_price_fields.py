"""add price fields to orders

Revision ID: 2026_03_16_order_prices
Revises: 2026_03_16_fire_aciklamasi
Create Date: 2026-03-16
"""

from alembic import op
import sqlalchemy as sa

revision = "2026_03_16_order_prices"
down_revision = "2026_03_16_fire_aciklamasi"
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
    if not _table_exists("orders"):
        return
    if not _column_exists("orders", "birim_fiyat"):
        op.add_column("orders", sa.Column("birim_fiyat", sa.Numeric(12, 2), nullable=True))
    if not _column_exists("orders", "iskonto_orani"):
        op.add_column("orders", sa.Column("iskonto_orani", sa.Numeric(5, 2), nullable=True, server_default="0"))
    if not _column_exists("orders", "kur"):
        op.add_column("orders", sa.Column("kur", sa.String(3), nullable=True, server_default="TRY"))
    if not _column_exists("orders", "kdv_orani"):
        op.add_column("orders", sa.Column("kdv_orani", sa.Numeric(5, 2), nullable=True, server_default="18"))


def downgrade() -> None:
    if not _table_exists("orders"):
        return
    if _column_exists("orders", "kdv_orani"):
        op.drop_column("orders", "kdv_orani")
    if _column_exists("orders", "kur"):
        op.drop_column("orders", "kur")
    if _column_exists("orders", "iskonto_orani"):
        op.drop_column("orders", "iskonto_orani")
    if _column_exists("orders", "birim_fiyat"):
        op.drop_column("orders", "birim_fiyat")
