/**
 * OrderEditor shared types
 */

export interface MeasureRow {
  id: number;
  boy: string;
  en: string;
  adet: string;
  grain: string;
  u1: boolean;
  u2: boolean;
  k1: boolean;
  k2: boolean;
  delik1: string;
  delik2: string;
  info: string;
  thickness?: string; // "4" | "5" | "8" | "18"
  material?: string; // Malzeme
  status?: "NEW" | "HELD" | "OPTIMIZING" | "READY";
}
