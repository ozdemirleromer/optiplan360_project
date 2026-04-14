/**
 * StationsPage — Tip ve Interface Tanımları
 */

import type React from "react";

// -------------------------------------------------------
// Tab tipi
// -------------------------------------------------------
export type StationTab = "ebatlama" | "bantlama" | "teslim" | "devices";

// -------------------------------------------------------
// Cihaz grubu tanımı
// -------------------------------------------------------
export interface DeviceGroupDef {
  key: StationTab;
  label: string;
  deviceName: string;
  icon: React.ReactNode;
  color: string;
  /** Bu cihazın kapsadığı istasyon adları (DB'deki name alanı) */
  stationNames: string[];
  /** Okutma adımları */
  steps: { scan: number; stationName: string; label: string }[];
  /** Max okutma sayısı */
  maxScans: number;
  /** 30 dk kuralı var mı? */
  hasWaitRule: boolean;
  /** Grubun açıklaması */
  description: string;
}

// -------------------------------------------------------
// StationFormData
// -------------------------------------------------------
export interface StationFormData {
  name: string;
  description: string;
}

// -------------------------------------------------------
// DeviceGroupPanel props
// -------------------------------------------------------
export interface DeviceGroupPanelProps {
  group: DeviceGroupDef;
  stations: import("../../services/adminService").StationDto[];
  allStations: import("../../services/adminService").StationDto[];
  loading: boolean;
  onRefresh: () => void;
  onToggle: (id: number) => void;
  onDelete: (id: number) => void;
  onEdit: (station: import("../../services/adminService").StationDto) => void;
  onCreate: () => void;
}
