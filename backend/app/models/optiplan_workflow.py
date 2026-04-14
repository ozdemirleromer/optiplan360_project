"""
OptiPlan Workflow ORM Modelleri

Tablolar:
  - optiplan_folder_settings
  - optiplan_workflow_kayitlari
  - optiplan_workflow_satirlari
  - optiplan_workflow_cikarilan_satirlar
  - optiplan_workflow_audit_kayitlari
  - optiplan_workflow_plakalar
  - optiplan_workflow_export_kayitlari
  - optiplan_workflow_hata_kayitlari
  - phase2_decision_events
  - phase2_validation_contexts

Şema otoritesi: Alembic migration dosyaları.
"""

from app.database import Base

from sqlalchemy import (
    Boolean,
    Column,
    Date,
    ForeignKey,
    Index,
    Integer,
    JSON,
    String,
    Text,
    TIMESTAMP,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func


class OptiPlanFolderSetting(Base):
    """Klasör yolları ve workflow konfigürasyonu (tek satır, id=1)."""

    __tablename__ = "optiplan_folder_settings"

    id = Column(Integer, nullable=False, primary_key=True, index=True)

    # Kaynak klasörler
    whatsapp_raw_klasoru = Column(String, nullable=False)
    scanner_raw_klasoru = Column(String, nullable=False)
    manuel_raw_klasoru = Column(String, nullable=False)
    email_raw_klasoru = Column(String, nullable=False)

    # Hedef klasörler
    islenmis_klasoru = Column(String, nullable=False)
    arsiv_klasoru = Column(String, nullable=False)
    xml_okuma_klasoru = Column(String, nullable=False)
    xlsx_cikti_klasoru = Column(String, nullable=False)
    hatali_klasoru = Column(String, nullable=False)

    # OPJ export (2026_03_16_folder_opj migration)
    opj_cikti_klasoru = Column(String, nullable=False, server_default="")
    opj_aktif_mi = Column(Boolean, nullable=False, server_default="0", default=False)

    # Format konfigürasyonu
    fis_evrak_no_formati = Column(String, nullable=False, default="SIP-{seq:06d}")
    arsiv_zaman_damgasi_formati = Column(String, nullable=False, default="%Y%m%d_%H%M%S")

    # Özellik bayrakları
    xlsx_aktif_mi = Column(Boolean, nullable=False, default=True)
    watcher_aktif_mi = Column(Boolean, nullable=False, default=True)
    yeniden_deneme_sayisi = Column(Integer, nullable=False, default=3)


class OptiPlanWorkflowKayit(Base):
    """
    Workflow ana kaydı — dosya alımından export'a kadar tüm durum.
    PK: kayit_uuid (UUID string).
    """

    __tablename__ = "optiplan_workflow_kayitlari"

    kayit_uuid = Column(String, nullable=False, primary_key=True)

    # Dosya meta
    ham_dosya_adi = Column(String, nullable=False, index=True)
    kaynak_klasor = Column(String, nullable=False, index=True)
    gelis_tarihi = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())
    dosya_durumu = Column(String, nullable=False, default="PHASE_1_OCR_HAVUZU", index=True)
    orijinal_dosya_yolu = Column(String, nullable=False)
    dosya_hash = Column(String, nullable=False, index=True)

    # OCR çıktıları
    ocr_ham_json = Column(JSON, nullable=True)
    ayristirilmis_ocr_alanlari = Column(JSON, nullable=True)
    okunan_cari_unvan = Column(String, nullable=True)
    okunan_cari_telefon = Column(String, nullable=True)
    ai_guven_skoru_ozeti = Column(JSON, nullable=True)
    revizyon_adayi_uyarisi = Column(String, nullable=True)

    # Doğrulanmış iş alanları
    cari_unvan = Column(String, nullable=True)
    cari_kodu = Column(String, nullable=True)
    siparis_no = Column(String, nullable=True, index=True)
    termin = Column(Date, nullable=True)
    malzeme = Column(String, nullable=True)
    stok_kodu = Column(String, nullable=True)
    bant_kalinligi = Column(String, nullable=True)
    grain_varsayilan = Column(Integer, nullable=False, default=0)
    plaka_boy_mm = Column(Integer, nullable=True)
    plaka_en_mm = Column(Integer, nullable=True)
    fire_aciklamasi = Column(Text, nullable=True)

    # Lojistik ve ödeme
    teslim_tarihi = Column(Date, nullable=True)
    teslimat_adresi = Column(Text, nullable=True)
    odeme_sekli = Column(String, nullable=True)

    # Kontrol alanları
    retry_no = Column(Integer, nullable=False, default=0)
    revizyon_no = Column(Integer, nullable=False, default=0)
    aktif_faz = Column(Integer, nullable=False, default=1)

    # İlişkiler
    satirlar = relationship(
        "OptiPlanWorkflowSatir",
        back_populates="kayit",
        cascade="all, delete-orphan",
        order_by="OptiPlanWorkflowSatir.satir_sirasi.asc()",
    )
    cikarilan_satirlar = relationship(
        "OptiPlanWorkflowCikarilanSatir",
        back_populates="kayit",
        cascade="all, delete-orphan",
        order_by="OptiPlanWorkflowCikarilanSatir.satir_sirasi.asc()",
    )
    audit_kayitlari = relationship(
        "OptiPlanWorkflowAudit",
        back_populates="kayit",
        cascade="all, delete-orphan",
        order_by="OptiPlanWorkflowAudit.created_at.asc()",
    )
    plakalar = relationship(
        "OptiPlanWorkflowPlaka",
        back_populates="kayit",
        cascade="all, delete-orphan",
        order_by="OptiPlanWorkflowPlaka.plaka_ref.asc()",
    )
    export_kayitlari = relationship(
        "OptiPlanWorkflowExport",
        back_populates="kayit",
        cascade="all, delete-orphan",
        order_by="OptiPlanWorkflowExport.created_at.desc()",
    )
    hata_kayitlari = relationship(
        "OptiPlanWorkflowHata",
        back_populates="kayit",
        cascade="all, delete-orphan",
        order_by="OptiPlanWorkflowHata.tarih_saat.desc()",
    )


class OptiPlanWorkflowSatir(Base):
    """Workflow sipariş satırı — OCR'dan gelen boyutlar ve onay durumu."""

    __tablename__ = "optiplan_workflow_satirlari"

    id = Column(String, nullable=False, primary_key=True, index=True)
    kayit_uuid = Column(
        String,
        ForeignKey("optiplan_workflow_kayitlari.kayit_uuid", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Sıra ve içerik
    satir_sirasi = Column(Integer, nullable=False)
    malzeme = Column(String, nullable=True)
    boy = Column(Integer, nullable=True)
    en = Column(Integer, nullable=True)
    adet = Column(Integer, nullable=False)
    grain = Column(Integer, nullable=False)
    bilgi = Column(String, nullable=True)

    # Kenar bantları
    u1 = Column(Boolean, nullable=False, default=False)
    u2 = Column(Boolean, nullable=False, default=False)
    k1 = Column(Boolean, nullable=False, default=False)
    k2 = Column(Boolean, nullable=False, default=False)

    # Delik bilgisi
    delik_1 = Column(String, nullable=True)
    delik_2 = Column(String, nullable=True)

    # Meta
    satir_kaynagi = Column(String, nullable=False, default="OCR")
    plaka_ref = Column(String, nullable=True)
    bant_kalinligi_override = Column(String, nullable=True)
    hucre_guven_skorlari = Column(JSON, nullable=True)
    satir_guven_skor_ozeti = Column(JSON, nullable=True)
    boy_onay = Column(String, nullable=True)
    en_onay = Column(String, nullable=True)
    adet_onay = Column(String, nullable=True)
    boy_operator_degeri = Column(Integer, nullable=True)
    en_operator_degeri = Column(Integer, nullable=True)
    adet_operator_degeri = Column(Integer, nullable=True)
    onaylayan_id = Column(Integer, nullable=True)
    onay_zamani = Column(TIMESTAMP(timezone=True), nullable=True)
    bbox_json = Column(JSON, nullable=True)
    dislandi_mi = Column(Boolean, nullable=False, default=False)

    # İlişki
    kayit = relationship("OptiPlanWorkflowKayit", back_populates="satirlar")


class OptiPlanWorkflowCikarilanSatir(Base):
    """Workflow'dan çıkarılan (silinen/geri alınan) satırların kopyası."""

    __tablename__ = "optiplan_workflow_cikarilan_satirlar"

    id = Column(String, nullable=False, primary_key=True, index=True)
    aktif_satir_id = Column(String, nullable=True, index=True)
    kayit_uuid = Column(
        String,
        ForeignKey("optiplan_workflow_kayitlari.kayit_uuid", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Satır içeriği (OptiPlanWorkflowSatir ile aynı yapı)
    satir_sirasi = Column(Integer, nullable=False)
    malzeme = Column(String, nullable=True)
    boy = Column(Integer, nullable=True)
    en = Column(Integer, nullable=True)
    adet = Column(Integer, nullable=False)
    grain = Column(Integer, nullable=False)
    bilgi = Column(String, nullable=True)

    # Kenar bantları
    u1 = Column(Boolean, nullable=False, default=False)
    u2 = Column(Boolean, nullable=False, default=False)
    k1 = Column(Boolean, nullable=False, default=False)
    k2 = Column(Boolean, nullable=False, default=False)

    # Delik bilgisi
    delik_1 = Column(String, nullable=True)
    delik_2 = Column(String, nullable=True)

    # Meta
    satir_kaynagi = Column(String, nullable=False, default="OCR")
    plaka_ref = Column(String, nullable=True)
    bant_kalinligi_override = Column(String, nullable=True)
    hucre_guven_skorlari = Column(JSON, nullable=True)
    satir_guven_skor_ozeti = Column(JSON, nullable=True)
    boy_onay = Column(String, nullable=True)
    en_onay = Column(String, nullable=True)
    adet_onay = Column(String, nullable=True)
    boy_operator_degeri = Column(Integer, nullable=True)
    en_operator_degeri = Column(Integer, nullable=True)
    adet_operator_degeri = Column(Integer, nullable=True)
    onaylayan_id = Column(Integer, nullable=True)
    onay_zamani = Column(TIMESTAMP(timezone=True), nullable=True)
    bbox_json = Column(JSON, nullable=True)

    # İlişki
    kayit = relationship("OptiPlanWorkflowKayit", back_populates="cikarilan_satirlar")


class OptiPlanWorkflowAudit(Base):
    """Alan değişikliği audit log'u."""

    __tablename__ = "optiplan_workflow_audit_kayitlari"

    id = Column(Integer, nullable=False, primary_key=True, index=True)
    kayit_uuid = Column(
        String,
        ForeignKey("optiplan_workflow_kayitlari.kayit_uuid", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    satir_id = Column(String, nullable=True, index=True)
    alan_adi = Column(String, nullable=False)
    eski_deger = Column(Text, nullable=True)
    yeni_deger = Column(Text, nullable=True)
    user_id = Column(Integer, nullable=True)
    islem_tipi = Column(String, nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())

    # İlişki
    kayit = relationship("OptiPlanWorkflowKayit", back_populates="audit_kayitlari")


class OptiPlanWorkflowPlaka(Base):
    """Workflow plaka (levha) tanımları."""

    __tablename__ = "optiplan_workflow_plakalar"

    id = Column(String, nullable=False, primary_key=True, index=True)
    kayit_uuid = Column(
        String,
        ForeignKey("optiplan_workflow_kayitlari.kayit_uuid", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    plaka_ref = Column(String, nullable=False, index=True)
    etiket = Column(String, nullable=False)
    plaka_boy_mm = Column(Integer, nullable=False)
    plaka_en_mm = Column(Integer, nullable=False)
    genel_listede_mi = Column(Boolean, nullable=False, default=True)

    # İlişki
    kayit = relationship("OptiPlanWorkflowKayit", back_populates="plakalar")


class OptiPlanWorkflowExport(Base):
    """Export işlemi kaydı — XLSX/OPJ çıktı durumu."""

    __tablename__ = "optiplan_workflow_export_kayitlari"

    id = Column(String, nullable=False, primary_key=True, index=True)
    kayit_uuid = Column(
        String,
        ForeignKey("optiplan_workflow_kayitlari.kayit_uuid", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    dosya_adi = Column(String, nullable=False)
    xlsx_aktif_mi = Column(Boolean, nullable=False, default=True)
    opj_aktif_mi = Column(Boolean, nullable=False, server_default="0", default=False)

    # Format takibi
    requested_formats = Column(JSON, nullable=True)
    generated_formats = Column(JSON, nullable=True)
    generated_dosyalar = Column(JSON, nullable=True)

    # Durum ve manifest
    durum = Column(String, nullable=False, default="HAZIRLANDI")
    opj_status = Column(String, nullable=False, server_default="BEKLEMEDE")
    opj_message = Column(Text, nullable=True)
    export_manifest = Column(JSON, nullable=True)
    manifest_version = Column(
        String, nullable=False, server_default="workflow_export_manifest_v1"
    )

    # Revizyon takibi
    retry_no = Column(Integer, nullable=False, default=0)
    revizyon_no = Column(Integer, nullable=False, default=0)
    created_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())

    # İlişki
    kayit = relationship("OptiPlanWorkflowKayit", back_populates="export_kayitlari")


class OptiPlanWorkflowHata(Base):
    """Workflow hata kaydı — her retry/fail için."""

    __tablename__ = "optiplan_workflow_hata_kayitlari"

    id = Column(String, nullable=False, primary_key=True, index=True)
    kayit_uuid = Column(
        String,
        ForeignKey("optiplan_workflow_kayitlari.kayit_uuid", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Bağlam bilgisi
    cari_unvan = Column(String, nullable=True)
    siparis_no = Column(String, nullable=True)
    ham_dosya_adi = Column(String, nullable=False)
    kaynak_klasor = Column(String, nullable=False)

    # Hata detayı
    hata_fazi = Column(String, nullable=False)
    hata_nedeni = Column(String, nullable=False)
    tarih_saat = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())
    operator_notu = Column(Text, nullable=True)

    # İlişki
    kayit = relationship("OptiPlanWorkflowKayit", back_populates="hata_kayitlari")


class Phase2DecisionEvent(Base):
    """
    [SQL-TEKNIK] Phase 2 Karar Log'u — Append-Only Event Table
    Referans: PHASE2_OCR_KONTROL_TASARIM_V2.md — Bölüm 5.4 & 5.6

    Zaman serileri: Kim, ne zaman, ne karar verdi, neden?
    Undo mekanizması için reverse event'ler de kaydedilir.
    """

    __tablename__ = "phase2_decision_events"

    id = Column(String, nullable=False, primary_key=True)
    kayit_uuid = Column(
        String,
        ForeignKey("optiplan_workflow_kayitlari.kayit_uuid", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    satir_id = Column(String, nullable=True, index=True)

    # Alan ve olay tipi
    alan_tipi = Column(String, nullable=False)          # boy | en | adet
    olay_tipi = Column(String, nullable=False)          # CELL_DECIDED | ERROR_MARKED | CELL_UNDONE

    # Değer değişimi
    eski_deger = Column(Integer, nullable=True)
    yeni_deger = Column(Integer, nullable=True)
    eski_onay_durumu = Column(String, nullable=True)
    yeni_onay_durumu = Column(String, nullable=True)

    # Operatör bilgisi
    user_id = Column(Integer, nullable=True)
    user_adi = Column(String, nullable=True)
    user_rolu = Column(String, nullable=True)
    operator_override_mi = Column(Boolean, nullable=True)

    # Neden/bağlam
    blocker_sebebi = Column(String, nullable=True)
    hatali_isleme_kategorisi = Column(String, nullable=True)
    operator_notu = Column(Text, nullable=True)
    onerilen_deger = Column(Integer, nullable=True)
    ocr_orjinal_deger = Column(String, nullable=True)
    karar_oncesi_guven = Column(String, nullable=True)

    # Idempotency
    idempotency_key = Column(String, nullable=True, index=True)

    created_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())

    # İlişki
    kayit = relationship("OptiPlanWorkflowKayit")


class Phase2ValidationContext(Base):
    """
    [SQL-TEKNIK] Doğrulama Kuralları ve Blocker Konfigürasyonu
    Referans: PHASE2_OCR_KONTROL_TASARIM_V2.md — Bölüm 5.1

    Alan-bazlı eşikler ve doğrulama kuralları.
    Admin panelinden düzenlenebilir (future).
    """

    __tablename__ = "phase2_validation_contexts"

    id = Column(Integer, nullable=False, primary_key=True)
    alan_tipi = Column(String, nullable=False)          # boy | en | adet

    # Aralık kontrolü
    min_deger = Column(Integer, nullable=True)
    max_deger = Column(Integer, nullable=True)
    min_hata_mesaji = Column(String, nullable=True)
    max_hata_mesaji = Column(String, nullable=True)
    aralik_kontrolu_aktif = Column(Boolean, nullable=True)

    # Güven eşiği
    confidence_esik = Column(Integer, nullable=True)
    confidence_hata_mesaji = Column(String, nullable=True)
    tip_kontrolu_aktif = Column(Boolean, nullable=True)

    # Genel
    aktif_mi = Column(Boolean, nullable=False, default=True)
    created_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), nullable=True)



