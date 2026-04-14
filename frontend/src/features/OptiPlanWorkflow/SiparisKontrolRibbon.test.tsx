import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SiparisKontrolRibbon, type RibbonTab, RIBBON_TAB_LABELS } from "./SiparisKontrolRibbon";

describe("SiparisKontrolRibbon", () => {
  const defaultProps = {
    activeTab: "KAYIT" as RibbonTab,
    onTabChange: vi.fn(),
    onAction: vi.fn(),
    disabledActions: new Set<string>(),
    saving: false,
    selectedCount: 0,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders all 5 tabs", () => {
    render(<SiparisKontrolRibbon {...defaultProps} />);
    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(5);
    expect(tabs.map((t) => t.textContent)).toEqual([
      RIBBON_TAB_LABELS.KAYIT,
      RIBBON_TAB_LABELS.CARI,
      RIBBON_TAB_LABELS.SATIR,
      RIBBON_TAB_LABELS.KONTROL,
      RIBBON_TAB_LABELS.IS_EMRI,
    ]);
  });

  it("marks active tab with aria-selected", () => {
    render(<SiparisKontrolRibbon {...defaultProps} activeTab="SATIR" />);
    const tabs = screen.getAllByRole("tab");
    const satirTab = tabs.find((t) => t.textContent === RIBBON_TAB_LABELS.SATIR);
    expect(satirTab).toHaveAttribute("aria-selected", "true");
    const kayitTab = tabs.find((t) => t.textContent === RIBBON_TAB_LABELS.KAYIT);
    expect(kayitTab).toHaveAttribute("aria-selected", "false");
  });

  it("fires onTabChange when clicking a tab", () => {
    render(<SiparisKontrolRibbon {...defaultProps} />);
    const tabs = screen.getAllByRole("tab");
    const cariTab = tabs.find((t) => t.textContent === RIBBON_TAB_LABELS.CARI)!;
    fireEvent.click(cariTab);
    expect(defaultProps.onTabChange).toHaveBeenCalledWith("CARI");
  });

  it("shows KAYIT actions when KAYIT tab is active", () => {
    render(<SiparisKontrolRibbon {...defaultProps} activeTab="KAYIT" />);
    expect(screen.getByTitle("Değişiklikleri taslak olarak kaydet")).toBeInTheDocument();
    expect(screen.getByTitle("Backend'den en güncel veriyi çek")).toBeInTheDocument();
  });

  it("shows CARI actions when CARI tab is active", () => {
    render(<SiparisKontrolRibbon {...defaultProps} activeTab="CARI" />);
    expect(screen.getByTitle("Mikro ERP'den cari eşleştir")).toBeInTheDocument();
    expect(screen.getByTitle("Yeni cari kartı oluştur")).toBeInTheDocument();
  });

  it("shows SATIR actions when SATIR tab is active", () => {
    render(<SiparisKontrolRibbon {...defaultProps} activeTab="SATIR" />);
    expect(screen.getByTitle("Seçili satır için stok eşleştir")).toBeInTheDocument();
    expect(screen.getByTitle("Satır detayını göster")).toBeInTheDocument();
  });

  it("shows KONTROL actions when KONTROL tab is active", () => {
    render(<SiparisKontrolRibbon {...defaultProps} activeTab="KONTROL" />);
    expect(screen.getByTitle("Kayıt geneli fire açıklamasını düzenle")).toBeInTheDocument();
    expect(screen.getByTitle("Phase 4'e geçiş yap (blocker kontrolü yapılır)")).toBeInTheDocument();
  });

  it("shows IS_EMRI actions when IS_EMRI tab is active", () => {
    render(<SiparisKontrolRibbon {...defaultProps} activeTab="IS_EMRI" />);
    expect(screen.getByTitle("Export önizleme oluştur")).toBeInTheDocument();
    expect(screen.getByTitle("Dosyaları export et")).toBeInTheDocument();
    expect(screen.getByTitle("Başarısız exportu tekrar dene")).toBeInTheDocument();
  });

  it("fires onAction with correct key when clicking an action button", () => {
    render(<SiparisKontrolRibbon {...defaultProps} activeTab="KAYIT" />);
    const refreshBtn = screen.getByTitle("Backend'den en güncel veriyi çek");
    fireEvent.click(refreshBtn);
    expect(defaultProps.onAction).toHaveBeenCalledWith("refresh");
  });

  it("disables actions in disabledActions set", () => {
    const disabled = new Set(["save", "refresh"]);
    render(<SiparisKontrolRibbon {...defaultProps} disabledActions={disabled} />);
    const saveBtn = screen.getByTitle("Değişiklikleri taslak olarak kaydet");
    expect(saveBtn).toBeDisabled();
  });

  it("shows saving state label", () => {
    render(<SiparisKontrolRibbon {...defaultProps} saving={true} />);
    expect(screen.getByText(/kaydediliyor/i)).toBeInTheDocument();
  });
});
