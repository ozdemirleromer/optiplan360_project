"""
OptiPlan 360 - Worker Service

APScheduler tarafindan periyodik olarak cagrilir.
DB'den OPTI_IMPORTED job'lari alir ve tek backend ile calistirir:
  - ui_automation: pywinauto ile Stage1/Stage2 otomasyon

Akis:
  OPTI_IMPORTED -> [claim: OPTI_RUNNING] -> [ui_automation calisir]
    -> basari: OPTI_DONE  (veri aktarildi, optimizasyon bekleniyor)
    -> hata:   FAILED

Circuit Breaker:
  MAX_CONSECUTIVE_FAILURES ardisik hata -> worker durur.
  Admin /jobs/worker/reset endpoint'i ile sifirlanir.
"""

import importlib.util
import json
import logging
import os
import platform
import subprocess
import sys
import threading
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..database import SessionLocal
from ..models import OptiAuditEvent, OptiJob, OptiJobStateEnum
from . import tracking_folder_service as tracking

logger = logging.getLogger(__name__)

# -- Konfigurasyon --
OPTIPLAN_IMPORT_DIR = os.environ.get(
    "OPTIPLAN_IMPORT_DIR",
    r"C:\Biesse\OptiPlanning\ImpFile",
)


def _resolve_professional_run_script() -> str:
    env_path = os.environ.get("OPTIPLAN_PROFESSIONAL_SCRIPT", "").strip()
    backend_root = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
    repo_root = os.path.dirname(backend_root)

    candidates: list[str] = []
    if env_path:
        candidates.append(env_path)

    candidates.extend(
        [
            os.path.join(backend_root, "scripts", "optiplan_professional_run.py"),
            os.path.join(repo_root, "scripts", "optiplan_professional_run.py"),
        ]
    )

    for candidate in candidates:
        if os.path.exists(candidate):
            return candidate

    return env_path or candidates[0]


PROFESSIONAL_RUN_SCRIPT = _resolve_professional_run_script()
# Subprocess timeout: 3 dakika (Stage1+Stage2, optimizasyon yok)
SUBPROCESS_TIMEOUT_S = int(os.environ.get("OPTIPLAN_WORKER_TIMEOUT_S", "180"))

# Worker tek motor ile calisir.
WORKER_ENGINE = "ui_automation"

# -- Circuit Breaker --
MAX_CONSECUTIVE_FAILURES = 3
_lock = threading.Lock()
_consecutive_failures = 0
_circuit_open = False
_last_run_at: Optional[datetime] = None
_last_error: Optional[str] = None


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


def _claim_job(db: Session, job: OptiJob) -> bool:
    """
    OPTI_IMPORTED -> OPTI_RUNNING atomik gecis.
    DB'de unique partial index (uq_single_opti_running) varsa,
    ayni anda sadece 1 job OPTI_RUNNING olabilir.
    IntegrityError -> baska bir worker zaten calisiyor.
    """
    job.state = OptiJobStateEnum.OPTI_RUNNING
    _add_audit(
        db,
        job.id,
        "STATE_OPTI_RUNNING",
        "Worker tarafindan claim edildi",
        {"engine": WORKER_ENGINE},
    )
    try:
        db.commit()
        # Tracking: OPTI_RUNNING klasorune tasi
        tracking.on_state_change(
            new_state="OPTI_RUNNING",
            job_id=job.id,
            xlsx_path=getattr(job, "xlsx_file_path", None),
        )
        return True
    except IntegrityError:
        db.rollback()
        logger.warning("Job %s claim edilemedi (baska is OPTI_RUNNING)", job.id)
        return False


def _prepare_xlsx(db: Session, job: OptiJob) -> str:
    """
    Job'in order'indan XLSX olusturur ve ImpFile'a kopyalar.
    OptiPlanningService.export_order() kullanir.
    Donen: XLSX dosya yolu.
    """
    from .optiplanning_service import OptiPlanningService

    service = OptiPlanningService(export_dir=OPTIPLAN_IMPORT_DIR)
    generated_files = service.export_order(
        db=db,
        order_id=str(job.order_id),
        trigger_exe=False,
        format_type="EXCEL",
    )
    if not generated_files:
        raise RuntimeError(f"XLSX uretilemedi: order_id={job.order_id}")

    xlsx_path = generated_files[0]
    logger.info("Job %s: XLSX olusturuldu -> %s", job.id, xlsx_path)

    # Tracking: XLSX'i takip klasorlerine kopyala
    tracking.on_xlsx_created(xlsx_path, job.id)
    tracking.write_daily_log(f"XLSX olusturuldu: job={job.id[:8]}, path={xlsx_path}")

    return xlsx_path


def _run_professional(xlsx_path: str, timeout_s: int = SUBPROCESS_TIMEOUT_S) -> tuple[bool, str]:
    """
    optiplan_professional_run.py'yi subprocess olarak calistirir.
    Returns: (success, combined_output)
    """
    forced = os.environ.get("OPTIPLAN_FORCE_WORKER", "").strip() == "1"
    if not forced and platform.system().lower() != "windows":
        return (
            False,
            "Worker sadece Windows ortaminda calisabilir (pywinauto gerekli). Job HOLD'a alinacak.",
        )

    if not os.path.exists(PROFESSIONAL_RUN_SCRIPT):
        return False, f"Script bulunamadi: {PROFESSIONAL_RUN_SCRIPT}"

    if importlib.util.find_spec("pywinauto") is None:
        return False, "pywinauto modulu bulunamadi. Job HOLD'a alinacak."

    cmd = [
        sys.executable,
        PROFESSIONAL_RUN_SCRIPT,
        "--xlsx",
        xlsx_path,
        "--timeout",
        "60",
        "--skip-preflight",
        "--skip-optimize",
        "--skip-ui-map",
    ]

    logger.info("Worker subprocess baslatiliyor: %s", " ".join(cmd))

    try:
        proc = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=timeout_s,
            cwd=os.path.dirname(os.path.dirname(PROFESSIONAL_RUN_SCRIPT)),
        )
        output = (proc.stdout or "") + (proc.stderr or "")
        if proc.returncode == 0:
            return True, output
        return False, f"Exit code {proc.returncode}: {output[-500:]}"
    except subprocess.TimeoutExpired:
        return False, f"Subprocess timeout ({timeout_s}s)"
    except FileNotFoundError:
        return False, f"Script bulunamadi: {PROFESSIONAL_RUN_SCRIPT}"
    except Exception as exc:
        return False, f"Subprocess hatasi: {exc}"


def _hold_job(db: Session, job: OptiJob, reason: str):
    """Calisma ortami uygun degilse job'i HOLD durumuna al."""
    job.state = OptiJobStateEnum.HOLD
    job.error_code = "E_WORKER_ENV_UNSUPPORTED"
    job.error_message = reason[:500] if reason else "Worker ortami uygun degil"
    _add_audit(
        db,
        job.id,
        "STATE_HOLD",
        "Worker ortami uygun degil, job HOLD'a alindi",
        {"engine": WORKER_ENGINE, "reason": reason[:300] if reason else ""},
    )
    logger.warning("Job %s: OPTI_RUNNING -> HOLD: %s", job.id, reason)
    db.commit()


def _finalize_job(db: Session, job: OptiJob, success: bool, log: str):
    """OPTI_DONE veya FAILED + audit event yazar."""
    if success:
        job.state = OptiJobStateEnum.OPTI_DONE
        job.error_code = None
        job.error_message = None
        _add_audit(
            db,
            job.id,
            "STATE_OPTI_DONE",
            "OptiPlanning arka plan calismasi tamamlandi, XML bekleniyor",
            {"engine": WORKER_ENGINE, "log_tail": log[-300:] if log else ""},
        )
        logger.info("Job %s: OPTI_RUNNING -> OPTI_DONE", job.id)
    else:
        job.state = OptiJobStateEnum.FAILED
        job.error_code = "E_OPTI_WORKER_FAILED"
        job.error_message = log[-500:] if log else "Bilinmeyen hata"
        _add_audit(
            db,
            job.id,
            "STATE_FAILED",
            "Worker hatasi",
            {"engine": WORKER_ENGINE, "log_tail": log[-300:] if log else ""},
        )
        logger.error("Job %s: OPTI_RUNNING -> FAILED: %s", job.id, log[-200:])
    db.commit()

    # Tracking: dosyayi ilgili takip klasorune tasi
    new_state = "OPTI_DONE" if success else "FAILED"
    xlsx_path = getattr(job, "xlsx_file_path", None)
    tracking.on_state_change(
        new_state=new_state,
        job_id=job.id,
        xlsx_path=xlsx_path,
        error_message=log[-500:] if not success and log else "",
    )
    tracking.write_daily_log(
        f"Job {job.id[:8]}: -> {new_state}" + (f" HATA: {log[-100:]}" if not success else "")
    )


def poll_and_run_once() -> dict:
    """
    APScheduler tarafindan cagrilir. Tek bir OPTI_IMPORTED job isler.

    Returns:
        {"status": "idle"|"processed"|"failed"|"circuit_open", ...}
    """
    global _consecutive_failures, _circuit_open, _last_run_at, _last_error

    _last_run_at = datetime.now(tz=timezone.utc)

    # Circuit breaker kontrolu
    with _lock:
        if _circuit_open:
            return {"status": "circuit_open", "consecutive_failures": _consecutive_failures}

    db: Session = SessionLocal()
    try:
        # En eski OPTI_IMPORTED job'i al (FIFO)
        job = (
            db.query(OptiJob)
            .filter(OptiJob.state == OptiJobStateEnum.OPTI_IMPORTED)
            .order_by(OptiJob.created_at.asc())
            .first()
        )

        if not job:
            return {"status": "idle"}

        # Job'i claim et (OPTI_RUNNING)
        if not _claim_job(db, job):
            return {"status": "claim_failed", "job_id": job.id}

        # XLSX hazirla
        try:
            xlsx_path = _prepare_xlsx(db, job)
        except Exception as exc:
            _finalize_job(db, job, False, f"XLSX hazirlama hatasi: {exc}")
            _record_failure(str(exc))
            return {"status": "failed", "job_id": job.id, "error": str(exc)}

        # pywinauto ortami mevcut mu kontrol et
        forced = os.environ.get("OPTIPLAN_FORCE_WORKER", "").strip() == "1"
        can_run_pywinauto = forced or (
            platform.system().lower() == "windows"
            and importlib.util.find_spec("pywinauto") is not None
            and os.path.exists(PROFESSIONAL_RUN_SCRIPT)
        )

        if can_run_pywinauto:
            # Windows + pywinauto: otomatik Stage1+Stage2
            success, log = _run_professional(xlsx_path)

            if not success and (
                "HOLD'a alinacak" in log
                or "Script bulunamadi" in log
                or "Worker sadece Windows ortaminda" in log
            ):
                _hold_job(db, job, log)
                return {
                    "status": "held",
                    "job_id": job.id,
                    "error": log[:200],
                    "engine": WORKER_ENGINE,
                }

            _finalize_job(db, job, success, log)

            if success:
                _record_success()
                return {"status": "processed", "job_id": job.id, "engine": WORKER_ENGINE}
            else:
                _record_failure(log)
                return {
                    "status": "failed",
                    "job_id": job.id,
                    "error": log[-200:],
                    "engine": WORKER_ENGINE,
                }
        else:
            # Docker/Linux: XLSX hazir, pywinauto yok → OPTI_DONE (kullanici elle aktaracak)
            _finalize_job(
                db,
                job,
                True,
                f"XLSX hazir: {xlsx_path}. pywinauto ortami yok, kullanici elle aktaracak.",
            )
            _record_success()
            return {
                "status": "processed",
                "job_id": job.id,
                "engine": "xlsx_only",
                "xlsx_path": xlsx_path,
            }

    except Exception as exc:
        logger.error("poll_and_run_once beklenmeyen hata: %s", exc, exc_info=True)
        db.rollback()
        _record_failure(str(exc))
        return {"status": "error", "error": str(exc)}
    finally:
        db.close()


def _record_success():
    global _consecutive_failures
    with _lock:
        _consecutive_failures = 0


def _record_failure(error_msg: str):
    global _consecutive_failures, _circuit_open, _last_error
    with _lock:
        _consecutive_failures += 1
        _last_error = error_msg
        if _consecutive_failures >= MAX_CONSECUTIVE_FAILURES:
            _circuit_open = True
            logger.critical(
                "Worker circuit breaker ACIK: %d ardisik hata. Admin reset gerekli.",
                _consecutive_failures,
            )


def get_worker_status() -> dict:
    """Worker durumu: circuit breaker, son calisma, kuyruk uzunlugu."""
    db: Session = SessionLocal()
    try:
        queue_count = (
            db.query(OptiJob).filter(OptiJob.state == OptiJobStateEnum.OPTI_IMPORTED).count()
        )
        running_count = (
            db.query(OptiJob).filter(OptiJob.state == OptiJobStateEnum.OPTI_RUNNING).count()
        )
    finally:
        db.close()

    return {
        "circuit_open": _circuit_open,
        "consecutive_failures": _consecutive_failures,
        "max_consecutive_failures": MAX_CONSECUTIVE_FAILURES,
        "last_run_at": _last_run_at.isoformat() if _last_run_at else None,
        "last_error": _last_error,
        "engine": WORKER_ENGINE,
        "supported_engines": [WORKER_ENGINE],
        "queue_count": queue_count,
        "running_count": running_count,
        "script_path": PROFESSIONAL_RUN_SCRIPT,
        "script_exists": os.path.exists(PROFESSIONAL_RUN_SCRIPT),
    }


def reset_circuit_breaker():
    """Admin: circuit breaker'i sifirlar, worker tekrar calisir."""
    global _consecutive_failures, _circuit_open, _last_error
    with _lock:
        _consecutive_failures = 0
        _circuit_open = False
        _last_error = None
    logger.info("Worker circuit breaker sifirlandi (admin)")
