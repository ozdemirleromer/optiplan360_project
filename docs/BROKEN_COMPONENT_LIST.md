# BROKEN COMPONENT LIST — OptiPlan360 Import Analizi

**Oluşturma Tarihi:** 2026-03-04  
**Amaç:** Import sorunlarını ve broken component'leri tespit etmek

---

## NOTLAR

Python runtime sorunu nedeniyle direkt import testleri yapılamadı:
```
Fatal Python error: Failed to import encodings module
ModuleNotFoundError: No module named 'encodings'
```

Bu nedenle **statik kod analizi** ile import sorunları tespit edildi.

---

## 1. CIRCULAR IMPORT RİSKİ

### Risk-1: optiplanning_service ↔ order_service

**optiplanning_service.py:10**
```python
from app.services.order_service import OrderService
```

**order_service.py kontrol:** (Aşağıda detay)

**Sonuç:** Kontrol gerekiyor — order_service içinde optiplanning_service import'u var mı?

---

## 2. SERVICES __INIT__.PY — EAGER IMPORT

**Dosya:** `backend/app/services/__init__.py`

`__init__.py` dosyası **tüm servisleri eager import ediyor**:
- Line 2-6: AWSTextractService
- Line 7-14: AzureService
- Line 14-17: DropOptimizationService
- Line 18-22: ExportValidator
- Line 23-27: FilenameGenerator
- Line 28-32: GoogleVisionService
- Line 33-38: GrainMatcher, suggest_grain
- Line 39-46: Optimization servisleri
- Line 47-51: StockMatcher

### Sorun:
Eğer bu servislerden biri import hatası veriyorsa, **tüm services modülü fail olur**.

### Test:
```python
# Bu test başarısız olursa kök neden bu dosyadaki import hatalarındandır
from app import services
```

---

## 3. BAĞIMSIZ COMPONENT TEST SONUÇLARI (Statik Analiz)

| Component | Dosya | Import Sağlığı | Sorun |
|-----------|-------|----------------|-------|
| OrchestratorService | orchestrator_service.py | ✅ SAĞLAM | - |
| ExportValidator | export_validator.py | ✅ SAĞLAM | Ancak KULLANILMIYOR |
| GrainMatcher | grain_matcher.py | ✅ SAĞLAM | orchestrator kendi _map_grain kullanıyor |
| StockMatcher | stock_matcher.py | ✅ SAĞLAM | KULLANILMIYOR (Mikro P1 için hazır) |
| export.py | export.py | ⚠️ SAĞLAM | GRAIN_MAP duplicate |
| optiplan_worker_service | optiplan_worker_service.py | ✅ SAĞLAM | - |
| azure_router | routers/azure_router.py | ⚠️ KONTROL | 2016 satır, karmaşık |
| ocr_router | routers/ocr_router.py | ⚠️ KONTROL | 5711 satır, çok büyük |

---

## 4. EKSİK BAĞIMLILIK SORUNU

### Potansiyel Sorunlar:

#### A. Optional Dependencies
Birçok serviste `except ImportError` bloğu var:
- `auth.py:22`
- `mikro_db.py:68, 114`
- `routers/config_router.py:422`
- `services/mikro_service.py:86`
- `services/price_tracking_*.py:42, 50, 71, 299`
- `services/azure_service.py:339`
- `services/whatsapp_scheduler.py:107`

Bu, bazı kütüphanelerin **optional** olduğunu gösteriyor.

#### B. Eksik Olabilecek Paketler:
- **pyodbc** (mikro_db.py için SQL Server)
- **azure-** paketleri (Azure OCR)
- **google-cloud-vision** (Google Vision OCR)
- **boto3** (AWS Textract)
- **pytesseract** (Tesseract OCR)
- **pdf2image** (Price tracking)
- **twilio** / **whatsapp-api** (WhatsApp)
- **pywinauto** (optiplan_worker_service — UI automation)

---

## 5. BÜYÜK DOSYA SORUNU (Maintainability Riski)

| Dosya | Satır Sayısı | Durum |
|-------|--------------|-------|
| ocr_router.py | 5711 | 🔴 ÇOK BÜYÜK — split gerekli |
| azure_router.py | 2016 | 🟡 BÜYÜK — review gerekli |
| optiplan_worker_service.py | 1689 | 🟡 BÜYÜK — OK (worker mantığı) |
| stock_matcher.py | 871 | 🟢 OK |
| export_validator.py | 688 | 🟢 OK |
| grain_matcher.py | 709 | 🟢 OK |
| orchestrator_service.py | 572 | 🟢 OK |
| export.py | 490 | 🟢 OK |

**Öneri:** 
- `ocr_router.py` (5711 satır) → OCR logic'i ayrı servislere taşınmalı
- `azure_router.py` (2016 satır) → Azure OCR/Blob ayrı router'lara split edilebilir

---

## 6. GRAIN_MATCHER KULLANILMIYOR — WASTE CODE

**Tespit:** 
- `grain_matcher.py` tam fonksiyonlu bir servis (709 satır)
- `suggest_grain()` fonksiyonu mevcut ve export edilmiş
- Ancak `orchestrator_service.py:128` kendi `_map_grain()` fonksiyonunu kullanıyor

**Aksiyon:**
🔴 **P0 — Acil fix:**
```python
# orchestrator_service.py:128 (KALDIRMALI)
def _map_grain(grain_code: str | None) -> int | None:
    ...

# Yerine kullan (EKLEMELI)
from app.services.grain_matcher import suggest_grain

def _map_grain_using_matcher(material_name: str) -> int | None:
    suggestion = suggest_grain(material_name)
    return {"0-Material": 0, "1-Boyuna": 1, "2-Enine": 2, "3-Material": 3}.get(suggestion.grain)
```

---

## 7. EXPORT_VALIDATOR KULLANILMIYOR

**Tespit:**
- `export_validator.py` (688 satır) tam implement edilmiş
- `validate_export()` fonksiyonu mevcut
- ❌ **Hiçbir router veya serviste çağrılmıyor**

**Aksiyon:**
🟡 **P1 — Entegre et:**
```python
# export.py içinde:
from app.services.export_validator import ExportValidator

def export_order_to_excel(...):
    ...
    # XLSX ürettikten sonra:
    validator = ExportValidator()
    result = validator.validate(df_dict, group=part_group)
    if not result.passed:
        raise ValidationError(f"Export validation failed: {result.errors}")
```

---

## 8. STRING ERROR CODE İHLALİ

**Tespit:**
JobErrorCode enum var, ama bazı dosyalar string literal kullanıyor:

| Dosya | Satır | Kod | Durum |
|-------|-------|-----|-------|
| optiplan_worker_service.py | 209 | `"E_WORKER_ENV_UNSUPPORTED"` | ❌ String |
| optiplan_worker_service.py | 238 | `"E_OPTI_WORKER_FAILED"` | ❌ String |
| orchestrator_service.py | 549 | `"E_CANCELLED"` | ❌ String |
| mikro_sync_service.py | 46 | `"E_MIKRO_READ_ONLY"` | ❌ String |

**Doğru:**
- `orchestrator_service.py:248` → `JobErrorCode.CRM_NO_MATCH` ✅
- `xml_collector_service.py:211` → `JobErrorCode.OPTI_XML_TIMEOUT` ✅

**Aksiyon:**
🟡 **P1:** 
1. `models/enums.py` içindeki `JobErrorCode` enum'a eksik kodları ekle
2. String literal'leri enum'a çevir

---

## 9. POSSIBLE CIRCULAR IMPORT (Tespit Gerekiyor)

### A. optiplanning_service → order_service
`optiplanning_service.py:10` import ediyor:
```python
from app.services.order_service import OrderService
```

❓ **order_service.py** içinde `optiplanning_service` import'u var mı?

### B. services/__init__.py eager import
Tüm servisler `__init__.py`'de eager import ediliyor.  
Eğer bir servis başka bir servisi import ediyorsa → circular risk.

**Test gerekli:**
```bash
cd backend
python -c "from app.services import GrainMatcher, ExportValidator"
```

---

## 10. IMPORT SAĞLIĞI ÖZETİ

### ✅ Sağlam (Import Sorunu Yok):
- orchestrator_service.py
- grain_matcher.py
- stock_matcher.py
- export_validator.py
- export.py
- filename_generator.py

### ⚠️ Kontrol Gerekiyor:
- optiplan_worker_service.py (pywinauto dependency)
- optiplanning_service.py → order_service (circular risk)
- services/__init__.py (eager import)

### 🔴 Sorunlu:
- ocr_router.py (5711 satır — çok büyük)
- azure_router.py (2016 satır — büyük)
- Python runtime (encodings module missing — sistem sorunu)

---

## SONRAKI ADIMLAR

1. ✅ **Python runtime'ı düzelt** (encoding module sorunu)
2. 🔴 **P0:** GrainMatcher entegre et, `_map_grain()` duplicate'ini kaldır
3. 🔴 **P0:** Duplicate sabitleri `constants/excel_schema.py` ve `utils/text_normalize.py`'ye taşı
4. 🟡 **P1:** ExportValidator'ı export.py'de kullan
5. 🟡 **P1:** String error code'ları enum'a çevir
6. 🟡 **P1:** ocr_router.py'yi modüler hale getir (split)
7. ✅ **İmport test repeat:** Python düzeldikten sonra `python -c "from app.services.X import Y"` testlerini tekrar dene

---

## BÖLÜM 1 — TESLİM PAKETİ

✅ **GÖREV-1A:** `docs/DEPENDENCY_MAP.md` oluşturuldu  
✅ **GÖREV-1B:** `docs/DUPLICATION_REGISTRY.md` oluşturuldu  
✅ **GÖREV-1C:** `docs/BROKEN_COMPONENT_LIST.md` oluşturuldu (bu dosya)

**Sonraki:** BÖLÜM 2 — Mimari kararları sabitleme ve kod düzeltmeleri
