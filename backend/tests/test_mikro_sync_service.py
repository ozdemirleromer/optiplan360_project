import sys
from pathlib import Path

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.database import Base  # noqa: E402
from app.models import CRMAccount, IntegrationEntityMap, IntegrationInbox  # noqa: E402
from app.services.mikro_sync_service import MikroSyncService  # noqa: E402


class FakeMikroClient:
    def __init__(self) -> None:
        self.read_only_mode = False
        self.connection = True
        self.created_account_payload = None
        self.created_invoice_payload = None
        self.created_invoice_lines: list[dict] = []
        self.created_quote_payload = None
        self.created_quote_lines: list[dict] = []
        self.created_order_payload = None
        self.created_order_lines: list[dict] = []
        self.account_payload = None

    def connect(self):
        self.connection = True
        return True

    def create_account(self, payload):
        self.created_account_payload = payload
        return "CARI-001"

    def create_invoice(self, payload):
        self.created_invoice_payload = payload
        return "FTR-001"

    def create_invoice_line(self, payload):
        self.created_invoice_lines.append(payload)
        return True

    def create_quote(self, payload):
        self.created_quote_payload = payload
        return "TKL-001"

    def delete_quote_lines(self, _external_id):
        return True

    def create_quote_line(self, payload):
        self.created_quote_lines.append(payload)
        return True

    def create_order(self, payload):
        self.created_order_payload = payload
        return "SIP-001"

    def delete_order_lines(self, _external_id):
        return True

    def create_order_line(self, payload):
        self.created_order_lines.append(payload)
        return True

    def get_account(self, _cari_kod):
        return self.account_payload


@pytest.fixture
def db_session():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
        engine.dispose()


def test_sync_account_to_mikro_uses_external_system_mapping_field(db_session):
    fake_client = FakeMikroClient()
    service = MikroSyncService(db_session, fake_client)

    result = service.sync_account_to_mikro(
        "acc-1",
        {
            "company_name": "Ornek Cari",
            "tax_id": "1234567890",
            "phone": "5551112233",
        },
    )

    assert result["success"] is True
    assert fake_client.created_account_payload["CARI_UNVAN"] == "Ornek Cari"

    mapping = (
        db_session.query(IntegrationEntityMap)
        .filter(IntegrationEntityMap.entity_type == "ACCOUNT", IntegrationEntityMap.internal_id == "acc-1")
        .first()
    )
    assert mapping is not None
    assert mapping.external_id == "CARI-001"
    assert mapping.external_system == "MIKRO"


def test_sync_invoice_to_mikro_uses_external_system_mapping_field(db_session):
    fake_client = FakeMikroClient()
    service = MikroSyncService(db_session, fake_client)
    db_session.add(
        IntegrationEntityMap(
            id="map-account-invoice",
            entity_type="ACCOUNT",
            internal_id="acc-invoice",
            external_id="CARI-INV-001",
            external_system="MIKRO",
        )
    )
    db_session.commit()

    result = service.sync_invoice_to_mikro(
        "inv-1",
        {
            "account_id": "acc-invoice",
            "invoice_date": "2026-03-13",
            "due_date": "2026-04-13",
            "subtotal": 1200,
            "tax_rate": 20,
            "tax_amount": 240,
            "total_amount": 1440,
            "status": "DRAFT",
        },
        [
            {
                "product_code": "STK-001",
                "description": "Kesim hizmeti",
                "quantity": 2,
                "unit_price": 600,
                "line_total": 1200,
            }
        ],
    )

    assert result["success"] is True
    assert fake_client.created_invoice_payload is not None
    assert fake_client.created_invoice_payload["CARI_KOD"] == "CARI-INV-001"
    assert fake_client.created_invoice_payload["GENEL_TOPLAM"] == 1440
    assert fake_client.created_invoice_lines == [
        {
            "FATURA_NO": "FTR-001",
            "SIRA_NO": 1,
            "STOK_KOD": "STK-001",
            "ACIKLAMA": "Kesim hizmeti",
            "MIKTAR": 2,
            "BIRIM": "Adet",
            "BIRIM_FIYAT": 600,
            "TUTAR": 1200,
        }
    ]

    mapping = (
        db_session.query(IntegrationEntityMap)
        .filter(IntegrationEntityMap.entity_type == "INVOICE", IntegrationEntityMap.internal_id == "inv-1")
        .first()
    )
    assert mapping is not None
    assert mapping.external_id == "FTR-001"
    assert mapping.external_system == "MIKRO"


def test_sync_account_from_mikro_updates_mapped_account(db_session):
    fake_client = FakeMikroClient()
    fake_client.account_payload = {
        "CARI_UNVAN": "Mikro Guncel Cari",
        "VERGI_NO": "9988776655",
        "VERGI_DAIRESI": "Kadikoy",
        "TELEFON1": "5554443322",
        "EMAIL": "mikro@example.com",
        "ADRES": "Mikro Mahallesi No:5",
        "IL": "Istanbul",
        "ILCE": "Atasehir",
        "KREDI_LIMIT": 25000,
        "BAKIYE": 1200,
    }
    db_session.add(
        CRMAccount(
            id="acc-pull",
            company_name="Eski Cari",
            mikro_cari_kod="CARI-001",
        )
    )
    db_session.add(
        IntegrationEntityMap(
            id="map-account-pull",
            entity_type="ACCOUNT",
            internal_id="acc-pull",
            external_id="CARI-001",
            external_system="MIKRO",
        )
    )
    db_session.commit()

    service = MikroSyncService(db_session, fake_client)
    result = service.sync_account_from_mikro("CARI-001")

    assert result == {"success": True, "account_id": "acc-pull", "message": "Güncellendi"}
    account = db_session.query(CRMAccount).filter(CRMAccount.id == "acc-pull").first()
    assert account is not None
    assert account.company_name == "Mikro Guncel Cari"
    assert account.tax_id == "9988776655"
    assert account.tax_office == "Kadikoy"
    assert account.phone == "5554443322"
    assert account.email == "mikro@example.com"
    assert account.address == "Mikro Mahallesi No:5"
    assert account.city == "Istanbul"
    assert account.district == "Atasehir"
    assert account.credit_limit == 25000
    assert account.balance == 1200


def test_sync_account_from_mikro_enqueues_inbox_when_mapping_missing(db_session):
    fake_client = FakeMikroClient()
    fake_client.account_payload = {"CARI_UNVAN": "Yeni Mikro Cari"}
    service = MikroSyncService(db_session, fake_client)

    result = service.sync_account_from_mikro("CARI-NEW-001")

    assert result == {"success": True, "message": "Inbox'a eklendi"}
    inbox_record = (
        db_session.query(IntegrationInbox)
        .filter(
            IntegrationInbox.entity_type == "ACCOUNT",
            IntegrationInbox.external_id == "CARI-NEW-001",
        )
        .first()
    )
    assert inbox_record is not None


def test_sync_quote_to_mikro_uses_external_system_mapping_field(db_session):
    fake_client = FakeMikroClient()
    service = MikroSyncService(db_session, fake_client)
    db_session.add(
        IntegrationEntityMap(
            id="map-account-quote",
            entity_type="ACCOUNT",
            internal_id="acc-quote",
            external_id="CARI-QUO-001",
            external_system="MIKRO",
        )
    )
    db_session.commit()

    result = service.sync_quote_to_mikro(
        "quo-1",
        {
            "account_id": "acc-quote",
            "revision": 3,
            "title": "Mutfak Teklifi",
            "created_at": "2026-03-13T09:30:00Z",
            "valid_until": "2026-04-01",
            "status": "HAZIRLANIYOR",
            "subtotal": 5000,
            "tax_rate": 20,
            "tax_amount": 1000,
            "total": 6000,
        },
        [
            {
                "product_code": "PRD-1",
                "description": "Kapak paneli",
                "quantity": 4,
                "unit_price": 1250,
                "line_total": 5000,
                "material_name": "Lake",
                "color": "Krem",
                "thickness_mm": 18,
                "dimensions": "720x450",
            }
        ],
    )

    assert result["success"] is True
    assert fake_client.created_quote_payload is not None
    assert fake_client.created_quote_payload["CARI_KOD"] == "CARI-QUO-001"
    assert fake_client.created_quote_payload["REVIZYON"] == 3
    assert fake_client.created_quote_payload["GENEL_TOPLAM"] == 6000
    assert fake_client.created_quote_lines == [
        {
            "TEKLIF_NO": "TKL-001",
            "SIRA_NO": 1,
            "STOK_KOD": "PRD-1",
            "ACIKLAMA": "Kapak paneli",
            "MIKTAR": 4,
            "BIRIM": "Adet",
            "BIRIM_FIYAT": 1250,
            "ISKONTO_ORAN": 0,
            "TUTAR": 5000,
            "MALZEME": "Lake",
            "RENK": "Krem",
            "KALINLIK": 18,
            "OLCU": "720x450",
            "DAMAR_YON": 0,
            "BANT_DAHIL": False,
            "DELME_DAHIL": False,
        }
    ]

    mapping = (
        db_session.query(IntegrationEntityMap)
        .filter(IntegrationEntityMap.entity_type == "QUOTE", IntegrationEntityMap.internal_id == "quo-1")
        .first()
    )
    assert mapping is not None
    assert mapping.external_id == "TKL-001"
    assert mapping.external_system == "MIKRO"


def test_sync_invoice_to_mikro_returns_read_only_code_when_mikro_is_locked(db_session):
    fake_client = FakeMikroClient()
    fake_client.read_only_mode = True
    service = MikroSyncService(db_session, fake_client)

    result = service.sync_invoice_to_mikro(
        "inv-readonly",
        {
            "account_id": "acc-invoice",
            "invoice_date": "2026-03-13",
        },
        [],
    )

    assert result["success"] is False
    assert result["code"] == "E_MIKRO_READ_ONLY"
    assert "sync_invoice_to_mikro" in result["error"]


def test_sync_quote_to_mikro_returns_read_only_code_when_mikro_is_locked(db_session):
    fake_client = FakeMikroClient()
    fake_client.read_only_mode = True
    service = MikroSyncService(db_session, fake_client)

    result = service.sync_quote_to_mikro(
        "quo-readonly",
        {
            "account_id": "acc-quote",
            "created_at": "2026-03-13T09:30:00Z",
        },
        [],
    )

    assert result["success"] is False
    assert result["code"] == "E_MIKRO_READ_ONLY"
    assert "sync_quote_to_mikro" in result["error"]


def test_sync_order_to_mikro_uses_verified_header_and_part_field_names(db_session):
    fake_client = FakeMikroClient()
    service = MikroSyncService(db_session, fake_client)

    result = service.sync_order_to_mikro(
        "ord-1",
        {
            "created_at": "2026-03-13T10:00:00Z",
            "status": "DRAFT",
            "total": 2450.5,
            "general_note": "Uretim notu",
            "delivery_date": "2026-03-20T00:00:00Z",
            "delivery_address": "Ikitelli OSB No:10",
            "payment_method": "HAVALE",
            "mikro_cari_kod": "CARI-777",
            "material_name": "BEYAZ MDFLAM",
        },
        [
            {
                "id": "part-1",
                "stok_kod": "STK-001",
                "part_desc": "Kapak",
                "adet": 2,
                "boy_mm": 600,
                "en_mm": 240,
                "material_name": "BEYAZ MDFLAM",
                "color": "Beyaz",
            }
        ],
    )

    assert result["success"] is True
    assert fake_client.created_order_payload is not None
    assert fake_client.created_order_payload["CARI_KOD"] == "CARI-777"
    assert fake_client.created_order_payload["GENEL_TOPLAM"] == 2450.5
    assert fake_client.created_order_payload["ACIKLAMA"] == "Uretim notu"
    assert fake_client.created_order_payload["TESLIM_TARIH"] == "2026-03-20T00:00:00Z"
    assert fake_client.created_order_payload["TESLIMAT_ADRES"] == "Ikitelli OSB No:10"
    assert fake_client.created_order_payload["ODEME_SEKLI"] == "HAVALE"

    assert fake_client.created_order_lines == [
        {
            "SIPARIS_NO": "SIP-001",
            "SIRA_NO": 1,
            "STOK_KOD": "STK-001",
            "ACIKLAMA": "Kapak",
            "MIKTAR": 2,
            "BIRIM": "Adet",
            "BIRIM_FIYAT": 0,
            "ISKONTO_ORAN": 0,
            "TUTAR": 0,
            "MALZEME": "BEYAZ MDFLAM",
            "RENK": "Beyaz",
            "OLCU": "600x240",
        }
    ]

    mapping = (
        db_session.query(IntegrationEntityMap)
        .filter(IntegrationEntityMap.entity_type == "ORDER", IntegrationEntityMap.internal_id == "ord-1")
        .first()
    )
    assert mapping is not None
    assert mapping.external_id == "SIP-001"
    assert mapping.external_system == "MIKRO"


def test_sync_order_to_mikro_requires_verified_account_reference(db_session):
    fake_client = FakeMikroClient()
    service = MikroSyncService(db_session, fake_client)

    result = service.sync_order_to_mikro(
        "ord-missing-account",
        {
            "created_at": "2026-03-13T10:00:00Z",
            "status": "DRAFT",
            "general_note": "Cari olmadan aktarim denemesi",
        },
        [],
    )

    assert result == {
        "success": False,
        "error": "Cari kodu olmadan ticari sipariş aktarımı tamamlanamaz",
        "code": "E_ORDER_ACCOUNT_REQUIRED",
    }
    assert fake_client.created_order_payload is None

    mapping = (
        db_session.query(IntegrationEntityMap)
        .filter(
            IntegrationEntityMap.entity_type == "ORDER",
            IntegrationEntityMap.internal_id == "ord-missing-account",
        )
        .first()
    )
    assert mapping is None


def test_sync_order_to_mikro_resolves_account_code_from_crm_account(db_session):
    fake_client = FakeMikroClient()
    service = MikroSyncService(db_session, fake_client)
    db_session.add(
        CRMAccount(
            id="crm-order-1",
            company_name="Bagli Cari",
            mikro_cari_kod="CARI-CRM-001",
            is_active=True,
        )
    )
    db_session.commit()

    result = service.sync_order_to_mikro(
        "ord-crm-account",
        {
            "crm_account_id": "crm-order-1",
            "created_at": "2026-03-13T10:00:00Z",
            "status": "DRAFT",
            "total": 1200,
            "delivery_date": "2026-03-22T00:00:00Z",
            "delivery_address": "Basaksehir 1. Etap",
            "payment_method": "CEK",
        },
        [
            {
                "id": "part-1",
                "stok_kod": "STK-CRM-001",
                "adet": 1,
                "boy_mm": 500,
                "en_mm": 300,
            }
        ],
    )

    assert result["success"] is True
    assert fake_client.created_order_payload is not None
    assert fake_client.created_order_payload["CARI_KOD"] == "CARI-CRM-001"
    assert fake_client.created_order_lines[0]["STOK_KOD"] == "STK-CRM-001"


def test_sync_order_to_mikro_requires_verified_stock_reference(db_session):
    fake_client = FakeMikroClient()
    service = MikroSyncService(db_session, fake_client)

    result = service.sync_order_to_mikro(
        "ord-missing-stock",
        {
            "created_at": "2026-03-13T10:00:00Z",
            "status": "DRAFT",
            "mikro_cari_kod": "CARI-777",
            "delivery_date": "2026-03-22T00:00:00Z",
            "delivery_address": "Ikitelli OSB No:10",
            "payment_method": "HAVALE",
        },
        [
            {
                "id": "part-no-stock",
                "adet": 2,
                "boy_mm": 600,
                "en_mm": 240,
            }
        ],
    )

    assert result == {
        "success": False,
        "error": "Stok kodu olmadan sipariş satiri aktarımı tamamlanamaz: part-no-stock",
        "code": "E_ORDER_STOCK_REQUIRED",
    }
    assert fake_client.created_order_payload is None
    assert fake_client.created_order_lines == []


def test_sync_order_to_mikro_requires_delivery_date_for_commercial_transfer(db_session):
    fake_client = FakeMikroClient()
    service = MikroSyncService(db_session, fake_client)

    result = service.sync_order_to_mikro(
        "ord-missing-delivery-date",
        {
            "created_at": "2026-03-13T10:00:00Z",
            "status": "DRAFT",
            "mikro_cari_kod": "CARI-777",
            "delivery_address": "Ikitelli OSB No:10",
            "payment_method": "HAVALE",
        },
        [],
    )

    assert result == {
        "success": False,
        "error": "Teslim tarihi olmadan ticari sipariş aktarımı tamamlanamaz",
        "code": "E_ORDER_DELIVERY_DATE_REQUIRED",
    }
    assert fake_client.created_order_payload is None


def test_sync_order_to_mikro_requires_delivery_address_for_commercial_transfer(db_session):
    fake_client = FakeMikroClient()
    service = MikroSyncService(db_session, fake_client)

    result = service.sync_order_to_mikro(
        "ord-missing-delivery-address",
        {
            "created_at": "2026-03-13T10:00:00Z",
            "status": "DRAFT",
            "mikro_cari_kod": "CARI-777",
            "delivery_date": "2026-03-22T00:00:00Z",
            "payment_method": "HAVALE",
        },
        [],
    )

    assert result == {
        "success": False,
        "error": "Teslimat adresi olmadan ticari sipariş aktarımı tamamlanamaz",
        "code": "E_ORDER_DELIVERY_ADDRESS_REQUIRED",
    }
    assert fake_client.created_order_payload is None


def test_sync_order_to_mikro_requires_payment_method_for_commercial_transfer(db_session):
    fake_client = FakeMikroClient()
    service = MikroSyncService(db_session, fake_client)

    result = service.sync_order_to_mikro(
        "ord-missing-payment-method",
        {
            "created_at": "2026-03-13T10:00:00Z",
            "status": "DRAFT",
            "mikro_cari_kod": "CARI-777",
            "delivery_date": "2026-03-22T00:00:00Z",
            "delivery_address": "Ikitelli OSB No:10",
        },
        [],
    )

    assert result == {
        "success": False,
        "error": "Odeme sekli olmadan ticari sipariş aktarımı tamamlanamaz",
        "code": "E_ORDER_PAYMENT_METHOD_REQUIRED",
    }
    assert fake_client.created_order_payload is None

