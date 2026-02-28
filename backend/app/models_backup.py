from sqlalchemy import Column, Integer, String, ForeignKey, Enum, Numeric, TIMESTAMP, Text, Boolean, LargeBinary, Float
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .database import Base
import enum

# Veritabanı enum tipleriyle eşleşen Python enumları
class OrderStatusEnum(str, enum.Enum):
    NEW = "NEW"
    DRAFT = "DRAFT"
    PENDING_APPROVAL = "PENDING_APPROVAL"
    HOLD = "HOLD"  # Bekletilen durum - 2 hafta
    IN_PRODUCTION = "IN_PRODUCTION"
    READY = "READY"
    COMPLETED = "COMPLETED"
    DELIVERED = "DELIVERED"
    DONE = "DONE"
    APPROVED = "APPROVED"
    CANCELLED = "CANCELLED"


# ── CRM Enum Tipleri ──
class OpportunityStageEnum(str, enum.Enum):
    LEAD = "LEAD"
    QUALIFIED = "QUALIFIED"
    PROPOSAL = "PROPOSAL"
    NEGOTIATION = "NEGOTIATION"
    CLOSED_WON = "CLOSED_WON"
    CLOSED_LOST = "CLOSED_LOST"

class QuoteStatusEnum(str, enum.Enum):
    DRAFT = "DRAFT"
    SENT = "SENT"
    ACCEPTED = "ACCEPTED"
    REJECTED = "REJECTED"
    EXPIRED = "EXPIRED"
    REVISED = "REVISED"

class TaskPriorityEnum(str, enum.Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    URGENT = "URGENT"

class TaskStatusEnum(str, enum.Enum):
    TODO = "TODO"
    IN_PROGRESS = "IN_PROGRESS"
    DONE = "DONE"
    CANCELLED = "CANCELLED"

class ActivityTypeEnum(str, enum.Enum):
    CALL = "CALL"
    EMAIL = "EMAIL"
    MEETING = "MEETING"
    NOTE = "NOTE"
    TASK = "TASK"

class SyncStatusEnum(str, enum.Enum):
    QUEUED = "QUEUED"
    RUNNING = "RUNNING"
    SUCCESS = "SUCCESS"
    FAILED = "FAILED"
    PARTIAL = "PARTIAL"

class SyncDirectionEnum(str, enum.Enum):
    PUSH = "PUSH"
    PULL = "PULL"
    BIDIRECTIONAL = "BIDIRECTIONAL"

class IntegrationTypeEnum(str, enum.Enum):
    MIKRO = "MIKRO"
    SMTP = "SMTP"
    SMS = "SMS"
    EINVOICE = "EINVOICE"
    CARGO = "CARGO"
    PAYMENT_GATEWAY = "PAYMENT_GATEWAY"
    WHATSAPP = "WHATSAPP"
    ERP = "ERP"

# ── Tahsilat Enum Tipleri ──
class PaymentStatusEnum(str, enum.Enum):
    PENDING = "PENDING"          # Ödeme Bekliyor
    PARTIAL = "PARTIAL"          # Kısmi Ödendi
    PAID = "PAID"                # Tamamen Ödendi
    OVERDUE = "OVERDUE"          # Vadesi Geçti
    CANCELLED = "CANCELLED"      # İptal Edildi

class PaymentMethodEnum(str, enum.Enum):
    CASH = "CASH"                # Nakit
    CARD = "CARD"                # Kredi Kartı
    TRANSFER = "TRANSFER"        # Havale/EFT
    CHECK = "CHECK"              # Çek
    DEBIT = "DEBIT"              # Cari Hesaptan

class ReminderTypeEnum(str, enum.Enum):
    EMAIL = "EMAIL"              # E-posta hatırlatması
    SMS = "SMS"                  # SMS hatırlatması
    IN_APP = "IN_APP"            # Uygulama içi hatırlatma
    LETTER = "LETTER"            # Mektup/Faks

class ReminderStatusEnum(str, enum.Enum):
    PENDING = "PENDING"          # Gönderilmesi bekleniyor
    SENT = "SENT"                # Gönderildi
    READ = "READ"                # Okundu
    IGNORED = "IGNORED"          # Göz ardı edildi
    BOUNCED = "BOUNCED"          # Geri döndü (invalid e-posta vb.)

class DealerTypeEnum(str, enum.Enum):
    DEALER = "DEALER"            # Bayi
    B2B = "B2B"                  # Kurumsal Müşteri
    B2C = "B2C"                  # Bireysel Müşteri
    PROJECT = "PROJECT"          # Proje Müşterisi
    MANUFACTURER = "MANUFACTURER" # Üretici

class PartGroupEnum(str, enum.Enum):
    GOVDE = "GOVDE"
    ARKALIK = "ARKALIK"

class GrainDirectionEnum(str, enum.Enum):
    ZERO = "0-Material"
    BOYUNA = "1-Boyuna"
    ENINE = "2-Enine"

class Customer(Base):
    __tablename__ = "customers"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    phone = Column(String, unique=True, index=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), onupdate=func.now(), nullable=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    updated_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    deleted_at = Column(TIMESTAMP(timezone=True), nullable=True)  # Soft-delete support
    orders = relationship("Order", back_populates="customer")

class Station(Base):
    __tablename__ = "stations"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, unique=True)
    description = Column(Text)
    active = Column(Boolean, default=True, nullable=False)
    last_scan_at = Column(TIMESTAMP(timezone=True))
    scan_count_today = Column(Integer, default=0)
    istasyon_durumu = Column(String, default="Hazır")
    
    # Cihaz Tanımlama Alanları
    device_type = Column(String)  # Mobil Cihaz, El Terminali, Entegre Okuyucu, Masaüstü PC
    device_model = Column(String)  # Cihaz modeli (örn: Zebra DS2208)
    device_serial_number = Column(String)  # Seri numarası
    ip_address = Column(String)  # IP adresi (ağ cihazları için)
    connection_type = Column(String)  # USB, Bluetooth, WiFi, Ethernet, Webcam
    installation_date = Column(TIMESTAMP(timezone=True))  # Kurulum tarihi
    last_maintenance_date = Column(TIMESTAMP(timezone=True))  # Son bakım tarihi

class Order(Base):
    __tablename__ = "orders"
    id = Column(Integer, primary_key=True, index=True)
    customer_id = Column(Integer, ForeignKey("customers.id"))
    crm_name_snapshot = Column(String)
    ts_code = Column(String, unique=True, nullable=False)
    phone_norm = Column(String)
    thickness_mm = Column(Numeric(5, 2))
    plate_w_mm = Column(Numeric(10, 2))
    plate_h_mm = Column(Numeric(10, 2))
    color = Column(String)
    material_name = Column(String)
    band_mm = Column(Numeric(5, 2))
    grain_default = Column(String, default="0-Material")
    created_by = Column(Integer, ForeignKey("users.id"))
    updated_by = Column(Integer, ForeignKey("users.id"), nullable=True)  # Audit trail
    status = Column(Enum(OrderStatusEnum), default=OrderStatusEnum.DRAFT)
    hold_at = Column(TIMESTAMP(timezone=True))
    cancelled_at = Column(TIMESTAMP(timezone=True))
    delivered_at = Column(TIMESTAMP(timezone=True))
    deleted_at = Column(TIMESTAMP(timezone=True), nullable=True)  # Soft-delete support
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), onupdate=func.now())

    customer = relationship("Customer", back_populates="orders")
    parts = relationship("OrderPart", back_populates="order", cascade="all, delete-orphan")
    parts_legacy = relationship("Part", back_populates="order", cascade="all, delete-orphan")
    audit_logs = relationship("AuditLog", back_populates="order")


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

class Part(Base):
    __tablename__ = "parts"
    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)
    part_group = Column(Enum(PartGroupEnum), nullable=False)
    material_name = Column(String, nullable=False)
    thickness_mm = Column(Numeric(5, 2), nullable=False)
    length_mm = Column(Numeric(10, 2), nullable=False)
    width_mm = Column(Numeric(10, 2), nullable=False)
    quantity = Column(Integer, nullable=False)
    grain = Column(Enum(GrainDirectionEnum), default=GrainDirectionEnum.ZERO)
    edge_banding_u1 = Column(String)
    edge_banding_u2 = Column(String)
    edge_banding_k1 = Column(String)
    edge_banding_k2 = Column(String)
    description = Column(Text)
    order = relationship("Order", back_populates="parts_legacy")

class StatusLog(Base):
    __tablename__ = "status_logs"
    id = Column(Integer, primary_key=True, index=True)
    part_id = Column(Integer, ForeignKey("parts.id"), nullable=False)
    station_id = Column(Integer, ForeignKey("stations.id"), nullable=False)
    status = Column(String, nullable=False)
    log_message = Column(Text)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())

class Log(Base):
    __tablename__ = "logs"
    id = Column(Integer, primary_key=True, index=True)
    level = Column(String, nullable=False)
    message = Column(Text, nullable=False)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())

class Message(Base):
    __tablename__ = "messages"
    id = Column(Integer, primary_key=True, index=True)
    customer_id = Column(Integer, ForeignKey("customers.id"))
    order_id = Column(Integer, ForeignKey("orders.id"))
    template_name = Column(String, nullable=False)
    status = Column(String, nullable=False)
    delivery_attempts = Column(Integer, default=0)
    last_attempt_at = Column(TIMESTAMP(timezone=True))
    # Okunma takibi için yeni alanlar
    message_id = Column(String, unique=True)  # WhatsApp message ID
    read_at = Column(TIMESTAMP(timezone=True))  # Okunma zamanı
    row_number = Column(Integer)  # Okunmayan satır numarası zorunlu
    is_read = Column(Boolean, default=False)  # Okunma durumu
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())


# ═══════════════════════════════════════════════════
# OCR MODELLERİ
# ═══════════════════════════════════════════════════

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


class OrderPart(Base):
    __tablename__ = "order_parts"
    
    id = Column(String, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)
    
    # New flow fields (used by orders router + export/import)
    part_group = Column(String)
    boy_mm = Column(Numeric(10, 2))
    en_mm = Column(Numeric(10, 2))
    grain_code = Column(String, default="0-Material")
    u1 = Column(Boolean, default=False)
    u2 = Column(Boolean, default=False)
    k1 = Column(Boolean, default=False)
    k2 = Column(Boolean, default=False)
    part_desc = Column(Text)
    drill_code_1 = Column(String)
    drill_code_2 = Column(String)

    # Legacy OCR-derived fields kept for compatibility
    line_number = Column(Integer)
    boy = Column(Numeric(10, 2))
    en = Column(Numeric(10, 2))
    adet = Column(Integer, default=1)
    grain = Column(String, default="0-Material")
    info = Column(Text)
    
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    order = relationship("Order", back_populates="parts")


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


# ── Audit Columns Base Model ──
class AuditMixin:
    """
    Mixin providing audit trail columns for data models.
    Add to models that need track record of who created/updated them.
    
    Columns:
    - created_at: Timestamp when record was created
    - updated_at: Timestamp when record was last updated
    - created_by: User ID who created the record
    - updated_by: User ID who last updated the record
    - deleted_at: Timestamp when record was soft-deleted (null = active)
    """
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    created_by = Column(Integer, ForeignKey('users.id'), nullable=True)
    updated_by = Column(Integer, ForeignKey('users.id'), nullable=True)
    deleted_at = Column(TIMESTAMP(timezone=True), nullable=True)  # Soft-delete support


class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    email = Column(String, unique=True, nullable=False)
    name = Column(String)
    display_name = Column(String)
    password_hash = Column(String)
    role = Column(String, default="OPERATOR")  # ADMIN, OPERATOR, STATION
    is_active = Column(Boolean, default=True)
    last_login_at = Column(TIMESTAMP(timezone=True))
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())


class AuditLog(Base):
    __tablename__ = "audit_logs"
    
    id = Column(String, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    order_id = Column(Integer, ForeignKey("orders.id"))
    action = Column(String, nullable=False)
    detail = Column(Text)
    
    # Detaylı değişiklik kaydı
    table_name = Column(String)
    record_id = Column(String)
    old_values = Column(Text)  # JSON
    new_values = Column(Text)  # JSON
    
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    order = relationship("Order", back_populates="audit_logs")


# ═══════════════════════════════════════════════════
# AZURE MODELLERİ
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
# CRM MODÜLLERİ — Cari, Kontak, Fırsat, Teklif, Görev, Aktivite
# ═══════════════════════════════════════════════════════════════

class CRMAccount(Base):
    """Cari hesap (firma/bireysel müşteri)"""
    __tablename__ = "crm_accounts"

    id = Column(String, primary_key=True, index=True)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=True, index=True)
    company_name = Column(String, nullable=False, index=True)
    tax_id = Column(String, nullable=True, unique=True)
    tax_office = Column(String, nullable=True)
    account_type = Column(String, default="CORPORATE")  # CORPORATE, INDIVIDUAL
    industry = Column(String, nullable=True)
    website = Column(String, nullable=True)
    address = Column(Text, nullable=True)
    city = Column(String, nullable=True)
    district = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    email = Column(String, nullable=True)
    credit_limit = Column(Float, default=0)
    balance = Column(Float, default=0)
    payment_term_days = Column(Integer, default=30)
    tags = Column(Text, nullable=True)  # JSON array
    notes = Column(Text, nullable=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    is_active = Column(Boolean, default=True)
    mikro_cari_kod = Column(String, nullable=True, index=True)  # Mikro cari kodu
    
    # Mobilya Üretimi İçin Özel Alanlar
    dealer_type = Column(Enum(DealerTypeEnum), nullable=True)  # Bayi tipi
    installation_service_available = Column(Boolean, default=False)  # Montaj hizmeti
    delivery_days = Column(Integer, nullable=True)  # Ortalama teslimat süresi (gün)
    warehouse_location = Column(String, nullable=True)  # Depo lokasyonu
    preferred_materials = Column(Text, nullable=True)  # JSON: ["MDF", "Lam", "Suntalam"]
    preferred_colors = Column(Text, nullable=True)  # JSON: ["Beyaz", "Antrasit", "Meşe"]
    min_order_amount = Column(Float, nullable=True)  # Minimum sipariş tutarı
    discount_rate = Column(Float, default=0)  # Özel indirim oranı (%)
    
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), onupdate=func.now())

    customer = relationship("Customer", backref="crm_account")
    contacts = relationship("CRMContact", back_populates="account", cascade="all, delete-orphan")
    opportunities = relationship("CRMOpportunity", back_populates="account")
    quotes = relationship("CRMQuote", back_populates="account")


class CRMContact(Base):
    """İletişim kişisi"""
    __tablename__ = "crm_contacts"

    id = Column(String, primary_key=True, index=True)
    account_id = Column(String, ForeignKey("crm_accounts.id"), nullable=False, index=True)
    first_name = Column(String, nullable=False)
    last_name = Column(String, nullable=False)
    title = Column(String, nullable=True)
    department = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    mobile = Column(String, nullable=True)
    email = Column(String, nullable=True)
    is_primary = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    notes = Column(Text, nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), onupdate=func.now())

    account = relationship("CRMAccount", back_populates="contacts")


class CRMOpportunity(Base):
    """Satış fırsatı (pipeline)"""
    __tablename__ = "crm_opportunities"

    id = Column(String, primary_key=True, index=True)
    account_id = Column(String, ForeignKey("crm_accounts.id"), nullable=False, index=True)
    contact_id = Column(String, ForeignKey("crm_contacts.id"), nullable=True)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    stage = Column(Enum(OpportunityStageEnum), default=OpportunityStageEnum.LEAD, nullable=False)
    amount = Column(Float, default=0)
    currency = Column(String, default="TRY")
    probability = Column(Integer, default=0)  # 0-100
    expected_close_date = Column(TIMESTAMP(timezone=True), nullable=True)
    actual_close_date = Column(TIMESTAMP(timezone=True), nullable=True)
    lost_reason = Column(Text, nullable=True)
    source = Column(String, nullable=True)  # WEB, REFERRAL, COLD_CALL, vb.
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=True)   # Siparişe dönüşünce
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), onupdate=func.now())

    account = relationship("CRMAccount", back_populates="opportunities")
    contact = relationship("CRMContact")
    order = relationship("Order")
    quotes = relationship("CRMQuote", back_populates="opportunity")
    activities = relationship("CRMActivity", back_populates="opportunity")
    tasks = relationship("CRMTask", back_populates="opportunity")


class CRMQuote(Base):
    """Teklif"""
    __tablename__ = "crm_quotes"

    id = Column(String, primary_key=True, index=True)
    account_id = Column(String, ForeignKey("crm_accounts.id"), nullable=False, index=True)
    opportunity_id = Column(String, ForeignKey("crm_opportunities.id"), nullable=True)
    quote_number = Column(String, unique=True, nullable=False, index=True)
    revision = Column(Integer, default=1)
    status = Column(Enum(QuoteStatusEnum), default=QuoteStatusEnum.DRAFT, nullable=False)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    subtotal = Column(Float, default=0)
    tax_rate = Column(Float, default=20)
    tax_amount = Column(Float, default=0)
    discount_rate = Column(Float, default=0)
    discount_amount = Column(Float, default=0)
    total = Column(Float, default=0)
    currency = Column(String, default="TRY")
    valid_until = Column(TIMESTAMP(timezone=True), nullable=True)
    notes = Column(Text, nullable=True)
    terms = Column(Text, nullable=True)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), onupdate=func.now())

    account = relationship("CRMAccount", back_populates="quotes")
    opportunity = relationship("CRMOpportunity", back_populates="quotes")
    lines = relationship("CRMQuoteLine", back_populates="quote", cascade="all, delete-orphan")


class CRMQuoteLine(Base):
    """Teklif satırı"""
    __tablename__ = "crm_quote_lines"

    id = Column(String, primary_key=True, index=True)
    quote_id = Column(String, ForeignKey("crm_quotes.id"), nullable=False, index=True)
    line_number = Column(Integer, nullable=False)
    product_code = Column(String, nullable=True)
    description = Column(String, nullable=False)
    quantity = Column(Float, default=1)
    unit = Column(String, default="ADET")
    unit_price = Column(Float, default=0)
    discount_rate = Column(Float, default=0)
    tax_rate = Column(Float, default=20)
    line_total = Column(Float, default=0)
    mikro_stok_kod = Column(String, nullable=True)  # Mikro stok kodu eşlemesi
    
    # Mobilya Üretimi İçin Ürün Detayları
    material_name = Column(String, nullable=True)  # Malzeme (MDF, Lam, Suntalam)
    color = Column(String, nullable=True)  # Renk
    thickness_mm = Column(Numeric(5, 2), nullable=True)  # Kalınlık (mm)
    dimensions = Column(String, nullable=True)  # Boyutlar (örn: 2800x2070)
    grain_direction = Column(String, nullable=True)  # Damar yönü (0-Material, 1-Boyuna, 2-Enine)
    band_included = Column(Boolean, default=False)  # Bantlama dahil mi?
    drilling_included = Column(Boolean, default=False)  # Delme dahil mi?
    
    notes = Column(Text, nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())

    quote = relationship("CRMQuote", back_populates="lines")


class CRMTask(Base):
    """CRM Görevi"""
    __tablename__ = "crm_tasks"

    id = Column(String, primary_key=True, index=True)
    opportunity_id = Column(String, ForeignKey("crm_opportunities.id"), nullable=True)
    account_id = Column(String, ForeignKey("crm_accounts.id"), nullable=True)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    priority = Column(Enum(TaskPriorityEnum), default=TaskPriorityEnum.MEDIUM)
    status = Column(Enum(TaskStatusEnum), default=TaskStatusEnum.TODO)
    due_date = Column(TIMESTAMP(timezone=True), nullable=True)
    completed_at = Column(TIMESTAMP(timezone=True), nullable=True)
    assigned_to_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), onupdate=func.now())

    opportunity = relationship("CRMOpportunity", back_populates="tasks")


class CRMActivity(Base):
    """CRM Aktivitesi (arama, toplantı, not, vb.)"""
    __tablename__ = "crm_activities"

    id = Column(String, primary_key=True, index=True)
    opportunity_id = Column(String, ForeignKey("crm_opportunities.id"), nullable=True)
    account_id = Column(String, ForeignKey("crm_accounts.id"), nullable=True)
    contact_id = Column(String, ForeignKey("crm_contacts.id"), nullable=True)
    activity_type = Column(Enum(ActivityTypeEnum), nullable=False)
    subject = Column(String, nullable=False)
    body = Column(Text, nullable=True)
    duration_minutes = Column(Integer, nullable=True)
    activity_date = Column(TIMESTAMP(timezone=True), server_default=func.now())
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())

    opportunity = relationship("CRMOpportunity", back_populates="activities")


class CRMNote(Base):
    """Genel notlar (herhangi bir CRM kaydına bağlanabilir)"""
    __tablename__ = "crm_notes"

    id = Column(String, primary_key=True, index=True)
    entity_type = Column(String, nullable=False)  # account, contact, opportunity, quote
    entity_id = Column(String, nullable=False, index=True)
    content = Column(Text, nullable=False)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), onupdate=func.now())


# ═══════════════════════════════════════════════════════════════
# TAHSİLAT MODÜLLERİ — Fatura, Ödeme, Ödeme Sözü Takibi
# ═══════════════════════════════════════════════════════════════

class Invoice(Base):
    """Fatura Tablosu"""
    __tablename__ = "invoices"

    id = Column(String, primary_key=True, index=True)
    invoice_number = Column(String, unique=True, nullable=False, index=True)
    invoice_type = Column(String, default="SALES", nullable=False)  # SALES, PROFORMA, RETURN
    
    # İlişkiler
    account_id = Column(String, ForeignKey("crm_accounts.id"), nullable=False, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=True, index=True)
    quote_id = Column(String, ForeignKey("crm_quotes.id"), nullable=True)
    
    # Finansal Bilgiler
    subtotal = Column(Float, default=0, nullable=False)
    tax_rate = Column(Float, default=20, nullable=False)
    tax_amount = Column(Float, default=0, nullable=False)
    discount_amount = Column(Float, default=0)
    total_amount = Column(Float, default=0, nullable=False)
    paid_amount = Column(Float, default=0, nullable=False)
    remaining_amount = Column(Float, default=0, nullable=False)
    currency = Column(String, default="TRY")
    
    # Durum ve Tarihler
    status = Column(Enum(PaymentStatusEnum), default=PaymentStatusEnum.PENDING, nullable=False)
    issue_date = Column(TIMESTAMP(timezone=True), server_default=func.now())
    due_date = Column(TIMESTAMP(timezone=True), nullable=True)
    payment_completed_at = Column(TIMESTAMP(timezone=True), nullable=True)
    
    # Entegrasyon
    mikro_invoice_id = Column(String, nullable=True, index=True)
    
    # Ödeme Hatırlatıcısı Bilgileri
    reminder_type = Column(Enum(ReminderTypeEnum), nullable=True)  # Hatırlatıcı türü
    reminder_sent = Column(Boolean, default=False)  # Hatırlatıcı gönderildi mi?  
    reminder_sent_at = Column(TIMESTAMP(timezone=True), nullable=True)  # Gönderilme tarihi
    reminder_status = Column(Enum(ReminderStatusEnum), default=ReminderStatusEnum.PENDING, nullable=True)  # Hatırlatıcı durumu
    next_reminder_date = Column(TIMESTAMP(timezone=True), nullable=True)  # Sonraki hatırlatma tarihi
    reminder_count = Column(Integer, default=0)  # Kaç kez hatırlatılmış
    
    notes = Column(Text, nullable=True)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), onupdate=func.now())

    # Relationships
    payments = relationship("Payment", back_populates="invoice", cascade="all, delete-orphan")
    payment_promises = relationship("PaymentPromise", back_populates="invoice", cascade="all, delete-orphan")


class Payment(Base):
    """Ödeme Tablosu"""
    __tablename__ = "payments"

    id = Column(String, primary_key=True, index=True)
    payment_number = Column(String, unique=True, nullable=False, index=True)
    
    # İlişkiler
    invoice_id = Column(String, ForeignKey("invoices.id"), nullable=False, index=True)
    account_id = Column(String, ForeignKey("crm_accounts.id"), nullable=False, index=True)
    
    # Ödeme Detayları
    payment_method = Column(Enum(PaymentMethodEnum), nullable=False)
    amount = Column(Float, nullable=False)
    currency = Column(String, default="TRY")
    payment_date = Column(TIMESTAMP(timezone=True), server_default=func.now())
    
    # Ödeme Yöntemi Detayları
    check_number = Column(String, nullable=True)        # Çek numarası
    check_date = Column(TIMESTAMP(timezone=True), nullable=True)  # Çek vadesi
    check_bank = Column(String, nullable=True)          # Çek bankası
    card_last_4 = Column(String, nullable=True)         # Kart son 4 hane
    transaction_ref = Column(String, nullable=True)     # Havale/EFT referansı
    
    # Entegrasyon
    mikro_payment_id = Column(String, nullable=True)
    
    notes = Column(Text, nullable=True)
    is_cancelled = Column(Boolean, default=False)
    cancelled_at = Column(TIMESTAMP(timezone=True), nullable=True)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), onupdate=func.now())

    # Relationships
    invoice = relationship("Invoice", back_populates="payments")


class PaymentPromise(Base):
    """Ödeme Sözü Takibi"""
    __tablename__ = "payment_promises"

    id = Column(String, primary_key=True, index=True)
    
    # İlişkiler
    invoice_id = Column(String, ForeignKey("invoices.id"), nullable=False, index=True)
    account_id = Column(String, ForeignKey("crm_accounts.id"), nullable=False, index=True)
    
    # Söz Detayları
    promised_amount = Column(Float, nullable=False)
    promise_date = Column(TIMESTAMP(timezone=True), nullable=False, index=True)  # Ödeme sözü verilen tarih
    payment_method = Column(Enum(PaymentMethodEnum), nullable=True)  # Ödenecek yöntem
    
    # Durum
    status = Column(String, default="PENDING", nullable=False)  # PENDING, KEPT, BROKEN, POSTPONED
    is_fulfilled = Column(Boolean, default=False)
    fulfilled_at = Column(TIMESTAMP(timezone=True), nullable=True)
    fulfilled_payment_id = Column(String, ForeignKey("payments.id"), nullable=True)  # Gerçekleşen ödeme
    
    # Hatırlatma
    reminder_sent = Column(Boolean, default=False)
    reminder_sent_at = Column(TIMESTAMP(timezone=True), nullable=True)
    
    # İletişim Notları
    contact_person = Column(String, nullable=True)      # Görüşülen kişi
    contact_note = Column(Text, nullable=True)          # Görüşme notu
    
    notes = Column(Text, nullable=True)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), onupdate=func.now())

    # Relationships
    invoice = relationship("Invoice", back_populates="payment_promises")


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


# ═══════════════════════════════════════════════════════════════
# KULLANICI AKTİVİTE & OTURUM YÖNETİMİ MODELLERİ
# ═══════════════════════════════════════════════════════════════

class UserSession(Base):
    """Kullanıcı oturum kaydı (login/logout tracking)"""
    __tablename__ = "user_sessions"
    
    id = Column(String, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    
    # Oturum detayları
    ip_address = Column(String, nullable=True)
    user_agent = Column(String, nullable=True)  # Browser/device info
    device_type = Column(String, nullable=True)  # WEB, MOBILE, API, etc.
    location = Column(String, nullable=True)  # Geo-location (if available)
    
    # Saatler
    login_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)
    logout_at = Column(TIMESTAMP(timezone=True), nullable=True)
    last_activity_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    
    # Durum
    is_active = Column(Boolean, default=True)
    was_terminated = Column(Boolean, default=False)  # Force logout
    
    # Meta
    session_token = Column(String, unique=True, nullable=True, index=True)
    
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), onupdate=func.now())


class UserActivity(Base):
    """Kullanıcı aktivite kaydı (CREATE, UPDATE, DELETE, LOGIN, LOGOUT, etc.)"""
    __tablename__ = "user_activities"
    
    id = Column(String, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    session_id = Column(String, ForeignKey("user_sessions.id"), nullable=True)
    
    # Aktivite bilgileri
    activity_type = Column(String, nullable=False, index=True)  # LOGIN, LOGOUT, CREATE, UPDATE, DELETE, VIEW, EXPORT, IMPORT, etc.
    resource_type = Column(String, nullable=False, index=True)  # order, user, station, config, invoice, etc.
    resource_id = Column(String, nullable=True, index=True)  # Which order/user/etc was affected
    resource_name = Column(String, nullable=True)  # e.g., "Order #123", "User John"
    
    # Detaylar
    description = Column(Text, nullable=True)  # Activity description
    changes_from = Column(Text, nullable=True)  # JSON: old values
    changes_to = Column(Text, nullable=True)  # JSON: new values
    
    # Request bilgileri
    ip_address = Column(String, nullable=True)
    user_agent = Column(String, nullable=True)
    method = Column(String, nullable=True)  # GET, POST, PUT, DELETE
    endpoint = Column(String, nullable=True)  # API endpoint used
    
    # Sonuç
    status = Column(String, nullable=False, default="SUCCESS")  # SUCCESS, FAILED, PARTIAL
    error_message = Column(Text, nullable=True)
    
    # Zaman
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False, index=True)
    duration_ms = Column(Integer, nullable=True)  # Operation duration


class AuditRecord(Base):
    """Detaylı denetim kaydı (audit trail with change tracking)"""
    __tablename__ = "audit_records"
    
    id = Column(String, primary_key=True, index=True)
    
    # Who
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    user_name = Column(String, nullable=True)
    
    # When
    timestamp = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False, index=True)
    
    # What
    entity_type = Column(String, nullable=False, index=True)  # order, customer, invoice, user, etc.
    entity_id = Column(String, nullable=False, index=True)
    entity_name = Column(String, nullable=True)  # Human-readable entity name
    
    # Operation
    operation = Column(String, nullable=False)  # CREATE, READ, UPDATE, DELETE
    
    # Changes (field-level tracking)
    field_name = Column(String, nullable=True)  # Which field changed
    old_value = Column(Text, nullable=True)  # JSON-serialized old value
    new_value = Column(Text, nullable=True)  # JSON-serialized new value
    
    # Context
    reason = Column(Text, nullable=True)  # Why was it changed?
    ip_address = Column(String, nullable=True)
    user_agent = Column(String, nullable=True)
    
    # Result
    success = Column(Boolean, default=True)
    error_message = Column(Text, nullable=True)
    
    # Indexing for common queries
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False, index=True)


# ═══════════════════════════════════════════════════════════════
# ÜRÜN MODELİ — Master Data + Spec + Supplier + SKU
# ═══════════════════════════════════════════════════════════════

class IncomingSpecStatusEnum(str, enum.Enum):
    PENDING = "PENDING"
    MATCHED = "MATCHED"
    AMBIGUOUS = "AMBIGUOUS"
    NO_MATCH = "NO_MATCH"


class Brand(Base):
    """Marka / tedarikçi firma"""
    __tablename__ = "brands"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String, unique=True, nullable=False, index=True)
    name = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), onupdate=func.now())

    supplier_items = relationship("SupplierItem", back_populates="brand")


class Color(Base):
    """Renk tanımı"""
    __tablename__ = "colors"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String, unique=True, nullable=False, index=True)
    name = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())

    specs = relationship("MaterialSpec", back_populates="color")


class ProductType(Base):
    """Ürün tipi (MDF, Lam, Suntalam, vb.)"""
    __tablename__ = "product_types"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String, unique=True, nullable=False, index=True)
    short_code = Column(String, unique=True, nullable=False, index=True)
    name = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())

    specs = relationship("MaterialSpec", back_populates="product_type")


class MaterialSpec(Base):
    """Firma bağımsız malzeme özellik seti"""
    __tablename__ = "material_specs"

    id = Column(Integer, primary_key=True, index=True)
    product_type_id = Column(Integer, ForeignKey("product_types.id"), nullable=False, index=True)
    color_id = Column(Integer, ForeignKey("colors.id"), nullable=False, index=True)
    thickness_mm = Column(Numeric(5, 2), nullable=False)
    width_cm = Column(Numeric(10, 2), nullable=False)
    height_cm = Column(Numeric(10, 2), nullable=False)
    spec_code = Column(String, unique=True, nullable=True, index=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), onupdate=func.now())

    product_type = relationship("ProductType", back_populates="specs")
    color = relationship("Color", back_populates="specs")
    supplier_items = relationship("SupplierItem", back_populates="spec")

    __table_args__ = (
        # UNIQUE(product_type_id, color_id, thickness_mm, width_cm, height_cm)
        {"sqlite_autoincrement": True},
    )


class SupplierItem(Base):
    """Firma varyantı (aynı spec'in marka bazlı versiyonu)"""
    __tablename__ = "supplier_items"

    id = Column(Integer, primary_key=True, index=True)
    spec_id = Column(Integer, ForeignKey("material_specs.id"), nullable=False, index=True)
    brand_id = Column(Integer, ForeignKey("brands.id"), nullable=False, index=True)
    display_name = Column(String, nullable=True)
    is_default = Column(Boolean, default=False)
    priority = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), onupdate=func.now())

    spec = relationship("MaterialSpec", back_populates="supplier_items")
    brand = relationship("Brand", back_populates="supplier_items")
    items = relationship("Item", back_populates="supplier_item")


class Item(Base):
    """SKU — satışa hazır ürün kartı"""
    __tablename__ = "items"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String, unique=True, nullable=False, index=True)
    supplier_item_id = Column(Integer, ForeignKey("supplier_items.id"), nullable=False, index=True)
    unit = Column(String, default="ADET")
    vat_rate = Column(Float, default=20.0)
    default_price = Column(Numeric(12, 2), nullable=True)
    barcode = Column(String, nullable=True, unique=True)
    mikro_stok_kodu = Column(String, nullable=True, index=True)
    mikro_hizmet_kodu = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), onupdate=func.now())

    supplier_item = relationship("SupplierItem", back_populates="items")


class IncomingSpec(Base):
    """OptiPlanning'den gelen firma bilgisi olmayan satırlar"""
    __tablename__ = "incoming_specs"

    id = Column(Integer, primary_key=True, index=True)
    external_line_id = Column(String, unique=True, nullable=True)
    product_type_short = Column(String, nullable=True)
    normalized_type_id = Column(Integer, ForeignKey("product_types.id"), nullable=True)
    color_text = Column(String, nullable=True)
    normalized_color_id = Column(Integer, ForeignKey("colors.id"), nullable=True)
    thickness_mm = Column(Numeric(5, 2), nullable=True)
    width_cm = Column(Numeric(10, 2), nullable=True)
    height_cm = Column(Numeric(10, 2), nullable=True)
    spec_hash = Column(String, nullable=True, index=True)
    status = Column(Enum(IncomingSpecStatusEnum), default=IncomingSpecStatusEnum.PENDING, nullable=False)
    chosen_brand_id = Column(Integer, ForeignKey("brands.id"), nullable=True)
    chosen_item_id = Column(Integer, ForeignKey("items.id"), nullable=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), onupdate=func.now())


class ProductRequest(Base):
    """NO_MATCH durumunda ürün talebi"""
    __tablename__ = "product_requests"

    id = Column(Integer, primary_key=True, index=True)
    spec_hash = Column(String, nullable=True, index=True)
    product_type_short = Column(String, nullable=True)
    color_text = Column(String, nullable=True)
    thickness_mm = Column(Numeric(5, 2), nullable=True)
    width_cm = Column(Numeric(10, 2), nullable=True)
    height_cm = Column(Numeric(10, 2), nullable=True)
    status = Column(String, default="OPEN")  # OPEN, RESOLVED, REJECTED
    resolved_item_id = Column(Integer, ForeignKey("items.id"), nullable=True)
    notes = Column(Text, nullable=True)
    requested_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    resolved_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), onupdate=func.now())


# ═══════════════════════════════════════════════════════════════
# ORCHESTRATOR JOB YÖNETİMİ
# ═══════════════════════════════════════════════════════════════

class OptiJobStateEnum(str, enum.Enum):
    NEW = "NEW"
    PREPARED = "PREPARED"
    OPTI_IMPORTED = "OPTI_IMPORTED"
    OPTI_RUNNING = "OPTI_RUNNING"
    OPTI_DONE = "OPTI_DONE"
    XML_READY = "XML_READY"
    DELIVERED = "DELIVERED"
    DONE = "DONE"
    HOLD = "HOLD"
    FAILED = "FAILED"

class OptiModeEnum(str, enum.Enum):
    A = "A"
    B = "B"
    C = "C"

class OptiJob(Base):
    """Orchestrator job kaydı — backend görünürlüğü için"""
    __tablename__ = "opti_jobs"

    id = Column(String, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False, index=True)
    state = Column(Enum(OptiJobStateEnum), default=OptiJobStateEnum.NEW, nullable=False, index=True)
    opti_mode = Column(Enum(OptiModeEnum), default=OptiModeEnum.C)
    error_code = Column(String, nullable=True)
    error_message = Column(Text, nullable=True)
    retry_count = Column(Integer, default=0)
    payload_hash = Column(String, nullable=True)
    claim_token = Column(String, nullable=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), onupdate=func.now())

    order = relationship("Order")
    events = relationship("OptiAuditEvent", back_populates="job", cascade="all, delete-orphan")


class OptiAuditEvent(Base):
    """Orchestrator job denetim olayı"""
    __tablename__ = "opti_audit_events"

    id = Column(Integer, primary_key=True, autoincrement=True)
    job_id = Column(String, ForeignKey("opti_jobs.id"), nullable=False, index=True)
    event_type = Column(String, nullable=False)  # STATE_CHANGE, ERROR, RETRY, APPROVE
    message = Column(Text)
    details_json = Column(Text, nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())

    job = relationship("OptiJob", back_populates="events")


# ── Price Tracking Modelleri ──

class PriceJobStatusEnum(str, enum.Enum):
    PENDING = "PENDING"
    PROCESSING = "PROCESSING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


class PriceUploadJob(Base):
    """Fiyat listesi yükleme işi"""
    __tablename__ = "price_upload_jobs"

    id = Column(String, primary_key=True, index=True)
    status = Column(String, default=PriceJobStatusEnum.PENDING.value)
    original_filename = Column(String)
    content_type = Column(String)
    file_size = Column(Integer)
    file_data = Column(LargeBinary)
    supplier = Column(String, nullable=False)
    rows_extracted = Column(Integer, default=0)
    error_message = Column(Text, nullable=True)
    uploaded_by_id = Column(Integer, ForeignKey("users.id"))
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())

    items = relationship("PriceItem", cascade="all, delete-orphan", back_populates="job")
    uploaded_by = relationship("User")


class PriceItem(Base):
    """Fiyat listesinden çıkarılan ürün satırı"""
    __tablename__ = "price_items"

    id = Column(String, primary_key=True, index=True)
    job_id = Column(String, ForeignKey("price_upload_jobs.id"), nullable=False, index=True)
    urun_kodu = Column(String, nullable=True)
    urun_adi = Column(String, nullable=False)
    birim = Column(String, default="ADET")
    liste_fiyati = Column(Numeric(12, 2), nullable=True)
    iskonto_orani = Column(Numeric(5, 2), default=0)
    net_fiyat = Column(Numeric(12, 2), nullable=True)
    kdv_orani = Column(Numeric(5, 2), default=20)
    kdv_dahil_fiyat = Column(Numeric(12, 2), nullable=True)
    para_birimi = Column(String, default="TRY")
    kategori = Column(String, nullable=True)
    marka = Column(String, nullable=True)
    tedarikci = Column(String, nullable=False)

    job = relationship("PriceUploadJob", back_populates="items")
