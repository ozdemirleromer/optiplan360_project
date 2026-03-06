import { lazy } from "react";

export const UsersTab = lazy(() =>
  import("../../features/Admin").then((m) => ({ default: m.UsersPage })),
);

export const RolesPermissionsTab = lazy(() =>
  import("../../features/Admin").then((m) => ({ default: m.RolesPermissionsPage })),
);
