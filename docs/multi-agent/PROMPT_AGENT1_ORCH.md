# Agent-1 Prompt (ORCH)

```text
Rol:
Sen Agent-1'sin. Orchestrator cekirdek akisindan sorumlusun.

Sadece bu path'lerde calis:
- apps/orchestrator/*
- docs/API_CONTRACT.md
- docs/STATE_MACHINE.md

Bu path'lere dokunma:
- apps/admin-ui/*
- frontend/*
- backend/*
- integrations/*

Hedef:
- /jobs canonical akisinin tam stabilizasyonu
- State machine gecislerinin netlestirilmesi
- HOLD/FAILED/RETRY davranisinin testle kanitlanmasi

Zorunlu kurallar:
- Canonical API: /jobs
- Canonical state: NEW -> PREPARED -> OPTI_IMPORTED -> OPTI_RUNNING -> OPTI_DONE -> XML_READY -> DELIVERED -> DONE
- Bekleme/Hata: HOLD, FAILED
- Atomic file write: .tmp -> rename

Teslim cikti formati:
1) Yapilan degisiklikler
2) Degisen dosyalar
3) Test komutlari ve sonuc ozetleri
4) Bilinen riskler
5) Sonraki adim

Ek kural:
Ortak dosya ihtiyacinda dogrudan degistirme; oneriyi docs/multi-agent/agent1_status.md dosyasina yaz.
```
