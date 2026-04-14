# OptiPlan360 Documentation Cleanup Prompt

Use this prompt with Codex when you want it to discover old markdown files by content and safely canonicalize them.

## Prompt
```text
Scan all markdown files in the repository and canonicalize the OptiPlan360 documentation set.

Goal:
- identify canonical OptiPlan360 docs
- find superseded markdown files by content, not filename alone
- archive old versions safely
- never delete uncertain files

Canonical target files:
- OptiPlan360_Master_Spec_v4.md
- OptiPlan360_Extended_Modules_Annex_v1.md
- OptiPlan360_Phase1_Implementation_Spec_v3.md
- OptiPlan360_Phase2_Implementation_Spec_v2.md
- OptiPlan360_Phase2_UI_Spec_7Fields_v2.md
- OptiPlan360_Phase3_UIUX_Spec_v2.md

Content-based classification rules:
- gateway/Mikro/Optiplanning/phases/handoff/blockers/acceptance => master-spec
- Cari/Stok/Sipariş/Teklif/Klasör Yönetimi/Mikro write-back => extended-modules
- OCR pool/watcher/duplicate/preprocessing/retry => phase1
- OCR control/confidence/split-screen/7-field review => phase2
- Phase 2 image panel/grid/highlight/7-field UI behavior => phase2-ui
- customer match/stock match/plate/merge/fire explanation => phase3
- otherwise unrelated or uncertain

Strict rules:
- Phase 2 is fixed to 7 fields: BOY, EN, ADET, U1, U2, K1, K2
- Do not invent missing business rules.
- Do not delete by guess.
- If unsure, classify as uncertain and do not move it.
- Archive superseded files into docs/archive/ instead of deleting.
- Only touch `.md` files.
- Do not touch non-OptiPlan360 documentation.

Output order:
1. canonical files already present
2. files matched to canonical targets
3. files proposed for archive
4. uncertain files
5. exact move plan

Then apply only the archive moves.
Do not permanently delete files.
```
