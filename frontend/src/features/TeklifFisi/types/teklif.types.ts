// Teklif Fişi - TypeScript Tipleri
// Kural: Vergi sadece 0, 10, veya 20 olabilir

export type VergiOrani = 0 | 10 | 20;

export interface TeklifHeader {
  cariKodu: string;
  telefon: string;
  belgeNo: string; // Format: TF-YYYY-######, otomatik üretilir
  belgeTarihi: Date;
}

export interface TeklifSatir {
  id: string; // UUID
  siraNo: number; // 1, 2, 3...
  stokKodu: string;
  stokAdi: string;
  miktar: number; // > 0
  birimFiyat: number; // >= 0
  vergiOrani: VergiOrani;
  // Hesaplanmis alanlar (readonly - otomatik hesaplanir)
  araToplam: number; // miktar * birimFiyat
  vergiTutari: number; // araToplam * vergiOrani / 100
  toplamTutar: number; // araToplam + vergiTutari
}

export interface TeklifOzet {
  araToplam: number; // Tum satirlarin ara toplami (vergi haric)
  toplamVergi: number; // Tum vergilerin toplami
  genelToplam: number; // Ara toplam + vergi
  satirSayisi: number;
}

export interface TeklifFisi {
  header: TeklifHeader;
  satirlar: TeklifSatir[];
  ozet: TeklifOzet;
  durum: 'taslak' | 'onaylandi' | 'siparis';
}

// Validasyon kurallari
export const VERGI_ORANLARI: VergiOrani[] = [0, 10, 20];

export const isValidVergiOrani = (value: number): value is VergiOrani => {
  return VERGI_ORANLARI.includes(value as VergiOrani);
};

// Belge No format kontrolu
export const isValidBelgeNo = (belgeNo: string): boolean => {
  const pattern = /^TF-\d{4}-\d{6}$/;
  return pattern.test(belgeNo);
};

// Telefon formatlama
export const formatTelefon = (value: string): string => {
  const cleaned = value.replace(/\D/g, '');
  if (cleaned.length === 0) return '';
  if (cleaned.length <= 4) return cleaned;
  if (cleaned.length <= 7) return `0 (${cleaned.slice(0, 3)}) ${cleaned.slice(3)}`;
  return `0 (${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6, 8)}-${cleaned.slice(8, 10)}`;
};

// Para formatlama (TR)
export const formatPara = (value: number): string => {
  return value.toLocaleString('tr-TR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};
