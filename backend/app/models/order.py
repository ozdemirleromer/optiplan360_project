from sqlalchemy import Column, Integer, String, ForeignKey, Enum, Numeric, TIMESTAMP, Text, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base
from .enums import OrderStatusEnum, PartGroupEnum, GrainDirectionEnum, OptiJobStateEnum, OptiModeEnum, IncomingSpecStatusEnum

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
    order_no = Column(Integer, unique=True, index=True, nullable=True)  # Sıralı sipariş numarası
    customer_id = Column(Integer, ForeignKey("customers.id"))
    crm_name_snapshot = Column(String)
    ts_code = Column(String, unique=True, nullable=False)
    tracking_token = Column(String(36), unique=True, index=True, nullable=True)
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
    reminder_count = Column(Integer, default=0, nullable=True)
    last_reminder_at = Column(TIMESTAMP(timezone=True), nullable=True)

    customer = relationship("Customer", back_populates="orders")
    parts = relationship("OrderPart", back_populates="order", cascade="all, delete-orphan")
    parts_legacy = relationship("Part", back_populates="order", cascade="all, delete-orphan")
    audit_logs = relationship("AuditLog", back_populates="order")

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

# ═══════════════════════════════════════════════════════════════
# ORCHESTRATOR JOB YÖNETİMİ
# ═══════════════════════════════════════════════════════════════

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
    xml_file_path = Column(String, nullable=True)
    result_json = Column(Text, nullable=True)  # XML parse sonucu (plaka adedi, maliyet, bant vb.)
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
