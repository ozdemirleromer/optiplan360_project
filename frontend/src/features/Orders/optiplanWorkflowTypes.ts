export type WorkflowPhase = 1 | 2 | 3 | 4;

export type WorkflowSourceFolder =
  | "whatsapp_raw"
  | "scanner_raw"
  | "manuel_raw"
  | "email_raw";

export type WorkflowFileStatus =
  | "OCR_HAVUZU"
  | "OCR_KONTROL"
  | "SIPARIS_DUZENLEME"
  | "EXPORT_ONIZLEME"
  | "TAMAMLANDI"
  | "HATALI";

export type WorkflowBandThickness = "0.40 MM" | "1 MM" | "2 MM";
export type WorkflowPreviewMode = "tek_dosya" | "ayri_dosyalar";
export type WorkflowGrain = 0 | 1 | 2 | 3;
export type WorkflowRowSource = "OCR" | "MANUEL";

export interface WorkflowCustomerMatch {
  cariKodu: string;
  cariUnvan: string;
  telefon: string;
}

export interface WorkflowStockMatch {
  stokKodu: string;
  stokAdi: string;
}

export interface WorkflowPlate {
  plakaRef: string;
  etiket: string;
  plakaBoyMm: number;
  plakaEnMm: number;
}

export interface WorkflowAuditTrailEntry {
  id: string;
  text: string;
  createdAt: string;
  satirId?: string | null;
  alanAdi?: string;
  eskiDeger?: string | null;
  yeniDeger?: string | null;
}

export interface WorkflowRowConfidence {
  boy: number;
  en: number;
  adet: number;
}

export interface WorkflowRowConfidenceApproval {
  boy: boolean;
  en: boolean;
  adet: boolean;
}

export interface WorkflowRow {
  id: string;
  malzeme: string;
  boy: number | "";
  en: number | "";
  adet: number | "";
  grain: WorkflowGrain;
  bilgi: string;
  u1: boolean;
  u2: boolean;
  k1: boolean;
  k2: boolean;
  delik1: string;
  delik2: string;
  plakaRef: string;
  satirKaynagi: WorkflowRowSource;
  bantKalinligiOverride: WorkflowBandThickness | "";
  confidence: WorkflowRowConfidence;
  confidenceApproved: WorkflowRowConfidenceApproval;
}

export interface WorkflowRecord {
  kayitUuid: string;
  hamDosyaAdi: string;
  kaynakKlasor: WorkflowSourceFolder;
  gelisTarihi: string;
  dosyaDurumu: WorkflowFileStatus;
  orijinalDosyaYolu: string;
  dosyaHash: string;
  okunanCariUnvan: string;
  okunanCariTelefon: string;
  aiGuvenSkoruOzeti: string;
  aiGuvenSkoruDetayi?: Record<string, unknown> | null;
  ocrEngine?: string | null;
  ocrDurumu?: string | null;
  ocrBelgeTuru?: string | null;
  ocrReviewRequired?: boolean;
  ocrSatirSayisi?: number;
  ocrOrtGuven?: number | null;
  ocrMinGuven?: number | null;
  revizyonAdayiUyarisi: string;
  cariUnvan: string;
  cariKodu: string;
  siparisNo: string;
  termin: string;
  teslimTarihi: string;
  teslimatAdresi: string;
  odemeSekli: string;
  malzeme: string;
  stokKodu: string;
  bantKalinligi: WorkflowBandThickness;
  grainVarsayilan: WorkflowGrain;
  plakaBoyMm: number;
  plakaEnMm: number;
  fireAciklamasi: string;
  retryNo: number;
  revizyonNo: number;
  sonGuncelleme?: string | null;
  rawImageUrl?: string;
  xmlFireActive: boolean;
  selectedFormats: {
    xlsx: boolean;
  };
  previewMode: WorkflowPreviewMode;
  activePlateRef: string;
  plates: WorkflowPlate[];
  rows: WorkflowRow[];
  removedRows: WorkflowRow[];
  auditTrail: WorkflowAuditTrailEntry[];
}

export interface WorkflowDataset {
  records: WorkflowRecord[];
  customerMatches: WorkflowCustomerMatch[];
  stockMatches: WorkflowStockMatch[];
}

export interface WorkflowPreviewRow {
  id: string;
  pCodeMat: string;
  pLength: number;
  pWidth: number;
  pMinq: number;
  pGrain: number;
  pIdesc: string;
  pEdgeMatUp: "" | "04" | "1" | "2";
  pEgdeMatLo: "" | "04" | "1" | "2";
  pEdgeMatSx: "" | "04" | "1" | "2";
  pEdgeMatDx: "" | "04" | "1" | "2";
  pIidesc: string;
  pDesc1: string;
}
