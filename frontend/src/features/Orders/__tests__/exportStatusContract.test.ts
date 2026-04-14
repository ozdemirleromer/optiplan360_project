import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  getExportNoticeTone,
  mapExportResultToRecordStatus,
} from "../exportStatusContract";

describe("exportStatusContract", () => {
  it("export durumunu notice tonuna deterministik esler", () => {
    expect(
      getExportNoticeTone({
        success: true,
        message: "ok",
        durum: "BASARILI",
        generatedFiles: [],
        generatedFileDetails: [],
        exportManifest: null,
      }),
    ).toBe("success");

    expect(
      getExportNoticeTone({
        success: true,
        message: "partial",
        durum: "KISMI_BASARILI",
        generatedFiles: [],
        generatedFileDetails: [],
        exportManifest: null,
      }),
    ).toBe("warning");

    expect(
      getExportNoticeTone({
        success: false,
        message: "fail",
        durum: "HATALI",
        generatedFiles: [],
        generatedFileDetails: [],
        exportManifest: null,
      }),
    ).toBe("danger");

    expect(
      getExportNoticeTone({
        success: false,
        message: "unknown",
        durum: "BILINMIYOR",
        generatedFiles: [],
        generatedFileDetails: [],
        exportManifest: null,
      }),
    ).toBe("warning");
  });

  it("workflow export sonucunu kayit durumuna dogru esler", () => {
    expect(
      mapExportResultToRecordStatus(
        {
          success: true,
          message: "ok",
          durum: "BASARILI",
          generatedFiles: [],
          generatedFileDetails: [],
          exportManifest: null,
        },
        "workflow",
        "EXPORT_ONIZLEME",
      ),
    ).toBe("TAMAMLANDI");

    expect(
      mapExportResultToRecordStatus(
        {
          success: false,
          message: "fail",
          durum: "HATALI",
          generatedFiles: [],
          generatedFileDetails: [],
          exportManifest: null,
        },
        "workflow",
        "EXPORT_ONIZLEME",
      ),
    ).toBe("HATALI");

    expect(
      mapExportResultToRecordStatus(
        {
          success: true,
          message: "partial",
          durum: "KISMI_BASARILI",
          generatedFiles: [],
          generatedFileDetails: [],
          exportManifest: null,
        },
        "workflow",
        "EXPORT_ONIZLEME",
      ),
    ).toBe("EXPORT_ONIZLEME");

    expect(
      mapExportResultToRecordStatus(
        {
          success: false,
          message: "unknown",
          durum: "BILINMIYOR",
          generatedFiles: [],
          generatedFileDetails: [],
          exportManifest: null,
        },
        "workflow",
        "EXPORT_ONIZLEME",
      ),
    ).toBe("EXPORT_ONIZLEME");

    expect(
      mapExportResultToRecordStatus(
        {
          success: true,
          message: "excel",
          durum: "BASARILI",
          generatedFiles: [],
          generatedFileDetails: [],
          exportManifest: null,
        },
        "excel",
        "EXPORT_ONIZLEME",
      ),
    ).toBe("EXPORT_ONIZLEME");
  });

  it("openapi export orneklerinde tum resmi durumlari barindirir", () => {
    const openapiPath = resolve(process.cwd(), "..", "docs", "openapi.yaml");
    const openapi = readFileSync(openapiPath, "utf-8");

    expect(openapi).toContain("WorkflowExportRecordResponseSuccessExample");
    expect(openapi).toContain("WorkflowExportRecordResponseExample");
    expect(openapi).toContain("WorkflowExportRecordResponseFailureExample");
    expect(openapi).toMatch(/durum:\s*"?BASARILI"?/);
    expect(openapi).toMatch(/durum:\s*"?KISMI_BASARILI"?/);
    expect(openapi).toMatch(/durum:\s*"?HATALI"?/);
    expect(openapi).not.toMatch(/durum:\s*"?BILINMIYOR"?/);
    expect(openapi).not.toContain("opj_aktif_mi");
    expect(openapi).not.toContain(".opj");
  });
});
