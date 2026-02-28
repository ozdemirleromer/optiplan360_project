"""
Tahsilat Yönetimi API Router
"""

from datetime import datetime
from typing import List, Optional

from app.auth import require_permissions
from app.database import get_db
from app.exceptions import BusinessRuleError, NotFoundError
from app.models import (
    PaymentMethodEnum,
    PaymentStatusEnum,
    ReminderTypeEnum,
    User,
)
from app.permissions import Permission
from app.services import payment_service
from app.utils import create_audit_log
from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session

router = APIRouter(prefix="/api/v1/payments", tags=["Tahsilat"])


# ══════════════════════════════════════════════════════════════
# PYDANTIC SCHEMAS
# ══════════════════════════════════════════════════════════════


class InvoiceCreate(BaseModel):
    account_id: str
    order_id: Optional[int] = None
    quote_id: Optional[str] = None
    subtotal: float
    tax_rate: float = 20.0
    discount_amount: float = 0.0
    total_amount: float
    due_date: Optional[datetime] = None
    invoice_type: str = "SALES"
    notes: Optional[str] = None
    # Ödeme Hatırlatıcısı Bilgileri
    reminder_type: Optional[ReminderTypeEnum] = None
    next_reminder_date: Optional[datetime] = None


class InvoiceOut(BaseModel):
    id: str
    invoice_number: str
    invoice_type: str
    account_id: str
    order_id: Optional[int] = None
    quote_id: Optional[str] = None
    subtotal: float
    tax_amount: float
    discount_amount: float
    total_amount: float
    paid_amount: float
    remaining_amount: float
    status: str
    issue_date: datetime
    due_date: Optional[datetime] = None
    payment_completed_at: Optional[datetime] = None
    notes: Optional[str] = None
    # Ödeme Hatırlatıcısı Bilgileri
    reminder_type: Optional[str] = None
    reminder_sent: bool
    reminder_sent_at: Optional[datetime] = None
    reminder_status: Optional[str] = None
    next_reminder_date: Optional[datetime] = None
    reminder_count: int
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class PaymentCreate(BaseModel):
    invoice_id: str
    account_id: str
    payment_method: PaymentMethodEnum
    amount: float
    payment_date: Optional[datetime] = None
    check_number: Optional[str] = None
    check_date: Optional[datetime] = None
    check_bank: Optional[str] = None
    card_last_4: Optional[str] = None
    transaction_ref: Optional[str] = None
    notes: Optional[str] = None


class PaymentOut(BaseModel):
    id: str
    payment_number: str
    invoice_id: str
    account_id: str
    payment_method: str
    amount: float
    payment_date: datetime
    check_number: Optional[str] = None
    check_date: Optional[datetime] = None
    check_bank: Optional[str] = None
    card_last_4: Optional[str] = None
    transaction_ref: Optional[str] = None
    notes: Optional[str] = None
    is_cancelled: bool
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class PaymentPromiseCreate(BaseModel):
    invoice_id: str
    account_id: str
    promised_amount: float
    promise_date: datetime
    payment_method: Optional[PaymentMethodEnum] = None
    contact_person: Optional[str] = None
    contact_note: Optional[str] = None
    notes: Optional[str] = None


class PaymentPromiseOut(BaseModel):
    id: str
    invoice_id: str
    account_id: str
    promised_amount: float
    promise_date: datetime
    payment_method: Optional[str] = None
    status: str
    is_fulfilled: bool
    fulfilled_at: Optional[datetime] = None
    fulfilled_payment_id: Optional[str] = None
    reminder_sent: bool
    reminder_sent_at: Optional[datetime] = None
    contact_person: Optional[str] = None
    contact_note: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class PaymentPromiseStatusUpdate(BaseModel):
    status: str
    notes: Optional[str] = None


# ══════════════════════════════════════════════════════════════
# FATURA ENDPOINTLERİ
# ══════════════════════════════════════════════════════════════


@router.post("/invoices", response_model=InvoiceOut)
def create_invoice(
    data: InvoiceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permissions(Permission.PAYMENT_CREATE)),
):
    """Yeni fatura oluştur"""
    try:
        invoice = payment_service.create_invoice(
            db=db,
            account_id=data.account_id,
            order_id=data.order_id,
            quote_id=data.quote_id,
            subtotal=data.subtotal,
            tax_rate=data.tax_rate,
            discount_amount=data.discount_amount,
            total_amount=data.total_amount,
            due_date=data.due_date,
            invoice_type=data.invoice_type,
            notes=data.notes,
            user_id=current_user.id,
            # Ödeme Hatırlatıcısı Bilgileri
            reminder_type=data.reminder_type,
            next_reminder_date=data.next_reminder_date,
        )
        create_audit_log(
            db,
            str(current_user.id),
            "CREATE_INVOICE",
            f"Fatura oluşturuldu: {invoice.invoice_number}, tutar={invoice.total_amount}",
        )
        return invoice
    except Exception as e:
        raise BusinessRuleError(str(e))


@router.get("/invoices", response_model=List[InvoiceOut])
def list_invoices(
    account_id: Optional[str] = None,
    status: Optional[PaymentStatusEnum] = None,
    overdue_only: bool = False,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permissions(Permission.PAYMENT_VIEW)),
):
    """Fatura listesi"""
    return payment_service.list_invoices(
        db=db,
        account_id=account_id,
        status=status,
        overdue_only=overdue_only,
        skip=skip,
        limit=limit,
    )


@router.get("/invoices/{invoice_id}", response_model=InvoiceOut)
def get_invoice(
    invoice_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permissions(Permission.PAYMENT_VIEW)),
):
    """Fatura detayı"""
    invoice = payment_service.get_invoice(db, invoice_id)
    if not invoice:
        raise NotFoundError("Fatura")
    return invoice


@router.put("/invoices/{invoice_id}", response_model=InvoiceOut)
def update_invoice(
    invoice_id: str,
    data: InvoiceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permissions(Permission.PAYMENT_EDIT)),
):
    """Fatura güncelle"""
    try:
        invoice = payment_service.get_invoice(db, invoice_id)
        if not invoice:
            raise NotFoundError("Fatura")

        # Update invoice fields
        invoice.account_id = data.account_id
        if data.order_id is not None:
            invoice.order_id = data.order_id
        if data.quote_id is not None:
            invoice.quote_id = data.quote_id
        invoice.subtotal = data.subtotal
        invoice.tax_amount = data.subtotal * (data.tax_rate / 100)
        invoice.discount_amount = data.discount_amount
        invoice.total_amount = data.total_amount
        invoice.due_date = data.due_date
        invoice.invoice_type = data.invoice_type
        invoice.notes = data.notes

        # Update reminder fields
        if data.reminder_type:
            invoice.reminder_type = data.reminder_type
        if data.next_reminder_date:
            invoice.next_reminder_date = data.next_reminder_date

        db.commit()
        db.refresh(invoice)
        create_audit_log(
            db, str(current_user.id), "UPDATE_INVOICE", f"Fatura güncellendi: {invoice_id}"
        )
        return invoice
    except Exception as e:
        db.rollback()
        raise BusinessRuleError(str(e))


@router.delete("/invoices/{invoice_id}")
def delete_invoice(
    invoice_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permissions(Permission.PAYMENT_EDIT)),
):
    """Fatura sil"""
    try:
        invoice = payment_service.get_invoice(db, invoice_id)
        if not invoice:
            raise NotFoundError("Fatura")

        invoice_number = invoice.invoice_number
        db.delete(invoice)
        db.commit()
        create_audit_log(
            db,
            str(current_user.id),
            "DELETE_INVOICE",
            f"Fatura silindi: {invoice_number} (id={invoice_id})",
        )
        return {"status": "success", "message": "Fatura silindi"}
    except Exception as e:
        db.rollback()
        raise BusinessRuleError(str(e))


# ══════════════════════════════════════════════════════════════
# ÖDEME ENDPOINTLERİ
# ══════════════════════════════════════════════════════════════


@router.post("/payments", response_model=PaymentOut)
def create_payment(
    data: PaymentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permissions(Permission.PAYMENT_CREATE)),
):
    """Yeni ödeme kaydı"""
    try:
        payment = payment_service.create_payment(
            db=db,
            invoice_id=data.invoice_id,
            account_id=data.account_id,
            payment_method=data.payment_method,
            amount=data.amount,
            payment_date=data.payment_date,
            check_number=data.check_number,
            check_date=data.check_date,
            check_bank=data.check_bank,
            card_last_4=data.card_last_4,
            transaction_ref=data.transaction_ref,
            notes=data.notes,
            user_id=current_user.id,
        )
        return payment
    except Exception as e:
        raise BusinessRuleError(str(e))


@router.get("/payments", response_model=List[PaymentOut])
def list_payments(
    invoice_id: Optional[str] = None,
    account_id: Optional[str] = None,
    payment_method: Optional[PaymentMethodEnum] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permissions(Permission.PAYMENT_VIEW)),
):
    """Ödeme listesi"""
    return payment_service.list_payments(
        db=db,
        invoice_id=invoice_id,
        account_id=account_id,
        payment_method=payment_method,
        skip=skip,
        limit=limit,
    )


@router.post("/payments/{payment_id}/cancel", response_model=PaymentOut)
def cancel_payment(
    payment_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permissions(Permission.PAYMENT_EDIT)),
):
    """Ödemeyi iptal et"""
    try:
        return payment_service.cancel_payment(db, payment_id, current_user.id)
    except Exception as e:
        raise BusinessRuleError(str(e))


# ══════════════════════════════════════════════════════════════
# ÖDEME SÖZÜ ENDPOINTLERİ
# ══════════════════════════════════════════════════════════════


@router.post("/promises", response_model=PaymentPromiseOut)
def create_payment_promise(
    data: PaymentPromiseCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permissions(Permission.PAYMENT_CREATE)),
):
    """Yeni ödeme sözü oluştur"""
    try:
        promise = payment_service.create_payment_promise(
            db=db,
            invoice_id=data.invoice_id,
            account_id=data.account_id,
            promised_amount=data.promised_amount,
            promise_date=data.promise_date,
            payment_method=data.payment_method,
            contact_person=data.contact_person,
            contact_note=data.contact_note,
            notes=data.notes,
            user_id=current_user.id,
        )
        return promise
    except Exception as e:
        raise BusinessRuleError(str(e))


@router.get("/promises", response_model=List[PaymentPromiseOut])
def list_payment_promises(
    invoice_id: Optional[str] = None,
    account_id: Optional[str] = None,
    status: Optional[str] = None,
    overdue_only: bool = False,
    today_only: bool = False,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permissions(Permission.PAYMENT_VIEW)),
):
    """Ödeme sözü listesi"""
    return payment_service.list_payment_promises(
        db=db,
        invoice_id=invoice_id,
        account_id=account_id,
        status=status,
        overdue_only=overdue_only,
        today_only=today_only,
        skip=skip,
        limit=limit,
    )


@router.put("/promises/{promise_id}", response_model=PaymentPromiseOut)
def update_payment_promise_status(
    promise_id: str,
    data: PaymentPromiseStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permissions(Permission.PAYMENT_EDIT)),
):
    """Ödeme sözü durumu güncelle"""
    try:
        return payment_service.update_payment_promise_status(
            db=db, promise_id=promise_id, status=data.status, notes=data.notes
        )
    except Exception as e:
        raise BusinessRuleError(str(e))


@router.post("/promises/{promise_id}/remind", response_model=PaymentPromiseOut)
def send_payment_reminder(
    promise_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permissions(Permission.PAYMENT_EDIT)),
):
    """Ödeme sözü hatırlatması gönder"""
    try:
        return payment_service.send_payment_reminder(db, promise_id)
    except Exception as e:
        raise BusinessRuleError(str(e))


# ══════════════════════════════════════════════════════════════
# İSTATİSTİK VE RAPOR ENDPOINTLERİ
# ══════════════════════════════════════════════════════════════


@router.get("/statistics")
def get_payment_statistics(
    account_id: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permissions(Permission.PAYMENT_VIEW)),
):
    """Tahsilat istatistikleri"""
    return payment_service.get_payment_statistics(db, account_id)


@router.get("/aging-report")
def get_aging_report(
    account_id: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permissions(Permission.PAYMENT_VIEW)),
):
    """Yaşlandırma raporu"""
    return payment_service.get_aging_report(db, account_id)
