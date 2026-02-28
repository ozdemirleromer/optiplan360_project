from sqlalchemy import Column, Integer, String, ForeignKey, Enum, Numeric, TIMESTAMP, Text, Boolean, LargeBinary
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base
from .enums import SyncDirectionEnum, SyncStatusEnum, IntegrationTypeEnum

class TelegramOCRConfig(Base):
    __tablename__ = "telegram_ocr_configs"

    id = Column(Integer, primary_key=True, index=True)
    key = Column(String, unique=True, nullable=False, index=True)
    value = Column(Text)
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now())


class EmailOCRConfig(Base):
    __tablename__ = "email_ocr_configs"

    id = Column(Integer, primary_key=True, index=True)
    key = Column(String, unique=True, nullable=False, index=True)
    value = Column(Text)
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now())


class DeviceOCRConfig(Base):
    __tablename__ = "device_ocr_configs"

    id = Column(Integer, primary_key=True, index=True)
    key = Column(String, unique=True, nullable=False, index=True)
    value = Column(Text)
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now())


class OCRJob(Base):
    __tablename__ = "ocr_jobs"
    
    id = Column(String, primary_key=True, index=True)
    status = Column(String, nullable=False, default="PENDING")  # PENDING, PROCESSING, COMPLETED, FAILED, ORDER_CREATED
    
    # Dosya bilgileri
    original_filename = Column(String)
    content_type = Column(String)
    file_size = Column(Integer)
    image_data = Column(LargeBinary)  # raw bytes
    
    # OCR sonuçları
    extracted_text = Column(Text)
    confidence = Column(Numeric(3, 2), default=0.0)
    
    # Müşteri eşleştirme
    phone = Column(String)
    customer_id = Column(Integer, ForeignKey("customers.id"))
    customer_match_confidence = Column(Numeric(3, 2))
    
    # Sipariş oluşturma
    order_id = Column(Integer, ForeignKey("orders.id"))
    
    # Notlar
    notes = Column(Text)
    error_message = Column(Text)
    
    # Kullanıcı
    uploaded_by_id = Column(Integer, ForeignKey("users.id"))
    
    # Zamanlar
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    completed_at = Column(TIMESTAMP(timezone=True))
    
    # İlişkiler
    lines = relationship("OCRLine", back_populates="job", cascade="all, delete-orphan")
    customer = relationship("Customer")
    order = relationship("Order")


class OCRLine(Base):
    __tablename__ = "ocr_lines"
    
    id = Column(String, primary_key=True, index=True)
    ocr_job_id = Column(String, ForeignKey("ocr_jobs.id"), nullable=False)
    
    # Satır bilgileri
    line_number = Column(Integer, nullable=False)
    text = Column(Text, nullable=False)
    confidence = Column(Numeric(3, 2), default=0.0)
    
    # Validasyon
    is_valid = Column(Boolean, default=False)
    validation_error = Column(String)
    
    # Parse edilmiş veri (JSON)
    parsed_data = Column(Text)  # JSON: {"boy": 700, "en": 400, "adet": 2}
    
    # İlişkiler
    job = relationship("OCRJob", back_populates="lines")


# ═══════════════════════════════════════════════════
# WHATSAPP MODELLERİ
# ═══════════════════════════════════════════════════

class WhatsAppMessage(Base):
    __tablename__ = "whatsapp_messages"
    
    id = Column(String, primary_key=True, index=True)
    to_phone = Column(String, nullable=False)
    message = Column(Text, nullable=False)
    status = Column(String, nullable=False, default="PENDING")  # PENDING, SENT, FAILED
    waba_message_id = Column(String)
    
    order_id = Column(Integer, ForeignKey("orders.id"))
    order_ts_code = Column(String)
    
    sent_by_id = Column(Integer, ForeignKey("users.id"))
    sent_by_name = Column(String)
    sent_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    
    error = Column(Text)


class WhatsAppSetting(Base):
    __tablename__ = "whatsapp_settings"
    
    id = Column(Integer, primary_key=True, index=True)
    key = Column(String, unique=True, nullable=False)
    value = Column(Text)
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now())


# ═══════════════════════════════════════════════════
# AZURE & GOOGLE MODELLERİ
# ═══════════════════════════════════════════════════

class AzureConfig(Base):
    __tablename__ = "azure_configs"
    
    id = Column(Integer, primary_key=True, index=True)
    key = Column(String, unique=True, nullable=False, index=True)
    value = Column(Text)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), onupdate=func.now())


class GoogleVisionConfig(Base):
    __tablename__ = "google_vision_configs"
    
    id = Column(Integer, primary_key=True, index=True)
    key = Column(String, unique=True, nullable=False, index=True)
    value = Column(Text)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), onupdate=func.now())


class AWSTextractConfig(Base):
    __tablename__ = "aws_textract_configs"
    
    id = Column(Integer, primary_key=True, index=True)
    key = Column(String, unique=True, nullable=False, index=True)
    value = Column(Text)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), onupdate=func.now())


# ═══════════════════════════════════════════════════════════════
# ENTEGRASYON MODÜLLERİ — Mikro Senkron / Outbox-Inbox Pattern
# ═══════════════════════════════════════════════════════════════

class IntegrationEntityMap(Base):
    """OptiPlan ↔ Mikro entity eşleme tablosu"""
    __tablename__ = "integration_entity_map"

    id = Column(String, primary_key=True, index=True)
    entity_type = Column(String, nullable=False, index=True)  # account, stock, order, invoice
    internal_id = Column(String, nullable=False, index=True)
    external_id = Column(String, nullable=False, index=True)  # Mikro tarafındaki ID/kod
    external_system = Column(String, default="MIKRO", nullable=False)
    mapping_data = Column(Text, nullable=True)  # JSON ek bilgi
    is_active = Column(Boolean, default=True)
    last_synced_at = Column(TIMESTAMP(timezone=True), nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), onupdate=func.now())


class IntegrationSyncJob(Base):
    """Senkronizasyon iş kaydı"""
    __tablename__ = "integration_sync_jobs"

    id = Column(String, primary_key=True, index=True)
    job_type = Column(String, nullable=False)  # FULL_SYNC, INCREMENTAL, SINGLE_ENTITY
    direction = Column(Enum(SyncDirectionEnum), nullable=False)
    entity_type = Column(String, nullable=True)  # account, stock, order
    status = Column(Enum(SyncStatusEnum), default=SyncStatusEnum.QUEUED, nullable=False)
    total_records = Column(Integer, default=0)
    processed_records = Column(Integer, default=0)
    success_count = Column(Integer, default=0)
    error_count = Column(Integer, default=0)
    started_at = Column(TIMESTAMP(timezone=True), nullable=True)
    completed_at = Column(TIMESTAMP(timezone=True), nullable=True)
    error_message = Column(Text, nullable=True)
    triggered_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())


class IntegrationOutbox(Base):
    """Giden senkron kuyruğu (OptiPlan → Mikro)"""
    __tablename__ = "integration_outbox"

    id = Column(String, primary_key=True, index=True)
    entity_type = Column(String, nullable=False, index=True)
    entity_id = Column(String, nullable=False)
    operation = Column(String, nullable=False)  # CREATE, UPDATE, DELETE
    payload = Column(Text, nullable=False)  # JSON
    status = Column(Enum(SyncStatusEnum), default=SyncStatusEnum.QUEUED, nullable=False)
    retry_count = Column(Integer, default=0)
    max_retries = Column(Integer, default=5)
    next_retry_at = Column(TIMESTAMP(timezone=True), nullable=True)
    error_message = Column(Text, nullable=True)
    processed_at = Column(TIMESTAMP(timezone=True), nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())


class IntegrationInbox(Base):
    """Gelen senkron kuyruğu (Mikro → OptiPlan)"""
    __tablename__ = "integration_inbox"

    id = Column(String, primary_key=True, index=True)
    entity_type = Column(String, nullable=False, index=True)
    external_id = Column(String, nullable=False)
    operation = Column(String, nullable=False)  # CREATE, UPDATE, DELETE
    payload = Column(Text, nullable=False)  # JSON
    status = Column(Enum(SyncStatusEnum), default=SyncStatusEnum.QUEUED, nullable=False)
    conflict_type = Column(String, nullable=True)  # NONE, FIELD_MISMATCH, MISSING_MAP
    conflict_data = Column(Text, nullable=True)  # JSON
    resolved_at = Column(TIMESTAMP(timezone=True), nullable=True)
    resolved_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    processed_at = Column(TIMESTAMP(timezone=True), nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())


class IntegrationError(Base):
    """Entegrasyon hata kaydı"""
    __tablename__ = "integration_errors"

    id = Column(String, primary_key=True, index=True)
    job_id = Column(String, ForeignKey("integration_sync_jobs.id"), nullable=True)
    entity_type = Column(String, nullable=True)
    entity_id = Column(String, nullable=True)
    error_code = Column(String, nullable=True)
    error_message = Column(Text, nullable=False)
    stack_trace = Column(Text, nullable=True)
    is_resolved = Column(Boolean, default=False)
    resolved_at = Column(TIMESTAMP(timezone=True), nullable=True)
    resolved_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())


class IntegrationAudit(Base):
    """Entegrasyon denetim izi"""
    __tablename__ = "integration_audit"

    id = Column(String, primary_key=True, index=True)
    action = Column(String, nullable=False)  # SYNC_START, SYNC_END, MAP_CREATE, CONFLICT_RESOLVE
    entity_type = Column(String, nullable=True)
    entity_id = Column(String, nullable=True)
    direction = Column(String, nullable=True)
    detail = Column(Text, nullable=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())


class IntegrationSettings(Base):
    """Entegrasyon ayarları"""
    __tablename__ = "integration_settings"

    id = Column(String, primary_key=True, index=True)
    integration_type = Column(Enum(IntegrationTypeEnum), nullable=False)
    category = Column(String(50), nullable=True)  # ORDER, INVOICE, STOCK, CARGO, etc.
    settings = Column(Text, nullable=False)  # JSON formatında ayarlar
    is_active = Column(Boolean, default=True, nullable=False)
    auto_sync_enabled = Column(Boolean, default=False, nullable=False)
    sync_interval_minutes = Column(Integer, default=15, nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now())


class StockCard(Base):
    """Mikro stok kartı"""
    __tablename__ = "stock_cards"

    id = Column(String, primary_key=True, index=True)
    stock_code = Column(String, unique=True, index=True, nullable=False)  # Mikro stok kodu
    stock_name = Column(String, nullable=False)  # Malzeme adı
    unit = Column(String, nullable=True)  # Birim (m², m³, kg, vb.)
    
    # Fiyat bilgileri
    purchase_price = Column(Numeric(12, 2), nullable=True)  # Alış fiyatı
    sale_price = Column(Numeric(12, 2), nullable=True)  # Satış fiyatı
    
    # Stok miktarları
    total_quantity = Column(Numeric(12, 2), nullable=False, default=0)  # Toplam miktar
    available_quantity = Column(Numeric(12, 2), nullable=False, default=0)  # Uygun miktar
    reserved_quantity = Column(Numeric(12, 2), nullable=False, default=0)  # Rezerve miktar
    
    # Depo bilgisi
    warehouse_location = Column(String, nullable=True)  # Depo konumu
    
    # Özellikleri
    thickness = Column(String, nullable=True)  # Kalınlık (18mm vb.)
    color = Column(String, nullable=True)  # Renk
    
    # Durumu
    is_active = Column(Boolean, default=True, nullable=False)
    
    # Meta
    last_sync_date = Column(TIMESTAMP(timezone=True), nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now())
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    updated_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    deleted_at = Column(TIMESTAMP(timezone=True), nullable=True)  # Soft-delete support


class StockMovement(Base):
    """Stok hareket kaydı (Mikro'dan senkronize)"""
    __tablename__ = "stock_movements"

    id = Column(String, primary_key=True, index=True)
    stock_code = Column(String, ForeignKey("stock_cards.stock_code"), nullable=False)
    
    movement_type = Column(String, nullable=False)  # ENTRY, EXIT, ADJUSTMENT, TRANSFER
    quantity = Column(Numeric(12, 2), nullable=False)
    unit_price = Column(Numeric(12, 2), nullable=True)
    total_amount = Column(Numeric(12, 2), nullable=True)
    
    reference_document = Column(String, nullable=True)  # Referans belge (Sip/Fatura vb.)
    reference_id = Column(String, nullable=True)  # Referans ID
    
    description = Column(Text, nullable=True)
    
    movement_date = Column(TIMESTAMP(timezone=True), nullable=False)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    updated_by = Column(Integer, ForeignKey("users.id"), nullable=True)
