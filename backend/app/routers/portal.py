import uuid
from typing import List, Optional

from app.auth import get_current_user
from app.database import get_db
from app.models.core import User
from app.models.crm import CRMAccount, CRMTicket, CRMTicketMessage
from app.models.finance import Invoice
from app.models.order import Order
from app.schemas import (
    PortalDashboardStats,
    PortalInvoiceOut,
    PortalOrderOut,
    PortalTicketCreate,
    PortalTicketMessageOut,
    PortalTicketOut,
    PortalTicketReply,
)
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func
from sqlalchemy.orm import Session

router = APIRouter(prefix="/api/v1/portal", tags=["Customer Portal"])


def get_current_customer(current_user: User = Depends(get_current_user)) -> User:
    """Oturum açan kullanıcının bir müşteri (CUSTOMER) hesabı olduğunu doğrular"""
    if current_user.role.upper() != "CUSTOMER":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bu alana sadece müşteri kullanıcıları erişebilir.",
        )
    if not current_user.crm_account_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Kullanıcı hesabınıza tanımlı bir şirket (CRM Account) bulunamadı.",
        )
    return current_user


@router.get("/dashboard", response_model=PortalDashboardStats)
def get_customer_dashboard_stats(
    current_user: User = Depends(get_current_customer), db: Session = Depends(get_db)
):
    """Müşteri portalı ana ekran istatistiklerini getirir."""
    # Siparişleri bulalım
    active_orders = (
        db.query(Order)
        .filter(
            Order.crm_account_id == current_user.crm_account_id,
            Order.status.in_(["NEW", "IN_PRODUCTION", "READY"]),
        )
        .count()
    )

    completed_orders = (
        db.query(Order)
        .filter(Order.crm_account_id == current_user.crm_account_id, Order.status == "COMPLETED")
        .count()
    )

    # Firmaya ait güncel bakiyeyi çekelim (Mikro entegrasyonu varsa balance alanı)
    crm_account = db.query(CRMAccount).filter(CRMAccount.id == current_user.crm_account_id).first()
    balance = crm_account.balance if crm_account and crm_account.balance else 0.0

    return PortalDashboardStats(
        active_orders_count=active_orders,
        completed_orders_count=completed_orders,
        total_balance=balance,
        currency="TRY",
    )


@router.get("/orders", response_model=List[PortalOrderOut])
def get_customer_orders(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    status_filter: Optional[str] = None,
    current_user: User = Depends(get_current_customer),
    db: Session = Depends(get_db),
):
    """Sadece müşteriye ait olan geçmiş ve aktif siparişleri listeler."""
    query = db.query(Order).filter(Order.crm_account_id == current_user.crm_account_id)

    if status_filter:
        query = query.filter(Order.status == status_filter.upper())

    orders = query.order_by(Order.created_at.desc()).offset(skip).limit(limit).all()

    result = []
    for o in orders:
        result.append(
            PortalOrderOut(
                id=str(o.id),
                status=o.status,
                thickness_mm=o.thickness_mm,
                color=o.color,
                material_name=o.material_name,
                created_at=o.created_at,
                updated_at=o.updated_at,
                total_parts=len(o.lines) if hasattr(o, "lines") else 0,
            )
        )

    return result


@router.get("/invoices", response_model=List[PortalInvoiceOut])
def get_customer_invoices(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    is_paid: Optional[bool] = None,
    current_user: User = Depends(get_current_customer),
    db: Session = Depends(get_db),
):
    """Müşterinin geçmiş faturalarını listeler."""
    query = db.query(Invoice).filter(Invoice.crm_account_id == current_user.crm_account_id)

    if is_paid is not None:
        status_val = "PAID" if is_paid else "UNPAID"  # PARTIAL durumları basite indirgenmiştir
        query = query.filter(Invoice.status == status_val)

    invoices = query.order_by(Invoice.issue_date.desc()).offset(skip).limit(limit).all()

    result = []
    for inv in invoices:
        result.append(
            PortalInvoiceOut(
                id=inv.id,
                invoice_number=inv.invoice_number,
                issue_date=inv.issue_date,
                due_date=inv.due_date,
                total_amount=inv.total_amount,
                currency=inv.currency,
                status=inv.status,
                pdf_url=inv.pdf_url,
            )
        )

    return result


@router.get("/tickets", response_model=List[PortalTicketOut])
def get_customer_tickets(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    status_filter: Optional[str] = None,
    current_user: User = Depends(get_current_customer),
    db: Session = Depends(get_db),
):
    """Müşterinin destek taleplerini listeler."""
    query = db.query(CRMTicket).filter(CRMTicket.account_id == current_user.crm_account_id)

    if status_filter:
        query = query.filter(CRMTicket.status == status_filter.upper())

    tickets = query.order_by(CRMTicket.updated_at.desc()).offset(skip).limit(limit).all()

    # Basit liste dönüşünde mesajları doldurmaya gerek yok ama şema uyumu için boş veya dolu gönderebiliriz.
    result = []
    for t in tickets:
        result.append(PortalTicketOut.model_validate(t))
    return result


@router.post("/tickets", response_model=PortalTicketOut)
def create_customer_ticket(
    payload: PortalTicketCreate,
    current_user: User = Depends(get_current_customer),
    db: Session = Depends(get_db),
):
    """Yeni bir destek talebi (Ticket) oluşturur."""
    ticket_id = str(uuid.uuid4())
    new_ticket = CRMTicket(
        id=ticket_id,
        account_id=current_user.crm_account_id,
        subject=payload.subject,
        description=payload.description,
        status="OPEN",
        priority=payload.priority.upper(),
        created_by_id=current_user.id,
    )
    db.add(new_ticket)
    db.commit()
    db.refresh(new_ticket)

    return PortalTicketOut.model_validate(new_ticket)


@router.get("/tickets/{ticket_id}", response_model=PortalTicketOut)
def get_customer_ticket_detail(
    ticket_id: str,
    current_user: User = Depends(get_current_customer),
    db: Session = Depends(get_db),
):
    """Destek talebinin detayını ve tüm mesajlaşma geçmişini getirir."""
    ticket = (
        db.query(CRMTicket)
        .filter(CRMTicket.id == ticket_id, CRMTicket.account_id == current_user.crm_account_id)
        .first()
    )

    if not ticket:
        raise HTTPException(status_code=404, detail="Destek talebi bulunamadı.")

    return PortalTicketOut.model_validate(ticket)


@router.post("/tickets/{ticket_id}/reply", response_model=PortalTicketMessageOut)
def reply_to_ticket(
    ticket_id: str,
    payload: PortalTicketReply,
    current_user: User = Depends(get_current_customer),
    db: Session = Depends(get_db),
):
    """Destek talebine müşteri tarafından yeni bir yanıt ekler."""
    ticket = (
        db.query(CRMTicket)
        .filter(CRMTicket.id == ticket_id, CRMTicket.account_id == current_user.crm_account_id)
        .first()
    )

    if not ticket:
        raise HTTPException(status_code=404, detail="Destek talebi bulunamadı.")

    msg_id = str(uuid.uuid4())
    new_message = CRMTicketMessage(
        id=msg_id,
        ticket_id=ticket.id,
        sender_id=current_user.id,
        message=payload.message,
        is_internal=False,
    )
    db.add(new_message)

    # Yeni mesaj eklenince ticket'ı operatör görsün diye güncelleyelim.
    if ticket.status == "CLOSED":
        ticket.status = "OPEN"

    ticket.updated_at = func.now()

    db.commit()
    db.refresh(new_message)

    # Sender_name doldurmak için manuel dönüş:
    # PortalTicketMessageOut şemasına uyduruyoruz
    return PortalTicketMessageOut(
        id=new_message.id,
        ticket_id=new_message.ticket_id,
        sender_id=new_message.sender_id,
        sender_name=current_user.display_name or current_user.username,
        message=new_message.message,
        created_at=new_message.created_at,
    )
