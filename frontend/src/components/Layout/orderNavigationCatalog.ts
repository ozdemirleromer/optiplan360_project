import type { AppPage } from "../../utils/appNavigation";
import { ORDER_MODULE_SURFACE_ROUTES, ORDER_ROUTE_META } from "./orderNavigationContract";

export type OrderNavCatalogIcon =
  | "package"
  | "file"
  | "file-text"
  | "boxes"
  | "users"
  | "scan-line"
  | "scan-search"
  | "pen-line"
  | "cpu";

export interface OrderNavigationCatalogEntry {
  id: string;
  title: string;
  description: string;
  page: AppPage;
  shortcut?: string;
  icon: OrderNavCatalogIcon;
}

export interface RibbonCatalogAction {
  label: string;
  page: AppPage;
  icon: OrderNavCatalogIcon;
}

type ModuleSurfacePage = (typeof ORDER_MODULE_SURFACE_ROUTES)[number]["page"];

const MODULE_SURFACE_PAGE_ICONS: Record<ModuleSurfacePage, OrderNavCatalogIcon> = {
  "siparis-fisi": "file-text",
  "teklif-fisi": "pen-line",
  "stok-karti": "boxes",
  "cari-karti": "users",
};

export const ORDER_MODULE_SURFACE_PAGE_ENTRIES: ReadonlyArray<OrderNavigationCatalogEntry> =
  ORDER_MODULE_SURFACE_ROUTES.map((route) => ({
    id: `p-${route.page}`,
    title: route.title,
    description: route.description,
    page: route.page,
    shortcut: route.page === ORDER_ROUTE_META.orderForm.page ? "Ctrl+3" : undefined,
    icon: MODULE_SURFACE_PAGE_ICONS[route.page],
  }));

export const ORDER_SPOTLIGHT_PAGE_ENTRIES: ReadonlyArray<OrderNavigationCatalogEntry> = [
  {
    id: "p-orders",
    title: ORDER_ROUTE_META.orderList.title,
    description: ORDER_ROUTE_META.orderList.description,
    page: ORDER_ROUTE_META.orderList.page,
    shortcut: "Ctrl+2",
    icon: "package",
  },
  ...ORDER_MODULE_SURFACE_PAGE_ENTRIES,
  {
    id: "p-order-validation",
    title: ORDER_ROUTE_META.workflowInbox.title,
    description: ORDER_ROUTE_META.workflowInbox.description,
    page: ORDER_ROUTE_META.workflowInbox.page,
    icon: "scan-line",
  },
  {
    id: "p-ocr-kontrol",
    title: ORDER_ROUTE_META.workflowReview.title,
    description: ORDER_ROUTE_META.workflowReview.description,
    page: ORDER_ROUTE_META.workflowReview.page,
    icon: "scan-search",
  },
  {
    id: "p-siparis-duzenleme",
    title: ORDER_ROUTE_META.workflowEditing.title,
    description: ORDER_ROUTE_META.workflowEditing.description,
    page: ORDER_ROUTE_META.workflowEditing.page,
    icon: "pen-line",
  },
  {
    id: "p-optiplan-job",
    title: ORDER_ROUTE_META.workflowExport.title,
    description: ORDER_ROUTE_META.workflowExport.description,
    page: ORDER_ROUTE_META.workflowExport.page,
    icon: "cpu",
  },
  {
    id: "p-optiplan-order",
    title: ORDER_ROUTE_META.optiplanJob.title,
    description: ORDER_ROUTE_META.optiplanJob.description,
    page: ORDER_ROUTE_META.optiplanJob.page,
    icon: "cpu",
  },
] as const;

export const ORDER_SPOTLIGHT_ACTION_ENTRIES: ReadonlyArray<OrderNavigationCatalogEntry> = [
  {
    id: "a-new-order",
    title: ORDER_ROUTE_META.newOrder.title,
    description: ORDER_ROUTE_META.newOrder.description,
    page: ORDER_ROUTE_META.newOrder.page,
    shortcut: "Ctrl+N",
    icon: "package",
  },
] as const;

export const ORDER_RIBBON_FILE_ACTIONS: ReadonlyArray<RibbonCatalogAction> = [
  { label: ORDER_ROUTE_META.newOrder.navLabel, page: ORDER_ROUTE_META.newOrder.page, icon: "file" },
  { label: ORDER_ROUTE_META.orderList.navLabel, page: ORDER_ROUTE_META.orderList.page, icon: "package" },
  { label: ORDER_ROUTE_META.orderForm.navLabel, page: ORDER_ROUTE_META.orderForm.page, icon: "file-text" },
] as const;

export const ORDER_RIBBON_FLOW_ACTIONS: ReadonlyArray<RibbonCatalogAction> = [
  { label: ORDER_ROUTE_META.orderList.navLabel, page: ORDER_ROUTE_META.orderList.page, icon: "package" },
  { label: ORDER_ROUTE_META.newOrder.navLabel, page: ORDER_ROUTE_META.newOrder.page, icon: "file" },
  { label: ORDER_ROUTE_META.orderForm.navLabel, page: ORDER_ROUTE_META.orderForm.page, icon: "file-text" },
  { label: ORDER_ROUTE_META.quoteForm.navLabel, page: ORDER_ROUTE_META.quoteForm.page, icon: "file-text" },
  { label: ORDER_ROUTE_META.workflowExport.navLabel, page: ORDER_ROUTE_META.workflowExport.page, icon: "cpu" },
  { label: ORDER_ROUTE_META.optiplanJob.navLabel, page: ORDER_ROUTE_META.optiplanJob.page, icon: "cpu" },
  { label: ORDER_ROUTE_META.workflowInbox.navLabel, page: ORDER_ROUTE_META.workflowInbox.page, icon: "scan-line" },
  { label: ORDER_ROUTE_META.workflowReview.navLabel, page: ORDER_ROUTE_META.workflowReview.page, icon: "scan-search" },
  { label: ORDER_ROUTE_META.workflowEditing.navLabel, page: ORDER_ROUTE_META.workflowEditing.page, icon: "pen-line" },
] as const;

