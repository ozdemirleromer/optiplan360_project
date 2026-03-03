# OptiPlan360 Sistem Calisma Duzeni Detayli

Tarih: 2026-03-03
Durum: Current operational summary

Bu belge, repo icindeki backend + frontend + orchestrator + entegrasyon akisini tek yerde ozetler.

## 1. Bilesenler

- `backend/`: Ana FastAPI uygulamasi
- `frontend/`: Operator ve yonetim odakli React uygulamasi
- `apps/orchestrator/`: Job tabanli OptiPlanning orchestrator
- `apps/admin-ui/`: Orchestrator yonetim paneli

## 2. Siparisten Uretime Temel Akis

1. Kullanici siparisi frontend uzerinden olusturur.
2. Backend siparis, musteri, malzeme ve validasyon kurallarini uygular.
3. OptiPlanning tarafinda ileri akislarda orchestrator `/jobs` modeli ile isleri yurutur.
4. XLSX uretimi, XML toplama ve makine teslimi orchestrator state machine ile izlenir.
5. Audit ve entegrasyon loglari backend/orchestrator tarafinda tutulur.

## 3. Teknik State Duzeni

Canonical state zinciri:

`NEW -> PREPARED -> OPTI_IMPORTED -> OPTI_RUNNING -> OPTI_DONE -> XML_READY -> DELIVERED -> DONE`

Bekleme/hata state'leri:
- `HOLD`
- `FAILED`

Detayli teknik tanim: `docs/STATE_MACHINE.md`

## 4. Veri Katmani

- Production hedefi: PostgreSQL
- Local/test/edge operasyon: SQLite destekli

Bu ayrim resmi karardir ve dokuman/kod yorumlarinda korunmalidir.

## 5. Mikro Entegrasyonu

- P1 fazi read-only kilitli
- SQL Board baglantisi denetlenebilir
- Write-back akislar production-ready kabul edilmez

Detayli notlar:
- `docs/RESMI_KARAR_DOKUMANI_V1.md`
- `docs/OPERATIONS.md`
- `docs/SECURITY_NOTES.md`

## 6. Guncel Asama

- Wave-1 paralel yapim tamamlandi.
- Wave-2 icinde Agent-3 kapanislari tamamlandi.
- Agent-1 ve Agent-2 tarafinda son dokuman/tutarlilik/regression kapanislari acik.
- Go-live karari su an kosulludur; production credential ve ilk basarili sync kaniti beklenir.

## 7. Bu Belgenin Amaci

Bu belge tarihsel rapor degil, repo icindeki daginik operasyon bilgisinin guncel ozetidir.
Detay kaynaklar:
- `OPTIPLAN360_MASTER_HANDOFF.md`
- `docs/API_CONTRACT.md`
- `docs/STATE_MACHINE.md`
- `docs/RUNBOOK.md`
- `docs/OPERATIONS.md`
