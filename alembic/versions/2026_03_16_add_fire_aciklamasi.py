"""add fire_aciklamasi to orders

Revision ID: 2026_03_16_fire_aciklamasi
Revises: 2026_03_16_folder_opj
Create Date: 2026-03-16
"""

from alembic import op
import sqlalchemy as sa

revision = "2026_03_16_fire_aciklamasi"
down_revision = "2026_03_16_folder_opj"
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
    if _table_exists("orders") and not _column_exists("orders", "fire_aciklamasi"):
        op.add_column(
            "orders",
            sa.Column("fire_aciklamasi", sa.Text(), nullable=True),
        )


def downgrade() -> None:
    if _table_exists("orders") and _column_exists("orders", "fire_aciklamasi"):
        op.drop_column("orders", "fire_aciklamasi")
