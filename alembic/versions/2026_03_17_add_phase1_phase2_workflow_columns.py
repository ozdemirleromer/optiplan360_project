"""add Phase 1/2 workflow columns

Phase 1: dosya_boyutu, isleme_kilidi, kilid_zamani, retry timing, OCR provider tracking
Phase 2: per-cell BOY/EN/ADET approval, operator override, bbox, audit user tracking

Revision ID: 2026_03_17_phase1_phase2_cols
Revises: 2026_03_16_stock_crm_fields
Create Date: 2026-03-17
"""

from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "2026_03_17_phase1_phase2_cols"
down_revision: Union[str, None] = "2026_03_16_stock_crm_fields"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── WorkflowKayit: Phase 1 pipeline tracking ──
    op.add_column(
        "optiplan_workflow_kayitlari",
        sa.Column("dosya_boyutu", sa.Integer(), nullable=True),
    )
    op.add_column(
        "optiplan_workflow_kayitlari",
        sa.Column("isleme_kilidi", sa.String(), nullable=True),
    )
    op.add_column(
        "optiplan_workflow_kayitlari",
        sa.Column("kilid_zamani", sa.TIMESTAMP(timezone=True), nullable=True),
    )
    op.add_column(
        "optiplan_workflow_kayitlari",
        sa.Column("son_deneme_zamani", sa.TIMESTAMP(timezone=True), nullable=True),
    )
    op.add_column(
        "optiplan_workflow_kayitlari",
        sa.Column("sonraki_deneme_zamani", sa.TIMESTAMP(timezone=True), nullable=True),
    )
    op.add_column(
        "optiplan_workflow_kayitlari",
        sa.Column("son_hata_mesaji", sa.Text(), nullable=True),
    )
    op.add_column(
        "optiplan_workflow_kayitlari",
        sa.Column("ocr_saglayici", sa.String(), nullable=True),
    )
    op.add_column(
        "optiplan_workflow_kayitlari",
        sa.Column("ocr_islem_suresi_ms", sa.Integer(), nullable=True),
    )

    # ── WorkflowSatir: Phase 2 per-cell approval ──
    op.add_column(
        "optiplan_workflow_satirlari",
        sa.Column("boy_onay", sa.String(), nullable=False, server_default="BEKLEMEDE"),
    )
    op.add_column(
        "optiplan_workflow_satirlari",
        sa.Column("en_onay", sa.String(), nullable=False, server_default="BEKLEMEDE"),
    )
    op.add_column(
        "optiplan_workflow_satirlari",
        sa.Column("adet_onay", sa.String(), nullable=False, server_default="BEKLEMEDE"),
    )
    op.add_column(
        "optiplan_workflow_satirlari",
        sa.Column("boy_operator_degeri", sa.Integer(), nullable=True),
    )
    op.add_column(
        "optiplan_workflow_satirlari",
        sa.Column("en_operator_degeri", sa.Integer(), nullable=True),
    )
    op.add_column(
        "optiplan_workflow_satirlari",
        sa.Column("adet_operator_degeri", sa.Integer(), nullable=True),
    )
    op.add_column(
        "optiplan_workflow_satirlari",
        sa.Column("onaylayan_id", sa.Integer(), nullable=True),
    )
    op.add_column(
        "optiplan_workflow_satirlari",
        sa.Column("onay_zamani", sa.TIMESTAMP(timezone=True), nullable=True),
    )
    op.add_column(
        "optiplan_workflow_satirlari",
        sa.Column("bbox_json", sa.JSON(), nullable=True),
    )

    # ── CikarilanSatir: mirror for restore ──
    op.add_column(
        "optiplan_workflow_cikarilan_satirlar",
        sa.Column("boy_onay", sa.String(), nullable=False, server_default="BEKLEMEDE"),
    )
    op.add_column(
        "optiplan_workflow_cikarilan_satirlar",
        sa.Column("en_onay", sa.String(), nullable=False, server_default="BEKLEMEDE"),
    )
    op.add_column(
        "optiplan_workflow_cikarilan_satirlar",
        sa.Column("adet_onay", sa.String(), nullable=False, server_default="BEKLEMEDE"),
    )
    op.add_column(
        "optiplan_workflow_cikarilan_satirlar",
        sa.Column("boy_operator_degeri", sa.Integer(), nullable=True),
    )
    op.add_column(
        "optiplan_workflow_cikarilan_satirlar",
        sa.Column("en_operator_degeri", sa.Integer(), nullable=True),
    )
    op.add_column(
        "optiplan_workflow_cikarilan_satirlar",
        sa.Column("adet_operator_degeri", sa.Integer(), nullable=True),
    )
    op.add_column(
        "optiplan_workflow_cikarilan_satirlar",
        sa.Column("onaylayan_id", sa.Integer(), nullable=True),
    )
    op.add_column(
        "optiplan_workflow_cikarilan_satirlar",
        sa.Column("onay_zamani", sa.TIMESTAMP(timezone=True), nullable=True),
    )
    op.add_column(
        "optiplan_workflow_cikarilan_satirlar",
        sa.Column("bbox_json", sa.JSON(), nullable=True),
    )

    # ── Audit: user tracking ──
    op.add_column(
        "optiplan_workflow_audit_kayitlari",
        sa.Column("user_id", sa.Integer(), nullable=True),
    )
    op.add_column(
        "optiplan_workflow_audit_kayitlari",
        sa.Column("islem_tipi", sa.String(), nullable=True),
    )

    # ── Hata: retry + provider tracking ──
    op.add_column(
        "optiplan_workflow_hata_kayitlari",
        sa.Column("deneme_no", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "optiplan_workflow_hata_kayitlari",
        sa.Column("saglayici", sa.String(), nullable=True),
    )


def downgrade() -> None:
    # Hata
    op.drop_column("optiplan_workflow_hata_kayitlari", "saglayici")
    op.drop_column("optiplan_workflow_hata_kayitlari", "deneme_no")

    # Audit
    op.drop_column("optiplan_workflow_audit_kayitlari", "islem_tipi")
    op.drop_column("optiplan_workflow_audit_kayitlari", "user_id")

    # CikarilanSatir
    op.drop_column("optiplan_workflow_cikarilan_satirlar", "bbox_json")
    op.drop_column("optiplan_workflow_cikarilan_satirlar", "onay_zamani")
    op.drop_column("optiplan_workflow_cikarilan_satirlar", "onaylayan_id")
    op.drop_column("optiplan_workflow_cikarilan_satirlar", "adet_operator_degeri")
    op.drop_column("optiplan_workflow_cikarilan_satirlar", "en_operator_degeri")
    op.drop_column("optiplan_workflow_cikarilan_satirlar", "boy_operator_degeri")
    op.drop_column("optiplan_workflow_cikarilan_satirlar", "adet_onay")
    op.drop_column("optiplan_workflow_cikarilan_satirlar", "en_onay")
    op.drop_column("optiplan_workflow_cikarilan_satirlar", "boy_onay")

    # Satir
    op.drop_column("optiplan_workflow_satirlari", "bbox_json")
    op.drop_column("optiplan_workflow_satirlari", "onay_zamani")
    op.drop_column("optiplan_workflow_satirlari", "onaylayan_id")
    op.drop_column("optiplan_workflow_satirlari", "adet_operator_degeri")
    op.drop_column("optiplan_workflow_satirlari", "en_operator_degeri")
    op.drop_column("optiplan_workflow_satirlari", "boy_operator_degeri")
    op.drop_column("optiplan_workflow_satirlari", "adet_onay")
    op.drop_column("optiplan_workflow_satirlari", "en_onay")
    op.drop_column("optiplan_workflow_satirlari", "boy_onay")

    # Kayit
    op.drop_column("optiplan_workflow_kayitlari", "ocr_islem_suresi_ms")
    op.drop_column("optiplan_workflow_kayitlari", "ocr_saglayici")
    op.drop_column("optiplan_workflow_kayitlari", "son_hata_mesaji")
    op.drop_column("optiplan_workflow_kayitlari", "sonraki_deneme_zamani")
    op.drop_column("optiplan_workflow_kayitlari", "son_deneme_zamani")
    op.drop_column("optiplan_workflow_kayitlari", "kilid_zamani")
    op.drop_column("optiplan_workflow_kayitlari", "isleme_kilidi")
    op.drop_column("optiplan_workflow_kayitlari", "dosya_boyutu")
