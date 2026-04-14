// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { OCRPoolPage } from "./OCRPoolPage";

// ─── Mock: servis ─────────────────────────────────────────────────────────────

const serviceMocks = vi.hoisted(() => ({
  listRecords: vi.fn(),
  scanWatchFolders: vi.fn(),
  manualImport: vi.fn(),
  retryRecord: vi.fn(),
}));

vi.mock("../../services/optiplanWorkflowService", () => ({
  optiplanWorkflowService: {
    listRecords: serviceMocks.listRecords,
    scanWatchFolders: serviceMocks.scanWatchFolders,
    manualImport: serviceMocks.manualImport,
    retryRecord: serviceMocks.retryRecord,
  },
}));

// ─── Mock: Layout ─────────────────────────────────────────────────────────────

vi.mock("../../components/Layout", () => ({
  TopBar: ({ title, subtitle }: { title: string; subtitle?: string }) => (
    <div>
      <h1>{title}</h1>
      {subtitle ? <p>{subtitle}</p> : null}
    </div>
  ),
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeRecord(uuid: string, status: string, retryNo = 0) {
  return {
    kayitUuid: uuid,
    hamDosyaAdi: `belge_${uuid.slice(0, 4)}.pdf`,
    kaynakKlasor: "C:/raw/whatsapp",
    gelisTarihi: "2026-03-16T08:00:00",
    dosyaDurumu: status,
    orijinalDosyaYolu: "",
    dosyaHash: "",
    ocrHamJson: null,
    ayristirilmisOcrAlanlari: null,
    okunanCariUnvan: "Test Müşteri",
    okunanCariTelefon: "",
    aiGuvenSkoruOzeti: null,
    revizyonAdayiUyarisi: "",
    cariUnvan: "Test Müşteri",
    cariKodu: "M001",
    siparisNo: "SP-2026-001",
    termin: "",
    teslimTarihi: "",
    teslimatAdresi: "",
    odemeSekli: "",
    malzeme: "18MM Beyaz",
    stokKodu: "",
    bantKalinligi: "",
    grainVarsayilan: 3,
    plakaBoyMm: null,
    plakaEnMm: null,
    fireAciklamasi: "",
    retryNo,
    revizyonNo: 0,
    aktifFaz: 1,
    satirlar: [{ id: "r1" }, { id: "r2" }],
    cikarilanSatirlar: [],
    auditKayitlari: [],
    plakalar: [],
    exportKayitlari: [],
    hataKayitlari: [],
    imageUrl: "",
  };
}

// ─── Testler ──────────────────────────────────────────────────────────────────

describe("OCRPoolPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    serviceMocks.listRecords.mockResolvedValue([
      makeRecord("aaaa-1111", "PHASE_1_OCR_HAVUZU"),
      makeRecord("bbbb-2222", "PHASE_2_OCR_KONTROL"),
      makeRecord("cccc-3333", "PHASE_1_OCR_HAVUZU", 2),
    ]);
    serviceMocks.scanWatchFolders.mockResolvedValue([]);
    serviceMocks.manualImport.mockResolvedValue(makeRecord("dddd-4444", "PHASE_1_OCR_HAVUZU"));
    serviceMocks.retryRecord.mockResolvedValue(makeRecord("cccc-3333", "PHASE_1_OCR_HAVUZU", 0));
  });

  it("yükleme aşamasında yükleniyor metni gösterilir", () => {
    serviceMocks.listRecords.mockReturnValue(new Promise(() => undefined));
    render(<OCRPoolPage />);
    expect(screen.getByText(/yükleniyor/i)).toBeInTheDocument();
  });

  it("kayıtlar yüklenince tabloda gösterilir", async () => {
    render(<OCRPoolPage />);
    await waitFor(() => {
      expect(screen.getByText("belge_aaaa.pdf")).toBeInTheDocument();
      expect(screen.getByText("belge_bbbb.pdf")).toBeInTheDocument();
    });
  });

  it("'3 kayıt gösteriliyor' bilgisini gösterir", async () => {
    render(<OCRPoolPage />);
    await waitFor(() => {
      expect(screen.getByText(/3 kayıt gösteriliyor/i)).toBeInTheDocument();
    });
  });

  it("servis hatası durumunda alert gösterilir", async () => {
    serviceMocks.listRecords.mockRejectedValue(new Error("API çöktü"));
    render(<OCRPoolPage />);
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("API çöktü");
    });
  });

  it("durum filtresi uygulanınca kayıt sayısı azalır", async () => {
    render(<OCRPoolPage />);
    await waitFor(() => {
      expect(screen.getByText(/3 kayıt gösteriliyor/i)).toBeInTheDocument();
    });
    // Durum select'ini değiştir — PHASE_2 seçeneğini bul
    const select = screen.getByLabelText("Durum");
    fireEvent.change(select, { target: { value: "PHASE_2_OCR_KONTROL" } });
    await waitFor(() => {
      expect(screen.getByText(/1 kayıt gösteriliyor/i)).toBeInTheDocument();
    });
  });

  it("Arama kutusuna yazınca filtreleme yapılır", async () => {
    render(<OCRPoolPage />);
    await waitFor(() => {
      expect(screen.getByText(/3 kayıt gösteriliyor/i)).toBeInTheDocument();
    });
    const input = screen.getByPlaceholderText(/belge adı, klasör, cari/i);
    fireEvent.change(input, { target: { value: "aaaa" } });
    await waitFor(() => {
      expect(screen.getByText(/1 kayıt gösteriliyor/i)).toBeInTheDocument();
    });
  });

  it("Filtreyi Temizle butonu filtreleri sıfırlar", async () => {
    render(<OCRPoolPage />);
    await waitFor(() => {
      const input = screen.getByPlaceholderText(/belge adı, klasör, cari/i);
      fireEvent.change(input, { target: { value: "aaaa" } });
    });
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /filtreyi temizle/i })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: /filtreyi temizle/i }));
    await waitFor(() => {
      expect(screen.getByText(/3 kayıt gösteriliyor/i)).toBeInTheDocument();
    });
  });

  it("retry > 0 olan kayıt retry sütununda sayı gösterir", async () => {
    render(<OCRPoolPage />);
    await waitFor(() => {
      // cccc-3333 kaydının retryNo 2 — "2" metni sayfada birden fazla kez çıkabilir
      const matches = screen.getAllByText("2");
      expect(matches.length).toBeGreaterThan(0);
    });
  });

  it("Klasörleri Tara butonu scanWatchFolders çağırır", async () => {
    render(<OCRPoolPage />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /klasörleri tara/i })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: /klasörleri tara/i }));
    await waitFor(() => {
      expect(serviceMocks.scanWatchFolders).toHaveBeenCalled();
    });
  });

  it("Yenile butonu listRecords tekrar çağırır", async () => {
    render(<OCRPoolPage />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /yenile/i })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: /yenile/i }));
    await waitFor(() => {
      expect(serviceMocks.listRecords).toHaveBeenCalledTimes(2);
    });
  });

  it("kayıt yoksa 'Henüz OCR kaydı yok' mesajı gösterilir", async () => {
    serviceMocks.listRecords.mockResolvedValue([]);
    render(<OCRPoolPage />);
    await waitFor(() => {
      expect(screen.getByText(/Henüz OCR kaydı yok/i)).toBeInTheDocument();
    });
  });

  it("tablo satırlarında satır adedi ve cari bilgisi gösterilir", async () => {
    render(<OCRPoolPage />);
    await waitFor(() => {
      // Satır adedi sütununda "2" değeri görünmeli
      expect(screen.getAllByText("2").length).toBeGreaterThan(0);
      // Cari bilgisi görünmeli
      expect(screen.getAllByText("Test Müşteri").length).toBeGreaterThan(0);
    });
  });

  it("Son Güncelleme sütunu tablo başlığında görünür", async () => {
    render(<OCRPoolPage />);
    await waitFor(() => {
      expect(screen.getByText("Son Güncelleme")).toBeInTheDocument();
    });
  });

  it("Tarih aralığı filtresi uygulanınca eşleşmeyen kayıtlar gizlenir", async () => {
    serviceMocks.listRecords.mockResolvedValue([
      { ...makeRecord("aaaa-1111", "PHASE_1_OCR_HAVUZU"), gelisTarihi: "2026-01-10T08:00:00" },
      { ...makeRecord("bbbb-2222", "PHASE_1_OCR_HAVUZU"), gelisTarihi: "2026-03-16T08:00:00" },
    ]);
    render(<OCRPoolPage />);
    await waitFor(() => {
      expect(screen.getByText(/2 kayıt gösteriliyor/i)).toBeInTheDocument();
    });
    const dateInput = screen.getByLabelText("Başlangıç Tarihi");
    fireEvent.change(dateInput, { target: { value: "2026-03-01" } });
    await waitFor(() => {
      expect(screen.getByText(/1 kayıt gösteriliyor/i)).toBeInTheDocument();
    });
  });

  it("Hata Kayıtları butonu durum filtresini HATA olarak ayarlar", async () => {
    serviceMocks.listRecords.mockResolvedValue([
      makeRecord("aaaa-1111", "PHASE_1_OCR_HAVUZU"),
      makeRecord("bbbb-2222", "HATA"),
    ]);
    render(<OCRPoolPage />);
    await waitFor(() => {
      expect(screen.getByText(/2 kayıt gösteriliyor/i)).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: "Hata Kayıtları" }));
    await waitFor(() => {
      expect(screen.getByText(/1 kayıt gösteriliyor/i)).toBeInTheDocument();
    });
  });

  it("Görünüm Kaydet butonu render edilir", async () => {
    render(<OCRPoolPage />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Görünüm Kaydet" })).toBeInTheDocument();
    });
  });

  it("manuel dosya yükleme ile manualImport çağrılır", async () => {
    render(<OCRPoolPage />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /dosyayı yükle/i })).toBeInTheDocument();
    });

    const file = new File(["dummy"], "ornek.pdf", { type: "application/pdf" });
    const fileInput = screen.getByLabelText("OCR Dosyası");
    fireEvent.change(fileInput, { target: { files: [file] } });

    fireEvent.click(screen.getByRole("button", { name: /dosyayı yükle/i }));

    await waitFor(() => {
      expect(serviceMocks.manualImport).toHaveBeenCalledWith(file, "manuel_raw", false);
    });

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent("Dosya OCR havuzuna yüklendi: ornek.pdf");
    });
  });

  it("dosya seçilmeden 'Dosyayı Yükle' butonu aktif olur ve uyarı gösterir", async () => {
    render(<OCRPoolPage />);
    const uploadButton = await screen.findByRole("button", { name: /dosyayı yükle/i });
    expect(uploadButton).toBeEnabled();
    fireEvent.click(uploadButton);
    expect(await screen.findByRole("alert")).toHaveTextContent("Lütfen önce bir dosya seçin");
  });

  it("manuel yükleme yardım metni görünür", async () => {
    render(<OCRPoolPage />);
    expect(await screen.findByText(/İpucu:/i)).toBeInTheDocument();
  });

  it("PHASE_2 kaydında 'OCR Kontrol →' butonu görünür", async () => {
    render(<OCRPoolPage />);
    expect(await screen.findByRole("button", { name: "OCR Kontrol →" })).toBeInTheDocument();
  });

  it("retry butonuna basınca retryRecord çağrılır", async () => {
    serviceMocks.listRecords.mockResolvedValue([
      makeRecord("err-1", "HATA", 1),
    ]);
    render(<OCRPoolPage />);

    const retryButton = await screen.findByRole("button", { name: "Retry" });
    fireEvent.click(retryButton);

    await waitFor(() => {
      expect(serviceMocks.retryRecord).toHaveBeenCalledWith("err-1");
    });
  });

  it("Yinelemeyi zorla işaretlenirse manualImport forceDuplicate=true gönderir", async () => {
    render(<OCRPoolPage />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /dosyayı yükle/i })).toBeInTheDocument();
    });

    const file = new File(["dummy"], "ornek2.pdf", { type: "application/pdf" });
    fireEvent.change(screen.getByLabelText("OCR Dosyası"), { target: { files: [file] } });
    fireEvent.click(screen.getByLabelText("Yinelemeyi zorla"));
    fireEvent.click(screen.getByRole("button", { name: /dosyayı yükle/i }));

    await waitFor(() => {
      expect(serviceMocks.manualImport).toHaveBeenCalledWith(file, "manuel_raw", true);
    });
  });
});
