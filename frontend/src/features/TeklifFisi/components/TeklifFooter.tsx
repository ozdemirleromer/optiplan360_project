import React from 'react';
import { Save, Printer, X, FileText } from 'lucide-react';
import type { TeklifOzet } from '../types/teklif.types';
import { formatPara } from '../types/teklif.types';

interface Props {
  ozet: TeklifOzet;
  onKaydet: () => void;
  onIptal: () => void;
  onYazdir: () => void;
  onTeklifOlustur: () => void;
  kaydetDisabled?: boolean;
}

export const TeklifFooter: React.FC<Props> = ({
  ozet,
  onKaydet,
  onIptal,
  onYazdir,
  onTeklifOlustur,
  kaydetDisabled = false,
}) => {
  return (
    <div className="flex justify-between items-start p-4 bg-slate-800 rounded border-l-4 border-l-emerald-500 border border-slate-700">
      {/* Sol: Ozet Bilgiler */}
      <div className="flex gap-8">
        {/* Ara Toplam */}
        <div className="text-center">
          <span className="block text-[10px] uppercase text-slate-500 tracking-wider">Ara Toplam</span>
          <span className="block text-lg font-medium text-slate-300">
            {formatPara(ozet.araToplam)} ₺
          </span>
        </div>

        {/* Toplam Vergi */}
        <div className="text-center">
          <span className="block text-[10px] uppercase text-slate-500 tracking-wider">Toplam Vergi</span>
          <span className="block text-lg font-medium text-amber-400">
            {formatPara(ozet.toplamVergi)} ₺
          </span>
        </div>

        {/* Genel Toplam - Vurgulu */}
        <div className="text-center px-6 py-2 bg-emerald-500/10 rounded border border-emerald-500/30">
          <span className="block text-[10px] uppercase text-emerald-400 tracking-wider">Genel Toplam</span>
          <span className="block text-2xl font-bold text-emerald-400">
            {formatPara(ozet.genelToplam)} ₺
          </span>
        </div>

        {/* Satir Sayisi */}
        <div className="text-center">
          <span className="block text-[10px] uppercase text-slate-500 tracking-wider">Satir</span>
          <span className="block text-lg font-medium text-slate-300">
            {ozet.satirSayisi}
          </span>
        </div>
      </div>

      {/* Sag: Aksiyon Butonlari */}
      <div className="flex gap-2">
        <button
          onClick={onIptal}
          className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded text-sm transition-colors"
        >
          <X size={16} />
          Iptal
        </button>

        <button
          onClick={onYazdir}
          className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded text-sm transition-colors"
        >
          <Printer size={16} />
          Yazdir
        </button>

        <button
          onClick={onKaydet}
          disabled={kaydetDisabled}
          className={`flex items-center gap-2 px-6 py-2 rounded text-sm font-medium transition-colors ${
            kaydetDisabled
              ? 'bg-slate-600 text-slate-400 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-500 text-white'
          }`}
        >
          <Save size={16} />
          Kaydet
        </button>

        <button
          onClick={onTeklifOlustur}
          disabled={kaydetDisabled || ozet.satirSayisi === 0}
          className={`flex items-center gap-2 px-6 py-2 rounded text-sm font-medium transition-colors ${
            kaydetDisabled || ozet.satirSayisi === 0
              ? 'bg-slate-600 text-slate-400 cursor-not-allowed'
              : 'bg-emerald-600 hover:bg-emerald-500 text-white'
          }`}
        >
          <FileText size={16} />
          Teklif Olustur
        </button>
      </div>
    </div>
  );
};
