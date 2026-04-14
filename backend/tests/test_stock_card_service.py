"""
Stok Kartı Servisi — birim testleri.

Kapsam:
- _ensure_non_negative: negatif / tip hatası
- _normalize_barcodes: boş / çakışan / normal
- _normalize_sale_prices: boş / çakışan / negatif
- create / get_by_id / update / delete / list
- get_low_stock_items / get_stock_summary_stats
"""

from pathlib import Path
import sys

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base
from app.exceptions import ValidationError
from app.services.stock_card_service import StockCardService


# ─── fixture ──────────────────────────────────────────────────────────────────

@pytest.fixture()
def db_session():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)
    Base.metadata.create_all(bind=engine)
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()
        engine.dispose()


@pytest.fixture()
def svc(db_session):
    return StockCardService(db_session)


def _base_data(**overrides):
    data = {
        "stock_code": "STK001",
        "stock_name": "Test Stok",
        "unit": "Adet",
        "total_quantity": 100.0,
    }
    data.update(overrides)
    return data


# ─── _ensure_non_negative ─────────────────────────────────────────────────────

class TestEnsureNonNegative:
    def test_positive_value_returned(self):
        assert StockCardService._ensure_non_negative(5, "alan") == 5.0

    def test_zero_is_valid(self):
        assert StockCardService._ensure_non_negative(0, "alan") == 0.0

    def test_negative_raises(self):
        with pytest.raises(ValidationError, match="negatif olamaz"):
            StockCardService._ensure_non_negative(-1, "alan")

    def test_string_numeric_accepted(self):
        assert StockCardService._ensure_non_negative("3.14", "alan") == pytest.approx(3.14)

    def test_non_numeric_string_raises(self):
        with pytest.raises(ValidationError, match="sayısal olmalıdır"):
            StockCardService._ensure_non_negative("abc", "alan")

    def test_none_raises(self):
        with pytest.raises(ValidationError, match="sayısal olmalıdır"):
            StockCardService._ensure_non_negative(None, "alan")


# ─── _normalize_barcodes ─────────────────────────────────────────────────────

class TestNormalizeBarcodes:
    def test_none_returns_empty(self, svc):
        assert svc._normalize_barcodes(None) == []

    def test_empty_list_returns_empty(self, svc):
        assert svc._normalize_barcodes([]) == []

    def test_plain_strings_accepted(self, svc):
        result = svc._normalize_barcodes(["BC001", "BC002"])
        assert result == ["BC001", "BC002"]

    def test_dict_items_accepted(self, svc):
        result = svc._normalize_barcodes([{"barcode": "BC001"}])
        assert result == ["BC001"]

    def test_empty_barcode_raises(self, svc):
        with pytest.raises(ValidationError, match="Barkod boş olamaz"):
            svc._normalize_barcodes([""])

    def test_duplicate_raises(self, svc):
        with pytest.raises(ValidationError, match="tekrar edemez"):
            svc._normalize_barcodes(["BC001", "bc001"])  # case-insensitive

    def test_non_list_raises(self, svc):
        with pytest.raises(ValidationError, match="dizi olmalıdır"):
            svc._normalize_barcodes("BC001")


# ─── _normalize_sale_prices ──────────────────────────────────────────────────

class TestNormalizeSalePrices:
    def test_none_returns_empty(self, svc):
        assert svc._normalize_sale_prices(None) == []

    def test_valid_entry(self, svc):
        result = svc._normalize_sale_prices([{"price_type": "PERAKENDE", "amount": 10.0}])
        assert len(result) == 1
        assert result[0]["price_type"] == "PERAKENDE"
        assert result[0]["amount"] == pytest.approx(10.0)

    def test_duplicate_price_type_raises(self, svc):
        with pytest.raises(ValidationError, match="tekrar edemez"):
            svc._normalize_sale_prices([
                {"price_type": "A", "amount": 1},
                {"price_type": "a", "amount": 2},
            ])

    def test_missing_price_type_raises(self, svc):
        with pytest.raises(ValidationError, match="Fiyat tipi zorunludur"):
            svc._normalize_sale_prices([{"price_type": "", "amount": 5}])

    def test_negative_amount_raises(self, svc):
        with pytest.raises(ValidationError, match="negatif olamaz"):
            svc._normalize_sale_prices([{"price_type": "A", "amount": -1}])

    def test_non_list_raises(self, svc):
        with pytest.raises(ValidationError, match="dizi olmalıdır"):
            svc._normalize_sale_prices({"price_type": "A", "amount": 5})

    def test_non_dict_item_raises(self, svc):
        with pytest.raises(ValidationError, match="nesne olmalıdır"):
            svc._normalize_sale_prices(["PERAKENDE"])


# ─── create / get_by_id ──────────────────────────────────────────────────────

class TestStockCardCRUD:
    def test_create_minimal(self, svc):
        card = svc.create(_base_data())
        assert card.id.startswith("stk_")
        assert card.stock_code == "STK001"
        assert card.available_quantity == 100.0

    def test_create_strips_whitespace(self, svc):
        card = svc.create(_base_data(stock_code="  STK002  ", stock_name="  Ad  ", unit="  Kg  "))
        assert card.stock_code == "STK002"
        assert card.unit == "Kg"

    def test_create_missing_code_raises(self, svc):
        with pytest.raises(ValidationError, match="Stok kodu zorunludur"):
            svc.create({"stock_name": "Ad", "unit": "Adet", "total_quantity": 0})

    def test_create_missing_name_raises(self, svc):
        with pytest.raises(ValidationError, match="Stok adı zorunludur"):
            svc.create({"stock_code": "X", "unit": "Adet", "total_quantity": 0})

    def test_create_missing_unit_raises(self, svc):
        with pytest.raises(ValidationError, match="Birim zorunludur"):
            svc.create({"stock_code": "X", "stock_name": "Ad", "total_quantity": 0})

    def test_create_duplicate_code_raises(self, svc):
        svc.create(_base_data())
        with pytest.raises(Exception):
            svc.create(_base_data())

    def test_get_by_id_found(self, svc):
        card = svc.create(_base_data())
        fetched = svc.get_by_id(card.id)
        assert fetched is not None
        assert fetched.stock_code == "STK001"

    def test_get_by_id_missing(self, svc):
        assert svc.get_by_id("nonexistent_id") is None

    def test_create_with_negative_quantity_raises(self, svc):
        with pytest.raises(ValidationError, match="negatif olamaz"):
            svc.create(_base_data(total_quantity=-5))

    def test_create_with_barcodes(self, svc):
        card = svc.create(_base_data(barkodlar=["BC001", "BC002"]))
        assert len(card.barcodes) == 2

    def test_create_with_sale_prices(self, svc):
        card = svc.create(_base_data(
            satis_fiyatlari=[{"price_type": "PERAKENDE", "amount": 25.0}]
        ))
        assert len(card.sale_prices) == 1


# ─── list ────────────────────────────────────────────────────────────────────

class TestStockCardList:
    def _create_cards(self, svc, n: int):
        for i in range(n):
            svc.create(_base_data(stock_code=f"STK{i:03d}", stock_name=f"Stok {i}"))

    def test_list_default(self, svc):
        self._create_cards(svc, 5)
        result = svc.list()
        assert len(result) == 5

    def test_list_limit(self, svc):
        self._create_cards(svc, 5)
        result = svc.list(limit=2)
        assert len(result) == 2

    def test_list_skip(self, svc):
        self._create_cards(svc, 5)
        result = svc.list(skip=3)
        assert len(result) == 2

    def test_list_limit_capped_at_1000(self, svc):
        result = svc.list(limit=9999)
        assert isinstance(result, list)

    def test_deleted_cards_excluded(self, svc):
        card = svc.create(_base_data())
        svc.delete(card.id)
        result = svc.list()
        assert len(result) == 0


# ─── update ──────────────────────────────────────────────────────────────────

class TestStockCardUpdate:
    def test_update_name(self, svc):
        card = svc.create(_base_data())
        updated = svc.update(card.id, {"stock_name": "Yeni Ad"})
        assert updated is not None
        assert updated.stock_name == "Yeni Ad"

    def test_update_missing_returns_none(self, svc):
        result = svc.update("nonexistent_id", {"stock_name": "Ad"})
        assert result is None

    def test_update_empty_name_raises(self, svc):
        card = svc.create(_base_data())
        with pytest.raises(ValidationError, match="boş olamaz"):
            svc.update(card.id, {"stock_name": ""})


# ─── delete ──────────────────────────────────────────────────────────────────

class TestStockCardDelete:
    def test_delete_returns_true(self, svc):
        card = svc.create(_base_data())
        assert svc.delete(card.id) is True

    def test_delete_hides_from_get_by_id(self, svc):
        card = svc.create(_base_data())
        svc.delete(card.id)
        assert svc.get_by_id(card.id) is None

    def test_delete_missing_returns_false(self, svc):
        assert svc.delete("nonexistent_id") is False


# ─── get_low_stock_items ─────────────────────────────────────────────────────

class TestGetLowStockItems:
    def test_returns_below_threshold(self, svc):
        svc.create(_base_data(stock_code="LOW", available_quantity=3))
        svc.create(_base_data(stock_code="OK", available_quantity=50))
        low = svc.get_low_stock_items(threshold_quantity=10)
        codes = [item["stock_code"] for item in low]
        assert "LOW" in codes
        assert "OK" not in codes

    def test_empty_when_all_above_threshold(self, svc):
        svc.create(_base_data(stock_code="OK", available_quantity=100))
        low = svc.get_low_stock_items(threshold_quantity=10)
        assert low == []


# ─── get_stock_summary_stats ─────────────────────────────────────────────────

class TestGetStockSummaryStats:
    def test_returns_expected_keys(self, svc):
        stats = svc.get_stock_summary_stats()
        assert "total_stock_cards" in stats
        assert "active_stock_cards" in stats
        assert "inactive_stock_cards" in stats
        assert "total_stock_movements" in stats

    def test_counts_after_create(self, svc):
        svc.create(_base_data())
        stats = svc.get_stock_summary_stats()
        assert stats["total_stock_cards"] == 1
        assert stats["active_stock_cards"] == 1
        assert stats["inactive_stock_cards"] == 0
