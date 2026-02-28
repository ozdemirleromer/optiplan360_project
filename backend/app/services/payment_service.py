"""
Tahsilat Yönetimi Servisi
- Fatura yönetimi
- Ödeme kayıt ve takibi
- Ödeme sözü takibi
- Vade kontrolleri
"""

from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional
from uuid import uuid4

from app.models import (
    Invoice,
    Payment,
    PaymentMethodEnum,
    PaymentPromise,
    PaymentStatusEnum,
    ReminderStatusEnum,
    ReminderTypeEnum,
)
from app.services.base_service import BaseService
from sqlalchemy import and_, func, or_
from sqlalchemy.orm import Session


class PaymentService(BaseService[Invoice]):
    """Fatura odakli CRUD servis katmani."""

    def __init__(self, db: Session):
        super().__init__(db, Invoice)

    def get_by_id(self, id: str) -> Optional[Invoice]:
        """Fatura detayini getir."""
        try:
            return self.db.query(self.model).filter(self.model.id == id).first()
        except Exception as e:
            self._handle_error("get_by_id", e, id=id)
            raise

    def create(self, data: Dict[str, Any]) -> Invoice:
        """Fatura kaydi olustur."""
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

    def update(self, id: str, data: Dict[str, Any]) -> Optional[Invoice]:
        """Fatura kaydini guncelle."""
        try:
            instance = self.get_by_id(id)
            if not instance:
                return None

            for key, value in data.items():
                if hasattr(instance, key):
                    setattr(instance, key, value)

            self.db.commit()
            self.db.refresh(instance)
            return instance
        except Exception as e:
            self.db.rollback()
            self._handle_error("update", e, id=id, data=data)
            raise

    def delete(self, id: str) -> bool:
        """Fatura kaydini sil."""
        try:
            instance = self.get_by_id(id)
            if not instance:
                return False

            self.db.delete(instance)
            self.db.commit()
            return True
        except Exception as e:
            self.db.rollback()
            self._handle_error("delete", e, id=id)
            raise

    def list(self, skip: int = 0, limit: int = 100) -> List[Invoice]:
        """Fatura kayitlarini sayfali listele."""
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


# ══════════════════════════════════════════════════════════════
# FATURA YÖNETİMİ
# ══════════════════════════════════════════════════════════════


def create_invoice(
    db: Session,
    account_id: str,
    order_id: Optional[int],
    quote_id: Optional[str],
    subtotal: float,
    tax_rate: float,
    discount_amount: float,
    total_amount: float,
    due_date: Optional[datetime],
    invoice_type: str = "SALES",
    notes: Optional[str] = None,
    user_id: Optional[int] = None,
    # Ödeme Hatırlatıcısı Bilgileri
    reminder_type: Optional[ReminderTypeEnum] = None,
    next_reminder_date: Optional[datetime] = None,
) -> Invoice:
    """Yeni fatura oluştur"""

    # Fatura numarası generate et
    invoice_count = db.query(Invoice).count() + 1
    invoice_number = f"INV-{datetime.now().year}-{invoice_count:05d}"

    tax_amount = (subtotal - discount_amount) * (tax_rate / 100)
    remaining_amount = total_amount

    invoice = Invoice(
        id=str(uuid4()),
        invoice_number=invoice_number,
        invoice_type=invoice_type,
        account_id=account_id,
        order_id=order_id,
        quote_id=quote_id,
        subtotal=subtotal,
        tax_rate=tax_rate,
        tax_amount=tax_amount,
        discount_amount=discount_amount,
        total_amount=total_amount,
        paid_amount=0.0,
        remaining_amount=remaining_amount,
        status=PaymentStatusEnum.PENDING,
        due_date=due_date,
        notes=notes,
        created_by_id=user_id,
        # Ödeme Hatırlatıcısı Bilgileri
        reminder_type=reminder_type,
        reminder_status=ReminderStatusEnum.PENDING if reminder_type else None,
        next_reminder_date=next_reminder_date,
        reminder_count=0,
        reminder_sent=False,
    )

    db.add(invoice)
    db.commit()
    db.refresh(invoice)
    return invoice


def get_invoice(db: Session, invoice_id: str) -> Optional[Invoice]:
    """Fatura detayı getir"""
    return db.query(Invoice).filter(Invoice.id == invoice_id).first()


def list_invoices(
    db: Session,
    account_id: Optional[str] = None,
    status: Optional[PaymentStatusEnum] = None,
    overdue_only: bool = False,
    skip: int = 0,
    limit: int = 100,
) -> List[Invoice]:
    """Fatura listesi"""
    query = db.query(Invoice)

    if account_id:
        query = query.filter(Invoice.account_id == account_id)

    if status:
        query = query.filter(Invoice.status == status)

    if overdue_only:
        query = query.filter(
            and_(Invoice.status != PaymentStatusEnum.PAID, Invoice.due_date < datetime.now())
        )

    return query.order_by(Invoice.created_at.desc()).offset(skip).limit(limit).all()


def update_invoice_status(db: Session, invoice: Invoice) -> Invoice:
    """Fatura durumunu ödemelere göre güncelle"""

    if invoice.paid_amount >= invoice.total_amount:
        invoice.status = PaymentStatusEnum.PAID
        invoice.remaining_amount = 0.0
        invoice.payment_completed_at = datetime.now()
    elif invoice.paid_amount > 0:
        invoice.status = PaymentStatusEnum.PARTIAL
        invoice.remaining_amount = invoice.total_amount - invoice.paid_amount
    else:
        # Vade kontrolü
        if invoice.due_date and invoice.due_date < datetime.now():
            invoice.status = PaymentStatusEnum.OVERDUE
        else:
            invoice.status = PaymentStatusEnum.PENDING
        invoice.remaining_amount = invoice.total_amount

    db.commit()
    db.refresh(invoice)
    return invoice


# ══════════════════════════════════════════════════════════════
# ÖDEME YÖNETİMİ
# ══════════════════════════════════════════════════════════════


def create_payment(
    db: Session,
    invoice_id: str,
    account_id: str,
    payment_method: PaymentMethodEnum,
    amount: float,
    payment_date: Optional[datetime] = None,
    check_number: Optional[str] = None,
    check_date: Optional[datetime] = None,
    check_bank: Optional[str] = None,
    card_last_4: Optional[str] = None,
    transaction_ref: Optional[str] = None,
    notes: Optional[str] = None,
    user_id: Optional[int] = None,
) -> Payment:
    """Yeni ödeme kaydı oluştur ve faturayı güncelle"""

    # Fatura kontrolü
    invoice = get_invoice(db, invoice_id)
    if not invoice:
        raise ValueError("Fatura bulunamadı")

    # Ödeme numarası generate et
    payment_count = db.query(Payment).count() + 1
    payment_number = f"PAY-{datetime.now().year}-{payment_count:05d}"

    payment = Payment(
        id=str(uuid4()),
        payment_number=payment_number,
        invoice_id=invoice_id,
        account_id=account_id,
        payment_method=payment_method,
        amount=amount,
        payment_date=payment_date or datetime.now(),
        check_number=check_number,
        check_date=check_date,
        check_bank=check_bank,
        card_last_4=card_last_4,
        transaction_ref=transaction_ref,
        notes=notes,
        created_by_id=user_id,
    )

    db.add(payment)

    # Fatura ödeme tutarını güncelle
    invoice.paid_amount += amount
    update_invoice_status(db, invoice)

    # Ödeme sözünü güncelle (varsa)
    promise = (
        db.query(PaymentPromise)
        .filter(and_(PaymentPromise.invoice_id == invoice_id, PaymentPromise.status == "PENDING"))
        .first()
    )

    if promise:
        promise.is_fulfilled = True
        promise.fulfilled_at = datetime.now()
        promise.fulfilled_payment_id = payment.id
        promise.status = "KEPT"

    db.commit()
    db.refresh(payment)
    return payment


def cancel_payment(db: Session, payment_id: str, user_id: Optional[int] = None) -> Payment:
    """Ödemeyi iptal et ve faturayı güncelle"""
    payment = db.query(Payment).filter(Payment.id == payment_id).first()
    if not payment or payment.is_cancelled:
        raise ValueError("Ödeme bulunamadı veya zaten iptal edilmiş")

    payment.is_cancelled = True
    payment.cancelled_at = datetime.now()

    # Fatura ödeme tutarını düşür
    invoice = payment.invoice
    invoice.paid_amount -= payment.amount
    update_invoice_status(db, invoice)

    db.commit()
    db.refresh(payment)
    return payment


def list_payments(
    db: Session,
    invoice_id: Optional[str] = None,
    account_id: Optional[str] = None,
    payment_method: Optional[PaymentMethodEnum] = None,
    skip: int = 0,
    limit: int = 100,
) -> List[Payment]:
    """Ödeme listesi"""
    query = db.query(Payment).filter(Payment.is_cancelled == False)

    if invoice_id:
        query = query.filter(Payment.invoice_id == invoice_id)

    if account_id:
        query = query.filter(Payment.account_id == account_id)

    if payment_method:
        query = query.filter(Payment.payment_method == payment_method)

    return query.order_by(Payment.payment_date.desc()).offset(skip).limit(limit).all()


# ══════════════════════════════════════════════════════════════
# ÖDEME SÖZÜ TAKİBİ
# ══════════════════════════════════════════════════════════════


def create_payment_promise(
    db: Session,
    invoice_id: str,
    account_id: str,
    promised_amount: float,
    promise_date: datetime,
    payment_method: Optional[PaymentMethodEnum] = None,
    contact_person: Optional[str] = None,
    contact_note: Optional[str] = None,
    notes: Optional[str] = None,
    user_id: Optional[int] = None,
) -> PaymentPromise:
    """Yeni ödeme sözü oluştur"""

    promise = PaymentPromise(
        id=str(uuid4()),
        invoice_id=invoice_id,
        account_id=account_id,
        promised_amount=promised_amount,
        promise_date=promise_date,
        payment_method=payment_method,
        contact_person=contact_person,
        contact_note=contact_note,
        status="PENDING",
        notes=notes,
        created_by_id=user_id,
    )

    db.add(promise)
    db.commit()
    db.refresh(promise)
    return promise


def update_payment_promise_status(
    db: Session, promise_id: str, status: str, notes: Optional[str] = None
) -> PaymentPromise:
    """Ödeme sözü durumunu güncelle"""
    promise = db.query(PaymentPromise).filter(PaymentPromise.id == promise_id).first()
    if not promise:
        raise ValueError("Ödeme sözü bulunamadı")

    promise.status = status
    if notes:
        promise.notes = (
            promise.notes or ""
        ) + f"\n[{datetime.now().strftime('%Y-%m-%d %H:%M')}] {notes}"

    db.commit()
    db.refresh(promise)
    return promise


def list_payment_promises(
    db: Session,
    invoice_id: Optional[str] = None,
    account_id: Optional[str] = None,
    status: Optional[str] = None,
    overdue_only: bool = False,
    today_only: bool = False,
    skip: int = 0,
    limit: int = 100,
) -> List[PaymentPromise]:
    """Ödeme sözü listesi"""
    query = db.query(PaymentPromise)

    if invoice_id:
        query = query.filter(PaymentPromise.invoice_id == invoice_id)

    if account_id:
        query = query.filter(PaymentPromise.account_id == account_id)

    if status:
        query = query.filter(PaymentPromise.status == status)

    if overdue_only:
        query = query.filter(
            and_(PaymentPromise.status == "PENDING", PaymentPromise.promise_date < datetime.now())
        )

    if today_only:
        today = datetime.now().date()
        query = query.filter(
            and_(
                PaymentPromise.status == "PENDING", func.date(PaymentPromise.promise_date) == today
            )
        )

    return query.order_by(PaymentPromise.promise_date.asc()).offset(skip).limit(limit).all()


def send_payment_reminder(db: Session, promise_id: str) -> PaymentPromise:
    """Ödeme sözü için hatırlatma gönder"""
    promise = db.query(PaymentPromise).filter(PaymentPromise.id == promise_id).first()
    if not promise:
        raise ValueError("Ödeme sözü bulunamadı")

    promise.reminder_sent = True
    promise.reminder_sent_at = datetime.now()

    db.commit()
    db.refresh(promise)
    return promise


# ══════════════════════════════════════════════════════════════
# İSTATİSTİKLER VE RAPORLAR
# ══════════════════════════════════════════════════════════════


def get_payment_statistics(db: Session, account_id: Optional[str] = None) -> Dict:
    """Tahsilat istatistikleri"""

    query = db.query(Invoice)
    if account_id:
        query = query.filter(Invoice.account_id == account_id)

    total_invoices = query.count()
    total_amount = query.with_entities(func.sum(Invoice.total_amount)).scalar() or 0
    paid_amount = query.with_entities(func.sum(Invoice.paid_amount)).scalar() or 0
    remaining_amount = query.with_entities(func.sum(Invoice.remaining_amount)).scalar() or 0

    overdue_invoices = query.filter(
        and_(Invoice.status != PaymentStatusEnum.PAID, Invoice.due_date < datetime.now())
    ).count()

    overdue_amount = (
        query.filter(
            and_(Invoice.status != PaymentStatusEnum.PAID, Invoice.due_date < datetime.now())
        )
        .with_entities(func.sum(Invoice.remaining_amount))
        .scalar()
        or 0
    )

    # Ödeme sözü istatistikleri
    pending_promises = db.query(PaymentPromise).filter(PaymentPromise.status == "PENDING")
    if account_id:
        pending_promises = pending_promises.filter(PaymentPromise.account_id == account_id)

    pending_promises_count = pending_promises.count()
    pending_promises_amount = (
        pending_promises.with_entities(func.sum(PaymentPromise.promised_amount)).scalar() or 0
    )

    today_promises = pending_promises.filter(
        func.date(PaymentPromise.promise_date) == datetime.now().date()
    ).count()

    overdue_promises = pending_promises.filter(PaymentPromise.promise_date < datetime.now()).count()

    return {
        "total_invoices": total_invoices,
        "total_amount": float(total_amount),
        "paid_amount": float(paid_amount),
        "remaining_amount": float(remaining_amount),
        "collection_rate": (paid_amount / total_amount * 100) if total_amount > 0 else 0,
        "overdue_invoices": overdue_invoices,
        "overdue_amount": float(overdue_amount),
        "pending_promises_count": pending_promises_count,
        "pending_promises_amount": float(pending_promises_amount),
        "today_promises": today_promises,
        "overdue_promises": overdue_promises,
    }


def get_aging_report(db: Session, account_id: Optional[str] = None) -> Dict:
    """Yaşlandırma raporu (30-60-90-120+ gün)"""

    query = db.query(Invoice).filter(Invoice.status != PaymentStatusEnum.PAID)
    if account_id:
        query = query.filter(Invoice.account_id == account_id)

    now = datetime.now()

    # 0-30 gün
    aging_0_30 = (
        query.filter(or_(Invoice.due_date >= now - timedelta(days=30), Invoice.due_date == None))
        .with_entities(func.sum(Invoice.remaining_amount))
        .scalar()
        or 0
    )

    # 31-60 gün
    aging_31_60 = (
        query.filter(
            and_(
                Invoice.due_date < now - timedelta(days=30),
                Invoice.due_date >= now - timedelta(days=60),
            )
        )
        .with_entities(func.sum(Invoice.remaining_amount))
        .scalar()
        or 0
    )

    # 61-90 gün
    aging_61_90 = (
        query.filter(
            and_(
                Invoice.due_date < now - timedelta(days=60),
                Invoice.due_date >= now - timedelta(days=90),
            )
        )
        .with_entities(func.sum(Invoice.remaining_amount))
        .scalar()
        or 0
    )

    # 91-120 gün
    aging_91_120 = (
        query.filter(
            and_(
                Invoice.due_date < now - timedelta(days=90),
                Invoice.due_date >= now - timedelta(days=120),
            )
        )
        .with_entities(func.sum(Invoice.remaining_amount))
        .scalar()
        or 0
    )

    # 120+ gün
    aging_120_plus = (
        query.filter(Invoice.due_date < now - timedelta(days=120))
        .with_entities(func.sum(Invoice.remaining_amount))
        .scalar()
        or 0
    )

    return {
        "aging_0_30": float(aging_0_30),
        "aging_31_60": float(aging_31_60),
        "aging_61_90": float(aging_61_90),
        "aging_91_120": float(aging_91_120),
        "aging_120_plus": float(aging_120_plus),
        "total": float(aging_0_30 + aging_31_60 + aging_61_90 + aging_91_120 + aging_120_plus),
    }
