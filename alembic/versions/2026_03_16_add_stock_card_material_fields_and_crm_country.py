"""add stock_card material fields and crm_account country/tax_id_type

Revision ID: 2026_03_16_stock_crm_fields
Revises: 2026_03_16_order_prices
Create Date: 2026-03-16

stock_cards:
  - material_type VARCHAR(50)  -- "MDF", "LAM", "SUNTALAM", "CAM", vb.
  - width_mm      FLOAT        -- Ebat genişlik (mm)
  - height_mm     FLOAT        -- Ebat yükseklik (mm)

crm_accounts:
  - country       VARCHAR(100) DEFAULT 'Türkiye'
  - tax_id_type   VARCHAR(20)  DEFAULT 'VERGI_NO'  -- "VERGI_NO" veya "TCKN"
"""

from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "2026_03_16_stock_crm_fields"
down_revision: Union[str, None] = "2026_03_16_order_prices"
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
    # stock_cards: malzeme tipi ve ebat alanları
    if _table_exists("stock_cards"):
        if not _column_exists("stock_cards", "material_type"):
            op.add_column(
                "stock_cards",
                sa.Column("material_type", sa.String(50), nullable=True),
            )
        if not _column_exists("stock_cards", "width_mm"):
            op.add_column(
                "stock_cards",
                sa.Column("width_mm", sa.Float(), nullable=True),
            )
        if not _column_exists("stock_cards", "height_mm"):
            op.add_column(
                "stock_cards",
                sa.Column("height_mm", sa.Float(), nullable=True),
            )

    # crm_accounts: ülke ve vergi kimlik tipi
    if _table_exists("crm_accounts"):
        if not _column_exists("crm_accounts", "country"):
            op.add_column(
                "crm_accounts",
                sa.Column("country", sa.String(100), nullable=True, server_default="Türkiye"),
            )
        if not _column_exists("crm_accounts", "tax_id_type"):
            op.add_column(
                "crm_accounts",
                sa.Column(
                    "tax_id_type", sa.String(20), nullable=True, server_default="VERGI_NO"
                ),
            )


def downgrade() -> None:
    if _table_exists("crm_accounts"):
        if _column_exists("crm_accounts", "tax_id_type"):
            op.drop_column("crm_accounts", "tax_id_type")
        if _column_exists("crm_accounts", "country"):
            op.drop_column("crm_accounts", "country")
    if _table_exists("stock_cards"):
        if _column_exists("stock_cards", "height_mm"):
            op.drop_column("stock_cards", "height_mm")
        if _column_exists("stock_cards", "width_mm"):
            op.drop_column("stock_cards", "width_mm")
        if _column_exists("stock_cards", "material_type"):
            op.drop_column("stock_cards", "material_type")
