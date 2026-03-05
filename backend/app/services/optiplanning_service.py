import logging
import os
import subprocess
from datetime import datetime, timezone
from types import SimpleNamespace
from typing import Any, List

from app.exceptions import ValidationError as AppValidationError
from app.services.export import generate_xlsx_for_job
from app.services.order_service import OrderService
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)


class OptiPlanningService:
    """
    OptiPlan 360 - Biesse OptiPlanning Integration Service
    Siparis verilerini AGENT_ONEFILE kurallarina gore Biesse formatina donusturur.
    XLSX uretimi SADECE Excel_sablon.xlsx template'i kopyalanarak yapilir (AGENT_ONEFILE §3).
    """

    def __init__(
        self,
        export_dir: str = os.environ.get("OPTIPLAN_EXPORT_DIR", r"C:\Biesse\OptiPlanning\Tmp\Sol"),
        optiplan_exe: str = os.environ.get(
            "OPTIPLAN_EXE_PATH", r"C:\Biesse\OptiPlanning\System\OptiPlanning.exe"
        ),
    ):
        self.export_dir = self._resolve_writable_export_dir(export_dir)
        self.optiplan_exe = optiplan_exe

    def _resolve_writable_export_dir(self, preferred_dir: str) -> str:
        """Yazma izni olan export klasorunu sec; gerekirse proje ici fallback kullan."""
        backend_tmp = os.path.join(
            os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
            "tmp",
            "optiplan_exports",
        )
        project_tmp = os.path.join(
            os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))),
            "tmp",
            "optiplan_exports",
        )
        candidates = [preferred_dir, backend_tmp, project_tmp]

        for candidate in candidates:
            try:
                os.makedirs(candidate, exist_ok=True)
                probe = os.path.join(candidate, ".write_test")
                with open(probe, "w", encoding="utf-8") as f:
                    f.write("ok")
                os.remove(probe)
                return candidate
            except Exception:
                continue

        raise AppValidationError(
            "E_EXPORT_DIR_UNWRITABLE: Export klasoru yazilabilir degil. "
            f"Denenen yollar: {candidates}"
        )

    def export_order(
        self, db: Session, order_id: str, trigger_exe: bool = False, format_type: str = "EXCEL"
    ) -> List[str]:
        """
        Kanonik export akisi.
        XLSX uretimi artik tamamen `generate_xlsx_for_job()` uzerinden gider.
        """
        if format_type.upper() != "EXCEL":
            raise AppValidationError("Yalnizca EXCEL export kanonik olarak desteklenir")

        order = OrderService.get_order(db, order_id, with_parts=True)
        if not order.parts:
            raise ValueError(f"Siparis ({order_id}) icin disa aktarilacak parca bulunamadi.")

        export_context = SimpleNamespace(
            id=f"order-{order.id}",
            order_id=order.id,
            order=order,
            customer_snapshot_name=order.crm_name_snapshot,
        )
        generated_files = generate_xlsx_for_job(export_context, list(order.parts), self.export_dir)

        if trigger_exe and generated_files and os.path.exists(self.optiplan_exe):
            self._trigger_optiplan(generated_files)

        return generated_files

    def _trigger_optiplan(self, file_paths: List[str]) -> None:
        """OptiPlan.exe uygulamasini belirtilen dosyalar icin tetikler."""
        try:
            for path in file_paths:
                subprocess.Popen([self.optiplan_exe, path], shell=False)
            logger.info("OptiPlan exe tetiklendi: %d dosya.", len(file_paths))
        except Exception as e:
            logger.error("OptiPlan tetiklenirken hata: %s", e)

    # --- Advanced Features: Machine Config ---
    def get_machine_config(self, db: Session, config_name: str = "DEFAULT"):
        """Belirtilen ada sahip makine konfigurasyonunu getirir."""
        from app.models.optiplanning import MachineConfig

        return db.query(MachineConfig).filter(MachineConfig.name == config_name).first()

    def update_machine_config(self, db: Session, config_data: dict, config_name: str = "DEFAULT"):
        """Makine konfigurasyonunu gunceller veya yoksa olusturur."""
        from app.models.optiplanning import MachineConfig

        config = self.get_machine_config(db, config_name)

        if not config:
            config = MachineConfig(name=config_name, **config_data)
            db.add(config)
        else:
            for key, value in config_data.items():
                if hasattr(config, key) and value is not None:
                    setattr(config, key, value)

        db.commit()
        db.refresh(config)
        return config

    def run_advanced_optimization(self, db: Session, job_id: str, request_data: Any):
        """Gelismis optimizasyon isini calistirir."""
        from app.models.optiplanning import OptimizationJob

        job = db.query(OptimizationJob).filter(OptimizationJob.id == job_id).first()
        if not job:
            raise ValueError("Optimizasyon isi bulunamadi.")

        try:
            job.status = "RUNNING"
            db.commit()

            generated_files = []
            for order_id in request_data.order_ids:
                files = self.export_order(
                    db=db, order_id=str(order_id), trigger_exe=False, format_type="EXCEL"
                )
                generated_files.extend(files)

            if generated_files and request_data.params:
                self._trigger_optiplan(generated_files)

            job.status = "COMPLETED"
            job.result_file_path = ",".join(generated_files) if generated_files else None
            job.completed_at = datetime.now(timezone.utc)
            db.commit()
            db.refresh(job)

            return job
        except Exception as e:
            job.status = "FAILED"
            job.error_message = str(e)
            job.completed_at = datetime.now(timezone.utc)
            db.commit()
            raise e


optiplanning_service = OptiPlanningService()
