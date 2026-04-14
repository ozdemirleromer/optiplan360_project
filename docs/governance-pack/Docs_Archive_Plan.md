# OptiPlan360 Docs Archive Plan

## Intent
This plan defines which legacy markdown files are safe archive candidates after the governance pack was imported.

Archive first. Do not permanently delete until the canonical files are reviewed and accepted.

## Canonical files
- `docs/governance-pack/OptiPlan360_Master_Spec_v4.md`
- `docs/governance-pack/OptiPlan360_Extended_Modules_Annex_v1.md`
- `docs/governance-pack/OptiPlan360_Phase1_Implementation_Spec_v3.md`
- `docs/governance-pack/OptiPlan360_Phase2_Implementation_Spec_v2.md`
- `docs/governance-pack/OptiPlan360_Phase2_UI_Spec_7Fields_v2.md`
- `docs/governance-pack/OptiPlan360_Phase3_UIUX_Spec_v2.md`
- `docs/governance-pack/AGENTS.md`
- `docs/governance-pack/Docs_Cleanup_Prompt.md`
- `docs/governance-pack/Docs_Naming_Policy.md`

## Confirmed replacements

### Master spec family
- Legacy: `OptiPlan360_Eksiksiz_phase4_Master_Spesifikasyon_v3.md`
- Canonical: `docs/governance-pack/OptiPlan360_Master_Spec_v4.md`
- Reason: both act as master spec, but v4 is the new binding governance version and explicitly locks Phase 2 to 7 fields.

### Extended modules family
- Legacy: `ebatlamaalani.md`
- Canonical: `docs/governance-pack/OptiPlan360_Extended_Modules_Annex_v1.md`
- Reason: the annex preserves the expanded module scope while removing its prior role as the single implementation authority.

### Phase 1 family
- Legacy: `OptiPlan360_Master_phase1_Uygulama_Paketi_v2.md`
- Canonical: `docs/governance-pack/OptiPlan360_Phase1_Implementation_Spec_v3.md`
- Reason: the old document mixes wider master-pack concerns; the canonical file narrows Phase 1 ownership.

### Phase 2 implementation family
- Legacy: `OptiPlan360_Phase2_Uygulama_Spesifikasyonu_v1.md`
- Canonical: `docs/governance-pack/OptiPlan360_Phase2_Implementation_Spec_v2.md`
- Reason: same phase ownership, but the canonical file sets the final 7-field rule.

### Phase 2 UI family
- Legacy: `OptiPlan360_Phase2_UI.md`
- Canonical: `docs/governance-pack/OptiPlan360_Phase2_UI_Spec_7Fields_v2.md`
- Reason: both define the Phase 2 UI, but the canonical file removes prompt-style ambiguity and fixes the 7-field model.

### Phase 3 UI family
- Legacy: `OptiPlan360_Phase3_UIUX_Spec.md`
- Canonical: `docs/governance-pack/OptiPlan360_Phase3_UIUX_Spec_v2.md`
- Reason: both define the Phase 3 screen, but v2 resolves the fire explanation rule as a single general field.

## Archive candidates
- `C:\optiplan360_project\OptiPlan360_Eksiksiz_phase4_Master_Spesifikasyon_v3.md`
- `C:\optiplan360_project\ebatlamaalani.md`
- `C:\optiplan360_project\OptiPlan360_Master_phase1_Uygulama_Paketi_v2.md`
- `C:\optiplan360_project\OptiPlan360_Phase2_Uygulama_Spesifikasyonu_v1.md`
- `C:\optiplan360_project\OptiPlan360_Phase2_UI.md`
- `C:\optiplan360_project\OptiPlan360_Phase3_UIUX_Spec.md`

## Keep for now
- `OptiPlan360_Master_Uygulama_Paketi_v1.md`
- `docs/PHASE2_OCR_KONTROL_TASARIM_V2.md`
- `docs/OptiPlan360_Phase2_Uyumluluk_Matrisi_v1.md`
- `docs/PHASE2_PHASE3_BIRLESIK_UYUMLULUK_MATRISI.md`
- `docs/PHASE4_UI_UX_CONTRACT_MATRIX.md`

These may still contain reference material, matrices, or transition notes. They should not be archived automatically without a second pass.

## Recommended next step
1. Move archive candidates into `docs/archive/legacy-governance/`.
2. Re-run a repo search to confirm no active prompt or index still points to the archived filenames.
3. Only consider permanent deletion after manual review.
