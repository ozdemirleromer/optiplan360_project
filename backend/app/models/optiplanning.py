from app.database import Base
from sqlalchemy import JSON, TIMESTAMP, Boolean, Column, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func


class MachineConfig(Base):
    """
    OptiPlanning makine konfigürasyonlarını tutar (Örn: Testere kalınlığı, hız ayarları vs.)
    """

    __tablename__ = "optiplanning_machine_configs"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    description = Column(Text, nullable=True)

    # Teknik Ayarlar
    saw_thickness = Column(Float, default=3.2)
    trim_top = Column(Float, default=10.0)
    trim_bottom = Column(Float, default=10.0)
    trim_left = Column(Float, default=10.0)
    trim_right = Column(Float, default=10.0)

    # Genel Makine Parametreleri (JSON olarak esnek tutulabilir)
    advanced_params = Column(JSON, nullable=True)

    is_active = Column(Boolean, default=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now())


class OptimizationJob(Base):
    """
    OptiPlanning üzerinde çalıştırılmış veya çalışmakta olan optimizasyon işlerinin durumu
    """

    __tablename__ = "optiplanning_jobs"

    id = Column(String, primary_key=True, index=True)  # UUID
    name = Column(String, index=True, nullable=False)

    status = Column(String, default="PENDING")  # PENDING, RUNNING, COMPLETED, FAILED
    format_type = Column(String, default="EXCEL")  # XML, OSI, EXCEL

    # Hangi siparişlerle ilişkili olduğu
    related_orders = Column(JSON, nullable=True)  # Sipariş ID'leri listesi ["1", "5", "10"]

    result_file_path = Column(String, nullable=True)
    error_message = Column(Text, nullable=True)

    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    completed_at = Column(TIMESTAMP(timezone=True), nullable=True)


class OptimizationReport(Base):
    """
    Tamamlanan işlemler sonucunda OptiPlanning'ten dönen verimlilik (yield) raporları
    """

    __tablename__ = "optiplanning_reports"

    id = Column(Integer, primary_key=True, index=True)
    job_id = Column(String, ForeignKey("optiplanning_jobs.id"), nullable=False, index=True)

    # Rapor Metrikleri
    total_parts = Column(Integer, default=0)
    total_boards_used = Column(Integer, default=0)
    yield_percentage = Column(Float, default=0.0)  # Verimlilik oranı örn: 85.5
    waste_percentage = Column(Float, default=0.0)

    report_data = Column(JSON, nullable=True)  # Detaylı analitik bilgiler

    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())

    job = relationship("OptimizationJob", backref="reports")
