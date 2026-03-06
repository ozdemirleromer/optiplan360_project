"""add station fields

Revision ID: 2026_02_16_stations
Revises: 2026_02_14_add_constraints
Create Date: 2026-02-16 18:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "2026_02_16_stations"
down_revision: Union[str, None] = "2026_02_14_add_constraints"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _table_exists(table_name: str) -> bool:
    return sa.inspect(op.get_bind()).has_table(table_name)


def _column_exists(table_name: str, column_name: str) -> bool:
    inspector = sa.inspect(op.get_bind())
    return any(c["name"] == column_name for c in inspector.get_columns(table_name))


def upgrade() -> None:
    if not _table_exists("stations"):
        return

    if not _column_exists("stations", "active"):
        op.add_column("stations", sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.text("1")))
    if not _column_exists("stations", "last_scan_at"):
        op.add_column("stations", sa.Column("last_scan_at", sa.TIMESTAMP(timezone=True), nullable=True))
    if not _column_exists("stations", "scan_count_today"):
        op.add_column("stations", sa.Column("scan_count_today", sa.Integer(), nullable=True, server_default="0"))
    if not _column_exists("stations", "istasyon_durumu"):
        op.add_column("stations", sa.Column("istasyon_durumu", sa.String(), nullable=True, server_default="Hazır"))


def downgrade() -> None:
    if not _table_exists("stations"):
        return

    if _column_exists("stations", "istasyon_durumu"):
        op.drop_column("stations", "istasyon_durumu")
    if _column_exists("stations", "scan_count_today"):
        op.drop_column("stations", "scan_count_today")
    if _column_exists("stations", "last_scan_at"):
        op.drop_column("stations", "last_scan_at")
    if _column_exists("stations", "active"):
        op.drop_column("stations", "active")
