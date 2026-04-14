// Demo senaryo verisi ve builder — yalnızca geliştirme/test modunda kullanılır

import type { CariEslesmesi, CariMatch, DemoScenario, Plaka, SiparisRow, StokMatch } from "./siparisKontrolTypes";

export const CARI_MATCHES: CariMatch[] = [
  { cariKodu: "CARI-001", cariUnvan: "Özdemirler Orman Ürünleri", telefon: "0555 123 45 67" },
  { cariKodu: "CARI-002", cariUnvan: "Ağaç ve Metal Ltd.", telefon: "0532 456 78 90" },
  { cariKodu: "CARI-003", cariUnvan: "Ankara Mobilya A.Ş.", telefon: "0312 789 01 23" },
  { cariKodu: "CARI-004", cariUnvan: "Özbek Dekorasyon", telefon: "0543 234 56 78" },
];

export const STOK_MATCHES: StokMatch[] = [
  { stokKodu: "STK-001", stokAdi: "18mm Sunta Beyaz", kategori: "Levha", olcuKalinlik: "2100x2800 / 18mm" },
  { stokKodu: "STK-002", stokAdi: "MDF Lam Ceviz 8mm", kategori: "Levha", olcuKalinlik: "1830x3660 / 8mm" },
  { stokKodu: "STK-003", stokAdi: "Melamin Meşe 18mm", kategori: "Levha", olcuKalinlik: "2100x2800 / 18mm" },
  { stokKodu: "STK-004", stokAdi: "16mm MDF Beyaz", kategori: "MDF", olcuKalinlik: "2100x2800 / 16mm" },
  { stokKodu: "STK-005", stokAdi: "HDF 3mm Ceviz", kategori: "HDF", olcuKalinlik: "1830x3660 / 3mm" },
];

export const MATCHED_CARI: CariEslesmesi = {
  durum: "matched",
  cariKodu: "CARI-001",
  cariUnvan: "Özdemirler Orman Ürünleri",
  telefon: "0555 123 45 67",
};

export const UNMATCHED_CARI: CariEslesmesi = {
  durum: "unmatched",
  cariKodu: null,
  cariUnvan: null,
  telefon: null,
};

export const SCENARIO_LABELS: Record<DemoScenario, string> = {
  A: "A — Kısmi Blocker",
  B: "B — Cari Eksik",
  C: "C — Tümü Tamam",
  D: "D — Merge Bekleyen",
  E: "E — Fire Açıklaması",
};

export function buildScenarioData(
  scenario: DemoScenario,
): { cari: CariEslesmesi; rows: SiparisRow[]; plates: Plaka[] } {
  const baseRows: SiparisRow[] = [
    {
      siraNo: 1,
      malzeme: "18mm Sunta Beyaz",
      malzemeEslesmeDurumu: "matched",
      erpStokKodu: "STK-001",
      boy: 2800, en: 600, adet: 4, yon: "Boy",
      aciklama: "Dolap yan panel",
      u1: 0, u2: 0, k1: 2, k2: 2,
      ilaveAciklama: "", aciklama1: "1. Grup", fireAciklamasi: "",
      merged: false, plakaRef: "P1", satirKaynagi: "OCR",
    },
    {
      siraNo: 2,
      malzeme: "MDF Lam Ceviz 8mm",
      malzemeEslesmeDurumu: "matched",
      erpStokKodu: "STK-002",
      boy: 1200, en: 400, adet: 6, yon: "En",
      aciklama: "Raf kapağı",
      u1: 1, u2: 1, k1: 0, k2: 0,
      ilaveAciklama: "Kenar bandı dikkat", aciklama1: "2. Grup", fireAciklamasi: "",
      merged: false, plakaRef: "P2", satirKaynagi: "OCR",
    },
    {
      siraNo: 3,
      malzeme: "Melamin Meşe 18mm",
      malzemeEslesmeDurumu: "matched",
      erpStokKodu: "STK-003",
      boy: 900, en: 400, adet: 10, yon: "Boy",
      aciklama: "Alt raf",
      u1: 0, u2: 0, k1: 1, k2: 1,
      ilaveAciklama: "", aciklama1: "1. Grup", fireAciklamasi: "",
      merged: false, plakaRef: "P1", satirKaynagi: "MANUEL",
    },
  ];

  const basePlates: Plaka[] = [
    { plakaRef: "P1", etiket: "Plaka 1 — Beyaz", satirSayisi: 2, hasBlocker: false },
    { plakaRef: "P2", etiket: "Plaka 2 — Ceviz", satirSayisi: 1, hasBlocker: false },
    { plakaRef: "P3", etiket: "Plaka 3 — Meşe", satirSayisi: 0, hasBlocker: false },
  ];

  switch (scenario) {
    case "A": {
      const aRows: SiparisRow[] = [
        { ...baseRows[0] },
        {
          ...baseRows[1],
          malzemeEslesmeDurumu: "unmatched",
          erpStokKodu: null,
          malzeme: "18mm Sunta Beyaz",
          boy: 2800, en: 600, plakaRef: "P1",
        },
        { ...baseRows[2] },
      ];
      return {
        cari: MATCHED_CARI,
        rows: aRows,
        plates: [{ ...basePlates[0], hasBlocker: true }, { ...basePlates[1] }, { ...basePlates[2] }],
      };
    }
    case "B":
      return { cari: UNMATCHED_CARI, rows: baseRows, plates: basePlates };
    case "C":
      return { cari: MATCHED_CARI, rows: baseRows, plates: basePlates };
    case "D": {
      const dRows: SiparisRow[] = [
        { ...baseRows[0], merged: true },
        { ...baseRows[1], merged: true },
        { ...baseRows[2] },
      ];
      return { cari: MATCHED_CARI, rows: dRows, plates: basePlates };
    }
    case "E": {
      const eRows: SiparisRow[] = [
        { ...baseRows[0] },
        { ...baseRows[1], plakaRef: "P1", fireAciklamasi: "Yanlış kesim nedeniyle %5 fire — fire miktarı: 0.12 m²" },
        { ...baseRows[2], plakaRef: "P2", fireAciklamasi: "", malzemeEslesmeDurumu: "unmatched", erpStokKodu: null },
      ];
      return {
        cari: MATCHED_CARI,
        rows: eRows,
        plates: [{ ...basePlates[0] }, { ...basePlates[1] }, { ...basePlates[2], hasBlocker: true }],
      };
    }
  }
}
