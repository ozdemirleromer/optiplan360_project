from datetime import datetime
from typing import Optional

from .constants import (
    PROMISE_STATUS_MAX_LENGTH,
    PROMISE_STATUS_MIN_LENGTH,
)
from app.models import PaymentMethodEnum, ReminderTypeEnum
from pydantic import BaseModel, ConfigDict, Field


class InvoiceCreate(BaseModel):
    account_id: str
    order_id: Optional[int] = None
    quote_id: Optional[str] = None
    subtotal: float = Field(..., ge=0)
    tax_rate: float = Field(20.0, ge=0)
    discount_amount: float = Field(0.0, ge=0)
    total_amount: float = Field(..., ge=0)
    due_date: Optional[datetime] = None
    invoice_type: str = "SALES"
    notes: Optional[str] = None
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
    amount: float = Field(..., gt=0)
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
    promised_amount: float = Field(..., gt=0)
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
    reminder_count: int
    contact_person: Optional[str] = None
    contact_note: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PaymentPromiseStatusUpdate(BaseModel):
    status: str = Field(
        ...,
        min_length=PROMISE_STATUS_MIN_LENGTH,
        max_length=PROMISE_STATUS_MAX_LENGTH,
    )
    notes: Optional[str] = None


class DeleteResult(BaseModel):
    status: str
    message: str


class ReminderBatchOut(BaseModel):
    total_candidates: int
    sent_count: int
    failed_count: int
    skipped_count: int
    processed_ids: list[str]
    failed_ids: list[str]
    failure_details: list[dict[str, str]]


class ReminderChannelStatusOut(BaseModel):
    active: bool
    ready: bool
    reason: str


class ReminderChannelHealthOut(BaseModel):
    smtp: ReminderChannelStatusOut
    sms: ReminderChannelStatusOut
    in_app: ReminderChannelStatusOut


class ReminderDashboardOut(BaseModel):
    configured_email_reminders: int
    configured_in_app_reminders: int
    configured_sms_reminders: int
    due_email_reminders: int
    due_in_app_reminders: int
    due_sms_reminders: int
    failed_email_reminders: int
    failed_sms_reminders: int
    total_due_promise_reminders: int
    total_sent_promise_reminders: int
    total_failed_promise_reminders: int
    total_due_promise_email_reminders: int
    total_due_promise_in_app_reminders: int
    total_due_promise_sms_reminders: int
    total_sent_promise_email_reminders: int
    total_sent_promise_in_app_reminders: int
    total_sent_promise_sms_reminders: int
    total_failed_promise_email_reminders: int
    total_failed_promise_in_app_reminders: int
    total_failed_promise_sms_reminders: int
    recent_failed_invoice_ids: list[str]
    recent_failed_promise_ids: list[str]


class PaymentStatisticsOut(BaseModel):
    total_invoices: int
    total_amount: float
    paid_amount: float
    remaining_amount: float
    collection_rate: float
    overdue_invoices: int
    overdue_amount: float
    configured_invoice_reminders: int
    configured_sms_reminders: int
    due_invoice_reminders: int
    due_sms_reminders: int
    failed_invoice_reminders: int
    failed_sms_reminders: int
    sent_invoice_reminders: int
    pending_promises_count: int
    pending_promises_amount: float
    today_promises: int
    overdue_promises: int
    due_promise_reminders: int
    sent_promise_reminders: int
    failed_promise_reminders: int
    due_promise_email_reminders: int
    due_promise_in_app_reminders: int
    due_promise_sms_reminders: int
    sent_promise_email_reminders: int
    sent_promise_in_app_reminders: int
    sent_promise_sms_reminders: int
    failed_promise_email_reminders: int
    failed_promise_in_app_reminders: int
    failed_promise_sms_reminders: int


class AgingReportOut(BaseModel):
    aging_0_30: float
    aging_31_60: float
    aging_61_90: float
    aging_91_120: float
    aging_120_plus: float
    total: float


__all__ = [
    "AgingReportOut",
    "DeleteResult",
    "InvoiceCreate",
    "InvoiceOut",
    "PaymentCreate",
    "PaymentOut",
    "ReminderBatchOut",
    "ReminderChannelHealthOut",
    "ReminderChannelStatusOut",
    "ReminderDashboardOut",
    "PaymentPromiseCreate",
    "PaymentPromiseOut",
    "PaymentPromiseStatusUpdate",
    "PaymentStatisticsOut",
]
