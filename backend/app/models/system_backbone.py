from app.database import Base

from sqlalchemy import TIMESTAMP, Column, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func


class SystemBackboneFlow(Base):
    __tablename__ = "system_backbone_flows"
    __table_args__ = (
        Index(
            "uq_system_backbone_flows_external_context",
            "external_id",
            "company_id",
            "branch_id",
            "fiscal_year",
            unique=True,
        ),
    )

    id = Column(String, primary_key=True, index=True)
    flow_name = Column(String, nullable=False, index=True)
    entity_type = Column(String, nullable=False, index=True)
    entity_id = Column(String, nullable=False, index=True)
    external_id = Column(String, nullable=True, index=True)
    company_id = Column(Integer, nullable=False, index=True)
    branch_id = Column(Integer, nullable=False, index=True)
    fiscal_year = Column(Integer, nullable=False, index=True)
    source_system = Column(String, nullable=False)
    target_system = Column(String, nullable=False)
    status = Column(String, nullable=False, index=True, default="PENDING")
    stage = Column(String, nullable=False, index=True, default="foundation")
    retry_count = Column(Integer, nullable=False, default=0)
    max_retries = Column(Integer, nullable=False, default=3)
    retry_cooldown_seconds = Column(Integer, nullable=False, default=0)
    last_error = Column(Text, nullable=True)
    metadata_json = Column(Text, nullable=True)
    last_retry_at = Column(TIMESTAMP(timezone=True), nullable=True)
    next_retry_at = Column(TIMESTAMP(timezone=True), nullable=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    updated_by = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        TIMESTAMP(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    audits = relationship(
        "SystemBackboneFlowAudit",
        back_populates="flow",
        cascade="all, delete-orphan",
    )


class SystemBackboneFlowAudit(Base):
    __tablename__ = "system_backbone_flow_audits"

    id = Column(Integer, primary_key=True, index=True)
    flow_id = Column(String, ForeignKey("system_backbone_flows.id", ondelete="CASCADE"), nullable=False, index=True)
    event_type = Column(String, nullable=False, index=True)
    message = Column(Text, nullable=False)
    payload_json = Column(Text, nullable=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False, index=True)

    flow = relationship("SystemBackboneFlow", back_populates="audits")
