import { lazy } from "react";

export const DashboardAIOpsTab = lazy(() =>
  import("../../features/Operations/AIOpsDashboard").then((m) => ({ default: m.AIOpsDashboard })),
);

export const DashboardAIOrchestratorTab = lazy(() =>
  import("../../features/Operations/AIOrchestratorDashboard").then((m) => ({ default: m.AIOrchestratorDashboard })),
);
