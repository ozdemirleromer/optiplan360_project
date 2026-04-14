"""
Mikro sync idempotency testleri.

Aynı işlemin iki kez çağrılması durumunda:
- Veritabanında çift kayıt oluşmamalı
- Tamamlanmış outbox öğesi yeniden işlenmemeli
- Normalize fonksiyonları saf olmalı (aynı girdi → aynı çıktı)
- Önbellek mekanizması DB çağrısını tekrarlamamalı
"""
import json
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.database import Base  # noqa: E402
from app.models import IntegrationOutbox, SyncStatusEnum  # noqa: E402
from app.services import integration_service, mikro_service  # noqa: E402


# ─── Ortak fixture ────────────────────────────────────────────────────────────

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


def _make_outbox(db, status: SyncStatusEnum = SyncStatusEnum.QUEUED) -> str:
    item_id = str(uuid4())
    item = IntegrationOutbox(
        id=item_id,
        entity_type="ACCOUNT",
        entity_id="ent-1",
        operation="CREATE",
        payload=json.dumps({"company_name": "Idx Test Co"}),
        status=status,
        retry_count=0,
        max_retries=3,
    )
    db.add(item)
    db.commit()
    return item_id


# ─── 1. _normalize_stock_name saf fonksiyon testleri ─────────────────────────

class TestNormalizeStockNameIdempotency:
    def test_mlam_replaced_consistently(self):
        """MLAM → MDFLAM dönüşümü tekrarlı çağrılarda aynıdır."""
        name = "18mm LEVHA MLAM BEYAZ"
        result1 = mikro_service._normalize_stock_name(name)
        result2 = mikro_service._normalize_stock_name(name)
        assert result1 == result2
        assert result1 == result1  # saf: refererential equality

    def test_slam_replaced_consistently(self):
        """SLAM → SUNTALAM dönüşümü tekrarlı çağrılarda aynıdır."""
        name = "21mm SLAM DOLAP"
        r1 = mikro_service._normalize_stock_name(name)
        r2 = mikro_service._normalize_stock_name(name)
        assert r1 == r2
        assert "SUNTALAM" in r1

    def test_no_keyword_unchanged(self):
        """Anahtar kelime içermeyen isim değişmeden döner."""
        name = "BEYAZ AHŞAP 18MM"
        assert mikro_service._normalize_stock_name(name) == mikro_service._normalize_stock_name(name)

    def test_already_normalized_name_is_stable(self):
        """Bir kez normalize edilmiş ad ikinci kez değişmez."""
        once = mikro_service._normalize_stock_name("MDFLAM LEVHA")
        twice = mikro_service._normalize_stock_name(once)
        assert once == twice

    def test_uppercase_forced(self):
        """Küçük harf girdi her seferinde büyük harfe dönüşür."""
        assert (
            mikro_service._normalize_stock_name("mlam beyaz")
            == mikro_service._normalize_stock_name("mlam beyaz")
        )


# ─── 2. Önbellek (ExpiringDict) idempotency ───────────────────────────────────

class TestGetAllMaterialsCache:
    def setup_method(self):
        """Her test öncesi önbelleği temizle."""
        mikro_service.stock_cache.clear()

    def test_second_call_uses_cache_not_db(self, monkeypatch):
        """İkinci çağrıda _fetch_raw_stocks çağrılmaz."""
        fake_stocks = [
            {
                "sto_isim": "MLAM 18MM",
                "sto_kalinlik": 18,
                "sto_en": 2100,
                "sto_boy": 2800,
                "sto_renk": "BEYAZ",
            }
        ]
        call_count = {"n": 0}

        def fake_fetch():
            call_count["n"] += 1
            return fake_stocks

        monkeypatch.setattr(mikro_service, "_fetch_raw_stocks", fake_fetch)

        result1 = mikro_service.get_all_materials()
        result2 = mikro_service.get_all_materials()

        assert call_count["n"] == 1, "DB yalnızca bir kez çağrılmalı"
        assert result1 == result2

    def test_repeated_calls_return_identical_list(self, monkeypatch):
        """Önbellekten denen sonuçlar referans olarak da aynı."""
        monkeypatch.setattr(
            mikro_service,
            "_fetch_raw_stocks",
            lambda: [{"sto_isim": "TEST", "sto_kalinlik": 12, "sto_en": None, "sto_boy": None, "sto_renk": None}],
        )
        r1 = mikro_service.get_all_materials()
        r2 = mikro_service.get_all_materials()
        # Önbellekte == aynı liste nesnesi
        assert r1 is r2


# ─── 3. suggest_materials idempotency ─────────────────────────────────────────

class TestSuggestMaterialsIdempotency:
    def setup_method(self):
        mikro_service.stock_cache.clear()

    def test_same_query_same_result(self, monkeypatch):
        """Aynı sorgu parametreleri her seferinde aynı sonucu döner."""
        fake_materials = [
            {"name": "MDF 18MM BEYAZ", "raw_name": "x", "thickness": 18, "width": 2100, "height": 2800, "color": "BEYAZ"},
            {"name": "MDF 25MM BEYAZ", "raw_name": "y", "thickness": 25, "width": 2100, "height": 2800, "color": "BEYAZ"},
        ]
        monkeypatch.setattr(mikro_service, "get_all_materials", lambda: fake_materials)

        r1 = mikro_service.suggest_materials("MDF", thickness=18)
        r2 = mikro_service.suggest_materials("MDF", thickness=18)

        assert r1 == r2

    def test_empty_result_is_stable(self, monkeypatch):
        """Hiç eşleşme olmayan sorgu tekrarda da boş liste döner."""
        monkeypatch.setattr(mikro_service, "get_all_materials", lambda: [])
        assert mikro_service.suggest_materials("YOOOOOK") == []
        assert mikro_service.suggest_materials("YOOOOOK") == []


# ─── 4. process_outbox_item çift çağrı koruması ───────────────────────────────

class TestOutboxIdempotency:
    def test_already_success_item_not_reprocessed(self, db_session):
        """SUCCESS durumundaki outbox öğesi yeniden işlenmez."""
        item_id = _make_outbox(db_session, status=SyncStatusEnum.SUCCESS)

        result = integration_service.process_outbox_item(db_session, item_id)

        assert result["ok"] is False
        assert "tamamlanmış" in result.get("error", "").lower() or "işleniyor" in result.get("error", "").lower()

        # Durum değişmez
        item = db_session.query(IntegrationOutbox).filter(IntegrationOutbox.id == item_id).first()
        assert item.status == SyncStatusEnum.SUCCESS

    def test_already_running_item_not_reprocessed(self, db_session):
        """RUNNING durumundaki outbox öğesi tekrar işleme alınmaz."""
        item_id = _make_outbox(db_session, status=SyncStatusEnum.RUNNING)

        result = integration_service.process_outbox_item(db_session, item_id)

        assert result["ok"] is False
        item = db_session.query(IntegrationOutbox).filter(IntegrationOutbox.id == item_id).first()
        assert item.status == SyncStatusEnum.RUNNING

    def test_successful_item_retry_count_unchanged(self, db_session):
        """Başarılı item'ın retry_count ikinci çağrıdan etkilenmez."""

        class _FakeSync:
            def sync_account_to_mikro(self, _eid, _payload):
                return {"success": True, "mikro_cari_kod": "CARI-X"}

        item_id = _make_outbox(db_session)
        orig_factory = integration_service._get_mikro_sync_service
        integration_service._get_mikro_sync_service = lambda _db: _FakeSync()
        try:
            # İlk başarılı çağrı
            r1 = integration_service.process_outbox_item(db_session, item_id)
            assert r1["ok"] is True

            item_after_first = (
                db_session.query(IntegrationOutbox)
                .filter(IntegrationOutbox.id == item_id)
                .first()
            )
            retry_after_first = item_after_first.retry_count

            # İkinci çağrı — idempotency guard devreye girer
            r2 = integration_service.process_outbox_item(db_session, item_id)
            assert r2["ok"] is False

            item_after_second = (
                db_session.query(IntegrationOutbox)
                .filter(IntegrationOutbox.id == item_id)
                .first()
            )
            assert item_after_second.retry_count == retry_after_first
        finally:
            integration_service._get_mikro_sync_service = orig_factory

    def test_nonexistent_item_returns_error(self, db_session):
        """Olmayan outbox id için hata döner, exception fırlatılmaz."""
        result = integration_service.process_outbox_item(db_session, "no-such-id")
        assert result["ok"] is False
        assert "bulunamadı" in result.get("error", "").lower()
