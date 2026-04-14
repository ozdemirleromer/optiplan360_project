import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { ConfigPage } from "./ConfigPage";

type FeatureFlagDto = { name: string; enabled: boolean; updatedAt: string | null };
type UIStoreShape = { themeName: string; setThemeName: (name: string) => void };
type SystemConfigDto = {
  shiftStart: string;
  shiftEnd: string;
  lunchBreakStart: string;
  lunchBreakEnd: string;
  workingDays: string[];
  holidayPolicy: string;
  orderAutoHoldHours: number;
  maxFileSizeMb: number;
  sessionTimeoutMinutes: number;
  passwordMinLength: number;
  enableTwoFactor: boolean;
  backupFrequency: string;
  logRetentionDays: number;
  advancedSettings?: unknown;
  lastSystemCheckAt?: string | null;
};
type SystemControlCheckDto = {
  checkedAt: string;
  total: number;
  ok: number;
  warn: number;
  missing: number;
  critical: number;
  coverage: number;
  rows: Array<{
    id: string;
    module: string;
    control: string;
    env: string;
    expected: string;
    current: string;
    status: "ok" | "warn" | "missing" | "critical";
    severity: "low" | "medium" | "high" | "critical";
    owner: string;
  }>;
};

type FolderSettingsDto = {
  programKokKlasoru: string;
  whatsappRawKlasoru: string;
  scannerRawKlasoru: string;
  manuelRawKlasoru: string;
  emailRawKlasoru: string;
  islenmisKlasoru: string;
  arsivKlasoru: string;
  xmlOkumaKlasoru: string;
  xlsxCiktiKlasoru: string;
  opjCiktiKlasoru: string;
  hataliKlasoru: string;
  fisEvrakNoFormati: string;
  arsivZamanDamgasiFormati: string;
  xlsxAktifMi: boolean;
  opjAktifMi: boolean;
  watcherAktifMi: boolean;
  yenidenDenemeSayisi: number;
};

const hoisted = vi.hoisted(() => {
  const getFeatureFlagsMock = vi.fn<() => Promise<{ features: FeatureFlagDto[] }>>();
  const updateFeatureFlagMock = vi.fn<(name: string, enabled: boolean) => Promise<{ featureName: string; enabled: boolean }>>();
  const getSystemConfigMock = vi.fn<() => Promise<SystemConfigDto>>();
  const updateSystemConfigMock = vi.fn<(config: Partial<SystemConfigDto>) => Promise<SystemConfigDto>>();
  const runSystemControlCheckMock = vi.fn<() => Promise<SystemControlCheckDto>>();
  const getFolderSettingsMock = vi.fn<() => Promise<FolderSettingsDto>>();
  const updateFolderSettingsMock = vi.fn<(payload: Partial<FolderSettingsDto>) => Promise<FolderSettingsDto>>();
  const browseFolderMock = vi.fn<() => Promise<{ selected: string | null; supported?: boolean }>>();
  const listDirectoriesMock = vi.fn<() => Promise<{ path: string; parent: string | null; directories: Array<{ name: string; path: string }> }>>();
  const addToastMock = vi.fn<(msg: string, type?: string) => void>();
  const setThemeNameMock = vi.fn<(name: string) => void>();
  const uiStoreState: UIStoreShape = {
    themeName: "dark",
    setThemeName: setThemeNameMock,
  };

  return {
    getFeatureFlagsMock,
    updateFeatureFlagMock,
    getSystemConfigMock,
    updateSystemConfigMock,
    runSystemControlCheckMock,
    getFolderSettingsMock,
    updateFolderSettingsMock,
    browseFolderMock,
    listDirectoriesMock,
    addToastMock,
    setThemeNameMock,
    uiStoreState,
  };
});

vi.mock("../../services/adminService", () => ({
  adminService: {
    getFeatureFlags: hoisted.getFeatureFlagsMock,
    updateFeatureFlag: hoisted.updateFeatureFlagMock,
    getSystemConfig: hoisted.getSystemConfigMock,
    updateSystemConfig: hoisted.updateSystemConfigMock,
    runSystemControlCheck: hoisted.runSystemControlCheckMock,
    browseFolder: hoisted.browseFolderMock,
    listDirectories: hoisted.listDirectoriesMock,
  },
}));

vi.mock("../../contexts/ToastContext", () => ({
  useToast: () => ({ addToast: hoisted.addToastMock }),
}));

vi.mock("../../stores/uiStore", () => ({
  useUIStore: (selector: (state: UIStoreShape) => unknown) => selector(hoisted.uiStoreState),
}));

vi.mock("../../services/optiplanWorkflowService", () => ({
  optiplanWorkflowService: {
    getFolderSettings: hoisted.getFolderSettingsMock,
    updateFolderSettings: hoisted.updateFolderSettingsMock,
  },
}));

describe("ConfigPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hoisted.browseFolderMock.mockResolvedValue({ selected: null, supported: true });
    hoisted.listDirectoriesMock.mockResolvedValue({ path: "C:/", parent: null, directories: [] });
    hoisted.getFeatureFlagsMock.mockResolvedValue({
      features: [
        { name: "ai_orchestrator", enabled: false, updatedAt: "2026-03-22T10:30:00Z" },
        { name: "ocr_enabled", enabled: true, updatedAt: "2026-03-22T10:32:00Z" },
      ],
    });
    hoisted.updateFeatureFlagMock.mockResolvedValue({ featureName: "ai_orchestrator", enabled: true });
    hoisted.getSystemConfigMock.mockResolvedValue({
      shiftStart: "08:00",
      shiftEnd: "18:00",
      lunchBreakStart: "12:00",
      lunchBreakEnd: "13:00",
      workingDays: ["Mon", "Tue", "Wed", "Thu", "Fri"],
      holidayPolicy: "TR",
      orderAutoHoldHours: 24,
      maxFileSizeMb: 25,
      sessionTimeoutMinutes: 45,
      passwordMinLength: 10,
      enableTwoFactor: true,
      backupFrequency: "daily",
      logRetentionDays: 30,
      advancedSettings: undefined,
      lastSystemCheckAt: null,
    });
    hoisted.updateSystemConfigMock.mockImplementation(async (config) => ({
      shiftStart: config.shiftStart ?? "08:00",
      shiftEnd: config.shiftEnd ?? "18:00",
      lunchBreakStart: "12:00",
      lunchBreakEnd: "13:00",
      workingDays: ["Mon", "Tue", "Wed", "Thu", "Fri"],
      holidayPolicy: "TR",
      orderAutoHoldHours: 24,
      maxFileSizeMb: 25,
      sessionTimeoutMinutes: config.sessionTimeoutMinutes ?? 45,
      passwordMinLength: 10,
      enableTwoFactor: config.enableTwoFactor ?? true,
      backupFrequency: config.backupFrequency ?? "daily",
      logRetentionDays: config.logRetentionDays ?? 30,
      advancedSettings: undefined,
      lastSystemCheckAt: null,
    }));
    hoisted.runSystemControlCheckMock.mockResolvedValue({
      checkedAt: "2026-03-22T10:35:00Z",
      total: 3,
      ok: 1,
      warn: 1,
      missing: 0,
      critical: 1,
      coverage: 100,
      rows: [
        {
          id: "row-1",
          module: "Guvenlik",
          control: "JWT secret tanimli",
          env: "production",
          expected: "configured",
          current: "configured",
          status: "ok",
          severity: "medium",
          owner: "platform",
        },
        {
          id: "row-2",
          module: "Veritabani",
          control: "Connection pool boyutu",
          env: "production",
          expected: "20",
          current: "10",
          status: "warn",
          severity: "medium",
          owner: "backend",
        },
        {
          id: "row-3",
          module: "Yedekleme",
          control: "Gunluk backup",
          env: "production",
          expected: "enabled",
          current: "disabled",
          status: "critical",
          severity: "critical",
          owner: "ops",
        },
      ],
    });
    const folderSettings: FolderSettingsDto = {
      programKokKlasoru: "C:/Optiplan360_Entegrasyon",
      whatsappRawKlasoru: "/data/input/whatsapp",
      scannerRawKlasoru: "/data/input/scanner",
      manuelRawKlasoru: "/data/input/manual",
      emailRawKlasoru: "/data/input/email",
      islenmisKlasoru: "/data/output/processed",
      arsivKlasoru: "/data/output/archive",
      xmlOkumaKlasoru: "/data/xml/read",
      xlsxCiktiKlasoru: "/data/export/xlsx",
      opjCiktiKlasoru: "/data/export/opj",
      hataliKlasoru: "/data/output/error",
      fisEvrakNoFormati: "SIP-{seq:06d}",
      arsivZamanDamgasiFormati: "%Y%m%d_%H%M%S",
      xlsxAktifMi: true,
      opjAktifMi: false,
      watcherAktifMi: true,
      yenidenDenemeSayisi: 3,
    };
    hoisted.getFolderSettingsMock.mockResolvedValue(folderSettings);
    hoisted.updateFolderSettingsMock.mockImplementation(async (payload) => ({
      ...folderSettings,
      ...payload,
    }));
  });

  it("sekme başlıklarını render eder", () => {
    render(<ConfigPage />);

    expect(screen.getByRole("button", { name: "Tema Ayarları" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sistem Kontrolü" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Klasor Yonetimi" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Servisler" })).toBeInTheDocument();
  });

  it("klasor yonetimi sekmesi ayarlari yukler ve kaydeder", async () => {
    render(<ConfigPage />);

    fireEvent.click(screen.getByRole("button", { name: "Klasor Yonetimi" }));
    await waitFor(() => expect(hoisted.getFolderSettingsMock).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("button", { name: "Kaydet" })).toBeInTheDocument();

    const input = screen.getByDisplayValue("/data/input/manual");
    fireEvent.change(input, { target: { value: "/data/input/manual-updated" } });
    fireEvent.click(screen.getByRole("button", { name: "Kaydet" }));

    await waitFor(() => {
      expect(hoisted.updateFolderSettingsMock).toHaveBeenCalledWith(
        expect.objectContaining({ manuelRawKlasoru: "/data/input/manual-updated" }),
      );
    });
  });

  it("klasor yonetimi ayni yol dogrulamasinda kaydetmeyi engeller", async () => {
    render(<ConfigPage />);

    fireEvent.click(screen.getByRole("button", { name: "Klasor Yonetimi" }));
    await waitFor(() => expect(hoisted.getFolderSettingsMock).toHaveBeenCalledTimes(1));

    fireEvent.change(screen.getByDisplayValue("/data/input/scanner"), { target: { value: "/data/input/whatsapp" } });
    fireEvent.click(screen.getByRole("button", { name: "Kaydet" }));

    await waitFor(() => {
      expect(screen.getByText("Bu klasor yolu baska bir alanla ayni olamaz.")).toBeInTheDocument();
    });
    expect(hoisted.updateFolderSettingsMock).not.toHaveBeenCalled();
  });

  it("tema sekmesinde tum gercek tema kartlarini gosterir", () => {
    render(<ConfigPage />);

    expect(screen.getByText("Light")).toBeInTheDocument();
    expect(screen.getByText("Dark")).toBeInTheDocument();
  });

  it("tema kartina tiklayinca secilen tema store'a gonderilir", () => {
    render(<ConfigPage />);

    fireEvent.click(screen.getByRole("button", { name: "Tema Ayarları" }));
    fireEvent.click(screen.getByText("Light"));

    expect(hoisted.setThemeNameMock).toHaveBeenCalledWith("light");
  });

  it("sistem kontrolü sekmesinde system config ve denetim sonucunu yükler", async () => {
    render(<ConfigPage />);

    fireEvent.click(screen.getByRole("button", { name: "Sistem Kontrolü" }));

    await waitFor(() => expect(hoisted.getSystemConfigMock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(hoisted.runSystemControlCheckMock).toHaveBeenCalledTimes(1));
    expect(screen.getByText("Temel Sistem Ayarlari")).toBeInTheDocument();
    expect(screen.getByDisplayValue("08:00")).toBeInTheDocument();
    expect(screen.getByText("Toplam")).toBeInTheDocument();
    expect(screen.getByText("JWT secret tanimli")).toBeInTheDocument();
  });

  it("sistem kontrolü sekmesinde kaydet aksiyonu update çağrısı yapar", async () => {
    render(<ConfigPage />);

    fireEvent.click(screen.getByRole("button", { name: "Sistem Kontrolü" }));
    await waitFor(() => expect(hoisted.getSystemConfigMock).toHaveBeenCalledTimes(1));

    fireEvent.change(screen.getByDisplayValue("08:00"), { target: { value: "07:30" } });
    fireEvent.change(screen.getByDisplayValue("30"), { target: { value: "60" } });
    fireEvent.click(screen.getByRole("button", { name: "Degisiklikleri Kaydet" }));

    await waitFor(() => {
      expect(hoisted.updateSystemConfigMock).toHaveBeenCalledWith(
        expect.objectContaining({
          shiftStart: "07:30",
          logRetentionDays: 60,
          shiftEnd: "18:00",
          sessionTimeoutMinutes: 45,
          backupFrequency: "daily",
          enableTwoFactor: true,
        }),
      );
    });
  });

  it("servisler sekmesine geçince feature flag listesini yükler", async () => {
    render(<ConfigPage />);

    fireEvent.click(screen.getByRole("button", { name: "Servisler" }));

    await waitFor(() => expect(hoisted.getFeatureFlagsMock).toHaveBeenCalledTimes(1));
    expect(screen.getByText("API Servisleri")).toBeInTheDocument();
    expect(screen.getByText("AI Orkestratör")).toBeInTheDocument();
    expect(screen.getByText("Devre Dışı")).toBeInTheDocument();
  });

  it("sistem kontrolü sekmesinde geri al aksiyonu draft degisiklikleri temizler", async () => {
    render(<ConfigPage />);

    fireEvent.click(screen.getByRole("button", { name: "Sistem Kontrolü" }));
    await waitFor(() => expect(hoisted.getSystemConfigMock).toHaveBeenCalledTimes(1));

    fireEvent.change(screen.getByDisplayValue("08:00"), { target: { value: "07:15" } });
    expect(screen.getByText("Kaydedilmemis sistem ayari degisiklikleri var.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Degisiklikleri Geri Al" }));

    expect(screen.getByDisplayValue("08:00")).toBeInTheDocument();
    expect(screen.queryByText("Kaydedilmemis sistem ayari degisiklikleri var.")).not.toBeInTheDocument();
  });

  it("servisler sekmesinde ozet kartlarini ve son guncelleme bilgisini gosterir", async () => {
    render(<ConfigPage />);

    fireEvent.click(screen.getByRole("button", { name: "Servisler" }));

    await waitFor(() => expect(hoisted.getFeatureFlagsMock).toHaveBeenCalledTimes(1));
    expect(screen.getByText("Toplam Servis")).toBeInTheDocument();
    expect(screen.getByText("Pasif Servisler")).toBeInTheDocument();
    expect(screen.getAllByText(/Son guncelleme:/).length).toBeGreaterThan(0);
  });

  it("servisler sekmesinde arama ve durum filtresi birlikte calisir", async () => {
    render(<ConfigPage />);

    fireEvent.click(screen.getByRole("button", { name: "Servisler" }));

    await waitFor(() => expect(hoisted.getFeatureFlagsMock).toHaveBeenCalledTimes(1));
    fireEvent.change(screen.getByLabelText("Servis ara"), { target: { value: "OCR" } });
    expect(screen.getByText("OCR Motoru")).toBeInTheDocument();
    expect(screen.queryByText("AI Orkestratör")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Servis ara"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Pasif" }));
    expect(screen.getByText("AI Orkestratör")).toBeInTheDocument();
    expect(screen.queryByText("OCR Motoru")).not.toBeInTheDocument();
  });

  it("servisler yuklenemezse hata mesajini gosterir", async () => {
    hoisted.getFeatureFlagsMock.mockRejectedValueOnce(new Error("Baglanti hatasi"));
    render(<ConfigPage />);

    fireEvent.click(screen.getByRole("button", { name: "Servisler" }));

    await waitFor(() => expect(screen.getByText("Baglanti hatasi")).toBeInTheDocument());
  });

  it("servis toggle aksiyonu update çağrısı yapar ve durumu günceller", async () => {
    render(<ConfigPage />);

    fireEvent.click(screen.getByRole("button", { name: "Servisler" }));
    await waitFor(() => expect(hoisted.getFeatureFlagsMock).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole("button", { name: "AI Orkestratör etkinleştir" }));

    await waitFor(() => {
      expect(hoisted.updateFeatureFlagMock).toHaveBeenCalledWith("ai_orchestrator", true);
    });
    await waitFor(() => expect(screen.getByRole("button", { name: "AI Orkestratör devre dışı bırak" })).toBeInTheDocument());
  });

  it("servisler sekmesindeki Yenile aksiyonu ikinci fetch çağrısını tetikler", async () => {
    render(<ConfigPage />);

    fireEvent.click(screen.getByRole("button", { name: "Servisler" }));
    await waitFor(() => expect(hoisted.getFeatureFlagsMock).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole("button", { name: "Yenile" }));

    await waitFor(() => expect(hoisted.getFeatureFlagsMock).toHaveBeenCalledTimes(2));
  });
});




