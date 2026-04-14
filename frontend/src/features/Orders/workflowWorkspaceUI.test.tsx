// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuditTrailPanel, ErrorRetryCard, ExportPreviewTable, ExportResultPanel, MatchPickerPanel, OcrRowsTable, PhaseNav, PlateSelectorPanel, RecordSelector, RemovedRowsPanel, WorkflowStatusBadge } from "./workflowWorkspaceUI";
import type { WorkflowExportRunResult } from "../../services/optiplanWorkflowService";

afterEach(() => {
  cleanup();
});

describe("workflowWorkspaceUI", () => {
  it("PhaseNav guard durumlarına göre faz butonlarını kilitler", () => {
    render(
      <PhaseNav
        phase={1}
        canGoPhase3={false}
        canGoPhase4={false}
        saving={false}
        onPhase1={vi.fn()}
        onPhase2={vi.fn()}
        onPhase3={vi.fn()}
        onPhase4={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Sipariş Kontrol" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "OptiPlanning" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Sipariş Kontrol" })).toHaveAttribute(
      "title",
      "Phase 3 için OCR kontrol onayı tamamlanmalı.",
    );
    expect(screen.getByRole("button", { name: "OptiPlanning" })).toHaveAttribute(
      "title",
      "Phase 4 için cari/stok eşleşmesi ve satır validasyonları tamamlanmalı.",
    );
  });

  it("MatchPickerPanel filtreleme girdisi ve seçim callbackini çalıştırır", () => {
    const handleQueryChange = vi.fn();
    const handleSelect = vi.fn();

    render(
      <MatchPickerPanel
        filterLabel="Cari filtre"
        filterPlaceholder="Cari ara"
        query=""
        onQueryChange={handleQueryChange}
        options={[{ code: "CR-001" }, { code: "CR-002" }]}
        onSelect={handleSelect}
        emptyText="Sonuç yok"
      />,
    );

    fireEvent.change(screen.getByLabelText("Cari filtre"), { target: { value: "CR-00" } });
    expect(handleQueryChange).toHaveBeenCalledWith("CR-00");

    fireEvent.click(screen.getByRole("button", { name: "CR-002" }));
    expect(handleSelect).toHaveBeenCalledWith("CR-002");
  });

  it("MatchPickerPanel boş listede mesaj gösterir", () => {
    render(
      <MatchPickerPanel
        filterLabel="Stok filtre"
        filterPlaceholder="Stok ara"
        query=""
        onQueryChange={vi.fn()}
        options={[]}
        onSelect={vi.fn()}
        emptyText="Eşleşen stok bulunamadı."
      />,
    );

    expect(screen.getByText("Eşleşen stok bulunamadı.")).toBeInTheDocument();
  });

  it("ExportResultPanel manifest ve artifact bağlantılarını gösterir", () => {
    const result: WorkflowExportRunResult = {
      success: true,
      message: "Export tamamlandı",
      durum: "BASARILI",
      generatedFiles: ["C:/exports/ornek.xlsx"],
      generatedFileDetails: [
        {
          fileFormat: "xlsx",
          fileName: "ornek.xlsx",
          filePath: "C:/exports/ornek.xlsx",
          downloadPath: "/api/v1/optiplan-workflow/files/ornek.xlsx",
          sizeBytes: 1024,
          checksumSha256: "a".repeat(64),
        },
      ],
      exportManifest: {
        manifestVersion: "workflow_export_manifest_v1",
        kayitUuid: "wf-001",
        exportId: "exp-1",
        dosyaAdi: "ORNEK",
        revizyonNo: 1,
        retryNo: 0,
        requestedFormats: ["xlsx"],
        generatedFormats: ["xlsx"],
        rowCount: 1,
        createdAt: "2026-03-12T10:00:00+00:00",
      },
    };

    render(<ExportResultPanel result={result} xlsxEnabled />);

    const statusBadge = screen.getByText("Durum: BASARILI");
    expect(statusBadge).toBeInTheDocument();
    expect(statusBadge).toHaveStyle({ background: "rgba(16,185,129,.16)" });
    expect(screen.getByText("Manifest")).toBeInTheDocument();
    expect(screen.getByText("Export ID: exp-1")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "İndir" })).toHaveAttribute(
      "href",
      "/api/v1/optiplan-workflow/files/ornek.xlsx",
    );
  });

  it("WorkflowStatusBadge durum etiketini rozet olarak gösterir", () => {
    render(<WorkflowStatusBadge label="Hatalı" />);
    expect(screen.getByText("Hatalı")).toBeInTheDocument();
  });

  it("ExportPreviewTable satırları beklenen kolonlarla render eder", () => {
    render(
      <ExportPreviewTable
        rows={[
          {
            id: "row-1",
            pCodeMat: "MDF",
            pLength: 450,
            pWidth: 320,
            pMinq: 2,
            pGrain: 3,
            pIdesc: "KAPAK",
            pEdgeMatUp: "",
            pEgdeMatLo: "",
            pEdgeMatSx: "",
            pEdgeMatDx: "",
            pIidesc: "",
            pDesc1: "",
          },
        ]}
        fireAciklamasi="Deneme"
      />,
    );

    expect(screen.getByText("[P_CODE_MAT]")).toBeInTheDocument();
    expect(screen.getByText("MDF")).toBeInTheDocument();
    expect(screen.getByText("Deneme")).toBeInTheDocument();
  });

  it("PlateSelectorPanel aktif plaka değişimi ve ekleme eylemini tetikler", () => {
    const handleAdd = vi.fn();
    const handleChange = vi.fn();

    render(
      <PlateSelectorPanel
        plates={[
          { plakaRef: "PLAKA-1", etiket: "PLAKA-1", plakaBoyMm: 2800, plakaEnMm: 2100 },
          { plakaRef: "PLAKA-2", etiket: "PLAKA-2", plakaBoyMm: 2800, plakaEnMm: 2100 },
        ]}
        activePlateRef="PLAKA-1"
        onAddPlate={handleAdd}
        onChangeActive={handleChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Plaka Ekle" }));
    expect(handleAdd).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("radio", { name: "PLAKA-2" }));
    expect(handleChange).toHaveBeenCalledWith("PLAKA-2");
  });

  it("OcrRowsTable düşük güven alanında onay aksiyonunu gösterir", () => {
    const handleApprove = vi.fn();
    render(
      <OcrRowsTable
        rows={[
          {
            id: "row-1",
            malzeme: "MDF",
            boy: 450,
            en: 320,
            adet: 2,
            grain: 3,
            bilgi: "",
            u1: false,
            u2: false,
            k1: false,
            k2: false,
            delik1: "",
            delik2: "",
            plakaRef: "PLAKA-1",
            satirKaynagi: "OCR",
            bantKalinligiOverride: "",
            confidence: { boy: 70, en: 95, adet: 70 },
            confidenceApproved: { boy: false, en: true, adet: false },
          },
        ]}
        isLowConfidence={(row, field) => row.confidence[field] < 80}
        onApprove={handleApprove}
      />,
    );

    const approveButtons = screen.getAllByRole("button", { name: "Onayla" });
    expect(approveButtons.length).toBeGreaterThan(0);
    fireEvent.click(approveButtons[0]);
    expect(handleApprove).toHaveBeenCalledWith("row-1", "boy");
  });

  it("RecordSelector seçili kaydı aria-pressed ile işaretler", () => {
    render(
      <RecordSelector
        records={[
          { kayitUuid: "wf-1", hamDosyaAdi: "ilk.pdf" },
          { kayitUuid: "wf-2", hamDosyaAdi: "ikinci.pdf" },
        ]}
        selectedId="wf-2"
        onSelect={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Kayıt: ikinci.pdf" })).toHaveAttribute("aria-pressed", "true");
  });

  it("ErrorRetryCard zorunlu hata durumunu gösterir", () => {
    render(<ErrorRetryCard status="HATALI" retryNo={2} operatorNote="Deneme" />);
    expect(screen.getByText("Kayıt durumu: HATALI")).toBeInTheDocument();
    expect(screen.getByText("Retry sayısı: 2")).toBeInTheDocument();
  });

  it("RemovedRowsPanel boş durumda da kart ve mesaj gösterir", () => {
    render(<RemovedRowsPanel rows={[]} onRestore={vi.fn()} />);
    expect(screen.getByText("Pasif Satır Deposu")).toBeInTheDocument();
    expect(screen.getByText("Pasif satır yok")).toBeInTheDocument();
  });

  it("RecordSelector keyboard ile seçim aksiyonunu tetikler", async () => {
    const user = userEvent.setup();
    const handleSelect = vi.fn();

    render(
      <RecordSelector
        records={[
          { kayitUuid: "wf-1", hamDosyaAdi: "ilk.pdf" },
          { kayitUuid: "wf-2", hamDosyaAdi: "ikinci.pdf" },
        ]}
        selectedId="wf-1"
        onSelect={handleSelect}
      />,
    );

    const recordButton = screen.getByRole("button", { name: "Kayıt: ilk.pdf" });
    recordButton.focus();
    expect(recordButton).toHaveFocus();
    await user.keyboard("{Enter}");

    expect(handleSelect).toHaveBeenCalledWith("wf-1");
  });

  it("PhaseNav keyboard ile odaklanan fazı tetikler", async () => {
    const user = userEvent.setup();
    const onPhase1 = vi.fn();
    const onPhase2 = vi.fn();

    render(
      <PhaseNav
        phase={1}
        canGoPhase3
        canGoPhase4
        saving={false}
        onPhase1={onPhase1}
        onPhase2={onPhase2}
        onPhase3={vi.fn()}
        onPhase4={vi.fn()}
      />,
    );

    const phase1Button = screen.getByRole("button", { name: "OCR Havuzu" });
    phase1Button.focus();
    expect(phase1Button).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(onPhase1).toHaveBeenCalledTimes(1);

    const phase2Button = screen.getByRole("button", { name: "OCR Kontrol" });
    phase2Button.focus();
    expect(phase2Button).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(onPhase2).toHaveBeenCalledTimes(1);
  });

  it("MatchPickerPanel keyboard ile seçenek seçimini tetikler", async () => {
    const user = userEvent.setup();
    const handleSelect = vi.fn();

    render(
      <MatchPickerPanel
        filterLabel="Cari filtre"
        filterPlaceholder="Cari ara"
        query=""
        onQueryChange={vi.fn()}
        options={[{ code: "CR-001" }]}
        onSelect={handleSelect}
        emptyText="Sonuç yok"
      />,
    );

    const optionButton = screen.getByRole("button", { name: "CR-001" });
    optionButton.focus();
    expect(optionButton).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(handleSelect).toHaveBeenCalledWith("CR-001");
  });

  it("AuditTrailPanel geçersiz zaman damgasında fallback metni gösterir", () => {
    render(
      <AuditTrailPanel
        entries={[{ id: "a1", text: "Denetim kaydı", createdAt: "gecersiz" }]}
      />,
    );

    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.getByText(/Denetim kaydı/)).toBeInTheDocument();
  });
});
