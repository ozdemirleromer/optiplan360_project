import { lazy } from "react";

export { CariCardsIntroScreen } from "../../features/CRM/CariCardsIntroScreen";
export { StockCardsIntroScreen } from "../../features/Stock/StockCardsIntroScreen";

export const CRMDashboardTab = lazy(() =>
  import("../../features/CRM/CRMPage").then((m) => ({ default: m.CRMDashboardTab })),
);

export const AccountsTab = lazy(() =>
  import("../../features/CRM/CRMPage").then((m) => ({ default: m.AccountsTab })),
);

export const OpportunitiesTab = lazy(() =>
  import("../../features/CRM/CRMPage").then((m) => ({ default: m.OpportunitiesTab })),
);

export const QuotesTab = lazy(() =>
  import("../../features/CRM/CRMPage").then((m) => ({ default: m.QuotesTab })),
);

export const SyncHealthTab = lazy(() =>
  import("../../features/CRM/CRMPage").then((m) => ({ default: m.SyncHealthTab })),
);

export const ErrorsTab = lazy(() =>
  import("../../features/CRM/CRMPage").then((m) => ({ default: m.ErrorsTab })),
);

export const AuditTab = lazy(() =>
  import("../../features/CRM/CRMPage").then((m) => ({ default: m.AuditTab })),
);

export const StockCardComponent = lazy(() =>
  import("../../features/Stock/StockCardComponent").then((m) => ({ default: m.StockCardComponent })),
);

export const PaymentDashboard = lazy(() => import("../../features/Payment/PaymentDashboard"));
