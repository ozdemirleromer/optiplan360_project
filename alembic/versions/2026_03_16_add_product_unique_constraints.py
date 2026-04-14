"""add_product_unique_constraints

Revision ID: 2026_03_16_product_unique
Revises: 2026_03_14_remove_payment_order_add_reminders
Create Date: 2026-03-16 00:00:00.000000

MaterialSpec: UNIQUE(product_type_id, color_id, thickness_mm, width_cm, height_cm)
SupplierItem: UNIQUE(spec_id, brand_id)

Karar: TAM_PAKET_SATIS dokumani - MaterialSpec firma-bagimsiz, SupplierItem firma-varianti
"""

from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "2026_03_16_product_unique"
down_revision: Union[str, None] = "2026_03_14_remove_payment_order_add_reminders"
branch_labels = None
depends_on = None


def _is_sqlite() -> bool:
    return op.get_bind().dialect.name == "sqlite"


def _table_exists(table_name: str) -> bool:
    return sa.inspect(op.get_bind()).has_table(table_name)


def upgrade() -> None:
    if _is_sqlite():
        return

    # MaterialSpec: firma-bagimsiz malzeme ozelligi UNIQUE kisitlamasi
    # (product_type_id, color_id, thickness_mm, width_cm, height_cm) kombinasyonu benzersiz olmali
    if _table_exists("material_specs"):
        op.create_unique_constraint(
            "uq_material_spec_combo",
            "material_specs",
            ["product_type_id", "color_id", "thickness_mm", "width_cm", "height_cm"],
        )

    # SupplierItem: ayni spec icin ayni marka birden fazla olamaz
    if _table_exists("supplier_items"):
        op.create_unique_constraint(
            "uq_supplier_item_spec_brand",
            "supplier_items",
            ["spec_id", "brand_id"],
        )


def downgrade() -> None:
    if _is_sqlite():
        return
    if _table_exists("supplier_items"):
        op.drop_constraint("uq_supplier_item_spec_brand", "supplier_items", type_="unique")
    if _table_exists("material_specs"):
        op.drop_constraint("uq_material_spec_combo", "material_specs", type_="unique")
