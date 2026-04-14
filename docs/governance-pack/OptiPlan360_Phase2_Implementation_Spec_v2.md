# OptiPlan360 Phase 2 Implementation Spec v2

## Scope
Phase 2 covers OCR control and operator review before Phase 3.

## Fixed review model
Phase 2 uses exactly 7 fields:
- BOY
- EN
- ADET
- U1
- U2
- K1
- K2

## Responsibilities
- confidence-based review
- operator correction
- approve / reject / faulty handling
- blocker-aware move to Phase 3
- split-screen review workflow

## Rules
- Do not collapse the phase to a 3-field model.
- Phase 3 transition requires required operator actions.
- Review state must remain auditable.
