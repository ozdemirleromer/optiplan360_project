from app.database import Base
from sqlalchemy import (
    TIMESTAMP,
    Boolean,
    Column,
    Enum,
    Float,
    ForeignKey,
    Integer,
    LargeBinary,
    Numeric,
    String,
    Text,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from .enums import (
    PaymentMethodEnum,
    PaymentStatusEnum,
    PriceJobStatusEnum,
    ReminderStatusEnum,
    ReminderTypeEnum,
)

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
    reminder_status = Column(
        Enum(ReminderStatusEnum), default=ReminderStatusEnum.PENDING, nullable=True
    )  # Hatırlatıcı durumu
    next_reminder_date = Column(
        TIMESTAMP(timezone=True), nullable=True
    )  # Sonraki hatırlatma tarihi
    reminder_count = Column(Integer, default=0)  # Kaç kez hatırlatılmış

    notes = Column(Text, nullable=True)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), onupdate=func.now())

    # Relationships
    payments = relationship("Payment", back_populates="invoice", cascade="all, delete-orphan")
    payment_promises = relationship(
        "PaymentPromise", back_populates="invoice", cascade="all, delete-orphan"
    )


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
    check_number = Column(String, nullable=True)  # Çek numarası
    check_date = Column(TIMESTAMP(timezone=True), nullable=True)  # Çek vadesi
    check_bank = Column(String, nullable=True)  # Çek bankası
    card_last_4 = Column(String, nullable=True)  # Kart son 4 hane
    transaction_ref = Column(String, nullable=True)  # Havale/EFT referansı

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
    promise_date = Column(
        TIMESTAMP(timezone=True), nullable=False, index=True
    )  # Ödeme sözü verilen tarih
    payment_method = Column(Enum(PaymentMethodEnum), nullable=True)  # Ödenecek yöntem

    # Durum
    status = Column(String, default="PENDING", nullable=False)  # PENDING, KEPT, BROKEN, POSTPONED
    is_fulfilled = Column(Boolean, default=False)
    fulfilled_at = Column(TIMESTAMP(timezone=True), nullable=True)
    fulfilled_payment_id = Column(
        String, ForeignKey("payments.id"), nullable=True
    )  # Gerçekleşen ödeme

    # Hatırlatma
    reminder_sent = Column(Boolean, default=False)
    reminder_sent_at = Column(TIMESTAMP(timezone=True), nullable=True)

    # İletişim Notları
    contact_person = Column(String, nullable=True)  # Görüşülen kişi
    contact_note = Column(Text, nullable=True)  # Görüşme notu

    notes = Column(Text, nullable=True)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), onupdate=func.now())

    # Relationships
    invoice = relationship("Invoice", back_populates="payment_promises")


# ── Price Tracking Modelleri ──


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
    boyut = Column(String, nullable=True)  # Ürün boyutu/ölçüsü (mm)
    renk = Column(String, nullable=True)  # Ürün rengi
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
