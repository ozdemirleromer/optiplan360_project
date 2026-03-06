import { lazy } from "react";

export const ReportsTab = lazy(() =>
  import("../../features/Reports").then((m) => ({ default: m.Reports })),
);

export const AnalyticsPageTab = lazy(() =>
  import("../../features/Admin").then((m) => ({ default: m.AnalyticsPage })),
);
