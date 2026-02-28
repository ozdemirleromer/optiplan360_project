"""
OptiPlan 360 — Materials Router (Genişletilmiş)
Mikro SQL'den stok/malzeme arama ve yönetim (read-only + cache)
Handoff §5 — Stok Adı Normalize Kuralları
"""

from datetime import datetime
from enum import Enum
from typing import Dict, List, Optional

from app import mikro_db
from app.auth import get_current_user
from app.exceptions import NotFoundError
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel

router = APIRouter(prefix="/api/v1/materials", tags=["materials"])


# ═══════════════════════════════════════════════════
# ENUMS VE TEMEL ŞEMAlar
# ═══════════════════════════════════════════════════


class MaterialCategory(str, Enum):
    MDF = "MDF"
    LAMINATE = "LAMINATE"
    CHIPBOARD = "CHIPBOARD"
    ACCESSORY = "ACCESSORY"
    EDGE_BAND = "EDGE_BAND"
    HARDWARE = "HARDWARE"
    OTHER = "OTHER"


class MaterialStatus(str, Enum):
    ACTIVE = "active"
    DISCONTINUED = "discontinued"
    LOW_STOCK = "low_stock"
    OUT_OF_STOCK = "out_of_stock"


# ═══════════════════════════════════════════════════
# Pydantic MODELLERİ
# ═══════════════════════════════════════════════════


class MaterialSuggestion(BaseModel):
    stok_adi: str
    kalinlik: Optional[int] = None
    renk: str = ""
    ebat: str = ""
    match_score: float = 0.0


class MaterialDetail(BaseModel):
    id: str
    code: str
    name: str
    normalized_name: str
    category: MaterialCategory
    thickness_mm: Optional[int] = None
    width_mm: Optional[int] = None
    height_mm: Optional[int] = None
    color: Optional[str] = None
    unit: str = "ADET"
    current_stock: float = 0.0
    min_stock_level: float = 0.0
    status: MaterialStatus = MaterialStatus.ACTIVE
    last_price: Optional[float] = None
    currency: str = "TRY"
    supplier_info: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class MaterialStock(BaseModel):
    material_id: str
    material_code: str
    material_name: str
    warehouse_id: str
    warehouse_name: str
    quantity: float
    reserved_quantity: float
    available_quantity: float
    last_movement_at: Optional[datetime] = None


class MaterialPriceHistory(BaseModel):
    material_id: str
    date: datetime
    price: float
    currency: str
    supplier: Optional[str] = None


class MaterialFilter(BaseModel):
    category: Optional[MaterialCategory] = None
    thickness: Optional[int] = None
    color: Optional[str] = None
    status: Optional[MaterialStatus] = None
    min_stock_only: bool = False
    search_query: Optional[str] = None


class StockMovement(BaseModel):
    id: str
    material_id: str
    movement_type: str  # IN, OUT, TRANSFER, ADJUSTMENT
    quantity: float
    reference_type: Optional[str] = None  # ORDER, PURCHASE, MANUAL
    reference_id: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime
    created_by: Optional[str] = None


class MaterialStats(BaseModel):
    total_materials: int
    by_category: Dict[str, int]
    low_stock_count: int
    out_of_stock_count: int
    total_value: float


# ═══════════════════════════════════════════════════
# MALZEME ARAMA VE ÖNERİLERİ
# ═══════════════════════════════════════════════════


@router.get("/suggest", response_model=List[MaterialSuggestion])
def suggest_materials(
    q: str = Query(..., min_length=2, description="Arama terimi"),
    thickness: Optional[int] = Query(None, description="Kalınlık filtresi (4/5/8/18)"),
    color: Optional[str] = Query(None, description="Renk filtresi"),
    limit: int = Query(20, ge=1, le=100),
    _=Depends(get_current_user),
):
    """
    Mikro veritabanından malzeme önerisi.
    Handoff §5: MLAM=MDFLAM, SLAM=SUNTALAM normalize kuralları uygulanır.

    Mikro bağlantısı yoksa boş liste döner (503 hatası vermez,
    operatör manuel girebilir).
    """
    results = mikro_db.search_materials(
        query=q,
        thickness=thickness,
        color=color,
        limit=limit,
    )
    return [MaterialSuggestion(**r) for r in results]


@router.get("/normalize")
def normalize_name(
    name: str = Query(..., min_length=1),
    _=Depends(get_current_user),
):
    """Stok adı normalize et (Handoff §5 kuralları)"""
    return {"original": name, "normalized": mikro_db.normalize_stock_name(name)}


# ═══════════════════════════════════════════════════
# MALZEME LİSTESİ VE DETAY
# ═══════════════════════════════════════════════════


@router.get("/", response_model=List[MaterialDetail])
def list_materials(
    category: Optional[MaterialCategory] = Query(None),
    thickness: Optional[int] = Query(None),
    color: Optional[str] = Query(None),
    status: Optional[MaterialStatus] = Query(None),
    search: Optional[str] = Query(None, description="İsim veya kodda ara"),
    min_stock_only: bool = Query(False, description="Sadece düşük stoklular"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    _=Depends(get_current_user),
):
    """Tüm malzemeleri listele (filtre ve sayfalama ile)"""
    # Mikro DB'den malzemeleri çek
    all_materials = mikro_db.get_all_materials()

    # Filtrele
    materials = all_materials
    if category:
        materials = [m for m in materials if m.get("category") == category.value]
    if thickness:
        materials = [m for m in materials if m.get("thickness_mm") == thickness]
    if color:
        materials = [m for m in materials if color.lower() in (m.get("color") or "").lower()]
    if status:
        materials = [m for m in materials if m.get("status") == status.value]
    if search:
        search_lower = search.lower()
        materials = [
            m
            for m in materials
            if search_lower in (m.get("name") or "").lower()
            or search_lower in (m.get("code") or "").lower()
        ]
    if min_stock_only:
        materials = [
            m for m in materials if m.get("current_stock", 0) < m.get("min_stock_level", 0)
        ]

    # Sayfalama
    total = len(materials)
    start = (page - 1) * page_size
    end = start + page_size
    paginated = materials[start:end]

    return [MaterialDetail(**m) for m in paginated]


@router.get("/{material_id}", response_model=MaterialDetail)
def get_material_detail(
    material_id: str,
    _=Depends(get_current_user),
):
    """Malzeme detaylarını getir"""
    material = mikro_db.get_material_by_id(material_id)
    if not material:
        raise NotFoundError("Malzeme")
    return MaterialDetail(**material)


# ═══════════════════════════════════════════════════
# MALZEME STOK İŞLEMLERİ
# ═══════════════════════════════════════════════════


@router.get("/{material_id}/stock", response_model=List[MaterialStock])
def get_material_stock(
    material_id: str,
    warehouse_id: Optional[str] = Query(None),
    _=Depends(get_current_user),
):
    """Malzemenin depo bazlı stok durumunu getir"""
    stock_data = mikro_db.get_material_stock(material_id, warehouse_id)
    return [MaterialStock(**s) for s in stock_data]


@router.get("/{material_id}/price-history", response_model=List[MaterialPriceHistory])
def get_price_history(
    material_id: str,
    limit: int = Query(10, ge=1, le=50),
    _=Depends(get_current_user),
):
    """Malzeme fiyat geçmişini getir"""
    history = mikro_db.get_material_price_history(material_id, limit)
    return [MaterialPriceHistory(**h) for h in history]


@router.get("/{material_id}/movements", response_model=List[StockMovement])
def get_stock_movements(
    material_id: str,
    movement_type: Optional[str] = Query(None),
    date_from: Optional[datetime] = Query(None),
    date_to: Optional[datetime] = Query(None),
    limit: int = Query(20, ge=1, le=100),
    _=Depends(get_current_user),
):
    """Malzeme stok hareketlerini getir"""
    movements = mikro_db.get_stock_movements(
        material_id=material_id,
        movement_type=movement_type,
        date_from=date_from,
        date_to=date_to,
        limit=limit,
    )
    return [StockMovement(**m) for m in movements]


# ═══════════════════════════════════════════════════
# MALZEME İSTATİSTİKLERİ
# ═══════════════════════════════════════════════════


@router.get("/stats/summary", response_model=MaterialStats)
def get_materials_stats(
    _=Depends(get_current_user),
):
    """Malzeme istatistiklerini getir"""
    all_materials = mikro_db.get_all_materials()

    by_category = {}
    low_stock = 0
    out_of_stock = 0
    total_value = 0.0

    for m in all_materials:
        cat = m.get("category", "OTHER")
        by_category[cat] = by_category.get(cat, 0) + 1

        stock = m.get("current_stock", 0)
        min_stock = m.get("min_stock_level", 0)

        if stock == 0:
            out_of_stock += 1
        elif stock < min_stock:
            low_stock += 1

        price = m.get("last_price", 0) or 0
        total_value += stock * price

    return MaterialStats(
        total_materials=len(all_materials),
        by_category=by_category,
        low_stock_count=low_stock,
        out_of_stock_count=out_of_stock,
        total_value=round(total_value, 2),
    )


@router.get("/stats/low-stock")
def get_low_stock_materials(
    threshold_percent: float = Query(20.0, ge=0, le=100, description="Minimum stok yüzdesi"),
    _=Depends(get_current_user),
):
    """Düşük stoklu malzemeleri getir"""
    all_materials = mikro_db.get_all_materials()

    low_stock = []
    for m in all_materials:
        current = m.get("current_stock", 0)
        min_level = m.get("min_stock_level", 0)

        if min_level > 0 and (current / min_level * 100) <= threshold_percent:
            low_stock.append(
                {
                    "id": m.get("id"),
                    "code": m.get("code"),
                    "name": m.get("name"),
                    "current_stock": current,
                    "min_stock_level": min_level,
                    "percent": round((current / min_level * 100), 1) if min_level > 0 else 0,
                }
            )

    return {"count": len(low_stock), "materials": sorted(low_stock, key=lambda x: x["percent"])}


# ═══════════════════════════════════════════════════
# MALZEME KATEGORİLERİ
# ═══════════════════════════════════════════════════


@router.get("/categories/list")
def list_categories(
    _=Depends(get_current_user),
):
    """Tüm malzeme kategorilerini listele"""
    return {
        "categories": [
            {"value": c.value, "label": c.name.replace("_", " ")} for c in MaterialCategory
        ]
    }


@router.get("/categories/{category}/materials", response_model=List[MaterialDetail])
def get_materials_by_category(
    category: MaterialCategory,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    _=Depends(get_current_user),
):
    """Kategori bazlı malzeme listesi"""
    return list_materials(
        category=category,
        page=page,
        page_size=page_size,
        _=None,  # Auth zaten burada kontrol edildi
    )


# ═══════════════════════════════════════════════════
# ALTERNATİF MALZEME ÖNERİLERİ
# ═══════════════════════════════════════════════════


@router.get("/{material_id}/alternatives")
def get_alternative_materials(
    material_id: str,
    same_thickness: bool = Query(True, description="Aynı kalınlıkta alternatifler"),
    same_category: bool = Query(True, description="Aynı kategoride alternatifler"),
    limit: int = Query(5, ge=1, le=20),
    _=Depends(get_current_user),
):
    """Bir malzeme için alternatif önerileri getir"""
    material = mikro_db.get_material_by_id(material_id)
    if not material:
        raise NotFoundError("Malzeme")

    # Alternatifleri bul
    all_materials = mikro_db.get_all_materials()
    alternatives = []

    for m in all_materials:
        if m.get("id") == material_id:
            continue

        score = 0

        # Aynı kategori
        if same_category and m.get("category") == material.get("category"):
            score += 40

        # Aynı kalınlık
        if same_thickness and m.get("thickness_mm") == material.get("thickness_mm"):
            score += 30

        # Aynı renk
        if m.get("color") == material.get("color"):
            score += 20

        # Benzer isim
        if material.get("name") and m.get("name"):
            name_words = set(material["name"].lower().split())
            alt_words = set(m["name"].lower().split())
            common = name_words & alt_words
            if common:
                score += len(common) * 5

        if score > 0:
            alternatives.append(
                {"material": MaterialDetail(**m), "similarity_score": min(score, 100)}
            )

    # Skora göre sırala ve limit uygula
    alternatives.sort(key=lambda x: x["similarity_score"], reverse=True)
    return {"alternatives": alternatives[:limit]}


# ═══════════════════════════════════════════════════
# MALZEME EŞLEŞTİRME (Matching)
# ═══════════════════════════════════════════════════


@router.post("/match")
def match_materials(
    query: str,
    candidates: List[str],
    _=Depends(get_current_user),
):
    """
    Verilen sorgu için aday malzemelerden en iyi eşleşmeyi bul.
    AI destekli malzeme eşleştirme için kullanılır.
    """
    normalized_query = mikro_db.normalize_stock_name(query)

    matches = []
    for candidate in candidates:
        normalized_candidate = mikro_db.normalize_stock_name(candidate)

        # Basit string benzerliği (Levenshtein yerine)
        # Gerçek uygulamada daha gelişmiş algoritma kullanılabilir
        query_lower = normalized_query.lower()
        cand_lower = normalized_candidate.lower()

        if query_lower == cand_lower:
            score = 100
        elif query_lower in cand_lower or cand_lower in query_lower:
            score = 80
        else:
            # Ortak kelimeler
            q_words = set(query_lower.split())
            c_words = set(cand_lower.split())
            common = q_words & c_words
            score = len(common) / max(len(q_words), len(c_words)) * 60 if q_words or c_words else 0

        matches.append(
            {
                "candidate": candidate,
                "normalized": normalized_candidate,
                "match_score": round(score, 1),
            }
        )

    # Skora göre sırala
    matches.sort(key=lambda x: x["match_score"], reverse=True)

    return {
        "query": query,
        "normalized_query": normalized_query,
        "matches": matches,
        "best_match": matches[0] if matches and matches[0]["match_score"] > 50 else None,
    }
