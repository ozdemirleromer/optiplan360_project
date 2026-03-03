# OPTIPLAN 360

Mobilya uretim planlama, siparis yonetimi, entegrasyon ve OptiPlanning orchestrator projesi.

Durum tarihi: 2026-03-03

## Guncel Sistem Gorunumu

- `backend/`: FastAPI tabanli ana uygulama
- `frontend/`: React + Vite operator/yetkili arayuzu
- `apps/orchestrator/`: job/state machine tabanli OptiPlanning orchestrator
- `apps/admin-ui/`: orchestrator yonetim paneli
- `docs/`: resmi kararlar, operasyon, API ve test/ajan kayitlari

## Guncel Durum

Proje ileri asamada ve ana omurga kurulmus durumda. Ancak repo 2026-03-03 itibariyla "tam kapanmis" degil:
- Wave-1 gelistirmeleri tamamlanmis
- Agent-3 operasyon/entegrasyon kapanislari tamamlanmis
- Agent-1 ve Agent-2 tarafinda son dokuman/tutarlilik/regression kalemleri acik
- Go-live karari su an kosulludur

Bu nedenle bu repo icin en dogru tanim:
`kosullu canliya hazir / final kapanis bekliyor`

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

## Dokumantasyon Onceligi

1. `AGENT_ONEFILE_INSTRUCTIONS.md`
2. `docs/RESMI_KARAR_DOKUMANI_V1.md`
3. `docs/API_CONTRACT.md`
4. `docs/STATE_MACHINE.md`
5. `DOCUMENTATION_INDEX.md`

## Baslangic Icin Okunacaklar

- `DOCUMENTATION_INDEX.md`
- `OPTIPLAN360_MASTER_HANDOFF.md`
- `OPTIPLAN360_UI_UX_MIMARI_RAPORU_BIRLESTIRILMIS.md`
- `FRONTEND_REFACTOR_CHANGELOG.md`
- `docs/OPTIPLAN360_SISTEM_CALISMA_DUZENI_DETAYLI.md`

## Not

Tarihsel raporlar repo icinde korunur, ancak operasyonel dogruluk icin once yukaridaki kaynak sirasi takip edilmelidir.
