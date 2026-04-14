# OptiPlan360 Master Spec v4

## Purpose
This is the binding master specification for OptiPlan360.

## Product position
- OptiPlan360 is not a standalone ERP.
- It is a gateway between Mikro and Optiplanning.
- Commercial truth stays in Mikro.

## Binding implementation scope
- Phase 1: OCR Pool / intake / watcher / duplicate-precheck / preprocessing
- Phase 2: OCR Control / review / correction / approval
- Phase 3: Operational editing / customer-stock match / plate and merge flow
- Phase 4: Export / preview / manifest / retry and fire tracking

## Canonical rules
- Phase transitions must respect blockers.
- No speculative behavior.
- Auditability is mandatory.
- Handoff contracts are binding.
- Backend and UI must apply the same blocker semantics.

## Phase 2 fixed rule
Phase 2 always uses 7 fields:
- BOY
- EN
- ADET
- U1
- U2
- K1
- K2

## Phase 3 fixed rule
- Fire explanation is a single general field.
- Customer phone is optional in header.
- Save may exist as controlled draft-save behavior.

## Export family
Supported operational outputs:
- XLSX
- OPJ
- XML / fire-related outputs

## Precedence
If another document conflicts with this file, this file wins unless a later canonical version replaces it.
