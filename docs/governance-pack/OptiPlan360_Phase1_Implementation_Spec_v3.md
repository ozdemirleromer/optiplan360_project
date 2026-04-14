# OptiPlan360 Phase 1 Implementation Spec v3

## Scope
Phase 1 covers OCR intake and pool preparation.

## Responsibilities
- watcher or import intake
- duplicate precheck
- preprocessing
- OCR adapter handoff
- retry scheduling
- pool visibility and operator intake status

## Rules
- No phase handoff without valid intake state.
- Errors and retries must stay auditable.
- Duplicate protection must be preserved.
