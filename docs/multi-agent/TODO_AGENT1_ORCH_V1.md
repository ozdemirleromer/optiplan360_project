# TODO Agent-1 ORCH v1

Durum: Completed
Alan: apps/orchestrator/*, docs/API_CONTRACT.md, docs/STATE_MACHINE.md

## Sprint Sirasi
1. Stabilize /jobs list/create/retry/approve edge cases
2. Strengthen state transition guards
3. Add/expand integration tests for edge scenarios
4. Sync docs for canonical behavior

## Task List
1. [x] Baseline code scan and risk inventory
2. [x] Harden listJobs input handling (invalid limit, clamp)
3. [x] Add test for invalid/oversized limit behavior
4. [x] Verify HOLD approve constraints with tests
5. [x] Re-run orchestrator test suite
6. [x] Update agent1_status with evidence
7. [x] Fix xml validation edge-case (invalid XML should raise E_XML_INVALID)

## Next Wave (Agent-1)
1. [ ] Timeout/retry gozlem metrikleri
2. [ ] API contract ve state dokuman final senkronu
