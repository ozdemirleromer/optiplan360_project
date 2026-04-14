// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { IntegrationReadonlyPanel } from "./IntegrationReadonlyPanel";
import { integrationService } from "../../services/integrationService";

vi.mock("../../services/integrationService");

describe("IntegrationReadonlyPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fallback teknik alanlari ve hata ozetini render eder", async () => {
    vi.mocked(integrationService.listEntityMaps).mockResolvedValue([] as never);
    vi.mocked(integrationService.listOutbox).mockResolvedValue([
      {
        id: "out-1",
        entityType: "ACCOUNT",
        entityId: "acc-1",
        operation: "UPSERT",
        payload: {},
        status: "FAILED",
        retryCount: 2,
        maxRetries: 3,
        errorMessage: "Baglanti kesildi",
        createdAt: "2026-03-11T11:00:00Z",
      },
    ] as never);
    vi.mocked(integrationService.listErrors).mockResolvedValue([
      {
        id: "err-1",
        entityType: "ACCOUNT",
        entityId: "acc-1",
        errorCode: "E_MIKRO_READ_ONLY",
        errorMessage: "Baglanti kesildi",
        isResolved: false,
        createdAt: "2026-03-11T11:01:00Z",
      },
    ] as never);
    vi.mocked(integrationService.listAudit).mockResolvedValue([
      {
        id: "audit-1",
        action: "SYNC_END",
        entityType: "ACCOUNT",
        entityId: "acc-1",
        createdAt: "2026-03-11T11:05:00Z",
      },
    ] as never);

    render(
      <IntegrationReadonlyPanel
        entityType="ACCOUNT"
        entityId="acc-1"
        title="Cari Teknik Paneli"
        fallbackExternalId="CARI-001"
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Cari Teknik Paneli")).toBeInTheDocument();
      expect(screen.getByText("MIKRO / CARI-001")).toBeInTheDocument();
      expect(screen.getByText("FAILED")).toBeInTheDocument();
      expect(screen.getByText("2 / 3")).toBeInTheDocument();
      expect(screen.getByText("E_MIKRO_READ_ONLY")).toBeInTheDocument();
      expect(screen.getByText("Planlı değil")).toBeInTheDocument();
      expect(screen.getByText("Baglanti kesildi")).toBeInTheDocument();
      expect(screen.getByText(/SYNC_END/i)).toBeInTheDocument();
    });
  });

  it("lokal aktarim blokajlarini panel icinde gosterir", async () => {
    vi.mocked(integrationService.listEntityMaps).mockResolvedValue([] as never);
    vi.mocked(integrationService.listOutbox).mockResolvedValue([] as never);
    vi.mocked(integrationService.listErrors).mockResolvedValue([] as never);
    vi.mocked(integrationService.listAudit).mockResolvedValue([] as never);

    render(
      <IntegrationReadonlyPanel
        entityType="ORDER"
        entityId="ord-1"
        title="Siparis Teknik Paneli"
        localIssues={[
          {
            code: "E_ORDER_ACCOUNT_REQUIRED",
            message: "Cari hesap secilmeden teknik aktarim baslatilamaz.",
          },
          {
            code: "E_ORDER_STOCK_REQUIRED",
            message: "2 siparis satirinda stok kodu yok. Teknik aktarim baslatilamaz.",
          },
        ]}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Aktarim Blokajlari")).toBeInTheDocument();
      expect(screen.getByText("E_ORDER_ACCOUNT_REQUIRED")).toBeInTheDocument();
      expect(screen.getByText("E_ORDER_STOCK_REQUIRED")).toBeInTheDocument();
      expect(screen.getByText(/Cari hesap secilmeden teknik aktarim/i)).toBeInTheDocument();
      expect(screen.getByText(/2 siparis satirinda stok kodu yok/i)).toBeInTheDocument();
    });
  });

  it("readiness profili verildiginde handoff matrisini ayni panelde gosterir", async () => {
    vi.mocked(integrationService.listEntityMaps).mockResolvedValue([] as never);
    vi.mocked(integrationService.listOutbox).mockResolvedValue([] as never);
    vi.mocked(integrationService.listErrors).mockResolvedValue([] as never);
    vi.mocked(integrationService.listAudit).mockResolvedValue([] as never);

    render(
      <IntegrationReadonlyPanel
        entityType="ORDER"
        entityId="ord-2"
        title="Siparis Teknik Paneli"
        readinessProfile={{
          scope: "ORDER",
          scopeLabel: "Siparis ERP Handoff",
          sourceSystem: "MIKRO",
          readyFields: 3,
          totalFields: 5,
          blockingCodes: ["E_ORDER_STOCK_REQUIRED", "E_ORDER_PAYMENT_METHOD_REQUIRED"],
          masterDataStatus: "READY",
          masterDataSummary: "Mikro cari kodu hazir: CARI-001",
          accountMikroCariKod: "CARI-001",
          entityMapStatus: "PENDING",
          entityMapExternalId: "ORD-002",
          outboxStatus: "QUEUED",
          outboxRetryCount: 1,
          outboxMaxRetries: 5,
          lastSyncedAt: "2026-03-12T08:00:00Z",
          lastErrorAt: null,
          lastErrorCode: null,
          lastErrorMessage: null,
          fields: [
            {
              key: "crmAccountId",
              label: "Cari Hesap",
              owner: "Header / Cari Master",
              ready: true,
              value: "crm-100",
              note: "Mikro cari eslesmesi bu referans uzerinden kurulur.",
              blockingCode: "E_ORDER_ACCOUNT_REQUIRED",
              blockingCount: 0,
            },
            {
              key: "stockReferences",
              label: "Satir Stok Referansi",
              owner: "Satir / Stok Master",
              ready: false,
              value: "1 / 2 hazir satir",
              note: "Her siparis satiri gercek stok kodu ile kapanmalidir.",
              blockingCode: "E_ORDER_STOCK_REQUIRED",
              blockingCount: 1,
            },
          ],
        }}
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole("region", { name: "ERP Handoff Profili" })).toBeInTheDocument();
      expect(screen.getByText("3 / 5 hazir alan")).toBeInTheDocument();
        expect(screen.getAllByText("E_ORDER_STOCK_REQUIRED").length).toBeGreaterThan(0);
        expect(screen.getByText("Satir Stok Referansi")).toBeInTheDocument();
        expect(screen.getByText("1 / 2 hazir satir")).toBeInTheDocument();
        expect(screen.getByText(/Blokaj Kodu: E_ORDER_STOCK_REQUIRED \(1\)/i)).toBeInTheDocument();
        expect(screen.getByText("Operasyon Ozeti")).toBeInTheDocument();
        expect(screen.getByText("Master Data: READY")).toBeInTheDocument();
        expect(screen.getByText("Entity Map: PENDING")).toBeInTheDocument();
        expect(screen.getByText("Outbox: QUEUED")).toBeInTheDocument();
        expect(screen.getByText("Mikro cari kodu hazir: CARI-001")).toBeInTheDocument();
      });
    });
  });
