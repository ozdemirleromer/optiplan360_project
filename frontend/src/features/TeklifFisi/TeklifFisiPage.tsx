import React, { useState, useCallback, useEffect } from 'react';
import { TeklifHeader } from './components/TeklifHeader';
import { TeklifGrid } from './components/TeklifGrid';
import { TeklifFooter } from './components/TeklifFooter';
import { StokSeciciModal } from './components/StokSeciciModal';
import { useToast } from './components/Toast';
import { useBelgeNo } from './hooks/useBelgeNo';
import { useTeklifHesaplama } from './hooks/useTeklifHesaplama';
import { crmService } from '../../services/crmService';
import type {
  TeklifHeader as TeklifHeaderType,
  TeklifSatir,
  VergiOrani
} from './types/teklif.types';

function createTeklifSatirId() {
  if (typeof globalThis !== 'undefined' && globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return 'satir-' + Date.now() + '-' + Math.random().toString(36).slice(2, 10);
}

export const TeklifFisiPage: React.FC = () => {
  const { belgeNo, regenerate } = useBelgeNo();
  const { showToast, ToastContainer } = useToast();

  // Header state
  const [header, setHeader] = useState<TeklifHeaderType>({
    cariKodu: '',
    telefon: '',
    belgeNo: belgeNo || 'TF-2026-000001',
    belgeTarihi: new Date(),
  });

  // BelgeNo guncellenince header'i guncelle
  useEffect(() => {
    if (belgeNo) {
      setHeader(prev => ({ ...prev, belgeNo }));
    }
  }, [belgeNo]);

  // Satirlar state
  const [satirlar, setSatirlar] = useState<TeklifSatir[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Modal state
  const [isStokModalOpen, setIsStokModalOpen] = useState(false);
  const [activeSatirId, setActiveSatirId] = useState<string | null>(null);

  // Hesaplamalar
  const { hesaplanmisSatirlar, ozet } = useTeklifHesaplama(satirlar);

  // Header degisikligi
  const handleHeaderChange = useCallback((field: keyof TeklifHeaderType, value: TeklifHeaderType[keyof TeklifHeaderType]) => {
    setHeader(prev => ({ ...prev, [field]: value }));
  }, []);

  // Yeni satir ekle
  const handleSatirEkle = useCallback(() => {
    const yeniSatir: TeklifSatir = {
      id: createTeklifSatirId(),
      siraNo: satirlar.length + 1,
      stokKodu: '',
      stokAdi: '',
      miktar: 0,
      birimFiyat: 0,
      vergiOrani: 20 as VergiOrani, // Default %20
      araToplam: 0,
      vergiTutari: 0,
      toplamTutar: 0,
    };
    setSatirlar(prev => [...prev, yeniSatir]);
  }, [satirlar.length]);

  // Satir sil
  const handleSatirSil = useCallback((id: string) => {
    setSatirlar(prev => {
      const filtered = prev.filter(s => s.id !== id);
      // Sira numaralarini yeniden duzenle
      return filtered.map((s, idx) => ({ ...s, siraNo: idx + 1 }));
    });
  }, []);

  // Satir degisikligi
  const handleSatirChange = useCallback((id: string, field: keyof TeklifSatir, value: TeklifSatir[keyof TeklifSatir]) => {
    setSatirlar(prev =>
      prev.map(satir =>
        satir.id === id ? { ...satir, [field]: value } : satir
      )
    );
  }, []);

  // Stok sec - modal ac
  const handleStokSec = useCallback((satirId: string) => {
    setActiveSatirId(satirId);
    setIsStokModalOpen(true);
  }, []);

  // Stok secildi
  const handleStokSelect = useCallback((stok: { kod: string; ad: string; birim: string; fiyat: number; kategori?: string }) => {
    if (activeSatirId) {
      handleSatirChange(activeSatirId, 'stokKodu', stok.kod);
      handleSatirChange(activeSatirId, 'stokAdi', stok.ad);
      handleSatirChange(activeSatirId, 'birimFiyat', stok.fiyat);
    }
    setIsStokModalOpen(false);
    setActiveSatirId(null);
  }, [activeSatirId, handleSatirChange]);

  const resolveAccountId = useCallback(async (cariKodu: string): Promise<string> => {
    const normalizedCariKodu = cariKodu.trim();
    if (!normalizedCariKodu) {
      throw new Error('Cari kodu bos olamaz.');
    }

    const accounts = await crmService.listAccounts({ search: normalizedCariKodu });
    const normalizedLower = normalizedCariKodu.toLocaleLowerCase('tr-TR');

    const exactMatch = accounts.find((account) =>
      account.id === normalizedCariKodu ||
      account.mikroCariKod?.toLocaleLowerCase('tr-TR') === normalizedLower ||
      account.companyName?.toLocaleLowerCase('tr-TR') === normalizedLower
    );

    if (exactMatch) {
      return exactMatch.id;
    }

    if (accounts.length === 1) {
      return accounts[0].id;
    }

    throw new Error('Cari kodu ile eslesen tek bir musteri bulunamadi.');
  }, []);

  // Kaydet
  const handleKaydet = useCallback(async () => {
    // Validasyon kontrol
    if (!header.cariKodu) {
      showToast('Cari kodu zorunlu!', 'error');
      return;
    }
    if (satirlar.length === 0) {
      showToast('En az bir satir ekleyin!', 'error');
      return;
    }
    const eksikSatir = satirlar.find(s => !s.stokKodu || s.miktar <= 0);
    if (eksikSatir) {
      showToast(`Satir ${eksikSatir.siraNo}: Stok ve miktar zorunlu!`, 'error');
      return;
    }

    setIsSaving(true);
    try {
      const accountId = await resolveAccountId(header.cariKodu);
      const effectiveTaxRate = ozet.araToplam > 0
        ? Number(((ozet.toplamVergi / ozet.araToplam) * 100).toFixed(2))
        : 20;

      await crmService.createQuote({
        account_id: accountId,
        document_no: header.belgeNo,
        title: `Teklif ${header.belgeNo}`,
        description: `Teklif Fisi - ${header.belgeNo}`,
        tax_rate: effectiveTaxRate,
        notes: header.telefon ? `Telefon: ${header.telefon}` : undefined,
        lines: hesaplanmisSatirlar.map((satir) => ({
          product_code: satir.stokKodu,
          description: satir.stokAdi || satir.stokKodu,
          quantity: satir.miktar,
          unit: 'ADET',
          unit_price: satir.birimFiyat,
          tax_rate: satir.vergiOrani,
          mikro_stok_kod: satir.stokKodu,
        })),
      });

      showToast(`Teklif ${header.belgeNo} kaydedildi!`, 'success');
      setSatirlar([]);
      await regenerate();
      setHeader((prev) => ({
        ...prev,
        cariKodu: '',
        telefon: '',
        belgeTarihi: new Date(),
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Teklif kaydi basarisiz oldu.';
      showToast(message, 'error');
    } finally {
      setIsSaving(false);
    }

  }, [header, satirlar, hesaplanmisSatirlar, ozet, showToast, resolveAccountId, regenerate]);

  // Validasyon
  const isKaydetDisabled = isSaving || !header.cariKodu || satirlar.length === 0 ||
    satirlar.some(s => !s.stokKodu || s.miktar <= 0);

  return (
    <div className="flex flex-col h-screen bg-slate-900 text-slate-200 p-4 gap-4">
      {/* Ust Bolge - Sabit Bilgiler */}
      <TeklifHeader
        data={header}
        onChange={handleHeaderChange}
      />

      {/* Orta Bolum - Satir Grid */}
      <div className="flex-1 min-h-0">
        <TeklifGrid
          satirlar={hesaplanmisSatirlar}
          onSatirEkle={handleSatirEkle}
          onSatirSil={handleSatirSil}
          onSatirChange={handleSatirChange}
          onStokSec={handleStokSec}
        />
      </div>

      {/* Alt Bolum - Ozet + Butonlar */}
      <TeklifFooter
        ozet={ozet}
        onKaydet={handleKaydet}
        onIptal={() => {
          if (confirm('Teklif iptal edilecek. Emin misiniz?')) {
            setSatirlar([]);
            setHeader({
              cariKodu: '',
              telefon: '',
              belgeNo: belgeNo || 'TF-2026-000001',
              belgeTarihi: new Date(),
            });
          }
        }}
        onYazdir={() => window.print()}
        onTeklifOlustur={() => {
          void handleKaydet();
        }}
        kaydetDisabled={isKaydetDisabled}
      />

      {/* Stok Secici Modal */}
      <StokSeciciModal
        isOpen={isStokModalOpen}
        onClose={() => {
          setIsStokModalOpen(false);
          setActiveSatirId(null);
        }}
        onSelect={handleStokSelect}
      />

      {/* Toast Container */}
      <ToastContainer />
    </div>
  );
};
