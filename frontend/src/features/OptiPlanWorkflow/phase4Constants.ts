/**
 * Phase 4 ortak sabitler — ExportXmlFirePage + JobDashboardPanel tarafindan kullanilir.
 * DRY: Tekrarlanan STATUS_LABEL, STATUS_COLOR, STATUS_PRIORITY ve yardimci fonksiyonlar.
 */

import type { Phase4RecordStatus, FolderHealthStatus } from "../../services/phase4Service";
import { COLORS } from "../../components/Shared/constants";

/* ---------- Status label (TR) ---------- */
export const STATUS_LABEL: Record<Phase4RecordStatus, string> = {
  PHASE4_PENDING: "Phase 4 Hazır",
  PHASE4_PREVIEW_READY: "Preview Hazır",
  PHASE4_EXPORT_RUNNING: "Export Çalışıyor",
  PHASE4_EXPORT_FAILED: "Export Hatalı",
  PHASE4_RETRY_PENDING: "Retry Bekliyor",
  COMPLETED: "Export Başarılı",
};

/* ---------- Status renk tokenleri ---------- */
export const STATUS_COLOR: Record<Phase4RecordStatus, string> = {
  PHASE4_PENDING: COLORS.primary,
  PHASE4_PREVIEW_READY: "#0f766e",
  PHASE4_EXPORT_RUNNING: COLORS.warning,
  PHASE4_EXPORT_FAILED: COLORS.danger,
  PHASE4_RETRY_PENDING: "#7c3aed",
  COMPLETED: COLORS.success,
};

/* ---------- Pipeline siralama ---------- */
export const STATUS_PRIORITY: Record<Phase4RecordStatus, number> = {
  PHASE4_PENDING: 0,
  PHASE4_PREVIEW_READY: 1,
  PHASE4_EXPORT_RUNNING: 2,
  PHASE4_EXPORT_FAILED: 3,
  PHASE4_RETRY_PENDING: 4,
  COMPLETED: 5,
};

/* ---------- Pipeline gorsel sirasi ---------- */
export const PIPELINE_ORDER: Phase4RecordStatus[] = [
  "PHASE4_PENDING",
  "PHASE4_PREVIEW_READY",
  "PHASE4_EXPORT_RUNNING",
  "COMPLETED",
];

/* ---------- Yardimci fonksiyonlar ---------- */

/** Tarih formatlayici (tr-TR) */
export function formatPhase4Date(value: string | null): string {
  if (!value) return "-";
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

/** Kuyruk siralayici: oncelik -> son guncelleme */
export function sortPhase4Queue<T extends { status: Phase4RecordStatus; updatedAt: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const p = STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status];
    if (p !== 0) return p;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });
}

/** Klasor saglik rengi */
export function healthColor(status: FolderHealthStatus): string {
  switch (status) {
    case "HEALTHY":
      return COLORS.success;
    case "WARNING":
      return COLORS.warning;
    case "OFFLINE":
      return COLORS.muted;
    case "ERROR":
      return COLORS.danger;
    default:
      return COLORS.primary;
  }
}

/** Klasor tipi etiketi (TR) */
export function folderTypeLabel(folderType: string): string {
  switch (folderType) {
    case "phase4_output":
      return "Çıktı Klasörü";
    case "phase4_preview":
      return "Preview Klasörü";
    case "phase4_manifest_archive":
      return "Manifest Arşivi";
    default:
      return folderType;
  }
}

/** Metin normalizasyonu (TR-safe) */
export function normalizeText(value?: string | null): string {
  return (value ?? "").toLocaleLowerCase("tr-TR");
}
