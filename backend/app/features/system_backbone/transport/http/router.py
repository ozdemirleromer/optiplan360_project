from datetime import datetime
from typing import Literal, Optional

from app.auth import require_operator
from app.database import get_db
from app.models import User
from app.services.system_backbone_service import SystemBackboneService
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session

router = APIRouter(prefix="/api/v1/system-backbone", tags=["system-backbone"])


class BackboneFlowCreate(BaseModel):
    flow_name: str
    entity_type: str
    entity_id: str
    external_id: Optional[str] = None
    company_id: int = 1
    branch_id: int = 0
    fiscal_year: int = 2026
    source_system: str
    target_system: str
    stage: str = "foundation"
    metadata: dict = {}


class BackboneFlowAdvance(BaseModel):
    next_stage: str
    next_status: str
    note: str
    retry_increment: bool = False
    error_message: Optional[str] = None


class BackboneFlowOut(BaseModel):
    id: str
    flow_name: str
    entity_type: str
    entity_id: str
    external_id: Optional[str] = None
    company_id: int
    branch_id: int
    fiscal_year: int
    source_system: str
    target_system: str
    status: str
    stage: str
    retry_count: int
    max_retries: int
    retry_cooldown_seconds: int
    last_error: Optional[str] = None
    metadata_json: Optional[str] = None
    last_retry_at: Optional[datetime] = None
    next_retry_at: Optional[datetime] = None
    created_by: Optional[int] = None
    updated_by: Optional[int] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class BackboneFlowListResponse(BaseModel):
    data: list[BackboneFlowOut]
    total: int


class BackboneFlowAuditOut(BaseModel):
    id: int
    flow_id: str
    event_type: str
    message: str
    payload_json: Optional[str] = None
    created_by: Optional[int] = None
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class BackboneFlowAuditListResponse(BaseModel):
    data: list[BackboneFlowAuditOut]


class BackbonePhaseCommand(BaseModel):
    company_id: int = 1
    branch_id: int = 0
    fiscal_year: int = 2026
    source_system: str = "optiplan360"
    target_system: str = "mikro"


class BackboneTodoItem(BaseModel):
    order: int
    title: str
    status: str
    detail: str


class BackbonePhaseResponse(BaseModel):
    phase: str
    summary: dict
    flow_ids: list[str]
    todos: list[BackboneTodoItem]


class BackboneTodoListResponse(BaseModel):
    phase: str
    todos: list[BackboneTodoItem]


class BackboneRoadmapResponse(BaseModel):
    company_id: int
    branch_id: int
    fiscal_year: int
    tamamlanan_ana_yapi: list[str]
    ana_yapi_eksikleri: list[str]
    tamamlanan_sertlestirme_test: list[str]
    sertlestirme_test_eksikleri: list[str]


class BackboneLastPackageRunResponse(BaseModel):
    package: str
    event_type: Literal["FLOW_CREATED", "FLOW_REUSED", "FLOW_HARDENING_APPLIED"]
    at: str | None = None
    user_id: int | None = None
    company_id: int
    branch_id: int
    fiscal_year: int


class BackboneChainStepResponse(BaseModel):
    step: Literal["foundation", "stabilization"]
    generated_at: str | None = None
    flow_count: int
    duration_ms: int


class BackbonePackageResponse(BaseModel):
    package: str
    chain_id: str | None = None
    generated_at: str
    watcher_enabled: bool
    warnings: list[str] = []
    flow_count: int
    workflow_record_count: int
    total_duration_ms: int | None = None
    failed_step: str | None = None
    phase_counts: dict
    status_counts: dict
    last_package_run: BackboneLastPackageRunResponse | None = None
    roadmap: BackboneRoadmapResponse
    core_bootstrap: dict | None = None
    workflow_scan: dict | None = None
    hardening: dict | None = None
    chain_steps: list[BackboneChainStepResponse] | None = None


class BackbonePackageStatusResponse(BaseModel):
    company_id: int
    branch_id: int
    fiscal_year: int
    generated_at: str
    watcher_enabled: bool
    flow_count: int
    workflow_record_count: int
    phase_counts: dict
    status_counts: dict
    last_package_run: BackboneLastPackageRunResponse | None = None
    roadmap: BackboneRoadmapResponse


@router.get("/overview")
def get_overview(
    company_id: Optional[int] = Query(None, ge=1),
    branch_id: Optional[int] = Query(None, ge=0),
    fiscal_year: Optional[int] = Query(None, ge=2000),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_operator),
):
    _ = current_user
    return SystemBackboneService.get_overview(
        db,
        company_id=company_id,
        branch_id=branch_id,
        fiscal_year=fiscal_year,
    )


@router.get("/flows", response_model=BackboneFlowListResponse)
def list_flows(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    status: Optional[str] = Query(None),
    stage: Optional[str] = Query(None),
    company_id: Optional[int] = Query(None, ge=1),
    branch_id: Optional[int] = Query(None, ge=0),
    fiscal_year: Optional[int] = Query(None, ge=2000),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_operator),
):
    _ = current_user
    rows, total = SystemBackboneService.list_flows(
        db,
        limit=limit,
        offset=offset,
        status=status,
        stage=stage,
        company_id=company_id,
        branch_id=branch_id,
        fiscal_year=fiscal_year,
    )
    return BackboneFlowListResponse(data=rows, total=total)


@router.post("/flows", response_model=BackboneFlowOut, status_code=201)
def create_flow(
    body: BackboneFlowCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_operator),
):
    return SystemBackboneService.create_flow(
        db,
        flow_name=body.flow_name,
        entity_type=body.entity_type,
        entity_id=body.entity_id,
        external_id=body.external_id,
        company_id=body.company_id,
        branch_id=body.branch_id,
        fiscal_year=body.fiscal_year,
        source_system=body.source_system,
        target_system=body.target_system,
        stage=body.stage,
        metadata=body.metadata,
        created_by=current_user.id,
    )


@router.post("/flows/{flow_id}/advance", response_model=BackboneFlowOut)
def advance_flow(
    flow_id: str,
    body: BackboneFlowAdvance,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_operator),
):
    return SystemBackboneService.advance_flow(
        db,
        flow_id=flow_id,
        next_stage=body.next_stage,
        next_status=body.next_status,
        note=body.note,
        updated_by=current_user.id,
        retry_increment=body.retry_increment,
        error_message=body.error_message,
    )


@router.get("/flows/{flow_id}/audits", response_model=BackboneFlowAuditListResponse)
def list_audits(
    flow_id: str,
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_operator),
):
    _ = current_user
    rows = SystemBackboneService.list_audits(db, flow_id=flow_id, limit=limit)
    return BackboneFlowAuditListResponse(data=rows)


@router.post("/phases/core/bootstrap", response_model=BackbonePhaseResponse)
def bootstrap_core_phase(
    body: BackbonePhaseCommand,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_operator),
):
    return SystemBackboneService.bootstrap_core_structure(
        db,
        company_id=body.company_id,
        branch_id=body.branch_id,
        fiscal_year=body.fiscal_year,
        source_system=body.source_system,
        target_system=body.target_system,
        created_by=current_user.id,
    )


@router.post("/phases/hardening/apply", response_model=BackbonePhaseResponse)
def apply_hardening_phase(
    body: BackbonePhaseCommand,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_operator),
):
    return SystemBackboneService.apply_hardening(
        db,
        company_id=body.company_id,
        branch_id=body.branch_id,
        fiscal_year=body.fiscal_year,
        updated_by=current_user.id,
    )


@router.get("/phases/{phase}/todo", response_model=BackboneTodoListResponse)
def get_phase_todo(
    phase: str,
    company_id: int = Query(1, ge=1),
    branch_id: int = Query(0, ge=0),
    fiscal_year: int = Query(2026, ge=2000),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_operator),
):
    _ = current_user
    todos = SystemBackboneService.get_phase_todo(
        db,
        phase=phase,
        company_id=company_id,
        branch_id=branch_id,
        fiscal_year=fiscal_year,
    )
    return BackboneTodoListResponse(phase=phase, todos=todos)


@router.get("/roadmap", response_model=BackboneRoadmapResponse)
def get_roadmap(
    company_id: int = Query(1, ge=1),
    branch_id: int = Query(0, ge=0),
    fiscal_year: int = Query(2026, ge=2000),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_operator),
):
    _ = current_user
    return SystemBackboneService.get_roadmap(
        db,
        company_id=company_id,
        branch_id=branch_id,
        fiscal_year=fiscal_year,
    )


@router.post("/packages/foundation/run", response_model=BackbonePackageResponse)
def run_foundation_package(
    body: BackbonePhaseCommand,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_operator),
):
    return SystemBackboneService.run_foundation_package(
        db,
        company_id=body.company_id,
        branch_id=body.branch_id,
        fiscal_year=body.fiscal_year,
        source_system=body.source_system,
        target_system=body.target_system,
        created_by=current_user.id,
    )


@router.post("/packages/stabilization/run", response_model=BackbonePackageResponse)
def run_stabilization_package(
    body: BackbonePhaseCommand,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_operator),
):
    return SystemBackboneService.run_stabilization_package(
        db,
        company_id=body.company_id,
        branch_id=body.branch_id,
        fiscal_year=body.fiscal_year,
        updated_by=current_user.id,
    )


@router.post("/packages/chain/run", response_model=BackbonePackageResponse)
def run_chain_package(
    body: BackbonePhaseCommand,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_operator),
):
    return SystemBackboneService.run_chain_package(
        db,
        company_id=body.company_id,
        branch_id=body.branch_id,
        fiscal_year=body.fiscal_year,
        source_system=body.source_system,
        target_system=body.target_system,
        actor_user_id=current_user.id,
    )


@router.get("/packages/status", response_model=BackbonePackageStatusResponse)
def get_package_status(
    company_id: int = Query(1, ge=1),
    branch_id: int = Query(0, ge=0),
    fiscal_year: int = Query(2026, ge=2000),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_operator),
):
    _ = current_user
    return SystemBackboneService.get_package_status(
        db,
        company_id=company_id,
        branch_id=branch_id,
        fiscal_year=fiscal_year,
    )
