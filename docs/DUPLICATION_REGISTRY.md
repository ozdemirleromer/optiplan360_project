# DUPLICATION REGISTRY — OptiPlan360 Duplicate Mantık Analizi

**Oluşturma Tarihi:** 2026-03-04  
**Amaç:** Aynı mantığın kaç yerde duplicate edildiğini tespit etmek ve kanonik kaynağı belirlemek

---

## METODOLOJI

Her mantık türü için:
1. Konum-N: Dosya:satır (kod snippet özeti)
2. Kanonik Kaynak Olacak: Mimari karar sonrası seçilecek tek kaynak

---

## 1. GRAIN DIRECTION MAPPING

| Mantık | Konum-1 | Konum-2 | Konum-3 | Konum-4+ | Kanonik Kaynak Olacak |
|--------|---------|---------|---------|----------|----------------------|
| **GRAIN_MAP dict** | `export.py:18` | `bridge_service.py:41` | - | - | **✅ constants/excel_schema.py (YARATILACAK)** |
| **grain validation** | `orchestrator_service.py:128` `_map_grain()` | `grain_matcher.py:610` `suggest_grain()` | `schemas.py:129` VALID_GRAIN_CODES | `export_validator.py:127` VALID_GRAIN_VALUES | **✅ grain_matcher.py** |
| **grain string literals** | `models/order.py:64,156,170` "0-Material" default | `schemas.py:139,217` "0-Material" | `orders_router.py:435,438,447,856,858` | `ocr_router.py:171,1024,1056` | **✅ models/enums.py:131-134** (GrainDirection enum) |

### Tespit:
- **2 duplicate GRAIN_MAP sabiti**
- orchestrator_service içinde `_map_grain()` fonksiyonu varken grain_matcher.py kullanılmamış
- "0-Material", "1-Boyuna" string literal'leri **12+ dosyada** tekrar edilmiş

### Aksiyon:
🔴 **P0 — Acil:** 
- `constants/excel_schema.py` yarat, GRAIN_MAP'i oraya taşı
- orchestrator_service'deki `_map_grain()`'i sil, `grain_matcher.suggest_grain()` kullan
- Tüm string literal'leri `GrainDirection` enum'a çevir

---

## 2. GOVDE / ARKALIK AYRIMI

| Mantık | Konum-1 | Konum-2 | Konum-3 | Konum-4+ | Kanonik Kaynak Olacak |
|--------|---------|---------|---------|----------|----------------------|
| **part_group validation** | `schemas.py:130` VALID_PART_GROUPS | `orders_router.py:690,816` inline check | `export.py:79` inline loop | - | **✅ constants/excel_schema.py** |
| **arkalik bant yasağı** | `schemas.py:195` `validate_arkalik_no_band()` | `orders_router.py:284,757,866` inline check | `export_validator.py:181` `_check_no_band_on_arkalik()` | - | **✅ schemas.py** (validation seviyesinde) |
| **govde/arkalik split export** | `export.py:79` `for part_group_name in ["GOVDE", "ARKALIK"]` | `orders_router.py:268,293` `_create_opti_xlsx()` | `optiplanning_service.py:199` gruplama | - | **✅ export.py** |

### Tespit:
- VALID_PART_GROUPS 3 yerde kontrol ediliyor
- Arkalık bant yasağı 4 yerde ayrı ayrı yazılmış
- Export split mantığı 3 farklı yerde

### Aksiyon:
🟡 **P1:**
- `VALID_PART_GROUPS` → `constants/excel_schema.py`
- Arkalık bant kontrolünü schemas validation'da bırak, diğerlerini sil
- Export split'i `export.py::generate_xlsx_for_job()` tek kaynak yap

---

## 3. CM → MM DÖNÜŞÜMÜ

| Mantık | Konum-1 | Konum-2 | Kanonik Kaynak Olacak |
|--------|---------|---------|----------------------|
| **Inline `* 10`** | `orders_router.py:530-531` `w * 10 if w < 1000 else w` | - | **✅ utils/unit_converter.py (YARATILACAK)** |

### Tespit:
- Yalnızca orders_router.py:530-531'de görüldü
- Heuristic logic: `if w < 1000` (cm mi mm mi tespiti)

### Aksiyon:
🟢 **P2 öncelik düşük:**
- Şimdilik inline kalabilir
- Gelecekte `utils/unit_converter.py` oluşturup `cm_to_mm()` fonksiyonu yaz

---

## 4. TÜRKÇE KARAKTER NORMALIZE

| Mantık | Konum-1 | Konum-2 | Konum-3 | Kanonik Kaynak Olacak |
|--------|---------|---------|---------|----------------------|
| **unicodedata.normalize("NFKD")** | `orders_router.py:391-392` | `filename_generator.py:244` | `optiplan_csv_otomasyon.py:210` | **✅ utils/text_normalize.py (YARATILACAK)** |

### Tespit:
- **3 yerde** aynı normalize pattern:
  ```python
  s = unicodedata.normalize("NFKD", s)
  s = "".join(ch for ch in s if not unicodedata.combining(ch))
  ```

### Aksiyon:
🔴 **P0 — Acil:**
- `utils/text_normalize.py` yarat
- `normalize_turkish(text: str) -> str` fonksiyonu
- 3 dosyada import'la değiştir

---

## 5. EXCEL TAG SABİTLERİ

| Mantık | Konum-1 | Konum-2 | Kanonik Kaynak Olacak |
|--------|---------|---------|----------------------|
| **REQUIRED_EXCEL_TAGS list** | `export_validator.py:85` `["NO", "CODE", "LENGTH", ...]` | - | **✅ constants/excel_schema.py (YARATILACAK)** |
| **Column name literal'leri** | `export.py` (çeşitli satırlar) | `orders_router.py` (_create_opti_xlsx) | **✅ constants/excel_schema.py** |

### Tespit:
- `export_validator.py:85-121` tam liste (10 sütun)
- Diğer dosyalarda inline string kullanımı ("NO", "CODE", "LENGTH", ...)

### Aksiyon:
🔴 **P0 — Acil:**
- `constants/excel_schema.py` yarat:
  ```python
  REQUIRED_COLUMNS = ["NO", "CODE", "LENGTH", "WIDTH", "QUANTITY",
                      "GRAIN", "TOP_EDGE", "BOTTOM_EDGE", "LEFT_EDGE", "RIGHT_EDGE"]
  ```
- Her kullanım yerinde import et

---

## 6. TELEFON NUMARASI NORMALIZE

| Mantık | Konum-1 | Konum-2 | Kanonik Kaynak Olacak |
|--------|---------|---------|----------------------|
| **_normalize_phone() local fonksiyon** | `ocr_router.py:191` | - | **✅ utils/text_normalize.py (YARATILACAK)** |

### Tespit:
- Yalnızca ocr_router.py içinde local fonksiyon olarak tanımlı
- 3 yerde kullanılıyor (satır 218, 492, 900)

### Aksiyon:
🔴 **P0 — Acil:**
- `utils/text_normalize.py` içine taşı
- `normalize_phone(phone: str) -> str` fonksiyonu
- ocr_router'da import et, local tanımı sil

---

## 7. JOBERRORCODE STRING SABİTLERİ

| Mantık | Konum-1 | Konum-2 | Konum-3 | Konum-4 | Kanonik Kaynak Olacak |
|--------|---------|---------|---------|---------|----------------------|
| **Enum kullanımı** | `orchestrator_service.py` JobErrorCode.CRM_NO_MATCH | `xml_collector_service.py` JobErrorCode.OPTI_XML_TIMEOUT | - | - | **✅ models/enums.py:169** (JobErrorCode enum) |
| **String literal kullanımı** | `optiplan_worker_service.py:209` `"E_WORKER_ENV_UNSUPPORTED"` | `optiplan_worker_service.py:238` `"E_OPTI_WORKER_FAILED"` | `orchestrator_service.py:549` `"E_CANCELLED"` | `mikro_sync_service.py:46` `"E_MIKRO_READ_ONLY"` | **❌ İhlal — enum'a çevrilmeli** |

### Tespit:
- ✅ **İyi:** orchestrator_service ve xml_collector enum kullanıyor
- 🔴 **Kötü:** optiplan_worker_service ve diğer birkaç dosya string literal kullanıyor

### Aksiyon:
🟡 **P1:**
- `models/enums.py` içindeki `JobErrorCode` enum'a eksik hata kodlarını ekle:
  - `WORKER_ENV_UNSUPPORTED`, `OPTI_WORKER_FAILED`, `CANCELLED`
- String literal'leri enum'a çevir

---

## 8. BACKING THICKNESS GEÇERLİLİK KONTROLÜ

| Mantık | Konum-1 | Konum-2 | Kanonik Kaynak Olacak |
|--------|---------|---------|----------------------|
| **BACKING_THICKNESSES frozenset** | `orchestrator_service.py:50` `frozenset([3, 4, 5, 8])` | `optiplanning_service.py:33` `frozenset([3, 4, 5, 8])` | **✅ constants/excel_schema.py (YARATILACAK)** |
| **TRIM_BY_THICKNESS dict** | `orchestrator_service.py:40-48` | `optiplanning_service.py:34` | **✅ constants/excel_schema.py (YARATILACAK)** |

### Tespit:
- **2 duplicate** BACKING_THICKNESSES tanımı
- **2 duplicate** TRIM_BY_THICKNESS tanımı
- Her iki dosya da AGENT_ONEFILE §THICKNESS POLICY'ye atıf yapıyor

### Aksiyon:
🔴 **P0 — Acil:**
- `constants/excel_schema.py` yarat:
  ```python
  BACKING_THICKNESSES = frozenset([3, 4, 5, 8])
  TRIM_BY_THICKNESS = {
      "3": 5.0, "4": 5.0, "5": 5.0, "8": 5.0,
      "18": 10.0, "25": 10.0,
  }
  ```
- İki dosyada import'la değiştir

---

## ÖZET — DUPLICATE İSTATİSTİKLERİ

| Mantık | Duplicate Sayısı | Öncelik | Dosya Adedi |
|--------|------------------|---------|-------------|
| GRAIN_MAP | 2 | 🔴 P0 | 2 |
| Grain validation | 4 | 🔴 P0 | 4 |
| Grain string literals | 12+ | 🔴 P0 | 8+ |
| GOVDE/ARKALIK validation | 3 | 🟡 P1 | 3 |
| Arkalık bant yasağı | 4 | 🟡 P1 | 3 |
| Türkçe normalize | 3 | 🔴 P0 | 3 |
| Excel tag sabitleri | 1 tanım + N kullanım | 🔴 P0 | 3+ |
| Telefon normalize | 1 (local) | 🔴 P0 | 1 |
| JobErrorCode string | ~6 ihlal | 🟡 P1 | 4 |
| BACKING_THICKNESSES | 2 | 🔴 P0 | 2 |
| TRIM_BY_THICKNESS | 2 | 🔴 P0 | 2 |

**Toplam Duplicate Dosya:** ~15 dosya  
**Toplam Satır Duplicate:** ~200+ satır (tahmin)

---

## SONRAKI ADIM

**GÖREV-1C:** Import testleri ve broken component tespiti  
**BÖLÜM 2:** Kanonik mimariyi uygula (constants/ ve utils/ modülleri yarat)
