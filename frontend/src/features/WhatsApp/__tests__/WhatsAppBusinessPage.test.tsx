import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, describe, it, expect, beforeEach } from "vitest";

// ── Mock'lar ─────────────────────────────────────────────────
vi.mock("../../../services/adminService", () => ({
  adminService: {
    getWhatsAppConfig: vi.fn(),
    getWhatsAppSummary: vi.fn(),
    listWhatsAppTemplates: vi.fn(),
    listWhatsAppMessages: vi.fn(),
    updateWhatsAppConfig: vi.fn(),
    sendWhatsAppMessage: vi.fn(),
  },
}));

vi.mock("../../../components/Layout/TopBar", () => ({
  TopBar: ({ title, children }: { title: string; children?: React.ReactNode }) => (
    <div data-testid="topbar">
      <span>{title}</span>
      {children}
    </div>
  ),
}));

vi.mock("../../../components/Shared", async () => {
  const actual = await vi.importActual<typeof import("../../../components/Shared")>("../../../components/Shared");
  return {
    ...actual,
    Button: ({ children, onClick, disabled }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean }) => (
      <button onClick={onClick} disabled={disabled}>{children}</button>
    ),
    Card: ({ title, children }: { title?: string; children: React.ReactNode }) => (
      <div data-testid={`card-${title ?? "untitled"}`}>{title && <h3>{title}</h3>}{children}</div>
    ),
    KPICard: ({ label, value }: { label: string; value: string | number }) => (
      <div data-testid={`kpi-${label}`}>{label}: {value}</div>
    ),
  };
});

// ── Import (mock'lardan sonra) ────────────────────────────────
import { adminService } from "../../../services/adminService";
import { WhatsAppBusinessPage } from "../WhatsAppBusinessPage";

// ── Test veri fabrikası ──────────────────────────────────────
function makeConfig(configured = true) {
  return {
    configured,
    phoneNumberId: "111222333",
    businessAccountId: "444555666",
    accessToken: "",
    apiVersion: "v18.0",
  };
}

function makeSummary() {
  return {
    configured: true,
    totalSent: 42,
    todaySent: 5,
    failed: 2,
  };
}

function makeMessages() {
  return [
    {
      id: "msg-1",
      toPhone: "905551234567",
      message: "Sipariş hazır",
      status: "SENT",
      sentBy: "admin",
      sentAt: "2026-03-21T10:00:00Z",
    },
    {
      id: "msg-2",
      toPhone: "905557654321",
      message: "Kargo gönderildi",
      status: "FAILED",
      sentBy: "user1",
      sentAt: "2026-03-21T11:00:00Z",
      error: "Invalid phone",
    },
  ];
}

// ── Test setup ───────────────────────────────────────────────
beforeEach(() => {
  vi.resetAllMocks();
  (adminService.getWhatsAppConfig as ReturnType<typeof vi.fn>).mockResolvedValue(makeConfig());
  (adminService.getWhatsAppSummary as ReturnType<typeof vi.fn>).mockResolvedValue(makeSummary());
  (adminService.listWhatsAppTemplates as ReturnType<typeof vi.fn>).mockResolvedValue([]);
  (adminService.listWhatsAppMessages as ReturnType<typeof vi.fn>).mockResolvedValue(makeMessages());
});

// ════════════════════════════════════════════════════════════
describe("WhatsAppBusinessPage", () => {
  // ── Test 1: Sayfa temel render ────────────────────────────
  it("başlık ve sekmeler doğru render edilmeli", async () => {
    render(<WhatsAppBusinessPage />);

    // TopBar başlığı
    expect(screen.getByText("WhatsApp Business")).toBeInTheDocument();

    // Sekme listesi yüklendikten sonra görünür olmalı
    await waitFor(() => {
      expect(screen.getByText("Genel Bakış")).toBeInTheDocument();
    });

    expect(screen.getByText("Yapılandırma")).toBeInTheDocument();
    expect(screen.getByText("Mesaj Gönder")).toBeInTheDocument();
    expect(screen.getByText("Mesaj Geçmişi")).toBeInTheDocument();
    expect(screen.getByText("Şablon Yönetimi")).toBeInTheDocument();
  });

  // ── Test 2: Yükleme durumunda spinner görünmeli ───────────
  it("yükleme sırasında loading göstergesi görünmeli", () => {
    // Promise'i asılı bırak
    (adminService.getWhatsAppConfig as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(() => {}));
    (adminService.getWhatsAppSummary as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(() => {}));
    (adminService.listWhatsAppTemplates as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(() => {}));
    (adminService.listWhatsAppMessages as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(() => {}));

    render(<WhatsAppBusinessPage />);
    expect(screen.getByText("Yükleniyor...")).toBeInTheDocument();
  });

  // ── Test 3: Genel Bakış sekmesi — KPI kartları görünmeli ──
  it("Genel Bakış sekmesi KPI kartlarını ve bağlantı durumunu göstermeli", async () => {
    render(<WhatsAppBusinessPage />);

    await waitFor(() => {
      expect(screen.getByTestId("kpi-Toplam Gönderilen")).toBeInTheDocument();
    });

    expect(screen.getByTestId("kpi-Bugün Gönderilen")).toBeInTheDocument();
    expect(screen.getByTestId("kpi-Başarısız")).toBeInTheDocument();
    expect(screen.getByTestId("kpi-Başarı Oranı")).toBeInTheDocument();
  });

  // ── Test 4: Sekme geçişi — Yapılandırma sekmesi ───────────
  it("Yapılandırma sekmesine tıklandığında form alanları görünmeli", async () => {
    const user = userEvent.setup();
    render(<WhatsAppBusinessPage />);

    await waitFor(() => {
      expect(screen.getByText("Yapılandırma")).toBeInTheDocument();
    });

    await user.click(screen.getByText("Yapılandırma"));

    await waitFor(() => {
      expect(screen.getByLabelText("Phone Number ID")).toBeInTheDocument();
    });

    expect(screen.getByLabelText("Business Account ID")).toBeInTheDocument();
    expect(screen.getByLabelText("Access Token")).toBeInTheDocument();
    expect(screen.getByLabelText("API Version")).toBeInTheDocument();
  });

  // ── Test 5: Mesaj Geçmişi — tabloda satırlar görünmeli ────
  it("Mesaj Geçmişi sekmesi mesaj kayıtlarını listelemelidir", async () => {
    const user = userEvent.setup();
    render(<WhatsAppBusinessPage />);

    await waitFor(() => {
      expect(screen.getByText("Mesaj Geçmişi")).toBeInTheDocument();
    });

    await user.click(screen.getByText("Mesaj Geçmişi"));

    await waitFor(() => {
      expect(screen.getByText("905551234567")).toBeInTheDocument();
    });

    expect(screen.getByText("905557654321")).toBeInTheDocument();
  });

  // ── Test 6: adminService metodları çağrılmalı ─────────────
  it("bileşen mount edildiğinde tüm adminService metodları çağrılmalı", async () => {
    render(<WhatsAppBusinessPage />);

    await waitFor(() => {
      expect(adminService.getWhatsAppConfig).toHaveBeenCalledTimes(1);
      expect(adminService.getWhatsAppSummary).toHaveBeenCalledTimes(1);
      expect(adminService.listWhatsAppTemplates).toHaveBeenCalledTimes(1);
      expect(adminService.listWhatsAppMessages).toHaveBeenCalledTimes(1);
    });
  });
});
