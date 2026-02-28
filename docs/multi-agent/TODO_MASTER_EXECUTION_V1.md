# TODO Master Execution v1

Tarih: 2026-02-17
Durum: Active
Amac: Tum projeyi 3 ajan ile cakismasiz ve sirali sekilde tamamlamak.

## A. Sirali Yurutme (Global)
1. T0 Scope Freeze (Coordinator)
2. Wave-1 Parallel Build (Agent-1 + Agent-2 + Agent-3)
3. Checkpoint-1 Integration Review
4. Wave-2 Hardening
5. Checkpoint-2 Integration Review
6. Final Merge and Go-Live Prep

## B. Wave-1 Is Paketleri
1. Agent-1 ORCH
- /jobs canonical akis hardening
- state machine edge-case testleri
- HOLD/RETRY/APPROVE davranis netlestirme

2. Agent-2 UI
- emoji -> lucide cleanup
- UI status map alignment
- A11Y minimum enforcement

3. Agent-3 INTEG+OPS
- Mikro P1 read-only hardening
- runbook/operations db ortam ayrimi
- config guvenlik ve audit netligi

## C. Wave-2 Is Paketleri
1. Agent-1
- timeout/retry gozlem metrikleri
- API contract and state docs finalize

2. Agent-2
- kiosk/admin tutarlilik
- accessibility regression checks

3. Agent-3
- integration diagnostics
- production operasyon checklist final

## D. Merge Sirasi
1. Agent-1 -> main integration branch
2. Agent-3 -> integration branch
3. Agent-2 -> integration branch
4. Final conflict resolution and release tag

## E. Definition of Done
1. Kod + dokuman celiskisi yok
2. Test kaniti var
3. API/state/a11y/db kararlarina uyum var
4. Acik risk listesi var ve sahip atanmis

## F. Current Progress
1. Scope freeze: Completed
2. Wave-1: Completed (Agent-1 ORCH completed, Agent-2 completed, Agent-3 completed)
3. Checkpoint-1: Ready
4. Wave-2: In progress (Agent-3 diagnostics + production checklist completed; Agent-1/Agent-2 pending)
5. Final merge: Pending

## G. Execution Log
1. 2026-02-17 Agent-1 listJobs limit hardening tamamlandi.
2. 2026-02-17 Agent-1 integration testine clamp senaryosu eklendi.
3. 2026-02-17 Orchestrator build PASS, full test run better-sqlite3 native binding nedeniyle bloklandi.
4. 2026-02-24 Agent-1 orchestrator full test suite PASS (5 files / 13 tests).
5. 2026-02-24 Tum AI ajanlari icin ortak log sablonu ve resmi execution log zorunlulugu aktif edildi.
6. 2026-02-24 Agent-3 Mikro P1 read-only kod-seviyesi kilitleri tamamlandi.
7. 2026-02-24 OptiPlan360 Sistem Calisma Duzeni (Detayli) dokumani eklendi.
8. 2026-02-24 Integration diagnostics automation endpointi (`/api/v1/integration/diagnostics`) eklendi.
9. 2026-02-24 integration health Mikro baglanti degerlendirme hatasi duzeltildi.
10. 2026-02-24 `scripts/run_integration_diagnostics.py` ile diagnostics CLI otomasyonu eklendi.
11. 2026-02-24 Production operasyon checklist final imza paketi olusturuldu (`docs/PRODUCTION_OPERASYON_CHECKLIST_FINAL_IMZA.md`).
