# OptiPlan360 Agent Operating Rules

## Canonical documentation files
The following markdown files are the only canonical documentation set for this project:

- OptiPlan360_Master_Spec_v4.md
- OptiPlan360_Extended_Modules_Annex_v1.md
- OptiPlan360_Phase1_Implementation_Spec_v3.md
- OptiPlan360_Phase2_Implementation_Spec_v2.md
- OptiPlan360_Phase2_UI_Spec_7Fields_v2.md
- OptiPlan360_Phase3_UIUX_Spec_v2.md

Use these files as the source of truth in this precedence order:
1. OptiPlan360_Master_Spec_v4.md
2. Phase-specific spec for the current task
3. OptiPlan360_Extended_Modules_Annex_v1.md

If a rule is missing or ambiguous, do not invent behavior. Stop and report the ambiguity.

## Documentation cleanup policy
Before modifying, renaming, archiving, or deleting any markdown documentation file:
1. Scan all `.md` files in the repository.
2. Classify each by content, not filename alone.
3. Map each superseded document to one canonical replacement.
4. Print a plan with files to keep, create, rename, archive, and uncertain files.
5. Only then apply changes.

### Canonical replacements
- ebatlamaalani.md -> OptiPlan360_Extended_Modules_Annex_v1.md
- OptiPlan360_Eksiksiz_phase4_Master_Spesifikasyon_v3.md -> OptiPlan360_Master_Spec_v4.md
- OptiPlan360_Master_phase1_Uygulama_Paketi_v2.md -> OptiPlan360_Phase1_Implementation_Spec_v3.md
- OptiPlan360_Phase2_Uygulama_Spesifikasyonu_v1.md -> OptiPlan360_Phase2_Implementation_Spec_v2.md
- OptiPlan360_Phase2_UI.md -> OptiPlan360_Phase2_UI_Spec_7Fields_v2.md
- OptiPlan360_Phase3_UIUX_Spec.md -> OptiPlan360_Phase3_UIUX_Spec_v2.md

### Deletion rules
- Never delete a markdown file by semantic guess.
- Never delete a markdown file unless its canonical replacement already exists.
- Prefer moving superseded files to `docs/archive/` before permanent deletion.
- Never touch markdown files outside the explicit cleanup scope.
- If there is any uncertainty, stop and report instead of deleting.

## Spec-specific rules
### Phase 2
Phase 2 uses 7 fields as a fixed rule:
- BOY
- EN
- ADET
- U1
- U2
- K1
- K2

### Phase 3
- Scrap/fire explanation is a single general field, not row-based.
- Customer phone is optional in the header.
- `Kaydet` may exist as a controlled draft-save action, but must not weaken blockers.
