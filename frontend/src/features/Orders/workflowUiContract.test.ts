import { describe, expect, it } from "vitest";

import { ORDER_ROUTE_META } from "../../components/Layout/orderNavigationContract";
import {
  LEGACY_ORDER_WORKFLOW_STATUS_LABELS,
  WORKFLOW_ACTION_LABELS,
  WORKFLOW_PHASE_ROUTE_META,
  WORKFLOW_STATUS_LABELS,
} from "./workflowUiContract";

describe("workflowUiContract", () => {
  it("workflow faz rotalarini route metasina baglar", () => {
    expect(WORKFLOW_PHASE_ROUTE_META[1]).toBe(ORDER_ROUTE_META.workflowInbox);
    expect(WORKFLOW_PHASE_ROUTE_META[2]).toBe(ORDER_ROUTE_META.workflowReview);
    expect(WORKFLOW_PHASE_ROUTE_META[3]).toBe(ORDER_ROUTE_META.workflowEditing);
    expect(WORKFLOW_PHASE_ROUTE_META[4]).toBe(ORDER_ROUTE_META.workflowExport);
  });

  it("dosya durum etiketlerini workflow route basliklarindan uretir", () => {
    expect(WORKFLOW_STATUS_LABELS.OCR_KONTROL).toBe(ORDER_ROUTE_META.workflowReview.title);
    expect(WORKFLOW_STATUS_LABELS.EXPORT_ONIZLEME).toBe(ORDER_ROUTE_META.workflowExport.title);
  });

  it("legacy order entry durum etiketlerini tek kaynakta tutar", () => {
    expect(LEGACY_ORDER_WORKFLOW_STATUS_LABELS.pending_ocr).toBe("OCR Bekleniyor");
    expect(LEGACY_ORDER_WORKFLOW_STATUS_LABELS.ocr_validated).toBe("OCR Onaylandı");
    expect(LEGACY_ORDER_WORKFLOW_STATUS_LABELS.ready).toBe("Hazır");
  });

  it("workflow aksiyon etiketlerini ortak contracttan uretir", () => {
    expect(WORKFLOW_ACTION_LABELS.backToInbox).toBe(ORDER_ROUTE_META.workflowInbox.navLabel);
    expect(WORKFLOW_ACTION_LABELS.advanceToEditing).toBe(ORDER_ROUTE_META.workflowEditing.navLabel);
    expect(WORKFLOW_ACTION_LABELS.advanceToExport).toBe(ORDER_ROUTE_META.workflowExport.navLabel);
    expect(WORKFLOW_ACTION_LABELS.sendToOptimization).toBe("Optimizasyona Gönder");
  });
});
