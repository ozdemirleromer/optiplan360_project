"""
Stok Kartı API Router
Mikro stok kartları yönetimi API endpointleri
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from app.exceptions import NotFoundError
from sqlalchemy.orm import Session
from typing import List, Optional

from app.database import get_db
from app.services.stock_card_service import StockCardService
from app.auth import require_permissions
from app.permissions import Permission
from pydantic import BaseModel

router = APIRouter(prefix="/api/v1/stock", tags=["stock"])


class StockCardResponse(BaseModel):
    id: str
    stock_code: str
    stock_name: str
    total_quantity: float
    available_quantity: float
    sale_price: Optional[float] = None
    color: Optional[str] = None
    thickness: Optional[str] = None
    is_active: bool


class StockCardCreate(BaseModel):
    stock_code: str
    stock_name: str
    unit: str = "ADET"
    purchase_price: Optional[float] = None
    sale_price: Optional[float] = None
    total_quantity: float = 0
    thickness: Optional[str] = None
    color: Optional[str] = None
    warehouse_location: Optional[str] = None


class StockMovementResponse(BaseModel):
    id: str
    movement_type: str
    quantity: float
    movement_date: str
    reference_document: Optional[str] = None


@router.get("/stock-cards", response_model=List[StockCardResponse], tags=["stock"])
def list_stock_cards(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    active_only: bool = Query(True),
    db: Session = Depends(get_db),
    current_user = Depends(require_permissions(Permission.STOCK_VIEW))
):
    """Stok kartlarını listele"""
    service = StockCardService(db)
    cards = service.get_stock_list(skip, limit, active_only if active_only else None)
    return cards


@router.get("/stock-cards/search", response_model=List[StockCardResponse], tags=["stock"])
def search_stock_cards(
    q: str = Query(..., min_length=2),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user = Depends(require_permissions(Permission.STOCK_VIEW))
):
    """Stok kartlarında arama yap"""
    service = StockCardService(db)
    results = service.search_stocks(q, limit)
    return results


@router.get("/stock-cards/{stock_code}", tags=["stock"])
def get_stock_card_detail(
    stock_code: str,
    db: Session = Depends(get_db),
    current_user = Depends(require_permissions(Permission.STOCK_VIEW))
):
    """Stok kartı detaylarını getir"""
    service = StockCardService(db)
    card = service.get_stock_card(stock_code)
    
    if not card:
        raise NotFoundError("Stok kartı")
    
    return card


@router.get("/stock-cards/{stock_code}/movements", tags=["stock"])
def get_stock_movements(
    stock_code: str,
    days: int = Query(30, ge=1, le=365),
    db: Session = Depends(get_db),
    current_user = Depends(require_permissions(Permission.STOCK_VIEW))
):
    """Stok hareket geçmişini getir"""
    service = StockCardService(db)
    service.sync_stock_movements(stock_code, days)
    card = service.get_stock_card(stock_code)
    
    if not card:
        raise NotFoundError("Stok kartı")
    
    return {
        "stock_code": stock_code,
        "movements": card.get("movements", [])
    }


@router.post("/stock-cards", status_code=201, tags=["stock"])
def create_stock_card(
    body: StockCardCreate,
    db: Session = Depends(get_db),
    current_user = Depends(require_permissions(Permission.STOCK_IMPORT))
):
    """Yeni stok kartı oluştur"""
    service = StockCardService(db)
    card = service.create(body.model_dump())
    return card


@router.post("/stock-cards/sync", tags=["stock"])
def sync_stock_cards(
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user = Depends(require_permissions(Permission.STOCK_IMPORT))
):
    """Mikro'dan stok kartlarını senkronize et"""
    service = StockCardService(db)
    result = service.sync_stock_cards(limit, offset)
    return result


@router.post("/stock-cards/{stock_code}/sync-movements", tags=["stock"])
def sync_movements(
    stock_code: str,
    days: int = Query(30, ge=1, le=365),
    db: Session = Depends(get_db),
    current_user = Depends(require_permissions(Permission.STOCK_IMPORT))
):
    """Belirli bir stok için hareketleri senkronize et"""
    service = StockCardService(db)
    result = service.sync_stock_movements(stock_code, days)
    return result


@router.get("/stock-cards/low-stock/alert", tags=["stock"])
def get_low_stock_items(
    threshold: float = Query(10, ge=0),
    db: Session = Depends(get_db),
    current_user = Depends(require_permissions(Permission.STOCK_VIEW))
):
    """Düşük stokta olan ürünlerin listesini getir"""
    service = StockCardService(db)
    items = service.get_low_stock_items(threshold)
    return {
        "threshold": threshold,
        "items": items,
        "count": len(items)
    }


@router.get("/stock-cards/summary/stats", tags=["stock"])
def get_stock_stats(
    db: Session = Depends(get_db),
    current_user = Depends(require_permissions(Permission.STOCK_VIEW))
):
    """Stok genel istatistiklerini getir"""
    service = StockCardService(db)
    stats = service.get_stock_summary_stats()
    return stats
