"""
OptiPlan360 — WhatsApp Scheduler (Opsiyonel)
PENDING durumdaki WhatsApp mesajlarını periyodik olarak gönderir.
NOT: Henüz production'da etkinleştirilmemiştir.
      main.py'den start_scheduler() çağrılırsa etkin olur.
"""
import logging
from datetime import datetime, timezone
from uuid import uuid4

from app.database import SessionLocal
from app.models import WhatsAppMessage, AuditLog
from app.services.whatsapp_service import _is_configured, _get_setting

logger = logging.getLogger(__name__)

_scheduler_instance = None


def is_within_working_hours() -> bool:
    """Mesai saatleri kontrolü (09:00-18:00 UTC)"""
    now = datetime.now(timezone.utc)
    return 9 <= now.hour < 18


def check_and_send_pending() -> None:
    """
    DB'deki PENDING WhatsApp mesajlarını kontrol et ve gönder.
    APScheduler job callback'i olarak çağrılır.
    """
    import httpx

    db = SessionLocal()
    try:
        if not is_within_working_hours():
            logger.debug("Mesai dışı — WhatsApp gönderim atlandı")
            return

        if not _is_configured(db):
            logger.debug("WhatsApp yapılandırılmamış — atlandı")
            return

        pending = (
            db.query(WhatsAppMessage)
            .filter(WhatsAppMessage.status == "PENDING")
            .limit(20)
            .all()
        )
        if not pending:
            return

        pid = _get_setting(db, "phone_number_id")
        token = _get_setting(db, "access_token")
        api_ver = _get_setting(db, "api_version", "v18.0")
        url = f"https://graph.facebook.com/{api_ver}/{pid}/messages"

        with httpx.Client(timeout=10) as client:
            for msg in pending:
                try:
                    payload = {
                        "messaging_product": "whatsapp",
                        "to": msg.to_phone,
                        "type": "text",
                        "text": {"body": msg.message},
                    }
                    resp = client.post(
                        url,
                        json=payload,
                        headers={
                            "Authorization": f"Bearer {token}",
                            "Content-Type": "application/json",
                        },
                    )
                    if resp.status_code == 200:
                        data = resp.json()
                        msg.status = "SENT"
                        msg.waba_message_id = data.get("messages", [{}])[0].get("id")
                    else:
                        msg.status = "FAILED"
                        msg.error = resp.text[:200]
                except Exception as e:
                    msg.status = "FAILED"
                    msg.error = str(e)[:200]
                    logger.error("Scheduler WhatsApp gönderim hatası: %s", e)

                db.add(AuditLog(
                    id=str(uuid4()),
                    user_id=msg.sent_by_id,
                    order_id=msg.order_id,
                    action="WHATSAPP_SCHEDULER",
                    detail=f"Scheduler: {msg.to_phone} → {msg.status}",
                    created_at=datetime.now(timezone.utc),
                ))
            db.commit()
            logger.info("Scheduler: %d PENDING mesaj işlendi", len(pending))
    except Exception as e:
        logger.error("WhatsApp scheduler genel hata: %s", e)
    finally:
        db.close()


def start_scheduler() -> None:
    """APScheduler'ı başlat — main.py'den çağrılır (opsiyonel)"""
    global _scheduler_instance
    try:
        from apscheduler.schedulers.background import BackgroundScheduler
    except ImportError:
        logger.warning("apscheduler paketi yüklü değil — WhatsApp scheduler devre dışı")
        return

    if _scheduler_instance and _scheduler_instance.running:
        return

    _scheduler_instance = BackgroundScheduler()
    _scheduler_instance.add_job(check_and_send_pending, "interval", minutes=5)
    _scheduler_instance.start()
    logger.info("WhatsApp scheduler başlatıldı (5 dk aralık)")


def stop_scheduler() -> None:
    """Scheduler'ı durdur"""
    global _scheduler_instance
    if _scheduler_instance and _scheduler_instance.running:
        _scheduler_instance.shutdown()
        logger.info("WhatsApp scheduler durduruldu")
