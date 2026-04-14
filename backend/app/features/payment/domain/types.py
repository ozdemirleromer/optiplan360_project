from typing import TypedDict


class ReminderFailureDetail(TypedDict):
    entity_id: str
    message: str


class ReminderChannelStatusResult(TypedDict):
    active: bool
    ready: bool
    reason: str


class ReminderChannelHealthResult(TypedDict):
    smtp: ReminderChannelStatusResult
    sms: ReminderChannelStatusResult
    in_app: ReminderChannelStatusResult


class PaymentStatisticsResult(TypedDict):
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


class AgingReportResult(TypedDict):
    aging_0_30: float
    aging_31_60: float
    aging_61_90: float
    aging_91_120: float
    aging_120_plus: float
    total: float


class ReminderBatchResult(TypedDict):
    total_candidates: int
    sent_count: int
    failed_count: int
    skipped_count: int
    processed_ids: list[str]
    failed_ids: list[str]
    failure_details: list[ReminderFailureDetail]


class ReminderDashboardResult(TypedDict):
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


__all__ = [
    "AgingReportResult",
    "PaymentStatisticsResult",
    "ReminderBatchResult",
    "ReminderChannelHealthResult",
    "ReminderChannelStatusResult",
    "ReminderDashboardResult",
    "ReminderFailureDetail",
]
