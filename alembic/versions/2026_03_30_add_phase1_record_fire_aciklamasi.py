"""add fire_aciklamasi to phase1_records

Revision ID: 2026_03_30_phase1_record_fire_aciklamasi
Revises: 2026_03_18_crm_quote_document_no
Create Date: 2026-03-30 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa

revision = "2026_03_30_phase1_record_fire_aciklamasi"
down_revision = "2026_03_18_crm_quote_document_no"
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
    if _table_exists("phase1_records") and not _column_exists("phase1_records", "fire_aciklamasi"):
        op.add_column(
            "phase1_records",
            sa.Column("fire_aciklamasi", sa.Text(), nullable=True),
        )


def downgrade() -> None:
    if _table_exists("phase1_records") and _column_exists("phase1_records", "fire_aciklamasi"):
        op.drop_column("phase1_records", "fire_aciklamasi")
