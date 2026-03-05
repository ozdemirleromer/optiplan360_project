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
from ..models import OptiJob, OptiJobStateEnum
from ..models.enums import JobErrorCode
from . import tracking_folder_service as tracking
from .orchestrator_service import OrchestratorService

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
CIRCUIT_OPEN_COOLDOWN_S = int(os.environ.get("OPTIPLAN_WORKER_BREAKER_COOLDOWN_S", "300"))
CIRCUIT_STATE_CLOSED = "CLOSED"
CIRCUIT_STATE_OPEN = "OPEN"
CIRCUIT_STATE_HALF_OPEN = "HALF_OPEN"
_lock = threading.Lock()
_consecutive_failures = 0
_circuit_state = CIRCUIT_STATE_CLOSED
_circuit_opened_at: Optional[datetime] = None
_half_open_probe_in_progress = False
_last_run_at: Optional[datetime] = None
_last_error: Optional[str] = None


def _get_circuit_snapshot(now: Optional[datetime] = None) -> dict:
    current = now or datetime.now(tz=timezone.utc)
    cooldown_remaining_s = 0
    if _circuit_state == CIRCUIT_STATE_OPEN and _circuit_opened_at:
        elapsed = (current - _circuit_opened_at).total_seconds()
        cooldown_remaining_s = max(0, int(CIRCUIT_OPEN_COOLDOWN_S - elapsed))

    return {
        "circuit_state": _circuit_state,
        "circuit_open": _circuit_state == CIRCUIT_STATE_OPEN,
        "consecutive_failures": _consecutive_failures,
        "max_consecutive_failures": MAX_CONSECUTIVE_FAILURES,
        "cooldown_seconds": CIRCUIT_OPEN_COOLDOWN_S,
        "cooldown_remaining_seconds": cooldown_remaining_s,
        "opened_at": _circuit_opened_at.isoformat() if _circuit_opened_at else None,
        "half_open_probe_in_progress": _half_open_probe_in_progress,
    }


def _transition_circuit_if_ready(now: Optional[datetime] = None) -> str:
    global _circuit_state, _half_open_probe_in_progress

    current = now or datetime.now(tz=timezone.utc)
    if _circuit_state != CIRCUIT_STATE_OPEN or _circuit_opened_at is None:
        return _circuit_state

    if (current - _circuit_opened_at).total_seconds() < CIRCUIT_OPEN_COOLDOWN_S:
        return _circuit_state

    _circuit_state = CIRCUIT_STATE_HALF_OPEN
    _half_open_probe_in_progress = False
    logger.warning(
        "Worker circuit breaker HALF_OPEN: cooldown bitti, tek probe calismasi serbest."
    )
    return _circuit_state


def _release_half_open_probe():
    global _half_open_probe_in_progress
    with _lock:
        if _circuit_state == CIRCUIT_STATE_HALF_OPEN:
            _half_open_probe_in_progress = False


def _claim_job(db: Session, job: OptiJob) -> bool:
    """
    OPTI_IMPORTED -> OPTI_RUNNING atomik gecis.
    DB'de unique partial index (uq_single_opti_running) varsa,
    ayni anda sadece 1 job OPTI_RUNNING olabilir.
    IntegrityError -> baska bir worker zaten calisiyor.
    """
    OrchestratorService(db).update_job_state(
        job,
        OptiJobStateEnum.OPTI_RUNNING,
        audit_event_type="STATE_OPTI_RUNNING",
        audit_message="Worker tarafindan claim edildi",
        audit_details={"engine": WORKER_ENGINE},
        commit=False,
        refresh=False,
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
    OrchestratorService(db).update_job_state(
        job,
        OptiJobStateEnum.HOLD,
        audit_event_type="STATE_HOLD",
        audit_message="Worker ortami uygun degil, job HOLD'a alindi",
        audit_details={"engine": WORKER_ENGINE, "reason": reason[:300] if reason else ""},
        error_code=JobErrorCode.WORKER_ENV_UNSUPPORTED,
        error_message=reason[:500] if reason else "Worker ortami uygun degil",
    )
    logger.warning("Job %s: OPTI_RUNNING -> HOLD: %s", job.id, reason)


def _finalize_job(db: Session, job: OptiJob, success: bool, log: str):
    """OPTI_DONE veya FAILED + audit event yazar."""
    if success:
        OrchestratorService(db).update_job_state(
            job,
            OptiJobStateEnum.OPTI_DONE,
            audit_event_type="STATE_OPTI_DONE",
            audit_message="OptiPlanning arka plan calismasi tamamlandi, XML bekleniyor",
            audit_details={"engine": WORKER_ENGINE, "log_tail": log[-300:] if log else ""},
            error_code=None,
            error_message=None,
        )
        logger.info("Job %s: OPTI_RUNNING -> OPTI_DONE", job.id)
    else:
        OrchestratorService(db).update_job_state(
            job,
            OptiJobStateEnum.FAILED,
            audit_event_type="STATE_FAILED",
            audit_message="Worker hatasi",
            audit_details={"engine": WORKER_ENGINE, "log_tail": log[-300:] if log else ""},
            error_code=JobErrorCode.OPTI_WORKER_FAILED,
            error_message=log[-500:] if log else "Bilinmeyen hata",
        )
        logger.error("Job %s: OPTI_RUNNING -> FAILED: %s", job.id, log[-200:])

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
    global _half_open_probe_in_progress, _last_run_at

    now = datetime.now(tz=timezone.utc)
    _last_run_at = now

    # Circuit breaker kontrolu
    with _lock:
        _transition_circuit_if_ready(now)
        if _circuit_state == CIRCUIT_STATE_OPEN:
            return {"status": "circuit_open", **_get_circuit_snapshot(now)}
        if _circuit_state == CIRCUIT_STATE_HALF_OPEN:
            if _half_open_probe_in_progress:
                return {"status": "circuit_half_open", **_get_circuit_snapshot(now)}
            _half_open_probe_in_progress = True

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
            _release_half_open_probe()
            return {"status": "idle"}

        # Job'i claim et (OPTI_RUNNING)
        if not _claim_job(db, job):
            _release_half_open_probe()
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
                _release_half_open_probe()
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
    global _consecutive_failures, _circuit_state, _circuit_opened_at, _half_open_probe_in_progress, _last_error
    with _lock:
        _consecutive_failures = 0
        _circuit_state = CIRCUIT_STATE_CLOSED
        _circuit_opened_at = None
        _half_open_probe_in_progress = False
        _last_error = None


def _record_failure(error_msg: str):
    global _consecutive_failures, _circuit_state, _circuit_opened_at, _half_open_probe_in_progress, _last_error
    with _lock:
        if _circuit_state == CIRCUIT_STATE_HALF_OPEN:
            _consecutive_failures = max(_consecutive_failures + 1, MAX_CONSECUTIVE_FAILURES)
        else:
            _consecutive_failures += 1
        _last_error = error_msg
        _half_open_probe_in_progress = False
        if _consecutive_failures >= MAX_CONSECUTIVE_FAILURES:
            _circuit_state = CIRCUIT_STATE_OPEN
            _circuit_opened_at = datetime.now(tz=timezone.utc)
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

    with _lock:
        _transition_circuit_if_ready()
        snapshot = _get_circuit_snapshot()

    return {
        **snapshot,
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
    global _consecutive_failures, _circuit_state, _circuit_opened_at, _half_open_probe_in_progress, _last_error
    with _lock:
        _consecutive_failures = 0
        _circuit_state = CIRCUIT_STATE_CLOSED
        _circuit_opened_at = None
        _half_open_probe_in_progress = False
        _last_error = None
    logger.info("Worker circuit breaker sifirlandi (admin)")
