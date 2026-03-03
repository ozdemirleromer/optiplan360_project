# Quick Start

Tarih: 2026-03-03
Durum: Current repo quick start

Bu repo iki ana akisi bir arada tasir:
- Ana uygulama: `backend/` + `frontend/`
- Orchestrator: `apps/orchestrator/` + `apps/admin-ui/`

## 1. Gereksinimler

- Python 3.10+
- Node.js 20+
- PostgreSQL (production hedefi)
- Local test icin SQLite kabul edilebilir

## 2. Ana Uygulamayi Ayaga Kaldir

### Backend

```bash
cd backend
pip install -r requirements.txt
python -m alembic upgrade head
python main.py
```

Beklenen adres:
- `http://127.0.0.1:8080`
- `http://127.0.0.1:8080/health`

### Frontend

Repo kokunden:

```bash
npm run dev
```

veya dogrudan:

```bash
cd frontend
npm install
npm run dev -- --host 127.0.0.1 --strictPort --port 3001
```

Beklenen adres:
- `http://127.0.0.1:3001`

## 3. Orchestrator Akisi

```bash
cd apps/orchestrator
npm install
npm run build
npm test
```

Admin panel:

```bash
cd apps/admin-ui
npm install
npm run build
```

## 4. Oncelikli Kontroller

1. `GET /health` 200 donmeli
2. Frontend login ekrani acilmali
3. `docs/API_CONTRACT.md` ve `docs/STATE_MACHINE.md` ile endpoint/state zinciri uyumlu olmali
4. Mikro read-only kurali korunmali

## 5. Nereden Devam Edilir

- Teknik kararlar: `docs/RESMI_KARAR_DOKUMANI_V1.md`
- Is kurallari: `OPTIPLAN360_MASTER_HANDOFF.md`
- Operasyon: `docs/OPERATIONS.md`
- UI durumu: `OPTIPLAN360_UI_UX_MIMARI_RAPORU_BIRLESTIRILMIS.md`
