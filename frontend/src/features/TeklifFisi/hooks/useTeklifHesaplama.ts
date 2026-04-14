import { useMemo } from 'react';
import type { TeklifSatir, TeklifOzet } from '../types/teklif.types';

/**
 * Teklif hesaplama hook'u
 * - Satir bazli ara toplam, vergi, toplam tutar hesaplar
 * - Genel ozet olusturur (ara toplam, toplam vergi, genel toplam)
 */
export const useTeklifHesaplama = (satirlar: TeklifSatir[]) => {
  
  // Satir bazli hesaplama (vergi dahil)
  const hesaplanmisSatirlar = useMemo(() => {
    return satirlar.map(satir => {
      const araToplam = satir.miktar * satir.birimFiyat;
      const vergiTutari = araToplam * (satir.vergiOrani / 100);
      const toplamTutar = araToplam + vergiTutari;
      
      return {
        ...satir,
        araToplam: Math.round(araToplam * 100) / 100,
        vergiTutari: Math.round(vergiTutari * 100) / 100,
        toplamTutar: Math.round(toplamTutar * 100) / 100,
      };
    });
  }, [satirlar]);

  // Ozet hesaplama
  const ozet: TeklifOzet = useMemo(() => {
    const araToplam = hesaplanmisSatirlar.reduce((acc, s) => acc + s.araToplam, 0);
    const toplamVergi = hesaplanmisSatirlar.reduce((acc, s) => acc + s.vergiTutari, 0);
    const genelToplam = araToplam + toplamVergi;

    return {
      araToplam: Math.round(araToplam * 100) / 100,
      toplamVergi: Math.round(toplamVergi * 100) / 100,
      genelToplam: Math.round(genelToplam * 100) / 100,
      satirSayisi: satirlar.length,
    };
  }, [hesaplanmisSatirlar, satirlar.length]);

  return {
    hesaplanmisSatirlar,
    ozet,
  };
};

/**
 * Tek satir icin hesaplama (utility)
 */
export const hesaplaSatirTutari = (
  miktar: number,
  birimFiyat: number,
  vergiOrani: number
): { araToplam: number; vergiTutari: number; toplamTutar: number } => {
  const araToplam = miktar * birimFiyat;
  const vergiTutari = araToplam * (vergiOrani / 100);
  const toplamTutar = araToplam + vergiTutari;

  return {
    araToplam: Math.round(araToplam * 100) / 100,
    vergiTutari: Math.round(vergiTutari * 100) / 100,
    toplamTutar: Math.round(toplamTutar * 100) / 100,
  };
};
