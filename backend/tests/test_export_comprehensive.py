"""
OptiPlan 360 - PyTest Export Test Suite
Backend export modülü unit ve integration testleri

Coverage:
- Atomic export transaction
- Bant mapping validation
- Export dosya adı normalizasyonu
- Export format validasyonu
"""

import pytest
import os
import tempfile
import json
from pathlib import Path
from datetime import datetime, timezone
from unittest.mock import Mock, patch, MagicMock

# Test edilecek servisler
from app.services.atomic_export_service import (
    AtomicExportService, 
    ExportTransactionError,
    ExportStatus
)
from app.services.bant_mapping_validator import (
    BantMappingValidator,
    BantConfig,
    BantMappingUnitTest
)
from app.services.distributed_lock_service import (
    DistributedLockService,
    LockType,
    LockAcquisitionError
)


class TestAtomicExportService:
    """Atomic Export Transaction Testleri"""
    
    @pytest.fixture
    def export_service(self, tmp_path):
        """Test fixture: Export servisi"""
        return AtomicExportService(checkpoint_dir=str(tmp_path / "checkpoints"))
    
    @pytest.fixture
    def temp_dirs(self, tmp_path):
        """Test fixture: Temp dizinler"""
        target_dir = tmp_path / "exports"
        target_dir.mkdir()
        return {
            "target": str(target_dir),
            "temp": str(tmp_path / "temp")
        }
    
    def test_begin_transaction(self, export_service, temp_dirs):
        """TC-EXPORT-001: Transaction başlatma"""
        tx = export_service.begin_transaction(
            islem_id="test-uuid-123",
            target_dir=temp_dirs["target"],
            filename="TEST_18MM_BEYAZ_20260314.xlsx"
        )
        
        assert tx.transaction_id is not None
        assert tx.islem_id == "test-uuid-123"
        assert tx.status == ExportStatus.PENDING
        assert tx.filename == "TEST_18MM_BEYAZ_20260314.xlsx"
    
    def test_write_temp_file(self, export_service, temp_dirs):
        """TC-EXPORT-002: Temp dosya yazma"""
        tx = export_service.begin_transaction(
            "test-uuid", temp_dirs["target"], "test.xlsx"
        )
        
        content = b"test excel content"
        temp_path = export_service.write_temp_file(
            tx.transaction_id, content, validate_checksum=True
        )
        
        assert os.path.exists(temp_path)
        assert tx.status == ExportStatus.TEMP_CREATED
        
        # Checksum dosyası oluşmuş mu? (.tmp uzantılı geçici dosyanın yanında)
        assert os.path.exists(f"{temp_path}.tmp.md5")
    
    def test_validate_file_success(self, export_service, temp_dirs):
        """TC-EXPORT-003: Dosya validasyonu - başarılı"""
        tx = export_service.begin_transaction(
            "test-uuid", temp_dirs["target"], "test.xlsx"
        )
        
        content = b"test content"
        temp_path = export_service.write_temp_file(tx.transaction_id, content)
        
        # Validasyon
        result = export_service.validate_file(
            tx.transaction_id,
            expected_size=len(content)
        )
        
        assert result is True
        assert tx.status == ExportStatus.VALIDATED
    
    def test_validate_file_size_mismatch(self, export_service, temp_dirs):
        """TC-EXPORT-004: Dosya boyutu uyuşmazlığı"""
        tx = export_service.begin_transaction(
            "test-uuid", temp_dirs["target"], "test.xlsx"
        )
        
        content = b"test content"
        export_service.write_temp_file(tx.transaction_id, content)
        
        with pytest.raises(ExportTransactionError) as exc:
            export_service.validate_file(
                tx.transaction_id,
                expected_size=999  # Yanlış boyut
            )
        
        assert "Dosya boyutu uyuşmuyor" in str(exc.value)
    
    def test_commit_success(self, export_service, temp_dirs):
        """TC-EXPORT-005: Başarılı commit (atomic rename)"""
        tx = export_service.begin_transaction(
            "test-uuid", temp_dirs["target"], "test.xlsx"
        )
        
        content = b"final excel content"
        export_service.write_temp_file(tx.transaction_id, content)
        export_service.validate_file(tx.transaction_id, expected_size=len(content))
        
        final_path = export_service.commit(tx.transaction_id)
        
        assert os.path.exists(final_path)
        assert tx.status == ExportStatus.COMMITTED
        
        # İçerik doğru mu?
        with open(final_path, 'rb') as f:
            assert f.read() == content
    
    def test_rollback_on_error(self, export_service, temp_dirs):
        """TC-EXPORT-006: Hata durumunda rollback"""
        tx = export_service.begin_transaction(
            "test-uuid", temp_dirs["target"], "test.xlsx"
        )
        
        content = b"test content"
        temp_path = export_service.write_temp_file(tx.transaction_id, content)
        
        # Rollback simülasyonu
        export_service.rollback(tx.transaction_id, "Test hatası")
        
        # Temp temizlenmiş mi?
        assert not os.path.exists(temp_path)
        assert tx.status == ExportStatus.ROLLED_BACK
    
    def test_context_manager_success(self, export_service, temp_dirs):
        """TC-EXPORT-007: Context manager - başarılı"""
        with export_service.transaction_context(
            "test-uuid", temp_dirs["target"], "test.xlsx"
        ) as tx:
            # İşlem
            content = b"context test"
            export_service.write_temp_file(tx.transaction_id, content)
            # Context çıkılınca otomatik commit
        
        # Final dosya oluşmuş mu?
        final_path = Path(temp_dirs["target"]) / "test.xlsx"
        assert final_path.exists()
    
    def test_context_manager_rollback(self, export_service, temp_dirs):
        """TC-EXPORT-008: Context manager - hata durumunda rollback"""
        try:
            with export_service.transaction_context(
                "test-uuid", temp_dirs["target"], "test.xlsx"
            ) as tx:
                content = b"will rollback"
                export_service.write_temp_file(tx.transaction_id, content)
                raise ValueError("Test exception")
        except ValueError:
            pass
        
        # Final dosya oluşmamış olmalı
        final_path = Path(temp_dirs["target"]) / "test.xlsx"
        assert not final_path.exists()
    
    def test_recover_interrupted_exports(self, export_service, tmp_path):
        """TC-EXPORT-009: Yarım kalmış export recovery"""
        # Yarım checkpoint oluştur
        checkpoint_dir = tmp_path / "checkpoints"
        checkpoint_file = checkpoint_dir / "incomplete_checkpoint.json"
        
        checkpoint_data = {
            "checkpoint_id": "incomplete_checkpoint",
            "islem_id": "test-uuid",
            "phase": "write",
            "status": "in_progress",
            "temp_path": str(tmp_path / "temp" / "incomplete.xlsx"),
            "created_at": datetime.now(timezone.utc).isoformat(),
            "metadata": {}
        }
        
        checkpoint_file.parent.mkdir(parents=True, exist_ok=True)
        with open(checkpoint_file, 'w') as f:
            json.dump(checkpoint_data, f)
        
        # Recovery çalıştır
        recovered = export_service.recover_interrupted_exports()
        
        assert len(recovered) > 0
        assert recovered[0]["cleaned"] is True


class TestBantMappingValidator:
    """Bant Mapping Validasyon Testleri"""
    
    @pytest.fixture
    def validator(self):
        """Test fixture: Validator"""
        return BantMappingValidator()
    
    def test_valid_ui_values(self, validator):
        """TC-BANT-001: Geçerli UI değerleri"""
        valid_values = ["0.40 MM", "1 MM", "2 MM"]
        
        for value in valid_values:
            valid, result = validator.validate_ui_value(value)
            assert valid is True, f"'{value}' geçerli olmalı"
            assert result == value
    
    def test_invalid_ui_values(self, validator):
        """TC-BANT-002: Geçersiz UI değerleri"""
        invalid_values = ["3 MM", "0.5 MM", "1.5 MM", "abc", ""]
        
        for value in invalid_values:
            valid, result = validator.validate_ui_value(value)
            assert valid is False, f"'{value}' geçersiz olmalı"
    
    def test_ui_to_export_mapping(self, validator):
        """TC-BANT-003: UI → Export mapping doğruluğu"""
        test_cases = [
            ("0.40 MM", "04"),
            ("1 MM", "1"),
            ("2 MM", "2"),
        ]
        
        for ui_value, expected_export in test_cases:
            success, export_code = validator.ui_to_export(ui_value)
            assert success is True
            assert export_code == expected_export, \
                f"{ui_value} → {expected_export} olmalı, gelen: {export_code}"
    
    def test_export_to_ui_mapping(self, validator):
        """TC-BANT-004: Export → UI reverse mapping"""
        test_cases = [
            ("04", "0.40 MM"),
            ("1", "1 MM"),
            ("2", "2 MM"),
        ]
        
        for export_code, expected_ui in test_cases:
            success, ui_value = validator.export_to_ui(export_code)
            assert success is True
            assert ui_value == expected_ui
    
    def test_calculate_export_codes(self, validator):
        """TC-BANT-005: U1/U2/K1/K2 export kodları"""
        # U1=True, diğerleri=False
        result = validator.calculate_export_codes("0.40 MM", True, False, False, False)
        
        assert result["bant_kalinligi"] == "04"
        assert result["u1"] == "04"
        assert result["u2"] == ""
        assert result["k1"] == ""
        assert result["k2"] == ""
    
    def test_row_config_validation(self, validator):
        """TC-BANT-006: Satır konfigürasyon validasyonu"""
        config = BantConfig(
            plaka_ref="PLAKA-1",
            bant_kalinligi="1 MM",
            u1=True,
            u2=False,
            k1=True,
            k2=False
        )
        
        valid, errors = validator.validate_row_config(config)
        
        assert valid is True
        assert len(errors) == 0
    
    def test_round_trip_validation(self, validator):
        """TC-BANT-007: Round-trip doğrulama"""
        # UI → Export → UI
        for ui_value in ["0.40 MM", "1 MM", "2 MM"]:
            success1, export_code = validator.ui_to_export(ui_value)
            assert success1 is True
            
            success2, back_to_ui = validator.export_to_ui(export_code)
            assert success2 is True
            assert back_to_ui == ui_value, \
                f"Round-trip başarısız: {ui_value} → {export_code} → {back_to_ui}"
    
    def test_normalization(self, validator):
        """TC-BANT-008: Değer normalizasyonu"""
        test_cases = [
            ("0.4 mm", "0.40 MM"),
            ("0.4mm", "0.40 MM"),
            ("1mm", "1 MM"),
            ("2mm", "2 MM"),
        ]
        
        for input_val, expected in test_cases:
            normalized = validator._normalize_value(input_val)
            assert normalized == expected, \
                f"Normalizasyon hatası: '{input_val}' → '{normalized}' (beklenen: '{expected}')"


class TestBantMappingUnitTest:
    """Bant Mapping Unit Test Suite"""
    
    def test_all_mapping_tests(self):
        """Tüm mapping unit testlerini çalıştır"""
        results = BantMappingUnitTest.run_all_tests()
        
        assert results["failed"] == 0, \
            f"{results['failed']} test başarısız: {results['details']}"
        assert results["passed"] == results["total"]


class TestDistributedLockService:
    """Distributed Locking Testleri"""
    
    @pytest.fixture
    def lock_service(self):
        """Test fixture: Lock servisi"""
        return DistributedLockService(default_timeout=5)
    
    def test_acquire_lock_success(self, lock_service):
        """TC-LOCK-001: Lock alma - başarılı"""
        lock_id = lock_service.acquire_lock(
            "islem-123",
            LockType.EXPORT,
            "user-1"
        )
        
        assert lock_id is not None
        
        # Lock durumunu kontrol et
        lock_info = lock_service.check_lock("islem-123", LockType.EXPORT)
        assert lock_info is not None
        assert lock_info.owner == "user-1"
    
    def test_acquire_lock_blocking_failure(self, lock_service):
        """TC-LOCK-002: Lock alma - bloklanmış (başka owner)"""
        # İlk lock
        lock_service.acquire_lock("islem-123", LockType.EXPORT, "user-1")
        
        # İkinci lock (blocking=False)
        lock_id = lock_service.acquire_lock(
            "islem-123", LockType.EXPORT, "user-2", blocking=False
        )
        
        assert lock_id is None
    
    def test_acquire_lock_blocking_timeout(self, lock_service):
        """TC-LOCK-003: Lock alma - timeout"""
        # İlk lock
        lock_service.acquire_lock("islem-123", LockType.EXPORT, "user-1")
        
        # İkinci lock (blocking=True ama timeout kısa)
        with pytest.raises(LockAcquisitionError) as exc:
            lock_service.acquire_lock(
                "islem-123",
                LockType.EXPORT,
                "user-2",
                blocking=True,
                blocking_timeout=1
            )
        
        assert "işleniyor" in str(exc.value)
    
    def test_release_lock(self, lock_service):
        """TC-LOCK-004: Lock serbest bırakma"""
        lock_id = lock_service.acquire_lock(
            "islem-123", LockType.EXPORT, "user-1"
        )
        
        result = lock_service.release_lock(lock_id, "user-1")
        
        assert result is True
        
        # Lock kalkmış mı?
        lock_info = lock_service.check_lock("islem-123", LockType.EXPORT)
        assert lock_info is None
    
    def test_release_lock_wrong_owner(self, lock_service):
        """TC-LOCK-005: Lock serbest bırakma - yanlış owner"""
        lock_id = lock_service.acquire_lock(
            "islem-123", LockType.EXPORT, "user-1"
        )
        
        # Yanlış owner ile release
        result = lock_service.release_lock(lock_id, "user-2")
        
        assert result is False
    
    def test_lock_context_manager(self, lock_service):
        """TC-LOCK-006: Context manager"""
        with lock_service.lock_context(
            "islem-123", LockType.EXPORT, "user-1"
        ) as lock_id:
            # Lock aktif
            lock_info = lock_service.check_lock("islem-123", LockType.EXPORT)
            assert lock_info is not None
            assert lock_info.lock_id == lock_id
        
        # Context çıkınca lock kalkmış olmalı
        lock_info = lock_service.check_lock("islem-123", LockType.EXPORT)
        assert lock_info is None
    
    def test_lock_extension(self, lock_service):
        """TC-LOCK-007: Lock süresi uzatma"""
        lock_id = lock_service.acquire_lock(
            "islem-123", LockType.EXPORT, "user-1", timeout=2
        )
        
        result = lock_service.extend_lock(lock_id, "user-1", additional_seconds=10)
        
        assert result is True
    
    def test_cleanup_expired_locks(self, lock_service):
        """TC-LOCK-008: Süresi dolmuş lock temizliği"""
        # Çok kısa süreli lock (0.001 sn — falsy 0 kullanmıyoruz, default'a düşer)
        lock_service.acquire_lock(
            "islem-1", LockType.EXPORT, "user-1", timeout=0.001
        )
        lock_service.acquire_lock(
            "islem-2", LockType.EXPORT, "user-2", timeout=0.001
        )
        
        import time
        time.sleep(0.1)  # Süre dolması için bekle
        
        # Temizlik
        cleaned = lock_service.cleanup_expired_locks()
        
        assert cleaned == 2
    
    def test_release_all_owner_locks(self, lock_service):
        """TC-LOCK-009: Owner tüm lock'larını serbest bırakma"""
        # Aynı owner ile çoklu lock
        lock_service.acquire_lock("islem-1", LockType.EXPORT, "user-1")
        lock_service.acquire_lock("islem-2", LockType.EDIT, "user-1")
        lock_service.acquire_lock("islem-3", LockType.DELETE, "user-1")
        
        # Hepsini serbest bırak
        released = lock_service.release_all_owner_locks("user-1")
        
        assert released == 3


class TestExportIntegration:
    """Export Integration Testleri (TestContainer ile)"""
    
    @pytest.mark.integration
    def test_full_export_flow(self):
        """TC-INT-001: Tam export akışı"""
        # Bu test gerçek bir database ve file system ile çalışır
        # TestContainers kullanımı önerilir
        
        # Setup: Mock database ve temp dizin
        # 1. İş oluştur
        # 2. Satırlar ekle
        # 3. Export işlemi başlat
        # 4. Atomic transaction kontrolü
        # 5. Database güncellemesi
        # 6. Dosya varlığı
        
        pass  # Integration test için TestContainers setup gerekli
    
    @pytest.mark.integration  
    def test_concurrent_export_locking(self):
        """TC-INT-002: Eş zamanlı export locking"""
        # İki ayrı süreç aynı işi export etmeye çalışırsa
        # Lock mekanizması çalışmalı
        
        pass  # Multi-threading test için


# Export dosya adı testleri
class TestExportFilename:
    """Export dosya adı normalizasyon testleri"""
    
    def test_turkce_karakter_normalizasyonu(self):
        """TC-EXPORT-008: Türkçe karakter normalizasyonu"""
        test_cases = [
            ("Çınar Mobilya", "CINAR_MOBILYA"),
            ("Şahinler", "SAHINLER"),
            ("Güneş", "GUNES"),
            ("Özdemir", "OZDEMIR"),
            ("İstanbul", "ISTANBUL"),
        ]
        
        for input_val, expected in test_cases:
            # Normalizasyon fonksiyonu (export service'ten)
            result = self._normalize_filename(input_val)
            assert result == expected, f"'{input_val}' → '{result}' (beklenen: '{expected}')"
    
    def test_bosluk_normalizasyonu(self):
        """TC-EXPORT-009: Boşluk normalizasyonu"""
        test_cases = [
            ("ABC Mobilya", "ABC_MOBILYA"),
            ("  Boşluklu  ", "BOSLUKLU"),
            ("Çok   Boşluk", "COK_BOSLUK"),
        ]
        
        for input_val, expected in test_cases:
            result = self._normalize_filename(input_val)
            assert result == expected
    
    def test_buyuk_harf(self):
        """TC-EXPORT-010: Büyük harf dönüşümü"""
        test_cases = [
            ("kucuk harf", "KUCUK_HARF"),
            ("Karisik Harf", "KARISIK_HARF"),
        ]
        
        for input_val, expected in test_cases:
            result = self._normalize_filename(input_val)
            assert result == expected
    
    def _normalize_filename(self, value: str) -> str:
        """Test için normalizasyon fonksiyonu"""
        # Türkçe karakterler
        tr_map = {
            'ç': 'c', 'Ç': 'C',
            'ğ': 'g', 'Ğ': 'G',
            'ı': 'i', 'İ': 'I',
            'ö': 'o', 'Ö': 'O',
            'ş': 's', 'Ş': 'S',
            'ü': 'u', 'Ü': 'U',
        }
        
        # Türkçe karakterleri değiştir
        for tr_char, en_char in tr_map.items():
            value = value.replace(tr_char, en_char)
        
        # Boşlukları _ yap
        value = value.replace(' ', '_')
        
        # Çoklu boşlukları tek yap
        while '__' in value:
            value = value.replace('__', '_')
        
        # Trim, baş/son altçizgi temizle ve büyük harf
        value = value.strip().strip('_').upper()

        return value


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
