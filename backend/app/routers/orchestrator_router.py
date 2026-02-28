"""
Orchestrator Job Management Router
Backend ↔ Orchestrator köprüsü: job oluşturma, listeleme, retry, approve
"""

from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from ..auth import require_permissions
from ..database import get_db
from ..exceptions import NotFoundError, ValidationError
from ..models import User
from ..models.enums import OptiJobStateEnum
from ..permissions import Permission
from ..schemas import OptiJobCreate, OptiJobListResponse, OptiJobOut
from ..services.orchestrator_service import OrchestratorService

router = APIRouter(prefix="/api/v1/orchestrator", tags=["orchestrator"])


@router.get("")
def orchestrator_root():
    """Orchestrator API kök bilgisi."""
    return {
        "message": "OptiPlan360 Orchestrator API",
        "jobs": "/api/v1/orchestrator/jobs",
    }


@router.post("/jobs", response_model=OptiJobOut, status_code=201)
def create_job(
    body: OptiJobCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permissions(Permission.ORCHESTRATOR_MANAGE)),
):
    """Yeni orchestrator job oluştur."""
    svc = OrchestratorService(db)
    parts_dicts = [p.model_dump() for p in body.parts]
    job = svc.create_job(
        order_id=body.order_id,
        customer_phone=body.customer_phone,
        parts=parts_dicts,
        opti_mode=body.opti_mode or "C",
        plate_width_mm=body.plate_width_mm,
        plate_height_mm=body.plate_height_mm,
        customer_snapshot_name=body.customer_snapshot_name,
        user_id=current_user.id,
    )
    return job


@router.get("/jobs", response_model=OptiJobListResponse)
def list_jobs(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    state: Optional[str] = Query(None),
    order_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(require_permissions(Permission.ORCHESTRATOR_VIEW)),
):
    """Job listesini getir."""
    svc = OrchestratorService(db)
    jobs, total = svc.list_jobs(limit=limit, offset=offset, state=state, order_id=order_id)
    return OptiJobListResponse(jobs=jobs, total=total)


@router.get("/jobs/{job_id}", response_model=OptiJobOut)
def get_job(
    job_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_permissions(Permission.ORCHESTRATOR_VIEW)),
):
    """Job detayını getir."""
    svc = OrchestratorService(db)
    return svc.get_job(job_id)


@router.post("/jobs/{job_id}/retry", response_model=OptiJobOut)
def retry_job(
    job_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permissions(Permission.ORCHESTRATOR_MANAGE)),
):
    """FAILED/HOLD durumundaki job'ı yeniden dene."""
    svc = OrchestratorService(db)
    return svc.retry_job(job_id, user_id=current_user.id)


@router.post("/jobs/{job_id}/approve", response_model=OptiJobOut)
def approve_job(
    job_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permissions(Permission.ORCHESTRATOR_MANAGE)),
):
    """HOLD durumundaki job'ı onayla."""
    svc = OrchestratorService(db)
    return svc.approve_job(job_id, user_id=current_user.id)


@router.post("/jobs/{job_id}/sync", response_model=OptiJobOut)
def sync_job(
    job_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_permissions(Permission.ORCHESTRATOR_VIEW)),
):
    """Orchestrator'dan güncel durumu senkronize et."""
    svc = OrchestratorService(db)
    return svc.sync_job_state(job_id)


@router.post("/jobs/{job_id}/cancel", response_model=OptiJobOut)
def cancel_job(
    job_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permissions(Permission.ORCHESTRATOR_MANAGE)),
):
    """Aktif bir job'ı iptal et (FAILED + E_CANCELLED)."""
    svc = OrchestratorService(db)
    return svc.cancel_job(job_id, user_id=current_user.id)


@router.get("/jobs/worker/status")
def worker_status(
    _: User = Depends(require_permissions(Permission.ORCHESTRATOR_MANAGE)),
):
    """OptiPlanning Worker durumunu getir (circuit breaker, kuyruk, son calisma)."""
    from ..services.optiplan_worker_service import get_worker_status

    return get_worker_status()


@router.post("/jobs/worker/reset")
def worker_reset(
    _: User = Depends(require_permissions(Permission.ORCHESTRATOR_MANAGE)),
):
    """Worker circuit breaker'i sifirla."""
    from ..services.optiplan_worker_service import reset_circuit_breaker

    reset_circuit_breaker()
    return {"message": "Circuit breaker sifirlandi"}


@router.get("/jobs/{job_id}/receipt")
def get_receipt(
    job_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_permissions(Permission.ORCHESTRATOR_VIEW)),
):
    """Job icin uretim siparis fisini getir (plaka adedi, bant, fatura)."""
    from ..services.production_receipt_service import get_production_receipt

    result = get_production_receipt(db, job_id)
    if not result:
        raise NotFoundError("Siparis fisi", job_id)
    return result


@router.post("/jobs/{job_id}/receipt")
def create_receipt(
    job_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permissions(Permission.ORCHESTRATOR_MANAGE)),
):
    """Job icin uretim siparis fisi olustur (XML parse + plaka + bant -> Invoice)."""
    from ..services.production_receipt_service import create_production_receipt

    invoice = create_production_receipt(db, job_id, user_id=current_user.id)
    if not invoice:
        raise ValidationError(
            "Siparis fisi olusturulamadi. CRMAccount eslesmesi veya XML parse sonucu eksik olabilir."
        )
    return {
        "message": "Siparis fisi olusturuldu",
        "invoice_id": invoice.id,
        "invoice_number": invoice.invoice_number,
        "total_amount": invoice.total_amount,
    }


@router.get("/jobs/{job_id}/xml")
def download_xml(
    job_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_permissions(Permission.ORCHESTRATOR_VIEW)),
):
    """XML_READY/DELIVERED/DONE durumundaki job'un XML dosyasını indir."""
    svc = OrchestratorService(db)
    job = svc.get_job(job_id)

    allowed_states = (
        OptiJobStateEnum.XML_READY,
        OptiJobStateEnum.DELIVERED,
        OptiJobStateEnum.DONE,
    )
    if job.state not in allowed_states:
        raise ValidationError(
            f"XML indirme yalnizca XML_READY/DELIVERED/DONE durumunda mumkun (mevcut: {job.state.value})"
        )

    xml_path = getattr(job, "xml_file_path", None)
    if not xml_path or not Path(xml_path).exists():
        raise NotFoundError("XML dosyasi", job_id)

    fname = Path(xml_path).name
    return FileResponse(
        xml_path,
        media_type="application/xml",
        filename=fname,
        headers={"Content-Disposition": f'attachment; filename="{fname}"'},
    )
