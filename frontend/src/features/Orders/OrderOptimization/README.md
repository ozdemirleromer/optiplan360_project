# Order Optimization Canonical Path

This folder is the canonical home for the order-optimization workflow inside the Orders feature.

## Rule

1. Real implementation lives under `src/features/Orders/OrderOptimization/`.
2. Legacy feature paths under `src/features/UI`, `src/features/Grid`, `src/features/Ribbon`, and `src/features/Optimization` stay as compatibility wrappers only.
3. New work should import from this folder directly.

## Canonical Files

1. `OrderOptimizationPanel.tsx`
2. `OrderOptimizationGrid.tsx`
3. `OrderOptimizationRibbon.tsx`
4. `orderOptimizationConstants.ts`
5. `orderOptimizationStyles.ts`
6. `OrderOptimizationMetaStrip.tsx`
7. `OptiPlanStrictOrderEntry.tsx`
