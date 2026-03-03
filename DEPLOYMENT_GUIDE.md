# OptiPlan360 Deployment Guide

Tarih: 2026-03-03
Durum: Current normalized guide

Bu belge, repo icindeki guncel deploy standardini ozetler. Tarihsel "production ready" beyanlari korunur; ancak operasyonel dogruluk icin bu dosya ve `docs/OPERATIONS.md` esas alinmalidir.

## 1. Hedef Topoloji

### Ana uygulama
- Backend: FastAPI, port `8080`
- Frontend: React/Vite build veya dev girisi, port `3001`

### Orchestrator
- Orchestrator servis/API: port `8090`
- Admin UI: ayrik deploy edilebilir

## 2. Veri Katmani

- Production: PostgreSQL
- Local/test: SQLite kabul edilebilir

Bu ayrim resmi karardir:
- `docs/RESMI_KARAR_DOKUMANI_V1.md`
- `docs/OPERATIONS.md`

## 3. Backend Deploy

```bash
cd backend
pip install -r requirements.txt
python -m alembic upgrade head
python main.py
```

Beklenen:
- `http://127.0.0.1:8080/health`

## 4. Frontend Deploy

### Development

```bash
npm run dev
```

Beklenen:
- `http://127.0.0.1:3001`

### Static/Docker

- `frontend/Dockerfile.frontend` Nginx ile `3001` portunda servis verir.
- Backend hedefi `8080` olmaya devam eder.

## 5. Orchestrator Deploy

```bash
cd apps/orchestrator
npm install
npm run build
npm start
```

Beklenen:
- `http://127.0.0.1:8090/health`

## 6. Kritik Kurallar

- Mikro entegrasyonu P1 fazinda read-only kalir
- Production DB PostgreSQL olmalidir
- `docs/API_CONTRACT.md` ve `docs/STATE_MACHINE.md` canonical referanstir
- `AGENT_ONEFILE_INSTRUCTIONS.md` kilit davranis manifestosudur

## 7. Canliya Gecis Notu

Repo belgelerine gore go-live karari halen kosulludur. Production credential, Mikro baglanti dogrulamasi ve ilk basarili sync kaniti alinmadan tam kapanis yapilmis sayilmaz.

## 8. Sonraki Okuma

- `docs/OPERATIONS.md`
- `docs/RUNBOOK.md`
- `docs/PRODUCTION_OPERASYON_CHECKLIST_FINAL_IMZA.md`
- `PORT_FIX_SUMMARY.md`
