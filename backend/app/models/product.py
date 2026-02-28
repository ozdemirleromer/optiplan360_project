from app.database import Base
from sqlalchemy import TIMESTAMP, Boolean, Column, Float, ForeignKey, Integer, Numeric, String
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

# ═══════════════════════════════════════════════════════════════
# ÜRÜN MODELİ — Master Data + Spec + Supplier + SKU
# ═══════════════════════════════════════════════════════════════


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
