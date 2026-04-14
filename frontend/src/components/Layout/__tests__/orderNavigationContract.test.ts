import { describe, expect, it } from "vitest";

import { ORDER_MODULE_SURFACE_ROUTES, ORDER_ROUTE_META } from "../orderNavigationContract";

describe("orderNavigationContract", () => {
  it("liste yeni siparis ve siparis fisi rotalarini birbirinden ayirir", () => {
    expect(ORDER_ROUTE_META.orderList.page).toBe("orders");
    expect(ORDER_ROUTE_META.newOrder.page).toBe("order-editor");
    expect(ORDER_ROUTE_META.orderForm.page).toBe("siparis-fisi");
  });

  it("workflow kontrol etiketi tek adla korunur", () => {
    expect(ORDER_ROUTE_META.workflowReview.navLabel).toBe("OCR Kontrol");
    expect(ORDER_ROUTE_META.workflowReview.page).toBe("ocr-kontrol");
  });

  it("workflow export yuzeyi phase4 aksiyonlarini tek route'ta korur", () => {
    expect(ORDER_ROUTE_META.workflowExport.navLabel).toBe("OptiPlanning");
    expect(ORDER_ROUTE_META.workflowExport.page).toBe("optiplan-job");
  });

  it("bagimsiz modul sirasini tek route otoritesinde korur", () => {
    expect(ORDER_MODULE_SURFACE_ROUTES.map((route) => route.page)).toEqual([
      ORDER_ROUTE_META.orderForm.page,
      ORDER_ROUTE_META.quoteForm.page,
      ORDER_ROUTE_META.stockCard.page,
      ORDER_ROUTE_META.customerCard.page,
    ]);
  });
});
