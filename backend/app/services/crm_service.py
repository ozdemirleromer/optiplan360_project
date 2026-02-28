"""
CRM Service — İş mantığı katmanı
Cari, Kontak, Fırsat, Teklif, Görev, Aktivite CRUD + Pipeline + Dönüşüm
"""
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_, func as sa_func
from uuid import uuid4
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any

from app.models import (
    CRMAccount, CRMContact, CRMOpportunity, CRMQuote, CRMQuoteLine,
    CRMTask, CRMActivity, CRMNote, CRMTicket, CRMTicketMessage,
    OpportunityStageEnum, QuoteStatusEnum, TaskStatusEnum,
    Order, OrderStatusEnum, Customer, User
)
from app.utils import create_audit_log
from app.services.base_service import BaseService
from app.services.email_service import email_service


class CRMService(BaseService[CRMAccount]):
    """CRM account odakli CRUD servisi (BaseService uyumlu)."""

    def __init__(self, db: Session):
        super().__init__(db, CRMAccount)

    def get_by_id(self, id: str) -> Optional[CRMAccount]:
        try:
            return self.db.query(self.model).filter(self.model.id == id).first()
        except Exception as e:
            self._handle_error("get_by_id", e, id=id)
            raise

    def create(self, data: Dict[str, Any]) -> CRMAccount:
        try:
            payload = dict(data)
            payload.setdefault("id", str(uuid4()))
            instance = self.model(**payload)
            self.db.add(instance)
            self.db.commit()
            self.db.refresh(instance)
            return instance
        except Exception as e:
            self.db.rollback()
            self._handle_error("create", e, data=data)
            raise

    def update(self, id: str, data: Dict[str, Any]) -> Optional[CRMAccount]:
        try:
            instance = self.get_by_id(id)
            if not instance:
                return None
            for key, value in data.items():
                if hasattr(instance, key) and value is not None:
                    setattr(instance, key, value)
            self.db.commit()
            self.db.refresh(instance)
            return instance
        except Exception as e:
            self.db.rollback()
            self._handle_error("update", e, id=id, data=data)
            raise

    def delete(self, id: str) -> bool:
        try:
            instance = self.get_by_id(id)
            if not instance:
                return False
            if hasattr(instance, "is_active"):
                instance.is_active = False
                self.db.commit()
            else:
                self.db.delete(instance)
                self.db.commit()
            return True
        except Exception as e:
            self.db.rollback()
            self._handle_error("delete", e, id=id)
            raise

    def list(self, skip: int = 0, limit: int = 100) -> List[CRMAccount]:
        try:
            limit = min(limit, 1000)
            skip = max(skip, 0)
            return (
                self.db.query(self.model)
                .order_by(self.model.created_at.desc())
                .offset(skip)
                .limit(limit)
                .all()
            )
        except Exception as e:
            self._handle_error("list", e, skip=skip, limit=limit)
            raise


# ═══════════════════════════════════════
# CARİ HESAP (Account) İŞLEMLERİ
# ═══════════════════════════════════════

def list_accounts(
    db: Session, skip: int = 0, limit: int = 50,
    search: Optional[str] = None, is_active: Optional[bool] = None,
):
    q = db.query(CRMAccount)
    if search:
        pattern = f"%{search}%"
        q = q.filter(or_(
            CRMAccount.company_name.ilike(pattern),
            CRMAccount.tax_id.ilike(pattern),
            CRMAccount.phone.ilike(pattern),
            CRMAccount.email.ilike(pattern),
        ))
    if is_active is not None:
        q = q.filter(CRMAccount.is_active == is_active)
    total = q.count()
    items = q.order_by(CRMAccount.created_at.desc()).offset(skip).limit(limit).all()
    return items, total


def get_account(db: Session, account_id: str):
    return db.query(CRMAccount).options(
        joinedload(CRMAccount.contacts),
        joinedload(CRMAccount.opportunities),
    ).filter(CRMAccount.id == account_id).first()


def create_account(db: Session, data: dict, user_id: int) -> CRMAccount:
    account = CRMAccount(id=str(uuid4()), **data)
    db.add(account)
    create_audit_log(db, str(user_id), "CRM_ACCOUNT_CREATE", f"Cari oluşturuldu: {data.get('company_name')}")
    db.commit()
    db.refresh(account)
    return account


def update_account(db: Session, account_id: str, data: dict, user_id: int) -> Optional[CRMAccount]:
    account = db.query(CRMAccount).filter(CRMAccount.id == account_id).first()
    if not account:
        return None
    for k, v in data.items():
        if v is not None:
            setattr(account, k, v)
    create_audit_log(db, str(user_id), "CRM_ACCOUNT_UPDATE", f"Cari güncellendi: {account.company_name}")
    db.commit()
    db.refresh(account)
    return account


def delete_account(db: Session, account_id: str, user_id: int) -> bool:
    account = db.query(CRMAccount).filter(CRMAccount.id == account_id).first()
    if not account:
        return False
    account.is_active = False
    create_audit_log(db, str(user_id), "CRM_ACCOUNT_DELETE", f"Cari pasifleştirildi: {account.company_name}")
    db.commit()
    return True


# ═══════════════════════════════════════
# KONTAK (Contact) İŞLEMLERİ
# ═══════════════════════════════════════

def list_contacts(db: Session, account_id: Optional[str] = None, skip: int = 0, limit: int = 50):
    q = db.query(CRMContact)
    if account_id:
        q = q.filter(CRMContact.account_id == account_id)
    total = q.count()
    items = q.order_by(CRMContact.created_at.desc()).offset(skip).limit(limit).all()
    return items, total


def create_contact(db: Session, data: dict, user_id: int) -> CRMContact:
    contact = CRMContact(id=str(uuid4()), **data)
    db.add(contact)
    create_audit_log(db, str(user_id), "CRM_CONTACT_CREATE", f"Kişi oluşturuldu: {data.get('first_name')} {data.get('last_name')}")
    db.commit()
    db.refresh(contact)
    return contact


def update_contact(db: Session, contact_id: str, data: dict, user_id: int) -> Optional[CRMContact]:
    contact = db.query(CRMContact).filter(CRMContact.id == contact_id).first()
    if not contact:
        return None
    for k, v in data.items():
        if v is not None:
            setattr(contact, k, v)
    create_audit_log(db, str(user_id), "CRM_CONTACT_UPDATE", f"Kişi güncellendi: {contact.first_name} {contact.last_name}")
    db.commit()
    db.refresh(contact)
    return contact


# ═══════════════════════════════════════
# FIRSAT (Opportunity) İŞLEMLERİ
# ═══════════════════════════════════════

STAGE_ORDER = [
    OpportunityStageEnum.LEAD,
    OpportunityStageEnum.QUALIFIED,
    OpportunityStageEnum.PROPOSAL,
    OpportunityStageEnum.NEGOTIATION,
    OpportunityStageEnum.CLOSED_WON,
    OpportunityStageEnum.CLOSED_LOST,
]

STAGE_PROBABILITY = {
    OpportunityStageEnum.LEAD: 10,
    OpportunityStageEnum.QUALIFIED: 25,
    OpportunityStageEnum.PROPOSAL: 50,
    OpportunityStageEnum.NEGOTIATION: 75,
    OpportunityStageEnum.CLOSED_WON: 100,
    OpportunityStageEnum.CLOSED_LOST: 0,
}


def list_opportunities(
    db: Session, skip: int = 0, limit: int = 50,
    stage: Optional[str] = None, account_id: Optional[str] = None,
):
    q = db.query(CRMOpportunity).options(joinedload(CRMOpportunity.account))
    if stage:
        q = q.filter(CRMOpportunity.stage == stage)
    if account_id:
        q = q.filter(CRMOpportunity.account_id == account_id)
    total = q.count()
    items = q.order_by(CRMOpportunity.created_at.desc()).offset(skip).limit(limit).all()
    return items, total


def get_opportunity(db: Session, opp_id: str):
    return db.query(CRMOpportunity).options(
        joinedload(CRMOpportunity.account),
        joinedload(CRMOpportunity.quotes),
        joinedload(CRMOpportunity.activities),
        joinedload(CRMOpportunity.tasks),
    ).filter(CRMOpportunity.id == opp_id).first()


def create_opportunity(db: Session, data: dict, user_id: int) -> CRMOpportunity:
    stage = data.get("stage", OpportunityStageEnum.LEAD)
    if isinstance(stage, str):
        stage = OpportunityStageEnum(stage)
    data["stage"] = stage
    data["probability"] = data.get("probability", STAGE_PROBABILITY.get(stage, 10))
    opp = CRMOpportunity(id=str(uuid4()), owner_id=user_id, **data)
    db.add(opp)
    create_audit_log(db, str(user_id), "CRM_OPPORTUNITY_CREATE", f"Fırsat oluşturuldu: {data.get('title')}")
    db.commit()
    db.refresh(opp)
    return opp


def update_opportunity(db: Session, opp_id: str, data: dict, user_id: int) -> Optional[CRMOpportunity]:
    opp = db.query(CRMOpportunity).filter(CRMOpportunity.id == opp_id).first()
    if not opp:
        return None
    for k, v in data.items():
        if v is not None:
            if k == "stage" and isinstance(v, str):
                v = OpportunityStageEnum(v)
            setattr(opp, k, v)
    create_audit_log(db, str(user_id), "CRM_OPPORTUNITY_UPDATE", f"Fırsat güncellendi: {opp.title}")
    db.commit()
    db.refresh(opp)
    return opp


def transition_stage(db: Session, opp_id: str, new_stage: str, user_id: int, lost_reason: Optional[str] = None):
    """Pipeline aşaması geçişi — idempotent"""
    opp = db.query(CRMOpportunity).filter(CRMOpportunity.id == opp_id).first()
    if not opp:
        return None, "Fırsat bulunamadı"

    try:
        target = OpportunityStageEnum(new_stage)
    except ValueError:
        return None, f"Geçersiz aşama: {new_stage}"

    old_stage = opp.stage
    if old_stage == target:
        return opp, None  # Idempotent

    # Kapalı fırsatları tekrar açmaya izin verme
    if old_stage in (OpportunityStageEnum.CLOSED_WON, OpportunityStageEnum.CLOSED_LOST):
        return None, "Kapatılmış fırsat tekrar açılamaz"

    opp.stage = target
    opp.probability = STAGE_PROBABILITY.get(target, opp.probability)

    if target == OpportunityStageEnum.CLOSED_LOST:
        opp.lost_reason = lost_reason
        opp.actual_close_date = datetime.now(timezone.utc)
    elif target == OpportunityStageEnum.CLOSED_WON:
        opp.actual_close_date = datetime.now(timezone.utc)

    create_audit_log(
        db, str(user_id), "CRM_STAGE_TRANSITION",
        f"Fırsat aşama geçişi: {old_stage.value} → {target.value} | {opp.title}"
    )
    db.commit()
    db.refresh(opp)
    return opp, None


def convert_to_order(db: Session, opp_id: str, user_id: int):
    """Fırsatı siparişe dönüştür"""
    opp = db.query(CRMOpportunity).options(
        joinedload(CRMOpportunity.account)
    ).filter(CRMOpportunity.id == opp_id).first()
    if not opp:
        return None, "Fırsat bulunamadı"
    if opp.order_id:
        return None, "Bu fırsat zaten siparişe dönüştürülmüş"
    if opp.stage == OpportunityStageEnum.CLOSED_LOST:
        return None, "Kaybedilmiş fırsat siparişe dönüştürülemez"

    # Cari hesaptan müşteri bul/oluştur
    account = opp.account
    customer = None
    if account and account.customer_id:
        customer = db.query(Customer).filter(Customer.id == account.customer_id).first()
    if not customer and account:
        customer = Customer(name=account.company_name, phone=account.phone or "")
        db.add(customer)
        db.flush()
        account.customer_id = customer.id

    # Sipariş oluştur
    from app.services.order_service import OrderService
    ts_now = datetime.now(timezone.utc).strftime("%y%m%d%H%M%S")
    order = Order(
        customer_id=customer.id if customer else None,
        crm_name_snapshot=account.company_name if account else opp.title,
        ts_code=f"CRM-{ts_now}",
        status=OrderStatusEnum.NEW,
        created_by=user_id,
    )
    db.add(order)
    db.flush()

    # Fırsatı güncelle
    opp.order_id = order.id
    opp.stage = OpportunityStageEnum.CLOSED_WON
    opp.probability = 100
    opp.actual_close_date = datetime.now(timezone.utc)

    create_audit_log(
        db, str(user_id), "CRM_CONVERT_TO_ORDER",
        f"Fırsat siparişe dönüştürüldü: {opp.title} → Sipariş #{order.id}"
    )
    db.commit()
    db.refresh(order)
    db.refresh(opp)
    return {"opportunity": opp, "order": order}, None


# ═══════════════════════════════════════
# TEKLİF (Quote) İŞLEMLERİ
# ═══════════════════════════════════════

def _generate_quote_number(db: Session) -> str:
    count = db.query(sa_func.count(CRMQuote.id)).scalar() or 0
    return f"TKL-{datetime.now(timezone.utc).strftime('%Y%m')}-{count + 1:04d}"


def list_quotes(db: Session, skip: int = 0, limit: int = 50, account_id: Optional[str] = None, status: Optional[str] = None):
    q = db.query(CRMQuote).options(joinedload(CRMQuote.account))
    if account_id:
        q = q.filter(CRMQuote.account_id == account_id)
    if status:
        q = q.filter(CRMQuote.status == status)
    total = q.count()
    items = q.order_by(CRMQuote.created_at.desc()).offset(skip).limit(limit).all()
    return items, total


def get_quote(db: Session, quote_id: str):
    return db.query(CRMQuote).options(
        joinedload(CRMQuote.lines),
        joinedload(CRMQuote.account),
    ).filter(CRMQuote.id == quote_id).first()


def create_quote(db: Session, data: dict, lines: list, user_id: int) -> CRMQuote:
    quote_id = str(uuid4())
    quote = CRMQuote(
        id=quote_id,
        quote_number=_generate_quote_number(db),
        created_by_id=user_id,
        **{k: v for k, v in data.items() if k != "lines"},
    )
    db.add(quote)

    subtotal = 0
    for idx, line_data in enumerate(lines, 1):
        qty = line_data.get("quantity", 1)
        price = line_data.get("unit_price", 0)
        disc = line_data.get("discount_rate", 0)
        line_total = qty * price * (1 - disc / 100)
        line = CRMQuoteLine(
            id=str(uuid4()),
            quote_id=quote_id,
            line_number=idx,
            line_total=round(line_total, 2),
            **{k: v for k, v in line_data.items() if k not in ("line_total",)},
        )
        db.add(line)
        subtotal += line_total

    quote.subtotal = round(subtotal, 2)
    disc_amount = subtotal * (quote.discount_rate or 0) / 100
    quote.discount_amount = round(disc_amount, 2)
    taxable = subtotal - disc_amount
    quote.tax_amount = round(taxable * (quote.tax_rate or 20) / 100, 2)
    quote.total = round(taxable + quote.tax_amount, 2)

    create_audit_log(db, str(user_id), "CRM_QUOTE_CREATE", f"Teklif oluşturuldu: {quote.quote_number}")
    db.commit()
    db.refresh(quote)
    return quote


def revise_quote(db: Session, quote_id: str, user_id: int) -> Optional[CRMQuote]:
    """Mevcut teklifi REVISED yap, yeni revizyon oluştur"""
    old_quote = get_quote(db, quote_id)
    if not old_quote:
        return None

    old_quote.status = QuoteStatusEnum.REVISED
    new_rev = old_quote.revision + 1

    new_data = {
        "account_id": old_quote.account_id,
        "opportunity_id": old_quote.opportunity_id,
        "title": old_quote.title,
        "description": old_quote.description,
        "tax_rate": old_quote.tax_rate,
        "discount_rate": old_quote.discount_rate,
        "currency": old_quote.currency,
        "valid_until": old_quote.valid_until,
        "notes": old_quote.notes,
        "terms": old_quote.terms,
    }
    lines_data = []
    for ln in old_quote.lines:
        lines_data.append({
            "product_code": ln.product_code,
            "description": ln.description,
            "quantity": ln.quantity,
            "unit": ln.unit,
            "unit_price": ln.unit_price,
            "discount_rate": ln.discount_rate,
            "tax_rate": ln.tax_rate,
            "mikro_stok_kod": ln.mikro_stok_kod,
            "notes": ln.notes,
        })

    new_quote = create_quote(db, new_data, lines_data, user_id)
    new_quote.revision = new_rev
    db.commit()
    db.refresh(new_quote)
    return new_quote


# ═══════════════════════════════════════
# GÖREV + AKTİVİTE + NOT
# ═══════════════════════════════════════

def list_tasks(db: Session, skip: int = 0, limit: int = 50, status: Optional[str] = None, assigned_to: Optional[int] = None):
    q = db.query(CRMTask)
    if status:
        q = q.filter(CRMTask.status == status)
    if assigned_to:
        q = q.filter(CRMTask.assigned_to_id == assigned_to)
    total = q.count()
    items = q.order_by(CRMTask.due_date.asc().nullslast()).offset(skip).limit(limit).all()
    return items, total


def create_task(db: Session, data: dict, user_id: int) -> CRMTask:
    task = CRMTask(id=str(uuid4()), created_by_id=user_id, **data)
    db.add(task)
    create_audit_log(db, str(user_id), "CRM_TASK_CREATE", f"Görev oluşturuldu: {data.get('title')}")
    db.commit()
    db.refresh(task)
    return task


def update_task(db: Session, task_id: str, data: dict, user_id: int) -> Optional[CRMTask]:
    task = db.query(CRMTask).filter(CRMTask.id == task_id).first()
    if not task:
        return None
    for k, v in data.items():
        if v is not None:
            setattr(task, k, v)
    if task.status == TaskStatusEnum.DONE and not task.completed_at:
        task.completed_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(task)
    return task


def create_activity(db: Session, data: dict, user_id: int) -> CRMActivity:
    activity = CRMActivity(id=str(uuid4()), created_by_id=user_id, **data)
    db.add(activity)
    create_audit_log(db, str(user_id), "CRM_ACTIVITY_CREATE", f"Aktivite: {data.get('subject')}")
    db.commit()
    db.refresh(activity)
    return activity


def list_activities(db: Session, opportunity_id: Optional[str] = None, account_id: Optional[str] = None, skip: int = 0, limit: int = 50):
    q = db.query(CRMActivity)
    if opportunity_id:
        q = q.filter(CRMActivity.opportunity_id == opportunity_id)
    if account_id:
        q = q.filter(CRMActivity.account_id == account_id)
    total = q.count()
    items = q.order_by(CRMActivity.created_at.desc()).offset(skip).limit(limit).all()
    return items, total


def create_note(db: Session, data: dict, user_id: int) -> CRMNote:
    note = CRMNote(id=str(uuid4()), created_by_id=user_id, **data)
    db.add(note)
    db.commit()
    db.refresh(note)
    return note


def list_notes(db: Session, entity_type: str, entity_id: str):
    return db.query(CRMNote).filter(
        CRMNote.entity_type == entity_type,
        CRMNote.entity_id == entity_id,
    ).order_by(CRMNote.created_at.desc()).all()


# ═══════════════════════════════════════
# DASHBOARD / İSTATİSTİKLER
# ═══════════════════════════════════════

def get_crm_stats(db: Session) -> dict:
    total_accounts = db.query(sa_func.count(CRMAccount.id)).filter(CRMAccount.is_active == True).scalar() or 0
    total_opportunities = db.query(sa_func.count(CRMOpportunity.id)).scalar() or 0
    open_opportunities = db.query(sa_func.count(CRMOpportunity.id)).filter(
        CRMOpportunity.stage.notin_([OpportunityStageEnum.CLOSED_WON, OpportunityStageEnum.CLOSED_LOST])
    ).scalar() or 0
    pipeline_value = db.query(sa_func.coalesce(sa_func.sum(CRMOpportunity.amount), 0)).filter(
        CRMOpportunity.stage.notin_([OpportunityStageEnum.CLOSED_WON, OpportunityStageEnum.CLOSED_LOST])
    ).scalar() or 0
    won_count = db.query(sa_func.count(CRMOpportunity.id)).filter(
        CRMOpportunity.stage == OpportunityStageEnum.CLOSED_WON
    ).scalar() or 0
    total_quotes = db.query(sa_func.count(CRMQuote.id)).scalar() or 0
    pending_tasks = db.query(sa_func.count(CRMTask.id)).filter(
        CRMTask.status.in_([TaskStatusEnum.TODO, TaskStatusEnum.IN_PROGRESS])
    ).scalar() or 0

    # Pipeline dağılımı
    pipeline = {}
    for stage in OpportunityStageEnum:
        cnt = db.query(sa_func.count(CRMOpportunity.id)).filter(CRMOpportunity.stage == stage).scalar() or 0
        val = db.query(sa_func.coalesce(sa_func.sum(CRMOpportunity.amount), 0)).filter(CRMOpportunity.stage == stage).scalar() or 0
        pipeline[stage.value] = {"count": cnt, "value": float(val)}

    return {
        "total_accounts": total_accounts,
        "total_opportunities": total_opportunities,
        "open_opportunities": open_opportunities,
        "pipeline_value": float(pipeline_value),
        "won_count": won_count,
        "total_quotes": total_quotes,
        "pending_tasks": pending_tasks,
        "pipeline": pipeline,
    }

# ═══════════════════════════════════════
# YÖNETİCİ / OPERATÖR BİLET (TICKET) İŞLEMLERİ
# ═══════════════════════════════════════

def list_tickets(db: Session, skip: int = 0, limit: int = 50, status: Optional[str] = None, account_id: Optional[str] = None):
    q = db.query(CRMTicket).options(joinedload(CRMTicket.account))
    
    if status:
        q = q.filter(CRMTicket.status == status.upper())
    if account_id:
        q = q.filter(CRMTicket.account_id == account_id)
        
    total = q.count()
    items = q.order_by(CRMTicket.updated_at.desc()).offset(skip).limit(limit).all()
    
    for item in items:
        # Schema mapping yardimi icin properties
        if hasattr(item, 'account') and item.account:
            item.account_name = item.account.company_name
            
    return items, total

def get_ticket(db: Session, ticket_id: str):
    ticket = db.query(CRMTicket).options(
        joinedload(CRMTicket.account),
        joinedload(CRMTicket.messages).joinedload(CRMTicketMessage.sender)
    ).filter(CRMTicket.id == ticket_id).first()
    
    if ticket:
        if hasattr(ticket, 'account') and ticket.account:
            ticket.account_name = ticket.account.company_name
            
        for msg in ticket.messages:
            if hasattr(msg, 'sender') and msg.sender:
                msg.sender_name = msg.sender.display_name or msg.sender.username
                
    return ticket

def reply_ticket(db: Session, ticket_id: str, message: str, user, is_internal: bool = False):
    ticket = db.query(CRMTicket).filter(CRMTicket.id == ticket_id).first()
    if not ticket:
        return None
        
    msg_id = str(uuid4())
    new_message = CRMTicketMessage(
        id=msg_id,
        ticket_id=ticket.id,
        sender_id=user.id,
        message=message,
        is_internal=is_internal
    )
    db.add(new_message)
    
    ticket.updated_at = sa_func.now()
    if ticket.status == "OPEN" and not is_internal:
        ticket.status = "IN_PROGRESS"
        
    db.commit()
    db.refresh(new_message)
    
    new_message.sender_name = user.display_name or user.username

    # Müşteriye E-posta Gönderimi (Eğer yanıt iç not değilse ve operatör yanıtladıysa)
    if not is_internal and ticket.created_by_id and user.id != ticket.created_by_id:
        try:
            creator_user = db.query(User).filter(User.id == ticket.created_by_id).first()
            if creator_user and creator_user.email:
                email_service.send_ticket_reply(
                    to_email=creator_user.email,
                    username=creator_user.display_name or creator_user.username,
                    subject=ticket.subject,
                    reply_message=message
                )
        except Exception as e:
            print(f"Bilet yaniti email gonderilemedi: {e}")
            
    return new_message

def update_ticket_status(db: Session, ticket_id: str, status: str, assigned_to_id: Optional[int], user_id: int):
    ticket = db.query(CRMTicket).filter(CRMTicket.id == ticket_id).first()
    if not ticket:
        return None
        
    old_status = ticket.status
    ticket.status = status.upper()
    
    if assigned_to_id:
        ticket.assigned_to_id = assigned_to_id
        
    ticket.updated_at = sa_func.now()
    
    create_audit_log(
        db, str(user_id), "CRM_TICKET_UPDATE", 
        f"Destek bilet güncellendi: {old_status} -> {ticket.status} | {ticket.subject}"
    )
    
    db.commit()
    db.refresh(ticket)
    return get_ticket(db, ticket.id)
