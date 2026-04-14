import json
from datetime import UTC, datetime, timedelta
from uuid import uuid4

from app.exceptions import BusinessRuleError, NotFoundError
from app.models import SystemBackboneFlow, SystemBackboneFlowAudit
from app.models.optiplan_workflow import OptiPlanWorkflowKayit
from app.services.optiplan_workflow_service import optiplan_workflow_service
from sqlalchemy.orm import Session


ALLOWED_STATUSES = {"PENDING", "IN_PROGRESS", "COMPLETED", "FAILED", "RETRYING"}
ALLOWED_STAGES = {"foundation", "stabilization", "completed"}

CORE_MODULE_SEQUENCE = (
    {
        "module": "mikro-entegrasyon",
        "flow_name": "core-mikro-entegrasyon",
        "entity_type": "integration",
        "entity_id": "mikro-transfer-core",
    },
    {
        "module": "stok-karti",
        "flow_name": "core-stok-karti",
        "entity_type": "stock-card",
        "entity_id": "stok-core",
    },
    {
        "module": "cari-karti",
        "flow_name": "core-cari-karti",
        "entity_type": "customer-card",
        "entity_id": "cari-core",
    },
    {
        "module": "siparis-fisi",
        "flow_name": "core-siparis-fisi",
        "entity_type": "order-slip",
        "entity_id": "siparis-core",
    },
    {
        "module": "teklif-fisi",
        "flow_name": "core-teklif-fisi",
        "entity_type": "quote-slip",
        "entity_id": "teklif-core",
    },
)


class SystemBackboneService:
    @staticmethod
    def _workflow_record_count(db: Session) -> int:
        return db.query(OptiPlanWorkflowKayit).count()

    @staticmethod
    def _workflow_phase_counts(db: Session) -> dict:
        rows = db.query(OptiPlanWorkflowKayit.aktif_faz).all()
        counts = {"phase_1": 0, "phase_2": 0, "phase_3": 0, "phase_4": 0, "unknown": 0}
        for (aktif_faz,) in rows:
            if aktif_faz == 1:
                counts["phase_1"] += 1
            elif aktif_faz == 2:
                counts["phase_2"] += 1
            elif aktif_faz == 3:
                counts["phase_3"] += 1
            elif aktif_faz == 4:
                counts["phase_4"] += 1
            else:
                counts["unknown"] += 1
        return counts

    @staticmethod
    def _workflow_status_counts(db: Session) -> dict:
        rows = db.query(OptiPlanWorkflowKayit.dosya_durumu).all()
        summary: dict[str, int] = {}
        for (durum,) in rows:
            key = str(durum or "BOS")
            summary[key] = summary.get(key, 0) + 1
        return summary

    @staticmethod
    def _last_package_run_info(
        db: Session,
        *,
        company_id: int,
        branch_id: int,
        fiscal_year: int,
    ) -> dict | None:
        flows = SystemBackboneService._list_core_flows(
            db,
            company_id=company_id,
            branch_id=branch_id,
            fiscal_year=fiscal_year,
        )
        if not flows:
            return None

        flow_ids = [flow.id for flow in flows]
        if not flow_ids:
            return None

        audits = (
            db.query(SystemBackboneFlowAudit)
            .filter(SystemBackboneFlowAudit.flow_id.in_(flow_ids))
            .order_by(SystemBackboneFlowAudit.created_at.desc(), SystemBackboneFlowAudit.id.desc())
            .all()
        )
        if not audits:
            return None

        foundation_events = {"FLOW_CREATED", "FLOW_REUSED"}
        stabilization_events = {"FLOW_HARDENING_APPLIED"}

        for audit in audits:
            event_type = str(audit.event_type or "")
            if event_type in stabilization_events:
                return {
                    "package": "stabilization",
                    "event_type": event_type,
                    "at": audit.created_at.isoformat() if audit.created_at else None,
                    "user_id": audit.created_by,
                    "company_id": company_id,
                    "branch_id": branch_id,
                    "fiscal_year": fiscal_year,
                }
            if event_type in foundation_events:
                return {
                    "package": "foundation",
                    "event_type": event_type,
                    "at": audit.created_at.isoformat() if audit.created_at else None,
                    "user_id": audit.created_by,
                    "company_id": company_id,
                    "branch_id": branch_id,
                    "fiscal_year": fiscal_year,
                }
        return None

    @staticmethod
    def _core_external_id(module: str, company_id: int, branch_id: int, fiscal_year: int) -> str:
        return f"core:{module}:{company_id}:{branch_id}:{fiscal_year}".lower()

    @staticmethod
    def _list_core_flows(
        db: Session,
        *,
        company_id: int,
        branch_id: int,
        fiscal_year: int,
    ) -> list[SystemBackboneFlow]:
        return (
            db.query(SystemBackboneFlow)
            .filter(SystemBackboneFlow.company_id == company_id)
            .filter(SystemBackboneFlow.branch_id == branch_id)
            .filter(SystemBackboneFlow.fiscal_year == fiscal_year)
            .filter(SystemBackboneFlow.external_id.like("core:%"))
            .order_by(SystemBackboneFlow.created_at.asc())
            .all()
        )

    @staticmethod
    def get_phase_todo(
        db: Session,
        *,
        phase: str,
        company_id: int,
        branch_id: int,
        fiscal_year: int,
    ) -> list[dict]:
        normalized = phase.strip().lower()
        if normalized not in {"core", "hardening"}:
            raise BusinessRuleError("Geçersiz phase değeri")

        flows = SystemBackboneService._list_core_flows(
            db,
            company_id=company_id,
            branch_id=branch_id,
            fiscal_year=fiscal_year,
        )
        flow_count = len(flows)
        core_ready = flow_count >= len(CORE_MODULE_SEQUENCE)
        hardened_count = sum(
            1
            for flow in flows
            if flow.max_retries >= 5 and flow.retry_cooldown_seconds >= 60 and flow.stage in {"stabilization", "completed"}
        )
        hardening_ready = core_ready and hardened_count >= len(CORE_MODULE_SEQUENCE)

        if normalized == "core":
            status = "done" if core_ready else "pending"
            return [
                {
                    "order": 1,
                    "title": "Klasör yapısı ve modül omurgası",
                    "status": status,
                    "detail": "Mikro-entegrasyon, stok, cari, sipariş ve teklif akış omurgası",
                },
                {
                    "order": 2,
                    "title": "Veri modeli bağlamı",
                    "status": status,
                    "detail": "company_id, branch_id, fiscal_year ve external_id bağlamı",
                },
                {
                    "order": 3,
                    "title": "Ana servis ve API akışı",
                    "status": status,
                    "detail": "Core bootstrap servis uçları ve temel entegrasyon akışı",
                },
                {
                    "order": 4,
                    "title": "Ana ekran erişimi",
                    "status": status,
                    "detail": "System Backbone ekranından core fazını tetikleme",
                },
            ]

        return [
            {
                "order": 1,
                "title": "Test kapsamı",
                "status": "done" if hardening_ready else "pending",
                "detail": "Core ve hardening endpoint/servis doğrulama testleri",
            },
            {
                "order": 2,
                "title": "Hata yönetimi",
                "status": "done" if hardening_ready else "pending",
                "detail": "AppError şemasında tutarlı hata geri dönüşleri",
            },
            {
                "order": 3,
                "title": "Retry politikası",
                "status": "done" if hardening_ready else "pending",
                "detail": "max_retries ve retry_cooldown_seconds sertleştirmesi",
            },
            {
                "order": 4,
                "title": "Audit kayıtları",
                "status": "done" if hardening_ready else "pending",
                "detail": "Hardening olayları için FLOW_HARDENING_APPLIED audit izi",
            },
            {
                "order": 5,
                "title": "Kalan bağımlılıklar",
                "status": "done" if hardening_ready else "pending",
                "detail": "Faz geçişleri için servis/UI sözleşmesinin tamamlanması",
            },
        ]

    @staticmethod
    def get_roadmap(
        db: Session,
        *,
        company_id: int,
        branch_id: int,
        fiscal_year: int,
    ) -> dict:
        foundation_todos = SystemBackboneService.get_phase_todo(
            db,
            phase="core",
            company_id=company_id,
            branch_id=branch_id,
            fiscal_year=fiscal_year,
        )
        stabilization_todos = SystemBackboneService.get_phase_todo(
            db,
            phase="hardening",
            company_id=company_id,
            branch_id=branch_id,
            fiscal_year=fiscal_year,
        )

        foundation_completed = [
            f"{item['order']}. {item['title']}"
            for item in foundation_todos
            if str(item.get("status", "")).lower() == "done"
        ]
        foundation_missing = [
            f"{item['order']}. {item['title']} - {item['detail']}"
            for item in foundation_todos
            if str(item.get("status", "")).lower() != "done"
        ]

        stabilization_completed = [
            f"{item['order']}. {item['title']}"
            for item in stabilization_todos
            if str(item.get("status", "")).lower() == "done"
        ]
        stabilization_missing = [
            f"{item['order']}. {item['title']} - {item['detail']}"
            for item in stabilization_todos
            if str(item.get("status", "")).lower() != "done"
        ]

        return {
            "company_id": company_id,
            "branch_id": branch_id,
            "fiscal_year": fiscal_year,
            "tamamlanan_ana_yapi": foundation_completed,
            "ana_yapi_eksikleri": foundation_missing,
            "tamamlanan_sertlestirme_test": stabilization_completed,
            "sertlestirme_test_eksikleri": stabilization_missing,
        }

    @staticmethod
    def run_foundation_package(
        db: Session,
        *,
        company_id: int,
        branch_id: int,
        fiscal_year: int,
        source_system: str,
        target_system: str,
        created_by: int | None = None,
    ) -> dict:
        bootstrap = SystemBackboneService.bootstrap_core_structure(
            db,
            company_id=company_id,
            branch_id=branch_id,
            fiscal_year=fiscal_year,
            source_system=source_system,
            target_system=target_system,
            created_by=created_by,
        )
        folder_settings = optiplan_workflow_service.get_folder_settings(db)
        watcher_enabled = bool(getattr(folder_settings, "watcher_aktif_mi", False))
        scanned_records = optiplan_workflow_service.scan_watch_folders(db) if watcher_enabled else []
        warnings: list[str] = []
        if not watcher_enabled:
            warnings.append("WATCHER_DISABLED: Foundation paketinde scan adımı atlandı")

        core_flows = SystemBackboneService._list_core_flows(
            db,
            company_id=company_id,
            branch_id=branch_id,
            fiscal_year=fiscal_year,
        )
        roadmap = SystemBackboneService.get_roadmap(
            db,
            company_id=company_id,
            branch_id=branch_id,
            fiscal_year=fiscal_year,
        )
        return {
            "package": "foundation",
            "generated_at": datetime.now(UTC).isoformat(),
            "watcher_enabled": watcher_enabled,
            "warnings": warnings,
            "flow_count": len(core_flows),
            "workflow_record_count": SystemBackboneService._workflow_record_count(db),
            "core_bootstrap": bootstrap,
            "workflow_scan": {
                "mode": "WATCHER_SCAN" if watcher_enabled else "WATCHER_DISABLED",
                "ingested_count": len(scanned_records),
                "records": scanned_records,
            },
            "phase_counts": SystemBackboneService._workflow_phase_counts(db),
            "status_counts": SystemBackboneService._workflow_status_counts(db),
            "last_package_run": SystemBackboneService._last_package_run_info(
                db,
                company_id=company_id,
                branch_id=branch_id,
                fiscal_year=fiscal_year,
            ),
            "roadmap": roadmap,
        }

    @staticmethod
    def run_stabilization_package(
        db: Session,
        *,
        company_id: int,
        branch_id: int,
        fiscal_year: int,
        updated_by: int | None = None,
    ) -> dict:
        hardening = SystemBackboneService.apply_hardening(
            db,
            company_id=company_id,
            branch_id=branch_id,
            fiscal_year=fiscal_year,
            updated_by=updated_by,
        )
        roadmap = SystemBackboneService.get_roadmap(
            db,
            company_id=company_id,
            branch_id=branch_id,
            fiscal_year=fiscal_year,
        )
        folder_settings = optiplan_workflow_service.get_folder_settings(db)
        watcher_enabled = bool(getattr(folder_settings, "watcher_aktif_mi", False))
        core_flows = SystemBackboneService._list_core_flows(
            db,
            company_id=company_id,
            branch_id=branch_id,
            fiscal_year=fiscal_year,
        )

        return {
            "package": "stabilization",
            "generated_at": datetime.now(UTC).isoformat(),
            "watcher_enabled": watcher_enabled,
            "warnings": [],
            "flow_count": len(core_flows),
            "workflow_record_count": SystemBackboneService._workflow_record_count(db),
            "hardening": hardening,
            "phase_counts": SystemBackboneService._workflow_phase_counts(db),
            "status_counts": SystemBackboneService._workflow_status_counts(db),
            "last_package_run": SystemBackboneService._last_package_run_info(
                db,
                company_id=company_id,
                branch_id=branch_id,
                fiscal_year=fiscal_year,
            ),
            "roadmap": roadmap,
        }

    @staticmethod
    def run_chain_package(
        db: Session,
        *,
        company_id: int,
        branch_id: int,
        fiscal_year: int,
        source_system: str,
        target_system: str,
        actor_user_id: int | None = None,
    ) -> dict:
        chain_id = str(uuid4())

        foundation_started_at = datetime.now(UTC)
        foundation = SystemBackboneService.run_foundation_package(
            db,
            company_id=company_id,
            branch_id=branch_id,
            fiscal_year=fiscal_year,
            source_system=source_system,
            target_system=target_system,
            created_by=actor_user_id,
        )
        foundation_finished_at = datetime.now(UTC)

        stabilization_started_at = datetime.now(UTC)
        stabilization = SystemBackboneService.run_stabilization_package(
            db,
            company_id=company_id,
            branch_id=branch_id,
            fiscal_year=fiscal_year,
            updated_by=actor_user_id,
        )
        stabilization_finished_at = datetime.now(UTC)

        warnings = list(foundation.get("warnings", [])) + list(stabilization.get("warnings", []))
        chain_steps = [
            {
                "step": "foundation",
                "generated_at": foundation.get("generated_at"),
                "flow_count": foundation.get("flow_count", 0),
                "duration_ms": int((foundation_finished_at - foundation_started_at).total_seconds() * 1000),
            },
            {
                "step": "stabilization",
                "generated_at": stabilization.get("generated_at"),
                "flow_count": stabilization.get("flow_count", 0),
                "duration_ms": int((stabilization_finished_at - stabilization_started_at).total_seconds() * 1000),
            },
        ]
        total_duration_ms = sum(int(step["duration_ms"]) for step in chain_steps)

        flows = SystemBackboneService._list_core_flows(
            db,
            company_id=company_id,
            branch_id=branch_id,
            fiscal_year=fiscal_year,
        )
        for flow in flows:
            SystemBackboneService._add_audit(
                db,
                flow_id=flow.id,
                event_type="CHAIN_RUN_COMPLETED",
                message="Foundation+Stabilization chain paketi tamamlandı",
                payload={
                    "chain_id": chain_id,
                    "total_duration_ms": total_duration_ms,
                },
                created_by=actor_user_id,
            )
        db.commit()

        return {
            "package": "chain",
            "chain_id": chain_id,
            "generated_at": stabilization.get("generated_at") or datetime.now(UTC).isoformat(),
            "watcher_enabled": bool(stabilization.get("watcher_enabled", False)),
            "warnings": warnings,
            "flow_count": int(stabilization.get("flow_count", 0)),
            "workflow_record_count": int(stabilization.get("workflow_record_count", 0)),
            "total_duration_ms": total_duration_ms,
            "failed_step": None,
            "phase_counts": stabilization.get("phase_counts", {}),
            "status_counts": stabilization.get("status_counts", {}),
            "last_package_run": stabilization.get("last_package_run"),
            "roadmap": stabilization.get("roadmap", {}),
            "core_bootstrap": foundation.get("core_bootstrap"),
            "workflow_scan": foundation.get("workflow_scan"),
            "hardening": stabilization.get("hardening"),
            "chain_steps": chain_steps,
        }

    @staticmethod
    def get_package_status(
        db: Session,
        *,
        company_id: int,
        branch_id: int,
        fiscal_year: int,
    ) -> dict:
        roadmap = SystemBackboneService.get_roadmap(
            db,
            company_id=company_id,
            branch_id=branch_id,
            fiscal_year=fiscal_year,
        )
        folder_settings = optiplan_workflow_service.get_folder_settings(db)
        watcher_enabled = bool(getattr(folder_settings, "watcher_aktif_mi", False))
        core_flows = SystemBackboneService._list_core_flows(
            db,
            company_id=company_id,
            branch_id=branch_id,
            fiscal_year=fiscal_year,
        )

        return {
            "company_id": company_id,
            "branch_id": branch_id,
            "fiscal_year": fiscal_year,
            "generated_at": datetime.now(UTC).isoformat(),
            "watcher_enabled": watcher_enabled,
            "flow_count": len(core_flows),
            "workflow_record_count": SystemBackboneService._workflow_record_count(db),
            "phase_counts": SystemBackboneService._workflow_phase_counts(db),
            "status_counts": SystemBackboneService._workflow_status_counts(db),
            "last_package_run": SystemBackboneService._last_package_run_info(
                db,
                company_id=company_id,
                branch_id=branch_id,
                fiscal_year=fiscal_year,
            ),
            "roadmap": roadmap,
        }

    @staticmethod
    def _add_audit(
        db: Session,
        *,
        flow_id: str,
        event_type: str,
        message: str,
        payload: dict | None = None,
        created_by: int | None = None,
    ) -> None:
        audit = SystemBackboneFlowAudit(
            flow_id=flow_id,
            event_type=event_type,
            message=message,
            payload_json=json.dumps(payload or {}, ensure_ascii=False),
            created_by=created_by,
        )
        db.add(audit)

    @staticmethod
    def create_flow(
        db: Session,
        *,
        flow_name: str,
        entity_type: str,
        entity_id: str,
        external_id: str | None,
        company_id: int,
        branch_id: int,
        fiscal_year: int,
        source_system: str,
        target_system: str,
        stage: str = "foundation",
        metadata: dict | None = None,
        created_by: int | None = None,
    ) -> SystemBackboneFlow:
        if stage not in ALLOWED_STAGES:
            raise BusinessRuleError("Geçersiz stage değeri")

        if company_id <= 0:
            raise BusinessRuleError("company_id pozitif olmalıdır")
        if branch_id < 0:
            raise BusinessRuleError("branch_id negatif olamaz")
        if fiscal_year < 2000:
            raise BusinessRuleError("fiscal_year geçersiz")

        if external_id:
            existing = (
                db.query(SystemBackboneFlow)
                .filter(SystemBackboneFlow.external_id == external_id)
                .filter(SystemBackboneFlow.company_id == company_id)
                .filter(SystemBackboneFlow.branch_id == branch_id)
                .filter(SystemBackboneFlow.fiscal_year == fiscal_year)
                .first()
            )
            if existing:
                SystemBackboneService._add_audit(
                    db,
                    flow_id=existing.id,
                    event_type="FLOW_REUSED",
                    message="Idempotent create: mevcut flow döndürüldü",
                    payload={"external_id": external_id},
                    created_by=created_by,
                )
                db.commit()
                db.refresh(existing)
                return existing

        flow = SystemBackboneFlow(
            id=str(uuid4()),
            flow_name=flow_name,
            entity_type=entity_type,
            entity_id=entity_id,
            external_id=external_id,
            company_id=company_id,
            branch_id=branch_id,
            fiscal_year=fiscal_year,
            source_system=source_system,
            target_system=target_system,
            stage=stage,
            status="PENDING",
            metadata_json=json.dumps(metadata or {}, ensure_ascii=False),
            created_by=created_by,
            updated_by=created_by,
        )
        db.add(flow)
        SystemBackboneService._add_audit(
            db,
            flow_id=flow.id,
            event_type="FLOW_CREATED",
            message="Backbone flow oluşturuldu",
            payload={
                "stage": stage,
                "status": "PENDING",
                "source_system": source_system,
                "target_system": target_system,
                "external_id": external_id,
                "company_id": company_id,
                "branch_id": branch_id,
                "fiscal_year": fiscal_year,
            },
            created_by=created_by,
        )
        db.commit()
        db.refresh(flow)
        return flow

    @staticmethod
    def list_flows(
        db: Session,
        *,
        limit: int = 50,
        offset: int = 0,
        status: str | None = None,
        stage: str | None = None,
        company_id: int | None = None,
        branch_id: int | None = None,
        fiscal_year: int | None = None,
    ) -> tuple[list[SystemBackboneFlow], int]:
        query = db.query(SystemBackboneFlow)

        if status:
            if status not in ALLOWED_STATUSES:
                raise BusinessRuleError("Geçersiz status filtresi")
            query = query.filter(SystemBackboneFlow.status == status)

        if stage:
            if stage not in ALLOWED_STAGES:
                raise BusinessRuleError("Geçersiz stage filtresi")
            query = query.filter(SystemBackboneFlow.stage == stage)

        if company_id is not None:
            query = query.filter(SystemBackboneFlow.company_id == company_id)
        if branch_id is not None:
            query = query.filter(SystemBackboneFlow.branch_id == branch_id)
        if fiscal_year is not None:
            query = query.filter(SystemBackboneFlow.fiscal_year == fiscal_year)

        total = query.count()
        rows = (
            query.order_by(SystemBackboneFlow.created_at.desc())
            .offset(offset)
            .limit(limit)
            .all()
        )
        return rows, total

    @staticmethod
    def get_overview(
        db: Session,
        *,
        company_id: int | None = None,
        branch_id: int | None = None,
        fiscal_year: int | None = None,
    ) -> dict:
        query = db.query(SystemBackboneFlow)
        if company_id is not None:
            query = query.filter(SystemBackboneFlow.company_id == company_id)
        if branch_id is not None:
            query = query.filter(SystemBackboneFlow.branch_id == branch_id)
        if fiscal_year is not None:
            query = query.filter(SystemBackboneFlow.fiscal_year == fiscal_year)

        flows = query.all()
        counts_by_status = {
            "PENDING": 0,
            "IN_PROGRESS": 0,
            "COMPLETED": 0,
            "FAILED": 0,
            "RETRYING": 0,
        }
        counts_by_stage = {
            "foundation": 0,
            "stabilization": 0,
            "completed": 0,
        }

        for flow in flows:
            if flow.status in counts_by_status:
                counts_by_status[flow.status] += 1
            if flow.stage in counts_by_stage:
                counts_by_stage[flow.stage] += 1

        return {
            "generated_at": datetime.now(UTC).isoformat(),
            "total_flows": len(flows),
            "status_summary": counts_by_status,
            "stage_summary": counts_by_stage,
        }

    @staticmethod
    def advance_flow(
        db: Session,
        *,
        flow_id: str,
        next_stage: str,
        next_status: str,
        note: str,
        updated_by: int | None = None,
        retry_increment: bool = False,
        error_message: str | None = None,
    ) -> SystemBackboneFlow:
        flow = db.query(SystemBackboneFlow).filter(SystemBackboneFlow.id == flow_id).first()
        if not flow:
            raise NotFoundError("SystemBackboneFlow", flow_id)

        if next_stage not in ALLOWED_STAGES:
            raise BusinessRuleError("Geçersiz next_stage")
        if next_status not in ALLOWED_STATUSES:
            raise BusinessRuleError("Geçersiz next_status")

        if retry_increment:
            now = datetime.now(UTC)
            next_retry_at = flow.next_retry_at
            if next_retry_at and next_retry_at.tzinfo is None:
                next_retry_at = next_retry_at.replace(tzinfo=UTC)

            if next_retry_at and next_retry_at > now:
                raise BusinessRuleError("Retry cooldown aktif")

            flow.retry_count += 1
            if flow.retry_count > flow.max_retries:
                raise BusinessRuleError("Retry limiti aşıldı")

            flow.last_retry_at = now
            if flow.retry_cooldown_seconds > 0:
                flow.next_retry_at = now + timedelta(seconds=flow.retry_cooldown_seconds)
            else:
                flow.next_retry_at = None

        flow.stage = next_stage
        flow.status = next_status
        flow.updated_by = updated_by
        flow.last_error = error_message

        SystemBackboneService._add_audit(
            db,
            flow_id=flow.id,
            event_type="FLOW_ADVANCED",
            message=note,
            payload={
                "next_stage": next_stage,
                "next_status": next_status,
                "retry_count": flow.retry_count,
                "next_retry_at": flow.next_retry_at.isoformat() if flow.next_retry_at else None,
                "error_message": error_message,
            },
            created_by=updated_by,
        )

        db.commit()
        db.refresh(flow)
        return flow

    @staticmethod
    def list_audits(
        db: Session,
        *,
        flow_id: str,
        limit: int = 100,
    ) -> list[SystemBackboneFlowAudit]:
        flow = db.query(SystemBackboneFlow).filter(SystemBackboneFlow.id == flow_id).first()
        if not flow:
            raise NotFoundError("SystemBackboneFlow", flow_id)

        return (
            db.query(SystemBackboneFlowAudit)
            .filter(SystemBackboneFlowAudit.flow_id == flow_id)
            .order_by(SystemBackboneFlowAudit.created_at.desc(), SystemBackboneFlowAudit.id.desc())
            .limit(limit)
            .all()
        )

    @staticmethod
    def bootstrap_core_structure(
        db: Session,
        *,
        company_id: int,
        branch_id: int,
        fiscal_year: int,
        source_system: str,
        target_system: str,
        created_by: int | None = None,
    ) -> dict:
        created = 0
        reused = 0
        flow_ids: list[str] = []

        for idx, item in enumerate(CORE_MODULE_SEQUENCE, start=1):
            external_id = SystemBackboneService._core_external_id(
                item["module"],
                company_id,
                branch_id,
                fiscal_year,
            )
            exists = (
                db.query(SystemBackboneFlow)
                .filter(SystemBackboneFlow.external_id == external_id)
                .filter(SystemBackboneFlow.company_id == company_id)
                .filter(SystemBackboneFlow.branch_id == branch_id)
                .filter(SystemBackboneFlow.fiscal_year == fiscal_year)
                .first()
            )
            flow = SystemBackboneService.create_flow(
                db,
                flow_name=item["flow_name"],
                entity_type=item["entity_type"],
                entity_id=item["entity_id"],
                external_id=external_id,
                company_id=company_id,
                branch_id=branch_id,
                fiscal_year=fiscal_year,
                source_system=source_system,
                target_system=target_system,
                stage="foundation",
                metadata={
                    "phase": "core",
                    "module": item["module"],
                    "sequence": idx,
                },
                created_by=created_by,
            )
            flow_ids.append(flow.id)
            if exists:
                reused += 1
            else:
                created += 1

        todos = SystemBackboneService.get_phase_todo(
            db,
            phase="core",
            company_id=company_id,
            branch_id=branch_id,
            fiscal_year=fiscal_year,
        )
        return {
            "phase": "core",
            "summary": {
                "created": created,
                "reused": reused,
                "total": len(flow_ids),
                "company_id": company_id,
                "branch_id": branch_id,
                "fiscal_year": fiscal_year,
            },
            "flow_ids": flow_ids,
            "todos": todos,
        }

    @staticmethod
    def apply_hardening(
        db: Session,
        *,
        company_id: int,
        branch_id: int,
        fiscal_year: int,
        updated_by: int | None = None,
    ) -> dict:
        flows = SystemBackboneService._list_core_flows(
            db,
            company_id=company_id,
            branch_id=branch_id,
            fiscal_year=fiscal_year,
        )
        if not flows:
            raise BusinessRuleError("Hardening için önce core bootstrap çalıştırılmalı")

        hardened = 0
        for flow in flows:
            changed = False
            if flow.max_retries < 5:
                flow.max_retries = 5
                changed = True
            if flow.retry_cooldown_seconds < 60:
                flow.retry_cooldown_seconds = 60
                changed = True
            if flow.stage == "foundation":
                flow.stage = "stabilization"
                changed = True
            if flow.status == "PENDING":
                flow.status = "IN_PROGRESS"
                changed = True
            flow.updated_by = updated_by

            if changed:
                hardened += 1
                SystemBackboneService._add_audit(
                    db,
                    flow_id=flow.id,
                    event_type="FLOW_HARDENING_APPLIED",
                    message="Hardening fazı uygulandı",
                    payload={
                        "max_retries": flow.max_retries,
                        "retry_cooldown_seconds": flow.retry_cooldown_seconds,
                        "stage": flow.stage,
                        "status": flow.status,
                    },
                    created_by=updated_by,
                )

        db.commit()

        todos = SystemBackboneService.get_phase_todo(
            db,
            phase="hardening",
            company_id=company_id,
            branch_id=branch_id,
            fiscal_year=fiscal_year,
        )
        return {
            "phase": "hardening",
            "summary": {
                "hardened": hardened,
                "total": len(flows),
                "company_id": company_id,
                "branch_id": branch_id,
                "fiscal_year": fiscal_year,
            },
            "flow_ids": [flow.id for flow in flows],
            "todos": todos,
        }
