# Field Rename Log

| Eski Alan | Kanonik Alan | Uygulanan Konum | Not |
|---|---|---|---|
| `length_cm` | `boy_mm` | `backend/app/schemas.py` | `OptiJobPartInput.normalize_legacy_payload()` icinde mm'ye donusturuluyor |
| `width_cm` | `en_mm` | `backend/app/schemas.py` | `OptiJobPartInput.normalize_legacy_payload()` icinde mm'ye donusturuluyor |
| `quantity` | `adet` | `backend/app/schemas.py` | Legacy payload artik `adet` uzerinden ilerliyor |
| `grain` (0/1/2/3) | `grain_code` | `backend/app/schemas.py` | `VALID_GRAIN_VALUES` ile string kanonige cevriliyor |
| `length` | `boy_mm` | `backend/app/services/ocr_order_mapper.py` | OCR map asamasinda normalize ediliyor |
| `width` | `en_mm` | `backend/app/services/ocr_order_mapper.py` | OCR map asamasinda normalize ediliyor |
| `qty` | `adet` | `backend/app/services/ocr_order_mapper.py` | OCR map asamasinda normalize ediliyor |
| `top_edge` | `u1` | `backend/app/services/ocr_order_mapper.py` | Kenar flag'leri kanonik ORM alanina iniyor |
| `bottom_edge` | `u2` | `backend/app/services/ocr_order_mapper.py` | Kenar flag'leri kanonik ORM alanina iniyor |
| `left_edge` | `k1` | `backend/app/services/ocr_order_mapper.py` | Kenar flag'leri kanonik ORM alanina iniyor |
| `right_edge` | `k2` | `backend/app/services/ocr_order_mapper.py` | Kenar flag'leri kanonik ORM alanina iniyor |
| `1-Material` | `1-Boyuna` | `backend/app/schemas.py`, `backend/app/services/ocr_order_mapper.py`, `backend/app/services/export.py` | Legacy grain degeri normalize ediliyor |
| `2-Material` | `2-Enine` | `backend/app/schemas.py`, `backend/app/services/ocr_order_mapper.py`, `backend/app/services/export.py` | Legacy grain degeri normalize ediliyor |
