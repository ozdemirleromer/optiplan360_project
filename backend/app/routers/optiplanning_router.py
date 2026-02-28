"""
OptiPlan 360 - OptiPlanning Router
Frontend taleplerini OptiPlanning CSV queue akisina baglar.
"""

import logging
import uuid
from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth import require_operator
from app.database import get_db
from app.models import Order, OrderPart, User
from app.schemas import (
    MachineConfigOut,
    MachineConfigUpdate,
    OptimizationJobOut,
    OptimizationJobRunRequest,
    OptimizationParamsOut,
    OptimizationParamsUpdate,
)
from app.services.optiplan_csv_otomasyon import optiplan_csv_otomasyon, optiplan_kuyrugu_isle
from app.services.optiplanning_service import optiplanning_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/optiplanning", tags=["optiplanning"])


class OptiPlanningExportRequest(BaseModel):
    order_id: str
    format_type: str = "EXCEL"  # EXCEL, XML, OSI
    trigger_exe: bool = False


class OptiPlanningExportResponse(BaseModel):
    success: bool
    message: str
    generated_files: List[str]


@router.post("/export", response_model=OptiPlanningExportResponse)
def export_to_optiplanning(
    body: OptiPlanningExportRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_operator),
):
    """
    Eski export endpointi korunur.
    """
    try:
        files = optiplanning_service.export_order(
            db=db,
            order_id=body.order_id,
            trigger_exe=body.trigger_exe,
            format_type=body.format_type,
        )
        return OptiPlanningExportResponse(
            success=True,
            message=f"{len(files)} dosya basariyla OptiPlanning'e aktarildi.",
            generated_files=files,
        )
    except Exception as exc:
        logger.exception("OptiPlanning disa aktarma hatasi")
        return OptiPlanningExportResponse(
            success=False,
            message=f"Disa aktarim hatasi: {exc}",
            generated_files=[],
        )


@router.get("/machine/config", response_model=MachineConfigOut)
def get_machine_config(
    config_name: str = "DEFAULT",
    db: Session = Depends(get_db),
    user: User = Depends(require_operator),
):
    config = optiplanning_service.get_machine_config(db, config_name)
    if not config:
        config = optiplanning_service.update_machine_config(db, {}, config_name)
    return config


@router.put("/machine/config", response_model=MachineConfigOut)
def update_machine_config(
    body: MachineConfigUpdate,
    config_name: str = "DEFAULT",
    db: Session = Depends(get_db),
    user: User = Depends(require_operator),
):
    try:
        return optiplanning_service.update_machine_config(
            db,
            body.model_dump(exclude_unset=True),
            config_name,
        )
    except Exception as exc:
        logger.exception("Makine konfig guncelleme hatasi")
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/optimization/params", response_model=OptimizationParamsOut)
def get_optimization_params(
    config_name: str = "DEFAULT",
    db: Session = Depends(get_db),
    user: User = Depends(require_operator),
):
    config = optiplanning_service.get_machine_config(db, config_name)
    if not config or not config.advanced_params:
        return OptimizationParamsOut(id="default")
    return OptimizationParamsOut(id="default", **config.advanced_params)


@router.put("/optimization/params", response_model=OptimizationParamsOut)
def update_optimization_params(
    body: OptimizationParamsUpdate,
    config_name: str = "DEFAULT",
    db: Session = Depends(get_db),
    user: User = Depends(require_operator),
):
    config = optiplanning_service.get_machine_config(db, config_name)
    if not config:
        config = optiplanning_service.update_machine_config(db, {}, config_name)

    current_params = config.advanced_params or {}
    updated_params = {**current_params, **body.model_dump(exclude_unset=True)}
    optiplanning_service.update_machine_config(db, {"advanced_params": updated_params}, config_name)
    return OptimizationParamsOut(id="default", **updated_params)


@router.post("/optimization/run", response_model=OptimizationJobOut)
def run_advanced_optimization(
    body: OptimizationJobRunRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_operator),
):
    """
    Uretim akisi:
    1) Siparisi OPF uyumlu ASCII CSV olarak 1_GELEN_SIPARISLER'e yaz
    2) Kuyrugu FIFO (is sirasina gore) isle
    3) Basariliyi 2_ISLENEN, hataliyi 3_HATALI'ya tas
    """
    try:
        from app.models.optiplanning import OptimizationJob

        job_id = str(uuid.uuid4())
        job = OptimizationJob(
            id=job_id,
            name=f"QueueOptimization_{len(body.order_ids)}_Orders",
            status="PENDING",
            format_type="CSV",
            related_orders=[str(x) for x in body.order_ids],
            created_by=user.id,
        )
        db.add(job)
        db.commit()
        db.refresh(job)

        queued_files: list[str] = []
        validation_errors: list[str] = []

        for idx, order_id in enumerate(body.order_ids):
            order = db.query(Order).filter(Order.id == int(order_id)).first()
            if not order:
                validation_errors.append(f"Order bulunamadi: {order_id}")
                continue

            parts = (
                db.query(OrderPart)
                .filter(OrderPart.order_id == order.id)
                .order_by(OrderPart.created_at.asc(), OrderPart.id.asc())
                .all()
            )
            if not parts:
                validation_errors.append(f"Order parca listesi bos: {order_id}")
                continue

            parca_listesi: list[dict[str, object]] = []
            for part in parts:
                parca_listesi.append(
                    {
                        "malzeme": order.material_name or order.color or "18MM 210*280",
                        "boy": part.boy_mm if part.boy_mm is not None else part.boy or 0,
                        "en": part.en_mm if part.en_mm is not None else part.en or 0,
                        "adet": part.adet or 1,
                        "suyolu": part.grain_code or part.grain or "0",
                        "aciklama": part.part_desc or "",
                        "ust_bant": "1" if part.u1 else "",
                        "alt_bant": "1" if part.u2 else "",
                        "sol_bant": "1" if part.k1 else "",
                        "sag_bant": "1" if part.k2 else "",
                        "kod": part.id or "",
                        "ek_aciklama": part.drill_code_1 or "",
                    }
                )

            siparis_no = (
                f"{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S_%f')}_{idx:04d}_SIPARIS_{order.id}"
            )
            queued_path = optiplan_csv_otomasyon(
                siparis_no=siparis_no,
                parca_listesi=parca_listesi,
                tetikle_optiplan=False,
                baslik_satirlari=True,
            )
            queued_files.append(queued_path)

        if not queued_files:
            job.status = "FAILED"
            job.error_message = " ; ".join(validation_errors) if validation_errors else "Kuyruga alinacak siparis yok"
            job.completed_at = datetime.now(timezone.utc)
            db.commit()
            db.refresh(job)
            return job

        queue_results = optiplan_kuyrugu_isle()
        processed_files = [item["output"] for item in queue_results if item.get("status") == "processed"]
        failed_files = [item["output"] for item in queue_results if item.get("status") == "failed"]

        if failed_files:
            job.status = "FAILED"
        elif validation_errors:
            job.status = "COMPLETED_WITH_WARNINGS"
        else:
            job.status = "COMPLETED"

        all_outputs = processed_files + failed_files
        job.result_file_path = ",".join(all_outputs) if all_outputs else None
        if validation_errors:
            warning_text = " ; ".join(validation_errors)
            job.error_message = warning_text

        job.completed_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(job)
        return job
    except Exception as exc:
        logger.exception("Gelismis optimizasyon baslatma hatasi")
        raise HTTPException(status_code=500, detail=str(exc))
