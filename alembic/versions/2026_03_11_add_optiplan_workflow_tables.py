"""add_optiplan_workflow_tables

Revision ID: 2026_03_11_optiplan_workflow
Revises: 2026_03_03_add_order_notes
Create Date: 2026-03-11 00:00:00.000000
"""

from typing import Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "2026_03_11_optiplan_workflow"
down_revision: Union[str, None] = "2026_03_03_add_order_notes"
branch_labels = None
depends_on = None


def _inspector() -> sa.Inspector:
    return sa.inspect(op.get_bind())


def _table_exists(table_name: str) -> bool:
    return _inspector().has_table(table_name)


def _index_exists(table_name: str, index_name: str) -> bool:
    if not _table_exists(table_name):
        return False
    return any(index.get("name") == index_name for index in _inspector().get_indexes(table_name))


def _column_exists(table_name: str, column_name: str) -> bool:
    if not _table_exists(table_name):
        return False
    return any(column.get("name") == column_name for column in _inspector().get_columns(table_name))


def upgrade() -> None:
    if not _table_exists("optiplan_folder_settings"):
        op.create_table(
            "optiplan_folder_settings",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("whatsapp_raw_klasoru", sa.String(), nullable=False),
            sa.Column("scanner_raw_klasoru", sa.String(), nullable=False),
            sa.Column("manuel_raw_klasoru", sa.String(), nullable=False),
            sa.Column("email_raw_klasoru", sa.String(), nullable=False),
            sa.Column("islenmis_klasoru", sa.String(), nullable=False),
            sa.Column("arsiv_klasoru", sa.String(), nullable=False),
            sa.Column("xml_okuma_klasoru", sa.String(), nullable=False),
            sa.Column("xlsx_cikti_klasoru", sa.String(), nullable=False),
            sa.Column("hatali_klasoru", sa.String(), nullable=False),
            sa.Column("fis_evrak_no_formati", sa.String(), nullable=False),
            sa.Column("arsiv_zaman_damgasi_formati", sa.String(), nullable=False),
            sa.Column("xlsx_aktif_mi", sa.Boolean(), nullable=False),
            sa.Column("watcher_aktif_mi", sa.Boolean(), nullable=False),
            sa.Column("yeniden_deneme_sayisi", sa.Integer(), nullable=False),
            sa.PrimaryKeyConstraint("id"),
        )

    if not _table_exists("optiplan_workflow_kayitlari"):
        op.create_table(
            "optiplan_workflow_kayitlari",
            sa.Column("kayit_uuid", sa.String(), nullable=False),
            sa.Column("ham_dosya_adi", sa.String(), nullable=False),
            sa.Column("kaynak_klasor", sa.String(), nullable=False),
            sa.Column("gelis_tarihi", sa.TIMESTAMP(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column("dosya_durumu", sa.String(), nullable=False),
            sa.Column("orijinal_dosya_yolu", sa.String(), nullable=False),
            sa.Column("dosya_hash", sa.String(), nullable=False),
            sa.Column("ocr_ham_json", sa.JSON(), nullable=True),
            sa.Column("ayristirilmis_ocr_alanlari", sa.JSON(), nullable=True),
            sa.Column("okunan_cari_unvan", sa.String(), nullable=True),
            sa.Column("okunan_cari_telefon", sa.String(), nullable=True),
            sa.Column("ai_guven_skoru_ozeti", sa.JSON(), nullable=True),
            sa.Column("revizyon_adayi_uyarisi", sa.String(), nullable=True),
            sa.Column("cari_unvan", sa.String(), nullable=True),
            sa.Column("cari_kodu", sa.String(), nullable=True),
            sa.Column("siparis_no", sa.String(), nullable=True),
            sa.Column("termin", sa.Date(), nullable=True),
            sa.Column("malzeme", sa.String(), nullable=True),
            sa.Column("stok_kodu", sa.String(), nullable=True),
            sa.Column("bant_kalinligi", sa.String(), nullable=True),
            sa.Column("grain_varsayilan", sa.Integer(), nullable=False),
            sa.Column("plaka_boy_mm", sa.Integer(), nullable=True),
            sa.Column("plaka_en_mm", sa.Integer(), nullable=True),
            sa.Column("fire_aciklamasi", sa.Text(), nullable=True),
            sa.Column("retry_no", sa.Integer(), nullable=False),
            sa.Column("revizyon_no", sa.Integer(), nullable=False),
            sa.Column("aktif_faz", sa.Integer(), nullable=False),
            sa.PrimaryKeyConstraint("kayit_uuid"),
        )

    if not _table_exists("optiplan_workflow_satirlari"):
        op.create_table(
            "optiplan_workflow_satirlari",
            sa.Column("id", sa.String(), nullable=False),
            sa.Column("kayit_uuid", sa.String(), nullable=False),
            sa.Column("satir_sirasi", sa.Integer(), nullable=False),
            sa.Column("malzeme", sa.String(), nullable=True),
            sa.Column("boy", sa.Integer(), nullable=True),
            sa.Column("en", sa.Integer(), nullable=True),
            sa.Column("adet", sa.Integer(), nullable=False),
            sa.Column("grain", sa.Integer(), nullable=False),
            sa.Column("bilgi", sa.String(), nullable=True),
            sa.Column("u1", sa.Boolean(), nullable=False),
            sa.Column("u2", sa.Boolean(), nullable=False),
            sa.Column("k1", sa.Boolean(), nullable=False),
            sa.Column("k2", sa.Boolean(), nullable=False),
            sa.Column("delik_1", sa.String(), nullable=True),
            sa.Column("delik_2", sa.String(), nullable=True),
            sa.Column("satir_kaynagi", sa.String(), nullable=False),
            sa.Column("plaka_ref", sa.String(), nullable=True),
            sa.Column("bant_kalinligi_override", sa.String(), nullable=True),
            sa.Column("hucre_guven_skorlari", sa.JSON(), nullable=True),
            sa.Column("satir_guven_skor_ozeti", sa.JSON(), nullable=True),
            sa.Column("dislandi_mi", sa.Boolean(), nullable=False),
            sa.ForeignKeyConstraint(["kayit_uuid"], ["optiplan_workflow_kayitlari.kayit_uuid"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )

    if not _table_exists("optiplan_workflow_cikarilan_satirlar"):
        op.create_table(
            "optiplan_workflow_cikarilan_satirlar",
            sa.Column("id", sa.String(), nullable=False),
            sa.Column("aktif_satir_id", sa.String(), nullable=True),
            sa.Column("kayit_uuid", sa.String(), nullable=False),
            sa.Column("satir_sirasi", sa.Integer(), nullable=False),
            sa.Column("malzeme", sa.String(), nullable=True),
            sa.Column("boy", sa.Integer(), nullable=True),
            sa.Column("en", sa.Integer(), nullable=True),
            sa.Column("adet", sa.Integer(), nullable=False),
            sa.Column("grain", sa.Integer(), nullable=False),
            sa.Column("bilgi", sa.String(), nullable=True),
            sa.Column("u1", sa.Boolean(), nullable=False),
            sa.Column("u2", sa.Boolean(), nullable=False),
            sa.Column("k1", sa.Boolean(), nullable=False),
            sa.Column("k2", sa.Boolean(), nullable=False),
            sa.Column("delik_1", sa.String(), nullable=True),
            sa.Column("delik_2", sa.String(), nullable=True),
            sa.Column("satir_kaynagi", sa.String(), nullable=False),
            sa.Column("plaka_ref", sa.String(), nullable=True),
            sa.Column("bant_kalinligi_override", sa.String(), nullable=True),
            sa.Column("hucre_guven_skorlari", sa.JSON(), nullable=True),
            sa.Column("satir_guven_skor_ozeti", sa.JSON(), nullable=True),
            sa.ForeignKeyConstraint(["kayit_uuid"], ["optiplan_workflow_kayitlari.kayit_uuid"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )

    if not _table_exists("optiplan_workflow_audit_kayitlari"):
        op.create_table(
            "optiplan_workflow_audit_kayitlari",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("kayit_uuid", sa.String(), nullable=False),
            sa.Column("satir_id", sa.String(), nullable=True),
            sa.Column("alan_adi", sa.String(), nullable=False),
            sa.Column("eski_deger", sa.Text(), nullable=True),
            sa.Column("yeni_deger", sa.Text(), nullable=True),
            sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.ForeignKeyConstraint(["kayit_uuid"], ["optiplan_workflow_kayitlari.kayit_uuid"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )

    if not _table_exists("optiplan_workflow_plakalar"):
        op.create_table(
            "optiplan_workflow_plakalar",
            sa.Column("id", sa.String(), nullable=False),
            sa.Column("kayit_uuid", sa.String(), nullable=True),
            sa.Column("plaka_ref", sa.String(), nullable=False),
            sa.Column("etiket", sa.String(), nullable=False),
            sa.Column("plaka_boy_mm", sa.Integer(), nullable=False),
            sa.Column("plaka_en_mm", sa.Integer(), nullable=False),
            sa.Column("genel_listede_mi", sa.Boolean(), nullable=False),
            sa.ForeignKeyConstraint(["kayit_uuid"], ["optiplan_workflow_kayitlari.kayit_uuid"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )

    if not _table_exists("optiplan_workflow_export_kayitlari"):
        op.create_table(
            "optiplan_workflow_export_kayitlari",
            sa.Column("id", sa.String(), nullable=False),
            sa.Column("kayit_uuid", sa.String(), nullable=False),
            sa.Column("dosya_adi", sa.String(), nullable=False),
            sa.Column("xlsx_aktif_mi", sa.Boolean(), nullable=False),
            sa.Column("requested_formats", sa.JSON(), nullable=True),
            sa.Column("generated_formats", sa.JSON(), nullable=True),
            sa.Column("generated_dosyalar", sa.JSON(), nullable=True),
            sa.Column("durum", sa.String(), nullable=False),
            sa.Column("export_manifest", sa.JSON(), nullable=True),
            sa.Column("manifest_version", sa.String(), nullable=False, server_default="workflow_export_manifest_v1"),
            sa.Column("retry_no", sa.Integer(), nullable=False),
            sa.Column("revizyon_no", sa.Integer(), nullable=False),
            sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.ForeignKeyConstraint(["kayit_uuid"], ["optiplan_workflow_kayitlari.kayit_uuid"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )

    if not _table_exists("optiplan_workflow_hata_kayitlari"):
        op.create_table(
            "optiplan_workflow_hata_kayitlari",
            sa.Column("id", sa.String(), nullable=False),
            sa.Column("kayit_uuid", sa.String(), nullable=False),
            sa.Column("cari_unvan", sa.String(), nullable=True),
            sa.Column("siparis_no", sa.String(), nullable=True),
            sa.Column("ham_dosya_adi", sa.String(), nullable=False),
            sa.Column("kaynak_klasor", sa.String(), nullable=False),
            sa.Column("hata_fazi", sa.String(), nullable=False),
            sa.Column("hata_nedeni", sa.String(), nullable=False),
            sa.Column("tarih_saat", sa.TIMESTAMP(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column("operator_notu", sa.Text(), nullable=True),
            sa.ForeignKeyConstraint(["kayit_uuid"], ["optiplan_workflow_kayitlari.kayit_uuid"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )

    export_extra_columns = (
        ("requested_formats", sa.Column("requested_formats", sa.JSON(), nullable=True)),
        ("generated_formats", sa.Column("generated_formats", sa.JSON(), nullable=True)),
        ("generated_dosyalar", sa.Column("generated_dosyalar", sa.JSON(), nullable=True)),
        ("export_manifest", sa.Column("export_manifest", sa.JSON(), nullable=True)),
        (
            "manifest_version",
            sa.Column("manifest_version", sa.String(), nullable=False, server_default="workflow_export_manifest_v1"),
        ),
    )
    for column_name, column in export_extra_columns:
        if not _column_exists("optiplan_workflow_export_kayitlari", column_name):
            op.add_column("optiplan_workflow_export_kayitlari", column)

    indexes = (
        ("optiplan_folder_settings", "ix_optiplan_folder_settings_id", ["id"]),
        ("optiplan_workflow_kayitlari", "ix_optiplan_workflow_kayitlari_ham_dosya_adi", ["ham_dosya_adi"]),
        ("optiplan_workflow_kayitlari", "ix_optiplan_workflow_kayitlari_kaynak_klasor", ["kaynak_klasor"]),
        ("optiplan_workflow_kayitlari", "ix_optiplan_workflow_kayitlari_dosya_durumu", ["dosya_durumu"]),
        ("optiplan_workflow_kayitlari", "ix_optiplan_workflow_kayitlari_dosya_hash", ["dosya_hash"]),
        ("optiplan_workflow_kayitlari", "ix_optiplan_workflow_kayitlari_siparis_no", ["siparis_no"]),
        ("optiplan_workflow_satirlari", "ix_optiplan_workflow_satirlari_id", ["id"]),
        ("optiplan_workflow_satirlari", "ix_optiplan_workflow_satirlari_kayit_uuid", ["kayit_uuid"]),
        ("optiplan_workflow_cikarilan_satirlar", "ix_optiplan_workflow_cikarilan_satirlar_id", ["id"]),
        ("optiplan_workflow_cikarilan_satirlar", "ix_optiplan_workflow_cikarilan_satirlar_aktif_satir_id", ["aktif_satir_id"]),
        ("optiplan_workflow_cikarilan_satirlar", "ix_optiplan_workflow_cikarilan_satirlar_kayit_uuid", ["kayit_uuid"]),
        ("optiplan_workflow_audit_kayitlari", "ix_optiplan_workflow_audit_kayitlari_id", ["id"]),
        ("optiplan_workflow_audit_kayitlari", "ix_optiplan_workflow_audit_kayitlari_kayit_uuid", ["kayit_uuid"]),
        ("optiplan_workflow_audit_kayitlari", "ix_optiplan_workflow_audit_kayitlari_satir_id", ["satir_id"]),
        ("optiplan_workflow_plakalar", "ix_optiplan_workflow_plakalar_id", ["id"]),
        ("optiplan_workflow_plakalar", "ix_optiplan_workflow_plakalar_kayit_uuid", ["kayit_uuid"]),
        ("optiplan_workflow_plakalar", "ix_optiplan_workflow_plakalar_plaka_ref", ["plaka_ref"]),
        ("optiplan_workflow_export_kayitlari", "ix_optiplan_workflow_export_kayitlari_id", ["id"]),
        ("optiplan_workflow_export_kayitlari", "ix_optiplan_workflow_export_kayitlari_kayit_uuid", ["kayit_uuid"]),
        ("optiplan_workflow_hata_kayitlari", "ix_optiplan_workflow_hata_kayitlari_id", ["id"]),
        ("optiplan_workflow_hata_kayitlari", "ix_optiplan_workflow_hata_kayitlari_kayit_uuid", ["kayit_uuid"]),
    )
    for table_name, index_name, columns in indexes:
        if not _index_exists(table_name, index_name):
            op.create_index(index_name, table_name, columns)


def downgrade() -> None:
    indexes = (
        ("optiplan_workflow_hata_kayitlari", "ix_optiplan_workflow_hata_kayitlari_kayit_uuid"),
        ("optiplan_workflow_hata_kayitlari", "ix_optiplan_workflow_hata_kayitlari_id"),
        ("optiplan_workflow_export_kayitlari", "ix_optiplan_workflow_export_kayitlari_kayit_uuid"),
        ("optiplan_workflow_export_kayitlari", "ix_optiplan_workflow_export_kayitlari_id"),
        ("optiplan_workflow_plakalar", "ix_optiplan_workflow_plakalar_plaka_ref"),
        ("optiplan_workflow_plakalar", "ix_optiplan_workflow_plakalar_kayit_uuid"),
        ("optiplan_workflow_plakalar", "ix_optiplan_workflow_plakalar_id"),
        ("optiplan_workflow_audit_kayitlari", "ix_optiplan_workflow_audit_kayitlari_satir_id"),
        ("optiplan_workflow_audit_kayitlari", "ix_optiplan_workflow_audit_kayitlari_kayit_uuid"),
        ("optiplan_workflow_audit_kayitlari", "ix_optiplan_workflow_audit_kayitlari_id"),
        ("optiplan_workflow_cikarilan_satirlar", "ix_optiplan_workflow_cikarilan_satirlar_kayit_uuid"),
        ("optiplan_workflow_cikarilan_satirlar", "ix_optiplan_workflow_cikarilan_satirlar_aktif_satir_id"),
        ("optiplan_workflow_cikarilan_satirlar", "ix_optiplan_workflow_cikarilan_satirlar_id"),
        ("optiplan_workflow_satirlari", "ix_optiplan_workflow_satirlari_kayit_uuid"),
        ("optiplan_workflow_satirlari", "ix_optiplan_workflow_satirlari_id"),
        ("optiplan_workflow_kayitlari", "ix_optiplan_workflow_kayitlari_siparis_no"),
        ("optiplan_workflow_kayitlari", "ix_optiplan_workflow_kayitlari_dosya_hash"),
        ("optiplan_workflow_kayitlari", "ix_optiplan_workflow_kayitlari_dosya_durumu"),
        ("optiplan_workflow_kayitlari", "ix_optiplan_workflow_kayitlari_kaynak_klasor"),
        ("optiplan_workflow_kayitlari", "ix_optiplan_workflow_kayitlari_ham_dosya_adi"),
        ("optiplan_folder_settings", "ix_optiplan_folder_settings_id"),
    )
    for table_name, index_name in indexes:
        if _index_exists(table_name, index_name):
            op.drop_index(index_name, table_name=table_name)

    tables = (
        "optiplan_workflow_hata_kayitlari",
        "optiplan_workflow_export_kayitlari",
        "optiplan_workflow_plakalar",
        "optiplan_workflow_audit_kayitlari",
        "optiplan_workflow_cikarilan_satirlar",
        "optiplan_workflow_satirlari",
        "optiplan_workflow_kayitlari",
        "optiplan_folder_settings",
    )
    for table_name in tables:
        if _table_exists(table_name):
            op.drop_table(table_name)
