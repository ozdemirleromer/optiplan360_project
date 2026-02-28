"""
OptiPlan 360 — Compliance Router (Genişletilmiş)
Uyumluluk kuralları, parça tipi kuralları ve tane haritalama endpoint'leri.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from app.exceptions import NotFoundError
from pydantic import BaseModel, Field
from typing import Any, Dict, List, Optional
from datetime import datetime
from sqlalchemy.orm import Session

from app.database import get_db
from app.compliance.agent_orchestrator import AgentOrchestrator
from app.compliance.part_type_rules_agent import PartTypeRulesAgent
from app.compliance.grain_mapping_agent import GrainMappingAgent
from app.auth import get_current_user, require_admin
from app.models import User

router = APIRouter(prefix="/api/compliance", tags=["Compliance"])


class OrderDraft(BaseModel):
    parts: List[Dict[str, Any]]


class ComplianceCheckResult(BaseModel):
    id: str
    rule_name: str
    status: str  # "PASS", "FAIL", "WARNING"
    message: str
    severity: str  # "CRITICAL", "HIGH", "MEDIUM", "LOW"
    field: Optional[str] = None


class ComplianceReport(BaseModel):
    order_id: Optional[str] = None
    checked_at: datetime
    total_rules: int
    passed: int
    failed: int
    warnings: int
    checks: List[ComplianceCheckResult]
    compliant_order: Optional[Dict[str, Any]] = None


class PartTypeRule(BaseModel):
    id: str
    part_type: str
    rule_code: str
    rule_description: str
    required_fields: List[str]
    validation_regex: Optional[str] = None
    error_message: str
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)


class PartTypeRuleCreate(BaseModel):
    part_type: str = Field(..., min_length=1)
    rule_code: str = Field(..., min_length=1)
    rule_description: str = Field(..., min_length=1)
    required_fields: List[str] = Field(default_factory=list)
    validation_regex: Optional[str] = None
    error_message: str = "Validation failed"
    is_active: bool = True


class GrainMappingEntry(BaseModel):
    id: str
    material_type: str
    thickness_mm: float
    grain_direction: str  # "LENGTHWISE", "WIDTHWISE", "AUTO"
    rotation_allowed: bool = True
    preferred_cut_direction: Optional[str] = None
    notes: Optional[str] = None
    is_active: bool = True


class GrainMappingCreate(BaseModel):
    material_type: str = Field(..., min_length=1)
    thickness_mm: float = Field(..., gt=0)
    grain_direction: str = Field(..., pattern="^(LENGTHWISE|WIDTHWISE|AUTO)$")
    rotation_allowed: bool = True
    preferred_cut_direction: Optional[str] = None
    notes: Optional[str] = None


class ComplianceStats(BaseModel):
    total_checks_today: int
    pass_rate_percentage: float
    most_common_violation: Optional[str] = None
    rules_by_status: Dict[str, int]


# ═══════════════════════════════════════════════════
# SİPARİŞ UYUMLULUK KONTROLÜ
# ═══════════════════════════════════════════════════

@router.post("/compile", response_model=ComplianceReport)
def compile_order(
    order: OrderDraft,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Siparişi uyumluluk kurallarına göre derle ve kontrol et.
    """
    orchestrator = AgentOrchestrator([
        PartTypeRulesAgent(),
        GrainMappingAgent(),
    ])

    result = orchestrator.run(order.dict())
    
    # Audit log
    from app.utils import create_audit_log
    create_audit_log(
        db, current_user.id, "COMPLIANCE_CHECK",
        f"Compliance check completed. Status: {'OK' if result['ok'] else 'FAIL'}",
        None
    )
    db.commit()

    return ComplianceReport(
        checked_at=datetime.utcnow(),
        total_rules=len(result.get("report", [])),
        passed=sum(1 for r in result.get("report", []) if r.get("status") == "PASS"),
        failed=sum(1 for r in result.get("report", []) if r.get("status") == "FAIL"),
        warnings=sum(1 for r in result.get("report", []) if r.get("status") == "WARNING"),
        checks=[
            ComplianceCheckResult(
                id=r.get("id", ""),
                rule_name=r.get("rule", ""),
                status=r.get("status", ""),
                message=r.get("message", ""),
                severity=r.get("severity", "MEDIUM"),
                field=r.get("field")
            )
            for r in result.get("report", [])
        ],
        compliant_order=result.get("compliant_order")
    )


@router.post("/check/quick")
def quick_compliance_check(
    parts: List[Dict[str, Any]],
    _: User = Depends(get_current_user)
):
    """Hızlı uyumluluk kontrolü - sadece kritik kuralları kontrol eder."""
    violations = []
    
    for i, part in enumerate(parts):
        part_type = part.get("part_type", "").upper()
        
        if not part.get("part_code"):
            violations.append({"part_index": i, "field": "part_code", "error": "Parça kodu zorunludur"})
        
        if part_type in ["TB", "KM"] and not part.get("length_mm"):
            violations.append({"part_index": i, "field": "length_mm", "error": f"{part_type} parçalar için boyut zorunludur"})
    
    return {
        "ok": len(violations) == 0,
        "violations": violations,
        "checked_at": datetime.utcnow().isoformat()
    }


# ═══════════════════════════════════════════════════
# PARÇA TİPİ KURALLARI YÖNETİMİ
# ═══════════════════════════════════════════════════

_part_type_rules: List[PartTypeRule] = [
    PartTypeRule(
        id="rule-001",
        part_type="TB",
        rule_code="TB_DIMENSION_REQUIRED",
        rule_description="Tekne parçaları için boyut bilgisi zorunludur",
        required_fields=["length_mm", "width_mm", "thickness_mm"],
        error_message="Tekne (TB) parçalar için boyut bilgileri eksik",
        is_active=True
    ),
    PartTypeRule(
        id="rule-002",
        part_type="KM",
        rule_code="KM_CODE_FORMAT",
        rule_description="Kapak menteşesi kodu KM-XXXX formatında olmalıdır",
        required_fields=["part_code"],
        validation_regex=r"^KM-\d{4}$",
        error_message="Kapak menteşesi kodu KM-XXXX formatında olmalıdır",
        is_active=True
    ),
    PartTypeRule(
        id="rule-003",
        part_type="DR",
        rule_code="DR_GRAIN_REQUIRED",
        rule_description="Kapı parçaları için tane yönü belirtilmelidir",
        required_fields=["grain_direction", "material_type"],
        error_message="Kapı (DR) parçalar için tane yönü zorunludur",
        is_active=True
    ),
]


@router.get("/rules/part-types", response_model=List[PartTypeRule])
def list_part_type_rules(
    part_type: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
    _: User = Depends(get_current_user)
):
    """Tüm parça tipi kurallarını listele."""
    rules = _part_type_rules
    if part_type:
        rules = [r for r in rules if r.part_type.upper() == part_type.upper()]
    if is_active is not None:
        rules = [r for r in rules if r.is_active == is_active]
    return rules


@router.post("/rules/part-types", response_model=PartTypeRule, status_code=201)
def create_part_type_rule(rule: PartTypeRuleCreate, admin: User = Depends(require_admin)):
    """Yeni parça tipi kuralı oluştur."""
    import uuid
    new_rule = PartTypeRule(id=f"rule-{uuid.uuid4().hex[:8]}", **rule.dict())
    _part_type_rules.append(new_rule)
    return new_rule


@router.put("/rules/part-types/{rule_id}", response_model=PartTypeRule)
def update_part_type_rule(rule_id: str, updates: PartTypeRuleCreate, admin: User = Depends(require_admin)):
    """Parça tipi kuralını güncelle."""
    for i, rule in enumerate(_part_type_rules):
        if rule.id == rule_id:
            updated = PartTypeRule(id=rule_id, **updates.dict(), created_at=rule.created_at)
            _part_type_rules[i] = updated
            return updated
    raise NotFoundError("Kural")


@router.delete("/rules/part-types/{rule_id}")
def delete_part_type_rule(rule_id: str, admin: User = Depends(require_admin)):
    """Parça tipi kuralını sil."""
    global _part_type_rules
    original_count = len(_part_type_rules)
    _part_type_rules = [r for r in _part_type_rules if r.id != rule_id]
    if len(_part_type_rules) == original_count:
        raise NotFoundError("Kural")
    return {"ok": True, "deleted": rule_id}


# ═══════════════════════════════════════════════════
# TANE HARİTALAMA YÖNETİMİ
# ═══════════════════════════════════════════════════

_grain_mappings: List[GrainMappingEntry] = [
    GrainMappingEntry(
        id="grain-001", material_type="MDF", thickness_mm=18,
        grain_direction="LENGTHWISE", rotation_allowed=True, notes="Standart MDF için tane yönü"
    ),
    GrainMappingEntry(
        id="grain-002", material_type="MDF", thickness_mm=25,
        grain_direction="LENGTHWISE", rotation_allowed=False, notes="Kalın MDF için sabit tane"
    ),
    GrainMappingEntry(
        id="grain-003", material_type="LAMINATE", thickness_mm=0.8,
        grain_direction="AUTO", rotation_allowed=True, preferred_cut_direction="LENGTHWISE",
        notes="Laminat için esnek tane"
    ),
]


@router.get("/grain-mappings", response_model=List[GrainMappingEntry])
def list_grain_mappings(
    material_type: Optional[str] = Query(None),
    thickness_mm: Optional[float] = Query(None),
    _: User = Depends(get_current_user)
):
    """Tane haritalama kurallarını listele."""
    mappings = _grain_mappings
    if material_type:
        mappings = [m for m in mappings if m.material_type.upper() == material_type.upper()]
    if thickness_mm is not None:
        mappings = [m for m in mappings if m.thickness_mm == thickness_mm]
    return mappings


@router.post("/grain-mappings", response_model=GrainMappingEntry, status_code=201)
def create_grain_mapping(mapping: GrainMappingCreate, admin: User = Depends(require_admin)):
    """Yeni tane haritalama kuralı oluştur."""
    import uuid
    new_mapping = GrainMappingEntry(id=f"grain-{uuid.uuid4().hex[:8]}", **mapping.dict())
    _grain_mappings.append(new_mapping)
    return new_mapping


@router.put("/grain-mappings/{mapping_id}", response_model=GrainMappingEntry)
def update_grain_mapping(mapping_id: str, updates: GrainMappingCreate, admin: User = Depends(require_admin)):
    """Tane haritalama kuralını güncelle."""
    for i, mapping in enumerate(_grain_mappings):
        if mapping.id == mapping_id:
            updated = GrainMappingEntry(id=mapping_id, **updates.dict())
            _grain_mappings[i] = updated
            return updated
    raise NotFoundError("Haritalama")


@router.delete("/grain-mappings/{mapping_id}")
def delete_grain_mapping(mapping_id: str, admin: User = Depends(require_admin)):
    """Tane haritalama kuralını sil."""
    global _grain_mappings
    original_count = len(_grain_mappings)
    _grain_mappings = [m for m in _grain_mappings if m.id != mapping_id]
    if len(_grain_mappings) == original_count:
        raise NotFoundError("Haritalama")
    return {"ok": True, "deleted": mapping_id}


@router.get("/grain-mappings/suggest")
def suggest_grain_mapping(material_type: str, thickness_mm: float, _: User = Depends(get_current_user)):
    """Verilen malzeme ve kalınlık için tane yönü önerisi getir."""
    for mapping in _grain_mappings:
        if (mapping.material_type.upper() == material_type.upper() and
            mapping.thickness_mm == thickness_mm and mapping.is_active):
            return {"exact_match": True, "suggestion": mapping, "confidence": "HIGH"}
    
    material_mappings = [m for m in _grain_mappings if m.material_type.upper() == material_type.upper() and m.is_active]
    if material_mappings:
        closest = min(material_mappings, key=lambda m: abs(m.thickness_mm - thickness_mm))
        return {"exact_match": False, "suggestion": closest, "confidence": "MEDIUM"}
    
    return {"exact_match": False, "confidence": "LOW", "note": "Bu malzeme için tanımlı kural bulunamadı"}


# ═══════════════════════════════════════════════════
# UYUMLULUK İSTATİSTİKLERİ
# ═══════════════════════════════════════════════════

@router.get("/stats", response_model=ComplianceStats)
def get_compliance_stats(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    """Uyumluluk sistemi istatistiklerini getir."""
    from sqlalchemy import func
    from app.models import AuditLog
    
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    total_checks = db.query(func.count(AuditLog.id)).filter(
        AuditLog.action == "COMPLIANCE_CHECK", AuditLog.created_at >= today_start
    ).scalar() or 0
    
    success_checks = db.query(func.count(AuditLog.id)).filter(
        AuditLog.action == "COMPLIANCE_CHECK", AuditLog.created_at >= today_start,
        AuditLog.details.contains("OK")
    ).scalar() or 0
    
    pass_rate = (success_checks / max(total_checks, 1)) * 100
    
    return ComplianceStats(
        total_checks_today=total_checks,
        pass_rate_percentage=round(pass_rate, 1),
        most_common_violation="TB_DIMENSION_REQUIRED" if total_checks > 0 else None,
        rules_by_status={
            "active_part_rules": len([r for r in _part_type_rules if r.is_active]),
            "inactive_part_rules": len([r for r in _part_type_rules if not r.is_active]),
            "active_grain_mappings": len([m for m in _grain_mappings if m.is_active]),
            "inactive_grain_mappings": len([m for m in _grain_mappings if not m.is_active]),
        }
    )


@router.post("/batch-check")
def batch_compliance_check(
    orders: List[OrderDraft],
    strict_mode: bool = False,
    current_user: User = Depends(get_current_user)
):
    """Birden fazla siparişi toplu olarak kontrol et."""
    orchestrator = AgentOrchestrator([PartTypeRulesAgent(), GrainMappingAgent()])
    
    results = []
    for i, order in enumerate(orders):
        result = orchestrator.run(order.dict())
        results.append({
            "order_index": i,
            "ok": result["ok"],
            "violation_count": len([r for r in result.get("report", []) if r.get("status") == "FAIL"]),
        })
    
    failed_count = sum(1 for r in results if not r["ok"])
    return {
        "checked_at": datetime.utcnow().isoformat(),
        "total_orders": len(orders),
        "passed": len(orders) - failed_count,
        "failed": failed_count,
        "results": results,
        "strict_mode": strict_mode
    }


@router.get("/health")
def compliance_health_check():
    """Uyumluluk servisi sağlık kontrolü."""
    return {
        "status": "healthy",
        "agents": {"part_type_rules": "active", "grain_mapping": "active"},
        "rules_loaded": len(_part_type_rules),
        "mappings_loaded": len(_grain_mappings),
        "checked_at": datetime.utcnow().isoformat()
    }