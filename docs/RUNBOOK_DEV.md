# RUNBOOK DEV

## 1. Gelistirme Ortami Kurulumu
```bash
cd backend
pip install -r requirements.txt
```
Beklenen: `Successfully installed ...`
Not: Bu oturumda Python runtime `Failed to import encodings module` hatasiyla bloklu oldugu icin komut calistirilarak dogrulanamadi.

## 2. Veritabani Hazirlama
```bash
cd backend
alembic upgrade head
```
Beklenen: `Running upgrade ... -> head`
Not: Runtime blokaj nedeniyle bu oturumda dogrulanamadi.

## 3. Backend Baslatma
```bash
cd backend
uvicorn app.main:app --reload --port 8000
```
Saglik kontrolu:
```bash
curl http://localhost:8000/health
```
Beklenen: `{"status":"ok"}`

## 4. Testleri Calistirma
```bash
cd backend
pytest tests/ -v --tb=short
```
Beklenen: tum testler PASS
Not: Bu oturumda `pytest` calistirilamadi; once Python `encodings` problemi giderilmeli.

## 5. Lint
```bash
cd backend
ruff check app/ || flake8 app/
```
Beklenen: sifir hata

## 6. OCR -> Job Pipeline Testi
```bash
curl -X POST http://localhost:8000/api/v1/ocr/process \
  -F "file=@tests/fixtures/sample_order.jpg" \
  -H "Authorization: Bearer $TOKEN"
```
Beklenen: `{"job_id":"...","state":"NEW"}` veya `{"job_id":"...","state":"OPTI_IMPORTED"}`

## 7. Job Durumu Takibi
```bash
curl http://localhost:8000/api/v1/orchestrator/jobs/$JOB_ID \
  -H "Authorization: Bearer $TOKEN"
```
Beklenen: job detay JSON'i

## Notlar
- OCR satirlarinin `parsed_data` alani artik JSON string olarak kaydedilir.
- `/api/v1/ocr/create-order` akisi `OcrOrderMapper -> OrderService -> OrchestratorService` zincirini kullanir.
- OptiPlanning export akislari `backend/app/services/export.py::generate_xlsx_for_job()` uzerinden calisir.
