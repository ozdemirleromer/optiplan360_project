"""
Product Catalog Router — Master data CRUD + Spec-first arama
"""

from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ..auth import require_permissions
from ..database import get_db
from ..models import User
from ..permissions import Permission
from ..schemas import (
    BrandCreate,
    BrandOut,
    ColorCreate,
    ColorOut,
    IncomingSpecCreate,
    IncomingSpecOut,
    ItemCreate,
    ItemOut,
    MaterialSpecCreate,
    MaterialSpecOut,
    ProductTypeCreate,
    ProductTypeOut,
    SupplierItemCreate,
    SupplierItemOut,
)
from ..services.product_service import ProductService

router = APIRouter(prefix="/api/v1/products", tags=["products"])


# ── Brands ──────────────────────────────────────────────
@router.get("/brands", response_model=List[BrandOut])
def list_brands(
    db: Session = Depends(get_db),
    _: User = Depends(require_permissions(Permission.PRODUCT_VIEW)),
):
    svc = ProductService(db)
    return svc.list_brands()


@router.post("/brands", response_model=BrandOut, status_code=201)
def create_brand(
    body: BrandCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_permissions(Permission.PRODUCT_CREATE)),
):
    svc = ProductService(db)
    return svc.create_brand(body.code, body.name)


# ── Colors ──────────────────────────────────────────────
@router.get("/colors", response_model=List[ColorOut])
def list_colors(
    db: Session = Depends(get_db),
    _: User = Depends(require_permissions(Permission.PRODUCT_VIEW)),
):
    svc = ProductService(db)
    return svc.list_colors()


@router.post("/colors", response_model=ColorOut, status_code=201)
def create_color(
    body: ColorCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_permissions(Permission.PRODUCT_CREATE)),
):
    svc = ProductService(db)
    return svc.create_color(body.code, body.name)


# ── Product Types ───────────────────────────────────────
@router.get("/types", response_model=List[ProductTypeOut])
def list_product_types(
    db: Session = Depends(get_db),
    _: User = Depends(require_permissions(Permission.PRODUCT_VIEW)),
):
    svc = ProductService(db)
    return svc.list_product_types()


@router.post("/types", response_model=ProductTypeOut, status_code=201)
def create_product_type(
    body: ProductTypeCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_permissions(Permission.PRODUCT_CREATE)),
):
    svc = ProductService(db)
    return svc.create_product_type(body.code, body.short_code, body.name)


# ── Material Specs ──────────────────────────────────────
@router.post("/specs", response_model=MaterialSpecOut, status_code=201)
def create_spec(
    body: MaterialSpecCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_permissions(Permission.PRODUCT_CREATE)),
):
    svc = ProductService(db)
    return svc.create_spec(
        body.product_type_id,
        body.color_id,
        body.thickness_mm,
        body.width_cm,
        body.height_cm,
    )


@router.get("/specs/{spec_id}", response_model=MaterialSpecOut)
def get_spec(
    spec_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_permissions(Permission.PRODUCT_VIEW)),
):
    svc = ProductService(db)
    return svc.get_spec(spec_id)


# ── Spec-first Arama ───────────────────────────────────
@router.get("/search")
def search_specs(
    query: Optional[str] = Query(None, description="Serbest metin (ör: BEYAZ 18)"),
    product_type_id: Optional[int] = Query(None),
    color_id: Optional[int] = Query(None),
    thickness_mm: Optional[float] = Query(None),
    width_cm: Optional[float] = Query(None),
    height_cm: Optional[float] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    _: User = Depends(require_permissions(Permission.PRODUCT_VIEW)),
):
    """
    Spec-first ürün arama. Satışçı "BEYAZ 18" yazar, eşleşen spec'ler döner.
    Her spec için match_status: MATCHED (tek firma), AMBIGUOUS (çoklu), NO_MATCH (yok).
    """
    svc = ProductService(db)
    raw_results = svc.search_specs(
        query=query,
        product_type_id=product_type_id,
        color_id=color_id,
        thickness_mm=thickness_mm,
        width_cm=width_cm,
        height_cm=height_cm,
        limit=limit,
    )
    # ORM nesnelerini JSON-serializable dict'lere cevir
    results = []
    for r in raw_results:
        spec = r["spec"]
        pt = r["product_type"]
        color = r["color"]
        results.append(
            {
                "id": spec.id,
                "product_type_name": pt.name if pt else "",
                "color_name": color.name if color else "",
                "thickness_mm": float(spec.thickness_mm) if spec.thickness_mm else 0,
                "width_cm": float(spec.width_cm) if spec.width_cm else 0,
                "height_cm": float(spec.height_cm) if spec.height_cm else 0,
                "spec_hash": spec.spec_hash or "",
                "match_status": r["match_status"],
                "supplier_items": [
                    {
                        "id": si.id,
                        "brand_name": si.brand.name if si.brand else "",
                        "display_name": si.display_name or "",
                        "is_default": bool(si.is_default),
                    }
                    for si in r["supplier_items"]
                ],
            }
        )
    return {"results": results, "total": len(results)}


# ── Supplier Items ──────────────────────────────────────
@router.post("/supplier-items", response_model=SupplierItemOut, status_code=201)
def create_supplier_item(
    body: SupplierItemCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_permissions(Permission.PRODUCT_CREATE)),
):
    svc = ProductService(db)
    return svc.create_supplier_item(
        body.spec_id,
        body.brand_id,
        body.display_name,
        body.is_default,
        body.priority,
    )


# ── Items / SKU ─────────────────────────────────────────
@router.post("/items", response_model=ItemOut, status_code=201)
def create_item(
    body: ItemCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_permissions(Permission.PRODUCT_CREATE)),
):
    svc = ProductService(db)
    return svc.create_item(
        body.supplier_item_id,
        body.unit,
        body.vat_rate,
        body.default_price,
        body.barcode,
        body.mikro_stok_kodu,
    )


# ── Incoming Specs ──────────────────────────────────────
@router.post("/incoming", response_model=IncomingSpecOut, status_code=201)
def process_incoming(
    body: IncomingSpecCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permissions(Permission.PRODUCT_CREATE)),
):
    """OptiPlanning'den gelen firma bilgisi olmayan satırı işler ve eşleştirir."""
    svc = ProductService(db)
    return svc.process_incoming_spec(
        product_type_short=body.product_type_short or "",
        color_text=body.color_text or "",
        thickness_mm=body.thickness_mm or 0,
        width_cm=body.width_cm or 0,
        height_cm=body.height_cm or 0,
        external_line_id=body.external_line_id,
        user_id=current_user.id,
    )


@router.post("/incoming/{incoming_id}/resolve", response_model=IncomingSpecOut)
def resolve_incoming(
    incoming_id: int,
    brand_id: int = Query(...),
    item_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(require_permissions(Permission.PRODUCT_EDIT)),
):
    """AMBIGUOUS durumundaki incoming_spec için firma seçimi yapar."""
    svc = ProductService(db)
    return svc.resolve_incoming_spec(incoming_id, brand_id, item_id)
