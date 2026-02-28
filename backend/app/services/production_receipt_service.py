"""
OptiPlan 360 - Production Receipt Service (Uretim Siparis Fisi)

XML parse sonucundan plaka adedi ve bant miktari cikarir,
musteri kartina siparis fisi (Invoice) olarak isler.

Akis:
  OptiJob (XML_READY/DELIVERED) -> XML parse sonucu (result_json)
    -> Plaka adedi: mqBoards m2 / plaka alani
    -> Bant miktari: OrderPart'lardan kenar uzunluklari toplami
    -> Invoice: CRMAccount'a bagli, PRODUCTION tipi fatura

Fiyatlandirma:
  1. CRMAccount.plaka_birim_fiyat / bant_metre_fiyat (musteriye ozel)
  2. Yoksa config/pricing.json varsayilanlari
"""
import json
import logging
import os
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.orm import Session

from ..models import OptiJob, OptiAuditEvent, Order, OrderPart
from ..models.crm import CRMAccount
from ..models.finance import Invoice
from ..models.enums import PaymentStatusEnum
from .payment_service import create_invoice
from . import tracking_folder_service as tracking

logger = logging.getLogger(__name__)

# Varsayilan fiyat konfigurasyonu
_pricing_config: dict | None = None


def _load_pricing_config() -> dict:
    """config/pricing.json yukler."""
    global _pricing_config
    if _pricing_config is not None:
        return _pricing_config

    config_path = os.path.join(
        os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))),
        "config",
        "pricing.json",
    )
    try:
        with open(config_path, "r", encoding="utf-8") as f:
            _pricing_config = json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        _pricing_config = {
            "varsayilan_plaka_birim_fiyat": 500.0,
            "varsayilan_bant_metre_fiyat": 15.0,
            "kdv_orani": 20.0,
        }
    return _pricing_config


def calculate_edge_banding_metres(db: Session, order_id: int) -> float:
    """
    Siparisin parcalarindan toplam bant miktarini (metre) hesaplar.

    Mantik:
      her parca icin:
        u1 True ise -> boy_mm (ust kenar)
        u2 True ise -> boy_mm (alt kenar)
        k1 True ise -> en_mm  (sol kenar)
        k2 True ise -> en_mm  (sag kenar)
      toplam_mm += kenar_uzunluklari_toplami * adet
      return toplam_mm / 1000 (mm -> metre)
    """
    parts = (
        db.query(OrderPart)
        .filter(OrderPart.order_id == order_id)
        .all()
    )

    toplam_mm = 0.0
    for part in parts:
        boy = float(part.boy_mm) if part.boy_mm else 0
        en = float(part.en_mm) if part.en_mm else 0
        adet = int(part.adet) if part.adet else 1

        kenar_toplam = 0.0
        if part.u1:
            kenar_toplam += boy
        if part.u2:
            kenar_toplam += boy
        if part.k1:
            kenar_toplam += en
        if part.k2:
            kenar_toplam += en

        toplam_mm += kenar_toplam * adet

    return toplam_mm / 1000.0


def calculate_plate_count(mq_boards: float, plate_w_mm: float, plate_h_mm: float) -> int:
    """
    mqBoards (m2) degerinden plaka adedini hesaplar.

    mqBoards = toplam plaka alani (m2)
    plaka_alani = (plate_w_mm * plate_h_mm) / 1_000_000 (mm2 -> m2)
    plaka_adedi = ceil(mqBoards / plaka_alani)
    """
    if not plate_w_mm or not plate_h_mm or plate_w_mm <= 0 or plate_h_mm <= 0:
        # Plaka boyutu bilinmiyorsa mqBoards'u direkt adet olarak yorumla
        return max(1, int(mq_boards))

    plaka_alani_m2 = (plate_w_mm * plate_h_mm) / 1_000_000
    if plaka_alani_m2 <= 0:
        return max(1, int(mq_boards))

    import math
    return max(1, math.ceil(mq_boards / plaka_alani_m2))


def create_production_receipt(
    db: Session,
    job_id: str,
    user_id: int | None = None,
) -> Invoice | None:
    """
    OptiJob'dan uretim siparis fisi olusturur.

    1. OptiJob -> result_json'dan plaka bilgisi al
    2. Order -> OrderPart'lardan bant miktari hesapla
    3. Customer -> CRMAccount'tan fiyat al (yoksa varsayilan)
    4. Invoice olustur (PRODUCTION tipi)

    Returns:
        Olusturulan Invoice veya None (gerekli veri eksikse)
    """
    # Job ve order bilgilerini yukle
    job = db.query(OptiJob).filter(OptiJob.id == job_id).first()
    if not job:
        logger.error("Production receipt: Job bulunamadi: %s", job_id)
        return None

    order = db.query(Order).filter(Order.id == job.order_id).first()
    if not order:
        logger.error("Production receipt: Order bulunamadi: order_id=%s", job.order_id)
        return None

    # CRMAccount bul (Customer -> CRMAccount)
    account: CRMAccount | None = None
    if order.customer_id:
        account = (
            db.query(CRMAccount)
            .filter(CRMAccount.customer_id == order.customer_id)
            .first()
        )
    if not account:
        logger.warning(
            "Production receipt: CRMAccount bulunamadi (customer_id=%s). "
            "Fis olusturulamadi.",
            order.customer_id,
        )
        return None

    # XML parse sonucunu oku
    parse_result = {}
    if job.result_json:
        try:
            parse_result = json.loads(job.result_json)
        except json.JSONDecodeError:
            pass

    mq_boards = parse_result.get("mq_boards", 0)

    # Plaka adedi hesapla
    plate_w = float(order.plate_w_mm) if order.plate_w_mm else 0
    plate_h = float(order.plate_h_mm) if order.plate_h_mm else 0
    plaka_adedi = calculate_plate_count(mq_boards, plate_w, plate_h)

    # Bant miktari hesapla
    bant_metre = calculate_edge_banding_metres(db, order.id)

    # Fiyatlandirma (cari karta ozel > varsayilan)
    pricing = _load_pricing_config()
    plaka_fiyat = account.plaka_birim_fiyat or pricing.get("varsayilan_plaka_birim_fiyat", 500.0)
    bant_fiyat = account.bant_metre_fiyat or pricing.get("varsayilan_bant_metre_fiyat", 15.0)
    kdv_orani = pricing.get("kdv_orani", 20.0)

    # Tutarlar
    plaka_tutari = plaka_adedi * plaka_fiyat
    bant_tutari = bant_metre * bant_fiyat
    subtotal = plaka_tutari + bant_tutari
    total_amount = subtotal * (1 + kdv_orani / 100)

    # Fatura notu
    notes = (
        f"Uretim Siparis Fisi\n"
        f"Job: {job.id[:8]}\n"
        f"Siparis: {order.ts_code or order.id}\n"
        f"Plaka: {plaka_adedi} adet x {plaka_fiyat:.2f} TL = {plaka_tutari:.2f} TL\n"
        f"Bant: {bant_metre:.2f} m x {bant_fiyat:.2f} TL = {bant_tutari:.2f} TL\n"
        f"Ara Toplam: {subtotal:.2f} TL\n"
        f"KDV (%{kdv_orani:.0f}): {subtotal * kdv_orani / 100:.2f} TL\n"
        f"Genel Toplam: {total_amount:.2f} TL"
    )

    # Mevcut fis kontrolu (ayni job icin tekrar olusturma)
    existing = (
        db.query(Invoice)
        .filter(Invoice.order_id == order.id, Invoice.invoice_type == "PRODUCTION")
        .first()
    )
    if existing:
        logger.info("Production receipt zaten mevcut: invoice=%s, job=%s", existing.id, job_id)
        return existing

    # Invoice olustur
    invoice = create_invoice(
        db=db,
        account_id=account.id,
        order_id=order.id,
        quote_id=None,
        subtotal=subtotal,
        tax_rate=kdv_orani,
        discount_amount=0,
        total_amount=total_amount,
        due_date=None,
        invoice_type="PRODUCTION",
        notes=notes,
        user_id=user_id,
    )

    # Audit event
    audit = OptiAuditEvent(
        job_id=job_id,
        event_type="PRODUCTION_RECEIPT",
        message=f"Siparis fisi olusturuldu: {invoice.invoice_number}",
        details_json=json.dumps({
            "invoice_id": invoice.id,
            "invoice_number": invoice.invoice_number,
            "plaka_adedi": plaka_adedi,
            "bant_metre": round(bant_metre, 2),
            "plaka_fiyat": plaka_fiyat,
            "bant_fiyat": bant_fiyat,
            "subtotal": round(subtotal, 2),
            "total_amount": round(total_amount, 2),
        }, default=str),
    )
    db.add(audit)
    db.commit()

    logger.info(
        "Production receipt olusturuldu: job=%s, invoice=%s, plaka=%d, bant=%.2fm",
        job_id, invoice.invoice_number, plaka_adedi, bant_metre,
    )

    # Tracking: siparis fisini _raporlar/ klasorune yaz
    tracking.on_receipt_created(
        job_id=job_id,
        order_ts_code=order.ts_code or "",
        receipt_text=notes,
    )
    tracking.write_daily_log(
        f"Siparis fisi: job={job_id[:8]}, invoice={invoice.invoice_number}, "
        f"plaka={plaka_adedi}, bant={bant_metre:.2f}m, toplam={total_amount:.2f} TL"
    )

    return invoice


def get_production_receipt(db: Session, job_id: str) -> dict | None:
    """
    Job icin olusturulmus siparis fisini dondurur.
    Yoksa None doner.
    """
    job = db.query(OptiJob).filter(OptiJob.id == job_id).first()
    if not job:
        return None

    order = db.query(Order).filter(Order.id == job.order_id).first()
    if not order:
        return None

    invoice = (
        db.query(Invoice)
        .filter(Invoice.order_id == order.id, Invoice.invoice_type == "PRODUCTION")
        .first()
    )

    # Parse result
    parse_result = {}
    if job.result_json:
        try:
            parse_result = json.loads(job.result_json)
        except json.JSONDecodeError:
            pass

    bant_metre = calculate_edge_banding_metres(db, order.id)

    plate_w = float(order.plate_w_mm) if order.plate_w_mm else 0
    plate_h = float(order.plate_h_mm) if order.plate_h_mm else 0
    plaka_adedi = calculate_plate_count(parse_result.get("mq_boards", 0), plate_w, plate_h)

    return {
        "job_id": job.id,
        "order_id": order.id,
        "order_ts_code": order.ts_code,
        "customer_name": order.crm_name_snapshot,
        "xml_parse": parse_result,
        "plaka_adedi": plaka_adedi,
        "bant_metre": round(bant_metre, 2),
        "invoice": {
            "id": invoice.id,
            "number": invoice.invoice_number,
            "subtotal": invoice.subtotal,
            "total_amount": invoice.total_amount,
            "status": invoice.status.value if invoice.status else None,
            "notes": invoice.notes,
        } if invoice else None,
    }
