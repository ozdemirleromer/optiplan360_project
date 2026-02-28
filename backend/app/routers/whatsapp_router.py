"""
OptiPlan 360 — WhatsApp Router
İnce HTTP katmanı: sadece parametreleri al, servisi çağır, yanıt dön.
Tüm iş mantığı whatsapp_service.py içinde.
"""

import logging
from typing import Optional

from app.auth import get_current_user
from app.database import get_db
from app.models import User
from app.schemas import (
    WhatsAppConfigResponse,
    WhatsAppConfigUpdate,
    WhatsAppMessageResponse,
    WhatsAppMessageSend,
    WhatsAppSummaryResponse,
    WhatsAppTemplateResponse,
    WhatsAppUnreadResponse,
)
from app.services.whatsapp_service import get_config as svc_get_config
from app.services.whatsapp_service import get_summary as svc_get_summary
from app.services.whatsapp_service import get_templates as svc_get_templates
from app.services.whatsapp_service import handle_read_webhook as svc_handle_read_webhook
from app.services.whatsapp_service import list_messages as svc_list_messages
from app.services.whatsapp_service import send_message as svc_send_message
from app.services.whatsapp_service import update_config as svc_update_config
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/whatsapp", tags=["whatsapp"])


# ═══════════════════════════════════════════════════
# YAPILANDIRMA
# ═══════════════════════════════════════════════════


@router.get("/config", response_model=WhatsAppConfigResponse)
def get_config(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """WhatsApp yapılandırmasını getir (token gizli)"""
    return svc_get_config(db, current_user)


@router.put("/config", response_model=WhatsAppConfigResponse)
def update_config(
    body: WhatsAppConfigUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """WhatsApp yapılandırmasını güncelle — sadece ADMIN"""
    return svc_update_config(
        db,
        current_user,
        phone_number_id=body.phone_number_id,
        business_account_id=body.business_account_id,
        access_token=body.access_token,
        api_version=body.api_version,
    )


# ═══════════════════════════════════════════════════
# ŞABLONLAR
# ═══════════════════════════════════════════════════


@router.get("/templates", response_model=list[WhatsAppTemplateResponse])
def list_templates(
    _user: User = Depends(get_current_user),
):
    """Mesaj şablonlarını listele"""
    return svc_get_templates()


# ═══════════════════════════════════════════════════
# MESAJ GÖNDER
# ═══════════════════════════════════════════════════


@router.post("/send", response_model=WhatsAppMessageResponse, status_code=201)
async def send_message(
    body: WhatsAppMessageSend,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """WhatsApp mesajı gönder"""
    return await svc_send_message(
        db,
        current_user,
        to_phone=body.to_phone,
        template_name=body.template_name,
        message_text=body.message_text,
        order_id=body.order_id,
    )


# ═══════════════════════════════════════════════════
# MESAJ GEÇMİŞİ
# ═══════════════════════════════════════════════════


@router.get("/messages", response_model=list[WhatsAppMessageResponse])
def list_messages(
    order_id: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Mesaj geçmişini listele"""
    return svc_list_messages(db, current_user, order_id)


# ═══════════════════════════════════════════════════
# ÖZET
# ═══════════════════════════════════════════════════


@router.get("/summary", response_model=WhatsAppSummaryResponse)
def get_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """WhatsApp mesaj özetini getir"""
    return svc_get_summary(db, current_user)


# ═══════════════════════════════════════════════════
# OKUNMA TAKİBİ WEBHOOK
# ═══════════════════════════════════════════════════


@router.post("/webhook/read")
def handle_read_webhook(
    webhook_data: dict,
    db: Session = Depends(get_db),
):
    """WhatsApp okunma takibi webhook'u — Meta WABA'dan gelir"""
    return svc_handle_read_webhook(db, webhook_data)


# ═══════════════════════════════════════════════════
# OKUNMAMIŞ MESAJLAR
# ═══════════════════════════════════════════════════


@router.get("/unread-messages", response_model=WhatsAppUnreadResponse)
def get_unread_messages(
    order_id: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Okunmamış mesajları listele"""
    return svc_list_messages(db, current_user, order_id)
