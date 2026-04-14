import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiRequest } from "./apiClient";
import { optiplanWorkflowService } from "./optiplanWorkflowService";

vi.mock("./apiClient", () => ({
  apiRequest: vi.fn(),
}));

function buildExportResponse(overrides: Record<string, unknown> = {}) {
  return {
    kayitUuid: "wf-1",
    dosyaAdi: "OZDEMIR_BEYAZ_12032026",
    xlsxAktifMi: true,
    revizyonNo: 2,
    satirlar: [],
    durum: "BASARILI",
    generatedFiles: ["C:/exports/OZDEMIR_BEYAZ_12032026.xlsx"],
    generatedFileDetails: [
      {
        fileFormat: "xlsx",
        fileName: "OZDEMIR_BEYAZ_12032026.xlsx",
        filePath: "C:/exports/OZDEMIR_BEYAZ_12032026.xlsx",
        downloadPath: "/api/v1/optiplan-workflow/records/wf-1/exports/exp-1/files/xlsx",
        sizeBytes: 2048,
        checksumSha256: "a".repeat(64),
      },
    ],
    exportManifest: {
      manifestVersion: "workflow_export_manifest_v1",
      kayitUuid: "wf-1",
      exportId: "exp-1",
      dosyaAdi: "OZDEMIR_BEYAZ_12032026",
      revizyonNo: 2,
      retryNo: 0,
      requestedFormats: ["xlsx"],
      generatedFormats: ["xlsx"],
      rowCount: 4,
      createdAt: "2026-03-12T10:00:00+00:00",
    },
    ...overrides,
  };
}

describe("optiplanWorkflowService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("runExport sonucunu backend durum alanina gore basarili sayar", async () => {
    vi.mocked(apiRequest).mockResolvedValue(buildExportResponse({
        durum: "KISMI_BASARILI",
        generatedFileDetails: [
          {
            fileFormat: "xlsx",
            fileName: "OZDEMIR_BEYAZ_12032026.xlsx",
            filePath: "C:/exports/OZDEMIR_BEYAZ_12032026.xlsx",
            downloadPath: "/api/v1/optiplan-workflow/records/wf-1/exports/exp-1/files/xlsx",
            sizeBytes: 2048,
            checksumSha256: "a".repeat(64),
          },
        ],
        exportManifest: {
          manifestVersion: "workflow_export_manifest_v1",
          kayitUuid: "wf-1",
          exportId: "exp-1",
          dosyaAdi: "OZDEMIR_BEYAZ_12032026",
          revizyonNo: 2,
          retryNo: 0,
          requestedFormats: ["xlsx"],
          generatedFormats: ["xlsx"],
          rowCount: 4,
          createdAt: "2026-03-12T10:00:00+00:00",
        },
      }) as never);

    const result = await optiplanWorkflowService.runExport(
      {
        kayitUuid: "wf-1",
        selectedFormats: { xlsx: true },
      } as never,
      [],
    );

    expect(result.success).toBe(true);
    expect(result.durum).toBe("KISMI_BASARILI");
    expect(result.generatedFiles).toHaveLength(1);
    expect(result.generatedFileDetails).toHaveLength(1);
    expect(result.exportManifest?.generatedFormats).toEqual(["xlsx"]);
    expect(result.message).toContain("Kısmi export üretildi");
    expect(result.message).toContain(".xlsx");
  });

  it("runExport hatali akista genel hata mesaji ile dondurur", async () => {
    vi.mocked(apiRequest).mockResolvedValue(buildExportResponse({
        kayitUuid: "wf-2",
        dosyaAdi: "FAILED",
        revizyonNo: 1,
        durum: "HATALI",
        generatedFiles: [],
        generatedFileDetails: [],
        exportManifest: {
          manifestVersion: "workflow_export_manifest_v1",
          kayitUuid: "wf-2",
          exportId: "exp-2",
          dosyaAdi: "FAILED",
          revizyonNo: 1,
          retryNo: 0,
          requestedFormats: ["xlsx"],
          generatedFormats: [],
          rowCount: 1,
          createdAt: "2026-03-12T10:00:00+00:00",
        },
      }) as never);

    const result = await optiplanWorkflowService.runExport(
      {
        kayitUuid: "wf-2",
        selectedFormats: { xlsx: true },
      } as never,
      [],
    );

    expect(result.success).toBe(false);
    expect(result.durum).toBe("HATALI");
    expect(result.generatedFiles).toHaveLength(0);
    expect(result.message).toBe("Export tamamlanamadı.");
  });

  it("runExport bilinmeyen durum degerini BILINMIYOR olarak normalize eder", async () => {
    vi.mocked(apiRequest).mockResolvedValue(buildExportResponse({
        kayitUuid: "wf-3",
        dosyaAdi: "UNKNOWN",
        revizyonNo: 1,
        durum: undefined,
        generatedFiles: [],
        generatedFileDetails: [],
        exportManifest: {
          manifestVersion: "workflow_export_manifest_v1",
          kayitUuid: "wf-3",
          exportId: "exp-3",
          dosyaAdi: "UNKNOWN",
          revizyonNo: 1,
          retryNo: 0,
          requestedFormats: ["xlsx"],
          generatedFormats: [],
          rowCount: 0,
          createdAt: "2026-03-12T10:00:00+00:00",
        },
      }) as never);

    const result = await optiplanWorkflowService.runExport(
      {
        kayitUuid: "wf-3",
        selectedFormats: { xlsx: true },
      } as never,
      [],
    );

    expect(result.success).toBe(false);
    expect(result.durum).toBe("BILINMIYOR");
    expect(result.message).toContain("Export sonucu belirsiz");
  });

  it("runExportByRecordId xlsx bayragini dogrudan export endpointine yollar", async () => {
    vi.mocked(apiRequest).mockResolvedValue(
      buildExportResponse({
        kayitUuid: "wf-9",
        xlsxAktifMi: false,
        generatedFiles: [],
        generatedFileDetails: [],
        exportManifest: {
          manifestVersion: "workflow_export_manifest_v1",
          kayitUuid: "wf-9",
          exportId: "exp-9",
          dosyaAdi: "WF9",
          revizyonNo: 1,
          retryNo: 0,
          requestedFormats: [],
          generatedFormats: [],
          rowCount: 0,
          createdAt: "2026-03-12T10:00:00+00:00",
        },
      }) as never,
    );

    const result = await optiplanWorkflowService.runExportByRecordId("wf-9", false);

    expect(apiRequest).toHaveBeenCalledWith(
      "/optiplan-workflow/records/wf-9/export",
      {
        method: "POST",
        body: JSON.stringify({
          xlsx_aktif_mi: false,
        }),
      },
    );
    expect(result.durum).toBe("BASARILI");
    expect(result.generatedFiles).toEqual([]);
  });

  it("getExportStatusAnomalies varsayilan query ile telemetry verisini getirir", async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      limit: 50,
      offset: 0,
      filters: { kayit_uuid: null, from: null, to: null },
      summary: {
        total_records: 0,
        distinct_records: 0,
        last_created_at: null,
        status_breakdown: {},
      },
      items: [],
    } as never);

    const result = await optiplanWorkflowService.getExportStatusAnomalies();

    expect(apiRequest).toHaveBeenCalledWith(
      "/optiplan-workflow/telemetry/export-status-anomalies?limit=50&offset=0",
      { method: "GET" },
    );
    expect(result.limit).toBe(50);
    expect(result.offset).toBe(0);
    expect(result.filters.kayitUuid).toBeNull();
    expect(result.filters.fromTs).toBeNull();
    expect(result.filters.toTs).toBeNull();
    expect(result.summary.totalRecords).toBe(0);
    expect(result.summary.statusBreakdown).toEqual({});
  });

  it("getExportStatusAnomalies filtreleri query stringe yazar", async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      limit: 10,
      offset: 5,
      filters: {
        kayit_uuid: "wf-1",
        from: "2026-03-12T00:00:00+00:00",
        to: "2026-03-12T23:59:59+00:00",
      },
      summary: {
        total_records: 2,
        distinct_records: 1,
        last_created_at: "2026-03-12T12:00:00+00:00",
        status_breakdown: { BASARILI: 2 },
      },
      items: [],
    } as never);

    const result = await optiplanWorkflowService.getExportStatusAnomalies({
      limit: 10,
      offset: 5,
      kayitUuid: "wf-1",
      fromTs: "2026-03-12T00:00:00+00:00",
      toTs: "2026-03-12T23:59:59+00:00",
    });

    expect(apiRequest).toHaveBeenCalledWith(
      "/optiplan-workflow/telemetry/export-status-anomalies?limit=10&offset=5&kayit_uuid=wf-1&from=2026-03-12T00%3A00%3A00%2B00%3A00&to=2026-03-12T23%3A59%3A59%2B00%3A00",
      { method: "GET" },
    );
    expect(result.filters.kayitUuid).toBe("wf-1");
    expect(result.filters.fromTs).toBe("2026-03-12T00:00:00+00:00");
    expect(result.filters.toTs).toBe("2026-03-12T23:59:59+00:00");
    expect(result.summary.totalRecords).toBe(2);
    expect(result.summary.statusBreakdown.BASARILI).toBe(2);
  });

  it("validatePhase2Cell endpointine doğru payload yollar ve sonucu normalize eder", async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      isValid: false,
      blockers: [
        {
          reasonCode: "CONFIDENCE_LOW",
          operatorMessage: "Güven düşük",
          isBlocker: true,
          severity: "warning",
          confidenceScore: 62,
          suggestedValue: 1200,
        },
      ],
      message: "Doğrulama gerekli",
      proposedValue: 1200,
    } as never);

    const result = await optiplanWorkflowService.validatePhase2Cell({
      fieldType: "boy",
      value: 1180,
      originalOcrValue: "I180",
      currentConfidence: 62,
    });

    expect(apiRequest).toHaveBeenCalledWith("/workflow/phase2/validate-cell", {
      method: "POST",
      body: JSON.stringify({
        field_type: "boy",
        value: 1180,
        original_ocr_value: "I180",
        current_confidence: 62,
      }),
    });
    expect(result.isValid).toBe(false);
    expect(result.blockers).toHaveLength(1);
    expect(result.proposedValue).toBe(1200);
  });

  it("decidePhase2Cell idempotency ile endpointe yazar ve gate durumunu döndürür", async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      success: true,
      message: "Karar kaydedildi",
      idempotencyId: "idem-1",
      cached: false,
      cellState: {
        rowId: "row-1",
        fieldType: "boy",
        approved: true,
      },
      gateStatus: "READY",
    } as never);

    const result = await optiplanWorkflowService.decidePhase2Cell({
      recordUuid: "wf-1",
      rowId: "row-1",
      fieldType: "boy",
      action: "APPROVE",
      value: 1200,
      reason: "OPERATOR_APPROVED",
      operatorNote: "manuel onay",
      idempotencyKey: "idem-1",
    });

    expect(apiRequest).toHaveBeenCalledWith("/workflow/phase2/cell-decide", {
      method: "POST",
      body: JSON.stringify({
        record_uuid: "wf-1",
        row_id: "row-1",
        field_type: "boy",
        action: "APPROVE",
        value: 1200,
        reason: "OPERATOR_APPROVED",
        error_category: null,
        operator_note: "manuel onay",
        idempotency_key: "idem-1",
      }),
    });
    expect(result.success).toBe(true);
    expect(result.gateStatus).toBe("READY");
  });

  it("getPhase2GateStatus record bazlı gate bilgisini döndürür", async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      canProceed: false,
      message: "Blocker var",
      blockerReasons: [
        {
          rowId: "row-2",
          fieldType: "adet",
          reasonCode: "CONFIDENCE_LOW",
          operatorMessage: "Adet güveni düşük",
          confidenceScore: 70,
          severity: "critical",
        },
      ],
      summary: {
        totalBlockers: 1,
        criticalCount: 1,
        warningCount: 0,
      },
      gateCheckTime: "2026-03-18T10:00:00Z",
    } as never);

    const result = await optiplanWorkflowService.getPhase2GateStatus("wf-1");

    expect(apiRequest).toHaveBeenCalledWith(
      "/workflow/phase2/wf-1/phase3-gate-status",
      { method: "GET" },
    );
    expect(result.canProceed).toBe(false);
    expect(result.summary.criticalCount).toBe(1);
  });

  it("getPhase2AuditTrail limit/offset ile çağrılır", async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      recordUuid: "wf-1",
      totalEvents: 2,
      events: [
        {
          id: "evt-1",
          createdAt: "2026-03-18T10:00:00Z",
          recordUuid: "wf-1",
          rowId: "row-1",
          fieldType: "boy",
          eventType: "CELL_DECIDED",
        },
      ],
    } as never);

    const result = await optiplanWorkflowService.getPhase2AuditTrail("wf-1", {
      limit: 25,
      offset: 10,
    });

    expect(apiRequest).toHaveBeenCalledWith(
      "/workflow/phase2/wf-1/audit-trail?limit=25&offset=10",
      { method: "GET" },
    );
    expect(result.totalEvents).toBe(2);
    expect(result.events).toHaveLength(1);
  });

  it("undoPhase2Decision endpointine doğru payload gönderir", async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      success: true,
      message: "Geri alındı",
      revertedEventId: "evt-1",
      gateStatus: "BLOCKED",
    } as never);

    const result = await optiplanWorkflowService.undoPhase2Decision({
      recordUuid: "wf-1",
      decisionEventId: "evt-1",
      idempotencyKey: "undo-1",
    });

    expect(apiRequest).toHaveBeenCalledWith("/workflow/phase2/undo", {
      method: "POST",
      body: JSON.stringify({
        record_uuid: "wf-1",
        decision_event_id: "evt-1",
        idempotency_key: "undo-1",
      }),
    });
    expect(result.success).toBe(true);
    expect(result.gateStatus).toBe("BLOCKED");
  });

  it("batchApprovePhase2DryRun ve Commit endpointlerini çağırır", async () => {
    vi.mocked(apiRequest)
      .mockResolvedValueOnce({
        dryRunId: "dry-1",
        affectedCount: 3,
        affectedCells: [],
        estimatedImpact: {
          blockersRemaining: 1,
          gateStatusAfter: "BLOCKED",
        },
      } as never)
      .mockResolvedValueOnce({
        success: true,
        appliedCount: 3,
        message: "Toplu onay uygulandı",
        gateStatus: "READY",
      } as never);

    const dryRun = await optiplanWorkflowService.batchApprovePhase2DryRun({
      recordUuid: "wf-1",
      query: {
        fieldType: "boy",
        confidenceRange: [0, 79],
        reason: "CONFIDENCE_LOW",
      },
    });

    const commit = await optiplanWorkflowService.batchApprovePhase2Commit({
      recordUuid: "wf-1",
      query: {
        fieldType: "boy",
        confidenceRange: [0, 79],
        reason: "CONFIDENCE_LOW",
      },
      dryRunId: "dry-1",
      idempotencyKey: "batch-1",
    });

    expect(apiRequest).toHaveBeenNthCalledWith(1, "/workflow/phase2/batch-approve-dry-run", {
      method: "POST",
      body: JSON.stringify({
        record_uuid: "wf-1",
        query: {
          field_type: "boy",
          confidence_range: [0, 79],
          reason: "CONFIDENCE_LOW",
        },
      }),
    });

    expect(apiRequest).toHaveBeenNthCalledWith(2, "/workflow/phase2/batch-approve-commit", {
      method: "POST",
      body: JSON.stringify({
        record_uuid: "wf-1",
        query: {
          field_type: "boy",
          confidence_range: [0, 79],
          reason: "CONFIDENCE_LOW",
        },
        dry_run_id: "dry-1",
        idempotency_key: "batch-1",
      }),
    });

    expect(dryRun.dryRunId).toBe("dry-1");
    expect(commit.success).toBe(true);
    expect(commit.gateStatus).toBe("READY");
  });
});
