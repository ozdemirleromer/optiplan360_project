from __future__ import annotations

import asyncio
import logging
from datetime import datetime
from typing import Optional

import httpx

from sqlalchemy.orm import Session

from app.exceptions import BusinessRuleError, ValidationError as AppValidationError
from app.models import CRMAccount, IntegrationTypeEnum, Invoice, PaymentPromise, ReminderTypeEnum
from app.services.email_service import email_service
from app.services.integration_settings_service import IntegrationSettingsService
from app.services.websocket_manager import manager


logger = logging.getLogger(__name__)


class PaymentReminderDispatchService:
    """Tahsilat hatirlatmalarini kanal bazli dispatch eder."""

    def __init__(self, db: Session):
        self.db = db
        self.integration_settings_service = IntegrationSettingsService(db)

    def dispatch_invoice_reminder(self, invoice: Invoice, account: CRMAccount) -> bool:
        reminder_type = invoice.reminder_type or ReminderTypeEnum.EMAIL
        customer_name = account.company_name or "Musteri"
        due_date = invoice.due_date or invoice.issue_date or datetime.now()
        amount = float(invoice.remaining_amount or invoice.total_amount or 0)
        currency = invoice.currency or "TRY"

        if reminder_type == ReminderTypeEnum.EMAIL:
            return self._dispatch_email(
                to_email=account.email,
                customer_name=customer_name,
                reference_id=invoice.invoice_number,
                amount=amount,
                currency=currency,
                due_date=due_date,
                entity_label="Cari hesap",
            )

        if reminder_type == ReminderTypeEnum.IN_APP:
            notification_user_id = self._resolve_notification_user_id(account, invoice.created_by_id)
            title = "Odeme Hatirlatmasi"
            message = (
                f"{invoice.invoice_number} numarali fatura icin {amount:.2f} {currency} "
                f"odeme hatirlatmasi olusturuldu. Son odeme: {due_date.strftime('%Y-%m-%d')}"
            )
            return self._dispatch_in_app(notification_user_id, title, message)

        if reminder_type == ReminderTypeEnum.SMS:
            return self._dispatch_sms(
                to_phone=account.phone,
                message=(
                    f"{invoice.invoice_number} fatura odeme hatirlatmasi: "
                    f"{amount:.2f} {currency}, son odeme {due_date.strftime('%Y-%m-%d')}"
                ),
                entity_label="Cari hesap",
            )

        raise AppValidationError(f"Desteklenmeyen hatirlatma tipi: {reminder_type.value}")

    def dispatch_promise_reminder(
        self,
        promise: PaymentPromise,
        invoice: Invoice,
        account: CRMAccount,
    ) -> bool:
        reminder_type = invoice.reminder_type or ReminderTypeEnum.EMAIL
        customer_name = account.company_name or "Musteri"
        due_date = promise.promise_date or invoice.due_date or invoice.issue_date or datetime.now()
        amount = float(promise.promised_amount or invoice.remaining_amount or 0)
        currency = invoice.currency or "TRY"

        if reminder_type == ReminderTypeEnum.EMAIL:
            return self._dispatch_email(
                to_email=account.email,
                customer_name=customer_name,
                reference_id=invoice.invoice_number,
                amount=amount,
                currency=currency,
                due_date=due_date,
                entity_label="Cari hesap",
            )

        if reminder_type == ReminderTypeEnum.IN_APP:
            notification_user_id = self._resolve_notification_user_id(account, promise.created_by_id)
            title = "Odeme Sozu Hatirlatmasi"
            message = (
                f"{invoice.invoice_number} numarali fatura icin {amount:.2f} {currency} "
                f"odeme sozu hatirlatmasi olusturuldu. Beklenen odeme: {due_date.strftime('%Y-%m-%d')}"
            )
            return self._dispatch_in_app(notification_user_id, title, message)

        if reminder_type == ReminderTypeEnum.SMS:
            return self._dispatch_sms(
                to_phone=account.phone,
                message=(
                    f"{invoice.invoice_number} odeme sozu hatirlatmasi: "
                    f"{amount:.2f} {currency}, beklenen odeme {due_date.strftime('%Y-%m-%d')}"
                ),
                entity_label="Cari hesap",
            )

        raise AppValidationError(f"Desteklenmeyen hatirlatma tipi: {reminder_type.value}")

    def _dispatch_email(
        self,
        *,
        to_email: Optional[str],
        customer_name: str,
        reference_id: str,
        amount: float,
        currency: str,
        due_date: datetime,
        entity_label: str,
    ) -> bool:
        self._ensure_email_channel_available()

        if not to_email:
            raise AppValidationError(f"{entity_label} icin e-posta adresi tanimli degil")

        return email_service.send_payment_reminder(
            to_email=to_email,
            customer_name=customer_name,
            invoice_id=reference_id,
            amount=amount,
            currency=currency,
            due_date=due_date.strftime("%Y-%m-%d"),
        )

    def _dispatch_in_app(self, user_id: Optional[str], title: str, message: str) -> bool:
        payload = {
            "type": "notification",
            "title": title,
            "message": message,
            "priority": "normal",
            "createdAt": datetime.now().isoformat(),
        }

        if user_id:
            self._run_async(manager.send_to_user(user_id, payload))
        else:
            self._run_async(manager.broadcast_to_channel("notifications", payload))
        return True

    def _dispatch_sms(self, to_phone: Optional[str], message: str, entity_label: str) -> bool:
        settings = self._ensure_sms_channel_available()

        if not to_phone:
            raise AppValidationError(f"{entity_label} icin telefon numarasi tanimli degil")

        api_url = str(settings.get("api_url") or settings.get("url") or "").strip()
        if not api_url:
            raise BusinessRuleError("SMS entegrasyonu aktif ancak api_url ayari tanimli degil")

        payload = {
            "to": to_phone,
            "phone": to_phone,
            "message": message,
            "text": message,
        }
        sender = settings.get("sender") or settings.get("from")
        if sender:
            payload["sender"] = sender

        headers = {"Content-Type": "application/json"}
        api_key = settings.get("api_key") or settings.get("apikey")
        token = settings.get("token") or settings.get("access_token")
        if api_key:
            headers["X-API-Key"] = str(api_key)
        if token:
            headers["Authorization"] = f"Bearer {token}"

        timeout = float(settings.get("timeout_seconds") or 15)

        try:
            with httpx.Client(timeout=timeout) as client:
                response = client.post(api_url, json=payload, headers=headers)
                response.raise_for_status()

                content_type = response.headers.get("content-type", "")
                if "application/json" in content_type:
                    body = response.json()
                    if isinstance(body, dict):
                        if body.get("success") is False:
                            raise BusinessRuleError(
                                f"SMS provider hatasi: {body.get('message') or 'success=false'}"
                            )
                        provider_status = str(body.get("status") or "").lower()
                        if provider_status in {"failed", "error", "rejected"}:
                            raise BusinessRuleError(
                                f"SMS provider status={body.get('status')}"
                            )
                return True
        except httpx.HTTPError as exc:
            logger.error("SMS dispatch error: %s", exc)
            raise BusinessRuleError(f"SMS gonderimi basarisiz: {exc}") from exc

    def _ensure_email_channel_available(self) -> None:
        integration_active = False
        try:
            integration_active = self.integration_settings_service.is_integration_active(
                IntegrationTypeEnum.SMTP
            )
        except Exception:
            integration_active = False

        if integration_active or email_service.is_configured():
            return

        raise BusinessRuleError("SMTP entegrasyonu aktif degil ve e-posta ayarlari tanimli degil")

    def _ensure_sms_channel_available(self) -> dict:
        integration_active = False
        settings: dict = {}
        try:
            integration_active = self.integration_settings_service.is_integration_active(
                IntegrationTypeEnum.SMS
            )
            settings = self.integration_settings_service.get_sms_settings() or {}
        except Exception:
            integration_active = False
            settings = {}

        if not integration_active:
            raise BusinessRuleError("SMS entegrasyonu aktif degil")

        return settings

    @staticmethod
    def _resolve_notification_user_id(account: CRMAccount, created_by_id: Optional[int]) -> Optional[str]:
        if account.owner_id is not None:
            return str(account.owner_id)
        if created_by_id is not None:
            return str(created_by_id)
        return None

    @staticmethod
    def _run_async(coroutine) -> None:
        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            asyncio.run(coroutine)
            return

        loop.create_task(coroutine)
