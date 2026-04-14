// SiparisKontrolPage için saf yardımcı fonksiyonlar

import type {
  SiparisRow,
  CariEslesmesi,
  WorkflowRecord,
  WorkflowRow,
  WorkflowPlate,
} from "./siparisKontrolTypes";

export function calcBlocker(cari: CariEslesmesi, rows: SiparisRow[], generalFireAciklamasi = ""): boolean {
  return (
    cari.durum === "unmatched" ||
    rows.some((r) => r.malzemeEslesmeDurumu === "unmatched") ||
    calcFireMissing(rows, generalFireAciklamasi) > 0 ||
    calcCriticalMergeGroupCount(rows) > 0
  );
}

export function mergeGroupKey(row: SiparisRow): string {
  return [row.malzeme.trim(), row.boy, row.en, row.plakaRef.trim()].join("|");
}

export function calcCriticalMergeGroupCount(rows: SiparisRow[]): number {
  const groups = new Map<string, number>();
  for (const row of rows) {
    if (row.merged) continue;
    const key = mergeGroupKey(row);
    groups.set(key, (groups.get(key) ?? 0) + 1);
  }
  let criticalGroups = 0;
  groups.forEach((count) => {
    if (count >= 2) criticalGroups += 1;
  });
  return criticalGroups;
}

export function calcCriticalMergeRowNos(rows: SiparisRow[]): Set<number> {
  const groups = new Map<string, SiparisRow[]>();
  for (const row of rows) {
    if (row.merged) continue;
    const key = mergeGroupKey(row);
    const current = groups.get(key) ?? [];
    current.push(row);
    groups.set(key, current);
  }
  const criticalRows = new Set<number>();
  groups.forEach((groupRows) => {
    if (groupRows.length >= 2) {
      groupRows.forEach((row) => criticalRows.add(row.siraNo));
    }
  });
  return criticalRows;
}

export function satirFireAciklamasiZorunluMu(row: SiparisRow): boolean {
  const normalize = (value: string) => value.toLocaleLowerCase("tr-TR");
  const fireIcerigiVar = [row.aciklama, row.ilaveAciklama, row.aciklama1]
    .map((item) => normalize(item ?? ""))
    .some((item) => item.includes("fire"));
  return row.malzemeEslesmeDurumu === "unmatched" || fireIcerigiVar;
}

export function calcFireMissing(rows: SiparisRow[], generalFireAciklamasi = ""): number {
  const normalizedGeneralNote = generalFireAciklamasi.trim();
  return rows.filter((r) => satirFireAciklamasiZorunluMu(r) && !normalizedGeneralNote).length;
}

export function calcUnmatched(rows: SiparisRow[]): number {
  return rows.filter((r) => r.malzemeEslesmeDurumu === "unmatched").length;
}

export function blockerMesaji(
  cari: CariEslesmesi,
  unmatchedN: number,
  fireMissing: number,
  criticalMergeGroups: number,
): string {
  if (cari.durum === "unmatched" && unmatchedN > 0) {
    return "Cari Eksik + ERP Eşleşme Yok (Hard Blocker Aktif)";
  }
  if (cari.durum === "unmatched") {
    return "Cari Eşleşmesi Yok — Hard Blocker Aktif";
  }
  if (unmatchedN > 0) {
    return `${unmatchedN} Eksik ERP Eşleşmesi Var (Hard Blocker Aktif)`;
  }
  if (fireMissing > 0) {
    return `${fireMissing} satırda fire açıklaması eksik (Hard Blocker Aktif)`;
  }
  if (criticalMergeGroups > 0) {
    return `${criticalMergeGroups} kritik merge grubu bekliyor (Hard Blocker Aktif)`;
  }
  return "Tüm zorunlu eşleşmeler tamamlandı";
}

export function totalAdet(rows: SiparisRow[]): number {
  return rows.reduce((sum, r) => sum + r.adet, 0);
}

export function uniqueMalzeme(rows: SiparisRow[]): number {
  return new Set(rows.map((r) => r.malzeme)).size;
}

export function mergeBekleyenSayisi(rows: SiparisRow[]): number {
  return rows.filter((r) => !r.merged).length;
}

export function isMergeCompatible(rows: SiparisRow[]): boolean {
  if (rows.length < 2) return false;
  const [first, ...rest] = rows;
  return rest.every(
    (row) =>
      row.malzeme === first.malzeme &&
      row.boy === first.boy &&
      row.en === first.en &&
      row.plakaRef === first.plakaRef,
  );
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function recordStatusPriority(status: string): number {
  if (status === "SIPARIS_DUZENLEME") return 0;
  if (status === "OCR_KONTROL") return 1;
  if (status === "EXPORT_ONIZLEME") return 2;
  if (status === "OCR_HAVUZU") return 3;
  return 9;
}

export function recordSelectorSummary(record: WorkflowRecord): { eksikStok: number; fireEksik: number } {
  const satirlar = toSiparisRowsFromService(record);
  const eksikStok = satirlar.filter((row) => !(row.malzeme ?? "").trim()).length;
  const fireEksik = calcFireMissing(satirlar, record.fireAciklamasi ?? "");
  return { eksikStok, fireEksik };
}

export function satirKaynagiToUi(value: string): "OCR" | "MANUEL" {
  return value === "MANUEL" ? "MANUEL" : "OCR";
}

export function toSiparisRowsFromService(record: WorkflowRecord): SiparisRow[] {
  return (record.satirlar ?? []).map((row: WorkflowRow, index: number) => ({
    siraNo: row.satirSirasi || index + 1,
    malzeme: row.malzeme || "",
    malzemeEslesmeDurumu: row.malzeme?.trim() ? "matched" : "unmatched",
    erpStokKodu: record.stokKodu || null,
    boy: Number(row.boy ?? 0),
    en: Number(row.en ?? 0),
    adet: Number(row.adet ?? 0),
    yon: row.grain === 1 ? "Boy" : row.grain === 2 ? "En" : "-",
    aciklama: row.bilgi || "",
    u1: row.u1 ? 1 : 0,
    u2: row.u2 ? 1 : 0,
    k1: row.k1 ? 1 : 0,
    k2: row.k2 ? 1 : 0,
    ilaveAciklama: row.delik1 || "",
    aciklama1: row.delik2 || "",
    fireAciklamasi: record.fireAciklamasi || "",
    merged: false,
    plakaRef: row.plakaRef || "P1",
    satirKaynagi: satirKaynagiToUi(row.satirKaynagi),
  }));
}

export function toUiPlates(record: WorkflowRecord, rows: SiparisRow[]): import("./siparisKontrolTypes").Plaka[] {
  if ((record.plakalar ?? []).length > 0) {
    return record.plakalar.map((p: WorkflowPlate) => {
      const satirlar = rows.filter((r) => r.plakaRef === p.plakaRef);
      return {
        plakaRef: p.plakaRef,
        etiket: p.etiket,
        satirSayisi: satirlar.length,
        hasBlocker: satirlar.some((r) => r.malzemeEslesmeDurumu === "unmatched"),
      };
    });
  }
  const uniqueRefs = [...new Set(rows.map((r) => r.plakaRef || "P1"))];
  return uniqueRefs.map((ref) => {
    const satirlar = rows.filter((r) => r.plakaRef === ref);
    return {
      plakaRef: ref,
      etiket: `Plaka ${ref}`,
      satirSayisi: satirlar.length,
      hasBlocker: satirlar.some((r) => r.malzemeEslesmeDurumu === "unmatched"),
    };
  });
}

