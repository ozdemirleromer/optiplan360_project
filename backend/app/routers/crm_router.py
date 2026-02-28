"""
CRM Router — Cari, Kontak, Fırsat, Teklif, Görev, Aktivite API
/api/v1/crm/...
"""

from datetime import datetime
from typing import List, Optional

from app.auth import require_operator, require_permissions
from app.database import get_db
from app.exceptions import BusinessRuleError, NotFoundError
from app.models import User
from app.permissions import Permission
from app.services import crm_service
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session

router = APIRouter(prefix="/api/v1/crm", tags=["crm"])


# ═══════════════════════════════════════
# PYDANTIC SCHEMAS (inline — admin_router pattern)
# ═══════════════════════════════════════


class AdminTicketMessageOut(BaseModel):
    id: str
    ticket_id: str
    sender_id: int
    sender_name: Optional[str] = None
    message: str
    is_internal: bool = False
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class AdminTicketOut(BaseModel):
    id: str
    account_id: str
    account_name: Optional[str] = None
    subject: str
    description: str
    status: str
    priority: str
    assigned_to_id: Optional[int] = None
    created_by_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    messages: List[AdminTicketMessageOut] = []
    model_config = ConfigDict(from_attributes=True)


class TicketReply(BaseModel):
    message: str
    is_internal: bool = False


class TicketStatusUpdate(BaseModel):
    status: str
    assigned_to_id: Optional[int] = None


class AccountCreate(BaseModel):
    company_name: str
    tax_id: Optional[str] = None
    tax_office: Optional[str] = None
    account_type: str = "CORPORATE"
    industry: Optional[str] = None
    website: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    district: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    credit_limit: float = 0
    payment_term_days: int = 30
    tags: Optional[str] = None
    notes: Optional[str] = None
    customer_id: Optional[int] = None
    mikro_cari_kod: Optional[str] = None


class AccountUpdate(BaseModel):
    company_name: Optional[str] = None
    tax_id: Optional[str] = None
    tax_office: Optional[str] = None
    account_type: Optional[str] = None
    industry: Optional[str] = None
    website: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    district: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    credit_limit: Optional[float] = None
    payment_term_days: Optional[int] = None
    tags: Optional[str] = None
    notes: Optional[str] = None
    mikro_cari_kod: Optional[str] = None


class AccountOut(BaseModel):
    id: str
    customer_id: Optional[int] = None
    company_name: str
    tax_id: Optional[str] = None
    tax_office: Optional[str] = None
    account_type: str
    industry: Optional[str] = None
    website: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    district: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    credit_limit: float
    balance: float
    payment_term_days: int
    tags: Optional[str] = None
    notes: Optional[str] = None
    mikro_cari_kod: Optional[str] = None
    is_active: bool
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)


class ContactCreate(BaseModel):
    account_id: str
    first_name: str
    last_name: str
    title: Optional[str] = None
    department: Optional[str] = None
    phone: Optional[str] = None
    mobile: Optional[str] = None
    email: Optional[str] = None
    is_primary: bool = False
    notes: Optional[str] = None


class ContactUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    title: Optional[str] = None
    department: Optional[str] = None
    phone: Optional[str] = None
    mobile: Optional[str] = None
    email: Optional[str] = None
    is_primary: Optional[bool] = None
    notes: Optional[str] = None


class ContactOut(BaseModel):
    id: str
    account_id: str
    first_name: str
    last_name: str
    title: Optional[str] = None
    department: Optional[str] = None
    phone: Optional[str] = None
    mobile: Optional[str] = None
    email: Optional[str] = None
    is_primary: bool
    is_active: bool
    created_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)


class OpportunityCreate(BaseModel):
    account_id: str
    contact_id: Optional[str] = None
    title: str
    description: Optional[str] = None
    stage: str = "LEAD"
    amount: float = 0
    currency: str = "TRY"
    probability: Optional[int] = None
    expected_close_date: Optional[datetime] = None
    source: Optional[str] = None


class OpportunityUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    amount: Optional[float] = None
    currency: Optional[str] = None
    probability: Optional[int] = None
    expected_close_date: Optional[datetime] = None
    source: Optional[str] = None


class OpportunityOut(BaseModel):
    id: str
    account_id: str
    contact_id: Optional[str] = None
    title: str
    description: Optional[str] = None
    stage: str
    amount: float
    currency: str
    probability: int
    expected_close_date: Optional[datetime] = None
    actual_close_date: Optional[datetime] = None
    lost_reason: Optional[str] = None
    source: Optional[str] = None
    owner_id: Optional[int] = None
    order_id: Optional[int] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)


class StageTransition(BaseModel):
    new_stage: str
    lost_reason: Optional[str] = None


class QuoteLineInput(BaseModel):
    product_code: Optional[str] = None
    description: str
    quantity: float = 1
    unit: str = "ADET"
    unit_price: float = 0
    discount_rate: float = 0
    tax_rate: float = 20
    mikro_stok_kod: Optional[str] = None
    notes: Optional[str] = None


class QuoteCreate(BaseModel):
    account_id: str
    opportunity_id: Optional[str] = None
    title: str
    description: Optional[str] = None
    tax_rate: float = 20
    discount_rate: float = 0
    currency: str = "TRY"
    valid_until: Optional[datetime] = None
    notes: Optional[str] = None
    terms: Optional[str] = None
    lines: List[QuoteLineInput] = []


class QuoteLineOut(BaseModel):
    id: str
    quote_id: str
    line_number: int
    product_code: Optional[str] = None
    description: str
    quantity: float
    unit: str
    unit_price: float
    discount_rate: float
    tax_rate: float
    line_total: float
    mikro_stok_kod: Optional[str] = None
    notes: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)


class QuoteOut(BaseModel):
    id: str
    account_id: str
    opportunity_id: Optional[str] = None
    quote_number: str
    revision: int
    status: str
    title: str
    description: Optional[str] = None
    subtotal: float
    tax_rate: float
    tax_amount: float
    discount_rate: float
    discount_amount: float
    total: float
    currency: str
    valid_until: Optional[datetime] = None
    notes: Optional[str] = None
    terms: Optional[str] = None
    lines: List[QuoteLineOut] = []
    created_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)


class TaskCreate(BaseModel):
    title: str
    description: Optional[str] = None
    priority: str = "MEDIUM"
    opportunity_id: Optional[str] = None
    account_id: Optional[str] = None
    assigned_to_id: Optional[int] = None
    due_date: Optional[datetime] = None


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = None
    assigned_to_id: Optional[int] = None
    due_date: Optional[datetime] = None


class TaskOut(BaseModel):
    id: str
    title: str
    description: Optional[str] = None
    priority: str
    status: str
    opportunity_id: Optional[str] = None
    account_id: Optional[str] = None
    assigned_to_id: Optional[int] = None
    due_date: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)


class ActivityCreate(BaseModel):
    activity_type: str
    subject: str
    body: Optional[str] = None
    duration_minutes: Optional[int] = None
    opportunity_id: Optional[str] = None
    account_id: Optional[str] = None
    contact_id: Optional[str] = None


class ActivityOut(BaseModel):
    id: str
    activity_type: str
    subject: str
    body: Optional[str] = None
    duration_minutes: Optional[int] = None
    opportunity_id: Optional[str] = None
    account_id: Optional[str] = None
    contact_id: Optional[str] = None
    activity_date: Optional[datetime] = None
    created_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)


class NoteCreate(BaseModel):
    entity_type: str
    entity_id: str
    content: str


class NoteOut(BaseModel):
    id: str
    entity_type: str
    entity_id: str
    content: str
    created_by_id: Optional[int] = None
    created_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)


# ═══════════════════════════════════════
# CARİ HESAP ENDPOİNTLERİ
# ═══════════════════════════════════════


@router.get("/accounts")
def api_list_accounts(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    search: Optional[str] = None,
    is_active: Optional[bool] = None,
    db: Session = Depends(get_db),
    user: User = Depends(require_permissions(Permission.CRM_VIEW)),
):
    items, total = crm_service.list_accounts(db, skip, limit, search, is_active)
    return {"data": [AccountOut.model_validate(i) for i in items], "total": total}


@router.get("/accounts/{account_id}")
def api_get_account(
    account_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(require_permissions(Permission.CRM_VIEW)),
):
    acc = crm_service.get_account(db, account_id)
    if not acc:
        raise NotFoundError("Cari hesap")
    return AccountOut.model_validate(acc)


@router.post("/accounts", status_code=201)
def api_create_account(
    body: AccountCreate, db: Session = Depends(get_db), user: User = Depends(require_operator)
):
    acc = crm_service.create_account(db, body.model_dump(exclude_none=True), user.id)
    return AccountOut.model_validate(acc)


@router.put("/accounts/{account_id}")
def api_update_account(
    account_id: str,
    body: AccountUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_operator),
):
    acc = crm_service.update_account(db, account_id, body.model_dump(exclude_none=True), user.id)
    if not acc:
        raise NotFoundError("Cari hesap")
    return AccountOut.model_validate(acc)


@router.delete("/accounts/{account_id}")
def api_delete_account(
    account_id: str, db: Session = Depends(get_db), user: User = Depends(require_operator)
):
    ok = crm_service.delete_account(db, account_id, user.id)
    if not ok:
        raise NotFoundError("Cari hesap")
    return {"ok": True, "message": "Cari hesap pasifleştirildi"}


# ═══════════════════════════════════════
# KONTAK ENDPOİNTLERİ
# ═══════════════════════════════════════


@router.get("/contacts")
def api_list_contacts(
    account_id: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    user: User = Depends(require_permissions(Permission.CRM_VIEW)),
):
    items, total = crm_service.list_contacts(db, account_id, skip, limit)
    return {"data": [ContactOut.model_validate(i) for i in items], "total": total}


@router.post("/contacts", status_code=201)
def api_create_contact(
    body: ContactCreate, db: Session = Depends(get_db), user: User = Depends(require_operator)
):
    contact = crm_service.create_contact(db, body.model_dump(exclude_none=True), user.id)
    return ContactOut.model_validate(contact)


@router.put("/contacts/{contact_id}")
def api_update_contact(
    contact_id: str,
    body: ContactUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_operator),
):
    contact = crm_service.update_contact(
        db, contact_id, body.model_dump(exclude_none=True), user.id
    )
    if not contact:
        raise NotFoundError("Kişi")
    return ContactOut.model_validate(contact)


# ═══════════════════════════════════════
# FIRSAT ENDPOİNTLERİ
# ═══════════════════════════════════════


@router.get("/opportunities")
def api_list_opportunities(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    stage: Optional[str] = None,
    account_id: Optional[str] = None,
    db: Session = Depends(get_db),
    user: User = Depends(require_permissions(Permission.CRM_VIEW)),
):
    items, total = crm_service.list_opportunities(db, skip, limit, stage, account_id)
    return {"data": [OpportunityOut.model_validate(i) for i in items], "total": total}


@router.get("/opportunities/{opp_id}")
def api_get_opportunity(
    opp_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(require_permissions(Permission.CRM_VIEW)),
):
    opp = crm_service.get_opportunity(db, opp_id)
    if not opp:
        raise NotFoundError("Fırsat")
    return OpportunityOut.model_validate(opp)


@router.post("/opportunities", status_code=201)
def api_create_opportunity(
    body: OpportunityCreate, db: Session = Depends(get_db), user: User = Depends(require_operator)
):
    opp = crm_service.create_opportunity(db, body.model_dump(exclude_none=True), user.id)
    return OpportunityOut.model_validate(opp)


@router.put("/opportunities/{opp_id}")
def api_update_opportunity(
    opp_id: str,
    body: OpportunityUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_operator),
):
    opp = crm_service.update_opportunity(db, opp_id, body.model_dump(exclude_none=True), user.id)
    if not opp:
        raise NotFoundError("Fırsat")
    return OpportunityOut.model_validate(opp)


@router.post("/opportunities/{opp_id}/transition")
def api_transition_stage(
    opp_id: str,
    body: StageTransition,
    db: Session = Depends(get_db),
    user: User = Depends(require_operator),
):
    result, error = crm_service.transition_stage(
        db, opp_id, body.new_stage, user.id, body.lost_reason
    )
    if error:
        raise BusinessRuleError(error)
    return OpportunityOut.model_validate(result)


@router.post("/opportunities/{opp_id}/convert")
def api_convert_to_order(
    opp_id: str, db: Session = Depends(get_db), user: User = Depends(require_operator)
):
    result, error = crm_service.convert_to_order(db, opp_id, user.id)
    if error:
        raise BusinessRuleError(error)
    return {
        "ok": True,
        "message": "Fırsat siparişe dönüştürüldü",
        "order_id": result["order"].id,
        "opportunity_id": result["opportunity"].id,
    }


# ═══════════════════════════════════════
# TEKLİF ENDPOİNTLERİ
# ═══════════════════════════════════════


@router.get("/quotes")
def api_list_quotes(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    account_id: Optional[str] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    user: User = Depends(require_permissions(Permission.CRM_VIEW)),
):
    items, total = crm_service.list_quotes(db, skip, limit, account_id, status)
    return {"data": [QuoteOut.model_validate(i) for i in items], "total": total}


@router.get("/quotes/{quote_id}")
def api_get_quote(
    quote_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(require_permissions(Permission.CRM_VIEW)),
):
    q = crm_service.get_quote(db, quote_id)
    if not q:
        raise NotFoundError("Teklif")
    return QuoteOut.model_validate(q)


@router.post("/quotes", status_code=201)
def api_create_quote(
    body: QuoteCreate, db: Session = Depends(get_db), user: User = Depends(require_operator)
):
    data = body.model_dump(exclude={"lines"}, exclude_none=True)
    lines = [ln.model_dump() for ln in body.lines]
    q = crm_service.create_quote(db, data, lines, user.id)
    return QuoteOut.model_validate(q)


@router.post("/quotes/{quote_id}/revise")
def api_revise_quote(
    quote_id: str, db: Session = Depends(get_db), user: User = Depends(require_operator)
):
    q = crm_service.revise_quote(db, quote_id, user.id)
    if not q:
        raise NotFoundError("Teklif")
    return QuoteOut.model_validate(q)


# ═══════════════════════════════════════
# GÖREV ENDPOİNTLERİ
# ═══════════════════════════════════════


@router.get("/tasks")
def api_list_tasks(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    status: Optional[str] = None,
    assigned_to: Optional[int] = None,
    db: Session = Depends(get_db),
    user: User = Depends(require_permissions(Permission.CRM_VIEW)),
):
    items, total = crm_service.list_tasks(db, skip, limit, status, assigned_to)
    return {"data": [TaskOut.model_validate(i) for i in items], "total": total}


@router.post("/tasks", status_code=201)
def api_create_task(
    body: TaskCreate, db: Session = Depends(get_db), user: User = Depends(require_operator)
):
    task = crm_service.create_task(db, body.model_dump(exclude_none=True), user.id)
    return TaskOut.model_validate(task)


@router.put("/tasks/{task_id}")
def api_update_task(
    task_id: str,
    body: TaskUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_operator),
):
    task = crm_service.update_task(db, task_id, body.model_dump(exclude_none=True), user.id)
    if not task:
        raise NotFoundError("Görev")
    return TaskOut.model_validate(task)


# ═══════════════════════════════════════
# AKTİVİTE ENDPOİNTLERİ
# ═══════════════════════════════════════


@router.get("/activities")
def api_list_activities(
    opportunity_id: Optional[str] = None,
    account_id: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    user: User = Depends(require_permissions(Permission.CRM_VIEW)),
):
    items, total = crm_service.list_activities(db, opportunity_id, account_id, skip, limit)
    return {"data": [ActivityOut.model_validate(i) for i in items], "total": total}


@router.post("/activities", status_code=201)
def api_create_activity(
    body: ActivityCreate, db: Session = Depends(get_db), user: User = Depends(require_operator)
):
    act = crm_service.create_activity(db, body.model_dump(exclude_none=True), user.id)
    return ActivityOut.model_validate(act)


# ═══════════════════════════════════════
# NOT ENDPOİNTLERİ
# ═══════════════════════════════════════


@router.get("/notes")
def api_list_notes(
    entity_type: str = Query(...),
    entity_id: str = Query(...),
    db: Session = Depends(get_db),
    user: User = Depends(require_permissions(Permission.CRM_VIEW)),
):
    items = crm_service.list_notes(db, entity_type, entity_id)
    return {"data": [NoteOut.model_validate(i) for i in items]}


@router.post("/notes", status_code=201)
def api_create_note(
    body: NoteCreate, db: Session = Depends(get_db), user: User = Depends(require_operator)
):
    note = crm_service.create_note(db, body.model_dump(), user.id)
    return NoteOut.model_validate(note)


# ═══════════════════════════════════════
# DASHBOARD / İSTATİSTİKLER
# ═══════════════════════════════════════


@router.get("/stats")
def api_crm_stats(
    db: Session = Depends(get_db), user: User = Depends(require_permissions(Permission.CRM_VIEW))
):
    return crm_service.get_crm_stats(db)


# ═══════════════════════════════════════
# YÖNETİCİ / OPERATÖR BİLET (TICKET) YÖNETİMİ
# ═══════════════════════════════════════


@router.get("/tickets")
def api_list_tickets(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    status: Optional[str] = None,
    account_id: Optional[str] = None,
    db: Session = Depends(get_db),
    user: User = Depends(require_permissions(Permission.CRM_VIEW)),
):
    items, total = crm_service.list_tickets(db, skip, limit, status, account_id)
    return {"data": [AdminTicketOut.model_validate(i) for i in items], "total": total}


@router.get("/tickets/{ticket_id}")
def api_get_ticket(
    ticket_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(require_permissions(Permission.CRM_VIEW)),
):
    t = crm_service.get_ticket(db, ticket_id)
    if not t:
        raise NotFoundError("Destek talebi (Ticket)")
    return AdminTicketOut.model_validate(t)


@router.post("/tickets/{ticket_id}/reply")
def api_reply_ticket(
    ticket_id: str,
    body: TicketReply,
    db: Session = Depends(get_db),
    user: User = Depends(require_operator),
):
    msg = crm_service.reply_ticket(db, ticket_id, body.message, user, body.is_internal)
    if not msg:
        raise NotFoundError("Destek talebi (Ticket)")
    return AdminTicketMessageOut.model_validate(msg)


@router.put("/tickets/{ticket_id}/status")
def api_update_ticket_status(
    ticket_id: str,
    body: TicketStatusUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_operator),
):
    t = crm_service.update_ticket_status(db, ticket_id, body.status, body.assigned_to_id, user.id)
    if not t:
        raise NotFoundError("Destek talebi (Ticket)")
    return AdminTicketOut.model_validate(t)
