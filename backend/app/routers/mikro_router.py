"""
Mikro SQL Entegrasyon Router
/api/v1/mikro/* endpoints
"""
from fastapi import APIRouter, Depends, Body
from sqlalchemy.orm import Session
from typing import Dict, Any, List, Optional
from pydantic import BaseModel
import logging

from ..database import get_db
from ..auth import get_current_user
from ..models import User, IntegrationTypeEnum
from ..services.mikro_sync_service import MikroSyncService
from ..services.integration_settings_service import IntegrationSettingsService
from ..services.integration_health_service import IntegrationHealthService
from ..exceptions import AppError, ValidationError

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/mikro", tags=["Mikro Integration"])


# -----------------------------------------------------------------------------
# PYDANTIC SCHEMAS
# -----------------------------------------------------------------------------

class SyncRequest(BaseModel):
    direction: str = "PUSH"  # PUSH veya PULL


class BulkSyncRequest(BaseModel):
    entity_ids: List[str]
    direction: str = "PUSH"


class SettingsUpdateRequest(BaseModel):
    integration_type: str
    category: Optional[str] = None
    settings: Dict[str, Any]
    is_active: Optional[bool] = None
    auto_sync_enabled: Optional[bool] = None
    sync_interval_minutes: Optional[int] = None


# -----------------------------------------------------------------------------
# SAĞLIK KONTROLLERI
# -----------------------------------------------------------------------------

@router.get("/health")
def get_health_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Mikro entegrasyon sağlık durumu"""
    try:
        health_service = IntegrationHealthService(db)
        return health_service.check_all_integrations()
    except Exception as e:
        logger.error(f"Sağlık kontrolü hatası: {e}")
        raise AppError(500, "INTEGRATION_ERROR", str(e))


# -----------------------------------------------------------------------------
# AYARLAR
# -----------------------------------------------------------------------------

@router.get("/settings")
def get_integration_settings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Tüm entegrasyon ayarlarını getir"""
    try:
        settings_service = IntegrationSettingsService(db)
        return settings_service.get_all_settings()
    except Exception as e:
        logger.error(f"Ayarlar getirme hatası: {e}")
        raise AppError(500, "INTEGRATION_ERROR", str(e))


@router.put("/settings")
def update_integration_settings(
    request: SettingsUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Entegrasyon ayarlarını güncelle"""
    try:
        settings_service = IntegrationSettingsService(db)
        
        # String enum'u IntegrationTypeEnum'a çevir
        integration_type = IntegrationTypeEnum(request.integration_type)
        
        result = settings_service.update_settings(
            integration_type=integration_type,
            category=request.category,
            settings=request.settings,
            is_active=request.is_active,
            auto_sync=request.auto_sync_enabled,
            sync_interval=request.sync_interval_minutes
        )
        
        return result
    except Exception as e:
        logger.error(f"Ayarlar güncelleme hatası: {e}")
        raise AppError(500, "INTEGRATION_ERROR", str(e))


@router.post("/settings/{integration_type}/toggle")
def toggle_integration(
    integration_type: str,
    category: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Entegrasyonu aktif/pasif yap"""
    try:
        settings_service = IntegrationSettingsService(db)
        integration_enum = IntegrationTypeEnum(integration_type)
        
        is_active = settings_service.toggle_active(integration_enum, category)
        
        return {
            "success": True,
            "is_active": is_active,
            "message": f"Entegrasyon {'aktif' if is_active else 'pasif'} edildi"
        }
    except Exception as e:
        logger.error(f"Toggle hatası: {e}")
        raise AppError(500, "INTEGRATION_ERROR", str(e))


# -----------------------------------------------------------------------------
# CARİ HESAP SENKRONIZASYONU
# -----------------------------------------------------------------------------

@router.post("/sync/accounts/{account_id}")
def sync_account(
    account_id: str,
    request: SyncRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Tek cari hesap senkronize et"""
    try:
        # CRM Account verisini çek (gerçek implementasyonda CRM service kullan)
        sync_service = MikroSyncService(db)
        
        if request.direction == "PUSH":
            # OptiPlan → Mikro
            # Burada gerçek account verisini çekmek gerekir
            account_data = {
                "company_name": "Örnek Firma",
                "tax_id": "1234567890",
                "phone": "05321234567",
                "email": "info@firma.com"
            }
            result = sync_service.sync_account_to_mikro(account_id, account_data)
        else:
            # Mikro → OptiPlan
            result = sync_service.sync_account_from_mikro(account_id)
        
        return result
    except Exception as e:
        logger.error(f"Account sync hatası: {e}")
        raise AppError(500, "INTEGRATION_ERROR", str(e))


@router.post("/sync/accounts/bulk")
def bulk_sync_accounts(
    request: BulkSyncRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Toplu cari hesap senkronize et"""
    try:
        sync_service = MikroSyncService(db)
        
        results = {
            "total": len(request.entity_ids),
            "success": 0,
            "failed": 0,
            "details": []
        }
        
        for account_id in request.entity_ids:
            try:
                # Gerçek account verisini çek
                account_data = {}  # CRM'den çekilecek
                result = sync_service.sync_account_to_mikro(account_id, account_data)
                
                if result.get("success"):
                    results["success"] += 1
                else:
                    results["failed"] += 1
                
                results["details"].append({
                    "account_id": account_id,
                    "result": result
                })
            except Exception as e:
                results["failed"] += 1
                results["details"].append({
                    "account_id": account_id,
                    "error": str(e)
                })
        
        return results
    except Exception as e:
        logger.error(f"Bulk sync hatası: {e}")
        raise AppError(500, "INTEGRATION_ERROR", str(e))


# -----------------------------------------------------------------------------
# FATURA SENKRONIZASYONU
# -----------------------------------------------------------------------------

@router.post("/sync/invoices/{invoice_id}")
def sync_invoice(
    invoice_id: str,
    request: SyncRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Tek fatura senkronize et"""
    try:
        sync_service = MikroSyncService(db)
        
        # Gerçek fatura verisini çek
        invoice_data = {}  # Payment service'den çekilecek
        invoice_lines = []  # Fatura satırları
        
        result = sync_service.sync_invoice_to_mikro(invoice_id, invoice_data, invoice_lines)
        return result
    except Exception as e:
        logger.error(f"Invoice sync hatası: {e}")
        raise AppError(500, "INTEGRATION_ERROR", str(e))


@router.post("/sync/invoices/bulk")
def bulk_sync_invoices(
    request: BulkSyncRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Toplu fatura senkronize et"""
    try:
        sync_service = MikroSyncService(db)
        
        results = {
            "total": len(request.entity_ids),
            "success": 0,
            "failed": 0,
            "details": []
        }
        
        for invoice_id in request.entity_ids:
            try:
                invoice_data = {}
                invoice_lines = []
                result = sync_service.sync_invoice_to_mikro(invoice_id, invoice_data, invoice_lines)
                
                if result.get("success"):
                    results["success"] += 1
                else:
                    results["failed"] += 1
                
                results["details"].append({
                    "invoice_id": invoice_id,
                    "result": result
                })
            except Exception as e:
                results["failed"] += 1
                results["details"].append({
                    "invoice_id": invoice_id,
                    "error": str(e)
                })
        
        return results
    except Exception as e:
        logger.error(f"Bulk invoice sync hatası: {e}")
        raise AppError(500, "INTEGRATION_ERROR", str(e))


# -----------------------------------------------------------------------------
# TEKLİF SENKRONIZASYONU
# -----------------------------------------------------------------------------

@router.post("/sync/quotes/{quote_id}")
def sync_quote(
    quote_id: str,
    request: SyncRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Tek teklif senkronize et"""
    try:
        sync_service = MikroSyncService(db)
        
        # Gerçek teklif verisini çek
        quote_data = {}  # CRM service'den çekilecek
        quote_lines = []
        
        result = sync_service.sync_quote_to_mikro(quote_id, quote_data, quote_lines)
        return result
    except Exception as e:
        logger.error(f"Quote sync hatası: {e}")
        raise AppError(500, "INTEGRATION_ERROR", str(e))


@router.post("/sync/quotes/bulk")
def bulk_sync_quotes(
    request: BulkSyncRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Toplu teklif senkronize et"""
    try:
        sync_service = MikroSyncService(db)
        
        results = {
            "total": len(request.entity_ids),
            "success": 0,
            "failed": 0,
            "details": []
        }
        
        for quote_id in request.entity_ids:
            try:
                quote_data = {}
                quote_lines = []
                result = sync_service.sync_quote_to_mikro(quote_id, quote_data, quote_lines)
                
                if result.get("success"):
                    results["success"] += 1
                else:
                    results["failed"] += 1
                
                results["details"].append({
                    "quote_id": quote_id,
                    "result": result
                })
            except Exception as e:
                results["failed"] += 1
                results["details"].append({
                    "quote_id": quote_id,
                    "error": str(e)
                })
        
        return results
    except Exception as e:
        logger.error(f"BulkQuote sync hatası: {e}")
        raise AppError(500, "INTEGRATION_ERROR", str(e))


# -----------------------------------------------------------------------------
# SİPARİŞ SENKRONIZASYONU
# -----------------------------------------------------------------------------

@router.post("/sync/orders/{order_id}")
def sync_order(
    order_id: int,
    request: SyncRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Tek sipariş senkronize et"""
    try:
        sync_service = MikroSyncService(db)
        
        # Gerçek sipariş verisini çek
        order_data = {}  # Order service'den çekilecek
        order_items = []
        
        result = sync_service.sync_order_to_mikro(order_id, order_data, order_items)
        return result
    except Exception as e:
        logger.error(f"Order sync hatası: {e}")
        raise AppError(500, "INTEGRATION_ERROR", str(e))


@router.post("/sync/orders/bulk")
def bulk_sync_orders(
    request: BulkSyncRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Toplu sipariş senkronize et"""
    try:
        sync_service = MikroSyncService(db)
        
        results = {
            "total": len(request.entity_ids),
            "success": 0,
            "failed": 0,
            "details": []
        }
        
        for order_id in request.entity_ids:
            try:
                order_data = {}
                order_items = []
                result = sync_service.sync_order_to_mikro(int(order_id), order_data, order_items)
                
                if result.get("success"):
                    results["success"] += 1
                else:
                    results["failed"] += 1
                
                results["details"].append({
                    "order_id": order_id,
                    "result": result
                })
            except Exception as e:
                results["failed"] += 1
                results["details"].append({
                    "order_id": order_id,
                    "error": str(e)
                })
        
        return results
    except Exception as e:
        logger.error(f"Bulk order sync hatası: {e}")
        raise AppError(500, "INTEGRATION_ERROR", str(e))


# -----------------------------------------------------------------------------
# MAPPING OPERATIONS
# -----------------------------------------------------------------------------

@router.get("/mappings")
def get_entity_mappings(
    entity_type: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Entity mapping'lerini getir"""
    try:
        from ..models import IntegrationEntityMap
        
        query = db.query(IntegrationEntityMap)
        
        if entity_type:
            query = query.filter_by(entity_type=entity_type)
        
        mappings = query.all()
        
        return [
            {
                "internal_id": m.internal_id,
                "external_id": m.external_id,
                "entity_type": m.entity_type,
                "integration_system": m.integration_system,
                "last_synced": m.last_synced_at.isoformat() if m.last_synced_at else None
            }
            for m in mappings
        ]
    except Exception as e:
        logger.error(f"Mapping getirme hatası: {e}")
        raise AppError(500, "INTEGRATION_ERROR", str(e))


