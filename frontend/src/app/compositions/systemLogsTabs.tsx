import { lazy } from "react";

export const LogsTab = lazy(() =>
  import("../../features/Admin").then((m) => ({ default: m.LogsPage })),
);

export const AuditRecordsTab = lazy(() =>
  import("../../features/Admin").then((m) => ({ default: m.AuditRecordsPage })),
);
