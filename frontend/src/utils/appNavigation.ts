export type AppPage =
  | "dashboard"
  | "orders"
  | "order-editor"
  | "kanban"
  | "card-management"
  | "reports-analytics"
  | "system-logs"
  | "user-management"
  | "integrations"
  | "integration-health"
  | "stations"
  | "config"
  | "organization"
  | "user-activity"
  | "workflows"
  | "api-portal"
  | "whatsapp-business"
  | "price-tracking"
  | "ai-assistant"
  | "ai-config"
  | "orchestrator"
  | "product-search"
  | "crm-tickets"
  | "export-page";

export interface AppNavigationDetail {
  page: AppPage;
  source?: string;
}

export const APP_NAVIGATION_EVENT = "app:navigate";

export function navigateToAppPage(page: AppPage, source?: string) {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent<AppNavigationDetail>(APP_NAVIGATION_EVENT, {
      detail: { page, source },
    }),
  );
}

export function subscribeToAppNavigation(listener: (detail: AppNavigationDetail) => void) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const handleNavigation = (event: Event) => {
    const detail = (event as CustomEvent<AppNavigationDetail>).detail;
    if (!detail?.page) {
      return;
    }

    listener(detail);
  };

  window.addEventListener(APP_NAVIGATION_EVENT, handleNavigation as EventListener);

  return () => {
    window.removeEventListener(APP_NAVIGATION_EVENT, handleNavigation as EventListener);
  };
}
