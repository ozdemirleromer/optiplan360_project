# OPTIPLAN 360

Mobilya uretim planlama, siparis yonetimi, entegrasyon ve OptiPlanning orchestrator projesi.

Durum tarihi: 2026-03-22

## Guncel Sistem Gorunumu

- `backend/`: FastAPI tabanli ana uygulama
- `frontend/`: React + Vite operator/yetkili arayuzu
- `apps/orchestrator/`: job/state machine tabanli OptiPlanning orchestrator
- `apps/admin-ui/`: orchestrator yonetim paneli
- `docs/`: resmi kararlar, operasyon, API ve test/ajan kayitlari
- `docs/governance-pack/`: canonical OptiPlan360 spesifikasyon ve dokuman yonetisim paketi

## Guncel Durum

Proje ileri asamada ve ana omurga kurulmus durumda. Ancak repo tam kapanmis degil; bu nedenle operasyonel dogruluk icin canonical governance-pack ile calisilmalidir.

Bu repo icin en dogru tanim:
`kosullu canliya hazir / final kapanis bekliyor`

## Dokumantasyon Onceligi

1. `docs/governance-pack/OptiPlan360_Master_Spec_v4.md`
2. `docs/governance-pack/AGENTS.md`
3. `docs/governance-pack/OptiPlan360_Extended_Modules_Annex_v1.md`
4. `AGENT_ONEFILE_INSTRUCTIONS.md`
5. `docs/RESMI_KARAR_DOKUMANI_V1.md`
6. `docs/API_CONTRACT.md`
7. `docs/STATE_MACHINE.md`
8. `DOCUMENTATION_INDEX.md`

## Baslangic Icin Okunacaklar

- `DOCUMENTATION_INDEX.md`
- `docs/governance-pack/OptiPlan360_Master_Spec_v4.md`
- `docs/governance-pack/OptiPlan360_Phase2_Implementation_Spec_v2.md`
- `docs/governance-pack/OptiPlan360_Phase2_UI_Spec_7Fields_v2.md`
- `docs/governance-pack/OptiPlan360_Phase3_UIUX_Spec_v2.md`
- `docs/governance-pack/Docs_Archive_Plan.md`

## Hizli Baslangic

### Backend

```bash
cd backend
pip install -r requirements.txt
python -m alembic upgrade head
python main.py
```

Beklenen backend adresi: `http://127.0.0.1:8080`

Not:
- `backend/main.py` wrapper'inin varsayilan portu guncellenmistir.
- Uygulama cekirdegi `backend/app/main.py` altindadir.

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

Beklenen frontend adresi: `http://127.0.0.1:3001`

## Not

Tarihsel raporlar repo icinde korunur, ancak yeni uygulama ve analiz calismalarinda once `docs/governance-pack/` altindaki canonical set takip edilmelidir.
