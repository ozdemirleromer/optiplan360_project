"""
OptiPlan 360 - XML Collector Service

OptiPlanning'in urettigi .xml dosyalarini izler, is durumlarini gunceller
ve dosyayi makine drop klasorune tasir.

AGENT_ONEFILE §4 — OSI ACK MODE (LOCKED):
  machineDropFolder altinda inbox/processed/failed alt klasorleri zorunlu.
  Orchestrator XML teslimini inbox/ icine atomik yapar.
  Ayni dosya adi processed/ altinda gorunurse DELIVERED.
  Ayni dosya adi failed/ altinda gorunurse FAILED.
  ACK timeout = 5 dakika.

AGENT_ONEFILE §7 — TIMEOUT:
  OptiPlanning XML bekleme timeout: 20 dakika (OPTI_RUNNING'den itibaren)
  OSI ACK timeout: 5 dakika (E_OSI_ACK_TIMEOUT)

Akis:
  OPTI_IMPORTED / OPTI_RUNNING -> [xml bulundu] -> XML_READY
  XML_READY -> [inbox/'a kopyalandi] -> DELIVERED
  DELIVERED -> [processed/'da bulundu] -> DONE
  [zaman asimi / hata] -> FAILED

Env vars:
  OPTIPLAN_EXPORT_DIR   : OptiPlanning'in xml urettigi klasor
  MACHINE_DROP_DIR      : Makinenin okuduuu drop klasoru (inbox/processed/failed alt klasorleri)
  XML_COLLECT_TIMEOUT_S : OPTI_RUNNING -> FAILED zaman asimi (saniye, varsayilan 1200=20dk)
  MACHINE_ACK_TIMEOUT_S : DELIVERED -> FAILED zaman asimi (saniye, varsayilan 300=5dk)
"""

import json
import logging
import os
import shutil
from datetime import datetime, timezone
from typing import Optional
from xml.etree import ElementTree as ET

from sqlalchemy.orm import Session

from ..database import SessionLocal
from ..models import OptiAuditEvent, OptiJob, OptiJobStateEnum
from . import tracking_folder_service as tracking

logger = logging.getLogger(__name__)

# -- Konfigurasyon --
OPTIPLAN_EXPORT_DIR = os.environ.get(
    "OPTIPLAN_EXPORT_DIR",
    r"C:\Biesse\OptiPlanning\Tmp\Sol",
)
MACHINE_DROP_DIR = os.environ.get(
    "MACHINE_DROP_DIR",
    r"C:\Biesse\OptiPlanning\Tx",
)
# AGENT_ONEFILE §7: XML bekleme timeout = 20 dakika
XML_COLLECT_TIMEOUT_S = int(os.environ.get("XML_COLLECT_TIMEOUT_S", "1200"))
# AGENT_ONEFILE §4: OSI ACK timeout = 5 dakika
MACHINE_ACK_TIMEOUT_S = int(os.environ.get("MACHINE_ACK_TIMEOUT_S", "300"))

# AGENT_ONEFILE §4: machineDropFolder altinda inbox/processed/failed zorunlu
MACHINE_INBOX_DIR = os.path.join(MACHINE_DROP_DIR, "inbox")
MACHINE_PROCESSED_DIR = os.path.join(MACHINE_DROP_DIR, "processed")
MACHINE_FAILED_DIR = os.path.join(MACHINE_DROP_DIR, "failed")

# Klasorleri olustur (yoksa)
for _d in (
    OPTIPLAN_EXPORT_DIR,
    MACHINE_DROP_DIR,
    MACHINE_INBOX_DIR,
    MACHINE_PROCESSED_DIR,
    MACHINE_FAILED_DIR,
):
    os.makedirs(_d, exist_ok=True)


# -- Yardimci Fonksiyonlar --


def _add_audit(
    db: Session, job_id: str, event_type: str, message: str, details: dict | None = None
):
    event = OptiAuditEvent(
        job_id=job_id,
        event_type=event_type,
        message=message,
        details_json=json.dumps(details, default=str) if details else None,
    )
    db.add(event)


def _validate_xml(xml_path: str) -> tuple[bool, str]:
    """XML dosyasini temel duzeyde dogrular."""
    try:
        tree = ET.parse(xml_path)
        root = tree.getroot()
        if root is None:
            return False, "XML kok elementi bos"
        if len(list(root)) == 0:
            return False, "XML icerigi bos (element yok)"
        return True, ""
    except ET.ParseError as e:
        return False, f"XML parse hatasi: {e}"
    except Exception as e:
        return False, f"XML okuma hatasi: {e}"


def _find_xml_for_job(job_id: str, prefix: str) -> Optional[str]:
    """OPTIPLAN_EXPORT_DIR icinde job_id veya prefix ile baslayan .xml dosyasini bulur."""
    if not os.path.isdir(OPTIPLAN_EXPORT_DIR):
        return None

    short_id = job_id[:8] if job_id else ""
    for fname in os.listdir(OPTIPLAN_EXPORT_DIR):
        if not fname.lower().endswith(".xml"):
            continue
        name_lower = fname.lower()
        if short_id and name_lower.startswith(short_id.lower()):
            return os.path.join(OPTIPLAN_EXPORT_DIR, fname)
        if prefix and name_lower.startswith(prefix.lower()):
            return os.path.join(OPTIPLAN_EXPORT_DIR, fname)
    return None


def _find_any_new_xml(since: datetime) -> Optional[str]:
    """OPTIPLAN_EXPORT_DIR'de `since` tarihinden sonra degistirilmis ilk .xml'i dondurur."""
    if not os.path.isdir(OPTIPLAN_EXPORT_DIR):
        return None
    for fname in sorted(os.listdir(OPTIPLAN_EXPORT_DIR)):
        if not fname.lower().endswith(".xml"):
            continue
        fpath = os.path.join(OPTIPLAN_EXPORT_DIR, fname)
        mtime = datetime.fromtimestamp(os.path.getmtime(fpath), tz=timezone.utc)
        if mtime >= since:
            return fpath
    return None


def _get_state_transition_time(
    db: Session, job_id: str, target_event_type: str
) -> Optional[datetime]:
    """Audit event'ten belirli bir state gecis zamanini bulur."""
    event = (
        db.query(OptiAuditEvent)
        .filter(
            OptiAuditEvent.job_id == job_id,
            OptiAuditEvent.event_type == target_event_type,
        )
        .order_by(OptiAuditEvent.created_at.desc())
        .first()
    )
    if event and event.created_at:
        ts = event.created_at
        if ts.tzinfo is None:
            ts = ts.replace(tzinfo=timezone.utc)
        return ts
    return None


def _file_in_dir(filename: str, directory: str) -> bool:
    """Belirtilen klasorde dosya adi var mi kontrol eder."""
    return os.path.exists(os.path.join(directory, filename))


# -- Ana Collect Dongusu --


def collect_xml_once() -> dict:
    """
    Tek bir tarama dongusu. APScheduler tarafindan periyodik olarak cagrilir.

    Returns:
        {"processed": int, "failed": int, "delivered": int, "done": int}
    """
    stats = {"processed": 0, "failed": 0, "delivered": 0, "done": 0}
    db: Session = SessionLocal()

    try:
        now = datetime.now(tz=timezone.utc)

        # -- 1) OPTI_IMPORTED / OPTI_RUNNING / OPTI_DONE -> XML_READY --
        running_jobs = (
            db.query(OptiJob)
            .filter(
                OptiJob.state.in_(
                    [
                        OptiJobStateEnum.OPTI_IMPORTED,
                        OptiJobStateEnum.OPTI_RUNNING,
                        OptiJobStateEnum.OPTI_DONE,
                    ]
                )
            )
            .all()
        )

        for job in running_jobs:
            # AGENT_ONEFILE §7: XML timeout OPTI_RUNNING'den itibaren hesaplanir
            state_time = _get_state_transition_time(db, job.id, "STATE_OPTI_RUNNING")
            if not state_time:
                state_time = _get_state_transition_time(db, job.id, "STATE_OPTI_IMPORTED")
            if not state_time:
                # Fallback: created_at
                state_time = job.created_at
                if state_time and state_time.tzinfo is None:
                    state_time = state_time.replace(tzinfo=timezone.utc)

            if state_time and (now - state_time).total_seconds() > XML_COLLECT_TIMEOUT_S:
                job.state = OptiJobStateEnum.FAILED
                job.error_code = "E_OPTI_XML_TIMEOUT"
                job.error_message = f"XML bekleme zaman asimi ({XML_COLLECT_TIMEOUT_S}s)"
                _add_audit(
                    db,
                    job.id,
                    "STATE_FAILED",
                    "Zaman asimi: XML gelmedi",
                    {"timeout_s": XML_COLLECT_TIMEOUT_S},
                )
                db.commit()
                tracking.on_state_change(
                    "FAILED", job.id, error_message=f"XML timeout ({XML_COLLECT_TIMEOUT_S}s)"
                )
                tracking.write_daily_log(
                    f"Job {job.id[:8]}: FAILED - XML timeout", log_type="collector"
                )
                stats["failed"] += 1
                continue

            # Job'a ait XML ara
            xml_path = _find_xml_for_job(job.id, prefix="")
            if xml_path is None and state_time:
                xml_path = _find_any_new_xml(since=state_time)

            if xml_path is None:
                continue

            # XML dogrula
            is_valid, err_msg = _validate_xml(xml_path)
            if not is_valid:
                logger.warning("Gecersiz XML (job=%s): %s - %s", job.id, xml_path, err_msg)
                job.state = OptiJobStateEnum.FAILED
                job.error_code = "E_XML_INVALID"
                job.error_message = err_msg
                _add_audit(
                    db, job.id, "STATE_FAILED", f"Gecersiz XML: {err_msg}", {"xml_path": xml_path}
                )
                db.commit()
                tracking.on_state_change("FAILED", job.id, xml_path=xml_path, error_message=err_msg)
                tracking.write_daily_log(
                    f"Job {job.id[:8]}: FAILED - Gecersiz XML: {err_msg}", log_type="collector"
                )
                stats["failed"] += 1
                _move_to_failed(xml_path)
                continue

            # Gecerli XML -> XML_READY + parse sonucu
            xml_fname = os.path.basename(xml_path)
            parse_result = _parse_solution_xml(xml_path)

            job.state = OptiJobStateEnum.XML_READY
            job.xml_file_path = xml_path
            # Parse sonucunu result_json'a kaydet (plaka adedi, maliyet vb.)
            if hasattr(job, "result_json"):
                job.result_json = json.dumps(parse_result, default=str)

            _add_audit(
                db,
                job.id,
                "STATE_XML_READY",
                "XML bulundu, dogrulandi ve parse edildi",
                {"xml_file": xml_fname, **parse_result},
            )
            db.commit()
            stats["processed"] += 1

            # AGENT_ONEFILE §4: inbox/ icine atomik kopyala
            inbox_tmp = os.path.join(MACHINE_INBOX_DIR, xml_fname + ".tmp")
            inbox_final = os.path.join(MACHINE_INBOX_DIR, xml_fname)
            try:
                shutil.copy2(xml_path, inbox_tmp)
                if os.path.exists(inbox_final):
                    os.remove(inbox_final)
                os.rename(inbox_tmp, inbox_final)
                os.remove(xml_path)  # Export klasorunden kaldir
            except OSError as e:
                logger.error("XML inbox kopyalama hatasi: %s", e)
                if os.path.exists(inbox_tmp):
                    try:
                        os.remove(inbox_tmp)
                    except OSError:
                        pass
                continue

            job.state = OptiJobStateEnum.DELIVERED
            job.xml_file_path = inbox_final
            _add_audit(
                db,
                job.id,
                "STATE_DELIVERED",
                "XML makine inbox klasorune kopyalandi",
                {"inbox_path": inbox_final, "xml_file": xml_fname},
            )
            db.commit()

            # Tracking: XML_READY ve DELIVERED klasorlerine tasi
            tracking.on_state_change("XML_READY", job.id, xml_path=xml_path)
            tracking.on_state_change("DELIVERED", job.id, xml_path=inbox_final)
            tracking.write_daily_log(
                f"Job {job.id[:8]}: XML_READY -> DELIVERED ({xml_fname})", log_type="collector"
            )

            stats["delivered"] += 1
            logger.info("Job %s: XML_READY -> DELIVERED (%s)", job.id, xml_fname)

        # -- 2) DELIVERED -> DONE (ACK bekleniyor: file_move modu) --
        delivered_jobs = db.query(OptiJob).filter(OptiJob.state == OptiJobStateEnum.DELIVERED).all()

        for job in delivered_jobs:
            xml_fname = _get_delivered_xml_fname(db, job.id)
            if not xml_fname:
                continue

            # AGENT_ONEFILE §4: processed/ altinda gorunurse DONE
            if _file_in_dir(xml_fname, MACHINE_PROCESSED_DIR):
                job.state = OptiJobStateEnum.DONE
                _add_audit(
                    db,
                    job.id,
                    "STATE_DONE",
                    "Makine ACK alindi (processed/)",
                    {"xml_file": xml_fname},
                )
                db.commit()
                tracking.on_state_change(
                    "DONE", job.id, xml_path=os.path.join(MACHINE_PROCESSED_DIR, xml_fname)
                )
                tracking.write_daily_log(
                    f"Job {job.id[:8]}: DONE - Makine ACK", log_type="collector"
                )
                stats["done"] += 1
                logger.info("Job %s: DELIVERED -> DONE", job.id)
                continue

            # AGENT_ONEFILE §4: failed/ altinda gorunurse FAILED
            if _file_in_dir(xml_fname, MACHINE_FAILED_DIR):
                job.state = OptiJobStateEnum.FAILED
                job.error_code = "E_OSI_ACK_FAILED"
                job.error_message = "Makine hata bildirdi (failed/ klasorunde bulundu)"
                _add_audit(
                    db, job.id, "STATE_FAILED", "Makine hata ACK (failed/)", {"xml_file": xml_fname}
                )
                db.commit()
                tracking.on_state_change("FAILED", job.id, error_message="Makine hata ACK")
                tracking.write_daily_log(
                    f"Job {job.id[:8]}: FAILED - Makine hata ACK", log_type="collector"
                )
                stats["failed"] += 1
                continue

            # ACK timeout kontrolu (DELIVERED anindaki audit zamanindan itibaren)
            delivered_time = _get_state_transition_time(db, job.id, "STATE_DELIVERED")
            if not delivered_time:
                delivered_time = job.created_at
                if delivered_time and delivered_time.tzinfo is None:
                    delivered_time = delivered_time.replace(tzinfo=timezone.utc)

            if delivered_time and (now - delivered_time).total_seconds() > MACHINE_ACK_TIMEOUT_S:
                job.state = OptiJobStateEnum.FAILED
                job.error_code = "E_OSI_ACK_TIMEOUT"
                job.error_message = f"Makine ACK zaman asimi ({MACHINE_ACK_TIMEOUT_S}s)"
                _add_audit(
                    db,
                    job.id,
                    "STATE_FAILED",
                    "Makine ACK zaman asimi",
                    {"timeout_s": MACHINE_ACK_TIMEOUT_S},
                )
                db.commit()
                tracking.on_state_change(
                    "FAILED", job.id, error_message=f"ACK timeout ({MACHINE_ACK_TIMEOUT_S}s)"
                )
                tracking.write_daily_log(
                    f"Job {job.id[:8]}: FAILED - ACK timeout", log_type="collector"
                )
                stats["failed"] += 1

    except Exception as exc:
        logger.error("collect_xml_once hatasi: %s", exc, exc_info=True)
        db.rollback()
    finally:
        db.close()

    if any(stats.values()):
        logger.info("XML Collector tarama: %s", stats)

    return stats


def _parse_solution_xml(xml_path: str) -> dict:
    """
    OptiPlanning cozum XML'ini parse eder.
    En iyi cozumu (best='1') bulur ve plaka/maliyet bilgilerini cikarir.

    Returns:
        {
            "best_solution": str,         # cozum adi (p001, ddm01, ...)
            "algorithm": str,             # FGE, DDM, ...
            "mq_boards": float,           # toplam plaka alani (m2)
            "patterns": int,              # doseme deseni sayisi
            "cycles": int,                # makine siklus sayisi
            "zcuts": int,                 # z-eksen kesis sayisi
            "job_time": int,              # is suresi (saniye)
            "job_cost": float,            # is maliyeti
            "mq_drops": float,            # artik malzeme (m2)
            "diff_drops": int,            # farkli artik parca sayisi
            "total_solutions": int,       # toplam cozum sayisi
        }
    """
    try:
        tree = ET.parse(xml_path)
        root = tree.getroot()

        solutions = root.findall("Solution")
        if not solutions:
            return {"error": "Cozum bulunamadi"}

        # En iyi cozumu bul (best='1')
        best = None
        for sol in solutions:
            if sol.get("best") == "1":
                best = sol
                break
        # Bulunamazsa ilkini al
        if best is None:
            best = solutions[0]

        return {
            "best_solution": best.get("name", ""),
            "algorithm": best.get("algo", ""),
            "mq_boards": float(best.get("mqBoards", 0)),
            "patterns": int(best.get("patterns", 0)),
            "cycles": int(best.get("cycles", 0)),
            "zcuts": int(best.get("zcuts", 0)),
            "job_time": int(best.get("jobTime", 0)),
            "job_cost": float(best.get("jobCost", 0)),
            "mq_drops": float(best.get("mqDrops", 0)),
            "diff_drops": int(best.get("diffDrops", 0)),
            "total_solutions": len(solutions),
        }
    except Exception as e:
        logger.error("XML parse hatasi (%s): %s", xml_path, e)
        return {"error": str(e)}


def _move_to_failed(xml_path: str):
    """Hatali XML'i failed alt klasorune tasi."""
    failed_dir = os.path.join(OPTIPLAN_EXPORT_DIR, "failed")
    os.makedirs(failed_dir, exist_ok=True)
    try:
        shutil.move(xml_path, os.path.join(failed_dir, os.path.basename(xml_path)))
    except OSError:
        pass


def _get_delivered_xml_fname(db: Session, job_id: str) -> Optional[str]:
    """Audit event'lerden DELIVERED adiminda kaydedilen XML dosya adini cikar."""
    event = (
        db.query(OptiAuditEvent)
        .filter(
            OptiAuditEvent.job_id == job_id,
            OptiAuditEvent.event_type == "STATE_DELIVERED",
        )
        .order_by(OptiAuditEvent.created_at.desc())
        .first()
    )
    if not event or not event.details_json:
        return None
    try:
        details = json.loads(event.details_json)
        return details.get("xml_file", None)
    except (json.JSONDecodeError, KeyError):
        return None
