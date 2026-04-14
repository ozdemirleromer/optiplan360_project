"""add_folder_setting_opj_fields

Revision ID: 2026_03_16_folder_opj
Revises: 2026_03_16_phase3_order
Create Date: 2026-03-16

OptiPlanFolderSetting tablosuna eksik 2 alan eklendi:
  - opj_cikti_klasoru : OPJ çıktı klasörü yolu
  - opj_aktif_mi      : OPJ export aktif mi (varsayılan: False)
"""

from alembic import op
import sqlalchemy as sa

revision = "2026_03_16_folder_opj"
down_revision = "2026_03_16_phase3_order"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "optiplan_folder_settings",
        sa.Column("opj_cikti_klasoru", sa.String(), nullable=False, server_default=""),
    )
    op.add_column(
        "optiplan_folder_settings",
        sa.Column("opj_aktif_mi", sa.Boolean(), nullable=False, server_default="false"),
    )


def downgrade() -> None:
    op.drop_column("optiplan_folder_settings", "opj_aktif_mi")
    op.drop_column("optiplan_folder_settings", "opj_cikti_klasoru")
