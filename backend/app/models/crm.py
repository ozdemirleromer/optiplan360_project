from app.database import Base
from sqlalchemy import (
    TIMESTAMP,
    Boolean,
    Column,
    Enum,
    Float,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from .enums import (
    ActivityTypeEnum,
    DealerTypeEnum,
    OpportunityStageEnum,
    QuoteStatusEnum,
    TaskPriorityEnum,
    TaskStatusEnum,
)

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
    plaka_birim_fiyat = Column(Float, nullable=True)  # Müşteriye özel plaka fiyatı (TL/adet)
    bant_metre_fiyat = Column(Float, nullable=True)  # Müşteriye özel bant fiyatı (TL/metre)

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
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=True)  # Siparişe dönüşünce
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
# MÜŞTERİ DESTEK (TICKET) MODÜLÜ
# ═══════════════════════════════════════════════════════════════


class CRMTicket(Base):
    """Müşteri destek talebi (Ticket)"""

    __tablename__ = "crm_tickets"

    id = Column(String, primary_key=True, index=True)
    account_id = Column(String, ForeignKey("crm_accounts.id"), nullable=False, index=True)
    subject = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    status = Column(String, default="OPEN", index=True)  # OPEN, IN_PROGRESS, RESOLVED, CLOSED
    priority = Column(String, default="NORMAL")  # LOW, NORMAL, HIGH, URGENT

    assigned_to_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), onupdate=func.now())

    account = relationship("CRMAccount", backref="tickets")
    messages = relationship(
        "CRMTicketMessage",
        back_populates="ticket",
        cascade="all, delete-orphan",
        order_by="CRMTicketMessage.created_at",
    )


class CRMTicketMessage(Base):
    """Destek talebi (Ticket) altındaki yanıtlar/mesajlar"""

    __tablename__ = "crm_ticket_messages"

    id = Column(String, primary_key=True, index=True)
    ticket_id = Column(String, ForeignKey("crm_tickets.id"), nullable=False, index=True)
    sender_id = Column(Integer, ForeignKey("users.id"), nullable=False)  # Müşteri veya Operatör ID
    message = Column(Text, nullable=False)
    is_internal = Column(
        Boolean, default=False
    )  # Operatörlerin sadece kendi aralarında göreceği iç notlar

    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())

    ticket = relationship("CRMTicket", back_populates="messages")
    sender = relationship("User")
