"""
Orchestrator Bridge Service
Backend <-> Orchestrator (Node.js/Express) arasi HTTP proxy + DB kaydi.
Orchestrator erisilemediginde yerel isleme (job validasyonu + worker kuyruğuna alma) devreye girer.

Yerel akis:
  create_job() -> DB kayit -> Orchestrator dene -> basarisizsa process_job_locally()
  process_job_locally() -> validasyon -> OPTI_IMPORTED
  Worker (ui_automation) -> OPTI_RUNNING -> OPTI_DONE/FAILED

Env vars:
  ORCH_BASE_URL          : Orchestrator Node.js URL (varsayilan: http://localhost:3001)
  OPTIPLAN_IMPORT_DIR    : Worker'in urettigi XLSX dosyalari icin hedef klasor
"""

import hashlib
import json
import logging
import os
import subprocess
import uuid

import httpx
from sqlalchemy.orm import Session

from ..exceptions import ConflictError, NotFoundError, ValidationError
from ..models import (
    Customer,
    OptiAuditEvent,
    OptiJob,
    OptiJobStateEnum,
    OptiModeEnum,
    Order,
    OrderPart,
)

# AGENT_ONEFILE Â§THICKNESS POLICY: arkalik kalinliklari ve trim mapping
BACKING_THICKNESSES = frozenset([3, 4, 5, 8])
TRIM_BY_THICKNESS = {"18": 10.0, "3": 5.0, "4": 5.0, "5": 5.0, "8": 5.0}

OPTIPLAN_IMPORT_DIR = os.environ.get(
    "OPTIPLAN_IMPORT_DIR",
    r"C:\Biesse\OptiPlanning\ImpFile",
)
OPTIPLAN_EXE_PATH = os.environ.get(
    "OPTIPLAN_EXE_PATH", r"C:\Biesse\OptiPlanning\System\OptiPlanning.exe"
)
os.makedirs(OPTIPLAN_IMPORT_DIR, exist_ok=True)

logger = logging.getLogger(__name__)

ORCH_BASE_URL = os.environ.get("ORCH_BASE_URL", "http://localhost:3001")
ORCH_TIMEOUT = float(os.environ.get("ORCH_TIMEOUT", "15"))


def _call_orchestrator(method: str, path: str, json_body: dict | None = None) -> dict | None:
    """Orchestrator Express API'ye HTTP istegi gonderir."""
    url = f"{ORCH_BASE_URL}{path}"
    try:
        with httpx.Client(timeout=ORCH_TIMEOUT) as client:
            resp = client.request(method, url, json=json_body)
            if resp.status_code in (200, 201):
                return resp.json()
            logger.warning(
                "Orchestrator %s %s -> %d: %s", method, path, resp.status_code, resp.text[:200]
            )
            return None
    except httpx.ConnectError:
        logger.warning("Orchestrator erisilemedi: %s", url)
        return None
    except Exception as exc:
        logger.error("Orchestrator istegi basarisiz: %s %s -> %s", method, path, exc)
        return None


def _payload_hash(payload: dict) -> str:
    raw = json.dumps(payload, sort_keys=True, default=str)
    return hashlib.sha256(raw.encode()).hexdigest()[:16]


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


def _load_rules_json() -> dict:
    """config/rules.json dosyasini yukler."""
    rules_path = os.path.join(os.path.dirname(__file__), "..", "..", "..", "config", "rules.json")
    try:
        with open(rules_path, "r", encoding="utf-8") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return {}


class OrchestratorService:
    """Backend-Orchestrator koprusu."""

    def __init__(self, db: Session):
        self.db = db

    # -- Job Olustur --
    def create_job(
        self,
        order_id: int,
        customer_phone: str,
        parts: list[dict],
        opti_mode: str = "C",
        plate_width_mm: float | None = None,
        plate_height_mm: float | None = None,
        customer_snapshot_name: str | None = None,
        user_id: int | None = None,
    ) -> OptiJob:
        # Siparis var mi kontrol
        order = self.db.query(Order).filter(Order.id == order_id).first()
        if not order:
            raise NotFoundError("Siparis", order_id)

        if not parts:
            raise ValidationError("En az 1 parca gerekli")

        # Payload olustur
        payload = {
            "order_id": str(order_id),
            "customer_phone": customer_phone,
            "customer_snapshot_name": customer_snapshot_name or order.crm_name_snapshot or "",
            "opti_mode": opti_mode,
            "parts": parts,
        }

        # Plaka ebati: parametre > siparis > config default
        pw = plate_width_mm or (float(order.plate_w_mm) if order.plate_w_mm else None)
        ph = plate_height_mm or (float(order.plate_h_mm) if order.plate_h_mm else None)
        if pw and ph:
            payload["plate_size"] = {"width_mm": pw, "height_mm": ph}

        p_hash = _payload_hash(payload)

        # Idempotency: ayni hash ile bekleyen job varsa tekrar olusturma
        existing = (
            self.db.query(OptiJob)
            .filter(OptiJob.payload_hash == p_hash, OptiJob.state.notin_(["DONE", "FAILED"]))
            .first()
        )
        if existing:
            raise ConflictError(f"Bu siparis icin aktif job mevcut: {existing.id}")

        job_id = str(uuid.uuid4())

        # Backend DB'ye kaydet
        job = OptiJob(
            id=job_id,
            order_id=order_id,
            state=OptiJobStateEnum.NEW,
            opti_mode=OptiModeEnum(opti_mode) if opti_mode in ("A", "B", "C") else OptiModeEnum.C,
            payload_hash=p_hash,
            created_by=user_id,
        )
        self.db.add(job)
        _add_audit(self.db, job_id, "JOB_CREATED", f"Job olusturuldu: order={order_id}")
        self.db.commit()
        self.db.refresh(job)

        # Orchestrator'a gonder; basarisizsa yerel isleme yap
        orch_result = _call_orchestrator("POST", "/jobs", payload)
        if orch_result and "job" in orch_result:
            orch_state = orch_result["job"].get("state", "NEW")
            if orch_state != "NEW":
                job.state = OptiJobStateEnum(orch_state)
                _add_audit(self.db, job_id, "STATE_CHANGE", f"Orchestrator durumu: {orch_state}")
                self.db.commit()
        else:
            # Orchestrator yok -> yerel isleme
            logger.info("Orchestrator erisilemedi, yerel isleme baslatiliyor: job=%s", job_id)
            self._process_job_locally(job, order)

        return job

    # -- Yerel Isleme --
    def _process_job_locally(self, job: OptiJob, order: Order) -> None:
        """
        Orchestrator olmadiginda veya Optimizasyona Gonder tetiklendiginde:
        0. CRM gate: musteri eslesmesi yoksa HOLD (AGENT_ONEFILE Â§G5)
        1. Plaka ebati kontrolu (AGENT_ONEFILE Â§G6)
        2. Arkalik kalinlik + trim validasyonu (AGENT_ONEFILE Â§THICKNESS POLICY)
        3. Durumu OPTI_IMPORTED'a gecir
        4. Worker'in XLSX uretip ui_automation akisini calistirmasini bekle
        """
        try:
            # -- 0) CRM Gate (AGENT_ONEFILE Â§G5) --
            customer = None
            if order.customer_id:
                customer = self.db.query(Customer).filter(Customer.id == order.customer_id).first()
            if not customer:
                phone = order.phone_norm or ""
                if phone:
                    customer = self.db.query(Customer).filter(Customer.phone == phone).first()
            if not customer:
                job.state = OptiJobStateEnum.HOLD
                job.error_code = "E_CRM_NO_MATCH"
                job.error_message = "CRM musteri eslesmesi bulunamadi. Musteri kaydi olusturulmali."
                _add_audit(self.db, job.id, "STATE_HOLD", "CRM gate: musteri bulunamadi - HOLD")
                self.db.commit()
                return

            # -- 1) Plaka ebati kontrolu (AGENT_ONEFILE Â§G6) --
            has_plate = bool(order.plate_w_mm and order.plate_h_mm)
            if not has_plate:
                rules = _load_rules_json()
                default_plate = rules.get("defaultPlateSize", {})
                if default_plate.get("width_mm") and default_plate.get("height_mm"):
                    has_plate = True
            if not has_plate:
                job.state = OptiJobStateEnum.HOLD
                job.error_code = "E_PLATE_SIZE_MISSING"
                job.error_message = (
                    "Plaka ebati belirtilmemis ve varsayilan yapilandirma bulunamadi."
                )
                _add_audit(self.db, job.id, "STATE_HOLD", "Plaka ebati eksik - HOLD")
                self.db.commit()
                return

            # Parcalari yukle
            parts = self.db.query(OrderPart).filter(OrderPart.order_id == order.id).all()
            if not parts:
                job.state = OptiJobStateEnum.HOLD
                job.error_code = "E_NO_PARTS"
                job.error_message = "Sipariste parca bulunamadi"
                _add_audit(self.db, job.id, "STATE_HOLD", "Parca yok - HOLD")
                self.db.commit()
                return

            # -- 2) Arkalik kalinlik + trim validasyonu (AGENT_ONEFILE Â§THICKNESS) --
            for part in parts:
                part_group = (getattr(part, "part_group", "") or "").upper()
                thickness = float(order.thickness_mm or 18) if part_group == "GOVDE" else 8
                thickness_key = str(int(thickness))

                if part_group == "ARKALIK" and int(thickness) not in BACKING_THICKNESSES:
                    job.state = OptiJobStateEnum.HOLD
                    job.error_code = "E_BACKING_THICKNESS_UNKNOWN"
                    job.error_message = f"Bilinmeyen arkalik kalinligi: {thickness}mm (gecerli: {sorted(BACKING_THICKNESSES)})"
                    _add_audit(
                        self.db,
                        job.id,
                        "STATE_HOLD",
                        f"Arkalik kalinlik hatasi: {thickness}mm - HOLD",
                    )
                    self.db.commit()
                    return

                if thickness_key not in TRIM_BY_THICKNESS:
                    job.state = OptiJobStateEnum.HOLD
                    job.error_code = "E_TRIM_RULE_MISSING"
                    job.error_message = f"Trim kurali bulunamadi: {thickness_key}mm"
                    _add_audit(
                        self.db,
                        job.id,
                        "STATE_HOLD",
                        f"Trim kurali eksik: {thickness_key}mm - HOLD",
                    )
                    self.db.commit()
                    return
            # Worker service OPTI_IMPORTED -> OPTI_RUNNING gecisini yapar
            job.state = OptiJobStateEnum.OPTI_IMPORTED
            _add_audit(
                self.db,
                job.id,
                "STATE_OPTI_IMPORTED",
                "UI otomasyon worker kuyruguna alindi (XLSX worker tarafinda olusturulacak)",
                {"engine": "ui_automation"},
            )
            self.db.commit()
            logger.info("Job %s: NEW -> %s (ui_automation queue)", job.id, job.state.value)

        except Exception as exc:
            logger.error("Yerel isleme hatasi (job=%s): %s", job.id, exc, exc_info=True)
            job.state = OptiJobStateEnum.FAILED
            job.error_code = "E_LOCAL_PROCESSING"
            job.error_message = str(exc)[:500]
            _add_audit(self.db, job.id, "STATE_FAILED", f"Yerel isleme hatasi: {exc}")
            self.db.commit()

    def _trigger_optiplan_exe(self, job: OptiJob, xlsx_files: list[str]) -> None:
        """Mode A: OptiPlanning.exe'yi CLI uzerinden tetikle."""
        try:
            cmd = [OPTIPLAN_EXE_PATH] + xlsx_files
            proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            job.state = OptiJobStateEnum.OPTI_RUNNING
            _add_audit(
                self.db,
                job.id,
                "STATE_OPTI_RUNNING",
                f"OptiPlanning.exe baslatildi (PID={proc.pid})",
                {"exe": OPTIPLAN_EXE_PATH, "files": [os.path.basename(p) for p in xlsx_files]},
            )
            self.db.commit()
            logger.info("Job %s: OPTI_IMPORTED -> OPTI_RUNNING (PID=%d)", job.id, proc.pid)
        except FileNotFoundError:
            logger.warning(
                "OptiPlanning.exe bulunamadi: %s (Mode C'ye geciliyor)", OPTIPLAN_EXE_PATH
            )
            _add_audit(
                self.db, job.id, "INFO", "OptiPlanning.exe bulunamadi - operator el ile baslatmali"
            )
            self.db.commit()
        except Exception as exc:
            logger.error("OptiPlanning.exe tetikleme hatasi: %s", exc)
            _add_audit(self.db, job.id, "WARNING", f"OptiPlanning.exe baslatilamadi: {exc}")
            self.db.commit()

    # -- Job Detay --
    def get_job(self, job_id: str) -> OptiJob:
        job = self.db.query(OptiJob).filter(OptiJob.id == job_id).first()
        if not job:
            raise NotFoundError("Job", job_id)
        return job

    # -- Job Listesi --
    def list_jobs(
        self,
        limit: int = 50,
        offset: int = 0,
        state: str | None = None,
        order_id: int | None = None,
    ) -> tuple[list[OptiJob], int]:
        q = self.db.query(OptiJob)
        if state:
            q = q.filter(OptiJob.state == state)
        if order_id:
            q = q.filter(OptiJob.order_id == order_id)
        total = q.count()
        jobs = q.order_by(OptiJob.created_at.desc()).offset(offset).limit(limit).all()
        return jobs, total

    # -- Retry --
    # STATE_MACHINE.md: max 3 retry, kalici hata kodlarinda retry yasak
    RETRY_COUNT_MAX = 3
    PERMANENT_ERROR_CODES = frozenset(
        [
            "E_TEMPLATE_INVALID",
            "E_CRM_NO_MATCH",
            "E_PLATE_SIZE_MISSING",
            "E_XML_INVALID",
        ]
    )

    def retry_job(self, job_id: str, user_id: int | None = None) -> OptiJob:
        job = self.get_job(job_id)
        if job.state not in (OptiJobStateEnum.FAILED, OptiJobStateEnum.HOLD):
            raise ValidationError(
                f"Sadece FAILED/HOLD durumundaki job'lar retry edilebilir (mevcut: {job.state.value})"
            )

        if job.retry_count >= self.RETRY_COUNT_MAX:
            raise ValidationError(
                f"Maksimum retry sayisina ulasildi ({self.RETRY_COUNT_MAX}). Job manuel incelenmeli."
            )
        if job.error_code in self.PERMANENT_ERROR_CODES:
            raise ValidationError(f"Kalici hata nedeniyle retry engellendi: {job.error_code}")

        # Orchestrator'a retry gonder
        _call_orchestrator("POST", f"/jobs/{job_id}/retry")

        job.retry_count += 1
        job.state = OptiJobStateEnum.NEW
        job.error_code = None
        job.error_message = None
        _add_audit(self.db, job_id, "RETRY", f"Retry #{job.retry_count}", {"triggered_by": user_id})
        self.db.commit()
        self.db.refresh(job)
        return job

    # -- Approve (HOLD -> devam) --
    def approve_job(self, job_id: str, user_id: int | None = None) -> OptiJob:
        job = self.get_job(job_id)
        if job.state != OptiJobStateEnum.HOLD:
            raise ValidationError(
                f"Sadece HOLD durumundaki job approve edilebilir (mevcut: {job.state.value})"
            )

        # Orchestrator'a approve gonder
        _call_orchestrator("POST", f"/jobs/{job_id}/approve")

        # STATE_MACHINE.md: HOLD -> NEW
        job.state = OptiJobStateEnum.NEW
        job.error_code = None
        job.error_message = None
        _add_audit(
            self.db,
            job_id,
            "APPROVE",
            "HOLD'dan cikarildi - NEW'e alindi",
            {"approved_by": user_id},
        )
        self.db.commit()
        self.db.refresh(job)
        return job

    # -- Iptal (aktif -> FAILED) --
    def cancel_job(self, job_id: str, user_id: int | None = None) -> OptiJob:
        job = self.get_job(job_id)
        terminal_states = (OptiJobStateEnum.DONE, OptiJobStateEnum.FAILED)
        if job.state in terminal_states:
            raise ValidationError(
                f"Zaten tamamlanmis/basarisiz job iptal edilemez (mevcut: {job.state.value})"
            )

        # Orchestrator'a iptal bildir
        _call_orchestrator("POST", f"/jobs/{job_id}/cancel")

        job.state = OptiJobStateEnum.FAILED
        job.error_code = "E_CANCELLED"
        job.error_message = "Kullanici tarafindan iptal edildi"
        _add_audit(self.db, job_id, "CANCEL", "Job iptal edildi", {"cancelled_by": user_id})
        self.db.commit()
        self.db.refresh(job)
        return job

    # -- Durum Senkronizasyonu (opsiyonel) --
    def sync_job_state(self, job_id: str) -> OptiJob:
        """Orchestrator'dan guncel durumu ceker ve backend DB'yi gunceller."""
        job = self.get_job(job_id)
        orch_data = _call_orchestrator("GET", f"/jobs/{job_id}")
        if orch_data and "state" in orch_data:
            new_state = orch_data["state"]
            if new_state != job.state.value:
                old = job.state.value
                job.state = OptiJobStateEnum(new_state)
                job.error_code = orch_data.get("error_code")
                job.error_message = orch_data.get("error_message")
                _add_audit(self.db, job_id, "STATE_SYNC", f"{old} -> {new_state}")
                self.db.commit()
                self.db.refresh(job)
        return job
