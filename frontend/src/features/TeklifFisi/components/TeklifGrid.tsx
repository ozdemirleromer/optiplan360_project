import React from 'react';
import { Plus, Trash2, Search } from 'lucide-react';
import type { TeklifSatir } from '../types/teklif.types';
import { formatPara } from '../types/teklif.types';
import { VergiSelector } from './VergiSelector';

interface Props {
  satirlar: TeklifSatir[];
  onSatirEkle: () => void;
  onSatirSil: (id: string) => void;
  onSatirChange: (id: string, field: keyof TeklifSatir, value: TeklifSatir[keyof TeklifSatir]) => void;
  onStokSec: (satirId: string) => void;
}

export const TeklifGrid: React.FC<Props> = ({
  satirlar,
  onSatirEkle,
  onSatirSil,
  onSatirChange,
  onStokSec,
}) => {
  
  // Satir durum indikatoru (validasyon)
  const getSatirDurum = (satir: TeklifSatir): 'tam' | 'eksik' | 'bos' => {
    if (!satir.stokKodu) return 'bos';
    if (satir.miktar <= 0 || satir.birimFiyat < 0) return 'eksik';
    return 'tam';
  };

  const durumRenkleri = {
    tam: 'bg-emerald-500',
    eksik: 'bg-amber-500',
    bos: 'bg-red-500',
  };

  return (
    <div className="flex-1 flex flex-col bg-slate-800 rounded border-l-4 border-l-amber-500 border border-slate-700 overflow-hidden">
      {/* Grid Header */}
      <div className="grid grid-cols-12 gap-2 p-3 bg-slate-750 border-b border-slate-700 text-xs font-medium text-slate-400">
        <div className="col-span-1 text-center">#</div>
        <div className="col-span-2">Stok Kodu</div>
        <div className="col-span-3">Stok Adi</div>
        <div className="col-span-1 text-right">Miktar</div>
        <div className="col-span-2 text-right">Birim Fiyat</div>
        <div className="col-span-1 text-center">Vergi</div>
        <div className="col-span-1 text-right">Tutar</div>
        <div className="col-span-1 text-center">Islem</div>
      </div>

      {/* Grid Body */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {satirlar.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-500">
            <p className="text-sm mb-2">Henuez satir eklenmemis</p>
            <button
              onClick={onSatirEkle}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded text-sm transition-colors"
            >
              <Plus size={16} />
              Satir Ekle
            </button>
          </div>
        ) : (
          satirlar.map((satir, index) => {
            const durum = getSatirDurum(satir);
            return (
              <div
                key={satir.id}
                className="grid grid-cols-12 gap-2 p-2 bg-slate-700/50 rounded border border-slate-600/50 hover:border-slate-500 transition-colors items-center"
              >
                {/* Durum Dot + Sira No */}
                <div className="col-span-1 flex items-center justify-center gap-1">
                  <div 
                    className={`w-2 h-2 rounded-full ${durumRenkleri[durum]}`}
                    title={durum === 'tam' ? 'Tam' : durum === 'eksik' ? 'Eksik' : 'Bos'}
                  />
                  <span className="text-slate-400 text-sm">{index + 1}</span>
                </div>

                {/* Stok Kodu + Secici */}
                <div className="col-span-2 flex gap-1">
                  <input
                    type="text"
                    value={satir.stokKodu}
                    readOnly
                    className="flex-1 px-2 py-1 bg-slate-700 border border-slate-600 rounded text-slate-200 text-sm cursor-pointer"
                    onClick={() => onStokSec(satir.id)}
                    placeholder="Secin..."
                  />
                  <button
                    onClick={() => onStokSec(satir.id)}
                    className="px-2 py-1 bg-slate-600 hover:bg-slate-500 text-slate-300 rounded transition-colors"
                    title="Stok Sec"
                  >
                    <Search size={14} />
                  </button>
                </div>

                {/* Stok Adi */}
                <div className="col-span-3">
                  <input
                    type="text"
                    value={satir.stokAdi}
                    readOnly
                    className="w-full px-2 py-1 bg-slate-750 border border-slate-600 rounded text-slate-300 text-sm cursor-not-allowed"
                    placeholder="Stok secilince dolar..."
                  />
                </div>

                {/* Miktar */}
                <div className="col-span-1">
                  <input
                    type="number"
                    value={satir.miktar || ''}
                    onChange={(e) => onSatirChange(satir.id, 'miktar', Number(e.target.value))}
                    min={0.01}
                    step={0.01}
                    className="w-full px-2 py-1 bg-slate-700 border border-slate-600 rounded text-slate-200 text-sm text-right focus:outline-none focus:border-blue-500"
                    placeholder="0"
                  />
                </div>

                {/* Birim Fiyat */}
                <div className="col-span-2">
                  <input
                    type="number"
                    value={satir.birimFiyat || ''}
                    onChange={(e) => onSatirChange(satir.id, 'birimFiyat', Number(e.target.value))}
                    min={0}
                    step={0.01}
                    className="w-full px-2 py-1 bg-slate-700 border border-slate-600 rounded text-slate-200 text-sm text-right focus:outline-none focus:border-blue-500"
                    placeholder="0,00"
                  />
                </div>

                {/* Vergi */}
                <div className="col-span-1">
                  <VergiSelector
                    value={satir.vergiOrani}
                    onChange={(value) => onSatirChange(satir.id, 'vergiOrani', value)}
                  />
                </div>

                {/* Tutar (Vergi Dahil - Otomatik) */}
                <div className="col-span-1 flex items-center justify-end">
                  <span className={`text-sm font-medium ${satir.toplamTutar > 0 ? 'text-emerald-400' : 'text-slate-500'}`}>
                    {formatPara(satir.toplamTutar)}
                  </span>
                </div>

                {/* Sil Butonu */}
                <div className="col-span-1 flex items-center justify-center">
                  <button
                    onClick={() => onSatirSil(satir.id)}
                    className="p-1 text-slate-500 hover:text-red-400 hover:bg-red-400/10 rounded transition-colors"
                    title="Satiri Sil"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Alt Ekle Butonu */}
      {satirlar.length > 0 && (
        <div className="p-3 border-t border-slate-700 bg-slate-750">
          <button
            onClick={onSatirEkle}
            className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded text-sm transition-colors border border-slate-600 hover:border-slate-500"
          >
            <Plus size={16} />
            Yeni Satir Ekle
          </button>
        </div>
      )}
    </div>
  );
};
