---

## 0.6 OptiPlan Workflow Export Contract Specification

> **Başlangıç:** Iterasyon 35-37  
> **Durum:** ✅ Aktif (Backend: 30/30 test passing)  
> **Kaynak:** `backend/app/constants/optiplan_workflow.py` → `ExportContractRules` class

### 0.6.1 Genel

Export endpoint'leri (`/export/preview`, `/export`) tarafından üretilen row data'ı standart contract'a uymalıdır. Sözleşme **three-layer validation** tarafından enforce edilir:

1. **Service Layer Guard:** `_validate_export_preview_rows_contract()` — Output buffer'da doğrulanır
2. **Router Response Model:** FastAPI `response_model=ExportPreviewResponseOut` — Pydantic validation
3. **Unit Tests:** 30+ test case contract enforcement'ını verify eder

### 0.6.2 Column Specification

Tüm export satırları bu kolon yapısına uymalıdır (**order immutable**):

| Kolon | Tip | Constraint | Açıklama |
|-------|-----|-----------|----------|
| `[P_CODE_MAT]` | string | Non-empty | Malzeme kodu |
| `[P_LENGTH]` | int | ge=1 | Boy (mm) |
| `[P_WIDTH]` | int | ge=1 | En (mm) |
| `[P_MINQ]` | int | ge=1 | Minimum adet |
| `[P_GRAIN]` | int | enum: {0,1,2,3} | Grain type |
| `[P_IDESC]` | string | Any | Bilgi |
| `[P_EDGE_MAT_UP]` | string | enum: {"", "04", "1", "2"} | Üst kenar |
| `[P_EGDE_MAT_LO]` | string | enum: {"", "04", "1", "2"} | Alt kenar |
| `[P_EDGE_MAT_SX]` | string | enum: {"", "04", "1", "2"} | Sol kenar |
| `[P_EDGE_MAT_DX]` | string | enum: {"", "04", "1", "2"} | Sağ kenar |
| `[P_IIDESC]` | string | pattern: `^\d*$` | Delik-1 |
| `[P_DESC1]` | string | pattern: `^\d*$` | Delik-2 |

### 0.6.3 Enum Values

- **Grain:** `0, 1, 2, 3`  
- **Edge Codes:** `"", "04", "1", "2"` (empty=disabled, "04"=0.40MM, "1"=1MM, "2"=2MM)  
- **Export Status:** `"BASARILI", "HATALI", "KISMI_BASARILI"`

### 0.6.4 Normalization

Export satırları service katmanında şu normalization'lara tabi olur:

| Alan | Kural |
|------|-------|
| `bilgi` → `[P_IDESC]` | `None` → `""` |
| `delik_1` → `[P_IIDESC]` | `None` → `""` |
| `delik_2` → `[P_DESC1]` | `None` → `""` |

### 0.6.5 Implementation

**Location:** `backend/app/constants/optiplan_workflow.py` → `ExportContractRules` class

- Service guard: `_validate_export_preview_rows_contract()`
- Router models: `ExportPreviewRowOut`, `ExportRecordResponseOut`
- Unit tests: **30/30 passing** ✅

### 0.6.6 Validation Stack

```
Request → Router (response_model validation)
          ↓
       Service export_preview()
          ├─ _build_export_preview_row_payload()  (normalize empty)
          ├─ _validate_export_preview_rows_contract()  (guard)
          └─ return validated_rows
          ↓
       Response (contract-guaranteed)
```

### 0.6.7 Change Control

Contract rule değiştiğinde:

1. ✅ `ExportContractRules` constant'ı update et
2. ✅ Router model Literal'ını update et
3. ✅ Service guard validator'ı update et
4. ✅ Unit test'leri run et
5. ✅ API_CONTRACT.md'yi update et
6. ✅ Frontend type'larını sync et

**Koordinasyon:** DRY principle — tüm katmanlar merkezi kaynaktan beslenir.
