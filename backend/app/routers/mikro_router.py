"""
Mikro ERP Entegrasyon Router
P1: Read-only health check ve uyum raporu.
P2: Cari/stok write-back (henüz aktif değil).
"""

from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ..auth import require_permissions
from ..database import get_db
from ..models.crm import CRMAccount
from ..permissions import Permission
from ..services import mikro_service

router = APIRouter(prefix="/api/v1/mikro", tags=["mikro"])


@router.get("/health")
def mikro_health(
    _=Depends(require_permissions(Permission.INTEGRATIONS_VIEW)),
):
    """Mikro SQL Server bağlantısını test et (SELECT 1)."""
    return mikro_service.test_connection()


@router.get("/reconciliation")
def mikro_reconciliation(
    db: Session = Depends(get_db),
    _=Depends(require_permissions(Permission.INTEGRATIONS_VIEW)),
):
    """
    Mikro cari kodu eşleşme raporu.
    CRMAccount tablosunda mikro_cari_kod değeri boş olan kayıtları raporlar.
    """
    total = db.query(CRMAccount).count()
    mapped = db.query(CRMAccount).filter(
        CRMAccount.mikro_cari_kod.isnot(None),
        CRMAccount.mikro_cari_kod != "",
    ).count()
    unmapped = total - mapped

    unmapped_ids: List[str] = [
        row.id
        for row in db.query(CRMAccount.id)
        .filter(
            (CRMAccount.mikro_cari_kod.is_(None))
            | (CRMAccount.mikro_cari_kod == "")
        )
        .limit(100)
        .all()
    ]

    return {
        "total_accounts": total,
        "mapped": mapped,
        "unmapped": unmapped,
        "unmapped_ids": unmapped_ids,
    }


@router.get("/validate/cari")
def validate_cari(
    kodu: str = Query(..., description="Mikro cari kodu"),
    _=Depends(require_permissions(Permission.INTEGRATIONS_VIEW)),
):
    """Mikro'da cari kodu mevcut mu kontrol et."""
    exists = mikro_service.validate_cari_kodu(kodu)
    return {"kodu": kodu, "exists": exists}


@router.get("/validate/stok")
def validate_stok(
    kodu: str = Query(..., description="Mikro stok kodu"),
    _=Depends(require_permissions(Permission.INTEGRATIONS_VIEW)),
):
    """Mikro'da stok kodu mevcut mu kontrol et."""
    exists = mikro_service.validate_stok_kodu(kodu)
    return {"kodu": kodu, "exists": exists}


@router.get("/materials/suggest")
def suggest_materials(
    q: str = Query(..., description="Malzeme arama metni"),
    thickness: Optional[float] = Query(None, description="Kalınlık filtresi (mm)"),
    _=Depends(require_permissions(Permission.INTEGRATIONS_VIEW)),
):
    """Mikro stok listesinden malzeme önerisi döndür."""
    return mikro_service.suggest_materials(q, thickness=thickness)
