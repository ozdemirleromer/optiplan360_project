// Sipariş Kontrol sayfası için ortak tip tanımları

import type {
  WorkflowRecord,
  WorkflowRow,
  WorkflowBandThickness,
  WorkflowGrain,
  WorkflowPlate,
  WorkflowLookupCustomer,
  WorkflowLookupStock,
} from "../../services/optiplanWorkflowService";

export type {
  WorkflowRecord,
  WorkflowRow,
  WorkflowBandThickness,
  WorkflowGrain,
  WorkflowPlate,
  WorkflowLookupCustomer,
  WorkflowLookupStock,
};

export type RowKaynak = "OCR" | "MANUEL";

export interface SiparisRow {
  siraNo: number;
  malzeme: string;
  malzemeEslesmeDurumu: "matched" | "unmatched";
  erpStokKodu: string | null;
  boy: number;
  en: number;
  adet: number;
  yon: string;
  aciklama: string;
  u1: number;
  u2: number;
  k1: number;
  k2: number;
  ilaveAciklama: string;
  aciklama1: string;
  fireAciklamasi: string;
  merged: boolean;
  plakaRef: string;
  satirKaynagi: RowKaynak;
}

export interface CariEslesmesi {
  durum: "matched" | "unmatched";
  cariKodu: string | null;
  cariUnvan: string | null;
  telefon: string | null;
}

export interface Plaka {
  plakaRef: string;
  etiket: string;
  satirSayisi: number;
  hasBlocker: boolean;
}

export interface CariMatch {
  cariKodu: string;
  cariUnvan: string;
  telefon: string;
}

export interface StokMatch {
  stokKodu: string;
  stokAdi: string;
  kategori?: string;
  olcuKalinlik?: string;
}

export type DemoScenario = "A" | "B" | "C" | "D" | "E";
