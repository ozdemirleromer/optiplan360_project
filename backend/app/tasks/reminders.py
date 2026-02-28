
import json
import os
from datetime import datetime, time, timedelta
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models import Order
from app.services.whatsapp_service import send_template_message

# Mesai saatlerini yükle
# In Docker, working directory is /app, so we need to adjust path
config_path = os.getenv("CONFIG_DIR", "/app/../config") + "/shift_hours.json"
# Fallback: try relative path first, then absolute
if not os.path.exists(config_path):
    config_path = os.path.join(os.path.dirname(__file__), "..", "..", "..", "config", "shift_hours.json")

# If still not found, use a default or create empty config
if not os.path.exists(config_path):
    print(f"Warning: shift_hours.json not found at {config_path}, using defaults")
    SHIFT_HOURS = {"default": {"start": 9, "end": 18}}
else:
    with open(config_path, "r", encoding="utf-8") as f:
        SHIFT_HOURS = json.load(f)

def is_work_hour():
    """
    Mesai saatleri içinde olup olmadığını kontrol eder.
    """
    now = datetime.now()
    current_time = now.time()
    weekday = now.weekday()

    start_hour = SHIFT_HOURS["work_start_hour"]
    end_hour = SHIFT_HOURS["work_end_hour"]

    if weekday == 5: # Cumartesi
        end_hour = SHIFT_HOURS["saturday_work_end_hour"]
    elif weekday == 6 and not SHIFT_HOURS["sunday_work"]: # Pazar
        return False

    return time(start_hour) <= current_time <= time(end_hour)

async def check_ready_orders():
    """
    Teslim alınmayı bekleyen siparişler için hatırlatıcı gönderir.
    (Handoff 0.7)
    """
    if not is_work_hour():
        return

    db: Session = SessionLocal()
    try:
        orders = db.query(Order).filter(
            Order.status == "READY",
            Order.reminder_count < 5,
            (Order.last_reminder_at == None) | 
            (Order.last_reminder_at <= datetime.now() - timedelta(days=2))
        ).all()

        for order in orders:
            await send_template_message(
                order.customer.phone, 
                "order_ready_reminder", 
                order, 
                db, 
                params=["{{company_name}}", "{{order_id}}"]
            )
            order.reminder_count += 1
            order.last_reminder_at = datetime.now()
            db.commit()
    finally:
        db.close()

scheduler = AsyncIOScheduler()

def _run_xml_collector():
    """XML Collector senkron wrapper (APScheduler async değil)."""
    try:
        from app.services.xml_collector_service import collect_xml_once
        collect_xml_once()
    except Exception as exc:
        import logging
        logging.getLogger(__name__).error("XML Collector hatası: %s", exc)


def _run_optiplan_worker():
    """OptiPlanning Worker senkron wrapper (APScheduler async değil)."""
    try:
        from app.services.optiplan_worker_service import poll_and_run_once
        poll_and_run_once()
    except Exception as exc:
        import logging
        logging.getLogger(__name__).error("OptiPlan Worker hatası: %s", exc)


def start_scheduler():
    scheduler.add_job(
        check_ready_orders,
        trigger=IntervalTrigger(hours=1),
        id="ready_order_reminder",
        replace_existing=True,
    )
    # OptiPlanning XML çıktı klasörünü her 30 saniyede bir tara
    scheduler.add_job(
        _run_xml_collector,
        trigger=IntervalTrigger(seconds=30),
        id="xml_collector",
        replace_existing=True,
    )
    # OptiPlanning Worker: OPTI_IMPORTED job'lari alir, GUI otomasyonu calistirir
    scheduler.add_job(
        _run_optiplan_worker,
        trigger=IntervalTrigger(seconds=15),
        id="optiplan_worker",
        max_instances=1,
        replace_existing=True,
    )
    scheduler.start()
