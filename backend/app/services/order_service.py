"""
OptiPlan 360 — Order Service Layer
Sipariş iş mantığını merkezi olarak yönetir.
Router'lar bu servisi kullanır; transaction bütünlüğü burada sağlanır.
"""

import json
import logging
from datetime import datetime, timezone
from typing import List
from uuid import uuid4

from app.exceptions import (
    AuthorizationError,
    BusinessRuleError,
    FieldError,
    NotFoundError,
    StatusTransitionError,
    ValidationError,
)
from app.models import Customer, Order, OrderPart, User
from app.schemas import (
    VALID_THICKNESSES,
    MergeSuggestion,
    OrderCreate,
    OrderListItem,
    OrderOut,
    OrderPartCreate,
    OrderPartOut,
    OrderUpdate,
)
from app.schemas import ValidationError as VError
from app.schemas import (
    ValidationResult,
)
from app.services.optimization import MergeService
from app.utils import create_audit_log
from sqlalchemy import func as sa_func
from sqlalchemy.orm import Session, joinedload

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════
# DURUM GEÇİŞ KURALLARI
# ═══════════════════════════════════════════════════
VALID_TRANSITIONS = {
    "DRAFT": ["NEW", "HOLD", "CANCELLED"],
    "NEW": ["HOLD", "CANCELLED", "IN_PRODUCTION"],
    "HOLD": ["NEW", "CANCELLED", "IN_PRODUCTION"],
    "IN_PRODUCTION": ["HOLD", "CANCELLED", "READY"],
    "READY": ["IN_PRODUCTION", "DELIVERED"],
    "DELIVERED": ["DONE"],
    "DONE": [],
    "CANCELLED": ["NEW"],
}


class OrderService:
    """Sipariş CRUD ve iş mantığı servisi."""

    # ─── Sipariş Getir ───
    @staticmethod
    def get_order(db: Session, order_id: str, *, with_parts: bool = True) -> Order:
        """Sipariş getir, bulamazsa NotFoundError fırlatır."""
        q = db.query(Order)
        if with_parts:
            q = q.options(joinedload(Order.parts), joinedload(Order.audit_logs))
        order = q.filter(Order.id == order_id).first()
        if not order:
            raise NotFoundError("Sipariş", order_id)
        return order

    # ─── Müşteri Getir ───
    @staticmethod
    def get_customer(db: Session, customer_id: int) -> Customer:
        """Müşteri getir, bulamazsa NotFoundError fırlatır."""
        customer = db.query(Customer).filter(Customer.id == customer_id).first()
        if not customer:
            raise NotFoundError("Müşteri", customer_id)
        return customer

    # ─── Durum Kontrol ───
    @staticmethod
    def ensure_status(order: Order, allowed: List[str], action: str):
        """Siparişin belirtilen durumlardan birinde olduğunu doğrular."""
        if order.status not in allowed:
            raise BusinessRuleError(
                f"{action} için sipariş durumu {', '.join(allowed)} olmalı "
                f"(mevcut: {order.status})"
            )

    # ─── Sahiplik / Yetki Kontrol ───
    @staticmethod
    def _assert_can_modify(order: Order, user: User) -> None:
        """
        OPERATOR yalnızca kendi oluşturduğu siparişleri düzenleyebilir.
        ADMIN her siparişi düzenleyebilir.
        Diğer roller düzenleme yapamaz.
        """
        role = (user.role or "").upper()
        if role == "ADMIN":
            return
        if role == "OPERATOR":
            if order.created_by != user.id:
                raise AuthorizationError(
                    "Bu siparişi değiştirme yetkiniz yok "
                    "(yalnızca kendi oluşturduğunuz siparişleri düzenleyebilirsiniz)"
                )
            return
        raise AuthorizationError("Bu işlem için yetersiz rol")

    # ─── Sipariş Oluştur ───
    @staticmethod
    def create_order(db: Session, body: OrderCreate, user: User) -> Order:
        """Yeni sipariş oluşturur. Transaction-safe."""
        customer = OrderService.get_customer(db, body.customer_id)

        now = datetime.now(timezone.utc)
        ts_code = now.strftime("%Y%m%d_%H%M%S") + f"_{now.microsecond // 1000:03d}"
        tracking_token = str(uuid4())

        # Sıralı sipariş numarası oluştur
        max_no = db.query(sa_func.max(Order.order_no)).scalar() or 0
        next_order_no = max_no + 1

        order = Order(
            order_no=next_order_no,
            customer_id=body.customer_id,
            phone_norm=body.phone_norm,
            thickness_mm=body.thickness_mm,
            plate_w_mm=body.plate_w_mm,
            plate_h_mm=body.plate_h_mm,
            color=body.color,
            material_name=body.material_name,
            band_mm=body.band_mm,
            grain_default=body.grain_default,
            crm_name_snapshot=customer.name,
            ts_code=ts_code,
            tracking_token=tracking_token,
            created_by=user.id,
        )
        db.add(order)
        db.flush()  # id oluşsun

        for p in body.parts:
            part = OrderService._create_part(order.id, p)
            db.add(part)

        create_audit_log(db, user.id, "ORDER_CREATED", None, order.id)
        db.commit()
        db.refresh(order)

        logger.info(
            "Sipariş oluşturuldu: %s (user=%s, parts=%d)", order.id, user.id, len(body.parts)
        )
        return order

    # ─── Sipariş Başlık Güncelle ───
    @staticmethod
    def update_order_header(db: Session, order_id: str, body: OrderUpdate, user: User) -> Order:
        """Sipariş başlık bilgilerini günceller."""
        order = OrderService.get_order(db, order_id)
        OrderService._assert_can_modify(order, user)
        OrderService.ensure_status(order, ["NEW", "DRAFT"], "Sipariş güncelleme")

        changes = {}

        if body.customer_id is not None:
            customer = OrderService.get_customer(db, body.customer_id)
            order.customer_id = body.customer_id
            order.crm_name_snapshot = customer.name
            changes["customer_id"] = body.customer_id

        # crm_name_snapshot doğrudan gönderilmişse (customer_id olmadan) güncelle
        if body.crm_name_snapshot is not None and body.customer_id is None:
            order.crm_name_snapshot = body.crm_name_snapshot
            changes["crm_name_snapshot"] = body.crm_name_snapshot

        field_map = {
            "phone_norm": body.phone_norm,
            "thickness_mm": body.thickness_mm,
            "plate_w_mm": body.plate_w_mm,
            "plate_h_mm": body.plate_h_mm,
            "color": body.color,
            "material_name": body.material_name,
            "band_mm": body.band_mm,
            "grain_default": body.grain_default,
            "status": body.status,
        }

        for field_name, value in field_map.items():
            if value is not None:
                setattr(order, field_name, value)
                changes[field_name] = value

        # Kalınlık güncellendiyse tekrar kontrol et
        if body.thickness_mm is not None and body.thickness_mm not in VALID_THICKNESSES:
            raise BusinessRuleError(
                f"Kalınlık {body.thickness_mm} geçersiz. "
                f"İzin verilen: {', '.join(str(t) for t in sorted(VALID_THICKNESSES))}"
            )

        order.updated_at = datetime.now(timezone.utc)
        create_audit_log(db, user.id, "UPDATE_ORDER", json.dumps(changes, default=str), order_id)
        db.commit()
        db.refresh(order)

        logger.info(
            "Sipariş güncellendi: %s (user=%s, fields=%s)", order_id, user.id, list(changes.keys())
        )
        return order

    # ─── Parça Ekle ───
    @staticmethod
    def add_parts(db: Session, order_id: str, parts: List[OrderPartCreate], user: User) -> Order:
        """Mevcut siparişe parça ekler."""
        order = OrderService.get_order(db, order_id)
        OrderService._assert_can_modify(order, user)
        OrderService.ensure_status(order, ["NEW", "DRAFT", "HOLD"], "Parça ekleme")

        for p in parts:
            part = OrderService._create_part(order.id, p)
            db.add(part)

        create_audit_log(db, user.id, "PARTS_ADDED", json.dumps({"count": len(parts)}), order.id)
        db.commit()
        db.refresh(order)

        logger.info("Parça eklendi: order=%s, count=%d (user=%s)", order_id, len(parts), user.id)
        return order

    # ─── Parçaları Güncelle (replace) ───
    @staticmethod
    def replace_parts(
        db: Session, order_id: str, parts: List[OrderPartCreate], user: User
    ) -> Order:
        """Siparişin tüm parçalarını yenileriyle değiştirir."""
        order = OrderService.get_order(db, order_id)
        OrderService._assert_can_modify(order, user)
        OrderService.ensure_status(order, ["NEW", "DRAFT"], "Parça güncelleme")

        db.query(OrderPart).filter(OrderPart.order_id == order_id).delete()

        new_parts = []
        for p in parts:
            part = OrderService._create_part(order_id, p)
            db.add(part)
            new_parts.append(part)

        order.updated_at = datetime.now(timezone.utc)
        create_audit_log(
            db, user.id, "UPDATE_PARTS", f"{len(new_parts)} parça güncellendi", order_id
        )
        db.commit()
        db.refresh(order)

        logger.info(
            "Parçalar güncellendi: order=%s, count=%d (user=%s)", order_id, len(new_parts), user.id
        )
        return order

    # ─── Validasyon ───
    @staticmethod
    def validate_order(db: Session, order_id: str) -> ValidationResult:
        """Siparişi valide eder. Hataları ve birleştirme önerilerini döner."""
        order = OrderService.get_order(db, order_id)

        errors: list[VError] = []
        merge_suggestions: list[MergeSuggestion] = []

        # Parça kontrolü
        if not order.parts:
            errors.append(VError(field="parts", message="Siparişte hiç parça yok"))

        for i, part in enumerate(order.parts, 1):
            if part.boy_mm is None or part.boy_mm <= 0:
                errors.append(VError(field="boy_mm", message="Boy değeri geçersiz", row=i))
            if part.en_mm is None or part.en_mm <= 0:
                errors.append(VError(field="en_mm", message="En değeri geçersiz", row=i))
            if part.adet is None or part.adet <= 0:
                errors.append(VError(field="adet", message="Adet değeri geçersiz", row=i))

            # Grain kontrolü
            if part.grain not in {0, 1, 2, 3}:
                errors.append(VError(field="grain", message="Geçersiz grain değeri", row=i))

            # Arkalıkta bant kontrolü
            if part.part_group == "ARKALIK" and any([part.u1, part.u2, part.k1, part.k2]):
                errors.append(VError(field="band", message="Arkalıkta bant olamaz", row=i))

        # CRM snapshot kontrolü
        if not order.crm_name_snapshot:
            errors.append(VError(field="crm_name_snapshot", message="CRM snapshot eksik"))

        # Telefon normalize kontrolü
        if not order.customer or not order.customer.phone:
            errors.append(
                VError(field="phone", message="Telefon numarası eksik veya normalize edilemedi")
            )

        # Export grouping kontrolü
        govde = [p for p in order.parts if p.part_group == "GOVDE"]
        arkalik = [p for p in order.parts if p.part_group == "ARKALIK"]
        if not govde and not arkalik:
            errors.append(VError(field="grouping", message="GOVDE ve ARKALIK grupları eksik"))

        # Merge önerisi
        for sug in MergeService.compute_suggestions(
            order.parts, part_group_filter="GOVDE", row_start=1
        ):
            merge_suggestions.append(
                MergeSuggestion(rows=sug.rows, reason=sug.reason, band_match=sug.band_match)
            )

        return ValidationResult(
            valid=len(errors) == 0,
            errors=errors,
            merge_suggestions=merge_suggestions,
        )

    # ─── Onayla ───
    @staticmethod
    def approve_order(db: Session, order_id: str, user: User) -> Order:
        """Siparişi onaylar (NEW → IN_PRODUCTION). Validasyon geçmelidir."""
        val = OrderService.validate_order(db, order_id)
        if not val.valid:
            error_summary = "; ".join(f"{e.field}: {e.message}" for e in val.errors[:5])
            raise ValidationError(
                f"Onaylama başarısız: {error_summary}",
                [FieldError(field=e.field, message=e.message, row=e.row) for e in val.errors],
            )

        order = OrderService.get_order(db, order_id)
        OrderService._assert_can_modify(order, user)
        OrderService.ensure_status(order, ["NEW", "DRAFT"], "Sipariş onaylama")

        order.status = "IN_PRODUCTION"
        create_audit_log(db, user.id, "ORDER_APPROVED", None, order.id)
        db.commit()
        db.refresh(order)

        logger.info("Sipariş onaylandı: %s (user=%s)", order_id, user.id)
        return order

    # ─── Durum Güncelle ───
    @staticmethod
    def update_status(db: Session, order_id: str, new_status: str, user: User) -> dict:
        """Sipariş durumunu günceller. Geçiş kurallarını kontrol eder."""
        order = OrderService.get_order(db, order_id, with_parts=False)
        OrderService._assert_can_modify(order, user)

        valid_statuses = list(VALID_TRANSITIONS.keys())
        if new_status not in valid_statuses:
            raise BusinessRuleError(f"Geçersiz durum: {new_status}")

        allowed = VALID_TRANSITIONS.get(order.status, [])
        if new_status not in allowed:
            raise StatusTransitionError(order.status, new_status, allowed)

        old_status = order.status
        order.status = new_status

        if new_status == "HOLD":
            order.hold_at = datetime.now(timezone.utc)
        elif new_status == "CANCELLED":
            order.cancelled_at = datetime.now(timezone.utc)
        elif new_status == "DELIVERED":
            order.delivered_at = datetime.now(timezone.utc)

        create_audit_log(
            db,
            user.id,
            "STATUS_CHANGED",
            json.dumps({"from": old_status, "to": new_status}),
            order.id,
        )
        db.commit()

        logger.info(
            "Durum değişti: order=%s %s→%s (user=%s)", order_id, old_status, new_status, user.id
        )
        return {"status": "ok", "old": old_status, "new": new_status}

    # ─── Sipariş Sil ───
    @staticmethod
    def delete_order(db: Session, order_id: str, user: User) -> dict:
        """Siparişi siler. Sadece NEW/DRAFT durumunda."""
        from app.models import AuditLog, WhatsAppMessage
        from app.models.crm import CRMOpportunity
        from app.models.finance import Invoice
        from app.models.integrations import OCRJob
        from app.models.order import Message, OptiAuditEvent, OptiJob

        order = OrderService.get_order(db, order_id, with_parts=False)
        OrderService._assert_can_modify(order, user)
        OrderService.ensure_status(order, ["NEW", "DRAFT"], "Sipariş silme")

        ts_code = order.ts_code
        oid = int(order_id)

        # FK zinciri: opti_audit_events → opti_jobs → diğer tablolar → order_parts → orders
        job_ids = [j.id for j in db.query(OptiJob.id).filter(OptiJob.order_id == oid).all()]
        if job_ids:
            db.query(OptiAuditEvent).filter(OptiAuditEvent.job_id.in_(job_ids)).delete(
                synchronize_session=False
            )
            db.query(OptiJob).filter(OptiJob.order_id == oid).delete(synchronize_session=False)

        db.query(AuditLog).filter(AuditLog.order_id == oid).delete()
        db.query(WhatsAppMessage).filter(WhatsAppMessage.order_id == oid).delete()
        db.query(Message).filter(Message.order_id == oid).delete()
        db.query(OCRJob).filter(OCRJob.order_id == oid).update(
            {OCRJob.order_id: None}, synchronize_session=False
        )
        db.query(CRMOpportunity).filter(CRMOpportunity.order_id == oid).update(
            {CRMOpportunity.order_id: None}, synchronize_session=False
        )
        db.query(Invoice).filter(Invoice.order_id == oid).update(
            {Invoice.order_id: None}, synchronize_session=False
        )
        db.query(OrderPart).filter(OrderPart.order_id == oid).delete()
        db.delete(order)

        create_audit_log(db, user.id, "DELETE_ORDER", f"Sipariş silindi: {ts_code}", None)
        db.commit()

        logger.info("Sipariş silindi: %s / %s (user=%s)", order_id, ts_code, user.id)
        return {"message": f"Sipariş {ts_code} silindi", "id": order_id}

    # ─── Geçerli Geçişleri Getir ───
    @staticmethod
    def get_transitions(db: Session, order_id: str) -> dict:
        """Bir siparişin mevcut durumundan yapılabilecek geçişleri döner."""
        order = OrderService.get_order(db, order_id, with_parts=False)
        allowed = VALID_TRANSITIONS.get(order.status, [])
        return {
            "current_status": order.status,
            "allowed_transitions": allowed,
        }

    # ─── Çıktı Dönüştürücü ───
    @staticmethod
    def order_to_list_item(order: Order) -> OrderListItem:
        """Liste için hafif dönüşüm — parça dizisi yerine sadece sayı."""
        return OrderListItem(
            id=str(order.id),
            order_no=order.order_no,
            customer_id=order.customer_id,
            phone_norm=order.phone_norm or "",
            status=order.status,
            thickness_mm=float(order.thickness_mm or 0),
            plate_w_mm=float(order.plate_w_mm or 0),
            plate_h_mm=float(order.plate_h_mm or 0),
            color=order.color or "",
            material_name=order.material_name or "",
            band_mm=float(order.band_mm) if order.band_mm else None,
            grain_default=order.grain_default or "0-Material",
            crm_name_snapshot=order.crm_name_snapshot,
            ts_code=order.ts_code,
            tracking_token=getattr(order, "tracking_token", None),
            parts_count=len(order.parts) if order.parts else 0,
            created_at=order.created_at,
            updated_at=order.updated_at,
        )

    @staticmethod
    def order_to_out(order: Order) -> OrderOut:
        """Order modelini OrderOut schema'sına dönüştürür."""
        # id alanları schema'da str olduğu için dönüştür
        parts_out = []
        for p in order.parts:
            d = {c.key: getattr(p, c.key) for c in p.__table__.columns}
            d["id"] = str(d["id"])
            d["order_id"] = str(d["order_id"])
            parts_out.append(OrderPartOut(**d))

        return OrderOut(
            id=str(order.id),
            order_no=order.order_no,
            customer_id=order.customer_id,
            phone_norm=order.phone_norm,
            status=order.status,
            thickness_mm=order.thickness_mm,
            plate_w_mm=order.plate_w_mm,
            plate_h_mm=order.plate_h_mm,
            color=order.color,
            material_name=order.material_name,
            band_mm=order.band_mm,
            grain_default=order.grain_default,
            crm_name_snapshot=order.crm_name_snapshot,
            ts_code=order.ts_code,
            tracking_token=getattr(order, "tracking_token", None),
            parts=parts_out,
            created_at=order.created_at,
            updated_at=order.updated_at,
        )

    # ─── Yardımcı: Parça Oluştur ───
    @staticmethod
    def _create_part(order_id, p: OrderPartCreate) -> OrderPart:
        """OrderPartCreate schema'sından OrderPart model instance'ı oluşturur."""
        return OrderPart(
            id=str(uuid4()),
            order_id=order_id,
            part_group=p.part_group,
            boy_mm=p.boy_mm,
            en_mm=p.en_mm,
            adet=p.adet,
            grain_code=p.grain_code,
            u1=p.u1,
            u2=p.u2,
            k1=p.k1,
            k2=p.k2,
            part_desc=p.part_desc,
            drill_code_1=p.drill_code_1,
            drill_code_2=p.drill_code_2,
        )
