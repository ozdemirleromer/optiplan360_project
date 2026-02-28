from app.database import Base
from sqlalchemy import TIMESTAMP, Boolean, Column, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func


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
    updated_at = Column(
        TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    updated_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    deleted_at = Column(TIMESTAMP(timezone=True), nullable=True)  # Soft-delete support


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    email = Column(String, unique=True, nullable=False)
    name = Column(String)
    display_name = Column(String)
    password_hash = Column(String)
    role = Column(String, default="OPERATOR")  # ADMIN, OPERATOR, STATION, CUSTOMER
    is_active = Column(Boolean, default=True)
    crm_account_id = Column(
        String, ForeignKey("crm_accounts.id"), nullable=True, index=True
    )  # Link user to a customer/portal layout
    last_login_at = Column(TIMESTAMP(timezone=True))
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())

    crm_account = relationship("CRMAccount", foreign_keys=[crm_account_id], backref="portal_users")


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
    activity_type = Column(
        String, nullable=False, index=True
    )  # LOGIN, LOGOUT, CREATE, UPDATE, DELETE, VIEW, EXPORT, IMPORT, etc.
    resource_type = Column(
        String, nullable=False, index=True
    )  # order, user, station, config, invoice, etc.
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
    created_at = Column(
        TIMESTAMP(timezone=True), server_default=func.now(), nullable=False, index=True
    )
    duration_ms = Column(Integer, nullable=True)  # Operation duration


class AuditRecord(Base):
    """Detaylı denetim kaydı (audit trail with change tracking)"""

    __tablename__ = "audit_records"

    id = Column(String, primary_key=True, index=True)

    # Who
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    user_name = Column(String, nullable=True)

    # When
    timestamp = Column(
        TIMESTAMP(timezone=True), server_default=func.now(), nullable=False, index=True
    )

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
    created_at = Column(
        TIMESTAMP(timezone=True), server_default=func.now(), nullable=False, index=True
    )


class Log(Base):
    __tablename__ = "logs"
    id = Column(Integer, primary_key=True, index=True)
    level = Column(String, nullable=False)
    message = Column(Text, nullable=False)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
