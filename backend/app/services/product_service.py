"""
Product Service — Spec-first arama, matching, CRUD
Doküman bölüm 4-6-7'ye göre uygulama
"""

import logging

from sqlalchemy import or_
from sqlalchemy.orm import Session

from ..exceptions import ConflictError, NotFoundError
from ..models import (
    Brand,
    Color,
    IncomingSpec,
    IncomingSpecStatusEnum,
    Item,
    MaterialSpec,
    ProductRequest,
    ProductType,
    SupplierItem,
)
from .code_generator import generate_item_code, generate_spec_code, generate_spec_hash

logger = logging.getLogger(__name__)


class ProductService:
    def __init__(self, db: Session):
        self.db = db

    # ═══════════════════════════════════════════
    # MASTER DATA CRUD
    # ═══════════════════════════════════════════

    def create_brand(self, code: str, name: str) -> Brand:
        existing = self.db.query(Brand).filter(Brand.code == code).first()
        if existing:
            raise ConflictError(f"Marka kodu zaten mevcut: {code}")
        brand = Brand(code=code, name=name)
        self.db.add(brand)
        self.db.commit()
        self.db.refresh(brand)
        return brand

    def list_brands(self, active_only: bool = True) -> list[Brand]:
        q = self.db.query(Brand)
        if active_only:
            q = q.filter(Brand.is_active == True)
        return q.order_by(Brand.name).all()

    def create_color(self, code: str, name: str) -> Color:
        existing = self.db.query(Color).filter(Color.code == code).first()
        if existing:
            raise ConflictError(f"Renk kodu zaten mevcut: {code}")
        color = Color(code=code, name=name)
        self.db.add(color)
        self.db.commit()
        self.db.refresh(color)
        return color

    def list_colors(self, active_only: bool = True) -> list[Color]:
        q = self.db.query(Color)
        if active_only:
            q = q.filter(Color.is_active == True)
        return q.order_by(Color.name).all()

    def create_product_type(self, code: str, short_code: str, name: str) -> ProductType:
        existing = (
            self.db.query(ProductType)
            .filter(or_(ProductType.code == code, ProductType.short_code == short_code))
            .first()
        )
        if existing:
            raise ConflictError(f"Ürün tipi kodu zaten mevcut: {code}/{short_code}")
        pt = ProductType(code=code, short_code=short_code, name=name)
        self.db.add(pt)
        self.db.commit()
        self.db.refresh(pt)
        return pt

    def list_product_types(self, active_only: bool = True) -> list[ProductType]:
        q = self.db.query(ProductType)
        if active_only:
            q = q.filter(ProductType.is_active == True)
        return q.order_by(ProductType.name).all()

    # ═══════════════════════════════════════════
    # MATERIAL SPEC CRUD
    # ═══════════════════════════════════════════

    def create_spec(
        self,
        product_type_id: int,
        color_id: int,
        thickness_mm: float,
        width_cm: float,
        height_cm: float,
    ) -> MaterialSpec:
        # Ürün tipi ve renk var mı?
        pt = self.db.query(ProductType).filter(ProductType.id == product_type_id).first()
        if not pt:
            raise NotFoundError("Ürün tipi", product_type_id)
        color = self.db.query(Color).filter(Color.id == color_id).first()
        if not color:
            raise NotFoundError("Renk", color_id)

        # Aynı spec var mı?
        existing = (
            self.db.query(MaterialSpec)
            .filter(
                MaterialSpec.product_type_id == product_type_id,
                MaterialSpec.color_id == color_id,
                MaterialSpec.thickness_mm == thickness_mm,
                MaterialSpec.width_cm == width_cm,
                MaterialSpec.height_cm == height_cm,
            )
            .first()
        )
        if existing:
            raise ConflictError(f"Bu spec zaten mevcut: ID={existing.id}")

        spec_code = generate_spec_code(pt.short_code, color.code, thickness_mm, width_cm, height_cm)

        spec = MaterialSpec(
            product_type_id=product_type_id,
            color_id=color_id,
            thickness_mm=thickness_mm,
            width_cm=width_cm,
            height_cm=height_cm,
            spec_code=spec_code,
        )
        self.db.add(spec)
        self.db.commit()
        self.db.refresh(spec)
        return spec

    def get_spec(self, spec_id: int) -> MaterialSpec:
        spec = self.db.query(MaterialSpec).filter(MaterialSpec.id == spec_id).first()
        if not spec:
            raise NotFoundError("MaterialSpec", spec_id)
        return spec

    # ═══════════════════════════════════════════
    # SUPPLIER ITEM + ITEM/SKU
    # ═══════════════════════════════════════════

    def create_supplier_item(
        self,
        spec_id: int,
        brand_id: int,
        display_name: str | None = None,
        is_default: bool = False,
        priority: int = 0,
    ) -> SupplierItem:
        existing = (
            self.db.query(SupplierItem)
            .filter(SupplierItem.spec_id == spec_id, SupplierItem.brand_id == brand_id)
            .first()
        )
        if existing:
            raise ConflictError(f"Bu spec+brand kombinasyonu zaten mevcut: ID={existing.id}")

        si = SupplierItem(
            spec_id=spec_id,
            brand_id=brand_id,
            display_name=display_name,
            is_default=is_default,
            priority=priority,
        )
        self.db.add(si)
        self.db.commit()
        self.db.refresh(si)
        return si

    def create_item(
        self,
        supplier_item_id: int,
        unit: str = "ADET",
        vat_rate: float = 20.0,
        default_price: float | None = None,
        barcode: str | None = None,
        mikro_stok_kodu: str | None = None,
    ) -> Item:
        si = self.db.query(SupplierItem).filter(SupplierItem.id == supplier_item_id).first()
        if not si:
            raise NotFoundError("SupplierItem", supplier_item_id)

        code = generate_item_code(self.db)

        item = Item(
            code=code,
            supplier_item_id=supplier_item_id,
            unit=unit,
            vat_rate=vat_rate,
            default_price=default_price,
            barcode=barcode,
            mikro_stok_kodu=mikro_stok_kodu,
        )
        self.db.add(item)
        self.db.commit()
        self.db.refresh(item)
        return item

    # ═══════════════════════════════════════════
    # SPEC-FIRST ARAMA (Doküman bölüm 6)
    # ═══════════════════════════════════════════

    def search_specs(
        self,
        query: str | None = None,
        product_type_id: int | None = None,
        color_id: int | None = None,
        thickness_mm: float | None = None,
        width_cm: float | None = None,
        height_cm: float | None = None,
        limit: int = 50,
    ) -> list[dict]:
        """
        Spec-first arama. Satışçı "BEYAZ 18" yazar → eşleşen spec'ler döner.
        Her spec için firma varyantları ve match_status hesaplanır.
        """
        q = (
            self.db.query(MaterialSpec)
            .join(ProductType)
            .join(Color)
            .filter(MaterialSpec.is_active == True)
        )

        if product_type_id:
            q = q.filter(MaterialSpec.product_type_id == product_type_id)
        if color_id:
            q = q.filter(MaterialSpec.color_id == color_id)
        if thickness_mm:
            q = q.filter(MaterialSpec.thickness_mm == thickness_mm)
        if width_cm:
            q = q.filter(MaterialSpec.width_cm == width_cm)
        if height_cm:
            q = q.filter(MaterialSpec.height_cm == height_cm)

        # Serbest metin arama
        if query:
            terms = query.strip().upper().split()
            for term in terms:
                q = q.filter(
                    or_(
                        ProductType.short_code.ilike(f"%{term}%"),
                        ProductType.name.ilike(f"%{term}%"),
                        Color.code.ilike(f"%{term}%"),
                        Color.name.ilike(f"%{term}%"),
                        MaterialSpec.spec_code.ilike(f"%{term}%"),
                        MaterialSpec.thickness_mm == _try_float(term),
                    )
                )

        specs = q.limit(limit).all()

        results = []
        for spec in specs:
            supplier_items = (
                self.db.query(SupplierItem)
                .filter(SupplierItem.spec_id == spec.id, SupplierItem.is_active == True)
                .order_by(SupplierItem.priority.desc())
                .all()
            )
            count = len(supplier_items)
            if count == 0:
                status = "NO_MATCH"
            elif count == 1:
                status = "MATCHED"
            else:
                status = "AMBIGUOUS"

            results.append(
                {
                    "spec": spec,
                    "product_type": spec.product_type,
                    "color": spec.color,
                    "supplier_items": supplier_items,
                    "match_status": status,
                }
            )

        return results

    # ═══════════════════════════════════════════
    # INCOMING SPEC MATCHING (Doküman bölüm 7.3)
    # ═══════════════════════════════════════════

    def process_incoming_spec(
        self,
        product_type_short: str,
        color_text: str,
        thickness_mm: float,
        width_cm: float,
        height_cm: float,
        external_line_id: str | None = None,
        user_id: int | None = None,
    ) -> IncomingSpec:
        """OptiPlanning'den gelen firma bilgisi olmayan satırı işler."""
        spec_hash = generate_spec_hash(
            product_type_short, color_text, thickness_mm, width_cm, height_cm
        )

        # Ürün tipini normalize et
        pt = (
            self.db.query(ProductType)
            .filter(
                or_(
                    ProductType.short_code.ilike(product_type_short),
                    ProductType.code.ilike(product_type_short),
                )
            )
            .first()
        )
        # Rengi normalize et
        color = (
            self.db.query(Color)
            .filter(
                or_(
                    Color.code.ilike(color_text),
                    Color.name.ilike(color_text),
                )
            )
            .first()
        )

        # Spec eşleştirme
        status = IncomingSpecStatusEnum.PENDING
        if pt and color:
            matching_specs = (
                self.db.query(MaterialSpec)
                .filter(
                    MaterialSpec.product_type_id == pt.id,
                    MaterialSpec.color_id == color.id,
                    MaterialSpec.thickness_mm == thickness_mm,
                    MaterialSpec.width_cm == width_cm,
                    MaterialSpec.height_cm == height_cm,
                )
                .all()
            )
            if matching_specs:
                spec = matching_specs[0]
                si_count = (
                    self.db.query(SupplierItem)
                    .filter(SupplierItem.spec_id == spec.id, SupplierItem.is_active == True)
                    .count()
                )
                if si_count == 1:
                    status = IncomingSpecStatusEnum.MATCHED
                elif si_count > 1:
                    status = IncomingSpecStatusEnum.AMBIGUOUS
                else:
                    status = IncomingSpecStatusEnum.NO_MATCH
            else:
                status = IncomingSpecStatusEnum.NO_MATCH

        incoming = IncomingSpec(
            external_line_id=external_line_id,
            product_type_short=product_type_short,
            normalized_type_id=pt.id if pt else None,
            color_text=color_text,
            normalized_color_id=color.id if color else None,
            thickness_mm=thickness_mm,
            width_cm=width_cm,
            height_cm=height_cm,
            spec_hash=spec_hash,
            status=status,
            created_by=user_id,
        )
        self.db.add(incoming)

        # NO_MATCH → otomatik product_request oluştur
        if status == IncomingSpecStatusEnum.NO_MATCH:
            pr = ProductRequest(
                spec_hash=spec_hash,
                product_type_short=product_type_short,
                color_text=color_text,
                thickness_mm=thickness_mm,
                width_cm=width_cm,
                height_cm=height_cm,
                requested_by=user_id,
            )
            self.db.add(pr)

        self.db.commit()
        self.db.refresh(incoming)
        return incoming

    def resolve_incoming_spec(
        self, incoming_id: int, brand_id: int, item_id: int | None = None
    ) -> IncomingSpec:
        """AMBIGUOUS durumundaki incoming_spec için firma seçimi yapar."""
        incoming = self.db.query(IncomingSpec).filter(IncomingSpec.id == incoming_id).first()
        if not incoming:
            raise NotFoundError("IncomingSpec", incoming_id)

        incoming.chosen_brand_id = brand_id
        if item_id:
            incoming.chosen_item_id = item_id
        incoming.status = IncomingSpecStatusEnum.MATCHED
        self.db.commit()
        self.db.refresh(incoming)
        return incoming


def _try_float(s: str) -> float | None:
    try:
        return float(s)
    except (ValueError, TypeError):
        return None
