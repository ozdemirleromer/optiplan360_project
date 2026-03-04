# RUNBOOK PROD

## Kritik Surecler

### OptiPlanning.exe Tetikleme
- Konum: `OPTIPLAN_EXE_PATH`
- Tetikleyen: `backend/app/services/orchestrator_service.py::_trigger_optiplan_exe()`
- Timeout: `XML_COLLECT_TIMEOUT_S` (varsayilan `1200`)
- Hata durumu: `E_OPTI_XML_TIMEOUT` -> `FAILED`

### Makine Drop Folder
- `MACHINE_DROP_DIR/inbox/` -> `DELIVERED`
- `MACHINE_DROP_DIR/processed/` -> `DONE`
- `MACHINE_DROP_DIR/failed/` -> `FAILED`
- ACK timeout: `MACHINE_ACK_TIMEOUT_S` (varsayilan `300`)

### Circuit Breaker Reset
```bash
curl -X POST http://localhost:8000/api/v1/orchestrator/jobs/worker/reset \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

### Manuel HOLD Onaylama
```bash
curl -X POST http://localhost:8000/api/v1/orchestrator/jobs/$JOB_ID/approve \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

## Alarm Durumlari ve Mudahale

| Alarm | Belirti | Mudahale |
|---|---|---|
| `E_OPTI_XML_TIMEOUT` | Log: `XML_TIMEOUT job=...` | OptiPlanning.exe calisiyor mu kontrol et |
| `E_CRM_NO_MATCH` | Job `HOLD` durumunda | CRM'de musteri kaydi olustur, sonra approve et |
| `Circuit OPEN` | 3 ardisik worker hatasi | `/worker/reset` endpoint'i ile breaker sifirla |
| `DB Connection` | 503 veya timeout | DB servis sagligini ve connection pool'u kontrol et |

## Operasyon Notlari
- Worker queue kaynagi: `OPTI_IMPORTED`
- Tek aktif `OPTI_RUNNING` isi kurali backend tarafinda korunur
- XLSX uretimi tek kaynak: `backend/app/services/export.py::generate_xlsx_for_job()`
- OCR satirlarinin parse verisi tum provider router'larinda JSON string olarak saklanir
