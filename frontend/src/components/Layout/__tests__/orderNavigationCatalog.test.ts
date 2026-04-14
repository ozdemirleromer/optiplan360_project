import { describe, expect, it } from "vitest";

import {
  ORDER_MODULE_SURFACE_PAGE_ENTRIES,
  ORDER_RIBBON_FLOW_ACTIONS,
  ORDER_SPOTLIGHT_ACTION_ENTRIES,
  ORDER_SPOTLIGHT_PAGE_ENTRIES,
} from "../orderNavigationCatalog";
import { ORDER_MODULE_SURFACE_ROUTES, ORDER_ROUTE_META } from "../orderNavigationContract";

describe("orderNavigationCatalog", () => {
  it("spotlight sayfalari siparis ve workflow rotalarini route metasindan uretir", () => {
    expect(ORDER_SPOTLIGHT_PAGE_ENTRIES.map((entry) => entry.page)).toEqual(
      expect.arrayContaining([
        ORDER_ROUTE_META.orderList.page,
        ORDER_ROUTE_META.orderForm.page,
        ORDER_ROUTE_META.workflowInbox.page,
        ORDER_ROUTE_META.workflowReview.page,
        ORDER_ROUTE_META.workflowEditing.page,
        ORDER_ROUTE_META.workflowExport.page,
      ]),
    );
  });

  it("spotlight aksiyonu yeni siparisi dogrudan order-editor rotasina baglar", () => {
    expect(ORDER_SPOTLIGHT_ACTION_ENTRIES).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          page: ORDER_ROUTE_META.newOrder.page,
          title: ORDER_ROUTE_META.newOrder.title,
        }),
      ]),
    );
  });

  it("ribbon akisi export ve optiplanning job etiketlerini paylasilan route metasindan alir", () => {
    expect(ORDER_RIBBON_FLOW_ACTIONS).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: ORDER_ROUTE_META.workflowExport.navLabel,
          page: ORDER_ROUTE_META.workflowExport.page,
        }),
        expect.objectContaining({
          label: ORDER_ROUTE_META.optiplanJob.navLabel,
          page: ORDER_ROUTE_META.optiplanJob.page,
        }),
      ]),
    );
  });

  it("modul spotlight kayitlari bagimsiz modul sirasini route otoritesinden alir", () => {
    expect(ORDER_MODULE_SURFACE_PAGE_ENTRIES.map((entry) => entry.page)).toEqual(
      ORDER_MODULE_SURFACE_ROUTES.map((route) => route.page),
    );
    expect(ORDER_SPOTLIGHT_PAGE_ENTRIES.slice(1, 5).map((entry) => entry.page)).toEqual(
      ORDER_MODULE_SURFACE_ROUTES.map((route) => route.page),
    );
  });
});
